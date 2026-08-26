import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable, InfoList, MetricCard, Panel, StatusBadge } from "../../components/admin-ui";
import { useCrmLanguage, type CrmLanguage } from "../../crm-i18n";
import { fetchAdminBusinessAnalytics, type AdminBusinessAnalyticsPeriod, type AdminData } from "../../api";
import { adminMoney, formatPlainNumber, formatUnit, plainHryvnia } from "../../utils/format";

const dashboardCopy = {
  en: {
    requestFailed: "Request failed.",
    netServiceProfit: "Net service profit",
    materials: "Materials",
    forecast: "Forecast",
    products: "Products",
    brands: "Brands",
    employees: "Employees",
    dashboardOverview: "Dashboard overview",
    appointmentsToday: "Appointments today",
    recordsFromPostgres: "records from PostgreSQL",
    dailyNetRevenue: "Daily net revenue",
    paidRefundedNote: "paid/refunded services + products",
    nextAppointment: "Next appointment",
    noUpcomingAppointments: "no upcoming appointments",
    lowStock: "Low stock",
    productsNeedRestocking: "products need restocking",
    consumablesUsed: "Consumables used",
    writeOffs: "write-offs",
    lowConsumables: "Low consumables",
    packageAlerts: "package-content stock alerts",
    netFinancialReport: "Net financial report",
    businessAnalytics: "Business analytics",
    loading: "Loading...",
    analyticsCsv: "Analytics CSV",
    appointmentsCsv: "Appointments CSV",
    inventoryCsv: "Inventory CSV",
    week: "Week",
    month: "Month",
    custom: "Custom",
    from: "From",
    to: "To",
    apply: "Apply",
    completedVisits: "Completed visits",
    netServiceRevenue: "Net service revenue",
    netProductRevenue: "Net product revenue",
    consumableCost: "Consumable cost",
    netRetailProductProfit: "Net retail product profit",
    criticalForecast: "Critical forecast",
    visits: "Visits",
    netProductProfit: "Net product profit",
    revenueProfitByDay: "Net revenue / profit by day",
    topConsumables: "Top consumables",
    byMaterialCost: "by material cost",
    noConsumablesYet: "No consumables yet",
    notTracked: "not tracked",
    lowStockForecast: "Low-stock forecast",
    visitsLeft: "visits left",
    noForecastData: "No forecast data",
    attentionNeeded: "Attention needed",
    signals: "signals",
    noSignals: "No urgent business signals for this period.",
    businessReportType: "Business report type",
    todaysAppointments: "Today's appointments",
    createAppointment: "Create appointment",
    time: "Time",
    client: "Client",
    service: "Service",
    employee: "Employee",
    status: "Status",
    noAppointmentsToday: "No appointments today",
    restockSuggestions: "Restock suggestions",
    product: "Product",
    stock: "Stock",
    minimum: "Minimum",
    buy: "Buy",
    packs: "packs",
    checkStock: "check stock",
    stockHealthy: "Stock is healthy",
    consumableAnalytics: "Consumable analytics",
    used: "Used",
    appointments: "Appointments",
    currentStock: "Current stock",
    appointmentCount: "appointments",
    noWriteOffsYet: "No write-offs yet",
    recentWriteOffs: "Recent write-offs",
    noData: "No data",
    completeAppointmentHint: "Complete an appointment with consumables to see write-offs here.",
    materialPressureByService: "Material pressure by service",
    procedureProductForecast: "Procedure product forecast",
    productSales: "Product sales",
    brandPerformance: "Brand performance",
    employeePerformance: "Employee performance",
    category: "Category",
    units: "Units",
    averageVisit: "Average / visit",
    stockForecast: "Stock forecast",
    cost: "Cost",
    noMaterialWriteOffs: "No material write-offs",
    noProcedureUsage: "No procedure product usage",
    noProductSales: "No product sales",
    noEmployeePerformance: "No employee performance yet",
    noCompletedServices: "No completed services",
    avgNetProfit: "Avg net profit",
    stockNotTracked: "stock not tracked"
    ,
    noComparison: "no comparison",
    vsPrevious: "vs previous",
    noDailyData: "No daily data for this period.",
    netRevenue: "Net revenue",
    netProfit: "Net profit"
  },
  uk: {
    requestFailed: "Запит не виконано.",
    netServiceProfit: "Чистий прибуток з послуг",
    materials: "Матеріали",
    forecast: "Прогноз",
    products: "Товари",
    brands: "Бренди",
    employees: "Працівники",
    dashboardOverview: "Огляд панелі",
    appointmentsToday: "Записи сьогодні",
    recordsFromPostgres: "дані з PostgreSQL",
    dailyNetRevenue: "Чиста виручка за день",
    paidRefundedNote: "оплачені/повернуті послуги + товари",
    nextAppointment: "Наступний запис",
    noUpcomingAppointments: "майбутніх записів немає",
    lowStock: "Низький склад",
    productsNeedRestocking: "товари потребують поповнення",
    consumablesUsed: "Використано матеріалів",
    writeOffs: "списань",
    lowConsumables: "Мало витратних матеріалів",
    packageAlerts: "попередження по обʼєму упаковок",
    netFinancialReport: "Чистий фінансовий звіт",
    businessAnalytics: "Бізнес-аналітика",
    loading: "Завантаження...",
    analyticsCsv: "CSV аналітики",
    appointmentsCsv: "CSV записів",
    inventoryCsv: "CSV складу",
    week: "Тиждень",
    month: "Місяць",
    custom: "Свій період",
    from: "Від",
    to: "До",
    apply: "Застосувати",
    completedVisits: "Завершені візити",
    netServiceRevenue: "Чиста виручка з послуг",
    netProductRevenue: "Чиста виручка з товарів",
    consumableCost: "Вартість матеріалів",
    netRetailProductProfit: "Чистий прибуток з товарів",
    criticalForecast: "Критичний прогноз",
    visits: "Візити",
    netProductProfit: "Чистий прибуток з товарів",
    revenueProfitByDay: "Чиста виручка / прибуток по днях",
    topConsumables: "Топ витратних матеріалів",
    byMaterialCost: "за вартістю матеріалів",
    noConsumablesYet: "Витратних матеріалів ще немає",
    notTracked: "не відстежується",
    lowStockForecast: "Прогноз низького складу",
    visitsLeft: "візитів залишилось",
    noForecastData: "Немає даних для прогнозу",
    attentionNeeded: "Потребує уваги",
    signals: "сигналів",
    noSignals: "За цей період немає термінових бізнес-сигналів.",
    businessReportType: "Тип бізнес-звіту",
    todaysAppointments: "Записи на сьогодні",
    createAppointment: "Створити запис",
    time: "Час",
    client: "Клієнт",
    service: "Послуга",
    employee: "Працівник",
    status: "Статус",
    noAppointmentsToday: "На сьогодні записів немає",
    restockSuggestions: "Рекомендації поповнення",
    product: "Товар",
    stock: "Склад",
    minimum: "Мінімум",
    buy: "Купити",
    packs: "уп.",
    checkStock: "перевірити склад",
    stockHealthy: "Склад у нормі",
    consumableAnalytics: "Аналітика расходників",
    used: "Використано",
    appointments: "Записи",
    currentStock: "Поточний склад",
    appointmentCount: "записів",
    noWriteOffsYet: "Списань ще немає",
    recentWriteOffs: "Останні списання",
    noData: "Немає даних",
    completeAppointmentHint: "Завершіть запис із расходниками, щоб побачити списання тут.",
    materialPressureByService: "Навантаження матеріалів по послугах",
    procedureProductForecast: "Прогноз товарів для процедур",
    productSales: "Продажі товарів",
    brandPerformance: "Ефективність брендів",
    employeePerformance: "Ефективність працівників",
    category: "Категорія",
    units: "Одиниці",
    averageVisit: "Середнє / візит",
    stockForecast: "Прогноз складу",
    cost: "Вартість",
    noMaterialWriteOffs: "Списань матеріалів немає",
    noProcedureUsage: "Використання товарів у процедурах ще немає",
    noProductSales: "Продажів товарів немає",
    noEmployeePerformance: "Даних по працівниках ще немає",
    noCompletedServices: "Завершених послуг немає",
    avgNetProfit: "Сер. чистий прибуток",
    stockNotTracked: "склад не відстежується",
    noComparison: "немає порівняння",
    vsPrevious: "до попереднього періоду",
    noDailyData: "За цей період немає денних даних.",
    netRevenue: "Чиста виручка",
    netProfit: "Чистий прибуток"
  }
} satisfies Record<CrmLanguage, Record<string, string>>;

type DashboardCopy = (typeof dashboardCopy)[CrmLanguage];

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
  const language = useCrmLanguage();
  const copy = dashboardCopy[language];
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
      setBusinessAnalyticsError(error instanceof Error ? error.message : copy.requestFailed);
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
    { id: "service", label: copy.netServiceProfit },
    { id: "materials", label: copy.materials },
    { id: "forecast", label: copy.forecast },
    { id: "products", label: copy.products },
    { id: "brands", label: copy.brands },
    { id: "employees", label: copy.employees }
  ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-metrics" aria-label={copy.dashboardOverview}>
        <MetricCard label={copy.appointmentsToday} value={String(dashboard.todayAppointments)} note={copy.recordsFromPostgres} />
        <MetricCard label={copy.dailyNetRevenue} value={adminMoney.format(dashboard.dailyRevenue)} note={copy.paidRefundedNote} />
        <MetricCard
          label={copy.nextAppointment}
          value={dashboard.nextAppointment?.time ?? "-"}
          note={dashboard.nextAppointment ? `${dashboard.nextAppointment.client}, ${dashboard.nextAppointment.service}` : copy.noUpcomingAppointments}
        />
        <MetricCard label={copy.lowStock} value={String(dashboard.lowStockProducts)} note={copy.productsNeedRestocking} />
        <MetricCard label={copy.consumablesUsed} value={formatAnalyticsTotals(analytics)} note={`${analytics.logsCount} ${copy.writeOffs} · ${analytics.periodLabel.toLowerCase()}`} />
        <MetricCard label={copy.lowConsumables} value={String(analytics.lowConsumableProducts)} note={copy.packageAlerts} />
      </section>

      <section className="admin-panel dashboard-analytics-panel">
        <div className="dashboard-panel-heading">
          <div className="dashboard-panel-title">
            <span>{copy.netFinancialReport}</span>
            <h2>{copy.businessAnalytics}</h2>
          </div>
          <div className="dashboard-heading-actions">
            <span>{isBusinessAnalyticsLoading ? copy.loading : visibleBusinessAnalytics.periodLabel}</span>
            <div className="dashboard-export-actions">
              <button className="panel-action icon-button" onClick={() => exportAnalyticsCsv(visibleBusinessAnalytics)} type="button">
                <Download aria-hidden="true" size={15} />
                {copy.analyticsCsv}
              </button>
              <button className="panel-action icon-button" onClick={() => exportAppointmentsCsv(appointments)} type="button">
                <Download aria-hidden="true" size={15} />
                {copy.appointmentsCsv}
              </button>
              <button className="panel-action icon-button" onClick={() => exportInventoryCsv(products, analytics)} type="button">
                <Download aria-hidden="true" size={15} />
                {copy.inventoryCsv}
              </button>
            </div>
          </div>
        </div>

        <div className="analytics-period-toolbar">
          <div className="segmented-control analytics-period-tabs" aria-label={copy.businessAnalytics}>
            <button className={selectedBusinessPeriod === "week" ? "active" : ""} disabled={isBusinessAnalyticsLoading} onClick={() => void loadBusinessAnalytics("week")} type="button">
              {copy.week}
            </button>
            <button className={selectedBusinessPeriod === "month" ? "active" : ""} disabled={isBusinessAnalyticsLoading} onClick={() => void loadBusinessAnalytics("month")} type="button">
              {copy.month}
            </button>
            <button className={selectedBusinessPeriod === "custom" ? "active" : ""} disabled={isBusinessAnalyticsLoading} onClick={() => setSelectedBusinessPeriod("custom")} type="button">
              {copy.custom}
            </button>
          </div>

          {selectedBusinessPeriod === "custom" ? (
            <div className="analytics-custom-range">
              <label>
                <span>{copy.from}</span>
                <input disabled={isBusinessAnalyticsLoading} onChange={(event) => setCustomBusinessFrom(event.target.value)} type="date" value={customBusinessFrom} />
              </label>
              <label>
                <span>{copy.to}</span>
                <input disabled={isBusinessAnalyticsLoading} onChange={(event) => setCustomBusinessTo(event.target.value)} type="date" value={customBusinessTo} />
              </label>
              <button className="panel-action" disabled={isBusinessAnalyticsLoading} onClick={() => void loadBusinessAnalytics("custom")} type="button">
                {copy.apply}
              </button>
            </div>
          ) : null}
        </div>

        {businessAnalyticsError ? <div className="form-error">{businessAnalyticsError}</div> : null}

        <div className="dashboard-insight-grid">
          <article>
            <span>{copy.completedVisits}</span>
            <strong>{completedVisits}</strong>
          </article>
          <article>
            <span>{copy.netServiceRevenue}</span>
            <strong>{formatMoneyRange(serviceRevenueFrom, serviceRevenueTo)}</strong>
          </article>
          <article>
            <span>{copy.netServiceProfit}</span>
            <strong>{formatNullableMoneyRange(serviceProfitFrom, serviceProfitTo)}</strong>
          </article>
          <article>
            <span>{copy.netProductRevenue}</span>
            <strong>{adminMoney.format(productRevenue)}</strong>
          </article>
          <article>
            <span>{copy.consumableCost}</span>
            <strong>{formatNullableMoney(materialCost)}</strong>
          </article>
          <article>
            <span>{copy.netRetailProductProfit}</span>
            <strong>{formatNullableMoney(productProfit)}</strong>
          </article>
          <article>
            <span>{copy.criticalForecast}</span>
            <strong>{criticalProcedureProducts}</strong>
          </article>
        </div>

        <div className="analytics-comparison-grid">
          <ComparisonCard copy={copy} label={copy.visits} metric={visibleBusinessAnalytics.comparison.completedVisits} />
          <ComparisonCard copy={copy} label={copy.netServiceRevenue} metric={visibleBusinessAnalytics.comparison.serviceRevenue} money />
          <ComparisonCard copy={copy} label={copy.netServiceProfit} metric={visibleBusinessAnalytics.comparison.serviceProfit} money />
          <ComparisonCard copy={copy} label={copy.netProductProfit} metric={visibleBusinessAnalytics.comparison.productProfit} money />
        </div>

        <div className="analytics-visual-grid">
          <section className="analytics-chart-card wide">
            <div className="chart-heading">
              <h3>{copy.revenueProfitByDay}</h3>
              <span>{visibleBusinessAnalytics.periodLabel}</span>
            </div>
            <DailyTrendChart copy={copy} items={visibleBusinessAnalytics.dailyTrend} />
          </section>
          <section className="analytics-chart-card">
            <div className="chart-heading">
              <h3>{copy.topConsumables}</h3>
              <span>{copy.byMaterialCost}</span>
            </div>
            <HorizontalBarChart
              emptyLabel={copy.noConsumablesYet}
              items={visibleBusinessAnalytics.procedureProductUsage.slice(0, 5).map((item) => ({
                label: item.productName,
                value: item.consumableCost ?? 0,
                text: item.consumableCost === null ? copy.notTracked : formatHryvnia(item.consumableCost)
              }))}
            />
          </section>
          <section className="analytics-chart-card">
            <div className="chart-heading">
              <h3>{copy.lowStockForecast}</h3>
              <span>{copy.visitsLeft}</span>
            </div>
            <HorizontalBarChart
              emptyLabel={copy.noForecastData}
              invert
              items={visibleBusinessAnalytics.procedureProductUsage
                .filter((item) => item.estimatedProceduresLeft !== null)
                .sort((left, right) => (left.estimatedProceduresLeft ?? 0) - (right.estimatedProceduresLeft ?? 0))
                .slice(0, 5)
                .map((item) => ({
                  label: item.productName,
                  value: item.estimatedProceduresLeft ?? 0,
                  text: `${item.estimatedProceduresLeft} ${copy.visits}`
                }))}
            />
          </section>
        </div>

        <section className="attention-panel">
          <div className="chart-heading">
            <h3>{copy.attentionNeeded}</h3>
            <span>{visibleBusinessAnalytics.attentionItems.length} {copy.signals}</span>
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
              <div className="modal-state">{copy.noSignals}</div>
            )}
          </div>
        </section>

        <div className="dashboard-report-tabs" aria-label={copy.businessReportType}>
          {reportTabs.map((tab) => (
            <button className={activeReport === tab.id ? "active" : ""} key={tab.id} onClick={() => setActiveReport(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </div>

        <section className="dashboard-report-card active">{renderBusinessReport(activeReport, visibleBusinessAnalytics, copy)}</section>
      </section>

      <section className="dashboard-secondary-grid">
        <Panel title={copy.todaysAppointments} action={copy.createAppointment}>
          <DataTable
            columns={[copy.time, copy.client, copy.service, copy.employee, copy.status]}
            rows={
              todayAppointments.length > 0
                ? todayAppointments.map((item) => [item.time, item.client, item.service, item.master, <StatusBadge status={item.status} />])
                : [[copy.noAppointmentsToday, "-", "-", "-", "-"]]
            }
          />
        </Panel>

        <Panel title={copy.restockSuggestions}>
          <DataTable
            columns={[copy.product, copy.stock, copy.minimum, copy.buy]}
            rows={
              visibleBusinessAnalytics.restock.length > 0
                ? visibleBusinessAnalytics.restock.map((item) => [
                    item.categoryName ? `${item.productName} · ${item.categoryName}` : item.productName,
                    formatBusinessStock(item, copy),
                    `${item.minStockQuantity} ${copy.packs}`,
                    item.packagesToBuy > 0 ? `${item.packagesToBuy} ${copy.packs}` : copy.checkStock
                  ])
                : [[copy.stockHealthy, "-", "-", "-"]]
            }
          />
        </Panel>

        <Panel title={copy.consumableAnalytics}>
          <DataTable
            columns={[copy.product, copy.used, copy.appointments, copy.currentStock]}
            rows={
              analytics.products.length > 0
                ? analytics.products.map((item) => [
                    item.productCategory ? `${item.productName} · ${item.productCategory}` : item.productName,
                    `${formatPlainNumber(item.usedQuantity)} ${formatUnit(item.unit)}`,
                    `${item.appointmentCount} ${copy.appointmentCount}`,
                    formatAnalyticsStock(item, copy)
                  ])
                : [[copy.noWriteOffsYet, "-", "-", "-"]]
            }
          />
        </Panel>

        <Panel title={copy.recentWriteOffs}>
          <InfoList
            items={
              analytics.recentLogs.length > 0
                ? analytics.recentLogs.map((log) => [
                    `${formatShortDate(log.createdAt)} · ${log.productName}`,
                    `${formatPlainNumber(log.quantity)} ${formatUnit(log.unit)} · ${log.serviceName} · ${log.clientName}`
                  ])
                : [[copy.noData, copy.completeAppointmentHint]]
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
    ["Net service profit"],
    ["Service", "Completed visits", "Net revenue from", "Net revenue to", "Consumables cost", "Net profit from", "Net profit to"],
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
    ["Service", "Completed visits", "Used ml", "Used gram", "Consumables cost", "Net profit from", "Net profit to"],
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
    ["Category", "Units", "Net revenue", "Net profit"],
    ...analytics.productSalesByCategory.map((item) => [item.name, item.quantity, item.revenue, item.profit]),
    [],
    ["Product sales by brand"],
    ["Brand", "Units", "Net revenue", "Net profit"],
    ...analytics.productSalesByBrand.map((item) => [item.name, item.quantity, item.revenue, item.profit]),
    [],
    ["Employee performance"],
    ["Employee", "Completed visits", "Net revenue from", "Net revenue to", "Consumables cost", "Net profit from", "Net profit to", "Used ml", "Used gram"],
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
      "Net revenue from",
      "Net revenue to",
      "Consumables cost",
      "Net profit from",
      "Net profit to",
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
  copy,
  label,
  metric,
  money
}: {
  copy: DashboardCopy;
  label: string;
  metric: { current: number | null; previous: number | null; changePercent: number | null };
  money?: boolean;
}) {
  const change = metric.changePercent;
  const direction = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";

  return (
    <article className={`comparison-card ${direction}`}>
      <span>{label}</span>
      <strong>{metric.current === null ? copy.notTracked : money ? formatHryvnia(metric.current) : formatPlainNumber(metric.current)}</strong>
      <small>{change === null ? copy.noComparison : `${change > 0 ? "+" : ""}${formatPlainNumber(change)}% ${copy.vsPrevious}`}</small>
    </article>
  );
}

function DailyTrendChart({ copy, items }: { copy: DashboardCopy; items: AdminData["businessAnalytics"]["dailyTrend"] }) {
  const visibleItems = items.filter((item) => item.revenueTo !== 0 || item.profitTo !== null);
  const chartItems = visibleItems.length > 0 ? visibleItems : items.slice(-7);
  const maxValue = Math.max(1, ...chartItems.map((item) => Math.max(Math.abs(item.revenueTo), Math.abs(item.profitTo ?? 0))));

  if (chartItems.length === 0) {
    return <div className="modal-state">{copy.noDailyData}</div>;
  }

  return (
    <div className="daily-trend-chart">
      {chartItems.map((item) => (
        <div className="daily-trend-column" key={item.date}>
          <div className="daily-trend-bars">
            <span
              className={item.revenueTo < 0 ? "revenue negative" : "revenue"}
              style={{ height: `${Math.max(4, (Math.abs(item.revenueTo) / maxValue) * 100)}%` }}
              title={`${copy.netRevenue} ${formatHryvnia(item.revenueTo)}`}
            />
            <span
              className={(item.profitTo ?? 0) < 0 ? "profit negative" : "profit"}
              style={{ height: `${Math.max(4, (Math.abs(item.profitTo ?? 0) / maxValue) * 100)}%` }}
              title={`${copy.netProfit} ${item.profitTo === null ? copy.notTracked : formatHryvnia(item.profitTo)}`}
            />
          </div>
          <small>{formatChartDate(item.date)}</small>
        </div>
      ))}
      <div className="chart-legend">
        <span className="revenue">{copy.netRevenue}</span>
        <span className="profit">{copy.netProfit}</span>
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

function renderBusinessReport(report: "service" | "materials" | "forecast" | "products" | "brands" | "employees", analytics: AdminData["businessAnalytics"], copy: DashboardCopy) {
  if (report === "materials") {
    return (
      <>
        <h3>{copy.materialPressureByService}</h3>
        <DataTable
          columns={[copy.service, copy.visits, copy.used, copy.consumableCost, copy.netServiceProfit]}
          rows={
            analytics.materialUsageByService.length > 0
              ? analytics.materialUsageByService.map((item) => [
                  item.serviceName,
                  `${item.appointmentCount} ${copy.visits}`,
                  formatMaterialUsage(item.usedMl, item.usedGram),
                  formatNullableMoney(item.consumableCost, copy),
                  formatNullableMoneyRange(item.profitFrom, item.profitTo, copy)
                ])
              : [[copy.noMaterialWriteOffs, "-", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "forecast") {
    return (
      <>
        <h3>{copy.procedureProductForecast}</h3>
        <DataTable
          columns={[copy.product, copy.used, copy.cost, copy.averageVisit, copy.stockForecast]}
          rows={
            analytics.procedureProductUsage.length > 0
              ? analytics.procedureProductUsage.map((item) => [
                  item.categoryName ? `${item.productName} · ${item.categoryName}` : item.productName,
                  `${formatPlainNumber(item.usedQuantity)} ${formatUnit(item.unit)} · ${item.appointmentCount} ${copy.visits}`,
                  formatNullableMoney(item.consumableCost, copy),
                  item.averagePerAppointment === null ? copy.notTracked : `${formatPlainNumber(item.averagePerAppointment)} ${formatUnit(item.unit)}`,
                  formatProcedureForecast(item, copy)
                ])
              : [[copy.noProcedureUsage, "-", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "products") {
    return (
      <>
        <h3>{copy.productSales}</h3>
        <DataTable
          columns={[copy.category, copy.units, copy.netProductRevenue, copy.netProductProfit]}
          rows={
            analytics.productSalesByCategory.length > 0
              ? analytics.productSalesByCategory.map((item) => [item.name, String(item.quantity), adminMoney.format(item.revenue), formatNullableMoney(item.profit, copy)])
              : [[copy.noProductSales, "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "brands") {
    return (
      <>
        <h3>{copy.brandPerformance}</h3>
        <DataTable
          columns={[copy.brands, copy.units, copy.netProductRevenue, copy.netProductProfit]}
          rows={
            analytics.productSalesByBrand.length > 0
              ? analytics.productSalesByBrand.map((item) => [item.name, String(item.quantity), adminMoney.format(item.revenue), formatNullableMoney(item.profit, copy)])
              : [[copy.noProductSales, "-", "-", "-"]]
          }
        />
      </>
    );
  }

  if (report === "employees") {
    return (
      <>
        <h3>{copy.employeePerformance}</h3>
        <DataTable
          columns={[copy.employee, copy.visits, copy.netServiceRevenue, copy.consumableCost, copy.avgNetProfit, copy.materials]}
          rows={
            analytics.employeePerformance.length > 0
              ? analytics.employeePerformance.map((item) => [
                  item.employeeName,
                  `${item.completedVisits} ${copy.visits}`,
                  formatMoneyRange(item.revenueFrom, item.revenueTo),
                  formatNullableMoney(item.consumableCost, copy),
                  formatNullableMoneyRange(item.averageProfitFrom, item.averageProfitTo, copy),
                  formatMaterialUsage(item.usedMl, item.usedGram)
                ])
              : [[copy.noEmployeePerformance, "-", "-", "-", "-", "-"]]
          }
        />
      </>
    );
  }

  return (
    <>
      <h3>{copy.netServiceProfit}</h3>
      <DataTable
        columns={[copy.service, copy.visits, copy.netServiceRevenue, copy.consumableCost, copy.netServiceProfit]}
        rows={
          analytics.services.length > 0
            ? analytics.services.map((item) => [
                item.serviceName,
                `${item.appointmentCount} ${copy.visits}`,
                formatMoneyRange(item.revenueFrom, item.revenueTo),
                formatNullableMoney(item.consumableCost, copy),
                formatNullableMoneyRange(item.profitFrom, item.profitTo, copy)
              ])
            : [[copy.noCompletedServices, "-", "-", "-", "-"]]
        }
      />
    </>
  );
}

function formatMoneyRange(from: number, to: number) {
  return from === to ? formatHryvnia(from) : `${plainHryvnia.format(from)} - ${plainHryvnia.format(to)} ₴`;
}

function formatNullableMoney(value: number | null, copy: DashboardCopy = dashboardCopy.en) {
  return value === null ? copy.notTracked : formatHryvnia(value);
}

function formatNullableMoneyRange(from: number | null, to: number | null, copy: DashboardCopy = dashboardCopy.en) {
  return from === null || to === null ? copy.notTracked : formatMoneyRange(from, to);
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

function formatAnalyticsStock(item: AdminData["consumableAnalytics"]["products"][number], copy: DashboardCopy = dashboardCopy.en) {
  if (item.stockContentAmount !== null && item.stockPackageEquivalent !== null) {
    return `${formatPlainNumber(item.stockPackageEquivalent)} ${copy.packs} · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.unit)}`;
  }

  return copy.notTracked;
}

function formatBusinessStock(item: AdminData["businessAnalytics"]["restock"][number], copy: DashboardCopy = dashboardCopy.en) {
  if (item.stockContentAmount !== null && item.stockPackageEquivalent !== null && item.contentUnit !== null) {
    return `${formatPlainNumber(item.stockPackageEquivalent)} ${copy.packs} · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.contentUnit)}`;
  }

  return `${item.stockQuantity} ${copy.packs}`;
}

function formatProcedureForecast(item: AdminData["businessAnalytics"]["procedureProductUsage"][number], copy: DashboardCopy = dashboardCopy.en) {
  const stock =
    item.stockContentAmount !== null && item.stockPackageEquivalent !== null
      ? `${formatPlainNumber(item.stockPackageEquivalent)} ${copy.packs} · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.unit)}`
      : copy.stockNotTracked;

  if (item.estimatedProceduresLeft === null) {
    return stock;
  }

  return `${item.estimatedProceduresLeft} ${copy.visitsLeft} · ${stock}`;
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
