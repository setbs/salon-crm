import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import type { CrmAuthenticatedUser } from "../auth/auth.crypto.js";

type BusinessAnalyticsPeriod = "week" | "month" | "custom";
type BusinessAnalyticsPeriodInput = {
  period?: string;
  from?: string;
  to?: string;
};

export async function getConsumableAnalytics(actor: CrmAuthenticatedUser) {
  const scopedEmployeeId = employeeScope(actor);
  const employeeFilter = scopedEmployeeId ? Prisma.sql`AND appointment.employee_id = ${scopedEmployeeId}` : Prisma.empty;

  const [summary] = await prisma.$queryRaw<
    Array<{ logsCount: number; totalMl: Prisma.Decimal | null; totalGram: Prisma.Decimal | null }>
  >(Prisma.sql`
    SELECT
      COUNT(*)::int AS "logsCount",
      COALESCE(SUM(consumption.quantity) FILTER (WHERE consumption.unit = 'ML'::"ConsumableUnit"), 0) AS "totalMl",
      COALESCE(SUM(consumption.quantity) FILTER (WHERE consumption.unit = 'GRAM'::"ConsumableUnit"), 0) AS "totalGram"
    FROM service_consumption_logs consumption
    JOIN appointments appointment ON appointment.id = consumption.appointment_id
    WHERE consumption.created_at >= now() - interval '30 days'
    ${employeeFilter}
  `);

  const productRows = await prisma.$queryRaw<
    Array<{
      productId: bigint;
      productName: string;
      productCategory: string | null;
      unit: string;
      usedQuantity: Prisma.Decimal;
      appointmentCount: number;
      serviceCount: number;
      stockContentAmount: Prisma.Decimal | null;
      contentAmount: Prisma.Decimal | null;
    }>
  >(Prisma.sql`
    SELECT
      product.id AS "productId",
      product.name AS "productName",
      product_category.name AS "productCategory",
      lower(consumption.unit::text) AS unit,
      SUM(consumption.quantity) AS "usedQuantity",
      COUNT(DISTINCT consumption.appointment_id)::int AS "appointmentCount",
      COUNT(DISTINCT consumption.service_id)::int AS "serviceCount",
      product.stock_content_amount AS "stockContentAmount",
      product.content_amount AS "contentAmount"
    FROM service_consumption_logs consumption
    JOIN appointments appointment ON appointment.id = consumption.appointment_id
    JOIN products product ON product.id = consumption.product_id
    LEFT JOIN product_categories product_category ON product_category.id = product.category_id
    WHERE consumption.created_at >= now() - interval '30 days'
    ${employeeFilter}
    GROUP BY product.id, product_category.name, consumption.unit
    ORDER BY SUM(consumption.quantity) DESC, product.name ASC
    LIMIT 8
  `);

  const recentRows = await prisma.$queryRaw<
    Array<{
      id: bigint;
      createdAt: Date;
      productName: string;
      serviceName: string;
      clientName: string;
      quantity: Prisma.Decimal;
      unit: string;
    }>
  >(Prisma.sql`
    SELECT
      consumption.id,
      consumption.created_at AS "createdAt",
      product.name AS "productName",
      service.name AS "serviceName",
      trim(concat_ws(' ', client.first_name, client.last_name)) AS "clientName",
      consumption.quantity,
      lower(consumption.unit::text) AS unit
    FROM service_consumption_logs consumption
    JOIN appointments appointment ON appointment.id = consumption.appointment_id
    JOIN users client ON client.id = appointment.client_id
    JOIN services service ON service.id = consumption.service_id
    JOIN products product ON product.id = consumption.product_id
    WHERE consumption.created_at >= now() - interval '30 days'
    ${employeeFilter}
    ORDER BY consumption.created_at DESC
    LIMIT 8
  `);

  const [lowStock] = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM products
    WHERE is_active = true
      AND content_amount IS NOT NULL
      AND stock_content_amount IS NOT NULL
      AND stock_content_amount <= min_stock_quantity * content_amount
  `;

  return {
    periodLabel: "Last 30 days",
    logsCount: summary?.logsCount ?? 0,
    totalMl: summary?.totalMl ? toNumber(summary.totalMl) : 0,
    totalGram: summary?.totalGram ? toNumber(summary.totalGram) : 0,
    lowConsumableProducts: actor.role === "ADMIN" ? (lowStock?.count ?? 0) : 0,
    products: productRows.map((row) => {
      const stockContentAmount = row.stockContentAmount ? toNumber(row.stockContentAmount) : null;
      const contentAmount = row.contentAmount ? toNumber(row.contentAmount) : null;

      return {
        productId: row.productId.toString(),
        productName: row.productName,
        productCategory: row.productCategory,
        usedQuantity: toNumber(row.usedQuantity),
        unit: toPublicMeasurementUnit(row.unit),
        appointmentCount: row.appointmentCount,
        serviceCount: row.serviceCount,
        stockContentAmount,
        stockPackageEquivalent: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null
      };
    }),
    recentLogs: recentRows.map((row) => ({
      id: row.id.toString(),
      createdAt: row.createdAt.toISOString(),
      productName: row.productName,
      serviceName: row.serviceName,
      clientName: row.clientName,
      quantity: toNumber(row.quantity),
      unit: toPublicMeasurementUnit(row.unit)
    }))
  };
}

export async function getBusinessAnalytics(actor: CrmAuthenticatedUser, input: BusinessAnalyticsPeriodInput = {}) {
  const period = resolveBusinessAnalyticsPeriod(input);
  const previousPeriod = resolvePreviousBusinessAnalyticsPeriod(period);
  const scopedEmployeeId = employeeScope(actor);
  const appointmentEmployeeFilter = scopedEmployeeId ? Prisma.sql`AND appointment.employee_id = ${scopedEmployeeId}` : Prisma.empty;
  const saleEmployeeFilter = scopedEmployeeId ? Prisma.sql`AND sale.employee_id = ${scopedEmployeeId}` : Prisma.empty;
  const appointmentPeriodFilter = Prisma.sql`AND appointment.start_time >= ${period.from} AND appointment.start_time <= ${period.to}`;
  const salePeriodFilter = Prisma.sql`AND sale.sale_date >= ${period.from} AND sale.sale_date <= ${period.to}`;
  const previousAppointmentPeriodFilter = Prisma.sql`AND appointment.start_time >= ${previousPeriod.from} AND appointment.start_time <= ${previousPeriod.to}`;
  const previousSalePeriodFilter = Prisma.sql`AND sale.sale_date >= ${previousPeriod.from} AND sale.sale_date <= ${previousPeriod.to}`;
  const periodFromDate = formatSqlDate(period.from);
  const periodToDate = formatSqlDate(period.to);

  const serviceRows = await prisma.$queryRaw<
    Array<{
      serviceId: bigint;
      serviceName: string;
      appointmentCount: number;
      revenueFrom: Prisma.Decimal | null;
      revenueTo: Prisma.Decimal | null;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number | null;
      pricedConsumableCount: number | null;
    }>
  >(Prisma.sql`
    WITH service_lines AS (
      SELECT
        appointment.id AS "appointmentId",
        service.id AS "serviceId",
        service.name AS "serviceName",
        COALESCE(service.price_to, service.price_from, service.price) AS "lineBase",
        SUM(COALESCE(service.price_to, service.price_from, service.price)) OVER (PARTITION BY appointment.id) AS "appointmentBase",
        COALESCE(payment.amount, 0) AS "paymentAmount",
        CASE
          WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN 1
          WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -1
          ELSE 0
        END AS "paymentSign"
      FROM appointment_services appointment_service
      JOIN appointments appointment ON appointment.id = appointment_service.appointment_id
      JOIN services service ON service.id = appointment_service.service_id
      LEFT JOIN payments payment ON payment.appointment_id = appointment.id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
    ),
    service_visits AS (
      SELECT
        "serviceId",
        "serviceName",
        COUNT(*)::int AS "appointmentCount",
        COALESCE(SUM(
          CASE
            WHEN "appointmentBase" > 0 THEN "paymentSign" * "paymentAmount" * "lineBase" / "appointmentBase"
            ELSE 0
          END
        ), 0) AS "revenueFrom",
        COALESCE(SUM(
          CASE
            WHEN "appointmentBase" > 0 THEN "paymentSign" * "paymentAmount" * "lineBase" / "appointmentBase"
            ELSE 0
          END
        ), 0) AS "revenueTo"
      FROM service_lines
      GROUP BY "serviceId", "serviceName"
    ),
    service_costs AS (
      SELECT
        consumption.service_id AS "serviceId",
        COALESCE(SUM(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN consumption.quantity * product.purchase_price / product.content_amount
            ELSE 0
          END
        ), 0) AS "consumableCost",
        COUNT(*)::int AS "consumableItemCount",
        COUNT(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN 1
          END
        )::int AS "pricedConsumableCount"
      FROM service_consumption_logs consumption
      JOIN appointments appointment ON appointment.id = consumption.appointment_id
      JOIN products product ON product.id = consumption.product_id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
      GROUP BY consumption.service_id
    )
    SELECT
      visit."serviceId",
      visit."serviceName",
      visit."appointmentCount",
      visit."revenueFrom",
      visit."revenueTo",
      COALESCE(cost."consumableCost", 0) AS "consumableCost",
      COALESCE(cost."consumableItemCount", 0)::int AS "consumableItemCount",
      COALESCE(cost."pricedConsumableCount", 0)::int AS "pricedConsumableCount"
    FROM service_visits visit
    LEFT JOIN service_costs cost ON cost."serviceId" = visit."serviceId"
    ORDER BY visit."revenueTo" DESC, visit."appointmentCount" DESC, visit."serviceName" ASC
    LIMIT 8
  `);

  const productBrandRows = await prisma.$queryRaw<
    Array<{
      brandName: string;
      quantity: number;
      revenue: Prisma.Decimal | null;
      profit: Prisma.Decimal | null;
      itemCount: number;
      pricedCount: number;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(product_brand.name, NULLIF(product.brand, ''), 'No brand') AS "brandName",
      COALESCE(SUM(
        CASE
          WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity
          WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity
          ELSE 0
        END
      ), 0)::int AS quantity,
      COALESCE(SUM(
        CASE
          WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity * item.unit_price
          WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity * item.unit_price
          ELSE 0
        END
      ), 0) AS revenue,
      COALESCE(SUM(
        CASE
          WHEN product.purchase_price IS NOT NULL AND payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity * (item.unit_price - product.purchase_price)
          WHEN product.purchase_price IS NOT NULL AND payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity * (item.unit_price - product.purchase_price)
          ELSE 0
        END
      ), 0) AS profit,
      COUNT(*)::int AS "itemCount",
      COUNT(product.purchase_price)::int AS "pricedCount"
    FROM product_sale_items item
    JOIN product_sales sale ON sale.id = item.sale_id
    JOIN products product ON product.id = item.product_id
    JOIN payments payment ON payment.product_sale_id = sale.id
    LEFT JOIN product_brands product_brand ON product_brand.id = product.brand_id
    WHERE 1 = 1
      AND payment.payment_status IN ('PAID'::"PaymentStatus", 'REFUNDED'::"PaymentStatus")
      ${salePeriodFilter}
      ${saleEmployeeFilter}
    GROUP BY COALESCE(product_brand.name, NULLIF(product.brand, ''), 'No brand')
    ORDER BY revenue DESC, quantity DESC, "brandName" ASC
    LIMIT 8
  `);

  const productCategoryRows = await prisma.$queryRaw<
    Array<{
      categoryName: string;
      quantity: number;
      revenue: Prisma.Decimal | null;
      profit: Prisma.Decimal | null;
      itemCount: number;
      pricedCount: number;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(product_category.name, 'Uncategorized') AS "categoryName",
      COALESCE(SUM(
        CASE
          WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity
          WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity
          ELSE 0
        END
      ), 0)::int AS quantity,
      COALESCE(SUM(
        CASE
          WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity * item.unit_price
          WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity * item.unit_price
          ELSE 0
        END
      ), 0) AS revenue,
      COALESCE(SUM(
        CASE
          WHEN product.purchase_price IS NOT NULL AND payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity * (item.unit_price - product.purchase_price)
          WHEN product.purchase_price IS NOT NULL AND payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity * (item.unit_price - product.purchase_price)
          ELSE 0
        END
      ), 0) AS profit,
      COUNT(*)::int AS "itemCount",
      COUNT(product.purchase_price)::int AS "pricedCount"
    FROM product_sale_items item
    JOIN product_sales sale ON sale.id = item.sale_id
    JOIN products product ON product.id = item.product_id
    JOIN payments payment ON payment.product_sale_id = sale.id
    LEFT JOIN product_categories product_category ON product_category.id = product.category_id
    WHERE 1 = 1
      AND payment.payment_status IN ('PAID'::"PaymentStatus", 'REFUNDED'::"PaymentStatus")
      ${salePeriodFilter}
      ${saleEmployeeFilter}
    GROUP BY COALESCE(product_category.name, 'Uncategorized')
    ORDER BY revenue DESC, quantity DESC, "categoryName" ASC
    LIMIT 8
  `);

  const restockRows =
    actor.role === "ADMIN"
      ? await prisma.$queryRaw<
          Array<{
            productId: bigint;
            productName: string;
            categoryName: string | null;
            brandName: string | null;
            stockQuantity: number;
            minStockQuantity: number;
            contentAmount: Prisma.Decimal | null;
            contentUnit: string | null;
            stockContentAmount: Prisma.Decimal | null;
          }>
        >(Prisma.sql`
          SELECT
            product.id AS "productId",
            product.name AS "productName",
            product_category.name AS "categoryName",
            COALESCE(product_brand.name, NULLIF(product.brand, '')) AS "brandName",
            product.stock_quantity AS "stockQuantity",
            product.min_stock_quantity AS "minStockQuantity",
            product.content_amount AS "contentAmount",
            lower(product.content_unit::text) AS "contentUnit",
            product.stock_content_amount AS "stockContentAmount"
          FROM products product
          LEFT JOIN product_categories product_category ON product_category.id = product.category_id
          LEFT JOIN product_brands product_brand ON product_brand.id = product.brand_id
          WHERE product.is_active = true
            AND (
              product.stock_quantity <= product.min_stock_quantity
              OR (
                product.content_amount IS NOT NULL
                AND product.stock_content_amount IS NOT NULL
                AND product.stock_content_amount <= product.min_stock_quantity * product.content_amount
              )
            )
          ORDER BY
            CASE
              WHEN product.content_amount IS NOT NULL AND product.stock_content_amount IS NOT NULL
              THEN product.stock_content_amount / product.content_amount
              ELSE product.stock_quantity
            END ASC,
            product.name ASC
          LIMIT 10
        `)
      : [];
  const materialServiceRows = await prisma.$queryRaw<
    Array<{
      serviceId: bigint;
      serviceName: string;
      appointmentCount: number;
      usedMl: Prisma.Decimal | null;
      usedGram: Prisma.Decimal | null;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number;
      pricedConsumableCount: number;
      revenueFrom: Prisma.Decimal | null;
      revenueTo: Prisma.Decimal | null;
    }>
  >(Prisma.sql`
    WITH service_lines AS (
      SELECT
        appointment.id AS "appointmentId",
        service.id AS "serviceId",
        service.name AS "serviceName",
        COALESCE(service.price_to, service.price_from, service.price) AS "lineBase",
        SUM(COALESCE(service.price_to, service.price_from, service.price)) OVER (PARTITION BY appointment.id) AS "appointmentBase",
        COALESCE(payment.amount, 0) AS "paymentAmount",
        CASE
          WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN 1
          WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -1
          ELSE 0
        END AS "paymentSign"
      FROM appointment_services appointment_service
      JOIN appointments appointment ON appointment.id = appointment_service.appointment_id
      JOIN services service ON service.id = appointment_service.service_id
      LEFT JOIN payments payment ON payment.appointment_id = appointment.id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
    ),
    service_revenue AS (
      SELECT
        "serviceId",
        "serviceName",
        COALESCE(SUM(
          CASE
            WHEN "appointmentBase" > 0 THEN "paymentSign" * "paymentAmount" * "lineBase" / "appointmentBase"
            ELSE 0
          END
        ), 0) AS "revenueFrom",
        COALESCE(SUM(
          CASE
            WHEN "appointmentBase" > 0 THEN "paymentSign" * "paymentAmount" * "lineBase" / "appointmentBase"
            ELSE 0
          END
        ), 0) AS "revenueTo"
      FROM service_lines
      GROUP BY "serviceId", "serviceName"
    ),
    service_costs AS (
    SELECT
      service.id AS "serviceId",
      COUNT(DISTINCT consumption.appointment_id)::int AS "appointmentCount",
      COALESCE(SUM(consumption.quantity) FILTER (WHERE consumption.unit = 'ML'::"ConsumableUnit"), 0) AS "usedMl",
      COALESCE(SUM(consumption.quantity) FILTER (WHERE consumption.unit = 'GRAM'::"ConsumableUnit"), 0) AS "usedGram",
      COALESCE(SUM(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(consumption.unit::text)
          THEN consumption.quantity * product.purchase_price / product.content_amount
          ELSE 0
        END
      ), 0) AS "consumableCost",
      COUNT(*)::int AS "consumableItemCount",
      COUNT(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(consumption.unit::text)
          THEN 1
        END
      )::int AS "pricedConsumableCount",
      service.name AS "serviceName"
    FROM service_consumption_logs consumption
    JOIN appointments appointment ON appointment.id = consumption.appointment_id
    JOIN services service ON service.id = consumption.service_id
    JOIN products product ON product.id = consumption.product_id
    WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
      ${appointmentPeriodFilter}
      ${appointmentEmployeeFilter}
    GROUP BY service.id, service.name
    )
    SELECT
      service_costs."serviceId",
      service_costs."serviceName",
      service_costs."appointmentCount",
      service_costs."usedMl",
      service_costs."usedGram",
      service_costs."consumableCost",
      service_costs."consumableItemCount",
      service_costs."pricedConsumableCount",
      COALESCE(service_revenue."revenueFrom", 0) AS "revenueFrom",
      COALESCE(service_revenue."revenueTo", 0) AS "revenueTo"
    FROM service_costs
    LEFT JOIN service_revenue ON service_revenue."serviceId" = service_costs."serviceId"
    ORDER BY service_costs."consumableCost" DESC, service_costs."usedMl" DESC, service_costs."usedGram" DESC, service_costs."serviceName" ASC
    LIMIT 8
  `);
  const procedureProductRows = await prisma.$queryRaw<
    Array<{
      productId: bigint;
      productName: string;
      categoryName: string | null;
      brandName: string | null;
      unit: string;
      usedQuantity: Prisma.Decimal;
      appointmentCount: number;
      serviceCount: number;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number;
      pricedConsumableCount: number;
      stockContentAmount: Prisma.Decimal | null;
      contentAmount: Prisma.Decimal | null;
      contentUnit: string | null;
    }>
  >(Prisma.sql`
    SELECT
      product.id AS "productId",
      product.name AS "productName",
      product_category.name AS "categoryName",
      COALESCE(product_brand.name, NULLIF(product.brand, '')) AS "brandName",
      lower(consumption.unit::text) AS unit,
      SUM(consumption.quantity) AS "usedQuantity",
      COUNT(DISTINCT consumption.appointment_id)::int AS "appointmentCount",
      COUNT(DISTINCT consumption.service_id)::int AS "serviceCount",
      COALESCE(SUM(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(consumption.unit::text)
          THEN consumption.quantity * product.purchase_price / product.content_amount
          ELSE 0
        END
      ), 0) AS "consumableCost",
      COUNT(*)::int AS "consumableItemCount",
      COUNT(
        CASE
          WHEN product.purchase_price IS NOT NULL
            AND product.content_amount IS NOT NULL
            AND product.content_amount > 0
            AND lower(product.content_unit::text) = lower(consumption.unit::text)
          THEN 1
        END
      )::int AS "pricedConsumableCount",
      product.stock_content_amount AS "stockContentAmount",
      product.content_amount AS "contentAmount",
      lower(product.content_unit::text) AS "contentUnit"
    FROM service_consumption_logs consumption
    JOIN appointments appointment ON appointment.id = consumption.appointment_id
    JOIN products product ON product.id = consumption.product_id
    LEFT JOIN product_categories product_category ON product_category.id = product.category_id
    LEFT JOIN product_brands product_brand ON product_brand.id = product.brand_id
    WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
      ${appointmentPeriodFilter}
      ${appointmentEmployeeFilter}
    GROUP BY product.id, product_category.name, product_brand.name, consumption.unit
    ORDER BY "consumableCost" DESC, SUM(consumption.quantity) DESC, product.name ASC
    LIMIT 10
  `);
  const dailyTrendRows = await prisma.$queryRaw<
    Array<{
      day: string;
      revenueFrom: Prisma.Decimal | null;
      revenueTo: Prisma.Decimal | null;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number | null;
      pricedConsumableCount: number | null;
    }>
  >(Prisma.sql`
    WITH days AS (
      SELECT generate_series(${periodFromDate}::date, ${periodToDate}::date, interval '1 day')::date AS day
    ),
    service_revenue AS (
      SELECT
        appointment.start_time::date AS day,
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN payment.amount
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -payment.amount
            ELSE 0
          END
        ), 0) AS "revenueFrom",
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN payment.amount
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -payment.amount
            ELSE 0
          END
        ), 0) AS "revenueTo"
      FROM appointments appointment
      LEFT JOIN payments payment ON payment.appointment_id = appointment.id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
      GROUP BY appointment.start_time::date
    ),
    consumable_costs AS (
      SELECT
        appointment.start_time::date AS day,
        COALESCE(SUM(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN consumption.quantity * product.purchase_price / product.content_amount
            ELSE 0
          END
        ), 0) AS "consumableCost",
        COUNT(*)::int AS "consumableItemCount",
        COUNT(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN 1
          END
        )::int AS "pricedConsumableCount"
      FROM service_consumption_logs consumption
      JOIN appointments appointment ON appointment.id = consumption.appointment_id
      JOIN products product ON product.id = consumption.product_id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
      GROUP BY appointment.start_time::date
    )
    SELECT
      to_char(days.day, 'YYYY-MM-DD') AS day,
      COALESCE(service_revenue."revenueFrom", 0) AS "revenueFrom",
      COALESCE(service_revenue."revenueTo", 0) AS "revenueTo",
      COALESCE(consumable_costs."consumableCost", 0) AS "consumableCost",
      COALESCE(consumable_costs."consumableItemCount", 0)::int AS "consumableItemCount",
      COALESCE(consumable_costs."pricedConsumableCount", 0)::int AS "pricedConsumableCount"
    FROM days
    LEFT JOIN service_revenue ON service_revenue.day = days.day
    LEFT JOIN consumable_costs ON consumable_costs.day = days.day
    ORDER BY days.day ASC
  `);
  const [currentComparison] = await prisma.$queryRaw<
    Array<{
      completedVisits: number;
      serviceRevenueFrom: Prisma.Decimal | null;
      serviceRevenueTo: Prisma.Decimal | null;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number;
      pricedConsumableCount: number;
      productRevenue: Prisma.Decimal | null;
      productProfit: Prisma.Decimal | null;
      productItemCount: number;
      pricedProductCount: number;
    }>
  >(buildComparisonQuery(appointmentPeriodFilter, salePeriodFilter, appointmentEmployeeFilter, saleEmployeeFilter));
  const [previousComparison] = await prisma.$queryRaw<
    Array<{
      completedVisits: number;
      serviceRevenueFrom: Prisma.Decimal | null;
      serviceRevenueTo: Prisma.Decimal | null;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number;
      pricedConsumableCount: number;
      productRevenue: Prisma.Decimal | null;
      productProfit: Prisma.Decimal | null;
      productItemCount: number;
      pricedProductCount: number;
    }>
  >(buildComparisonQuery(previousAppointmentPeriodFilter, previousSalePeriodFilter, appointmentEmployeeFilter, saleEmployeeFilter));
  const usedNotSoldRows = await prisma.$queryRaw<
    Array<{ productId: bigint; productName: string; usedQuantity: Prisma.Decimal; unit: string; saleQuantity: number }>
  >(Prisma.sql`
    WITH used_products AS (
      SELECT
        consumption.product_id AS "productId",
        SUM(consumption.quantity) AS "usedQuantity",
        lower(consumption.unit::text) AS unit
      FROM service_consumption_logs consumption
      JOIN appointments appointment ON appointment.id = consumption.appointment_id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
      GROUP BY consumption.product_id, consumption.unit
    ),
    sold_products AS (
      SELECT
        item.product_id AS "productId",
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity
            ELSE 0
          END
        ), 0)::int AS "saleQuantity"
      FROM product_sale_items item
      JOIN product_sales sale ON sale.id = item.sale_id
      JOIN payments payment ON payment.product_sale_id = sale.id
      WHERE 1 = 1
        AND payment.payment_status IN ('PAID'::"PaymentStatus", 'REFUNDED'::"PaymentStatus")
        ${salePeriodFilter}
        ${saleEmployeeFilter}
      GROUP BY item.product_id
    )
    SELECT
      product.id AS "productId",
      product.name AS "productName",
      used_products."usedQuantity",
      used_products.unit,
      COALESCE(sold_products."saleQuantity", 0)::int AS "saleQuantity"
    FROM used_products
    JOIN products product ON product.id = used_products."productId"
    LEFT JOIN sold_products ON sold_products."productId" = used_products."productId"
    WHERE COALESCE(sold_products."saleQuantity", 0) = 0
    ORDER BY used_products."usedQuantity" DESC, product.name ASC
    LIMIT 3
  `);
  const employeeRows = await prisma.$queryRaw<
    Array<{
      employeeId: bigint;
      employeeName: string;
      completedVisits: number;
      revenueFrom: Prisma.Decimal | null;
      revenueTo: Prisma.Decimal | null;
      consumableCost: Prisma.Decimal | null;
      consumableItemCount: number;
      pricedConsumableCount: number;
      usedMl: Prisma.Decimal | null;
      usedGram: Prisma.Decimal | null;
    }>
  >(Prisma.sql`
    WITH service_revenue AS (
      SELECT
        employee.id AS "employeeId",
        trim(concat_ws(' ', employee_user.first_name, employee_user.last_name)) AS "employeeName",
        COUNT(DISTINCT appointment.id)::int AS "completedVisits",
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN payment.amount
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -payment.amount
            ELSE 0
          END
        ), 0) AS "revenueFrom",
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN payment.amount
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -payment.amount
            ELSE 0
          END
        ), 0) AS "revenueTo"
      FROM appointments appointment
      JOIN employees employee ON employee.id = appointment.employee_id
      JOIN users employee_user ON employee_user.id = employee.user_id
      LEFT JOIN payments payment ON payment.appointment_id = appointment.id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
      GROUP BY employee.id, employee_user.first_name, employee_user.last_name
    ),
    employee_costs AS (
      SELECT
        appointment.employee_id AS "employeeId",
        COALESCE(SUM(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN consumption.quantity * product.purchase_price / product.content_amount
            ELSE 0
          END
        ), 0) AS "consumableCost",
        COUNT(*)::int AS "consumableItemCount",
        COUNT(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN 1
          END
        )::int AS "pricedConsumableCount",
        COALESCE(SUM(consumption.quantity) FILTER (WHERE consumption.unit = 'ML'::"ConsumableUnit"), 0) AS "usedMl",
        COALESCE(SUM(consumption.quantity) FILTER (WHERE consumption.unit = 'GRAM'::"ConsumableUnit"), 0) AS "usedGram"
      FROM service_consumption_logs consumption
      JOIN appointments appointment ON appointment.id = consumption.appointment_id
      JOIN products product ON product.id = consumption.product_id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
      GROUP BY appointment.employee_id
    )
    SELECT
      service_revenue."employeeId",
      service_revenue."employeeName",
      service_revenue."completedVisits",
      service_revenue."revenueFrom",
      service_revenue."revenueTo",
      COALESCE(employee_costs."consumableCost", 0) AS "consumableCost",
      COALESCE(employee_costs."consumableItemCount", 0)::int AS "consumableItemCount",
      COALESCE(employee_costs."pricedConsumableCount", 0)::int AS "pricedConsumableCount",
      COALESCE(employee_costs."usedMl", 0) AS "usedMl",
      COALESCE(employee_costs."usedGram", 0) AS "usedGram"
    FROM service_revenue
    LEFT JOIN employee_costs ON employee_costs."employeeId" = service_revenue."employeeId"
    ORDER BY service_revenue."revenueTo" DESC, service_revenue."completedVisits" DESC, service_revenue."employeeName" ASC
    LIMIT 10
  `);

  const comparison = buildComparison(currentComparison, previousComparison);
  const attentionItems = [
    ...restockRows.slice(0, 3).map((row) => ({
      severity: "warning",
      title: `${row.productName} needs restocking`,
      detail: `Current stock is ${formatBackendStock(row)}; minimum is ${row.minStockQuantity} packs.`
    })),
    ...materialServiceRows
      .map((row) => {
        const revenueTo = toNumber(row.revenueTo);
        const consumableCost = toNumber(row.consumableCost);
        const marginRatio = revenueTo > 0 ? (revenueTo - consumableCost) / revenueTo : consumableCost > 0 ? -1 : 1;

        return { row, marginRatio };
      })
      .filter((item) => item.marginRatio < 0.45)
      .slice(0, 3)
      .map((item) => ({
        severity: "risk",
        title: `${item.row.serviceName} has low material margin`,
        detail: `Consumables take ${Math.round((1 - item.marginRatio) * 100)}% of service revenue in this period.`
      })),
    ...usedNotSoldRows.map((row) => ({
      severity: "info",
      title: `${row.productName} is used in procedures but not sold`,
      detail: `${formatBackendQuantity(toNumber(row.usedQuantity), row.unit)} used with no retail sales in this period.`
    }))
  ].slice(0, 7);

  return {
    periodLabel: period.label,
    services: serviceRows.map((row) => {
      const revenueFrom = roundMoney(toNumber(row.revenueFrom));
      const revenueTo = roundMoney(toNumber(row.revenueTo));
      const consumableCost =
        (row.consumableItemCount ?? 0) > 0 && (row.pricedConsumableCount ?? 0) < (row.consumableItemCount ?? 0)
          ? null
          : roundMoney(toNumber(row.consumableCost));

      return {
        serviceId: row.serviceId.toString(),
        serviceName: row.serviceName,
        appointmentCount: row.appointmentCount,
        revenueFrom,
        revenueTo,
        consumableCost,
        profitFrom: consumableCost === null ? null : roundMoney(revenueFrom - consumableCost),
        profitTo: consumableCost === null ? null : roundMoney(revenueTo - consumableCost)
      };
    }),
    productSalesByBrand: productBrandRows.map((row) => ({
      name: row.brandName,
      quantity: row.quantity,
      revenue: roundMoney(toNumber(row.revenue)),
      profit: row.pricedCount < row.itemCount ? null : roundMoney(toNumber(row.profit))
    })),
    productSalesByCategory: productCategoryRows.map((row) => ({
      name: row.categoryName,
      quantity: row.quantity,
      revenue: roundMoney(toNumber(row.revenue)),
      profit: row.pricedCount < row.itemCount ? null : roundMoney(toNumber(row.profit))
    })),
    restock: restockRows.map((row) => {
      const contentAmount = row.contentAmount ? toNumber(row.contentAmount) : null;
      const stockContentAmount = row.stockContentAmount ? toNumber(row.stockContentAmount) : null;
      const currentPackages = contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : row.stockQuantity;
      const packagesToBuy = Math.max(0, Math.ceil(row.minStockQuantity - currentPackages));

      return {
        productId: row.productId.toString(),
        productName: row.productName,
        categoryName: row.categoryName,
        brandName: row.brandName,
        stockQuantity: row.stockQuantity,
        minStockQuantity: row.minStockQuantity,
        contentAmount,
        contentUnit: row.contentUnit ? toPublicMeasurementUnit(row.contentUnit) : null,
        stockContentAmount,
        stockPackageEquivalent: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null,
        packagesToBuy
      };
    }),
    materialUsageByService: materialServiceRows.map((row) => {
      const revenueFrom = roundMoney(toNumber(row.revenueFrom));
      const revenueTo = roundMoney(toNumber(row.revenueTo));
      const consumableCost =
        row.consumableItemCount > 0 && row.pricedConsumableCount < row.consumableItemCount ? null : roundMoney(toNumber(row.consumableCost));

      return {
        serviceId: row.serviceId.toString(),
        serviceName: row.serviceName,
        appointmentCount: row.appointmentCount,
        usedMl: toNumber(row.usedMl),
        usedGram: toNumber(row.usedGram),
        consumableCost,
        revenueFrom,
        revenueTo,
        profitFrom: consumableCost === null ? null : roundMoney(revenueFrom - consumableCost),
        profitTo: consumableCost === null ? null : roundMoney(revenueTo - consumableCost)
      };
    }),
    procedureProductUsage: procedureProductRows.map((row) => {
      const usedQuantity = toNumber(row.usedQuantity);
      const stockContentAmount = row.stockContentAmount ? toNumber(row.stockContentAmount) : null;
      const contentAmount = row.contentAmount ? toNumber(row.contentAmount) : null;
      const unit = toPublicMeasurementUnit(row.unit);
      const contentUnit = row.contentUnit ? toPublicMeasurementUnit(row.contentUnit) : null;
      const averagePerAppointment = row.appointmentCount > 0 ? usedQuantity / row.appointmentCount : null;
      const estimatedProceduresLeft =
        averagePerAppointment && stockContentAmount !== null && contentUnit === unit ? Math.floor(stockContentAmount / averagePerAppointment) : null;
      const consumableCost =
        row.consumableItemCount > 0 && row.pricedConsumableCount < row.consumableItemCount ? null : roundMoney(toNumber(row.consumableCost));

      return {
        productId: row.productId.toString(),
        productName: row.productName,
        categoryName: row.categoryName,
        brandName: row.brandName,
        usedQuantity,
        unit,
        appointmentCount: row.appointmentCount,
        serviceCount: row.serviceCount,
        consumableCost,
        averagePerAppointment: averagePerAppointment === null ? null : roundMoney(averagePerAppointment),
        stockContentAmount,
        stockPackageEquivalent: contentAmount && stockContentAmount !== null ? stockContentAmount / contentAmount : null,
        estimatedProceduresLeft
      };
    }),
    dailyTrend: dailyTrendRows.map((row) => {
      const revenueFrom = roundMoney(toNumber(row.revenueFrom));
      const revenueTo = roundMoney(toNumber(row.revenueTo));
      const consumableCost =
        (row.consumableItemCount ?? 0) > 0 && (row.pricedConsumableCount ?? 0) < (row.consumableItemCount ?? 0)
          ? null
          : roundMoney(toNumber(row.consumableCost));

      return {
        date: row.day,
        revenueFrom,
        revenueTo,
        profitFrom: consumableCost === null ? null : roundMoney(revenueFrom - consumableCost),
        profitTo: consumableCost === null ? null : roundMoney(revenueTo - consumableCost)
      };
    }),
    comparison,
    attentionItems,
    employeePerformance: employeeRows.map((row) => {
      const revenueFrom = roundMoney(toNumber(row.revenueFrom));
      const revenueTo = roundMoney(toNumber(row.revenueTo));
      const consumableCost =
        row.consumableItemCount > 0 && row.pricedConsumableCount < row.consumableItemCount ? null : roundMoney(toNumber(row.consumableCost));
      const profitFrom = consumableCost === null ? null : roundMoney(revenueFrom - consumableCost);
      const profitTo = consumableCost === null ? null : roundMoney(revenueTo - consumableCost);

      return {
        employeeId: row.employeeId.toString(),
        employeeName: row.employeeName,
        completedVisits: row.completedVisits,
        revenueFrom,
        revenueTo,
        consumableCost,
        profitFrom,
        profitTo,
        averageProfitFrom: profitFrom === null || row.completedVisits === 0 ? null : roundMoney(profitFrom / row.completedVisits),
        averageProfitTo: profitTo === null || row.completedVisits === 0 ? null : roundMoney(profitTo / row.completedVisits),
        usedMl: toNumber(row.usedMl),
        usedGram: toNumber(row.usedGram)
      };
    })
  };
}

function buildComparisonQuery(
  appointmentPeriodFilter: Prisma.Sql,
  salePeriodFilter: Prisma.Sql,
  appointmentEmployeeFilter: Prisma.Sql,
  saleEmployeeFilter: Prisma.Sql
) {
  return Prisma.sql`
    WITH completed_visits AS (
      SELECT
        COUNT(DISTINCT appointment.id)::int AS "completedVisits",
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN payment.amount
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -payment.amount
            ELSE 0
          END
        ), 0) AS "serviceRevenueFrom",
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN payment.amount
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -payment.amount
            ELSE 0
          END
        ), 0) AS "serviceRevenueTo"
      FROM appointments appointment
      LEFT JOIN payments payment ON payment.appointment_id = appointment.id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
    ),
    material_costs AS (
      SELECT
        COALESCE(SUM(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN consumption.quantity * product.purchase_price / product.content_amount
            ELSE 0
          END
        ), 0) AS "consumableCost",
        COUNT(*)::int AS "consumableItemCount",
        COUNT(
          CASE
            WHEN product.purchase_price IS NOT NULL
              AND product.content_amount IS NOT NULL
              AND product.content_amount > 0
              AND lower(product.content_unit::text) = lower(consumption.unit::text)
            THEN 1
          END
        )::int AS "pricedConsumableCount"
      FROM service_consumption_logs consumption
      JOIN appointments appointment ON appointment.id = consumption.appointment_id
      JOIN products product ON product.id = consumption.product_id
      WHERE appointment.status = ${AppointmentStatus.COMPLETED}::"AppointmentStatus"
        ${appointmentPeriodFilter}
        ${appointmentEmployeeFilter}
    ),
    product_sales AS (
      SELECT
        COALESCE(SUM(
          CASE
            WHEN payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity * item.unit_price
            WHEN payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity * item.unit_price
            ELSE 0
          END
        ), 0) AS "productRevenue",
        COALESCE(SUM(
          CASE
            WHEN product.purchase_price IS NOT NULL AND payment.payment_status = 'PAID'::"PaymentStatus" THEN item.quantity * (item.unit_price - product.purchase_price)
            WHEN product.purchase_price IS NOT NULL AND payment.payment_status = 'REFUNDED'::"PaymentStatus" THEN -item.quantity * (item.unit_price - product.purchase_price)
            ELSE 0
          END
        ), 0) AS "productProfit",
        COUNT(*)::int AS "productItemCount",
        COUNT(product.purchase_price)::int AS "pricedProductCount"
      FROM product_sale_items item
      JOIN product_sales sale ON sale.id = item.sale_id
      JOIN products product ON product.id = item.product_id
      JOIN payments payment ON payment.product_sale_id = sale.id
      WHERE 1 = 1
        AND payment.payment_status IN ('PAID'::"PaymentStatus", 'REFUNDED'::"PaymentStatus")
        ${salePeriodFilter}
        ${saleEmployeeFilter}
    )
    SELECT
      completed_visits."completedVisits",
      completed_visits."serviceRevenueFrom",
      completed_visits."serviceRevenueTo",
      material_costs."consumableCost",
      material_costs."consumableItemCount",
      material_costs."pricedConsumableCount",
      product_sales."productRevenue",
      product_sales."productProfit",
      product_sales."productItemCount",
      product_sales."pricedProductCount"
    FROM completed_visits, material_costs, product_sales
  `;
}

function buildComparison(
  current:
    | {
        completedVisits: number;
        serviceRevenueFrom: Prisma.Decimal | null;
        serviceRevenueTo: Prisma.Decimal | null;
        consumableCost: Prisma.Decimal | null;
        consumableItemCount: number;
        pricedConsumableCount: number;
        productRevenue: Prisma.Decimal | null;
        productProfit: Prisma.Decimal | null;
        productItemCount: number;
        pricedProductCount: number;
      }
    | undefined,
  previous:
    | {
        completedVisits: number;
        serviceRevenueFrom: Prisma.Decimal | null;
        serviceRevenueTo: Prisma.Decimal | null;
        consumableCost: Prisma.Decimal | null;
        consumableItemCount: number;
        pricedConsumableCount: number;
        productRevenue: Prisma.Decimal | null;
        productProfit: Prisma.Decimal | null;
        productItemCount: number;
        pricedProductCount: number;
      }
    | undefined
) {
  const currentConsumableCost =
    current && current.consumableItemCount > 0 && current.pricedConsumableCount < current.consumableItemCount ? null : roundMoney(toNumber(current?.consumableCost));
  const previousConsumableCost =
    previous && previous.consumableItemCount > 0 && previous.pricedConsumableCount < previous.consumableItemCount ? null : roundMoney(toNumber(previous?.consumableCost));
  const currentProductProfit =
    current && current.productItemCount > 0 && current.pricedProductCount < current.productItemCount ? null : roundMoney(toNumber(current?.productProfit));
  const previousProductProfit =
    previous && previous.productItemCount > 0 && previous.pricedProductCount < previous.productItemCount ? null : roundMoney(toNumber(previous?.productProfit));
  const currentRevenueTo = roundMoney(toNumber(current?.serviceRevenueTo));
  const previousRevenueTo = roundMoney(toNumber(previous?.serviceRevenueTo));
  const currentProfitTo = currentConsumableCost === null ? null : roundMoney(currentRevenueTo - currentConsumableCost);
  const previousProfitTo = previousConsumableCost === null ? null : roundMoney(previousRevenueTo - previousConsumableCost);

  return {
    previousPeriodLabel: "Previous period",
    completedVisits: {
      current: current?.completedVisits ?? 0,
      previous: previous?.completedVisits ?? 0,
      changePercent: percentChange(current?.completedVisits ?? 0, previous?.completedVisits ?? 0)
    },
    serviceRevenue: {
      current: currentRevenueTo,
      previous: previousRevenueTo,
      changePercent: percentChange(currentRevenueTo, previousRevenueTo)
    },
    serviceProfit: {
      current: currentProfitTo,
      previous: previousProfitTo,
      changePercent: currentProfitTo === null || previousProfitTo === null ? null : percentChange(currentProfitTo, previousProfitTo)
    },
    productRevenue: {
      current: roundMoney(toNumber(current?.productRevenue)),
      previous: roundMoney(toNumber(previous?.productRevenue)),
      changePercent: percentChange(toNumber(current?.productRevenue), toNumber(previous?.productRevenue))
    },
    productProfit: {
      current: currentProductProfit,
      previous: previousProductProfit,
      changePercent: currentProductProfit === null || previousProductProfit === null ? null : percentChange(currentProductProfit, previousProductProfit)
    }
  };
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

function toPublicMeasurementUnit(unit: string) {
  return unit === "gram" ? "gram" : "ml";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}

function formatBackendQuantity(value: number, unit: string) {
  return `${roundMoney(value)} ${toPublicMeasurementUnit(unit) === "gram" ? "g" : "ml"}`;
}

function formatBackendStock(input: { stockQuantity: number; contentAmount: Prisma.Decimal | null; stockContentAmount: Prisma.Decimal | null; contentUnit: string | null }) {
  const contentAmount = input.contentAmount ? toNumber(input.contentAmount) : null;
  const stockContentAmount = input.stockContentAmount ? toNumber(input.stockContentAmount) : null;

  if (contentAmount && stockContentAmount !== null && input.contentUnit) {
    return `${roundMoney(stockContentAmount / contentAmount)} packs (${roundMoney(stockContentAmount)} ${toPublicMeasurementUnit(input.contentUnit) === "gram" ? "g" : "ml"})`;
  }

  return `${input.stockQuantity} packs`;
}

function resolveBusinessAnalyticsPeriod(input: BusinessAnalyticsPeriodInput) {
  const now = new Date();
  const period = input.period === "week" || input.period === "custom" ? input.period : "month";

  if (period === "custom") {
    const from = parseBusinessAnalyticsDate(input.from, "from") ?? startOfLocalDay(now);
    const to = parseBusinessAnalyticsDate(input.to, "to") ?? endOfLocalDay(now);

    if (from > to) {
      throw new HttpError(400, "Analytics start date cannot be after end date.");
    }

    return {
      type: "custom" satisfies BusinessAnalyticsPeriod,
      from,
      to,
      label: `${formatBusinessAnalyticsDate(from)} - ${formatBusinessAnalyticsDate(to)}`
    };
  }

  const from = new Date(now);
  from.setDate(now.getDate() - (period === "week" ? 7 : 30));

  return {
    type: period satisfies BusinessAnalyticsPeriod,
    from,
    to: now,
    label: period === "week" ? "Last 7 days" : "Last 30 days"
  };
}

function resolvePreviousBusinessAnalyticsPeriod(period: { from: Date; to: Date }) {
  const duration = period.to.getTime() - period.from.getTime();
  const to = new Date(period.from.getTime() - 1);
  const from = new Date(to.getTime() - duration);

  return { from, to };
}

function parseBusinessAnalyticsDate(value: string | undefined, boundary: "from" | "to") {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "Analytics date must use YYYY-MM-DD format.");
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "Analytics date is invalid.");
  }

  return boundary === "from" ? startOfLocalDay(date) : endOfLocalDay(date);
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatBusinessAnalyticsDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);
}

function formatSqlDate(value: Date) {
  return [String(value.getFullYear()), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}
