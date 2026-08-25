import { Search, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { updateAdminStoreOrder, type AdminData, type StoreOrderStatus } from "../../api";
import { AdminModal, DataTable, Panel, StatusBadge } from "../../components/admin-ui";
import { useCrmT } from "../../crm-i18n";
import { adminMoney } from "../../utils/format";

const nextStatuses: Record<StoreOrderStatus, StoreOrderStatus[]> = { pending: ["confirmed", "cancelled"], confirmed: ["processing", "cancelled"], processing: ["shipped", "cancelled"], shipped: ["completed"], completed: [], cancelled: [] };

export function StoreOrdersSection({ orders, runAction }: { orders: AdminData["storeOrders"]; runAction: (action: () => Promise<unknown>) => Promise<void> }) {
  const t = useCrmT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | StoreOrderStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const labels: Record<StoreOrderStatus, string> = {
    pending: t("orderStatusNew"),
    confirmed: t("orderStatusConfirmed"),
    processing: t("orderStatusProcessing"),
    shipped: t("orderStatusShipped"),
    completed: t("orderStatusCompleted"),
    cancelled: t("orderStatusCancelled")
  };
  const paymentLabels: Record<string, string> = {
    pending: t("paymentPending"),
    paid: t("paymentPaid"),
    failed: t("paymentFailed"),
    refunded: t("paymentRefunded")
  };
  const filtered = useMemo(() => orders.filter((order) => {
    const search = `${order.id} ${order.customer.firstName} ${order.customer.lastName} ${order.customer.phone} ${order.items.map((item) => item.productName).join(" ")}`.toLowerCase();
    return (status === "all" || order.status === status) && search.includes(query.trim().toLowerCase());
  }), [orders, query, status]);

  return <div className="admin-grid"><Panel title={t("storeOrders")} wide><div className="inventory-summary-grid"><article><span>{t("allOrders")}</span><strong>{orders.length}</strong><small>{orders.filter((order) => order.status === "pending").length} {t("requireAttention")}</small></article><article><span>{t("paid")}</span><strong>{orders.filter((order) => order.paymentStatus === "paid").length}</strong><small>{t("confirmedByPaymentProvider")}</small></article><article><span>{t("inProgress")}</span><strong>{orders.filter((order) => ["confirmed", "processing", "shipped"].includes(order.status)).length}</strong><small>{t("confirmedAndFulfilment")}</small></article><article><span>{t("orderValue")}</span><strong>{adminMoney.format(orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.totalAmount, 0))}</strong><small>{t("excludingCancelled")}</small></article></div><div className="table-toolbar"><label><span>{t("search")}</span><div className="admin-search table-search"><Search size={17} /><input placeholder={t("orderClientPhoneProduct")} value={query} onChange={(event) => setQuery(event.target.value)} /></div></label><label><span>{t("status")}</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">{t("allStatuses")}</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><DataTable columns={[t("order"), t("date"), t("customer"), t("items"), t("delivery"), t("total"), t("payment"), t("status"), t("actions")]} rows={filtered.length ? filtered.map((order) => [<button className="table-link-button" onClick={() => setSelectedId(order.id)}>#{order.id}</button>, new Date(order.createdAt).toLocaleString("en-GB"), `${order.customer.firstName} ${order.customer.lastName}\n${order.customer.phone}`, order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", "), order.deliveryMethod === "pickup" ? t("pickup") : order.deliveryAddress || t("delivery"), adminMoney.format(order.totalAmount), <StatusBadge status={order.paymentStatus} />, <StatusBadge status={order.status} />, <button className="secondary-button compact-button" onClick={() => setSelectedId(order.id)}>{t("details")}</button>]) : [[t("noMatchingOrders"), "-", "-", "-", "-", "-", "-", "-", "-"]]} /></Panel>
    {selected ? <AdminModal title={`${t("storeOrders")} #${selected.id}`} onClose={() => setSelectedId(null)}><div className="store-order-details"><div className="store-order-detail-head"><span><StatusBadge status={selected.status} /> <StatusBadge status={selected.paymentStatus} /></span><span>{new Date(selected.createdAt).toLocaleString("en-GB")}</span></div><dl className="info-list"><div><dt>{t("customer")}</dt><dd>{selected.customer.firstName} {selected.customer.lastName}</dd></div><div><dt>{t("phone")}</dt><dd>{selected.customer.phone}</dd></div><div><dt>{t("email")}</dt><dd>{selected.customer.email || "-"}</dd></div><div><dt>{t("delivery")}</dt><dd>{selected.deliveryMethod === "pickup" ? t("pickupFromSalon") : selected.deliveryAddress || t("delivery")}</dd></div><div><dt>{t("payment")}</dt><dd>{paymentLabels[selected.paymentStatus] ?? selected.paymentStatus}{selected.paidAt ? ` · ${new Date(selected.paidAt).toLocaleString("en-GB")}` : ""}</dd></div><div><dt>{t("invoice")}</dt><dd>{selected.monobankInvoiceId || "-"}</dd></div><div><dt>{t("paymentIssue")}</dt><dd>{selected.paymentError || "-"}</dd></div><div><dt>{t("comment")}</dt><dd>{selected.comment || "-"}</dd></div></dl><div className="store-order-items"><h3>{t("products")}</h3>{selected.items.map((item) => <div key={item.id}><span><ShoppingBag size={15} /> {item.productName} × {item.quantity}</span><strong>{adminMoney.format(item.unitPrice * item.quantity)}</strong></div>)}<div><strong>{t("total")}</strong><strong>{adminMoney.format(selected.totalAmount)}</strong></div></div><div className="store-order-stock"><span>{t("stockDeducted")}: {selected.stockDeductedAt ? new Date(selected.stockDeductedAt).toLocaleString("en-GB") : t("no")}</span><span>{t("stockRestored")}: {selected.stockRestoredAt ? new Date(selected.stockRestoredAt).toLocaleString("en-GB") : t("no")}</span></div>{nextStatuses[selected.status].length ? <div className="modal-actions">{nextStatuses[selected.status].map((next) => <button className={next === "cancelled" ? "secondary-button" : "primary-button"} key={next} onClick={() => void runAction(async () => { await updateAdminStoreOrder(selected.id, next); setSelectedId(null); })}>{labels[next]}</button>)}</div> : null}</div></AdminModal> : null}
  </div>;
}
