import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import type { Server } from "node:http";
import type { createSessionToken as createToken } from "../src/modules/auth/auth.crypto.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runId = `api_db_${Date.now()}`;

let server: Server;
let baseUrl: string;
let prisma: PrismaClient;
let createSessionToken: typeof createToken;
let adminToken: string;
let adminUserId: bigint;
let employeeId: bigint;
let serviceId: bigint;
let unusedServiceId: bigint;
let productId: bigint;
let unusedProductId: bigint;
let appointmentId: string;
let appointmentStartTime: string;

describe("DB-backed admin API workflows", { concurrency: false, skip: !testDatabaseUrl }, () => {
  before(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.AUTH_SECRET ??= "test-only-salon-crm-auth-secret";
    process.env.FRONTEND_ORIGIN ??= "http://localhost:5173";

    const [{ app }, prismaConfig, authCrypto] = await Promise.all([
      import("../src/app.js"),
      import("../src/config/prisma.js"),
      import("../src/modules/auth/auth.crypto.js")
    ]);

    prisma = prismaConfig.prisma;
    createSessionToken = authCrypto.createSessionToken;
    await cleanupRunData();

    const fixtures = await createFixtures();
    adminUserId = fixtures.adminUserId;
    employeeId = fixtures.employeeId;
    serviceId = fixtures.serviceId;
    unusedServiceId = fixtures.unusedServiceId;
    productId = fixtures.productId;
    unusedProductId = fixtures.unusedProductId;
    appointmentStartTime = fixtures.appointmentStartTime;
    adminToken = await createSessionToken({
      id: adminUserId.toString(),
      role: "ADMIN",
      employeeId: null,
      name: "API Test Admin",
      email: `${runId}.admin@example.com`
    });

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a TCP port.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    if (prisma) {
      await cleanupRunData();
      await prisma.$disconnect();
    }
  });

  test("creates an appointment through the admin API", async () => {
    const response = await apiFetch("/admin/appointments", {
      method: "POST",
      body: {
        employeeId: employeeId.toString(),
        serviceIds: [serviceId.toString()],
        startTime: appointmentStartTime,
        client: {
          firstName: "API",
          lastName: "Client",
          phone: "+48111111111",
          email: `${runId}.client@example.com`
        },
        clientComment: "DB backed API test"
      }
    });

    assert.equal(response.status, 201);
    assert.match(response.body.data.id, /^\d+$/);
    appointmentId = response.body.data.id;

    const appointment = await prisma.appointment.findUnique({
      where: { id: BigInt(appointmentId) },
      include: { services: true }
    });

    assert.equal(appointment?.status, "PENDING");
    assert.equal(appointment?.services.length, 1);
  });

  test("completes appointment and writes off planned consumables", async () => {
    const response = await apiFetch(`/admin/appointments/${appointmentId}`, {
      method: "PATCH",
      body: {
        status: "completed",
        paymentAmount: 300,
        paymentMethod: "cash",
        paymentStatus: "paid"
      }
    });

    assert.equal(response.status, 200);

    const [product, consumptionLog, payment, appointment] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, select: { stockContentAmount: true } }),
      findConsumptionLog(BigInt(appointmentId), productId),
      prisma.payment.findUnique({ where: { appointmentId: BigInt(appointmentId) } }),
      prisma.appointment.findUnique({ where: { id: BigInt(appointmentId) }, select: { status: true } })
    ]);

    assert.equal(appointment?.status, "COMPLETED");
    assert.equal(Number(product?.stockContentAmount), 160);
    assert.equal(Number(consumptionLog?.quantity), 20);
    assert.equal(payment?.paymentStatus, "PAID");
    assert.equal(Number(payment?.amount), 300);
  });

  test("corrects completed appointment payment and actual consumable usage", async () => {
    const response = await apiFetch(`/admin/appointments/${appointmentId}`, {
      method: "PATCH",
      body: {
        paymentAmount: 420,
        paymentMethod: "card",
        paymentStatus: "paid",
        consumables: [{ productId: productId.toString(), quantity: 40, unit: "ml" }]
      }
    });

    assert.equal(response.status, 200);

    const [product, consumptionLog, payment] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId }, select: { stockContentAmount: true } }),
      findConsumptionLog(BigInt(appointmentId), productId),
      prisma.payment.findUnique({ where: { appointmentId: BigInt(appointmentId) } })
    ]);

    assert.equal(Number(product?.stockContentAmount), 140);
    assert.equal(Number(consumptionLog?.quantity), 40);
    assert.equal(payment?.paymentMethod, "CARD");
    assert.equal(Number(payment?.amount), 420);
  });

  test("reports material pressure and consumable stock forecast in business analytics", async () => {
    const appointmentDate = appointmentStartTime.slice(0, 10);
    const response = await apiFetch(`/admin/business-analytics?period=custom&from=${appointmentDate}&to=${appointmentDate}`);

    assert.equal(response.status, 200);

    const materialUsage = response.body.data.materialUsageByService.find((item: { serviceId: string }) => item.serviceId === serviceId.toString());
    const productUsage = response.body.data.procedureProductUsage.find((item: { productId: string }) => item.productId === productId.toString());
    const dailyTrend = response.body.data.dailyTrend.find((item: { revenueTo: number; profitTo: number | null }) => item.revenueTo === 420 && item.profitTo === 340);
    const employeePerformance = response.body.data.employeePerformance.find((item: { employeeId: string }) => item.employeeId === employeeId.toString());
    const attentionItem = response.body.data.attentionItems.find((item: { title: string }) => item.title.includes(`${runId} consumable`));

    assert.equal(materialUsage.serviceName, `${runId} service`);
    assert.equal(materialUsage.appointmentCount, 1);
    assert.equal(materialUsage.usedMl, 40);
    assert.equal(materialUsage.consumableCost, 80);
    assert.equal(materialUsage.profitFrom, 340);

    assert.equal(productUsage.productName, `${runId} consumable`);
    assert.equal(productUsage.usedQuantity, 40);
    assert.equal(productUsage.consumableCost, 80);
    assert.equal(productUsage.averagePerAppointment, 40);
    assert.equal(productUsage.estimatedProceduresLeft, 3);

    assert.equal(dailyTrend.revenueTo, 420);
    assert.equal(dailyTrend.profitTo, 340);
    assert.equal(response.body.data.comparison.completedVisits.current, 1);
    assert.equal(response.body.data.comparison.completedVisits.previous, 0);
    assert.equal(employeePerformance.employeeName, "API Employee");
    assert.equal(employeePerformance.completedVisits, 1);
    assert.equal(employeePerformance.consumableCost, 80);
    assert.equal(employeePerformance.averageProfitTo, 340);
    assert.equal(attentionItem.severity, "info");
  });

  test("subtracts refunded appointment payments from business analytics", async () => {
    const refundResponse = await apiFetch(`/admin/appointments/${appointmentId}`, {
      method: "PATCH",
      body: {
        paymentAmount: 420,
        paymentMethod: "card",
        paymentStatus: "refunded"
      }
    });

    assert.equal(refundResponse.status, 200);

    const appointmentDate = appointmentStartTime.slice(0, 10);
    const response = await apiFetch(`/admin/business-analytics?period=custom&from=${appointmentDate}&to=${appointmentDate}`);

    assert.equal(response.status, 200);

    const serviceProfit = response.body.data.services.find((item: { serviceId: string }) => item.serviceId === serviceId.toString());
    const materialUsage = response.body.data.materialUsageByService.find((item: { serviceId: string }) => item.serviceId === serviceId.toString());
    const dailyTrend = response.body.data.dailyTrend.find((item: { date: string }) => item.date === appointmentDate);
    const employeePerformance = response.body.data.employeePerformance.find((item: { employeeId: string }) => item.employeeId === employeeId.toString());

    assert.equal(serviceProfit.revenueTo, -420);
    assert.equal(serviceProfit.profitTo, -500);
    assert.equal(materialUsage.revenueTo, -420);
    assert.equal(materialUsage.profitTo, -500);
    assert.equal(dailyTrend.revenueTo, -420);
    assert.equal(dailyTrend.profitTo, -500);
    assert.equal(response.body.data.comparison.serviceRevenue.current, -420);
    assert.equal(response.body.data.comparison.serviceProfit.current, -500);
    assert.equal(employeePerformance.averageProfitTo, -500);
  });

  test("subtracts refunded product sales from business analytics", async () => {
    const saleDate = new Date(appointmentStartTime);

    await prisma.productSale.create({
      data: {
        employeeId,
        totalAmount: 300,
        saleDate,
        items: {
          create: {
            productId,
            quantity: 1,
            unitPrice: 300
          }
        },
        payment: {
          create: {
            amount: 300,
            paymentMethod: "CASH",
            paymentStatus: "REFUNDED",
            paidAt: saleDate
          }
        }
      }
    });

    const saleDateInput = appointmentStartTime.slice(0, 10);
    const response = await apiFetch(`/admin/business-analytics?period=custom&from=${saleDateInput}&to=${saleDateInput}`);

    assert.equal(response.status, 200);

    const category = response.body.data.productSalesByCategory.find((item: { name: string }) => item.name === "Uncategorized");
    const brand = response.body.data.productSalesByBrand.find((item: { name: string }) => item.name === "API Test");

    assert.equal(category.quantity, -1);
    assert.equal(category.revenue, -300);
    assert.equal(category.profit, -180);
    assert.equal(brand.quantity, -1);
    assert.equal(brand.revenue, -300);
    assert.equal(brand.profit, -180);
    assert.equal(response.body.data.comparison.productRevenue.current, -300);
    assert.equal(response.body.data.comparison.productProfit.current, -180);
  });

  test("keeps service history by rejecting delete for services used in appointments", async () => {
    const response = await apiFetch(`/admin/services/${serviceId}`, { method: "DELETE" });

    assert.equal(response.status, 409);
    assert.equal(response.body.message, "Service is used in appointments. Disable it instead to keep appointment history.");
  });

  test("deletes unused services", async () => {
    const response = await apiFetch(`/admin/services/${unusedServiceId}`, { method: "DELETE" });

    assert.equal(response.status, 204);
    assert.equal(await prisma.service.findUnique({ where: { id: unusedServiceId } }), null);
  });

  test("deactivates products that are referenced by service history", async () => {
    const response = await apiFetch(`/admin/products/${productId}`, { method: "DELETE" });

    assert.equal(response.status, 204);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { isActive: true } });
    assert.equal(product?.isActive, false);
  });

  test("deletes unused products", async () => {
    const response = await apiFetch(`/admin/products/${unusedProductId}`, { method: "DELETE" });

    assert.equal(response.status, 204);
    assert.equal(await prisma.product.findUnique({ where: { id: unusedProductId } }), null);
  });
});

async function apiFetch(path: string, input: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: input.method ?? "GET",
    headers: {
      authorization: `Bearer ${adminToken}`,
      ...(input.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body)
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null
  };
}

async function createFixtures() {
  const appointmentDate = nextLocalDateForAppointment();
  const appointmentStartTime = appointmentDate.toISOString();
  const dayOfWeek = appointmentDate.getDay();

  const adminUser = await prisma.user.create({
    data: {
      firstName: "API",
      lastName: "Admin",
      phone: "+48000000001",
      email: `${runId}.admin@example.com`,
      role: "ADMIN"
    }
  });
  const employeeUser = await prisma.user.create({
    data: {
      firstName: "API",
      lastName: "Employee",
      phone: "+48000000002",
      email: `${runId}.employee@example.com`,
      role: "EMPLOYEE",
      employeeProfile: {
        create: {
          specialization: "API testing",
          workingHours: {
            create: {
              dayOfWeek,
              startTime: "09:00",
              endTime: "18:00"
            }
          }
        }
      }
    },
    include: { employeeProfile: true }
  });

  if (!employeeUser.employeeProfile) {
    throw new Error("Employee fixture was not created.");
  }

  const product = await prisma.product.create({
    data: {
      name: `${runId} consumable`,
      brand: "API Test",
      description: "Consumable used by DB-backed API tests",
      productPurpose: "BOTH",
      purchasePrice: 120,
      sellingPrice: 300,
      stockQuantity: 3,
      minStockQuantity: 1,
      contentAmount: 60,
      contentUnit: "ML",
      stockContentAmount: 180,
      isActive: true
    }
  });
  const unusedProduct = await prisma.product.create({
    data: {
      name: `${runId} unused product`,
      brand: "API Test",
      productPurpose: "BOTH",
      purchasePrice: 50,
      sellingPrice: 100,
      stockQuantity: 1,
      minStockQuantity: 0,
      contentAmount: 50,
      contentUnit: "ML",
      stockContentAmount: 50,
      isActive: true
    }
  });
  const service = await prisma.service.create({
    data: {
      name: `${runId} service`,
      description: "Service used by DB-backed API tests",
      durationMinutes: 60,
      price: 300,
      isActive: true,
      employees: {
        create: {
          employeeId: employeeUser.employeeProfile.id
        }
      },
      consumables: {
        create: {
          productId: product.id,
          quantity: 20,
          unit: "ML"
        }
      }
    }
  });
  const unusedService = await prisma.service.create({
    data: {
      name: `${runId} unused service`,
      durationMinutes: 30,
      price: 100,
      isActive: true
    }
  });

  return {
    adminUserId: adminUser.id,
    employeeId: employeeUser.employeeProfile.id,
    serviceId: service.id,
    unusedServiceId: unusedService.id,
    productId: product.id,
    unusedProductId: unusedProduct.id,
    appointmentStartTime
  };
}

async function findConsumptionLog(appointmentId: bigint, productId: bigint) {
  return prisma.serviceConsumptionLog.findFirst({
    where: {
      appointmentId,
      productId
    },
    select: { quantity: true }
  });
}

function nextLocalDateForAppointment() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(10, 0, 0, 0);
  return date;
}

async function cleanupRunData() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: runId } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);
  const products = await prisma.product.findMany({
    where: { name: { startsWith: runId } },
    select: { id: true }
  });
  const productIds = products.map((product) => product.id);
  const services = await prisma.service.findMany({
    where: { name: { startsWith: runId } },
    select: { id: true }
  });
  const serviceIds = services.map((service) => service.id);
  const appointments = await prisma.appointment.findMany({
    where: {
      OR: [{ clientId: { in: userIds } }, { services: { some: { serviceId: { in: serviceIds } } } }]
    },
    select: { id: true }
  });
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const productSales = await prisma.productSale.findMany({
    where: {
      OR: [{ clientId: { in: userIds } }, { employee: { userId: { in: userIds } } }, { items: { some: { productId: { in: productIds } } } }]
    },
    select: { id: true }
  });
  const productSaleIds = productSales.map((sale) => sale.id);

  await prisma.appointmentAuditLog.deleteMany({ where: { OR: [{ appointmentId: { in: appointmentIds } }, { actorUserId: { in: userIds } }] } });
  await prisma.serviceConsumptionLog.deleteMany({
    where: {
      OR: [{ appointmentId: { in: appointmentIds } }, { productId: { in: productIds } }, { serviceId: { in: serviceIds } }]
    }
  });
  await prisma.payment.deleteMany({ where: { OR: [{ appointmentId: { in: appointmentIds } }, { productSaleId: { in: productSaleIds } }] } });
  await prisma.productSaleItem.deleteMany({ where: { OR: [{ saleId: { in: productSaleIds } }, { productId: { in: productIds } }] } });
  await prisma.productSale.deleteMany({ where: { id: { in: productSaleIds } } });
  await prisma.appointmentService.deleteMany({ where: { OR: [{ appointmentId: { in: appointmentIds } }, { serviceId: { in: serviceIds } }] } });
  await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.serviceConsumable.deleteMany({ where: { OR: [{ productId: { in: productIds } }, { serviceId: { in: serviceIds } }] } });
  await prisma.employeeService.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await prisma.workingHour.deleteMany({ where: { employee: { userId: { in: userIds } } } });
  await prisma.employee.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
  await prisma.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
