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
      s.is_active AS "isActive",
      sc.name AS "categoryName",
      sc.description AS "categoryDescription",
      sc.is_active AS "categoryActive",
      COALESCE(
        json_agg(
          json_build_object(
            'id', e.id::text,
            'name', trim(concat_ws(' ', u.first_name, u.last_name)),
            'specialization', e.specialization
          )
          ORDER BY u.first_name ASC, u.last_name ASC
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'::json
      ) AS employees
    FROM services s
    LEFT JOIN service_categories sc ON sc.id = s.category_id
    LEFT JOIN employee_services es ON es.service_id = s.id
    LEFT JOIN employees e ON e.id = es.employee_id
    LEFT JOIN users u ON u.id = e.user_id
    GROUP BY s.id, sc.id
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
  isActive: boolean;
  categoryName: string | null;
  categoryDescription: string | null;
  categoryActive: boolean | null;
  employees: Prisma.JsonValue;
};

export type ServiceCategoryRow = {
  id: bigint;
  name: string;
  description: string | null;
  isActive: boolean;
};
