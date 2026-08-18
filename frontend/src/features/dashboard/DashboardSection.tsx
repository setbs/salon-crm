import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, InfoList, MetricCard, Panel, StatusBadge } from "../../components/admin-ui";
import { fetchAdminBusinessAnalytics, type AdminBusinessAnalyticsPeriod, type AdminData } from "../../api";
import { adminMoney, formatPlainNumber, formatUnit, plainHryvnia } from "../../utils/format";

export function DashboardSection({
  dashboard,
  analytics,
  businessAnalytics,
  appointments,
  products
}: {
  dashboard: AdminData["dashboard"];
  analytics: AdminData["consumableAnalytics"];
  businessAnalytics: AdminData["businessAnalytics"];
  appointments: AdminData["appointments"];
  products: AdminData["products"];
}) {
  const [selectedBusinessPeriod, setSelectedBusinessPeriod] = useState<AdminBusinessAnalyticsPeriod>("month");
  const [customBusinessFrom, setCustomBusinessFrom] = useState(() => getRelativeDateInputValue(-30));
  const [customBusinessTo, setCustomBusinessTo] = useState(() => getDateInputValue(new Date()));
  const [visibleBusinessAnalytics, setVisibleBusinessAnalytics] = useState(businessAnalytics);
  const [isBusinessAnalyticsLoading, setIsBusinessAnalyticsLoading] = useState(false);
  const [businessAnalyticsError, setBusinessAnalyticsError] = useState("");
  const [activeReport, setActiveReport] = useState<"service" | "materials" | "forecast" | "products" | "brands" | "employees">("service");

  useEffect(() => {
    setVisibleBusinessAnalytics(businessAnalytics);
  }, [businessAnalytics]);

  const loadBusinessAnalytics = async (period: AdminBusinessAnalyticsPeriod, from = customBusinessFrom, to = customBusinessTo) => {
    setSelectedBusinessPeriod(period);
    setIsBusinessAnalyticsLoading(true);
    setBusinessAnalyticsError("");

    try {
      const nextAnalytics = await fetchAdminBusinessAnalytics({ period, from, to });
      setVisibleBusinessAnalytics(nextAnalytics);
    } catch (error) {
      setBusinessAnalyticsError(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setIsBusinessAnalyticsLoading(false);
    }
  };

  const completedVisits = visibleBusinessAnalytics.services.reduce((sum, item) => sum + item.appointmentCount, 0);
  const serviceRevenueFrom = visibleBusinessAnalytics.services.reduce((sum, item) => sum + item.revenueFrom, 0);
  const serviceRevenueTo = visibleBusinessAnalytics.services.reduce((sum, item) => sum + item.revenueTo, 0);
  const hasUnknownServiceProfit = visibleBusinessAnalytics.services.some((item) => item.profitFrom === null || item.profitTo === null);
  const serviceProfitFrom = hasUnknownServiceProfit ? null : visibleBusinessAnalytics.services.reduce((sum, item) => sum + (item.profitFrom ?? 0), 0);
  const serviceProfitTo = hasUnknownServiceProfit ? null : visibleBusinessAnalytics.services.reduce((sum, item) => sum + (item.profitTo ?? 0), 0);
  const productRevenue = visibleBusinessAnalytics.productSalesByCategory.reduce((sum, item) => sum + item.revenue, 0);
  const hasUnknownMaterialCost = visibleBusinessAnalytics.materialUsageByService.some((item) => item.consumableCost === null);
  const materialCost = hasUnknownMaterialCost ? null : visibleBusinessAnalytics.materialUsageByService.reduce((sum, item) => sum + (item.consumableCost ?? 0), 0);
  const hasUnknownProductProfit = visibleBusinessAnalytics.productSalesByCategory.some((item) => item.profit === null);
  const productProfit = hasUnknownProductProfit ? null : visibleBusinessAnalytics.productSalesByCategory.reduce((sum, item) => sum + (item.profit ?? 0), 0);
  const criticalProcedureProducts = visibleBusinessAnalytics.procedureProductUsage.filter(
    (item) => item.estimatedProceduresLeft !== null && item.estimatedProceduresLeft <= 3
  ).length;
  const todayAppointments = appointments
    .filter((appointment) => isSameLocalDate(appointment.date, new Date()))
    .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime());
  const reportTabs: Array<{ id: typeof activeReport; label: string }> = [
    { id: "service", label: "Service profit" },
    { id: "materials", label: "Materials" },
    { id: "forecast", label: "Forecast" },
    { id: "products", label: "Products" },
    { id: "brands", label: "Brands" },
    { id: "employees", label: "Employees" }
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-metrics" aria-label="Dashboard overview">
        <MetricCard label="Appointments today" value={String(dashboard.todayAppointments)} note="records from PostgreSQL" />
        <MetricCard label="Daily revenue" value={adminMoney.format(dashboard.dailyRevenue)} note="paid services + products" />
        <MetricCard
          label="Next appointment"
          value={dashboard.nextAppointment?.time ?? "-"}
          note={dashboard.nextAppointment ? `${dashboard.nextAppointment.client}, ${dashboard.nextAppointment.service}` : "no upcoming appointments"}
        />
        <MetricCard label="Low stock" value={String(dashboard.lowStockProducts)} note="products need restocking" />
        <MetricCard label="Consumables used" value={formatAnalyticsTotals(analytics)} note={`${analytics.logsCount} write-offs · ${analytics.periodLabel.toLowerCase()}`} />
        <MetricCard label="Low consumables" value={String(analytics.lowConsumableProducts)} note="package-content stock alerts" />
      </section>

      <section className="admin-panel dashboard-analytics-panel">
        <div className="dashboard-panel-heading">
          <div className="dashboard-panel-title">
            <span>Financial report</span>
            <h2>Business analytics</h2>
          </div>
          <div className="dashboard-heading-actions">
            <span>{isBusinessAnalyticsLoading ? "Loading..." : visibleBusinessAnalytics.periodLabel}</span>
            <div className="dashboard-export-actions">
              <button className="panel-action icon-button" onClick={() => exportAnalyticsCsv(visibleBusinessAnalytics)} type="button">
                <Download aria-hidden="true" size={15} />
                Analytics CSV
              </button>
              <button className="panel-action icon-button" onClick={() => exportAppointmentsCsv(appointments)} type="button">
                <Download aria-hidden="true" size={15} />
                Appointments CSV
              </button>
              <button className="panel-action icon-button" onClick={() => exportInventoryCsv(products, analytics)} type="button">
                <Download aria-hidden="true" size={15} />
                Inventory CSV
              </button>
            </div>
          </div>
        </div>

        <div className="analytics-period-toolbar">
          <div className="segmented-control analytics-period-tabs" aria-label="Business analytics period">
            <button className={selectedBusinessPeriod === "week" ? "active" : ""} disabled={isBusinessAnalyticsLoading} onClick={() => void loadBusinessAnalytics("week")} type="button">
              Week
            </button>
            <button className={selectedBusinessPeriod === "month" ? "active" : ""} disabled={isBusinessAnalyticsLoading} onClick={() => void loadBusinessAnalytics("month")} type="button">
              Month
            </button>
            <button className={selectedBusinessPeriod === "custom" ? "active" : ""} disabled={isBusinessAnalyticsLoading} onClick={() => setSelectedBusinessPeriod("custom")} type="button">
              Custom
            </button>
          </div>

          {selectedBusinessPeriod === "custom" ? (
            <div className="analytics-custom-range">
              <label>
                <span>From</span>
                <input disabled={isBusinessAnalyticsLoading} onChange={(event) => setCustomBusinessFrom(event.target.value)} type="date" value={customBusinessFrom} />
              </label>
              <label>
                <span>To</span>
                <input disabled={isBusinessAnalyticsLoading} onChange={(event) => setCustomBusinessTo(event.target.value)} type="date" value={customBusinessTo} />
              </label>
              <button className="panel-action" disabled={isBusinessAnalyticsLoading} onClick={() => void loadBusinessAnalytics("custom")} type="button">
                Apply
              </button>
            </div>
          ) : null}
        </div>

        {businessAnalyticsError ? <div className="form-error">{businessAnalyticsError}</div> : null}

        <div className="dashboard-insight-grid">
          <article>
            <span>Completed visits</span>
            <strong>{completedVisits}</strong>
          </article>
          <article>
            <span>Service revenue</span>
            <strong>{formatMoneyRange(serviceRevenueFrom, serviceRevenueTo)}</strong>
          </article>
          <article>
            <span>Net service profit</span>
            <strong>{formatNullableMoneyRange(serviceProfitFrom, serviceProfitTo)}</strong>
          </article>
          <article>
            <span>Product revenue</span>
            <strong>{adminMoney.format(productRevenue)}</strong>
          </article>
          <article>
            <span>Consumable cost</span>
            <strong>{formatNullableMoney(materialCost)}</strong>
          </article>
          <article>
            <span>Retail product profit</span>
            <strong>{formatNullableMoney(productProfit)}</strong>
          </article>
          <article>
            <span>Critical forecast</span>
            <strong>{criticalProcedureProducts}</strong>
          </article>
        </div>

        <div className="analytics-comparison-grid">
          <ComparisonCard label="Visits" metric={visibleBusinessAnalytics.comparison.completedVisits} />
          <ComparisonCard label="Service revenue" metric={visibleBusinessAnalytics.comparison.serviceRevenue} money />
          <ComparisonCard label="Service profit" metric={visibleBusinessAnalytics.comparison.serviceProfit} money />
          <ComparisonCard label="Product profit" metric={visibleBusinessAnalytics.comparison.productProfit} money />
        </div>

        <div className="analytics-visual-grid">
          <section className="analytics-chart-card wide">
            <div className="chart-heading">
              <h3>Revenue / profit by day</h3>
              <span>{visibleBusinessAnalytics.periodLabel}</span>
            </div>
            <DailyTrendChart items={visibleBusinessAnalytics.dailyTrend} />
          </section>
          <section className="analytics-chart-card">
            <div className="chart-heading">
              <h3>Top consumables</h3>
              <span>by material cost</span>
            </div>
            <HorizontalBarChart
              emptyLabel="No consumables yet"
              items={visibleBusinessAnalytics.procedureProductUsage.slice(0, 5).map((item) => ({
                label: item.productName,
                value: item.consumableCost ?? 0,
                text: item.consumableCost === null ? "not tracked" : formatHryvnia(item.consumableCost)
              }))}
            />
          </section>
          <section className="analytics-chart-card">
            <div className="chart-heading">
              <h3>Low-stock forecast</h3>
              <span>visits left</span>
            </div>
            <HorizontalBarChart
              emptyLabel="No forecast data"
              invert
              items={visibleBusinessAnalytics.procedureProductUsage
                .filter((item) => item.estimatedProceduresLeft !== null)
                .sort((left, right) => (left.estimatedProceduresLeft ?? 0) - (right.estimatedProceduresLeft ?? 0))
                .slice(0, 5)
                .map((item) => ({
                  label: item.productName,
                  value: item.estimatedProceduresLeft ?? 0,
                  text: `${item.estimatedProceduresLeft} visits`
                }))}
            />
          </section>
        </div>

        <section className="attention-panel">
          <div className="chart-heading">
            <h3>Attention needed</h3>
            <span>{visibleBusinessAnalytics.attentionItems.length} signals</span>
          </div>
          <div className="attention-list">
            {visibleBusinessAnalytics.attentionItems.length > 0 ? (
              visibleBusinessAnalytics.attentionItems.map((item) => (
                <article className={`attention-item ${item.severity}`} key={`${item.severity}-${item.title}`}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </article>
              ))
            ) : (
              <div className="modal-state">No urgent business signals for this period.</div>
            )}
          </div>
        </section>

        <div className="dashboard-report-tabs" aria-label="Business report type">
          {reportTabs.map((tab) => (
            <button className={activeReport === tab.id ? "active" : ""} key={tab.id} onClick={() => setActiveReport(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </div>

        <section className="dashboard-report-card active">{renderBusinessReport(activeReport, visibleBusinessAnalytics)}</section>
      </section>

      <section className="dashboard-secondary-grid">
        <Panel title="Today's appointments" action="Create appointment">
          <DataTable
            columns={["Time", "Client", "Service", "Employee", "Status"]}
            rows={
              todayAppointments.length > 0
                ? todayAppointments.map((item) => [item.time, item.client, item.service, item.master, <StatusBadge status={item.status} />])
                : [["No appointments today", "-", "-", "-", "-"]]
            }
          />
        </Panel>

        <Panel title="Restock suggestions">
          <DataTable
            columns={["Product", "Stock", "Minimum", "Buy"]}
            rows={
              visibleBusinessAnalytics.restock.length > 0
                ? visibleBusinessAnalytics.restock.map((item) => [
                    item.categoryName ? `${item.productName} · ${item.categoryName}` : item.productName,
                    formatBusinessStock(item),
                    `${item.minStockQuantity} packs`,
                    item.packagesToBuy > 0 ? `${item.packagesToBuy} packs` : "check stock"
                  ])
                : [["Stock is healthy", "-", "-", "-"]]
            }
          />
        </Panel>

        <Panel title="Consumable analytics">
          <DataTable
            columns={["Product", "Used", "Appointments", "Current stock"]}
            rows={
              analytics.products.length > 0
                ? analytics.products.map((item) => [
                    item.productCategory ? `${item.productName} · ${item.productCategory}` : item.productName,
                    `${formatPlainNumber(item.usedQuantity)} ${formatUnit(item.unit)}`,
                    `${item.appointmentCount} appointments`,
                    formatAnalyticsStock(item)
                  ])
                : [["No write-offs yet", "-", "-", "-"]]
            }
          />
        </Panel>

        <Panel title="Recent write-offs">
          <InfoList
            items={
              analytics.recentLogs.length > 0
                ? analytics.recentLogs.map((log) => [
                    `${formatShortDate(log.createdAt)} · ${log.productName}`,
                    `${formatPlainNumber(log.quantity)} ${formatUnit(log.unit)} · ${log.serviceName} · ${log.clientName}`
                  ])
                : [["No data", "Complete an appointment with consumables to see write-offs here."]]
            }
          />
        </Panel>
      </section>
    </div>
  );
}

function formatHryvnia(value: number) {
  return `${plainHryvnia.format(value)} ₴`;
}

type CsvValue = string | number | null | undefined;

function exportAnalyticsCsv(analytics: AdminData["businessAnalytics"]) {
  const rows: CsvValue[][] = [
    ["SL Color Studio - Business analytics"],
    ["Period", analytics.periodLabel],
    [],
    ["Service profit"],
    ["Service", "Completed visits", "Revenue from", "Revenue to", "Consumables cost", "Profit from", "Profit to"],
    ...analytics.services.map((item) => [
      item.serviceName,
      item.appointmentCount,
      item.revenueFrom,
      item.revenueTo,
      item.consumableCost,
      item.profitFrom,
      item.profitTo
    ]),
    [],
    ["Material pressure by service"],
    ["Service", "Completed visits", "Used ml", "Used gram", "Consumables cost", "Profit from", "Profit to"],
    ...analytics.materialUsageByService.map((item) => [
      item.serviceName,
      item.appointmentCount,
      item.usedMl,
      item.usedGram,
      item.consumableCost,
      item.profitFrom,
      item.profitTo
    ]),
    [],
    ["Procedure product usage"],
    ["Product", "Category", "Brand", "Used", "Unit", "Appointments", "Consumables cost", "Average per appointment", "Stock content", "Estimated procedures left"],
    ...analytics.procedureProductUsage.map((item) => [
      item.productName,
      item.categoryName,
      item.brandName,
      item.usedQuantity,
      formatUnit(item.unit),
      item.appointmentCount,
      item.consumableCost,
      item.averagePerAppointment,
      item.stockContentAmount,
      item.estimatedProceduresLeft
    ]),
    [],
    ["Product sales by category"],
    ["Category", "Units", "Revenue", "Profit"],
    ...analytics.productSalesByCategory.map((item) => [item.name, item.quantity, item.revenue, item.profit]),
    [],
    ["Product sales by brand"],
    ["Brand", "Units", "Revenue", "Profit"],
    ...analytics.productSalesByBrand.map((item) => [item.name, item.quantity, item.revenue, item.profit]),
    [],
    ["Employee performance"],
    ["Employee", "Completed visits", "Revenue from", "Revenue to", "Consumables cost", "Profit from", "Profit to", "Used ml", "Used gram"],
    ...analytics.employeePerformance.map((item) => [
      item.employeeName,
      item.completedVisits,
      item.revenueFrom,
      item.revenueTo,
      item.consumableCost,
      item.profitFrom,
      item.profitTo,
      item.usedMl,
      item.usedGram
    ]),
    [],
    ["Attention needed"],
    ["Severity", "Title", "Detail"],
    ...analytics.attentionItems.map((item) => [item.severity, item.title, item.detail])
  ];

  downloadCsv(`sl-business-analytics-${safeFilePart(analytics.periodLabel)}.csv`, rows);
}

function exportAppointmentsCsv(appointments: AdminData["appointments"]) {
  const rows: CsvValue[][] = [
    ["SL Color Studio - Appointments"],
    ["Exported at", formatCsvDateTime(new Date().toISOString())],
    [],
    [
      "ID",
      "Start",
      "End",
      "Client",
      "Phone",
      "Email",
      "Employee",
      "Services",
      "Status",
      "Payment status",
      "Payment method",
      "Amount",
      "Revenue from",
      "Revenue to",
      "Consumables cost",
      "Profit from",
      "Profit to",
      "Client comment",
      "Internal comment"
    ],
    ...appointments.map((item) => [
      item.id,
      formatCsvDateTime(item.date),
      formatCsvDateTime(item.endDate),
      item.client,
      item.clientPhone,
      item.clientEmail,
      item.master,
      item.services.map((service) => service.name).join(", "),
      item.status,
      item.paymentStatus,
      item.paymentMethod,
      item.amount,
      item.revenueFrom,
      item.revenueTo,
      item.consumableCost,
      item.profitAfterConsumablesFrom,
      item.profitAfterConsumablesTo,
      item.clientComment,
      item.employeeComment
    ])
  ];

  downloadCsv("sl-appointments.csv", rows);
}

function exportInventoryCsv(products: AdminData["products"], analytics: AdminData["consumableAnalytics"]) {
  const movements = products
    .flatMap((product) => product.movements.map((movement) => ({ product, movement })))
    .sort((first, second) => new Date(second.movement.createdAt).getTime() - new Date(first.movement.createdAt).getTime());

  const rows: CsvValue[][] = [
    ["SL Color Studio - Inventory and consumables"],
    ["Exported at", formatCsvDateTime(new Date().toISOString())],
    [],
    ["Products"],
    ["Category", "Brand", "Purpose", "SKU", "Product", "Purchase price", "Sale price", "Stock packs", "Minimum packs", "Package content", "Stock content", "Stock equivalent", "Status"],
    ...products.map((product) => [
      product.category,
      product.brand,
      product.purpose,
      product.sku,
      product.name,
      product.purchase,
      product.sale,
      product.stock,
      product.min,
      formatAmountWithUnit(product.contentAmount, product.contentUnit),
      formatAmountWithUnit(product.stockContentAmount, product.contentUnit),
      product.stockPackageEquivalent,
      product.stockStatus
    ]),
    [],
    ["Consumable usage", analytics.periodLabel],
    ["Product", "Category", "Used", "Unit", "Appointments", "Service count", "Current stock"],
    ...analytics.products.map((product) => [
      product.productName,
      product.productCategory,
      product.usedQuantity,
      formatUnit(product.unit),
      product.appointmentCount,
      product.serviceCount,
      product.stockContentAmount === null || product.stockPackageEquivalent === null
        ? "not tracked"
        : `${formatPlainNumber(product.stockPackageEquivalent)} packs / ${formatPlainNumber(product.stockContentAmount)} ${formatUnit(product.unit)}`
    ]),
    [],
    ["Stock movement history"],
    ["Date", "Product", "Type", "Packages", "Content quantity", "Content unit", "Reason"],
    ...movements.map(({ product, movement }) => [
      formatCsvDateTime(movement.createdAt),
      product.name,
      movement.type,
      movement.quantity,
      movement.contentQuantity,
      movement.contentUnit ? formatUnit(movement.contentUnit) : null,
      movement.reason
    ])
  ];

  downloadCsv("sl-inventory-consumables.csv", rows);
}

function downloadCsv(fileName: string, rows: CsvValue[][]) {
  const csv = rows.map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvValue(value: CsvValue) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  const guardedText = /^[=+@]/.test(text) ? `'${text}` : text;

  return `"${guardedText.replace(/"/g, '""')}"`;
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

function formatCsvDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatAmountWithUnit(amount: number | null, unit: "ml" | "gram" | null) {
  if (amount === null || !unit) {
    return "";
  }

  return `${formatPlainNumber(amount)} ${formatUnit(unit)}`;
}

function ComparisonCard({
  label,
  metric,
  money
}: {
  label: string;
  metric: { current: number | null; previous: number | null; changePercent: number | null };
  money?: boolean;
}) {
  const change = metric.changePercent;
  const direction = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";

  return (
    <article className={`comparison-card ${direction}`}>
      <span>{label}</span>
      <strong>{metric.current === null ? "not tracked" : money ? formatHryvnia(metric.current) : formatPlainNumber(metric.current)}</strong>
      <small>{change === null ? "no comparison" : `${change > 0 ? "+" : ""}${formatPlainNumber(change)}% vs previous`}</small>
    </article>
  );
}

function DailyTrendChart({ items }: { items: AdminData["businessAnalytics"]["dailyTrend"] }) {
  const visibleItems = items.filter((item) => item.revenueTo > 0 || item.profitTo !== null);
  const chartItems = visibleItems.length > 0 ? visibleItems : items.slice(-7);
  const maxValue = Math.max(1, ...chartItems.map((item) => Math.max(item.revenueTo, item.profitTo ?? 0)));

  if (chartItems.length === 0) {
    return <div className="modal-state">No daily data for this period.</div>;
  }

  return (
    <div className="daily-trend-chart">
      {chartItems.map((item) => (
        <div className="daily-trend-column" key={item.date}>
          <div className="daily-trend-bars">
            <span className="revenue" style={{ height: `${Math.max(4, (item.revenueTo / maxValue) * 100)}%` }} title={`Revenue ${formatHryvnia(item.revenueTo)}`} />
            <span
              className="profit"
              style={{ height: `${Math.max(4, (((item.profitTo ?? 0) > 0 ? item.profitTo ?? 0 : 0) / maxValue) * 100)}%` }}
              title={`Profit ${item.profitTo === null ? "not tracked" : formatHryvnia(item.profitTo)}`}
            />
          </div>
          <small>{formatChartDate(item.date)}</small>
        </div>
      ))}
      <div className="chart-legend">
        <span className="revenue">Revenue</span>
        <span className="profit">Profit</span>
      </div>
    </div>
  );
}

function HorizontalBarChart({
  emptyLabel,
  invert,
  items
}: {
  emptyLabel: string;
  invert?: boolean;
  items: Array<{ label: string; value: number; text: string }>;
}) {
  const filteredItems = items.filter((item) => Number.isFinite(item.value));
  const maxValue = Math.max(1, ...filteredItems.map((item) => item.value));

  if (filteredItems.length === 0) {
    return <div className="modal-state">{emptyLabel}</div>;
  }

  return (
    <div className="horizontal-chart">
      {filteredItems.map((item) => {
        const width = invert ? Math.max(8, 100 - (item.value / maxValue) * 92) : Math.max(8, (item.value / maxValue) * 100);

        return (
          <article key={item.label}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.text}</span>
            </div>
            <div className="horizontal-chart-track">
              <span style={{ width: `${width}%` }} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function renderBusinessReport(report: "service" | "materials" | "forecast" | "products" | "brands" | "employees", analytics: AdminData["businessAnalytics"]) {
  if (report === "materials") {
    return (
      <>
        <h3>Material pressure by service</h3>
        <DataTable
          columns={["Service", "Visits", "Used", "Consumables", "Profit after materials"]}
          rows={
            analytics.materialUsageByService.length > 0
              ? analytics.materialUsageByService.map((item) => [
                  item.serviceName,
                  `${item.appointmentCount} visits`,
                  formatMaterialUsage(item.usedMl, item.usedGram),
                  formatNullableMoney(item.consumableCost),
                  formatNullableMoneyRange(item.profitFrom, item.profitTo)
                ])
              : [["No material write-offs", "-", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "forecast") {
    return (
      <>
        <h3>Procedure product forecast</h3>
        <DataTable
          columns={["Product", "Used", "Cost", "Average / visit", "Stock forecast"]}
          rows={
            analytics.procedureProductUsage.length > 0
              ? analytics.procedureProductUsage.map((item) => [
                  item.categoryName ? `${item.productName} · ${item.categoryName}` : item.productName,
                  `${formatPlainNumber(item.usedQuantity)} ${formatUnit(item.unit)} · ${item.appointmentCount} visits`,
                  formatNullableMoney(item.consumableCost),
                  item.averagePerAppointment === null ? "not tracked" : `${formatPlainNumber(item.averagePerAppointment)} ${formatUnit(item.unit)}`,
                  formatProcedureForecast(item)
                ])
              : [["No procedure product usage", "-", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "products") {
    return (
      <>
        <h3>Product sales</h3>
        <DataTable
          columns={["Category", "Units", "Revenue", "Profit"]}
          rows={
            analytics.productSalesByCategory.length > 0
              ? analytics.productSalesByCategory.map((item) => [item.name, String(item.quantity), adminMoney.format(item.revenue), formatNullableMoney(item.profit)])
              : [["No product sales", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "brands") {
    return (
      <>
        <h3>Brand performance</h3>
        <DataTable
          columns={["Brand", "Units", "Revenue", "Profit"]}
          rows={
            analytics.productSalesByBrand.length > 0
              ? analytics.productSalesByBrand.map((item) => [item.name, String(item.quantity), adminMoney.format(item.revenue), formatNullableMoney(item.profit)])
              : [["No product sales", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "employees") {
    return (
      <>
        <h3>Employee performance</h3>
        <DataTable
          columns={["Employee", "Visits", "Revenue", "Consumables", "Avg profit", "Materials"]}
          rows={
            analytics.employeePerformance.length > 0
              ? analytics.employeePerformance.map((item) => [
                  item.employeeName,
                  `${item.completedVisits} visits`,
                  formatMoneyRange(item.revenueFrom, item.revenueTo),
                  formatNullableMoney(item.consumableCost),
                  formatNullableMoneyRange(item.averageProfitFrom, item.averageProfitTo),
                  formatMaterialUsage(item.usedMl, item.usedGram)
                ])
              : [["No employee performance yet", "-", "-", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  return (
    <>
      <h3>Service profit</h3>
      <DataTable
        columns={["Service", "Visits", "Revenue", "Consumables", "Profit"]}
        rows={
          analytics.services.length > 0
            ? analytics.services.map((item) => [
                item.serviceName,
                `${item.appointmentCount} visits`,
                formatMoneyRange(item.revenueFrom, item.revenueTo),
                formatNullableMoney(item.consumableCost),
                formatNullableMoneyRange(item.profitFrom, item.profitTo)
              ])
            : [["No completed services", "-", "-", "-", "-"]]
        }
      />
    </>
  );
}

function formatMoneyRange(from: number, to: number) {
  return from === to ? formatHryvnia(from) : `${plainHryvnia.format(from)} - ${plainHryvnia.format(to)} ₴`;
}

function formatNullableMoney(value: number | null) {
  return value === null ? "not tracked" : formatHryvnia(value);
}

function formatNullableMoneyRange(from: number | null, to: number | null) {
  return from === null || to === null ? "not tracked" : formatMoneyRange(from, to);
}

function formatAnalyticsTotals(analytics: AdminData["consumableAnalytics"]) {
  const parts = [];

  if (analytics.totalMl > 0) {
    parts.push(`${formatPlainNumber(analytics.totalMl)} ml`);
  }

  if (analytics.totalGram > 0) {
    parts.push(`${formatPlainNumber(analytics.totalGram)} g`);
  }

  return parts.length > 0 ? parts.join(" / ") : "0";
}

function formatMaterialUsage(usedMl: number, usedGram: number) {
  const parts = [];

  if (usedMl > 0) {
    parts.push(`${formatPlainNumber(usedMl)} ml`);
  }

  if (usedGram > 0) {
    parts.push(`${formatPlainNumber(usedGram)} g`);
  }

  return parts.length > 0 ? parts.join(" / ") : "0";
}

function formatAnalyticsStock(item: AdminData["consumableAnalytics"]["products"][number]) {
  if (item.stockContentAmount !== null && item.stockPackageEquivalent !== null) {
    return `${formatPlainNumber(item.stockPackageEquivalent)} packs · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.unit)}`;
  }

  return "not tracked";
}

function formatBusinessStock(item: AdminData["businessAnalytics"]["restock"][number]) {
  if (item.stockContentAmount !== null && item.stockPackageEquivalent !== null && item.contentUnit !== null) {
    return `${formatPlainNumber(item.stockPackageEquivalent)} packs · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.contentUnit)}`;
  }

  return `${item.stockQuantity} packs`;
}

function formatProcedureForecast(item: AdminData["businessAnalytics"]["procedureProductUsage"][number]) {
  const stock =
    item.stockContentAmount !== null && item.stockPackageEquivalent !== null
      ? `${formatPlainNumber(item.stockPackageEquivalent)} packs · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.unit)}`
      : "stock not tracked";

  if (item.estimatedProceduresLeft === null) {
    return stock;
  }

  return `${item.estimatedProceduresLeft} visits left · ${stock}`;
}

function getDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRelativeDateInputValue(dayOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return getDateInputValue(date);
}

function isSameLocalDate(value: string, reference: Date) {
  const date = new Date(value);

  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date.getDate() === reference.getDate();
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(`${value}T00:00:00`));
}
