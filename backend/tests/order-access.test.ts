import { after, before, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.TEST_DATABASE_URL;
let prisma: PrismaClient;
let server: Server;
let base: string;
let productId: bigint;
let adminId: bigint;
let adminToken: string;
let legacyId: bigint;
const orders: { id: string; accessToken: string; paymentUrl: string }[] = [];
const invoices: Record<string, any>[] = [];
const originalFetch = globalThis.fetch;

describe("Public order ownership", { skip: !databaseUrl, concurrency: false }, () => {
  before(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET = "test-only-order-access-signing-key";
    process.env.MONOBANK_TOKEN = "test-placeholder";
    process.env.STOREFRONT_ORIGIN = "https://store.example.com";
    process.env.BACKEND_PUBLIC_URL = "https://api.example.com";
    prisma = (await import("../src/config/prisma.js")).prisma;
    const { app } = await import("../src/app.js");
    const { createSessionToken } = await import("../src/modules/auth/auth.crypto.js");
    mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input).startsWith("https://api.monobank.ua/")) {
        assert.equal(String(input), "https://api.monobank.ua/api/merchant/invoice/create");
        invoices.push(JSON.parse(String(init?.body)));
        return Response.json({ invoiceId: "ownership-" + invoices.length, pageUrl: "https://pay.mbnk.biz/test-placeholder" });
      }
      return originalFetch(input, init);
    });
    productId = (await prisma.product.create({ data: {
      name: "Order access test", sellingPrice: 100, stockQuantity: 10, minStockQuantity: 0
    } })).id;
    adminId = (await prisma.user.create({ data: {
      firstName: "Access", lastName: "Admin", phone: "0000000011", role: "ADMIN"
    } })).id;
    adminToken = await createSessionToken({ id: String(adminId), role: "ADMIN", name: "Access Admin", employeeId: null, email: null });
    legacyId = (await prisma.storeOrder.create({ data: {
      firstName: "Legacy", lastName: "Test", phone: "0000000012", deliveryMethod: "PICKUP", totalAmount: 100
    } })).id;
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}/api`;
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + "/public/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: { firstName: "Order", lastName: "Owner", phone: "0000000022" },
          deliveryMethod: "pickup", items: [{ productId: String(productId), quantity: 1 }] })
      });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get("cache-control"), "no-store");
      orders.push((await response.json()).data);
    }
  });
  after(async () => {
    mock.restoreAll();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prisma) {
      const ids = orders.map((order) => BigInt(order.id));
      if (legacyId) ids.push(legacyId);
      await prisma.storeOrderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.storeOrder.deleteMany({ where: { id: { in: ids } } });
      if (productId) await prisma.product.delete({ where: { id: productId } });
      if (adminId) await prisma.user.delete({ where: { id: adminId } });
      await prisma.$disconnect();
    }
  });
  const headers = (token?: string) => token ? { "X-Order-Access-Token": token } : {};
  async function denied(id: string, token?: string, pay = false) {
    const response = await fetch(base + `/public/orders/${id}/${pay ? "pay" : "payment-status"}`, {
      method: pay ? "POST" : "GET", headers: headers(token)
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { message: "Order not found." });
  }
  test("creation returns independent 256-bit secrets; database persists only SHA-256 hashes", async () => {
    assert.notEqual(orders[0].accessToken, orders[1].accessToken);
    for (const order of orders) {
      assert.match(order.accessToken, /^[a-f0-9]{64}$/);
      assert.ok(!("accessTokenHash" in order));
      assert.ok(order.paymentUrl);
      const stored = await prisma.storeOrder.findUniqueOrThrow({ where: { id: BigInt(order.id) } });
      assert.equal(stored.accessTokenHash, createHash("sha256").update(order.accessToken).digest("hex"));
      assert.ok(!JSON.stringify(stored, (_, value) => typeof value === "bigint" ? String(value) : value).includes(order.accessToken));
      assert.ok(!JSON.stringify(invoices).includes(order.accessToken));
    }
    assert.equal(invoices.length, 2);
    assert.deepEqual([...new URL(String(invoices[0].redirectUrl)).searchParams.keys()], ["orderId"]);
  });
  test("valid token reads status without reissuing secret or hash", async () => {
    const response = await fetch(base + `/public/orders/${orders[0].id}/payment-status`, { headers: headers(orders[0].accessToken) });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.id, orders[0].id);
    assert.equal(data.totalAmount, 100);
    assert.ok(!("accessToken" in data) && !("accessTokenHash" in data));
  });
  test("missing, malformed, wrong, cross-order and nonexistent IDs reveal nothing", async () => {
    for (const order of orders) await denied(order.id);
    await denied(orders[0].id, "bad");
    await denied(orders[0].id, "a".repeat(64));
    await denied(orders[0].id, orders[1].accessToken);
    await denied("9223372036854775807", orders[0].accessToken);
    await denied("9223372036854775808", orders[0].accessToken);
  });
  test("pay requires ownership and valid retry reuses the invoice", async () => {
    await denied(orders[0].id, undefined, true);
    await denied(orders[0].id, orders[1].accessToken, true);
    await denied(String(legacyId), orders[0].accessToken, true);
    const response = await fetch(base + `/public/orders/${orders[0].id}/pay`, { method: "POST", headers: headers(orders[0].accessToken) });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.paymentUrl, orders[0].paymentUrl);
    assert.ok(!("accessToken" in data) && !("accessTokenHash" in data));
    assert.equal(invoices.length, 2);
  });
  test("legacy orders fail closed publicly but authenticated CRM still lists all orders", async () => {
    await denied(String(legacyId));
    await denied(String(legacyId), orders[0].accessToken);
    const response = await fetch(base + "/admin/store-orders", { headers: { Authorization: "Bearer " + adminToken } });
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.ok(body.includes(`"id":"${legacyId}"`));
    assert.ok(body.includes(`"id":"${orders[0].id}"`));
    assert.ok(!body.includes("accessToken"));
  });
  test("storefront CORS permits the ownership header", async () => {
    const response = await fetch(base + `/public/orders/${orders[0].id}/payment-status`, {
      method: "OPTIONS", headers: { Origin: "https://store.example.com", "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-order-access-token" }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://store.example.com");
    assert.ok(response.headers.get("access-control-allow-headers")?.includes("x-order-access-token"));
  });
});
