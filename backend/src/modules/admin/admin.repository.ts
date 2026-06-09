import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export function countTodayAppointments(dayStart: Date, dayEnd: Date) {
  return prisma.appointment.count({
    where: {
      startTime: {
        gte: dayStart,
        lt: dayEnd
      }
    }
  });
}

export function sumTodayPaidRevenue(dayStart: Date, dayEnd: Date) {
  return prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      paymentStatus: PaymentStatus.PAID,
      paidAt: {
        gte: dayStart,
        lt: dayEnd
      }
    }
  });
}

export function findNextAppointment(now: Date) {
  return prisma.appointment.findFirst({
    where: {
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

export function listAppointments() {
  return prisma.appointment.findMany({
    include: appointmentInclude,
    orderBy: { startTime: "asc" }
  });
}

export function listClients(search?: string) {
  return prisma.user.findMany({
    where: {
      role: "CLIENT",
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
      sc.is_active AS "categoryActive"
    FROM services s
    LEFT JOIN service_categories sc ON sc.id = s.category_id
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

export function listEmployees() {
  return prisma.employee.findMany({
    include: {
      user: true,
      workingHours: { orderBy: { dayOfWeek: "asc" } },
      timeOff: { orderBy: { startTime: "asc" } }
    },
    orderBy: { user: { firstName: "asc" } }
  });
}

export function listPortfolio() {
  return prisma.portfolioPhoto.findMany({
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

export function listProductSales() {
  return prisma.productSale.findMany({
    include: {
      client: true,
      employee: { include: { user: true } },
      items: { include: { product: true } },
      payment: true
    },
    orderBy: { saleDate: "desc" }
  });
}

export function listPayments() {
  return prisma.payment.findMany({
    include: {
      appointment: { include: appointmentInclude },
      productSale: { include: { client: true } }
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }]
  });
}

export function listReviews() {
  return prisma.review.findMany({
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
};

export type ServiceCategoryRow = {
  id: bigint;
  name: string;
  description: string | null;
  isActive: boolean;
};
