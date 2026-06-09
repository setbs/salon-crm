import { AppointmentStatus, PaymentMethod, PaymentStatus, Prisma, StockMovementType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
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

export async function getDashboard() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [todayAppointments, revenue, nextAppointment, lowStockProducts] = await Promise.all([
    countTodayAppointments(dayStart, dayEnd),
    sumTodayPaidRevenue(dayStart, dayEnd),
    findNextAppointment(now),
    countLowStockProducts()
  ]);

  return {
    todayAppointments,
    dailyRevenue: Number(revenue._sum.amount ?? 0),
    nextAppointment: nextAppointment ? mapAppointment(nextAppointment) : null,
    lowStockProducts
  };
}

export async function getAppointments() {
  const appointments = await listAppointments();
  return appointments.map(mapAppointment);
}

export async function getClients(search?: string) {
  const clients = await listClients(search);

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

export async function getServices() {
  const services = await listServices();

  return services.map((service) => ({
    id: service.id.toString(),
    categoryId: service.categoryId?.toString() ?? null,
    category: service.categoryId
      ? {
          id: service.categoryId.toString(),
          name: service.categoryName ?? "Без категорії",
          description: service.categoryDescription,
          active: service.categoryActive ?? true
        }
      : null,
    name: service.name,
    price: Number(service.price),
    duration: service.durationMinutes,
    description: service.description,
    active: service.isActive
  }));
}

export async function getServiceCategories() {
  const categories = await listServiceCategories();

  return categories.map((category) => ({
    id: category.id.toString(),
    name: category.name,
    description: category.description,
    active: category.isActive
  }));
}

export async function getEmployees() {
  const employees = await listEmployees();

  return employees.map((employee) => ({
    id: employee.id.toString(),
    name: `${employee.user.firstName} ${employee.user.lastName}`,
    specialization: employee.specialization,
    active: employee.isActive,
    hours: formatWorkingHours(employee.workingHours),
    timeOff: employee.timeOff[0] ? `${formatDate(employee.timeOff[0].startTime)} - ${formatDate(employee.timeOff[0].endTime)}` : "-"
  }));
}

export async function getPortfolio() {
  const photos = await listPortfolio();

  return photos.map((photo) => ({
    id: photo.id.toString(),
    title: photo.description ?? "Робота без опису",
    master: `${photo.employee.user.firstName} ${photo.employee.user.lastName}`,
    imageUrl: photo.imageUrl,
    visible: photo.isVisible
  }));
}

export async function getProducts() {
  const products = await listProducts();

  return products.map((product) => ({
    id: product.id.toString(),
    category: product.category?.name ?? "Без категорії",
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

export async function getProductSales() {
  const sales = await listProductSales();

  return sales.map((sale) => ({
    id: sale.id.toString(),
    product: sale.items.map((item) => item.product.name).join(", "),
    qty: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    client: sale.client ? `${sale.client.firstName} ${sale.client.lastName}` : "без клієнта",
    employee: sale.employee ? `${sale.employee.user.firstName} ${sale.employee.user.lastName}` : null,
    payment: sale.payment?.paymentMethod.toLowerCase() ?? "cash",
    total: Number(sale.totalAmount),
    saleDate: sale.saleDate.toISOString()
  }));
}

export async function getPayments() {
  const payments = await listPayments();

  return payments.map((payment) => ({
    id: payment.id.toString(),
    source: payment.appointment ? "Послуга" : "Косметика",
    client: payment.appointment
      ? `${payment.appointment.client.firstName} ${payment.appointment.client.lastName}`
      : payment.productSale?.client
        ? `${payment.productSale.client.firstName} ${payment.productSale.client.lastName}`
        : "без клієнта",
    method: payment.paymentMethod.toLowerCase(),
    status: payment.paymentStatus.toLowerCase(),
    amount: Number(payment.amount),
    paidAt: payment.paidAt?.toISOString() ?? null
  }));
}

export async function getReviews() {
  const reviews = await listReviews();

  return reviews.map((review) => ({
    id: review.id.toString(),
    client: `${review.appointment.client.firstName} ${review.appointment.client.lastName}`,
    employee: `${review.appointment.employee.user.firstName} ${review.appointment.employee.user.lastName}`,
    service: review.appointment.services.map(({ service }) => service.name).join(", "),
    rating: review.rating,
    text: review.comment ?? ""
  }));
}

export async function getSettings() {
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

export async function updateAppointment(id: bigint, input: z.infer<typeof updateAppointmentSchema>) {
  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      status: input.status ? toAppointmentStatus(input.status) : undefined,
      clientComment: input.clientComment,
      employeeComment: input.employeeComment,
      startTime: input.startTime ? new Date(input.startTime) : undefined,
      endTime: input.endTime ? new Date(input.endTime) : undefined
    }
  });

  return { id: appointment.id.toString() };
}

export async function createService(input: z.infer<typeof createServiceSchema>) {
  const [service] = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO services (category_id, name, description, duration_minutes, price, is_active)
    VALUES (${input.categoryId ? BigInt(input.categoryId) : null}, ${input.name}, ${input.description ?? null}, ${input.duration}, ${input.price}, ${input.active})
    RETURNING id
  `;

  return { id: service.id.toString() };
}

export async function updateService(id: bigint, input: z.infer<typeof updateServiceSchema>) {
  const updates: Prisma.Sql[] = [];

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

  if (updates.length === 0) {
    return { id: id.toString() };
  }

  const [service] = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    UPDATE services
    SET ${Prisma.join(updates, ", ")}
    WHERE id = ${id}
    RETURNING id
  `);

  return { id: service.id.toString() };
}

export async function createServiceCategory(input: z.infer<typeof createServiceCategorySchema>) {
  const [category] = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO service_categories (name, description, is_active, updated_at)
    VALUES (${input.name}, ${input.description ?? null}, ${input.active}, now())
    RETURNING id
  `;

  return { id: category.id.toString() };
}

export async function updateServiceCategory(id: bigint, input: z.infer<typeof updateServiceCategorySchema>) {
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

export async function createProduct(input: z.infer<typeof createProductSchema>) {
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

export async function updateProduct(id: bigint, input: z.infer<typeof updateProductSchema>) {
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

export async function createProductSale(input: z.infer<typeof createSaleSchema>) {
  const productId = BigInt(input.productId);
  const quantity = input.quantity;
  const paymentMethod = toPaymentMethod(input.paymentMethod);

  const sale = await prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({ where: { id: productId } });

    if (!product || !product.isActive) {
      throw new HttpError(404, "Товар не знайдено.");
    }

    if (product.stockQuantity < quantity) {
      throw new HttpError(400, "Недостатньо товару на складі для цього продажу.");
    }

    const totalAmount = Number(product.sellingPrice) * quantity;

    const createdSale = await transaction.productSale.create({
      data: {
        clientId: input.clientId ? BigInt(input.clientId) : null,
        employeeId: input.employeeId ? BigInt(input.employeeId) : null,
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
        reason: `Продаж #${createdSale.id.toString()}`
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

export async function updatePayment(id: bigint, input: z.infer<typeof updatePaymentSchema>) {
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

export async function updateSettings(input: z.infer<typeof updateSettingsSchema>) {
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

function mapAppointment(appointment: Awaited<ReturnType<typeof listAppointments>>[number]) {
  return {
    id: appointment.id.toString(),
    time: appointment.startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: appointment.startTime.toISOString(),
    client: `${appointment.client.firstName} ${appointment.client.lastName}`,
    service: appointment.services.map(({ service }) => service.name).join(", "),
    master: `${appointment.employee.user.firstName} ${appointment.employee.user.lastName}`,
    status: mapAppointmentStatus(appointment.status),
    comment: appointment.clientComment ?? appointment.employeeComment ?? "",
    amount: Number(appointment.payment?.amount ?? 0)
  };
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

function formatWorkingHours(hours: Array<{ startTime: string; endTime: string }>) {
  if (hours.length === 0) {
    return "-";
  }

  return `${hours[0].startTime}-${hours[0].endTime}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
