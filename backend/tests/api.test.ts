import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { createSessionToken as createToken } from "../src/modules/auth/auth.crypto.js";

let server: Server;
let baseUrl: string;
let createSessionToken: typeof createToken;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
  process.env.AUTH_SECRET ??= "test-only-salon-crm-auth-secret";
  process.env.FRONTEND_ORIGIN ??= "http://localhost:5173";

  const [{ app }, authCrypto] = await Promise.all([import("../src/app.js"), import("../src/modules/auth/auth.crypto.js")]);
  createSessionToken = authCrypto.createSessionToken;
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
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
  test("GET /api/health returns ok", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
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
