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

export function listVisiblePortfolio() {
  return prisma.portfolioPhoto.findMany({
    where: {
      isVisible: true
    },
    include: {
      employee: { include: { user: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 12
  });
}

export function listPublicProducts() {
  return prisma.$queryRaw<PublicProductRow[]>`
    SELECT
      p.id,
      p.category_id AS "categoryId",
      pc.name AS "categoryName",
      pc.description AS "categoryDescription",
      pc.image_url AS "categoryImageUrl",
      p.brand_id AS "brandId",
      pb.name AS "brandName",
      p.name,
      p.brand,
      p.description,
      p.quote,
      p.image_url AS "imageUrl",
      p.selling_price AS price,
      p.content_amount AS "contentAmount",
      lower(p.content_unit::text) AS "contentUnit",
      p.stock_quantity AS "stockQuantity",
      p.stock_content_amount AS "stockContentAmount"
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN product_brands pb ON pb.id = p.brand_id
    WHERE p.is_active = true
    ORDER BY pc.name ASC NULLS LAST, p.name ASC
  `;
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

export type PublicProductRow = {
  id: bigint;
  categoryId: bigint | null;
  categoryName: string | null;
  categoryDescription: string | null;
  categoryImageUrl: string | null;
  brandId: bigint | null;
  brandName: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  quote: string | null;
  imageUrl: string | null;
  price: Prisma.Decimal;
  contentAmount: Prisma.Decimal | null;
  contentUnit: string | null;
  stockQuantity: number;
  stockContentAmount: Prisma.Decimal | null;
};
