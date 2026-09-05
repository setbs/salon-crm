import { prisma } from "../../config/prisma.js";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

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
      p.product_purpose AS "purpose",
      p.selling_price AS price,
      p.content_amount AS "contentAmount",
      lower(p.content_unit::text) AS "contentUnit",
      p.stock_quantity AS "stockQuantity",
      p.stock_content_amount AS "stockContentAmount",
      p.popularity_boost AS "popularityBoost",
      p.created_at AS "createdAt",
      NULL::numeric AS "soldLast30Days",
      NULL::numeric AS "soldLast90Days",
      NULL::numeric AS "popularityScore"
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN product_brands pb ON pb.id = p.brand_id
    WHERE p.is_active = true
      AND p.product_purpose IN ('SALE', 'BOTH')
    ORDER BY pc.name ASC NULLS LAST, p.name ASC
  `;
}

export function listPopularPublicProducts(limit = 30) {
  return prisma.$queryRaw<PublicProductRow[]>`
    WITH sales AS (
      SELECT
        sold.product_id,
        SUM(CASE WHEN sold.sold_at >= NOW() - INTERVAL '30 days' THEN sold.quantity ELSE 0 END) AS sold_last_30_days,
        SUM(CASE WHEN sold.sold_at >= NOW() - INTERVAL '90 days' THEN sold.quantity ELSE 0 END) AS sold_last_90_days
      FROM (
        SELECT
          item.product_id,
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity
            ELSE 0
          END AS quantity,
          COALESCE(payment.paid_at, sale.sale_date, sale.created_at) AS sold_at
        FROM product_sale_items item
        JOIN product_sales sale ON sale.id = item.sale_id
        JOIN payments payment ON payment.product_sale_id = sale.id
        WHERE payment.payment_status IN ('PAID'::"PaymentStatus", 'REFUNDED'::"PaymentStatus")

        UNION ALL

        SELECT
          item.product_id,
          item.quantity,
          store_order.created_at AS sold_at
        FROM store_order_items item
        JOIN store_orders store_order ON store_order.id = item.order_id
        WHERE store_order.payment_status = 'PAID'::"StorePaymentStatus"
          AND store_order.status <> 'CANCELLED'::"StoreOrderStatus"
      ) sold
      GROUP BY sold.product_id
    )
    SELECT
      p.id, p.category_id AS "categoryId", pc.name AS "categoryName",
      pc.description AS "categoryDescription", pc.image_url AS "categoryImageUrl",
      p.brand_id AS "brandId", pb.name AS "brandName", p.name, p.brand,
      p.description, p.quote, p.image_url AS "imageUrl", p.product_purpose AS "purpose",
      p.selling_price AS price, p.content_amount AS "contentAmount",
      lower(p.content_unit::text) AS "contentUnit", p.stock_quantity AS "stockQuantity",
      p.stock_content_amount AS "stockContentAmount",
      p.popularity_boost AS "popularityBoost",
      p.created_at AS "createdAt",
      COALESCE(sales.sold_last_30_days, 0) AS "soldLast30Days",
      COALESCE(sales.sold_last_90_days, 0) AS "soldLast90Days",
      (
        GREATEST(COALESCE(sales.sold_last_30_days, 0), 0) * 10
        + GREATEST(COALESCE(sales.sold_last_90_days, 0), 0) * 3
        + CASE WHEN p.created_at >= NOW() - INTERVAL '14 days' THEN 20 ELSE 0 END
        + p.popularity_boost
      ) AS "popularityScore"
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN product_brands pb ON pb.id = p.brand_id
    LEFT JOIN sales ON sales.product_id = p.id
    WHERE p.is_active = true AND p.product_purpose IN ('SALE', 'BOTH') AND p.stock_quantity > 0
    ORDER BY "popularityScore" DESC, COALESCE(sales.sold_last_30_days, 0) DESC, p.created_at DESC, p.name ASC
    LIMIT ${limit}
  `;
}

export async function listPublicProductComponents(productIds: bigint[]) {
  if (productIds.length === 0) {
    return [];
  }

  return prisma.$queryRaw<PublicProductComponentRow[]>(PrismaRuntime.sql`
    SELECT
      item.product_id AS "productId",
      component.id AS "componentId",
      component.name AS "componentName",
      component.description AS "componentDescription"
    FROM product_component_items item
    JOIN product_components component ON component.id = item.component_id
    WHERE item.product_id IN (${PrismaRuntime.join(productIds)})
    ORDER BY item.product_id ASC, item.sort_order ASC, component.name ASC
  `);
}

export function listPublishedStoreReviews() {
  return prisma.storeReview.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 12
  });
}

export function insertStoreReview(input: { authorName: string; rating: number; comment: string }) {
  return prisma.storeReview.create({ data: input });
}

export async function insertStoreOrder(input: StoreOrderInput, accessTokenHash: string) {
  return prisma.$transaction(async (transaction) => {
    const productIds = input.items.map((item) => BigInt(item.productId));
    const products = await transaction.product.findMany({
      where: { id: { in: productIds }, isActive: true, productPurpose: { in: ["SALE", "BOTH"] } },
      select: { id: true, name: true, sellingPrice: true, stockQuantity: true }
    });

    if (products.length !== productIds.length) throw new StoreOrderIssue("PRODUCT_UNAVAILABLE");
    const productMap = new Map(products.map((product) => [product.id.toString(), product]));
    const items = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      if (product.stockQuantity < item.quantity) throw new StoreOrderIssue("INSUFFICIENT_STOCK", product.name);
      return { productId: product.id, productName: product.name, unitPrice: product.sellingPrice, quantity: item.quantity };
    });
    const totalAmount = items.reduce((total, item) => total.plus(item.unitPrice.mul(item.quantity)), new PrismaRuntime.Decimal(0));

    return transaction.storeOrder.create({
      data: {
        accessTokenHash,
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: input.customer.phone,
        email: input.customer.email || null,
        deliveryMethod: input.deliveryMethod === "pickup" ? "PICKUP" : "DELIVERY",
        deliveryAddress: input.deliveryMethod === "delivery" ? input.deliveryAddress : null,
        comment: input.comment || null,
        totalAmount,
        items: { create: items }
      },
      include: { items: true }
    });
  });
}

export class StoreOrderIssue extends Error {
  constructor(public readonly code: "PRODUCT_UNAVAILABLE" | "INSUFFICIENT_STOCK", public readonly productName?: string) { super(code); }
}

export type StoreOrderInput = {
  customer: { firstName: string; lastName: string; phone: string; email?: string };
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress?: string;
  comment?: string;
  items: Array<{ productId: string; quantity: number }>;
};

export async function findPublicProductById(id: bigint) {
  const products = await prisma.$queryRaw<PublicProductRow[]>`
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
      p.product_purpose AS "purpose",
      p.selling_price AS price,
      p.content_amount AS "contentAmount",
      lower(p.content_unit::text) AS "contentUnit",
      p.stock_quantity AS "stockQuantity",
      p.stock_content_amount AS "stockContentAmount",
      p.popularity_boost AS "popularityBoost",
      p.created_at AS "createdAt",
      NULL::numeric AS "soldLast30Days",
      NULL::numeric AS "soldLast90Days",
      NULL::numeric AS "popularityScore"
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN product_brands pb ON pb.id = p.brand_id
    WHERE p.id = ${id}
      AND p.is_active = true
      AND p.product_purpose IN ('SALE', 'BOTH')
    LIMIT 1
  `;

  return products[0] ?? null;
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
  purpose: string;
  price: Prisma.Decimal;
  contentAmount: Prisma.Decimal | null;
  contentUnit: string | null;
  stockQuantity: number;
  stockContentAmount: Prisma.Decimal | null;
  popularityBoost: number;
  createdAt: Date;
  soldLast30Days: Prisma.Decimal | null;
  soldLast90Days: Prisma.Decimal | null;
  popularityScore: Prisma.Decimal | null;
};

export type PublicProductComponentRow = {
  productId: bigint;
  componentId: bigint;
  componentName: string;
  componentDescription: string | null;
};
