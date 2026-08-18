import { AppointmentStatus, PaymentMethod, PaymentStatus, Prisma, StockMovementType, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { assertAdmin } from "../auth/auth.middleware.js";
import { hashPassword, type CrmAuthenticatedUser } from "../auth/auth.crypto.js";
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
  createEmployeeSchema,
  createEmployeeTimeOffSchema,
  createPortfolioPhotoSchema,
  createProductBrandSchema,
  createProductCategorySchema,
  createProductSchema,
  createServiceSchema,
  createServiceCategorySchema,
  createStockMovementSchema,
  createSaleSchema,
  updateAppointmentSchema,
  updateEmployeeSchema,
  updateEmployeeWorkingHoursSchema,
  updatePaymentSchema,
  updatePortfolioPhotoSchema,
  updateProductBrandSchema,
  updateProductCategorySchema,
  updateProductSchema,
  updateServiceCategorySchema,
  updateServiceSchema,
  updateSettingsSchema
} from "./admin.schemas.js";
import type { z } from "zod";

type ConsumableUnitValue = "ML" | "GRAM";
type ProductPurposeValue = "SALE" | "PROCEDURE" | "BOTH";
type PublicProductPurpose = "sale" | "procedure" | "both";
type AppointmentServiceLine = {
  id: string;
  name: string;
  duration: number;
  price: number;
  priceFrom: number | null;
  priceTo: number | null;
};
type AppointmentFinancialSummary = {
  revenueFrom: number;
  revenueTo: number;
  consumableCost: number | null;
  profitAfterConsumablesFrom: number | null;
  profitAfterConsumablesTo: number | null;
};
type AppointmentAuditEntry = {
  id: string;
  eventType: string;
  summary: string;
  actor: string;
  createdAt: string;
};
type PaymentAuditEntry = {
  id: string;
  eventType: string;
  summary: string;
  actor: string;
  createdAt: string;
  details: Record<string, unknown> | null;
};
type PaymentSnapshot = {
  amount: Prisma.Decimal | number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: Date | null;
};
type AppointmentDisplayExtras = {
  services: AppointmentServiceLine[];
  financials: AppointmentFinancialSummary;
  auditLogs: AppointmentAuditEntry[];
};
const portfolioUploadTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);
const portfolioUploadDir = path.resolve(process.cwd(), "public/uploads/portfolio");
const productUploadDir = path.resolve(process.cwd(), "public/uploads/products");

export async function getDashboard(actor: CrmAuthenticatedUser) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const scopedEmployeeId = employeeScope(actor);

  const [todayAppointments, revenueRows, nextAppointment, lowStockProducts] = await Promise.all([
    countTodayAppointments(dayStart, dayEnd, scopedEmployeeId),
    sumTodayPaidRevenue(dayStart, dayEnd, scopedEmployeeId),
    findNextAppointment(now, scopedEmployeeId),
    actor.role === "ADMIN" ? countLowStockProducts() : Promise.resolve(0)
  ]);
  const nextAppointmentExtras = nextAppointment ? await getAppointmentDisplayExtras([nextAppointment.id]) : new Map<string, AppointmentDisplayExtras>();

  return {
    todayAppointments,
    dailyRevenue: roundMoney(toNumber(revenueRows[0]?.amount)),
    nextAppointment: nextAppointment ? mapAppointment(nextAppointment, nextAppointmentExtras.get(nextAppointment.id.toString())) : null,
    lowStockProducts
  };
}

export async function getAppointments(actor: CrmAuthenticatedUser) {
  const appointments = await listAppointments(employeeScope(actor));
  const extras = await getAppointmentDisplayExtras(appointments.map((appointment) => appointment.id));
  return appointments.map((appointment) => mapAppointment(appointment, extras.get(appointment.id.toString())));
}

export async function getAppointmentConsumablePreview(actor: CrmAuthenticatedUser, id: bigint) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: true,
      employee: { include: { user: true } },
      services: { include: { service: true } },
      payment: true
    }
  });

  if (!appointment) {
    throw new HttpError(404, "Appointment not found.");
  }

  assertOwnEmployee(actor, appointment.employeeId);

  const alreadyWrittenOff = await hasAppointmentConsumptionLogs(prisma, id);
  const items = alreadyWrittenOff ? await buildAppointmentActualConsumablePreviewItems(prisma, id) : await buildAppointmentConsumablePreviewItems(prisma, id);
  const extras = await getAppointmentDisplayExtras([id]);
  const financials = extras.get(id.toString())?.financials ?? createAppointmentFinancialSummary([], 0);
  const warnings: string[] = [];

  if (appointment.status === AppointmentStatus.COMPLETED) {
    warnings.push("This appointment is completed. Saving will adjust payment and consumable stock movements.");
  }

  if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.NO_SHOW) {
    warnings.push("Only scheduled appointments can be completed.");
  }

  if (items.length === 0) {
    warnings.push("No consumables are configured for the selected services.");
  }

  for (const item of items) {
    if (item.issue) {
      warnings.push(item.issue);
    }
  }

  const hasBlockingIssue = !alreadyWrittenOff && items.some((item) => !item.enough);
  const canManageCompletion = appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.COMPLETED;

  return {
    appointment: {
      id: appointment.id.toString(),
      client: `${appointment.client.firstName} ${appointment.client.lastName}`,
      service: appointment.services.map(({ service }) => service.name).join(", "),
      master: `${appointment.employee.user.firstName} ${appointment.employee.user.lastName}`,
      time: appointment.startTime.toISOString()
    },
    financials: {
      revenueFrom: financials.revenueFrom,
      revenueTo: financials.revenueTo,
      paymentAmount: appointment.payment ? Number(appointment.payment.amount) : financials.revenueTo,
      paymentMethod: appointment.payment?.paymentMethod.toLowerCase() ?? "cash",
      consumableCost: financials.consumableCost,
      profitAfterConsumablesFrom: financials.profitAfterConsumablesFrom,
      profitAfterConsumablesTo: financials.profitAfterConsumablesTo
    },
    status: mapAppointmentStatus(appointment.status),
    alreadyWrittenOff,
    canComplete: canManageCompletion && !hasBlockingIssue,
    warnings: [...new Set(warnings)],
    items
  };
}

export async function getClients(actor: CrmAuthenticatedUser, search?: string) {
  const clients = await listClients(search, employeeScope(actor));

  return clients.map((client) => {
    const appointmentSpend = client.clientAppointments.reduce((sum, appointment) => sum + getNetPaymentAmount(appointment.payment), 0);
    const productSpend = client.productSales.reduce((sum, sale) => sum + getNetPaymentAmount(sale.payment), 0);

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

export async function getClientProfile(actor: CrmAuthenticatedUser, id: bigint) {
  const scopedEmployeeId = employeeScope(actor);
  const client = await prisma.user.findFirst({
    where: {
      id,
      role: UserRole.CLIENT,
      ...(scopedEmployeeId
        ? {
            OR: [{ clientAppointments: { some: { employeeId: scopedEmployeeId } } }, { productSales: { some: { employeeId: scopedEmployeeId } } }]
          }
        : {})
    },
    include: {
      clientAppointments: {
        where: scopedEmployeeId ? { employeeId: scopedEmployeeId } : undefined,
        include: {
          employee: { include: { user: true } },
          services: { include: { service: true } },
          payment: true,
          review: true
        },
        orderBy: { startTime: "desc" }
      },
      productSales: {
        where: scopedEmployeeId ? { employeeId: scopedEmployeeId } : undefined,
        include: {
          employee: { include: { user: true } },
          items: { include: { product: true } },
          payment: true
        },
        orderBy: { saleDate: "desc" }
      }
    }
  });

  if (!client) {
    throw new HttpError(404, "Client not found.");
  }

  const appointmentSpend = client.clientAppointments.reduce((sum, appointment) => sum + getNetPaymentAmount(appointment.payment), 0);
  const productSpend = client.productSales.reduce((sum, sale) => sum + getNetPaymentAmount(sale.payment), 0);

  return {
    id: client.id.toString(),
    name: `${client.firstName} ${client.lastName}`,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email,
    visits: client.clientAppointments.length,
    spent: appointmentSpend + productSpend,
    comment: client.clientAppointments.find((appointment) => appointment.clientComment)?.clientComment ?? "",
    appointments: client.clientAppointments.map((appointment) => ({
      id: appointment.id.toString(),
      date: appointment.startTime.toISOString(),
      time: appointment.startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      service: appointment.services.map(({ service }) => service.name).join(", "),
      employee: `${appointment.employee.user.firstName} ${appointment.employee.user.lastName}`,
      status: mapAppointmentStatus(appointment.status),
      amount: Number(appointment.payment?.amount ?? 0),
      paymentStatus: appointment.payment?.paymentStatus.toLowerCase() ?? "pending",
      clientComment: appointment.clientComment ?? "",
      employeeComment: appointment.employeeComment ?? "",
      rating: appointment.review?.rating ?? null
    })),
    sales: client.productSales.map((sale) => ({
      id: sale.id.toString(),
      saleDate: sale.saleDate.toISOString(),
      products: sale.items.map((item) => item.product.name).join(", "),
      quantity: sale.items.reduce((sum, item) => sum + item.quantity, 0),
      employee: sale.employee ? `${sale.employee.user.firstName} ${sale.employee.user.lastName}` : null,
      paymentStatus: sale.payment?.paymentStatus.toLowerCase() ?? "pending",
      paymentMethod: sale.payment?.paymentMethod.toLowerCase() ?? "cash",
      total: Number(sale.totalAmount)
    }))
  };
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
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    name: `${employee.user.firstName} ${employee.user.lastName}`,
    phone: employee.user.phone,
    email: employee.user.email,
    specialization: employee.specialization,
    description: employee.description,
    active: employee.isActive,
    serviceIds: employee.services.map(({ service }) => service.id.toString()),
    services: employee.services.map(({ service }) => ({
      id: service.id.toString(),
      name: service.name,
      categoryId: null,
      categoryName: null
    })),
    workingHours: employee.workingHours.map((hour) => ({
      id: hour.id.toString(),
      dayOfWeek: hour.dayOfWeek,
      startTime: hour.startTime,
      endTime: hour.endTime
    })),
    timeOffItems: employee.timeOff.map((timeOff) => ({
      id: timeOff.id.toString(),
      startTime: timeOff.startTime.toISOString(),
      endTime: timeOff.endTime.toISOString(),
      reason: timeOff.reason
    })),
    hours: formatWorkingHours(employee.workingHours),
    timeOff: formatTimeOffSummary(employee.timeOff)
  }));
}

export async function createEmployee(actor: CrmAuthenticatedUser, input: z.infer<typeof createEmployeeSchema>) {
  assertAdmin(actor);
  const serviceIds = toUniqueBigIntIds(input.serviceIds);

  const employee = await prisma.$transaction(async (tx) => {
    await ensureServicesExist(tx, serviceIds);

    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: UserRole.EMPLOYEE
      }
    });

    const createdEmployee = await tx.employee.create({
      data: {
        userId: user.id,
        specialization: input.specialization || null,
        description: input.description || null,
        isActive: input.active
      }
    });

    await syncEmployeeServices(tx, createdEmployee.id, serviceIds);
    return createdEmployee;
  });

  return { id: employee.id.toString() };
}

export async function updateEmployee(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateEmployeeSchema>) {
  assertAdmin(actor);
  const shouldSyncServices = input.serviceIds !== undefined;
  const serviceIds = shouldSyncServices ? toUniqueBigIntIds(input.serviceIds) : [];

  const employee = await prisma.$transaction(async (tx) => {
    const existingEmployee = await tx.employee.findUnique({ where: { id }, include: { user: true } });

    if (!existingEmployee) {
      throw new HttpError(404, "Employee not found.");
    }

    if (shouldSyncServices) {
      await ensureServicesExist(tx, serviceIds);
      await syncEmployeeServices(tx, id, serviceIds);
    }

    const userData: Prisma.UserUpdateInput = {};

    if (input.firstName !== undefined) {
      userData.firstName = input.firstName;
    }

    if (input.lastName !== undefined) {
      userData.lastName = input.lastName;
    }

    if (input.phone !== undefined) {
      userData.phone = input.phone;
    }

    if (input.email !== undefined) {
      userData.email = input.email;
    }

    if (input.password) {
      userData.passwordHash = hashPassword(input.password);
    }

    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: existingEmployee.userId },
        data: userData
      });
    }

    const employeeData: Prisma.EmployeeUpdateInput = {};

    if (input.specialization !== undefined) {
      employeeData.specialization = input.specialization || null;
    }

    if (input.description !== undefined) {
      employeeData.description = input.description || null;
    }

    if (input.active !== undefined) {
      employeeData.isActive = input.active;
    }

    if (Object.keys(employeeData).length > 0) {
      return tx.employee.update({
        where: { id },
        data: employeeData
      });
    }

    return existingEmployee;
  });

  return { id: employee.id.toString() };
}

export async function updateEmployeeWorkingHours(
  actor: CrmAuthenticatedUser,
  id: bigint,
  input: z.infer<typeof updateEmployeeWorkingHoursSchema>
) {
  assertOwnEmployee(actor, id);

  await prisma.$transaction(async (tx) => {
    await ensureEmployeesExist(tx, [id]);
    await tx.workingHour.deleteMany({ where: { employeeId: id } });

    if (input.hours.length > 0) {
      await tx.workingHour.createMany({
        data: input.hours.map((hour) => ({
          employeeId: id,
          dayOfWeek: hour.dayOfWeek,
          startTime: hour.startTime,
          endTime: hour.endTime
        }))
      });
    }
  });

  return { id: id.toString() };
}

export async function createEmployeeTimeOff(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof createEmployeeTimeOffSchema>) {
  assertOwnEmployee(actor, id);

  const timeOff = await prisma.$transaction(async (tx) => {
    await ensureEmployeesExist(tx, [id]);

    return tx.employeeTimeOff.create({
      data: {
        employeeId: id,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        reason: input.reason || null
      }
    });
  });

  return { id: timeOff.id.toString() };
}

export async function deleteEmployeeTimeOff(actor: CrmAuthenticatedUser, employeeId: bigint, timeOffId: bigint) {
  assertOwnEmployee(actor, employeeId);

  const result = await prisma.employeeTimeOff.deleteMany({
    where: {
      id: timeOffId,
      employeeId
    }
  });

  if (result.count === 0) {
    throw new HttpError(404, "Time off entry not found.");
  }
}

export async function getPortfolio(actor: CrmAuthenticatedUser) {
  const photos = await listPortfolio(employeeScope(actor));

  return photos.map((photo) => ({
    id: photo.id.toString(),
    employeeId: photo.employeeId.toString(),
    title: photo.description ?? "Work without description",
    description: photo.description,
    master: `${photo.employee.user.firstName} ${photo.employee.user.lastName}`,
    imageUrl: photo.imageUrl,
    visible: photo.isVisible
  }));
}

export async function createPortfolioPhoto(actor: CrmAuthenticatedUser, input: z.infer<typeof createPortfolioPhotoSchema>) {
  const employeeId = BigInt(input.employeeId);
  assertOwnEmployee(actor, employeeId);

  await ensureEmployeesExist(prisma, [employeeId]);

  const photo = await prisma.portfolioPhoto.create({
    data: {
      employeeId,
      imageUrl: input.imageUrl,
      description: input.description || null,
      isVisible: input.visible
    }
  });

  return { id: photo.id.toString() };
}

export async function updatePortfolioPhoto(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updatePortfolioPhotoSchema>) {
  const current = await prisma.portfolioPhoto.findUnique({
    where: { id },
    select: { id: true, employeeId: true }
  });

  if (!current) {
    throw new HttpError(404, "Portfolio photo not found.");
  }

  assertOwnEmployee(actor, current.employeeId);

  const nextEmployeeId = input.employeeId ? BigInt(input.employeeId) : undefined;

  if (nextEmployeeId !== undefined) {
    assertOwnEmployee(actor, nextEmployeeId);
    await ensureEmployeesExist(prisma, [nextEmployeeId]);
  }

  const photo = await prisma.portfolioPhoto.update({
    where: { id },
    data: {
      employeeId: nextEmployeeId,
      imageUrl: input.imageUrl,
      description: input.description === undefined ? undefined : input.description || null,
      isVisible: input.visible
    }
  });

  return { id: photo.id.toString() };
}

export async function deletePortfolioPhoto(actor: CrmAuthenticatedUser, id: bigint) {
  const current = await prisma.portfolioPhoto.findUnique({
    where: { id },
    select: { id: true, employeeId: true }
  });

  if (!current) {
    throw new HttpError(404, "Portfolio photo not found.");
  }

  assertOwnEmployee(actor, current.employeeId);
  await prisma.portfolioPhoto.delete({ where: { id } });
}

export async function uploadPortfolioImage(
  _actor: CrmAuthenticatedUser,
  input: {
    contentType: string;
    buffer: Buffer;
  }
) {
  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = portfolioUploadTypes.get(contentType);

  if (!extension) {
    throw new HttpError(400, "Only JPG, PNG, WEBP, and GIF images can be uploaded.");
  }

  if (input.buffer.length === 0) {
    throw new HttpError(400, "Upload file is empty.");
  }

  await mkdir(portfolioUploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  await writeFile(path.join(portfolioUploadDir, fileName), input.buffer, { flag: "wx" });

  return {
    imageUrl: `/uploads/portfolio/${fileName}`
  };
}

export async function uploadProductImage(
  actor: CrmAuthenticatedUser,
  input: {
    contentType: string;
    buffer: Buffer;
  }
) {
  assertAdmin(actor);

  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = portfolioUploadTypes.get(contentType);

  if (!extension) {
    throw new HttpError(400, "Only JPG, PNG, WEBP, and GIF images can be uploaded.");
  }

  if (input.buffer.length === 0) {
    throw new HttpError(400, "Upload file is empty.");
  }

  await mkdir(productUploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  await writeFile(path.join(productUploadDir, fileName), input.buffer, { flag: "wx" });

  return {
    imageUrl: `/uploads/products/${fileName}`
  };
}

export async function getProductCategories(actor: CrmAuthenticatedUser) {
  assertAdmin(actor);

  const rows = await prisma.$queryRaw<
    Array<{ id: bigint; name: string; description: string | null; imageUrl: string | null; productCount: number }>
  >`
    SELECT
      category.id,
      category.name,
      category.description,
      category.image_url AS "imageUrl",
      COUNT(product.id) FILTER (WHERE product.is_active = true)::int AS "productCount"
    FROM product_categories category
    LEFT JOIN products product ON product.category_id = category.id
    GROUP BY category.id, category.name, category.description, category.image_url
    ORDER BY category.name ASC
  `;

  return rows.map((category) => ({
    id: category.id.toString(),
    name: category.name,
    description: category.description,
    imageUrl: category.imageUrl,
    productCount: category.productCount
  }));
}

export async function createProductCategory(actor: CrmAuthenticatedUser, input: z.infer<typeof createProductCategorySchema>) {
  assertAdmin(actor);

  const [category] = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO product_categories (name, description, image_url)
    VALUES (${input.name}, ${input.description || null}, ${input.imageUrl || null})
    RETURNING id
  `;

  return { id: category.id.toString() };
}

export async function updateProductCategory(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateProductCategorySchema>) {
  assertAdmin(actor);

  const updates: Prisma.Sql[] = [];

  if (input.name !== undefined) {
    updates.push(Prisma.sql`name = ${input.name}`);
  }

  if (input.description !== undefined) {
    updates.push(Prisma.sql`description = ${input.description || null}`);
  }

  if (input.imageUrl !== undefined) {
    updates.push(Prisma.sql`image_url = ${input.imageUrl || null}`);
  }

  if (updates.length === 0) {
    return { id: id.toString() };
  }

  const [category] = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    UPDATE product_categories
    SET ${Prisma.join(updates, ", ")}
    WHERE id = ${id}
    RETURNING id
  `);

  if (!category) {
    throw new HttpError(404, "Product category not found.");
  }

  return { id: category.id.toString() };
}

export async function deleteProductCategory(actor: CrmAuthenticatedUser, id: bigint) {
  assertAdmin(actor);

  const [category] = await prisma.$queryRaw<Array<{ id: bigint; productCount: number }>>`
    SELECT
      category.id,
      COUNT(product.id) FILTER (WHERE product.is_active = true)::int AS "productCount"
    FROM product_categories category
    LEFT JOIN products product ON product.category_id = category.id
    WHERE category.id = ${id}
    GROUP BY category.id
  `;

  if (!category) {
    throw new HttpError(404, "Product category not found.");
  }

  if (category.productCount > 0) {
    throw new HttpError(409, "Product category contains products. Move or delete products first.");
  }

  await prisma.$executeRaw`
    UPDATE products
    SET category_id = NULL
    WHERE category_id = ${id}
      AND is_active = false
  `;

  await prisma.$executeRaw`
    DELETE FROM product_categories
    WHERE id = ${id}
  `;

  return { id: id.toString() };
}

export async function getProducts(actor: CrmAuthenticatedUser) {
  if (actor.role !== "ADMIN") {
    return [];
  }

  const products = await listProducts();
  const productContentRows = await prisma.$queryRaw<
    Array<{
      id: bigint;
      brandId: bigint | null;
      brandName: string | null;
      imageUrl: string | null;
      quote: string | null;
      purpose: string | null;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
      stockContentAmount: Prisma.Decimal | null;
    }>
  >`
    SELECT
      product.id,
      product.brand_id AS "brandId",
      product_brand.name AS "brandName",
      product.image_url AS "imageUrl",
      product.quote,
      product.product_purpose AS "purpose",
      product.content_amount AS "contentAmount",
      lower(product.content_unit::text) AS "contentUnit",
      product.stock_content_amount AS "stockContentAmount"
    FROM products product
    LEFT JOIN product_brands product_brand ON product_brand.id = product.brand_id
  `;
  const productContent = new Map(productContentRows.map((row) => [row.id.toString(), row]));
  const movementContentRows = await prisma.$queryRaw<
    Array<{ id: bigint; contentQuantity: Prisma.Decimal | null; contentUnit: string | null }>
  >`
    SELECT
      id,
      content_quantity AS "contentQuantity",
      lower(content_unit::text) AS "contentUnit"
    FROM stock_movements
  `;
  const movementContent = new Map(movementContentRows.map((row) => [row.id.toString(), row]));

  return products.map((product) => {
    const content = productContent.get(product.id.toString());
    const contentAmount = content?.contentAmount ? Number(content.contentAmount) : null;
    const stockContentAmount = content?.stockContentAmount ? Number(content.stockContentAmount) : null;

    return {
      id: product.id.toString(),
      categoryId: product.category?.id.toString() ?? null,
      category: product.category?.name ?? "Uncategorized",
      brandId: content?.brandId?.toString() ?? null,
      brand: content?.brandName ?? product.brand,
      sku: product.sku,
      imageUrl: content?.imageUrl ?? null,
      name: product.name,
      description: product.description,
      quote: content?.quote ?? null,
      purpose: toPublicProductPurpose(content?.purpose),
      purchase: Number(product.purchasePrice ?? 0),
      sale: Number(product.sellingPrice),
      stock: product.stockQuantity,
      min: product.minStockQuantity,
      contentAmount,
      contentUnit: content?.contentUnit ?? null,
      stockContentAmount,
      stockPackageEquivalent: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null,
      stockStatus: getProductStockStatus({
        stockQuantity: product.stockQuantity,
        minStockQuantity: product.minStockQuantity,
        contentAmount,
        stockContentAmount
      }),
      movements: product.stockMovements.map((movement) => {
        const movementContentData = movementContent.get(movement.id.toString());

        return {
          type: movement.movementType.toLowerCase(),
          quantity: movement.quantity,
          contentQuantity: movementContentData?.contentQuantity ? Number(movementContentData.contentQuantity) : null,
          contentUnit: movementContentData?.contentUnit ? toPublicMeasurementUnit(movementContentData.contentUnit) : null,
          reason: movement.reason,
          createdAt: movement.createdAt.toISOString()
        };
      })
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
    paymentId: sale.payment?.id.toString() ?? null,
    payment: sale.payment?.paymentMethod.toLowerCase() ?? "cash",
    paymentMethod: sale.payment?.paymentMethod.toLowerCase() ?? "cash",
    paymentStatus: sale.payment?.paymentStatus.toLowerCase() ?? "pending",
    total: Number(sale.totalAmount),
    netTotal: getNetPaymentAmount(sale.payment),
    saleDate: sale.saleDate.toISOString()
  }));
}

export async function getPayments(actor: CrmAuthenticatedUser) {
  const payments = await listPayments(employeeScope(actor));
  const auditLogsByPayment = await getPaymentAuditLogs(payments.map((payment) => payment.id));

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
    netAmount: getNetPaymentAmount(payment),
    paidAt: payment.paidAt?.toISOString() ?? null,
    auditLogs: auditLogsByPayment.get(payment.id.toString()) ?? []
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

  if (input.startTime || input.endTime) {
    await ensureAppointmentSlotAvailable({
      employeeId: current.employeeId,
      startTime,
      endTime,
      excludeAppointmentId: id
    });
  }

  const nextStatus = input.status ? toAppointmentStatus(input.status) : undefined;

  if (
    nextStatus === AppointmentStatus.COMPLETED &&
    current.status !== AppointmentStatus.PENDING &&
    current.status !== AppointmentStatus.COMPLETED
  ) {
    throw new HttpError(409, "Only scheduled appointments can be completed.");
  }

  const shouldCompleteAppointment = nextStatus === AppointmentStatus.COMPLETED && current.status !== AppointmentStatus.COMPLETED;
  const shouldSyncConsumables = shouldCompleteAppointment || (current.status === AppointmentStatus.COMPLETED && input.consumables !== undefined);

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

    if (shouldSyncConsumables) {
      await syncAppointmentConsumables(transaction, id, input.consumables);
    }

    if (shouldCompleteAppointment || input.paymentStatus || input.paymentAmount !== undefined || input.paymentMethod) {
      await upsertAppointmentPayment(transaction, id, {
        amount: input.paymentAmount,
        method: input.paymentMethod,
        status: input.paymentStatus ?? (shouldCompleteAppointment ? "paid" : undefined),
        actorUserId: BigInt(actor.id)
      });
    }

    const auditEvent = buildAppointmentAuditEvent({
      currentStatus: current.status,
      nextStatus,
      input,
      shouldCompleteAppointment,
      shouldSyncConsumables
    });

    if (auditEvent) {
      await recordAppointmentAuditLog(transaction, {
        appointmentId: id,
        actorUserId: BigInt(actor.id),
        ...auditEvent
      });
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
      await syncAppointmentConsumables(transaction, createdAppointment.id);
      await recordAppointmentAuditLog(transaction, {
        appointmentId: createdAppointment.id,
        actorUserId: BigInt(actor.id),
        eventType: "completed",
        summary: "Appointment was created as completed.",
        details: {
          statusTo: "completed",
          paymentStatus: "paid"
        }
      });
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

export async function getProductBrands(actor: CrmAuthenticatedUser) {
  assertAdmin(actor);

  const rows = await prisma.$queryRaw<
    Array<{ id: bigint; name: string; description: string | null; productCount: number }>
  >`
    SELECT
      brand.id,
      brand.name,
      brand.description,
      COUNT(product.id) FILTER (WHERE product.is_active = true)::int AS "productCount"
    FROM product_brands brand
    LEFT JOIN products product ON product.brand_id = brand.id
    GROUP BY brand.id, brand.name, brand.description
    ORDER BY brand.name ASC
  `;

  return rows.map((brand) => ({
    id: brand.id.toString(),
    name: brand.name,
    description: brand.description,
    productCount: brand.productCount
  }));
}

export async function createProductBrand(actor: CrmAuthenticatedUser, input: z.infer<typeof createProductBrandSchema>) {
  assertAdmin(actor);

  const [brand] = await prisma.$queryRaw<{ id: bigint }[]>`
    INSERT INTO product_brands (name, description)
    VALUES (${input.name}, ${input.description || null})
    RETURNING id
  `;

  return { id: brand.id.toString() };
}

export async function updateProductBrand(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateProductBrandSchema>) {
  assertAdmin(actor);

  const updates: Prisma.Sql[] = [];

  if (input.name !== undefined) {
    updates.push(Prisma.sql`name = ${input.name}`);
  }

  if (input.description !== undefined) {
    updates.push(Prisma.sql`description = ${input.description || null}`);
  }

  if (updates.length === 0) {
    return { id: id.toString() };
  }

  const [brand] = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    UPDATE product_brands
    SET ${Prisma.join(updates, ", ")}
    WHERE id = ${id}
    RETURNING id
  `);

  if (!brand) {
    throw new HttpError(404, "Product brand not found.");
  }

  await prisma.$executeRaw`
    UPDATE products
    SET brand = (SELECT name FROM product_brands WHERE id = ${id})
    WHERE brand_id = ${id}
  `;

  return { id: brand.id.toString() };
}

export async function deleteProductBrand(actor: CrmAuthenticatedUser, id: bigint) {
  assertAdmin(actor);

  const [brand] = await prisma.$queryRaw<Array<{ id: bigint; productCount: number }>>`
    SELECT
      brand.id,
      COUNT(product.id) FILTER (WHERE product.is_active = true)::int AS "productCount"
    FROM product_brands brand
    LEFT JOIN products product ON product.brand_id = brand.id
    WHERE brand.id = ${id}
    GROUP BY brand.id
  `;

  if (!brand) {
    throw new HttpError(404, "Product brand not found.");
  }

  if (brand.productCount > 0) {
    throw new HttpError(409, "Product brand is used by products. Move products to another brand first.");
  }

  await prisma.$executeRaw`
    UPDATE products
    SET brand_id = NULL
    WHERE brand_id = ${id}
      AND is_active = false
  `;

  await prisma.$executeRaw`
    DELETE FROM product_brands
    WHERE id = ${id}
  `;

  return { id: id.toString() };
}

async function resolveProductCategoryId(input: { categoryId?: string; category?: string }, required: boolean) {
  if (input.categoryId) {
    const [category] = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id
      FROM product_categories
      WHERE id = ${BigInt(input.categoryId)}
    `;

    if (!category) {
      throw new HttpError(400, "Product category does not exist.");
    }

    return category.id;
  }

  if (input.category?.trim()) {
    const category = await prisma.productCategory.upsert({
      where: { name: input.category },
      update: {},
      create: { name: input.category }
    });

    return category.id;
  }

  if (required) {
    throw new HttpError(400, "Product category is required.");
  }

  return undefined;
}

async function resolveProductBrand(input: { brandId?: string; brand?: string }) {
  if (input.brandId) {
    const [brand] = await prisma.$queryRaw<{ id: bigint; name: string }[]>`
      SELECT id, name
      FROM product_brands
      WHERE id = ${BigInt(input.brandId)}
    `;

    if (!brand) {
      throw new HttpError(400, "Product brand does not exist.");
    }

    return brand;
  }

  if (input.brand?.trim()) {
    const [brand] = await prisma.$queryRaw<{ id: bigint; name: string }[]>`
      INSERT INTO product_brands (name)
      VALUES (${input.brand})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `;

    return brand;
  }

  return null;
}

export async function createProduct(actor: CrmAuthenticatedUser, input: z.infer<typeof createProductSchema>) {
  assertAdmin(actor);

  const categoryId = await resolveProductCategoryId(input, true);
  const brand = await resolveProductBrand(input);

  const product = await prisma.product.create({
    data: {
      categoryId,
      name: input.name,
      description: input.description || null,
      brand: brand?.name ?? input.brand,
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

  if (input.imageUrl) {
    await prisma.$executeRaw`
      UPDATE products
      SET
        image_url = ${input.imageUrl},
        brand_id = ${brand?.id ?? null},
        quote = ${input.quote || null},
        product_purpose = ${toProductPurpose(input.purpose)}
      WHERE id = ${product.id}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE products
      SET
        brand_id = ${brand?.id ?? null},
        quote = ${input.quote || null},
        product_purpose = ${toProductPurpose(input.purpose)}
      WHERE id = ${product.id}
    `;
  }

  await insertStockMovement(prisma, {
    productId: product.id,
    movementType: StockMovementType.PURCHASE,
    quantity: input.stock,
    contentQuantity: input.contentAmount ? input.contentAmount * input.stock : null,
    contentUnit: input.contentAmount ? toConsumableUnit(input.contentUnit ?? "ml") : null,
    reason: "Initial stock"
  });

  return { id: product.id.toString() };
}

export async function updateProduct(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updateProductSchema>) {
  assertAdmin(actor);

  const categoryId = input.categoryId !== undefined || input.category !== undefined ? await resolveProductCategoryId(input, false) : undefined;
  const brand = input.brandId !== undefined || input.brand !== undefined ? await resolveProductBrand(input) : undefined;

  const product = await prisma.product.update({
    where: { id },
    data: {
      categoryId,
      name: input.name,
      description: input.description === undefined ? undefined : input.description || null,
      brand: brand === undefined ? undefined : brand?.name ?? input.brand ?? null,
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

  if (input.imageUrl !== undefined) {
    await prisma.$executeRaw`
      UPDATE products
      SET image_url = ${input.imageUrl || null}
      WHERE id = ${id}
    `;
  }

  const detailUpdates: Prisma.Sql[] = [];

  if (brand !== undefined) {
    detailUpdates.push(Prisma.sql`brand_id = ${brand?.id ?? null}`);
  }

  if (input.quote !== undefined) {
    detailUpdates.push(Prisma.sql`quote = ${input.quote || null}`);
  }

  if (input.purpose !== undefined) {
    detailUpdates.push(Prisma.sql`product_purpose = ${toProductPurpose(input.purpose)}`);
  }

  if (detailUpdates.length > 0) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE products
      SET ${Prisma.join(detailUpdates, ", ")}
      WHERE id = ${id}
    `);
  }

  return { id: product.id.toString() };
}

export async function deleteProduct(actor: CrmAuthenticatedUser, id: bigint) {
  assertAdmin(actor);

  const [product] = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id
    FROM products
    WHERE id = ${id}
      AND is_active = true
  `;

  if (!product) {
    throw new HttpError(404, "Product not found.");
  }

  const [references] = await prisma.$queryRaw<
    Array<{ saleItems: number; serviceConsumables: number; consumptionLogs: number }>
  >`
    SELECT
      (SELECT COUNT(*)::int FROM product_sale_items WHERE product_id = ${id}) AS "saleItems",
      (SELECT COUNT(*)::int FROM service_consumables WHERE product_id = ${id}) AS "serviceConsumables",
      (SELECT COUNT(*)::int FROM service_consumption_logs WHERE product_id = ${id}) AS "consumptionLogs"
  `;

  const referenceCount = (references?.saleItems ?? 0) + (references?.serviceConsumables ?? 0) + (references?.consumptionLogs ?? 0);

  if (referenceCount > 0) {
    await prisma.$executeRaw`
      UPDATE products
      SET is_active = false
      WHERE id = ${id}
    `;

    return { id: id.toString(), deleted: false };
  }

  await prisma.product.delete({ where: { id } });

  return { id: id.toString(), deleted: true };
}

export async function createStockMovement(actor: CrmAuthenticatedUser, input: z.infer<typeof createStockMovementSchema>) {
  assertAdmin(actor);

  const productId = BigInt(input.productId);

  const movement = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });

    if (!product) {
      throw new HttpError(404, "Product not found.");
    }

    const [content] = await tx.$queryRaw<
      Array<{ contentAmount: Prisma.Decimal | null; contentUnit: string | null; stockContentAmount: Prisma.Decimal | null }>
    >`
      SELECT
        content_amount AS "contentAmount",
        lower(content_unit::text) AS "contentUnit",
        stock_content_amount AS "stockContentAmount"
      FROM products
      WHERE id = ${productId}
    `;

    const contentAmount = content?.contentAmount ? toNumber(content.contentAmount) : null;
    const stockContentAmount = content?.stockContentAmount ? toNumber(content.stockContentAmount) : null;
    const currentPackageStock = product.stockQuantity;
    const signedAmount = getSignedStockMovementAmount(input.movementType, input.amount);
    const movementType = toStockMovementType(input.movementType);
    let packageDelta = 0;
    let contentDelta: number | null = null;
    let contentUnit: ConsumableUnitValue | null = null;

    if (input.amountMode === "content") {
      if (!contentAmount || !content?.contentUnit) {
        throw new HttpError(400, "This product does not have package content configured.");
      }

      const currentContentStock = stockContentAmount ?? currentPackageStock * contentAmount;
      const nextContentStock = currentContentStock + signedAmount;

      if (nextContentStock < 0) {
        throw new HttpError(400, "Stock cannot be negative.");
      }

      packageDelta = Math.floor(nextContentStock / contentAmount) - Math.floor(currentContentStock / contentAmount);
      contentDelta = signedAmount;
      contentUnit = toConsumableUnit(content.contentUnit === "gram" ? "gram" : "ml");

      await tx.$executeRaw`
        UPDATE products
        SET
          stock_content_amount = ${nextContentStock},
          stock_quantity = floor(${nextContentStock} / ${contentAmount})::int
        WHERE id = ${productId}
      `;
    } else if (contentAmount && content?.contentUnit) {
      const currentContentStock = stockContentAmount ?? currentPackageStock * contentAmount;
      const nextContentStock = currentContentStock + signedAmount * contentAmount;

      if (nextContentStock < 0) {
        throw new HttpError(400, "Stock cannot be negative.");
      }

      packageDelta = signedAmount;
      contentDelta = signedAmount * contentAmount;
      contentUnit = toConsumableUnit(content.contentUnit === "gram" ? "gram" : "ml");

      await tx.$executeRaw`
        UPDATE products
        SET
          stock_content_amount = ${nextContentStock},
          stock_quantity = floor(${nextContentStock} / ${contentAmount})::int
        WHERE id = ${productId}
      `;
    } else {
      const nextPackageStock = currentPackageStock + signedAmount;

      if (nextPackageStock < 0) {
        throw new HttpError(400, "Stock cannot be negative.");
      }

      packageDelta = signedAmount;

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: nextPackageStock }
      });
    }

    return insertStockMovement(tx, {
      productId,
      movementType,
      quantity: packageDelta,
      contentQuantity: contentDelta,
      contentUnit,
      reason: input.reason || null
    });
  });

  return { id: movement.id.toString() };
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
      Array<{ contentAmount: Prisma.Decimal | null; contentUnit: string | null; stockContentAmount: Prisma.Decimal | null }>
    >`
      SELECT
        content_amount AS "contentAmount",
        lower(content_unit::text) AS "contentUnit",
        stock_content_amount AS "stockContentAmount"
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

    await insertStockMovement(transaction, {
      productId,
      movementType: StockMovementType.SALE,
      quantity: -quantity,
      contentQuantity: contentAmount ? -quantity * contentAmount : null,
      contentUnit: contentAmount && inventory?.contentUnit ? toConsumableUnit(inventory.contentUnit === "gram" ? "gram" : "ml") : null,
      reason: `Sale #${createdSale.id.toString()}`
    });

    const payment = await transaction.payment.create({
      data: {
        productSaleId: createdSale.id,
        amount: totalAmount,
        paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date()
      }
    });

    await recordPaymentAuditLog(transaction, {
      paymentId: payment.id,
      actorUserId: BigInt(actor.id),
      eventType: "payment_created",
      summary: "Product sale payment was created as paid.",
      details: {
        source: "product_sale",
        productSaleId: createdSale.id.toString(),
        amountTo: totalAmount,
        methodTo: paymentMethod.toLowerCase(),
        statusTo: "paid"
      }
    });

    return createdSale;
  });

  return { id: sale.id.toString() };
}

export async function updatePayment(actor: CrmAuthenticatedUser, id: bigint, input: z.infer<typeof updatePaymentSchema>) {
  await assertPaymentAccess(actor, id);
  const status = toPaymentStatus(input.status);
  const reason = input.reason?.trim() || null;

  if (input.returnToStock && status !== PaymentStatus.REFUNDED) {
    throw new HttpError(400, "Stock return is available only for refunds.");
  }

  const payment = await prisma.$transaction(async (transaction) => {
    const current = await transaction.payment.findUnique({
      where: { id },
      select: {
        id: true,
        appointmentId: true,
        productSaleId: true,
        amount: true,
        paymentMethod: true,
        paymentStatus: true,
        paidAt: true
      }
    });

    if (!current) {
      throw new HttpError(404, "Payment not found.");
    }

    if (input.returnToStock && !current.productSaleId) {
      throw new HttpError(400, "Stock return is available only for product sale refunds.");
    }

    const method = input.method ? toPaymentMethod(input.method) : current.paymentMethod;
    let stockReturned = false;
    let stockItems: Array<Record<string, unknown>> = [];

    if (input.returnToStock && current.productSaleId) {
      const alreadyReturned = await hasPaymentStockReturnAudit(transaction, id);

      if (alreadyReturned) {
        throw new HttpError(409, "Stock was already returned for this refunded sale.");
      }

      stockItems = await returnProductSaleStock(transaction, current.productSaleId, reason);
      stockReturned = stockItems.length > 0;
    }

    const updatedPayment = await transaction.payment.update({
      where: { id },
      data: {
        paymentStatus: status,
        paymentMethod: method,
        paidAt: getPaymentEventDate(status, current.paymentStatus, current.paidAt)
      }
    });

    const auditDetails = buildPaymentAuditDetails({
      source: current.appointmentId ? "appointment" : "product_sale",
      appointmentId: current.appointmentId,
      productSaleId: current.productSaleId,
      current,
      next: updatedPayment,
      reason,
      returnToStock: input.returnToStock === true,
      stockReturned,
      stockItems
    });
    const changed =
      current.paymentStatus !== updatedPayment.paymentStatus ||
      current.paymentMethod !== updatedPayment.paymentMethod ||
      reason !== null ||
      input.returnToStock === true;

    if (changed) {
      const eventType = updatedPayment.paymentStatus === PaymentStatus.REFUNDED ? "payment_refunded" : "payment_updated";
      const summary = buildPaymentAuditSummary(current, updatedPayment, stockReturned);

      await recordPaymentAuditLog(transaction, {
        paymentId: updatedPayment.id,
        actorUserId: BigInt(actor.id),
        eventType,
        summary,
        details: auditDetails
      });

      if (current.appointmentId) {
        await recordAppointmentAuditLog(transaction, {
          appointmentId: current.appointmentId,
          actorUserId: BigInt(actor.id),
          eventType,
          summary,
          details: auditDetails
        });
      }
    }

    return updatedPayment;
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

function getProductStockStatus(input: {
  stockQuantity: number;
  minStockQuantity: number;
  contentAmount: number | null;
  stockContentAmount: number | null;
}) {
  if (input.contentAmount && input.stockContentAmount === null) {
    return "not_tracked";
  }

  if (input.contentAmount && input.stockContentAmount !== null) {
    return input.stockContentAmount <= input.minStockQuantity * input.contentAmount ? "low" : "ok";
  }

  return input.stockQuantity <= input.minStockQuantity ? "low" : "ok";
}

function toStockMovementType(type: "purchase" | "adjustment" | "return") {
  if (type === "adjustment") {
    return StockMovementType.ADJUSTMENT;
  }

  if (type === "return") {
    return StockMovementType.RETURN;
  }

  return StockMovementType.PURCHASE;
}

function getSignedStockMovementAmount(type: "purchase" | "adjustment" | "return", amount: number) {
  return type === "adjustment" ? amount : Math.abs(amount);
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

async function ensureServicesExist(client: Prisma.TransactionClient, serviceIds: bigint[]) {
  if (serviceIds.length === 0) {
    return;
  }

  const count = await client.service.count({ where: { id: { in: serviceIds } } });

  if (count !== serviceIds.length) {
    throw new HttpError(400, "One or more assigned services do not exist.");
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

async function insertStockMovement(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  input: {
    productId: bigint;
    movementType: StockMovementType;
    quantity: number;
    contentQuantity: number | null;
    contentUnit: ConsumableUnitValue | null;
    reason: string | null;
  }
) {
  const [movement] = await client.$queryRaw<Array<{ id: bigint }>>`
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity,
      content_quantity,
      content_unit,
      reason
    )
    VALUES (
      ${input.productId},
      ${input.movementType}::"StockMovementType",
      ${input.quantity},
      ${input.contentQuantity},
      ${input.contentUnit}::"ConsumableUnit",
      ${input.reason}
    )
    RETURNING id
  `;

  return movement;
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

async function syncEmployeeServices(client: Prisma.TransactionClient, employeeId: bigint, serviceIds: bigint[]) {
  await client.employeeService.deleteMany({ where: { employeeId } });

  if (serviceIds.length === 0) {
    return;
  }

  await client.employeeService.createMany({
    data: serviceIds.map((serviceId) => ({ employeeId, serviceId })),
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

function toProductPurpose(purpose: PublicProductPurpose | undefined): ProductPurposeValue {
  if (purpose === "sale") {
    return "SALE";
  }

  if (purpose === "procedure") {
    return "PROCEDURE";
  }

  return "BOTH";
}

function toPublicProductPurpose(purpose: string | null | undefined): PublicProductPurpose {
  if (purpose === "SALE") {
    return "sale";
  }

  if (purpose === "PROCEDURE") {
    return "procedure";
  }

  return "both";
}

function toPublicUnit(unit: ConsumableUnitValue) {
  return unit === "GRAM" ? "gram" : "ml";
}

function toPublicMeasurementUnit(unit: string) {
  return unit === "gram" ? "gram" : "ml";
}

async function hasAppointmentConsumptionLogs(client: Pick<Prisma.TransactionClient, "$queryRaw">, appointmentId: bigint) {
  const [existingLog] = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM service_consumption_logs
    WHERE appointment_id = ${appointmentId}
  `;

  return (existingLog?.count ?? 0) > 0;
}

async function getAppointmentDisplayExtras(appointmentIds: bigint[]) {
  const uniqueIds = [...new Map(appointmentIds.map((id) => [id.toString(), id])).values()];
  const extras = new Map<string, AppointmentDisplayExtras>();

  if (uniqueIds.length === 0) {
    return extras;
  }

  const serviceRows = await prisma.$queryRaw<
    Array<{
      appointmentId: bigint;
      id: bigint;
      name: string;
      duration: number;
      price: Prisma.Decimal;
      priceFrom: Prisma.Decimal | null;
      priceTo: Prisma.Decimal | null;
    }>
  >`
    SELECT
      appointment_service.appointment_id AS "appointmentId",
      service.id,
      service.name,
      service.duration_minutes AS duration,
      service.price,
      service.price_from AS "priceFrom",
      service.price_to AS "priceTo"
    FROM appointment_services appointment_service
    JOIN services service ON service.id = appointment_service.service_id
    WHERE appointment_service.appointment_id IN (${Prisma.join(uniqueIds)})
    ORDER BY appointment_service.appointment_id ASC, service.name ASC
  `;

  const servicesByAppointment = new Map<string, AppointmentServiceLine[]>();

  for (const row of serviceRows) {
    const key = row.appointmentId.toString();
    const services = servicesByAppointment.get(key) ?? [];
    services.push({
      id: row.id.toString(),
      name: row.name,
      duration: row.duration,
      price: toNumber(row.price),
      priceFrom: row.priceFrom === null ? null : toNumber(row.priceFrom),
      priceTo: row.priceTo === null ? null : toNumber(row.priceTo)
    });
    servicesByAppointment.set(key, services);
  }

  const costByAppointment = await getAppointmentConsumableCosts(uniqueIds);
  const auditLogsByAppointment = await getAppointmentAuditLogs(uniqueIds);

  for (const id of uniqueIds) {
    const key = id.toString();
    const services = servicesByAppointment.get(key) ?? [];
    const consumableCost = costByAppointment.has(key) ? (costByAppointment.get(key) ?? null) : 0;
    extras.set(key, {
      services,
      financials: createAppointmentFinancialSummary(services, consumableCost),
      auditLogs: auditLogsByAppointment.get(key) ?? []
    });
  }

  return extras;
}

async function getAppointmentConsumableCosts(appointmentIds: bigint[]) {
  const costs = new Map<string, number | null>();

  if (appointmentIds.length === 0) {
    return costs;
  }

  const actualRows = await prisma.$queryRaw<
    Array<{
      appointmentId: bigint;
      cost: Prisma.Decimal | null;
      itemCount: number;
      pricedCount: number;
    }>
  >`
    SELECT
      consumption.appointment_id AS "appointmentId",
      COALESCE(SUM(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(consumption.unit::text)
          THEN consumption.quantity * product.purchase_price / product.content_amount
          ELSE 0
        END
      ), 0) AS cost,
      COUNT(*)::int AS "itemCount",
      COUNT(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(consumption.unit::text)
          THEN 1
        END
      )::int AS "pricedCount"
    FROM service_consumption_logs consumption
    JOIN products product ON product.id = consumption.product_id
    WHERE consumption.appointment_id IN (${Prisma.join(appointmentIds)})
    GROUP BY consumption.appointment_id
  `;

  for (const row of actualRows) {
    costs.set(row.appointmentId.toString(), normalizeConsumableCost(row));
  }

  const missingIds = appointmentIds.filter((id) => !costs.has(id.toString()));

  if (missingIds.length === 0) {
    return costs;
  }

  const plannedRows = await prisma.$queryRaw<
    Array<{
      appointmentId: bigint;
      cost: Prisma.Decimal | null;
      itemCount: number;
      pricedCount: number;
    }>
  >`
    SELECT
      appointment_service.appointment_id AS "appointmentId",
      COALESCE(SUM(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(service_consumable.unit::text)
          THEN service_consumable.quantity * product.purchase_price / product.content_amount
          ELSE 0
        END
      ), 0) AS cost,
      COUNT(*)::int AS "itemCount",
      COUNT(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(service_consumable.unit::text)
          THEN 1
        END
      )::int AS "pricedCount"
    FROM appointment_services appointment_service
    JOIN service_consumables service_consumable ON service_consumable.service_id = appointment_service.service_id
    JOIN products product ON product.id = service_consumable.product_id
    WHERE appointment_service.appointment_id IN (${Prisma.join(missingIds)})
    GROUP BY appointment_service.appointment_id
  `;

  for (const row of plannedRows) {
    costs.set(row.appointmentId.toString(), normalizeConsumableCost(row));
  }

  return costs;
}

function normalizeConsumableCost(input: { cost: unknown; itemCount: number; pricedCount: number }) {
  if (input.itemCount === 0) {
    return 0;
  }

  if (input.pricedCount < input.itemCount) {
    return null;
  }

  return roundMoney(toNumber(input.cost));
}

function createAppointmentFinancialSummary(services: AppointmentServiceLine[], consumableCost: number | null): AppointmentFinancialSummary {
  const revenueFrom = roundMoney(services.reduce((sum, service) => sum + (service.priceFrom ?? service.price), 0));
  const revenueTo = roundMoney(services.reduce((sum, service) => sum + (service.priceTo ?? service.priceFrom ?? service.price), 0));

  return {
    revenueFrom,
    revenueTo,
    consumableCost,
    profitAfterConsumablesFrom: consumableCost === null ? null : roundMoney(revenueFrom - consumableCost),
    profitAfterConsumablesTo: consumableCost === null ? null : roundMoney(revenueTo - consumableCost)
  };
}

async function getAppointmentAuditLogs(appointmentIds: bigint[]) {
  const logsByAppointment = new Map<string, AppointmentAuditEntry[]>();

  if (appointmentIds.length === 0) {
    return logsByAppointment;
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: bigint;
      appointmentId: bigint;
      eventType: string;
      summary: string;
      actor: string | null;
      createdAt: Date;
    }>
  >`
    SELECT
      log.id,
      log.appointment_id AS "appointmentId",
      log.event_type AS "eventType",
      log.summary,
      trim(concat_ws(' ', actor.first_name, actor.last_name)) AS actor,
      log.created_at AS "createdAt"
    FROM appointment_audit_logs log
    LEFT JOIN users actor ON actor.id = log.actor_user_id
    WHERE log.appointment_id IN (${Prisma.join(appointmentIds)})
    ORDER BY log.created_at DESC, log.id DESC
  `;

  for (const row of rows) {
    const key = row.appointmentId.toString();
    const logs = logsByAppointment.get(key) ?? [];

    if (logs.length < 8) {
      logs.push({
        id: row.id.toString(),
        eventType: row.eventType,
        summary: row.summary,
        actor: row.actor || "System",
        createdAt: row.createdAt.toISOString()
      });
      logsByAppointment.set(key, logs);
    }
  }

  return logsByAppointment;
}

function buildAppointmentAuditEvent(input: {
  currentStatus: AppointmentStatus;
  nextStatus?: AppointmentStatus;
  input: z.infer<typeof updateAppointmentSchema>;
  shouldCompleteAppointment: boolean;
  shouldSyncConsumables: boolean;
}) {
  const paymentChanged = input.input.paymentAmount !== undefined || input.input.paymentMethod !== undefined || input.input.paymentStatus !== undefined;
  const consumablesChanged = input.input.consumables !== undefined;

  if (input.shouldCompleteAppointment) {
    return {
      eventType: "completed",
      summary: "Appointment completed: payment and consumables were confirmed.",
      details: {
        statusFrom: mapAppointmentStatus(input.currentStatus),
        statusTo: "completed",
        paymentAmount: input.input.paymentAmount ?? null,
        paymentMethod: input.input.paymentMethod ?? null,
        paymentStatus: input.input.paymentStatus ?? "paid",
        consumables: input.input.consumables ?? []
      }
    };
  }

  if (input.currentStatus === AppointmentStatus.COMPLETED && (paymentChanged || consumablesChanged)) {
    return {
      eventType: "completion_corrected",
      summary: "Completed appointment was corrected: payment or consumables changed.",
      details: {
        paymentAmount: input.input.paymentAmount ?? null,
        paymentMethod: input.input.paymentMethod ?? null,
        paymentStatus: input.input.paymentStatus ?? null,
        consumables: input.input.consumables ?? null
      }
    };
  }

  if (paymentChanged) {
    return {
      eventType: "payment_updated",
      summary: "Payment data was updated.",
      details: {
        paymentAmount: input.input.paymentAmount ?? null,
        paymentMethod: input.input.paymentMethod ?? null,
        paymentStatus: input.input.paymentStatus ?? null
      }
    };
  }

  if (input.nextStatus && input.nextStatus !== input.currentStatus) {
    return {
      eventType: "status_updated",
      summary: `Appointment status changed to ${mapAppointmentStatus(input.nextStatus)}.`,
      details: {
        statusFrom: mapAppointmentStatus(input.currentStatus),
        statusTo: mapAppointmentStatus(input.nextStatus)
      }
    };
  }

  return null;
}

async function recordAppointmentAuditLog(
  client: Prisma.TransactionClient,
  input: {
    appointmentId: bigint;
    actorUserId: bigint;
    eventType: string;
    summary: string;
    details: Record<string, unknown>;
  }
) {
  await client.$executeRaw`
    INSERT INTO appointment_audit_logs (
      appointment_id,
      actor_user_id,
      event_type,
      summary,
      details
    )
    VALUES (
      ${input.appointmentId},
      ${input.actorUserId},
      ${input.eventType},
      ${input.summary},
      ${JSON.stringify(input.details)}::jsonb
    )
  `;
}

async function getPaymentAuditLogs(paymentIds: bigint[]) {
  const logsByPayment = new Map<string, PaymentAuditEntry[]>();

  if (paymentIds.length === 0) {
    return logsByPayment;
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: bigint;
      paymentId: bigint;
      eventType: string;
      summary: string;
      details: unknown;
      actor: string | null;
      createdAt: Date;
    }>
  >`
    SELECT
      log.id,
      log.payment_id AS "paymentId",
      log.event_type AS "eventType",
      log.summary,
      log.details,
      trim(concat_ws(' ', actor.first_name, actor.last_name)) AS actor,
      log.created_at AS "createdAt"
    FROM payment_audit_logs log
    LEFT JOIN users actor ON actor.id = log.actor_user_id
    WHERE log.payment_id IN (${Prisma.join(paymentIds)})
    ORDER BY log.created_at DESC, log.id DESC
  `;

  for (const row of rows) {
    const key = row.paymentId.toString();
    const logs = logsByPayment.get(key) ?? [];

    if (logs.length < 12) {
      logs.push({
        id: row.id.toString(),
        eventType: row.eventType,
        summary: row.summary,
        actor: row.actor || "System",
        createdAt: row.createdAt.toISOString(),
        details: normalizeAuditDetails(row.details)
      });
      logsByPayment.set(key, logs);
    }
  }

  return logsByPayment;
}

async function recordPaymentAuditLog(
  client: Prisma.TransactionClient,
  input: {
    paymentId: bigint;
    actorUserId: bigint;
    eventType: string;
    summary: string;
    details: Record<string, unknown>;
  }
) {
  await client.$executeRaw`
    INSERT INTO payment_audit_logs (
      payment_id,
      actor_user_id,
      event_type,
      summary,
      details
    )
    VALUES (
      ${input.paymentId},
      ${input.actorUserId},
      ${input.eventType},
      ${input.summary},
      ${JSON.stringify(input.details)}::jsonb
    )
  `;
}

function buildPaymentAuditDetails(input: {
  source: "appointment" | "product_sale";
  appointmentId: bigint | null;
  productSaleId: bigint | null;
  current: PaymentSnapshot | null;
  next: PaymentSnapshot;
  reason: string | null;
  returnToStock: boolean;
  stockReturned: boolean;
  stockItems: Array<Record<string, unknown>>;
}) {
  return {
    source: input.source,
    appointmentId: input.appointmentId?.toString() ?? null,
    productSaleId: input.productSaleId?.toString() ?? null,
    amountFrom: input.current ? roundMoney(Number(input.current.amount)) : null,
    amountTo: roundMoney(Number(input.next.amount)),
    methodFrom: input.current ? toPublicPaymentMethod(input.current.paymentMethod) : null,
    methodTo: toPublicPaymentMethod(input.next.paymentMethod),
    statusFrom: input.current ? toPublicPaymentStatus(input.current.paymentStatus) : null,
    statusTo: toPublicPaymentStatus(input.next.paymentStatus),
    reason: input.reason,
    returnToStock: input.returnToStock,
    stockReturned: input.stockReturned,
    stockItems: input.stockItems
  };
}

function buildPaymentAuditSummary(current: PaymentSnapshot, next: PaymentSnapshot, stockReturned: boolean) {
  if (next.paymentStatus === PaymentStatus.REFUNDED && stockReturned) {
    return "Payment was refunded and product stock was returned.";
  }

  if (next.paymentStatus === PaymentStatus.REFUNDED) {
    return "Payment was refunded.";
  }

  if (current.paymentStatus !== next.paymentStatus) {
    return `Payment status changed from ${toPublicPaymentStatus(current.paymentStatus)} to ${toPublicPaymentStatus(next.paymentStatus)}.`;
  }

  if (current.paymentMethod !== next.paymentMethod) {
    return `Payment method changed from ${toPublicPaymentMethod(current.paymentMethod)} to ${toPublicPaymentMethod(next.paymentMethod)}.`;
  }

  if (roundMoney(Number(current.amount)) !== roundMoney(Number(next.amount))) {
    return "Payment amount was updated.";
  }

  return "Payment data was updated.";
}

function normalizeAuditDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  return details as Record<string, unknown>;
}

async function hasPaymentStockReturnAudit(client: Pick<Prisma.TransactionClient, "$queryRaw">, paymentId: bigint) {
  const [row] = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM payment_audit_logs
    WHERE payment_id = ${paymentId}
      AND details->>'stockReturned' = 'true'
  `;

  return (row?.count ?? 0) > 0;
}

async function returnProductSaleStock(client: Prisma.TransactionClient, saleId: bigint, reason: string | null) {
  const rows = await client.$queryRaw<
    Array<{
      productId: bigint;
      productName: string;
      quantity: number;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
      stockContentAmount: Prisma.Decimal | null;
      stockQuantity: number;
    }>
  >`
    SELECT
      item.product_id AS "productId",
      product.name AS "productName",
      item.quantity,
      product.content_amount AS "contentAmount",
      lower(product.content_unit::text) AS "contentUnit",
      product.stock_content_amount AS "stockContentAmount",
      product.stock_quantity AS "stockQuantity"
    FROM product_sale_items item
    JOIN products product ON product.id = item.product_id
    WHERE item.sale_id = ${saleId}
    ORDER BY product.name ASC
  `;
  const returnedItems: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const contentAmount = row.contentAmount === null ? null : toNumber(row.contentAmount);
    const stockContentAmount = row.stockContentAmount === null ? null : toNumber(row.stockContentAmount);
    const stockReason = `Refund sale #${saleId.toString()}${reason ? `: ${reason}` : ""}`;

    if (contentAmount !== null && contentAmount > 0 && row.contentUnit) {
      const currentContentStock = stockContentAmount ?? row.stockQuantity * contentAmount;
      const contentDelta = roundMoney(row.quantity * contentAmount);
      const nextContentStock = roundMoney(currentContentStock + contentDelta);
      const packageDelta = Math.floor(nextContentStock / contentAmount) - Math.floor(currentContentStock / contentAmount);

      await client.$executeRaw`
        UPDATE products
        SET
          stock_content_amount = ${nextContentStock},
          stock_quantity = floor(${nextContentStock} / ${contentAmount})::int
        WHERE id = ${row.productId}
      `;

      await insertStockMovement(client, {
        productId: row.productId,
        movementType: StockMovementType.RETURN,
        quantity: packageDelta,
        contentQuantity: contentDelta,
        contentUnit: toConsumableUnit(row.contentUnit === "gram" ? "gram" : "ml"),
        reason: stockReason
      });

      returnedItems.push({
        productId: row.productId.toString(),
        productName: row.productName,
        quantity: row.quantity,
        contentQuantity: contentDelta,
        contentUnit: row.contentUnit,
        stockContentBefore: currentContentStock,
        stockContentAfter: nextContentStock
      });
      continue;
    }

    const nextPackageStock = row.stockQuantity + row.quantity;

    await client.product.update({
      where: { id: row.productId },
      data: { stockQuantity: nextPackageStock }
    });

    await insertStockMovement(client, {
      productId: row.productId,
      movementType: StockMovementType.RETURN,
      quantity: row.quantity,
      contentQuantity: null,
      contentUnit: null,
      reason: stockReason
    });

    returnedItems.push({
      productId: row.productId.toString(),
      productName: row.productName,
      quantity: row.quantity,
      stockPackagesBefore: row.stockQuantity,
      stockPackagesAfter: nextPackageStock
    });
  }

  return returnedItems;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function getNetPaymentAmount(payment: { amount: Prisma.Decimal | number | null; paymentStatus: PaymentStatus } | null | undefined) {
  if (!payment) {
    return 0;
  }

  if (payment.paymentStatus === PaymentStatus.PAID) {
    return Number(payment.amount ?? 0);
  }

  if (payment.paymentStatus === PaymentStatus.REFUNDED) {
    return -Number(payment.amount ?? 0);
  }

  return 0;
}

async function getAppointmentRevenueTo(client: Pick<Prisma.TransactionClient, "$queryRaw">, appointmentId: bigint) {
  const [row] = await client.$queryRaw<Array<{ amount: Prisma.Decimal | null }>>`
    SELECT COALESCE(SUM(COALESCE(service.price_to, service.price_from, service.price)), 0) AS amount
    FROM appointment_services appointment_service
    JOIN services service ON service.id = appointment_service.service_id
    WHERE appointment_service.appointment_id = ${appointmentId}
  `;

  return roundMoney(toNumber(row?.amount ?? 0));
}

async function upsertAppointmentPayment(
  client: Prisma.TransactionClient,
  appointmentId: bigint,
  input: {
    amount?: number;
    method?: "cash" | "card" | "blik" | "transfer";
    status?: "pending" | "paid" | "refunded";
    actorUserId?: bigint;
  }
) {
  const current = await client.payment.findUnique({
    where: { appointmentId },
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      paymentStatus: true,
      paidAt: true
    }
  });
  const amount = input.amount ?? (current ? Number(current.amount) : await getAppointmentRevenueTo(client, appointmentId));
  const method = input.method ? toPaymentMethod(input.method) : current?.paymentMethod ?? PaymentMethod.CASH;
  const status = input.status ? toPaymentStatus(input.status) : current?.paymentStatus ?? PaymentStatus.PAID;
  const paidAt = getPaymentEventDate(status, current?.paymentStatus, current?.paidAt);

  const payment = await client.payment.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      amount,
      paymentMethod: method,
      paymentStatus: status,
      paidAt
    },
    update: {
      amount,
      paymentMethod: method,
      paymentStatus: status,
      paidAt
    }
  });

  if (input.actorUserId) {
    const changed =
      !current ||
      Number(current.amount) !== amount ||
      current.paymentMethod !== payment.paymentMethod ||
      current.paymentStatus !== payment.paymentStatus;

    if (changed) {
      const details = buildPaymentAuditDetails({
        source: "appointment",
        appointmentId,
        productSaleId: null,
        current,
        next: payment,
        reason: null,
        returnToStock: false,
        stockReturned: false,
        stockItems: []
      });

      await recordPaymentAuditLog(client, {
        paymentId: payment.id,
        actorUserId: input.actorUserId,
        eventType: !current ? "payment_created" : payment.paymentStatus === PaymentStatus.REFUNDED ? "payment_refunded" : "payment_updated",
        summary: !current ? "Appointment payment was created." : buildPaymentAuditSummary(current, payment, false),
        details
      });
    }
  }
}

function getPaymentEventDate(status: PaymentStatus, currentStatus?: PaymentStatus, currentPaidAt?: Date | null) {
  if (status === PaymentStatus.PENDING) {
    return null;
  }

  if (status === currentStatus && currentPaidAt) {
    return currentPaidAt;
  }

  return new Date();
}

async function buildAppointmentActualConsumablePreviewItems(client: Pick<Prisma.TransactionClient, "$queryRaw">, appointmentId: bigint) {
  const rows = await client.$queryRaw<
    Array<{
      productId: bigint;
      productName: string;
      productCategory: string | null;
      services: string;
      quantity: Prisma.Decimal;
      unit: string;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
      purchasePrice: Prisma.Decimal | null;
      currentStockContentAmount: Prisma.Decimal | null;
    }>
  >`
    SELECT
      consumption.product_id AS "productId",
      product.name AS "productName",
      product_category.name AS "productCategory",
      string_agg(DISTINCT service.name, ', ') AS services,
      SUM(consumption.quantity) AS quantity,
      lower(consumption.unit::text) AS unit,
      product.content_amount AS "contentAmount",
      lower(product.content_unit::text) AS "contentUnit",
      product.purchase_price AS "purchasePrice",
      product.stock_content_amount AS "currentStockContentAmount"
    FROM service_consumption_logs consumption
    JOIN products product ON product.id = consumption.product_id
    JOIN services service ON service.id = consumption.service_id
    LEFT JOIN product_categories product_category ON product_category.id = product.category_id
    WHERE consumption.appointment_id = ${appointmentId}
    GROUP BY consumption.product_id, product.name, product_category.name, consumption.unit, product.content_amount, product.content_unit, product.purchase_price, product.stock_content_amount
    ORDER BY product.name ASC
  `;

  return rows.map((row) => {
    const quantity = toNumber(row.quantity);
    const contentAmount = row.contentAmount ? toNumber(row.contentAmount) : null;
    const currentStockContentAmount = row.currentStockContentAmount ? toNumber(row.currentStockContentAmount) : null;
    const purchasePrice = row.purchasePrice ? toNumber(row.purchasePrice) : null;
    const unit = toPublicMeasurementUnit(row.unit);
    const unitMatches = row.contentUnit === unit;
    const unitCost = purchasePrice !== null && contentAmount && unitMatches ? purchasePrice / contentAmount : null;
    const cost = unitCost === null ? null : roundMoney(unitCost * quantity);
    const stockContentAmount = currentStockContentAmount === null ? null : currentStockContentAmount + quantity;
    const stockAfter = currentStockContentAmount;
    let issue: string | null = null;

    if (!contentAmount || !row.contentUnit || currentStockContentAmount === null) {
      issue = `Product ${row.productName} does not have package content configured.`;
    } else if (!unitMatches) {
      issue = `Consumable unit does not match product package unit for ${row.productName}.`;
    }

    return {
      productId: row.productId.toString(),
      productName: row.productName,
      productCategory: row.productCategory,
      services: row.services,
      quantity,
      unit,
      contentAmount,
      unitCost: unitCost === null ? null : roundMoney(unitCost),
      cost,
      stockContentAmount,
      stockAfter,
      packageEquivalentBefore: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null,
      packageEquivalentAfter: contentAmount && stockAfter !== null ? stockAfter / contentAmount : null,
      enough: !issue,
      issue
    };
  });
}

async function buildAppointmentConsumablePreviewItems(client: Pick<Prisma.TransactionClient, "$queryRaw">, appointmentId: bigint) {
  const rows = await client.$queryRaw<
    Array<{
      productId: bigint;
      productName: string;
      productCategory: string | null;
      services: string;
      quantity: Prisma.Decimal;
      unit: string;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
      purchasePrice: Prisma.Decimal | null;
      stockContentAmount: Prisma.Decimal | null;
    }>
  >`
    SELECT
      service_consumable.product_id AS "productId",
      product.name AS "productName",
      product_category.name AS "productCategory",
      string_agg(DISTINCT service.name, ', ') AS services,
      SUM(service_consumable.quantity) AS quantity,
      lower(service_consumable.unit::text) AS unit,
      product.content_amount AS "contentAmount",
      lower(product.content_unit::text) AS "contentUnit",
      product.purchase_price AS "purchasePrice",
      product.stock_content_amount AS "stockContentAmount"
    FROM appointment_services appointment_service
    JOIN services service ON service.id = appointment_service.service_id
    JOIN service_consumables service_consumable ON service_consumable.service_id = appointment_service.service_id
    JOIN products product ON product.id = service_consumable.product_id
    LEFT JOIN product_categories product_category ON product_category.id = product.category_id
    WHERE appointment_service.appointment_id = ${appointmentId}
    GROUP BY service_consumable.product_id, product.name, product_category.name, service_consumable.unit, product.content_amount, product.content_unit, product.purchase_price, product.stock_content_amount
    ORDER BY product.name ASC
  `;

  return rows.map((row) => {
    const quantity = toNumber(row.quantity);
    const contentAmount = row.contentAmount ? toNumber(row.contentAmount) : null;
    const stockContentAmount = row.stockContentAmount ? toNumber(row.stockContentAmount) : null;
    const purchasePrice = row.purchasePrice ? toNumber(row.purchasePrice) : null;
    const unit = toPublicMeasurementUnit(row.unit);
    const unitMatches = row.contentUnit === unit;
    const unitCost = purchasePrice !== null && contentAmount && unitMatches ? purchasePrice / contentAmount : null;
    const cost = unitCost === null ? null : roundMoney(unitCost * quantity);
    const stockAfter = stockContentAmount !== null ? Math.max(stockContentAmount - quantity, 0) : null;
    let issue: string | null = null;

    if (!contentAmount || !row.contentUnit || stockContentAmount === null) {
      issue = `Product ${row.productName} does not have package content configured.`;
    } else if (!unitMatches) {
      issue = `Consumable unit does not match product package unit for ${row.productName}.`;
    } else if (stockContentAmount < quantity) {
      issue = `Not enough consumable stock for ${row.productName}.`;
    }

    return {
      productId: row.productId.toString(),
      productName: row.productName,
      productCategory: row.productCategory,
      services: row.services,
      quantity,
      unit,
      contentAmount,
      unitCost: unitCost === null ? null : roundMoney(unitCost),
      cost,
      stockContentAmount,
      stockAfter,
      packageEquivalentBefore: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null,
      packageEquivalentAfter: contentAmount && stockAfter !== null ? stockAfter / contentAmount : null,
      enough: !issue,
      issue
    };
  });
}

async function syncAppointmentConsumables(
  client: Prisma.TransactionClient,
  appointmentId: bigint,
  inputs?: Array<{ productId: string; quantity: number; unit?: "ml" | "gram" }>
) {
  const appointmentServices = await client.appointmentService.findMany({
    where: { appointmentId },
    select: { serviceId: true },
    orderBy: { serviceId: "asc" }
  });

  if (appointmentServices.length === 0) {
    return;
  }

  const fallbackServiceId = appointmentServices[0]?.serviceId;
  const plannedRows = await client.$queryRaw<
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

  if (!fallbackServiceId) {
    return;
  }

  const oldRows = await client.$queryRaw<
    Array<{
      productId: bigint;
      quantity: Prisma.Decimal;
      unit: string;
    }>
  >`
    SELECT
      product_id AS "productId",
      SUM(quantity) AS quantity,
      lower(unit::text) AS unit
    FROM service_consumption_logs
    WHERE appointment_id = ${appointmentId}
    GROUP BY product_id, unit
  `;

  const desiredByProduct = new Map<string, { productId: bigint; quantity: number; unit?: "ml" | "gram" }>();

  if (inputs) {
    for (const input of inputs) {
      const productId = BigInt(input.productId);
      const key = productId.toString();
      const current = desiredByProduct.get(key);

      desiredByProduct.set(key, {
        productId,
        quantity: (current?.quantity ?? 0) + input.quantity,
        unit: input.unit ?? current?.unit
      });
    }
  } else {
    for (const row of plannedRows) {
      const key = row.productId.toString();
      const current = desiredByProduct.get(key);

      desiredByProduct.set(key, {
        productId: row.productId,
        quantity: (current?.quantity ?? 0) + toNumber(row.quantity),
        unit: toPublicMeasurementUnit(row.unit)
      });
    }
  }

  const oldByProduct = new Map<string, { productId: bigint; quantity: number; unit: "ml" | "gram" }>();

  for (const row of oldRows) {
    oldByProduct.set(row.productId.toString(), {
      productId: row.productId,
      quantity: toNumber(row.quantity),
      unit: toPublicMeasurementUnit(row.unit)
    });
  }

  const productIds = [...new Map([...desiredByProduct.values(), ...oldByProduct.values()].map((item) => [item.productId.toString(), item.productId])).values()];

  if (productIds.length === 0) {
    await client.$executeRaw`
      DELETE FROM service_consumption_logs
      WHERE appointment_id = ${appointmentId}
    `;
    return;
  }

  const productRows = await client.$queryRaw<
    Array<{
      id: bigint;
      name: string;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
      stockContentAmount: Prisma.Decimal | null;
      stockQuantity: number;
    }>
  >`
    SELECT
      id,
      name,
      content_amount AS "contentAmount",
      lower(content_unit::text) AS "contentUnit",
      stock_content_amount AS "stockContentAmount",
      stock_quantity AS "stockQuantity"
    FROM products
    WHERE id IN (${Prisma.join(productIds)})
  `;
  const productsById = new Map(productRows.map((product) => [product.id.toString(), product]));

  for (const desired of desiredByProduct.values()) {
    if (desired.quantity < 0) {
      throw new HttpError(400, "Consumable quantity cannot be negative.");
    }

    const product = productsById.get(desired.productId.toString());

    if (!product) {
      throw new HttpError(404, "Consumable product not found.");
    }

    desired.unit = desired.unit ?? toPublicMeasurementUnit(product.contentUnit ?? "");
  }

  const desiredRows = buildDesiredConsumptionRows({
    desiredByProduct,
    fallbackServiceId,
    plannedRows
  });

  for (const productId of productIds) {
    const key = productId.toString();
    const product = productsById.get(key);

    if (!product) {
      throw new HttpError(404, "Consumable product not found.");
    }

    const contentAmount = product.contentAmount ? toNumber(product.contentAmount) : null;
    const contentUnit = product.contentUnit ? toPublicMeasurementUnit(product.contentUnit) : null;
    const stockContentAmount = product.stockContentAmount ? toNumber(product.stockContentAmount) : null;
    const oldQuantity = oldByProduct.get(key)?.quantity ?? 0;
    const desired = desiredByProduct.get(key);
    const desiredQuantity = desired?.quantity ?? 0;
    const desiredUnit = desired?.unit ?? oldByProduct.get(key)?.unit ?? contentUnit;

    if (!contentAmount || !contentUnit || stockContentAmount === null) {
      throw new HttpError(400, `Product ${product.name} does not have package content configured.`);
    }

    if (!desiredUnit || desiredUnit !== contentUnit) {
      throw new HttpError(400, `Consumable unit does not match product package unit for ${product.name}.`);
    }

    const diff = roundMoney(desiredQuantity - oldQuantity);
    const nextStockContentAmount = roundMoney(stockContentAmount - diff);

    if (nextStockContentAmount < 0) {
      throw new HttpError(400, `Not enough consumable stock for ${product.name}.`);
    }

    await client.$executeRaw`
      UPDATE products
      SET
        stock_content_amount = ${nextStockContentAmount},
        stock_quantity = floor(${nextStockContentAmount} / ${contentAmount})::int
      WHERE id = ${productId}
    `;

    if (diff !== 0) {
      await insertStockMovement(client, {
        productId,
        movementType: diff > 0 ? StockMovementType.SALE : StockMovementType.RETURN,
        quantity: Math.floor(nextStockContentAmount / contentAmount) - Math.floor(stockContentAmount / contentAmount),
        contentQuantity: -diff,
        contentUnit: toConsumableUnit(contentUnit),
        reason: `Appointment #${appointmentId.toString()} completion`
      });
    }
  }

  await client.$executeRaw`
    DELETE FROM service_consumption_logs
    WHERE appointment_id = ${appointmentId}
  `;

  const stockAfterByProduct = new Map<string, number>();

  for (const productId of productIds) {
    const product = productsById.get(productId.toString());

    if (!product?.contentAmount || product.stockContentAmount === null) {
      continue;
    }

    const key = productId.toString();
    const currentStockContentAmount = toNumber(product.stockContentAmount);
    const oldQuantity = oldByProduct.get(key)?.quantity ?? 0;
    const desiredQuantity = desiredByProduct.get(key)?.quantity ?? 0;
    const finalStock = roundMoney(currentStockContentAmount - (desiredQuantity - oldQuantity));
    stockAfterByProduct.set(key, finalStock);
  }

  for (const row of desiredRows) {
    if (row.quantity <= 0) {
      continue;
    }

    const product = productsById.get(row.productId.toString());
    const contentAmount = product?.contentAmount ? toNumber(product.contentAmount) : null;
    const productKey = row.productId.toString();
    const runningAfter = stockAfterByProduct.get(productKey) ?? 0;
    const stockBeforeAppointment = runningAfter + row.totalProductQuantity;
    const ratio = row.totalProductQuantity > 0 ? row.quantity / row.totalProductQuantity : 0;
    const stockContentBefore = roundMoney(stockBeforeAppointment - row.totalProductQuantity * row.insertedBeforeRatio);
    const stockContentAfter = roundMoney(stockBeforeAppointment - row.totalProductQuantity * (row.insertedBeforeRatio + ratio));

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
        ${row.serviceId},
        ${row.productId},
        ${row.quantity},
        ${toConsumableUnit(row.unit)}::"ConsumableUnit",
        ${contentAmount ? stockContentBefore : null},
        ${contentAmount ? stockContentAfter : null}
      )
    `;
  }
}

function buildDesiredConsumptionRows(input: {
  desiredByProduct: Map<string, { productId: bigint; quantity: number; unit?: "ml" | "gram" }>;
  fallbackServiceId: bigint;
  plannedRows: Array<{
    serviceId: bigint;
    productId: bigint;
    quantity: Prisma.Decimal;
    unit: string;
  }>;
}) {
  const plannedByProduct = new Map<string, typeof input.plannedRows>();

  for (const row of input.plannedRows) {
    const key = row.productId.toString();
    const rows = plannedByProduct.get(key) ?? [];
    rows.push(row);
    plannedByProduct.set(key, rows);
  }

  const desiredRows: Array<{
    serviceId: bigint;
    productId: bigint;
    quantity: number;
    totalProductQuantity: number;
    insertedBeforeRatio: number;
    unit: "ml" | "gram";
  }> = [];

  for (const desired of input.desiredByProduct.values()) {
    if (desired.quantity <= 0) {
      continue;
    }

    const key = desired.productId.toString();
    const rows = plannedByProduct.get(key) ?? [];
    const unit = desired.unit ?? "ml";

    if (rows.length === 0) {
      desiredRows.push({
        serviceId: input.fallbackServiceId,
        productId: desired.productId,
        quantity: roundMoney(desired.quantity),
        totalProductQuantity: roundMoney(desired.quantity),
        insertedBeforeRatio: 0,
        unit
      });
      continue;
    }

    const plannedTotal = rows.reduce((sum, row) => sum + toNumber(row.quantity), 0);
    let consumedRatio = 0;
    let remainingQuantity = roundMoney(desired.quantity);

    rows.forEach((row, index) => {
      const rowQuantity =
        index === rows.length - 1
          ? remainingQuantity
          : roundMoney(plannedTotal > 0 ? (desired.quantity * toNumber(row.quantity)) / plannedTotal : desired.quantity / rows.length);

      remainingQuantity = roundMoney(remainingQuantity - rowQuantity);
      desiredRows.push({
        serviceId: row.serviceId,
        productId: row.productId,
        quantity: rowQuantity,
        totalProductQuantity: roundMoney(desired.quantity),
        insertedBeforeRatio: consumedRatio,
        unit
      });
      consumedRatio += desired.quantity > 0 ? rowQuantity / desired.quantity : 0;
    });
  }

  return desiredRows;
}

function mapAppointment(appointment: Awaited<ReturnType<typeof listAppointments>>[number], extras?: AppointmentDisplayExtras) {
  const durationMinutes = Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60_000);
  const fallbackServices = appointment.services.map(({ service }) => ({
    id: service.id.toString(),
    name: service.name,
    duration: service.durationMinutes,
    price: Number(service.price),
    priceFrom: null,
    priceTo: null
  }));
  const services = extras?.services.length ? extras.services : fallbackServices;
  const financials = extras?.financials ?? createAppointmentFinancialSummary(services, 0);

  return {
    id: appointment.id.toString(),
    time: appointment.startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: appointment.startTime.toISOString(),
    endDate: appointment.endTime.toISOString(),
    employeeId: appointment.employeeId.toString(),
    serviceIds: appointment.services.map(({ service }) => service.id.toString()),
    services,
    durationMinutes,
    clientId: appointment.clientId.toString(),
    client: `${appointment.client.firstName} ${appointment.client.lastName}`,
    clientPhone: appointment.client.phone,
    clientEmail: appointment.client.email,
    service: appointment.services.map(({ service }) => service.name).join(", "),
    master: `${appointment.employee.user.firstName} ${appointment.employee.user.lastName}`,
    status: mapAppointmentStatus(appointment.status),
    clientComment: appointment.clientComment ?? "",
    employeeComment: appointment.employeeComment ?? "",
    comment: appointment.clientComment ?? appointment.employeeComment ?? "",
    amount: Number(appointment.payment?.amount ?? 0),
    paymentStatus: appointment.payment?.paymentStatus.toLowerCase() ?? "pending",
    paymentMethod: appointment.payment?.paymentMethod.toLowerCase() ?? "cash",
    rating: appointment.review?.rating ?? null,
    revenueFrom: financials.revenueFrom,
    revenueTo: financials.revenueTo,
    consumableCost: financials.consumableCost,
    profitAfterConsumablesFrom: financials.profitAfterConsumablesFrom,
    profitAfterConsumablesTo: financials.profitAfterConsumablesTo,
    auditLogs: extras?.auditLogs ?? []
  };
}

async function ensureAppointmentSlotAvailable(input: {
  employeeId: bigint;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: bigint;
}) {
  await ensureSlotWithinEmployeeSchedule(input.employeeId, input.startTime, input.endTime);

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

async function ensureSlotWithinEmployeeSchedule(employeeId: bigint, startTime: Date, endTime: Date) {
  if (!isSameLocalDay(startTime, endTime)) {
    throw new HttpError(409, "Appointments must fit within one working day.");
  }

  const workingHour = await prisma.workingHour.findUnique({
    where: {
      employeeId_dayOfWeek: {
        employeeId,
        dayOfWeek: startTime.getDay()
      }
    }
  });

  if (!workingHour) {
    throw new HttpError(409, "The selected employee is not working at this time.");
  }

  const startClock = toClockTime(startTime);
  const endClock = toClockTime(endTime);

  if (startClock < workingHour.startTime || endClock > workingHour.endTime) {
    throw new HttpError(409, "The selected time is outside the employee working hours.");
  }

  const timeOff = await prisma.employeeTimeOff.findFirst({
    where: {
      employeeId,
      startTime: { lt: endTime },
      endTime: { gt: startTime }
    },
    select: { id: true }
  });

  if (timeOff) {
    throw new HttpError(409, "The selected employee has time off during this period.");
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

function toPublicPaymentMethod(method: PaymentMethod) {
  return method.toLowerCase();
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

function toPublicPaymentStatus(status: PaymentStatus) {
  return status.toLowerCase();
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

const shortWeekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWorkingHours(hours: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
  if (hours.length === 0) {
    return "-";
  }

  return hours.map((hour) => `${shortWeekdayLabels[hour.dayOfWeek]} ${hour.startTime}-${hour.endTime}`).join(", ");
}

function formatTimeOffSummary(timeOff: Array<{ startTime: Date; endTime: Date }>) {
  if (timeOff.length === 0) {
    return "-";
  }

  if (timeOff.length === 1) {
    return `${formatDate(timeOff[0].startTime)} - ${formatDate(timeOff[0].endTime)}`;
  }

  return `${timeOff.length} blocked periods`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function toClockTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}
