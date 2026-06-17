import { prisma } from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";

export function listActiveServices() {
  return prisma.$queryRaw<ActiveServiceRow[]>`
    SELECT
      s.id,
      s.category_id AS "categoryId",
      s.name,
      s.description,
      s.duration_minutes AS "durationMinutes",
      s.price,
      s.price_from AS "priceFrom",
      s.price_to AS "priceTo",
      sc.name AS "categoryName",
      sc.description AS "categoryDescription"
    FROM services s
    LEFT JOIN service_categories sc ON sc.id = s.category_id
    WHERE s.is_active = true
      AND (s.category_id IS NULL OR sc.is_active = true)
    ORDER BY sc.name ASC NULLS LAST, s.name ASC
  `;
}

export function listActiveEmployees(serviceIds: bigint[]) {
  return prisma.employee.findMany({
    where: {
      isActive: true,
      ...(serviceIds.length > 0
        ? {
            AND: serviceIds.map((serviceId) => ({
              services: { some: { serviceId } }
            }))
          }
        : {})
    },
    include: {
      user: true,
      services: { include: { service: true } }
    },
    orderBy: { user: { firstName: "asc" } }
  });
}

export type ActiveServiceRow = {
  id: bigint;
  categoryId: bigint | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: Prisma.Decimal;
  priceFrom: Prisma.Decimal | null;
  priceTo: Prisma.Decimal | null;
  categoryName: string | null;
  categoryDescription: string | null;
};
