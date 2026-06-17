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

type ConsumableUnitValue = "ML" | "GRAM";

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
    const consumables = mapServiceConsumables(service.consumables);

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
      priceFrom: service.priceFrom ? Number(service.priceFrom) : null,
      priceTo: service.priceTo ? Number(service.priceTo) : null,
      duration: service.durationMinutes,
      description: service.description,
      active: service.isActive,
      appointmentCount: service.appointmentCount,
      canDelete: service.appointmentCount === 0,
      consumables,
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
  const productContentRows = await prisma.$queryRaw<
    Array<{ id: bigint; contentAmount: Prisma.Decimal | null; contentUnit: string | null; stockContentAmount: Prisma.Decimal | null }>
  >`
    SELECT
      id,
      content_amount AS "contentAmount",
      lower(content_unit::text) AS "contentUnit",
      stock_content_amount AS "stockContentAmount"
    FROM products
  `;
  const productContent = new Map(productContentRows.map((row) => [row.id.toString(), row]));

  return products.map((product) => {
    const content = productContent.get(product.id.toString());
    const contentAmount = content?.contentAmount ? Number(content.contentAmount) : null;
    const stockContentAmount = content?.stockContentAmount ? Number(content.stockContentAmount) : null;

    return {
      id: product.id.toString(),
      category: product.category?.name ?? "Uncategorized",
      name: product.name,
      purchase: Number(product.purchasePrice ?? 0),
      sale: Number(product.sellingPrice),
      stock: product.stockQuantity,
      min: product.minStockQuantity,
      contentAmount,
      contentUnit: content?.contentUnit ?? null,
      stockContentAmount,
      stockPackageEquivalent: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null,
      movements: product.stockMovements.map((movement) => ({
        type: movement.movementType.toLowerCase(),
        quantity: movement.quantity,
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString()
      }))
    };
  });
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
    select: { employeeId: true, startTime: true, endTime: true, status: true }
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

  const nextStatus = input.status ? toAppointmentStatus(input.status) : undefined;
  const shouldApplyConsumables = nextStatus === AppointmentStatus.COMPLETED && current.status !== AppointmentStatus.COMPLETED;

  const appointment = await prisma.$transaction(async (transaction) => {
    const updatedAppointment = await transaction.appointment.update({
      where: { id },
      data: {
        status: nextStatus,
        clientComment: input.clientComment,
        employeeComment: input.employeeComment,
        startTime,
        endTime
      }
    });

    if (shouldApplyConsumables) {
      await applyAppointmentConsumables(transaction, id);
    }

    return updatedAppointment;
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

    const appointmentStatus = toAppointmentStatus(input.status);
    const createdAppointment = await transaction.appointment.create({
      data: {
        clientId,
        employeeId,
        startTime,
        endTime,
        status: appointmentStatus,
        clientComment: input.clientComment,
        employeeComment: input.employeeComment,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId }))
        }
      }
    });

    if (appointmentStatus === AppointmentStatus.COMPLETED) {
      await applyAppointmentConsumables(transaction, createdAppointment.id);
    }

    return createdAppointment;
  });

  return { id: appointment.id.toString() };
}

export async function createService(actor: CrmAuthenticatedUser, input: z.infer<typeof createServiceSchema>) {
  assertAdmin(actor);
  const employeeIds = toUniqueBigIntIds(input.employeeIds);
  const consumables = normalizeConsumables(input.consumables);

  const service = await prisma.$transaction(async (tx) => {
    await ensureEmployeesExist(tx, employeeIds);
    await ensureProductsExist(tx, consumables.map((consumable) => consumable.productId));
    await ensureConsumableProductsConfigured(tx, consumables);

    const [createdService] = await tx.$queryRaw<{ id: bigint }[]>`
      INSERT INTO services (category_id, name, description, duration_minutes, price, price_from, price_to, is_active)
      VALUES (${input.categoryId ? BigInt(input.categoryId) : null}, ${input.name}, ${input.description ?? null}, ${input.duration}, ${input.price}, ${input.priceFrom ?? null}, ${input.priceTo ?? null}, ${input.active})
      RETURNING id
    `;

    await syncServiceEmployees(tx, createdService.id, employeeIds);
    await syncServiceConsumables(tx, createdService.id, consumables);
    return createdService;
  });

  return { id: service.id.toString() };
}

export async function updateService(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateServiceSchema>) {
  assertAdmin(actor);

  const updates: Prisma.Sql[] = [];
  const shouldSyncEmployees = input.employeeIds !== undefined;
  const shouldSyncConsumables = input.consumables !== undefined;
  const employeeIds = shouldSyncEmployees ? toUniqueBigIntIds(input.employeeIds) : [];
  const consumables = shouldSyncConsumables ? normalizeConsumables(input.consumables) : [];

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

  if (input.priceFrom !== undefined) {
    updates.push(Prisma.sql`price_from = ${input.priceFrom}`);
  }

  if (input.priceTo !== undefined) {
    updates.push(Prisma.sql`price_to = ${input.priceTo}`);
  }

  if (input.active !== undefined) {
    updates.push(Prisma.sql`is_active = ${input.active}`);
  }

  const service = await prisma.$transaction(async (tx) => {
    if (shouldSyncEmployees || shouldSyncConsumables) {
      const existingService = await tx.service.findUnique({ where: { id }, select: { id: true } });

      if (!existingService) {
        throw new HttpError(404, "Service not found.");
      }
    }

    if (shouldSyncEmployees) {
      await ensureEmployeesExist(tx, employeeIds);
      await syncServiceEmployees(tx, id, employeeIds);
    }

    if (shouldSyncConsumables) {
      await ensureProductsExist(tx, consumables.map((consumable) => consumable.productId));
      await ensureConsumableProductsConfigured(tx, consumables);
      await syncServiceConsumables(tx, id, consumables);
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

export async function deleteServiceCategory(actor: CrmAuthenticatedUser, id: bigint) {
  assertAdmin(actor);

  const [category] = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id
    FROM service_categories
    WHERE id = ${id}
  `;

  if (!category) {
    throw new HttpError(404, "Service category not found.");
  }

  await prisma.$executeRaw`
    DELETE FROM service_categories
    WHERE id = ${id}
  `;

  return { id: id.toString() };
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

  if (input.contentAmount) {
    await prisma.$executeRaw`
      UPDATE products
      SET
        content_amount = ${input.contentAmount},
        content_unit = ${toConsumableUnit(input.contentUnit ?? "ml")}::"ConsumableUnit",
        stock_content_amount = ${input.contentAmount * input.stock}
      WHERE id = ${product.id}
    `;
  }

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

  if (input.contentAmount !== undefined) {
    await prisma.$executeRaw`
      UPDATE products
      SET
        content_amount = ${input.contentAmount},
        content_unit = ${toConsumableUnit(input.contentUnit ?? "ml")}::"ConsumableUnit",
        stock_content_amount = ${input.contentAmount * (input.stock ?? product.stockQuantity)}
      WHERE id = ${id}
    `;
  } else if (input.stock !== undefined) {
    await prisma.$executeRaw`
      UPDATE products
      SET stock_content_amount = ${input.stock} * content_amount
      WHERE id = ${id}
        AND content_amount IS NOT NULL
    `;
  }

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

    const [inventory] = await transaction.$queryRaw<
      Array<{ contentAmount: Prisma.Decimal | null; stockContentAmount: Prisma.Decimal | null }>
    >`
      SELECT content_amount AS "contentAmount", stock_content_amount AS "stockContentAmount"
      FROM products
      WHERE id = ${productId}
    `;
    const contentAmount = inventory?.contentAmount ? Number(inventory.contentAmount) : null;
    const stockContentAmount = inventory?.stockContentAmount ? Number(inventory.stockContentAmount) : null;

    if (stockContentAmount !== null && contentAmount !== null && contentAmount > 0 && stockContentAmount < quantity * contentAmount) {
      throw new HttpError(400, "Not enough product content for this sale.");
    }

    if (stockContentAmount === null && product.stockQuantity < quantity) {
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

    if (stockContentAmount !== null && contentAmount !== null && contentAmount > 0) {
      const nextStockContentAmount = Math.max(stockContentAmount - quantity * contentAmount, 0);

      await transaction.$executeRaw`
        UPDATE products
        SET
          stock_content_amount = ${nextStockContentAmount},
          stock_quantity = floor(${nextStockContentAmount} / ${contentAmount})::int
        WHERE id = ${productId}
      `;
    } else {
      await transaction.product.update({
        where: { id: productId },
        data: { stockQuantity: { decrement: quantity } }
      });
    }

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

function mapServiceConsumables(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isJsonObject).map((consumable) => ({
    productId: String(consumable.productId),
    productName: typeof consumable.productName === "string" ? consumable.productName : "Unnamed product",
    productCategory: typeof consumable.productCategory === "string" ? consumable.productCategory : null,
    quantity: toNumber(consumable.quantity),
    unit: consumable.unit === "gram" ? "gram" : "ml",
    productContentAmount: consumable.productContentAmount === null ? null : toNumber(consumable.productContentAmount),
    productContentUnit: consumable.productContentUnit === "gram" ? "gram" : consumable.productContentUnit === "ml" ? "ml" : null
  }));
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return Number(value.toString());
  }

  return 0;
}

function toUniqueBigIntIds(ids: string[] | undefined) {
  return [...new Set(ids ?? [])].map((id) => BigInt(id));
}

function normalizeConsumables(input: Array<{ productId: string; quantity: number; unit: "ml" | "gram" }> | undefined) {
  const consumables = new Map<string, { productId: bigint; quantity: number; unit: ConsumableUnitValue }>();

  for (const consumable of input ?? []) {
    consumables.set(consumable.productId, {
      productId: BigInt(consumable.productId),
      quantity: consumable.quantity,
      unit: toConsumableUnit(consumable.unit)
    });
  }

  return [...consumables.values()];
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

async function ensureProductsExist(client: Prisma.TransactionClient, productIds: bigint[]) {
  if (productIds.length === 0) {
    return;
  }

  const count = await client.product.count({ where: { id: { in: productIds }, isActive: true } });

  if (count !== productIds.length) {
    throw new HttpError(400, "One or more consumable products do not exist.");
  }
}

async function ensureConsumableProductsConfigured(
  client: Prisma.TransactionClient,
  consumables: Array<{ productId: bigint; quantity: number; unit: ConsumableUnitValue }>
) {
  if (consumables.length === 0) {
    return;
  }

  const rows = await client.$queryRaw<Array<{ id: bigint; name: string; contentAmount: Prisma.Decimal | null; contentUnit: string | null }>>(Prisma.sql`
    SELECT id, name, content_amount AS "contentAmount", lower(content_unit::text) AS "contentUnit"
    FROM products
    WHERE id IN (${Prisma.join(consumables.map((consumable) => consumable.productId))})
  `);
  const products = new Map(rows.map((row) => [row.id.toString(), row]));

  for (const consumable of consumables) {
    const product = products.get(consumable.productId.toString());

    if (!product?.contentAmount || !product.contentUnit) {
      throw new HttpError(400, "Consumable products must have package content configured.");
    }

    if (product.contentUnit !== toPublicUnit(consumable.unit)) {
      throw new HttpError(400, `Consumable unit does not match product package unit for ${product.name}.`);
    }
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

async function syncServiceConsumables(
  client: Prisma.TransactionClient,
  serviceId: bigint,
  consumables: Array<{ productId: bigint; quantity: number; unit: ConsumableUnitValue }>
) {
  await client.$executeRaw`
    DELETE FROM service_consumables
    WHERE service_id = ${serviceId}
  `;

  if (consumables.length === 0) {
    return;
  }

  for (const consumable of consumables) {
    await client.$executeRaw`
      INSERT INTO service_consumables (service_id, product_id, quantity, unit, updated_at)
      VALUES (${serviceId}, ${consumable.productId}, ${consumable.quantity}, ${consumable.unit}::"ConsumableUnit", now())
    `;
  }
}

function toConsumableUnit(unit: "ml" | "gram") {
  return unit === "gram" ? "GRAM" : "ML";
}

function toPublicUnit(unit: ConsumableUnitValue) {
  return unit === "GRAM" ? "gram" : "ml";
}

async function applyAppointmentConsumables(client: Prisma.TransactionClient, appointmentId: bigint) {
  const [existingLog] = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM service_consumption_logs
    WHERE appointment_id = ${appointmentId}
  `;

  if ((existingLog?.count ?? 0) > 0) {
    return;
  }

  const consumables = await client.$queryRaw<
    Array<{
      serviceId: bigint;
      productId: bigint;
      productName: string;
      quantity: Prisma.Decimal;
      unit: string;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
      stockContentAmount: Prisma.Decimal | null;
    }>
  >`
    SELECT
      appointment_service.service_id AS "serviceId",
      service_consumable.product_id AS "productId",
      product.name AS "productName",
      SUM(service_consumable.quantity) AS quantity,
      lower(service_consumable.unit::text) AS unit,
      product.content_amount AS "contentAmount",
      lower(product.content_unit::text) AS "contentUnit",
      product.stock_content_amount AS "stockContentAmount"
    FROM appointment_services appointment_service
    JOIN service_consumables service_consumable ON service_consumable.service_id = appointment_service.service_id
    JOIN products product ON product.id = service_consumable.product_id
    WHERE appointment_service.appointment_id = ${appointmentId}
    GROUP BY appointment_service.service_id, service_consumable.product_id, service_consumable.unit, product.id
    ORDER BY product.name ASC
  `;

  if (consumables.length === 0) {
    return;
  }

  const stockByProduct = new Map<string, number>();

  for (const consumable of consumables) {
    const quantity = toNumber(consumable.quantity);
    const contentAmount = consumable.contentAmount ? toNumber(consumable.contentAmount) : null;
    const stockContentAmount = consumable.stockContentAmount ? toNumber(consumable.stockContentAmount) : null;
    const productKey = consumable.productId.toString();

    if (!contentAmount || !consumable.contentUnit || stockContentAmount === null) {
      throw new HttpError(400, `Product ${consumable.productName} does not have package content configured.`);
    }

    if (consumable.contentUnit !== consumable.unit) {
      throw new HttpError(400, `Consumable unit does not match product package unit for ${consumable.productName}.`);
    }

    const currentStockContentAmount = stockByProduct.get(productKey) ?? stockContentAmount;

    if (currentStockContentAmount < quantity) {
      throw new HttpError(400, `Not enough consumable stock for ${consumable.productName}.`);
    }

    const nextStockContentAmount = Math.max(currentStockContentAmount - quantity, 0);
    stockByProduct.set(productKey, nextStockContentAmount);

    await client.$executeRaw`
      UPDATE products
      SET
        stock_content_amount = ${nextStockContentAmount},
        stock_quantity = floor(${nextStockContentAmount} / ${contentAmount})::int
      WHERE id = ${consumable.productId}
    `;

    await client.$executeRaw`
      INSERT INTO service_consumption_logs (
        appointment_id,
        service_id,
        product_id,
        quantity,
        unit,
        stock_content_before,
        stock_content_after
      )
      VALUES (
        ${appointmentId},
        ${consumable.serviceId},
        ${consumable.productId},
        ${quantity},
        ${toConsumableUnit(consumable.unit === "gram" ? "gram" : "ml")}::"ConsumableUnit",
        ${currentStockContentAmount},
        ${nextStockContentAmount}
      )
    `;
  }
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
