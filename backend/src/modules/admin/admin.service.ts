import { AppointmentStatus, PaymentMethod, PaymentStatus, Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { assertAdmin } from "../auth/auth.middleware.js";
import type { CrmAuthenticatedUser } from "../auth/auth.crypto.js";
import {
  countLowStockProducts,
  countTodayAppointments,
  findNextAppointment,
  getSalonSettings,
  listAppointments,
  listClients,
  listEmployees,
  listPayments,
  listPortfolio,
  listProductSales,
  listProducts,
  listReviews,
  listServiceCategories,
  listServices,
  sumTodayPaidRevenue
} from "./admin.repository.js";
import type {
  createAppointmentSchema,
  createProductSchema,
  createServiceSchema,
  createServiceCategorySchema,
  createSaleSchema,
  updateAppointmentSchema,
  updatePaymentSchema,
  updateProductSchema,
  updateServiceCategorySchema,
  updateServiceSchema,
  updateSettingsSchema
} from "./admin.schemas.js";
import type { z } from "zod";

export async function getDashboard(actor: CrmAuthenticatedUser) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const scopedEmployeeId = employeeScope(actor);

  const [todayAppointments, revenue, nextAppointment, lowStockProducts] = await Promise.all([
    countTodayAppointments(dayStart, dayEnd, scopedEmployeeId),
    sumTodayPaidRevenue(dayStart, dayEnd, scopedEmployeeId),
    findNextAppointment(now, scopedEmployeeId),
    actor.role === "ADMIN" ? countLowStockProducts() : Promise.resolve(0)
  ]);

  return {
    todayAppointments,
    dailyRevenue: Number(revenue._sum.amount ?? 0),
    nextAppointment: nextAppointment ? mapAppointment(nextAppointment) : null,
    lowStockProducts
  };
}

export async function getAppointments(actor: CrmAuthenticatedUser) {
  const appointments = await listAppointments(employeeScope(actor));
  return appointments.map(mapAppointment);
}

export async function getClients(actor: CrmAuthenticatedUser, search?: string) {
  const clients = await listClients(search, employeeScope(actor));

  return clients.map((client) => {
    const appointmentSpend = client.clientAppointments.reduce((sum, appointment) => sum + Number(appointment.payment?.amount ?? 0), 0);
    const productSpend = client.productSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

    return {
      id: client.id.toString(),
      name: `${client.firstName} ${client.lastName}`,
      phone: client.phone,
      email: client.email,
      visits: client.clientAppointments.length,
      spent: appointmentSpend + productSpend,
      comment: client.clientAppointments.find((appointment) => appointment.clientComment)?.clientComment ?? ""
    };
  });
}

export async function getServices(_actor: CrmAuthenticatedUser) {
  const services = await listServices();

  return services.map((service) => {
    const employees = mapServiceEmployees(service.employees);

    return {
      id: service.id.toString(),
      categoryId: service.categoryId?.toString() ?? null,
      category: service.categoryId
        ? {
            id: service.categoryId.toString(),
            name: service.categoryName ?? "Uncategorized",
            description: service.categoryDescription,
            active: service.categoryActive ?? true
          }
        : null,
      name: service.name,
      price: Number(service.price),
      duration: service.durationMinutes,
      description: service.description,
      active: service.isActive,
      employees,
      employeeIds: employees.map((employee) => employee.id)
    };
  });
}

export async function getServiceCategories(_actor: CrmAuthenticatedUser) {
  const categories = await listServiceCategories();

  return categories.map((category) => ({
    id: category.id.toString(),
    name: category.name,
    description: category.description,
    active: category.isActive
  }));
}

export async function getEmployees(actor: CrmAuthenticatedUser) {
  const employees = await listEmployees(employeeScope(actor));

  return employees.map((employee) => ({
    id: employee.id.toString(),
    name: `${employee.user.firstName} ${employee.user.lastName}`,
    specialization: employee.specialization,
    active: employee.isActive,
    hours: formatWorkingHours(employee.workingHours),
    timeOff: employee.timeOff[0] ? `${formatDate(employee.timeOff[0].startTime)} - ${formatDate(employee.timeOff[0].endTime)}` : "-"
  }));
}

export async function getPortfolio(actor: CrmAuthenticatedUser) {
  const photos = await listPortfolio(employeeScope(actor));

  return photos.map((photo) => ({
    id: photo.id.toString(),
    title: photo.description ?? "Work without description",
    master: `${photo.employee.user.firstName} ${photo.employee.user.lastName}`,
    imageUrl: photo.imageUrl,
    visible: photo.isVisible
  }));
}

export async function getProducts(actor: CrmAuthenticatedUser) {
  if (actor.role !== "ADMIN") {
    return [];
  }

  const products = await listProducts();

  return products.map((product) => ({
    id: product.id.toString(),
    category: product.category?.name ?? "Uncategorized",
    name: product.name,
    purchase: Number(product.purchasePrice ?? 0),
    sale: Number(product.sellingPrice),
    stock: product.stockQuantity,
    min: product.minStockQuantity,
    movements: product.stockMovements.map((movement) => ({
      type: movement.movementType.toLowerCase(),
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt.toISOString()
    }))
  }));
}

export async function getProductSales(actor: CrmAuthenticatedUser) {
  const sales = await listProductSales(employeeScope(actor));

  return sales.map((sale) => ({
    id: sale.id.toString(),
    product: sale.items.map((item) => item.product.name).join(", "),
    qty: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    client: sale.client ? `${sale.client.firstName} ${sale.client.lastName}` : "no client",
    employee: sale.employee ? `${sale.employee.user.firstName} ${sale.employee.user.lastName}` : null,
    payment: sale.payment?.paymentMethod.toLowerCase() ?? "cash",
    total: Number(sale.totalAmount),
    saleDate: sale.saleDate.toISOString()
  }));
}

export async function getPayments(actor: CrmAuthenticatedUser) {
  const payments = await listPayments(employeeScope(actor));

  return payments.map((payment) => ({
    id: payment.id.toString(),
    source: payment.appointment ? "Service" : "Products",
    client: payment.appointment
      ? `${payment.appointment.client.firstName} ${payment.appointment.client.lastName}`
      : payment.productSale?.client
        ? `${payment.productSale.client.firstName} ${payment.productSale.client.lastName}`
        : "no client",
    method: payment.paymentMethod.toLowerCase(),
    status: payment.paymentStatus.toLowerCase(),
    amount: Number(payment.amount),
    paidAt: payment.paidAt?.toISOString() ?? null
  }));
}

export async function getReviews(actor: CrmAuthenticatedUser) {
  const reviews = await listReviews(employeeScope(actor));

  return reviews.map((review) => ({
    id: review.id.toString(),
    client: `${review.appointment.client.firstName} ${review.appointment.client.lastName}`,
    employee: `${review.appointment.employee.user.firstName} ${review.appointment.employee.user.lastName}`,
    service: review.appointment.services.map(({ service }) => service.name).join(", "),
    rating: review.rating,
    text: review.comment ?? ""
  }));
}

export async function getSettings(_actor: CrmAuthenticatedUser) {
  const settings = await getSalonSettings();

  return {
    salonName: settings?.salonName ?? "SL Color Studio",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    address: settings?.address ?? "",
    logoUrl: settings?.logoUrl ?? "",
    hours: settings?.openingTime && settings.closingTime ? `${settings.openingTime}-${settings.closingTime}` : ""
  };
}

export async function updateAppointment(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateAppointmentSchema>) {
  const current = await prisma.appointment.findUnique({
    where: { id },
    select: { employeeId: true, startTime: true, endTime: true }
  });

  if (!current) {
    throw new HttpError(404, "Appointment not found.");
  }

  assertOwnEmployee(actor, current.employeeId);

  const startTime = input.startTime ? new Date(input.startTime) : current.startTime;
  const endTime = input.endTime
    ? new Date(input.endTime)
    : input.startTime
      ? new Date(startTime.getTime() + (current.endTime.getTime() - current.startTime.getTime()))
      : current.endTime;

  if (endTime <= startTime) {
    throw new HttpError(400, "End time must be later than start time.");
  }

  await ensureAppointmentSlotAvailable({
    employeeId: current.employeeId,
    startTime,
    endTime,
    excludeAppointmentId: id
  });

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: input.status ? toAppointmentStatus(input.status) : undefined,
      clientComment: input.clientComment,
      employeeComment: input.employeeComment,
      startTime,
      endTime
    }
  });

  return { id: appointment.id.toString() };
}

export async function createAppointment(actor: CrmAuthenticatedUser, input: z.infer<typeof createAppointmentSchema>) {
  const employeeId = BigInt(input.employeeId);
  const serviceIds = input.serviceIds.map((serviceId) => BigInt(serviceId));
  const startTime = new Date(input.startTime);

  assertOwnEmployee(actor, employeeId);

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true }
  });

  if (services.length !== serviceIds.length) {
    throw new HttpError(400, "One or more services are unavailable.");
  }

  const employeeServices = await prisma.employeeService.count({
    where: { employeeId, serviceId: { in: serviceIds } }
  });

  if (employeeServices !== serviceIds.length) {
    throw new HttpError(400, "The selected employee does not provide all selected services.");
  }

  const durationMinutes = services.reduce((sum, service) => sum + service.durationMinutes, 0);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

  await ensureAppointmentSlotAvailable({ employeeId, startTime, endTime });

  const appointment = await prisma.$transaction(async (transaction) => {
    let clientId = input.clientId ? BigInt(input.clientId) : null;

    if (!clientId) {
      if (!input.client) {
        throw new HttpError(400, "Select an existing client or fill in a new client.");
      }

      const client = await transaction.user.create({
        data: {
          firstName: input.client.firstName,
          lastName: input.client.lastName,
          phone: input.client.phone,
          email: input.client.email || null
        }
      });
      clientId = client.id;
    } else {
      const existingClient = await transaction.user.findUnique({
        where: { id: clientId },
        select: { id: true }
      });

      if (!existingClient) {
        throw new HttpError(404, "Client not found.");
      }
    }

    return transaction.appointment.create({
      data: {
        clientId,
        employeeId,
        startTime,
        endTime,
        status: toAppointmentStatus(input.status),
        clientComment: input.clientComment,
        employeeComment: input.employeeComment,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId }))
        }
      }
    });
  });

  return { id: appointment.id.toString() };
}

export async function createService(actor: CrmAuthenticatedUser, input: z.infer<typeof createServiceSchema>) {
  assertAdmin(actor);
  const employeeIds = toUniqueBigIntIds(input.employeeIds);

  const service = await prisma.$transaction(async (tx) => {
    await ensureEmployeesExist(tx, employeeIds);

    const [createdService] = await tx.$queryRaw<{ id: bigint }[]>`
      INSERT INTO services (category_id, name, description, duration_minutes, price, is_active)
      VALUES (${input.categoryId ? BigInt(input.categoryId) : null}, ${input.name}, ${input.description ?? null}, ${input.duration}, ${input.price}, ${input.active})
      RETURNING id
    `;

    await syncServiceEmployees(tx, createdService.id, employeeIds);
    return createdService;
  });

  return { id: service.id.toString() };
}

export async function updateService(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateServiceSchema>) {
  assertAdmin(actor);

  const updates: Prisma.Sql[] = [];
  const shouldSyncEmployees = input.employeeIds !== undefined;
  const employeeIds = shouldSyncEmployees ? toUniqueBigIntIds(input.employeeIds) : [];

  if (input.categoryId !== undefined) {
    updates.push(Prisma.sql`category_id = ${input.categoryId ? BigInt(input.categoryId) : null}`);
  }

  if (input.name !== undefined) {
    updates.push(Prisma.sql`name = ${input.name}`);
  }

  if (input.description !== undefined) {
    updates.push(Prisma.sql`description = ${input.description}`);
  }

  if (input.duration !== undefined) {
    updates.push(Prisma.sql`duration_minutes = ${input.duration}`);
  }

  if (input.price !== undefined) {
    updates.push(Prisma.sql`price = ${input.price}`);
  }

  if (input.active !== undefined) {
    updates.push(Prisma.sql`is_active = ${input.active}`);
  }

  const service = await prisma.$transaction(async (tx) => {
    if (shouldSyncEmployees) {
      const existingService = await tx.service.findUnique({ where: { id }, select: { id: true } });

      if (!existingService) {
        throw new HttpError(404, "Service not found.");
      }

      await ensureEmployeesExist(tx, employeeIds);
      await syncServiceEmployees(tx, id, employeeIds);
    }

    if (updates.length === 0) {
      return { id };
    }

    const [updatedService] = await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
      UPDATE services
      SET ${Prisma.join(updates, ", ")}
      WHERE id = ${id}
      RETURNING id
    `);

    if (!updatedService) {
      throw new HttpError(404, "Service not found.");
    }

    return updatedService;
  });

  return { id: service.id.toString() };
}

export async function deleteService(actor: CrmAuthenticatedUser, id: bigint) {
  assertAdmin(actor);

  const service = await prisma.service.findUnique({ where: { id }, select: { id: true } });

  if (!service) {
    throw new HttpError(404, "Service not found.");
  }

  const appointmentReferences = await prisma.appointmentService.count({ where: { serviceId: id } });

  if (appointmentReferences > 0) {
    throw new HttpError(409, "Service is used in appointments. Disable it instead to keep appointment history.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.employeeService.deleteMany({ where: { serviceId: id } });
    await tx.service.delete({ where: { id } });
  });

  return { id: id.toString() };
}

export async function createServiceCategory(actor: CrmAuthenticatedUser, input: z.infer<typeof createServiceCategorySchema>) {
  assertAdmin(actor);

  const [category] = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO service_categories (name, description, is_active, updated_at)
    VALUES (${input.name}, ${input.description ?? null}, ${input.active}, now())
    RETURNING id
  `;

  return { id: category.id.toString() };
}

export async function updateServiceCategory(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateServiceCategorySchema>) {
  assertAdmin(actor);

  const updates: Prisma.Sql[] = [Prisma.sql`updated_at = now()`];

  if (input.name !== undefined) {
    updates.push(Prisma.sql`name = ${input.name}`);
  }

  if (input.description !== undefined) {
    updates.push(Prisma.sql`description = ${input.description}`);
  }

  if (input.active !== undefined) {
    updates.push(Prisma.sql`is_active = ${input.active}`);
  }

  const [category] = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    UPDATE service_categories
    SET ${Prisma.join(updates, ", ")}
    WHERE id = ${id}
    RETURNING id
  `);

  return { id: category.id.toString() };
}

export async function createProduct(actor: CrmAuthenticatedUser, input: z.infer<typeof createProductSchema>) {
  assertAdmin(actor);

  const category = await prisma.productCategory.upsert({
    where: { name: input.category },
    update: {},
    create: { name: input.category }
  });

  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: input.name,
      brand: input.brand,
      sku: input.sku || null,
      purchasePrice: input.purchase,
      sellingPrice: input.sale,
      stockQuantity: input.stock,
      minStockQuantity: input.min
    }
  });

  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      movementType: StockMovementType.PURCHASE,
      quantity: input.stock,
      reason: "Initial stock"
    }
  });

  return { id: product.id.toString() };
}

export async function updateProduct(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateProductSchema>) {
  assertAdmin(actor);

  const category =
    input.category !== undefined
      ? await prisma.productCategory.upsert({
          where: { name: input.category },
          update: {},
          create: { name: input.category }
        })
      : null;

  const product = await prisma.product.update({
    where: { id },
    data: {
      categoryId: category?.id,
      name: input.name,
      brand: input.brand,
      sku: input.sku,
      purchasePrice: input.purchase,
      sellingPrice: input.sale,
      stockQuantity: input.stock,
      minStockQuantity: input.min
    }
  });

  return { id: product.id.toString() };
}

export async function createProductSale(actor: CrmAuthenticatedUser, input: z.infer<typeof createSaleSchema>) {
  const productId = BigInt(input.productId);
  const quantity = input.quantity;
  const paymentMethod = toPaymentMethod(input.paymentMethod);
  const employeeId = actor.role === "EMPLOYEE" ? employeeScope(actor) : input.employeeId ? BigInt(input.employeeId) : null;

  const sale = await prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({ where: { id: productId } });

    if (!product || !product.isActive) {
      throw new HttpError(404, "Product not found.");
    }

    if (product.stockQuantity < quantity) {
      throw new HttpError(400, "Not enough stock for this sale.");
    }

    const totalAmount = Number(product.sellingPrice) * quantity;

    const createdSale = await transaction.productSale.create({
      data: {
        clientId: input.clientId ? BigInt(input.clientId) : null,
        employeeId,
        totalAmount,
        saleDate: new Date(),
        items: {
          create: {
            productId,
            quantity,
            unitPrice: product.sellingPrice
          }
        }
      }
    });

    await transaction.product.update({
      where: { id: productId },
      data: { stockQuantity: { decrement: quantity } }
    });

    await transaction.stockMovement.create({
      data: {
        productId,
        movementType: StockMovementType.SALE,
        quantity: -quantity,
        reason: `Sale #${createdSale.id.toString()}`
      }
    });

    await transaction.payment.create({
      data: {
        productSaleId: createdSale.id,
        amount: totalAmount,
        paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date()
      }
    });

    return createdSale;
  });

  return { id: sale.id.toString() };
}

export async function updatePayment(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updatePaymentSchema>) {
  await assertPaymentAccess(actor, id);

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      paymentStatus: toPaymentStatus(input.status),
      paymentMethod: input.method ? toPaymentMethod(input.method) : undefined,
      paidAt: input.status === "paid" ? new Date() : undefined
    }
  });

  return { id: payment.id.toString() };
}

export async function updateSettings(actor: CrmAuthenticatedUser, input: z.infer<typeof updateSettingsSchema>) {
  assertAdmin(actor);

  const settings = await prisma.salonSetting.upsert({
    where: { id: 1n },
    update: {
      salonName: input.salonName,
      phone: input.phone,
      email: input.email || null,
      address: input.address,
      logoUrl: input.logoUrl,
      openingTime: input.openingTime,
      closingTime: input.closingTime
    },
    create: {
      id: 1n,
      salonName: input.salonName,
      phone: input.phone,
      email: input.email || null,
      address: input.address,
      logoUrl: input.logoUrl,
      openingTime: input.openingTime,
      closingTime: input.closingTime
    }
  });

  return { id: settings.id.toString() };
}

function mapServiceEmployees(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isJsonObject)
    .map((employee) => ({
      id: String(employee.id),
      name: typeof employee.name === "string" && employee.name.trim() ? employee.name : "Unnamed employee",
      specialization: typeof employee.specialization === "string" ? employee.specialization : null
    }));
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toUniqueBigIntIds(ids: string[] | undefined) {
  return [...new Set(ids ?? [])].map((id) => BigInt(id));
}

async function ensureEmployeesExist(client: Prisma.TransactionClient, employeeIds: bigint[]) {
  if (employeeIds.length === 0) {
    return;
  }

  const count = await client.employee.count({ where: { id: { in: employeeIds } } });

  if (count !== employeeIds.length) {
    throw new HttpError(400, "One or more assigned employees do not exist.");
  }
}

async function syncServiceEmployees(client: Prisma.TransactionClient, serviceId: bigint, employeeIds: bigint[]) {
  await client.employeeService.deleteMany({ where: { serviceId } });

  if (employeeIds.length === 0) {
    return;
  }

  await client.employeeService.createMany({
    data: employeeIds.map((employeeId) => ({ employeeId, serviceId })),
    skipDuplicates: true
  });
}

function mapAppointment(appointment: Awaited<ReturnType<typeof listAppointments>>[number]) {
  return {
    id: appointment.id.toString(),
    time: appointment.startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: appointment.startTime.toISOString(),
    endDate: appointment.endTime.toISOString(),
    employeeId: appointment.employeeId.toString(),
    serviceIds: appointment.services.map(({ service }) => service.id.toString()),
    client: `${appointment.client.firstName} ${appointment.client.lastName}`,
    service: appointment.services.map(({ service }) => service.name).join(", "),
    master: `${appointment.employee.user.firstName} ${appointment.employee.user.lastName}`,
    status: mapAppointmentStatus(appointment.status),
    clientComment: appointment.clientComment ?? "",
    employeeComment: appointment.employeeComment ?? "",
    comment: appointment.clientComment ?? appointment.employeeComment ?? "",
    amount: Number(appointment.payment?.amount ?? 0)
  };
}

async function ensureAppointmentSlotAvailable(input: {
  employeeId: bigint;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: bigint;
}) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      employeeId: input.employeeId,
      status: { not: AppointmentStatus.CANCELLED },
      id: input.excludeAppointmentId ? { not: input.excludeAppointmentId } : undefined,
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime }
    },
    select: { id: true }
  });

  if (conflict) {
    throw new HttpError(409, "This time is already booked by another appointment.");
  }
}

function mapAppointmentStatus(status: AppointmentStatus) {
  if (status === AppointmentStatus.COMPLETED) {
    return "completed";
  }

  if (status === AppointmentStatus.CANCELLED) {
    return "cancelled";
  }

  if (status === AppointmentStatus.NO_SHOW) {
    return "no_show";
  }

  return "scheduled";
}

function toAppointmentStatus(status: string) {
  if (status === "completed") {
    return AppointmentStatus.COMPLETED;
  }

  if (status === "cancelled") {
    return AppointmentStatus.CANCELLED;
  }

  if (status === "no_show") {
    return AppointmentStatus.NO_SHOW;
  }

  return AppointmentStatus.PENDING;
}

function toPaymentMethod(method: string) {
  if (method === "card") {
    return PaymentMethod.CARD;
  }

  if (method === "blik") {
    return PaymentMethod.BLIK;
  }

  if (method === "transfer") {
    return PaymentMethod.TRANSFER;
  }

  return PaymentMethod.CASH;
}

function toPaymentStatus(status: string) {
  if (status === "paid") {
    return PaymentStatus.PAID;
  }

  if (status === "refunded") {
    return PaymentStatus.REFUNDED;
  }

  return PaymentStatus.PENDING;
}

function employeeScope(actor: CrmAuthenticatedUser) {
  if (actor.role === "ADMIN") {
    return undefined;
  }

  if (!actor.employeeId) {
    throw new HttpError(403, "Employee profile is not configured.");
  }

  return BigInt(actor.employeeId);
}

function assertOwnEmployee(actor: CrmAuthenticatedUser, employeeId: bigint) {
  if (actor.role === "ADMIN") {
    return;
  }

  const scopedEmployeeId = employeeScope(actor);

  if (scopedEmployeeId !== employeeId) {
    throw new HttpError(403, "Employees can access only their own CRM workspace.");
  }
}

async function assertPaymentAccess(actor: CrmAuthenticatedUser, paymentId: bigint) {
  if (actor.role === "ADMIN") {
    return;
  }

  const scopedEmployeeId = employeeScope(actor);
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      OR: [{ appointment: { employeeId: scopedEmployeeId } }, { productSale: { employeeId: scopedEmployeeId } }]
    },
    select: { id: true }
  });

  if (!payment) {
    throw new HttpError(403, "Employees can access only their own payments.");
  }
}

function formatWorkingHours(hours: Array<{ startTime: string; endTime: string }>) {
  if (hours.length === 0) {
    return "-";
  }

  return `${hours[0].startTime}-${hours[0].endTime}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
