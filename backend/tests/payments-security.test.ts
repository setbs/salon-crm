import { after, before, beforeEach, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL;
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
let prisma: PrismaClient;
let payments: typeof import("../src/modules/payments/monobank.service.js");
let orderId: bigint;
let invoiceId: string;
const modifiedDate = "2026-09-01T10:00:00Z";
let fetchMock: ReturnType<typeof mock.method>;

describe("Monobank signed events", { skip: !databaseUrl, concurrency: false }, () => {
  before(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET = "test-only-salon-security-signing-key";
    process.env.MONOBANK_TOKEN = "test-placeholder";
    prisma = (await import("../src/config/prisma.js")).prisma;
    payments = await import("../src/modules/payments/monobank.service.js");
    fetchMock = mock.method(globalThis, "fetch", async (url: string) => {
      assert.equal(url, "https://api.monobank.ua/api/merchant/pubkey");
      const key = Buffer.from(publicKey.export({ type: "spki", format: "pem" })).toString("base64");
      return Response.json({ key });
    });
    const order = await prisma.storeOrder.create({ data: {
      accessTokenHash: (await import("../src/modules/catalog/order-access.js")).createOrderAccess().accessTokenHash,
      firstName: "Payment", lastName: "Test", phone: "0000000000",
      deliveryMethod: "PICKUP", totalAmount: 100, paymentAmount: 100
    } });
    orderId = order.id;
    invoiceId = `security-test-invoice-${orderId}`;
  });
  beforeEach(async () => {
    await prisma.storeOrder.update({ where: { id: orderId }, data: {
      paymentStatus: "PENDING", monobankInvoiceId: invoiceId,
      paymentPageUrl: "https://pay.mbnk.biz/test-placeholder", paymentModifiedAt: null, paidAt: null
    } });
  });
  after(async () => {
    mock.restoreAll();
    if (orderId) await prisma.storeOrder.delete({ where: { id: orderId } });
    await prisma?.$disconnect();
  });

  async function deliver(overrides: Record<string, unknown> = {}) {
    const raw = Buffer.from(JSON.stringify({ invoiceId, status: "success", amount: 10000, ccy: 980, modifiedDate, ...overrides }));
    return payments.handleMonobankWebhook(raw, sign("SHA256", raw, privateKey).toString("base64"));
  }
  const status = async () => (await prisma.storeOrder.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus;

  test("unsigned and forged events cannot change the payment", async () => {
    await assert.rejects(payments.handleMonobankWebhook(Buffer.from("{}"), undefined));
    await assert.rejects(payments.handleMonobankWebhook(Buffer.from("{}"), Buffer.alloc(64).toString("base64")));
    assert.equal(await status(), "PENDING");
  });
  test("verified success marks only the matching invoice paid", async () => {
    await deliver();
    assert.equal(await status(), "PAID");
  });
  test("reference cannot substitute for an unknown invoice", async () => {
    await deliver({ invoiceId: "another-invoice", reference: orderId.toString() });
    assert.equal(await status(), "PENDING");
  });
  test("wrong or missing amount and currency cannot mark an order paid", async () => {
    for (const overrides of [{ amount: 1 }, { ccy: 840 }, { amount: undefined }, { ccy: undefined }]) {
      await deliver(overrides);
      assert.notEqual(await status(), "PAID");
      await prisma.storeOrder.update({ where: { id: orderId }, data: { paymentModifiedAt: null } });
    }
  });
  test("hold is not captured payment", async () => {
    await deliver({ status: "hold" });
    assert.equal(await status(), "PENDING");
  });
  test("replay and old events cannot undo a successful payment", async () => {
    await deliver();
    await deliver({ status: "failure" });
    await deliver({ status: "failure", modifiedDate: "2026-09-01T09:00:00Z" });
    assert.equal(await status(), "PAID");
  });
  test("concurrent success and refund leave the latest refund terminal", async () => {
    await Promise.all([deliver(), deliver({ status: "reversed", modifiedDate: "2026-09-01T11:00:00Z" })]);
    assert.equal(await status(), "REFUNDED");
    await deliver({ modifiedDate: "2026-09-01T12:00:00Z" });
    assert.equal(await status(), "REFUNDED");
    await assert.rejects(payments.createMonobankPaymentForOrder(orderId));
  });
  test("concurrent retries reuse a pending invoice without bank requests", async () => {
    const callsBefore = fetchMock.mock.callCount();
    const results = await Promise.all([payments.createMonobankPaymentForOrder(orderId), payments.createMonobankPaymentForOrder(orderId)]);
    assert.ok(results.every((result) => result.paymentUrl === "https://pay.mbnk.biz/test-placeholder"));
    assert.equal(fetchMock.mock.callCount(), callsBefore);
  });
});
