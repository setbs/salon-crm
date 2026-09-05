import { after, before, describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { createSessionToken as createToken } from "../src/modules/auth/auth.crypto.js";

let server: Server;
let baseUrl: string;
let createSessionToken: typeof createToken;
let restorePrisma = () => {};

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
  process.env.AUTH_SECRET ??= "test-only-salon-crm-auth-secret";
  process.env.FRONTEND_ORIGIN ??= "http://localhost:5173";
  process.env.STOREFRONT_ORIGIN ??= "http://localhost:5174";

  const [{ app }, authCrypto] = await Promise.all([import("../src/app.js"), import("../src/modules/auth/auth.crypto.js")]);
  createSessionToken = authCrypto.createSessionToken;
  const { prisma } = await import("../src/config/prisma.js");
  const originalFindUnique = prisma.user.findUnique;
  restorePrisma = () => { prisma.user.findUnique = originalFindUnique; };
  prisma.user.findUnique = mock.fn(async ({ where }: { where: { id: bigint } }) => {
    if (where.id === 1n) return { role: "ADMIN", passwordHash: null, employeeProfile: null };
    if (where.id === 2n) return { role: "EMPLOYEE", passwordHash: null, employeeProfile: { id: 2n, isActive: false } };
    if (where.id === 3n) return { role: "EMPLOYEE", passwordHash: null, employeeProfile: { id: 3n, isActive: true } };
    return null;
  }) as typeof prisma.user.findUnique;
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  restorePrisma();
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

describe("API smoke and CRM guards", () => {
  test("uploads reject forged raster Content-Type and convert real PNG to WebP", async () => {
    const token = await createSessionToken({ id: "1", role: "ADMIN", employeeId: null, name: "Test", email: null });
    const headers = { authorization: `Bearer ${token}`, "Content-Type": "image/png" };
    for (const body of ["<svg xmlns='http://www.w3.org/2000/svg'></svg>", "<html><script>alert(1)</script></html>"]) {
      const response = await fetch(`${baseUrl}/admin/uploads/products`, { method: "POST", headers, body });
      assert.equal(response.status, 400);
    }
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
    const response = await fetch(`${baseUrl}/admin/uploads/products`, { method: "POST", headers, body: png });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.match(result.data.imageUrl, /^\/uploads\/products\/[\w-]+\.webp$/);
    const generatedFile = path.resolve("public", result.data.imageUrl.slice(1));
    try {
      const metadata = await sharp(generatedFile).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 2);
    } finally { await rm(generatedFile, { force: true }); }
  });

  test("arbitrary CORS origins are not reflected", async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { origin: "https://attacker.invalid" } });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });

  test("security headers and safe request IDs are set", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.ok(response.headers.get("content-security-policy"));
    assert.ok(response.headers.get("x-request-id"));
  });

  test("disabled/deleted staff and stale roles cannot access CRM", async () => {
    for (const [id, role, employeeId] of [["2", "EMPLOYEE", "2"], ["99", "ADMIN", null], ["3", "ADMIN", null]] as const) {
      const token = await createSessionToken({ id, role, employeeId, name: "Test", email: null });
      const response = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.status, 401);
    }
  });

  test("password changes invalidate old credentials", async () => {
    const token = await createSessionToken({ id: "1", role: "ADMIN", employeeId: null, name: "Test", email: null }, "old-password-hash");
    const response = await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
  });

  test("employees cannot edit services even when calling the API directly", async () => {
    const token = await createSessionToken({ id: "3", role: "EMPLOYEE", employeeId: "3", name: "Test", email: null });
    const response = await fetch(`${baseUrl}/admin/services/1`, {
      method: "PATCH", headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "Changed" })
    });
    assert.equal(response.status, 403);
  });

  test("invalid JSON produces a generic 400", async () => {
    const response = await fetch(`${baseUrl}/public/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: "Invalid request body." });
  });

  test("login attempts are limited before password verification", async () => {
    let response: Response | undefined;
    for (let i = 0; i < 11; i++) {
      response = await fetch(`${baseUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    }
    assert.equal(response!.status, 429);
    assert.ok(response!.headers.get("retry-after"));
  });

  test("malformed public service filters fail without a database query", async () => {
    const response = await fetch(`${baseUrl}/employees?serviceIds=1,invalid`);
    assert.equal(response.status, 400);
  });
  test("GET /api/health returns ok", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
  });

  test("storefront origin is allowed by CORS", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { origin: "http://localhost:5174" }
    });

    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5174");
  });

  test("public product details reject an invalid id without authentication", async () => {
    const response = await fetch(`${baseUrl}/public/products/not-an-id`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.message, "Invalid product id.");
  });

  test("public store review validation rejects invalid input without touching the database", async () => {
    const response = await fetch(`${baseUrl}/public/store-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: "A", rating: 6, comment: "short", website: "bot" })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /Validation failed/);
  });

  test("public store order validation rejects an empty cart without touching the database", async () => {
    const response = await fetch(`${baseUrl}/public/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer: { firstName: "Test", lastName: "User", phone: "+380000000000" }, deliveryMethod: "pickup", items: [] })
    });

    assert.equal(response.status, 400);
  });

  test("admin routes require a CRM session", async () => {
    const response = await fetch(`${baseUrl}/admin/dashboard`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.message, "Sign in to CRM.");
  });

  test("client session cannot access CRM endpoints", async () => {
    const token = await createSessionToken({
      id: "client-1",
      role: "CLIENT",
      employeeId: null,
      name: "Client User",
      email: "client@example.com"
    });

    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.message, "You do not have access to CRM.");
  });

  test("admin session can access /auth/me", async () => {
    const token = await createSessionToken({
      id: "1",
      role: "ADMIN",
      employeeId: null,
      name: "Admin User",
      email: "admin@example.com"
    });

    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.role, "ADMIN");
    assert.equal(body.data.email, "admin@example.com");
  });

  test("business analytics rejects an invalid custom date range", async () => {
    const token = await createSessionToken({
      id: "1",
      role: "ADMIN",
      employeeId: null,
      name: "Admin User",
      email: "admin@example.com"
    });

    const response = await fetch(`${baseUrl}/admin/business-analytics?period=custom&from=2026-08-18&to=2026-08-17`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.message, "Analytics start date cannot be after end date.");
  });

  test("public booking validation reports exact contact fields", async () => {
    const response = await fetch(`${baseUrl}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: "1",
        serviceIds: ["1"],
        startTime: new Date().toISOString(),
        client: {
          firstName: "",
          lastName: "",
          phone: "x",
          email: "bad-email"
        },
        clientComment: "x".repeat(1001)
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /Validation failed:/);
    assert.ok(body.details.some((detail: string) => detail.includes("Client First Name")));
    assert.ok(body.details.some((detail: string) => detail.includes("Client Last Name")));
    assert.ok(body.details.some((detail: string) => detail.includes("Client Phone")));
    assert.ok(body.details.some((detail: string) => detail.includes("Client Email")));
    assert.ok(body.details.some((detail: string) => detail.includes("Client Comment")));
  });
});
