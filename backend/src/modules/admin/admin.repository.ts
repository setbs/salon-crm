import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export function countTodayAppointments(dayStart: Date, dayEnd: Date, employeeId?: bigint) {
  return prisma.appointment.count({
    where: {
      employeeId,
      startTime: {
        gte: dayStart,
        lt: dayEnd
      }
    }
  });
}

export function sumTodayPaidRevenue(dayStart: Date, dayEnd: Date, employeeId?: bigint) {
  return prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      paymentStatus: PaymentStatus.PAID,
      paidAt: {
        gte: dayStart,
        lt: dayEnd
      },
      ...(employeeId
        ? {
            OR: [{ appointment: { employeeId } }, { productSale: { employeeId } }]
          }
        : {})
    }
  });
}

export function findNextAppointment(now: Date, employeeId?: bigint) {
  return prisma.appointment.findFirst({
    where: {
      employeeId,
      startTime: { gte: now },
      status: { not: AppointmentStatus.CANCELLED }
    },
    include: appointmentInclude,
    orderBy: { startTime: "asc" }
  });
}

export function countLowStockProducts() {
  return prisma.product.count({
    where: {
      isActive: true,
      stockQuantity: { lte: prisma.product.fields.minStockQuantity }
    }
  });
}

export function listAppointments(employeeId?: bigint) {
  return prisma.appointment.findMany({
    where: { employeeId },
    include: appointmentInclude,
    orderBy: { startTime: "asc" }
  });
}

export function listClients(search?: string, employeeId?: bigint) {
  return prisma.user.findMany({
    where: {
      role: "CLIENT",
      ...(employeeId ? { clientAppointments: { some: { employeeId } } } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      clientAppointments: { include: { payment: true } },
      productSales: true
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });
}

export function listServices() {
  return prisma.$queryRaw<ServiceWithCategoryRow[]>`
    SELECT
      s.id,
      s.category_id AS "categoryId",
      s.name,
      s.description,
      s.duration_minutes AS "durationMinutes",
      s.price,
      s.price_from AS "priceFrom",
      s.price_to AS "priceTo",
      s.is_active AS "isActive",
      sc.name AS "categoryName",
      sc.description AS "categoryDescription",
      sc.is_active AS "categoryActive",
      COALESCE(service_usage."appointmentCount", 0) AS "appointmentCount",
      COALESCE(service_employees.employees, '[]'::json) AS employees,
      COALESCE(service_consumables.consumables, '[]'::json) AS consumables
    FROM services s
    LEFT JOIN service_categories sc ON sc.id = s.category_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS "appointmentCount"
      FROM appointment_services appointment_service
      WHERE appointment_service.service_id = s.id
    ) service_usage ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', e.id::text,
          'name', trim(concat_ws(' ', u.first_name, u.last_name)),
          'specialization', e.specialization
        )
        ORDER BY u.first_name ASC, u.last_name ASC
      ) AS employees
      FROM employee_services es
      JOIN employees e ON e.id = es.employee_id
      JOIN users u ON u.id = e.user_id
      WHERE es.service_id = s.id
    ) service_employees ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'productId', p.id::text,
          'productName', p.name,
          'productCategory', pc.name,
          'quantity', service_consumable.quantity,
          'unit', lower(service_consumable.unit::text),
          'productContentAmount', p.content_amount,
          'productContentUnit', lower(p.content_unit::text)
        )
        ORDER BY p.name ASC
      ) AS consumables
      FROM service_consumables service_consumable
      JOIN products p ON p.id = service_consumable.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE service_consumable.service_id = s.id
    ) service_consumables ON TRUE
    ORDER BY sc.name ASC NULLS LAST, s.name ASC
  `;
}

export function listServiceCategories() {
  return prisma.$queryRaw<ServiceCategoryRow[]>`
    SELECT
      id,
      name,
      description,
      is_active AS "isActive"
    FROM service_categories
    ORDER BY name ASC
  `;
}

export function listEmployees(employeeId?: bigint) {
  return prisma.employee.findMany({
    where: { id: employeeId },
    include: {
      user: true,
      workingHours: { orderBy: { dayOfWeek: "asc" } },
      timeOff: { orderBy: { startTime: "asc" } }
    },
    orderBy: { user: { firstName: "asc" } }
  });
}

export function listPortfolio(employeeId?: bigint) {
  return prisma.portfolioPhoto.findMany({
    where: { employeeId },
    include: { employee: { include: { user: true } } },
    orderBy: { createdAt: "desc" }
  });
}

export function listProducts() {
  return prisma.product.findMany({
    include: {
      category: true,
      stockMovements: { orderBy: { createdAt: "desc" }, take: 12 }
    },
    orderBy: { name: "asc" }
  });
}

export function listProductSales(employeeId?: bigint) {
  return prisma.productSale.findMany({
    where: { employeeId },
    include: {
      client: true,
      employee: { include: { user: true } },
      items: { include: { product: true } },
      payment: true
    },
    orderBy: { saleDate: "desc" }
  });
}

export function listPayments(employeeId?: bigint) {
  return prisma.payment.findMany({
    where: employeeId ? { OR: [{ appointment: { employeeId } }, { productSale: { employeeId } }] } : undefined,
    include: {
      appointment: { include: appointmentInclude },
      productSale: { include: { client: true } }
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }]
  });
}

export function listReviews(employeeId?: bigint) {
  return prisma.review.findMany({
    where: employeeId ? { appointment: { employeeId } } : undefined,
    include: {
      appointment: {
        include: {
          client: true,
          employee: { include: { user: true } },
          services: { include: { service: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export function getSalonSettings() {
  return prisma.salonSetting.findFirst({
    orderBy: { id: "asc" }
  });
}

const appointmentInclude = {
  client: true,
  employee: { include: { user: true } },
  services: { include: { service: true } },
  payment: true,
  review: true
} satisfies Prisma.AppointmentInclude;

export type ServiceWithCategoryRow = {
  id: bigint;
  categoryId: bigint | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: Prisma.Decimal;
  priceFrom: Prisma.Decimal | null;
  priceTo: Prisma.Decimal | null;
  isActive: boolean;
  categoryName: string | null;
  categoryDescription: string | null;
  categoryActive: boolean | null;
  appointmentCount: number;
  employees: Prisma.JsonValue;
  consumables: Prisma.JsonValue;
};

export type ServiceCategoryRow = {
  id: bigint;
  name: string;
  description: string | null;
  isActive: boolean;
};
