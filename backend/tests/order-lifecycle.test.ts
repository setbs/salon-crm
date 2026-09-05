import { after, before, beforeEach, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, generateKeyPairSync, sign } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL;
const runId = "lifecycle-" + Date.now();
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
let prisma: PrismaClient;
let catalog: typeof import("../src/modules/catalog/catalog.service.js");
let payments: typeof import("../src/modules/payments/monobank.service.js");
let lifecycle: typeof import("../src/modules/catalog/order-lifecycle.js");
let admin: typeof import("../src/modules/admin/admin.service.js");
let productId: bigint;
const productIds: bigint[] = [];
let mode: "ok" | "timeout" | "reject" | "slow" = "ok";
let createCalls = 0;
let statusCalls = 0;
let sequence = 0;
let releaseNetwork: (() => void) | undefined;
const bank = new Map<string, Record<string, unknown>>();
type Result = Awaited<ReturnType<typeof catalog.createStoreOrder>>;
const adminActor = { id: "1", role: "ADMIN" as const, employeeId: null, name: "Test Admin", email: null };
const newKey = () => randomBytes(32).toString("hex");
const nextTime = () => new Date(Date.now() + ++sequence * 1000).toISOString();

describe("Reservation, idempotency and payment lifecycle", { skip: !databaseUrl, concurrency: false }, () => {
  before(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET = "test-only-payment-lifecycle-auth-key";
    process.env.MONOBANK_TOKEN = "test-placeholder";
    process.env.STOREFRONT_ORIGIN = "https://store.example.com";
    process.env.BACKEND_PUBLIC_URL = "https://api.example.com";
    prisma = (await import("../src/config/prisma.js")).prisma;
    catalog = await import("../src/modules/catalog/catalog.service.js");
    payments = await import("../src/modules/payments/monobank.service.js");
    lifecycle = await import("../src/modules/catalog/order-lifecycle.js");
    admin = await import("../src/modules/admin/admin.service.js");
    adminActor.id = String((await prisma.user.create({ data: { firstName: runId, lastName: "Admin", phone: "0000000033", role: "ADMIN" } })).id);
    mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/pubkey")) return Response.json({
        key: Buffer.from(publicKey.export({ type: "spki", format: "pem" })).toString("base64")
      });
      if (url.includes("/invoice/status?")) {
        statusCalls++;
        const invoiceId = new URL(url).searchParams.get("invoiceId")!;
        const event = bank.get(invoiceId);
        return Response.json(event ?? {}, { status: event ? 200 : 404 });
      }
      assert.ok(url.endsWith("/invoice/create"));
      createCalls++;
      const payload = JSON.parse(String(init?.body));
      assert.ok(payload.validity > 0 && payload.validity <= 1800);
      const invoiceId = "test-" + payload.merchantPaymInfo.reference;
      bank.set(invoiceId, { invoiceId, reference: payload.merchantPaymInfo.reference,
        amount: payload.amount, ccy: payload.ccy, status: "created", modifiedDate: nextTime() });
      if (mode === "timeout") throw new Error("simulated network timeout after acceptance");
      if (mode === "reject") return Response.json({ error: "rejected" }, { status: 400 });
      if (mode === "slow") await new Promise<void>((resolve) => { releaseNetwork = resolve; });
      return Response.json({ invoiceId, pageUrl: "https://pay.mbnk.biz/" + invoiceId });
    });
  });
  beforeEach(async () => {
    mode = "ok"; createCalls = 0; statusCalls = 0; releaseNetwork = undefined;
    productId = (await prisma.product.create({ data: { name: runId, sellingPrice: 100,
      stockQuantity: 5, minStockQuantity: 0, contentAmount: 250, contentUnit: "ML", stockContentAmount: 1250 } })).id;
    productIds.push(productId);
  });
  after(async () => {
    releaseNetwork?.();
    mock.restoreAll();
    if (prisma) {
      const sales = await prisma.productSale.findMany({ where: { items: { some: { productId: { in: productIds } } } }, select: { id: true } });
      const saleIds = sales.map((sale) => sale.id);
      await prisma.paymentAuditLog.deleteMany({ where: { payment: { productSaleId: { in: saleIds } } } });
      await prisma.payment.deleteMany({ where: { productSaleId: { in: saleIds } } });
      await prisma.productSaleItem.deleteMany({ where: { saleId: { in: saleIds } } });
      await prisma.productSale.deleteMany({ where: { id: { in: saleIds } } });
      await prisma.storeOrder.deleteMany({ where: { firstName: runId } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      await prisma.user.deleteMany({ where: { firstName: runId } });
      await prisma.$disconnect();
    }
  });
  function input(quantity = 1) {
    return { customer: { firstName: runId, lastName: "Test", phone: "0000000012" }, deliveryMethod: "pickup" as const,
      items: [{ productId: String(productId), quantity }] };
  }
  const create = (key = newKey(), quantity = 1) => catalog.createStoreOrder(input(quantity), key);
  const row = (order: Result) => prisma.storeOrder.findUniqueOrThrow({ where: { id: BigInt(order.id) } });
  const attempts = (order: Result) => prisma.paymentAttempt.findMany({ where: { orderId: BigInt(order.id) }, orderBy: { attemptNumber: "asc" } });
  const stock = async () => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
  const pay = (order: Result) => catalog.payStoreOrder(order.id, order.accessToken);
  async function deliver(order: Result, status: string, index = 0, overrides: Record<string, unknown> = {}) {
    const attempt = (await attempts(order))[index];
    const invoiceId = attempt.providerInvoiceId!;
    const event = { ...bank.get(invoiceId), invoiceId, status, modifiedDate: nextTime(), ...overrides };
    const raw = Buffer.from(JSON.stringify(event));
    await payments.handleMonobankWebhook(raw, sign("SHA256", raw, privateKey).toString("base64"));
    return event;
  }
  async function cancel(order: Result) {
    return admin.updateStoreOrderStatus(adminActor, BigInt(order.id), "cancelled");
  }

  test("stock=1: concurrent checkout reserves exactly once", async () => {
    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 1, stockContentAmount: 250 } });
    const results = await Promise.allSettled([create(), create()]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(await stock(), 0);
    assert.equal(createCalls, 1);
    assert.equal(await prisma.storeOrder.count({ where: { items: { some: { productId } } } }), 1);
  });
  test("same key is durable and concurrent duplicate requests recover the same owner token", async () => {
    const key = newKey();
    const results = await Promise.all([create(key), create(key), create(key)]);
    assert.equal(new Set(results.map((result) => result.id)).size, 1);
    assert.equal(new Set(results.map((result) => result.accessToken)).size, 1);
    assert.equal(createCalls, 1);
    assert.equal(await stock(), 4);
    await prisma.$disconnect();
    const again = await create(key);
    assert.equal(again.id, results[0].id);
    assert.equal(again.accessToken, results[0].accessToken);
    await assert.rejects(create(key, 2), (error: any) => error.statusCode === 409);
    const stored = await row(again);
    assert.ok(stored.encryptedAccessToken && !stored.encryptedAccessToken.includes(again.accessToken));
    assert.notEqual(stored.idempotencyKeyHash, key);
  });
  test("CRM sale and store checkout cannot both consume the last package", async () => {
    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 1, stockContentAmount: 250 } });
    const results = await Promise.allSettled([create(), admin.createProductSale(adminActor, {
      productId: String(productId), quantity: 1, paymentMethod: "cash"
    })]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await stock(), 0);
  });
  test("stale product edits cannot overwrite a reservation; corrections apply to free stock", async () => {
    const order = await create();
    await assert.rejects(admin.updateProduct(adminActor, productId, { stock: 5 }), (error: any) => error.statusCode === 409);
    assert.equal(await stock(), 4);
    await admin.createStockMovement(adminActor, {
      productId: String(productId), movementType: "purchase", amountMode: "packages", amount: 1, reason: "test replenishment"
    });
    assert.equal(await stock(), 5);
    await cancel(order);
    assert.equal(await stock(), 6);
  });
  test("database rejects a second active attempt even without application checks", async () => {
    const order = await create();
    await assert.rejects(prisma.paymentAttempt.create({ data: {
      orderId: BigInt(order.id), attemptNumber: 2, reference: newKey(), amount: 100, status: "CREATING"
    } }), (error: any) => error.code === "P2002");
    assert.equal((await attempts(order)).length, 1);
  });
  test("provider expiry releases the reserve and an explicit retry renews it", async () => {
    const order = await create();
    await deliver(order, "expired");
    assert.equal(await stock(), 5);
    assert.equal((await attempts(order))[0].status, "EXPIRED");
    await pay(order);
    assert.equal(await stock(), 4);
    assert.equal((await attempts(order)).length, 2);
  });
  test("cancel releases packages and content once; parallel cancel is idempotent", async () => {
    const order = await create();
    await Promise.all([cancel(order), cancel(order)]);
    assert.equal(await stock(), 5);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    assert.equal(Number(product.stockContentAmount), 1250);
    assert.equal((await row(order)).reservationState, "RELEASED");
    await assert.rejects(pay(order), (error: any) => error.statusCode === 409);
  });
  test("concurrent retry creates one new attempt and pending retry reuses it", async () => {
    const order = await create();
    await deliver(order, "failure");
    assert.equal(await stock(), 5);
    const results = await Promise.all([pay(order), pay(order)]);
    assert.equal((await attempts(order)).length, 2);
    assert.equal(createCalls, 2);
    assert.equal(await stock(), 4);
    const ready = await pay(order);
    assert.ok(ready.paymentUrl);
    assert.ok(results.some((result) => result.paymentUrl === ready.paymentUrl));
    assert.equal(createCalls, 2);
  });
  test("the invoice network call does not hold the order lock", async () => {
    mode = "slow";
    const creating = create();
    for (let i = 0; !releaseNetwork && i < 200; i++) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(releaseNetwork);
    const stored = await prisma.storeOrder.findFirstOrThrow({ where: { items: { some: { productId } } } });
    try {
      await admin.updateStoreOrderStatus(adminActor, stored.id, "cancelled");
    } finally { releaseNetwork!(); }
    const result = await creating;
    assert.equal(result.status, "cancelled");
    assert.equal(result.paymentUrl, null);
    assert.equal(await stock(), 5);
  });
  test("duplicate success and admin confirmation do not deduct stock twice; paid cannot retry or cancel", async () => {
    const order = await create();
    const event = await deliver(order, "success");
    const raw = Buffer.from(JSON.stringify(event));
    await payments.handleMonobankWebhook(raw, sign("SHA256", raw, privateKey).toString("base64"));
    await Promise.all([admin.updateStoreOrderStatus(adminActor, BigInt(order.id), "confirmed"),
      admin.updateStoreOrderStatus(adminActor, BigInt(order.id), "confirmed")]);
    assert.equal(await stock(), 4);
    assert.equal((await row(order)).reservationState, "CONSUMED");
    assert.equal(await prisma.stockMovement.count({ where: { productId, movementType: "SALE" } }), 1);
    await assert.rejects(pay(order), (error: any) => error.statusCode === 409);
    await assert.rejects(cancel(order), (error: any) => error.statusCode === 409);
  });
  test("refund is terminal and admin return is explicit and once-only", async () => {
    const order = await create();
    await deliver(order, "success");
    await deliver(order, "reversed");
    await deliver(order, "success");
    assert.equal((await row(order)).paymentStatus, "REFUNDED");
    assert.equal(await stock(), 4);
    await assert.rejects(pay(order));
    await cancel(order);
    await cancel(order);
    assert.equal(await stock(), 5);
  });
  test("expiry releases once; late success enters review without stealing reallocated stock", async () => {
    const order = await create();
    await prisma.storeOrder.update({ where: { id: BigInt(order.id) }, data: { reservationExpiresAt: new Date(0) } });
    await lifecycle.expireReservations();
    await lifecycle.expireReservations();
    assert.equal(await stock(), 5);
    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 0, stockContentAmount: 0 } });
    await deliver(order, "success");
    const stored = await row(order);
    assert.equal(stored.paymentStatus, "PAID");
    assert.equal(stored.requiresReview, true);
    assert.equal(stored.stockDeductedAt, null);
    assert.equal(await stock(), 0);
    const crmOrder = (await admin.getStoreOrders(adminActor)).find((item) => item.id === order.id)!;
    assert.match(crmOrder.paymentError!, /review/i);
    assert.ok(!JSON.stringify(crmOrder).includes(order.accessToken));
    await assert.rejects(admin.updateStoreOrderStatus(adminActor, BigInt(order.id), "confirmed"));
  });
  test("old success after retry is recorded; second success does not deduct again", async () => {
    const order = await create();
    await deliver(order, "failure");
    await pay(order);
    await deliver(order, "success", 0);
    assert.equal((await row(order)).requiresReview, true);
    assert.equal(await stock(), 4);
    await deliver(order, "success", 1);
    assert.equal((await attempts(order)).filter((attempt) => attempt.status === "PAID").length, 2);
    assert.equal(await stock(), 4);
    assert.equal((await row(order)).reviewReason, "MULTIPLE_PAYMENTS");
    await deliver(order, "reversed", 1);
    assert.equal((await row(order)).paymentStatus, "PAID");
  });
  test("amount, currency, invoice and stale timestamp cannot corrupt payment", async () => {
    const order = await create();
    await deliver(order, "success", 0, { invoiceId: "unbound" });
    assert.equal((await row(order)).requiresReview, false);
    await deliver(order, "success", 0, { amount: 1 });
    assert.equal((await row(order)).paymentStatus, "PENDING");
    await deliver(order, "success", 0, { ccy: 840 });
    assert.equal((await row(order)).paymentStatus, "PENDING");
    assert.equal((await row(order)).requiresReview, true);
    await assert.rejects(pay(order));
    await deliver(order, "success");
    await deliver(order, "failure", 0, { modifiedDate: "2000-01-01T00:00:00Z" });
    assert.equal((await row(order)).paymentStatus, "PAID");
    assert.equal(await stock(), 4);
  });
  test("lost callback reconciles paid once and polling is throttled across concurrent calls", async () => {
    const order = await create();
    const attempt = (await attempts(order))[0];
    bank.set(attempt.providerInvoiceId!, { ...bank.get(attempt.providerInvoiceId!), status: "success", modifiedDate: nextTime() });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { lastCheckedAt: new Date(0) } });
    await Promise.all([catalog.getStoreOrderPaymentStatus(order.id, order.accessToken), catalog.getStoreOrderPaymentStatus(order.id, order.accessToken)]);
    await catalog.getStoreOrderPaymentStatus(order.id, order.accessToken);
    assert.equal(statusCalls, 1);
    assert.equal((await row(order)).paymentStatus, "PAID");
    assert.equal(await stock(), 4);
  });
  test("timeout is unknown, never automatic retry, and operator recovery verifies reference", async () => {
    mode = "timeout";
    const order = await create();
    assert.equal(order.requiresReview, true);
    assert.equal(order.canRetry, false);
    assert.equal((await attempts(order))[0].status, "UNKNOWN");
    await pay(order);
    assert.equal(createCalls, 1);
    const attempt = (await attempts(order))[0];
    const invoiceId = "test-" + attempt.reference;
    await assert.rejects(payments.recoverUnknownAttempt(attempt.id, "missing"));
    const original = bank.get(invoiceId)!;
    bank.set(invoiceId, { ...original, reference: "wrong-reference" });
    await assert.rejects(payments.recoverUnknownAttempt(attempt.id, invoiceId));
    bank.set(invoiceId, original);
    bank.set(invoiceId, { ...bank.get(invoiceId), status: "success", modifiedDate: nextTime() });
    await payments.recoverUnknownAttempt(attempt.id, invoiceId);
    assert.equal((await row(order)).paymentStatus, "PAID");
    assert.equal(await stock(), 4);
  });
  test("definite invoice rejection releases reservation and allows a new safe attempt", async () => {
    mode = "reject";
    const order = await create();
    assert.equal((await row(order)).reservationState, "RELEASED");
    assert.equal(await stock(), 5);
    mode = "ok";
    await pay(order);
    assert.equal(createCalls, 2);
    assert.equal(await stock(), 4);
  });
  test("legacy paid orders with historical deduction are never deducted again", async () => {
    const order = await create();
    await prisma.storeOrder.update({ where: { id: BigInt(order.id) }, data: {
      reservationState: "LEGACY", paymentStatus: "PAID", stockDeductedAt: new Date()
    } });
    await admin.updateStoreOrderStatus(adminActor, BigInt(order.id), "confirmed");
    assert.equal(await stock(), 4);
  });
  test("a process crash leaving CREATING blocks a replacement invoice", async () => {
    mode = "timeout";
    const order = await create();
    const attempt = (await attempts(order))[0];
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "CREATING", createdAt: new Date(0) } });
    await pay(order);
    assert.equal((await attempts(order))[0].status, "UNKNOWN");
    assert.equal(createCalls, 1);
  });
});
