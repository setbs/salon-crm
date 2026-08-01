import { ArrowRight, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  createAdminAppointment,
  fetchAppointmentConsumablePreview,
  rescheduleAdminAppointment,
  updateAdminAppointment,
  updateAdminAppointmentComment,
  type AdminAppointmentInput,
  type AdminData,
  type AppointmentConsumablePreview,
  type MeasurementUnit,
  type Slot
} from "../../api";
import { AdminModal, DataTable, InfoList, InlineActions, Panel, StatusBadge } from "../../components/admin-ui";
import { adminMoney, formatPlainNumber, formatUnit, plainHryvnia } from "../../utils/format";

type DisplayPrice = {
  price: number;
  priceFrom?: number | null;
  priceTo?: number | null;
};

type SuggestedSlot = {
  date: string;
  slot: Slot;
};

type SuggestedDay = {
  date: string;
  firstSlot: Slot;
  slotCount: number;
};

const today = new Date().toISOString().slice(0, 10);

function formatHryvnia(value: number) {
  return `${plainHryvnia.format(value)} ₴`;
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

function roundDisplayMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatServicePrice(value: DisplayPrice) {
  if (value.priceFrom !== null && value.priceFrom !== undefined && value.priceTo !== null && value.priceTo !== undefined) {
    return `${plainHryvnia.format(value.priceFrom)} - ${plainHryvnia.format(value.priceTo)} ₴`;
  }

  if (value.priceFrom !== null && value.priceFrom !== undefined) {
    return `from ${formatHryvnia(value.priceFrom)}`;
  }

  if (value.priceTo !== null && value.priceTo !== undefined) {
    return `up to ${formatHryvnia(value.priceTo)}`;
  }

  return formatHryvnia(value.price);
}

function toIsoDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function toDateTimeFields(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

  return {
    date: localDate,
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  };
}

function canUseProductInProcedure(product: { purpose?: "sale" | "procedure" | "both" }) {
  return !product.purpose || product.purpose === "procedure" || product.purpose === "both";
}

function getAppointmentClientRevenueRange(appointment: AdminData["appointments"][number]) {
  if (appointment.amount > 0 && appointment.paymentStatus === "paid") {
    return { from: appointment.amount, to: appointment.amount };
  }

  return { from: appointment.revenueFrom, to: appointment.revenueTo };
}

function getAppointmentClientProfitRange(appointment: AdminData["appointments"][number]) {
  if (appointment.consumableCost === null) {
    return { from: null, to: null };
  }

  const revenue = getAppointmentClientRevenueRange(appointment);
  return {
    from: revenue.from - appointment.consumableCost,
    to: revenue.to - appointment.consumableCost
  };
}

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPreviewStock(item: AppointmentConsumablePreview["items"][number]) {
  if (item.stockAfter === null) {
    return "not tracked";
  }

  const packagePart = item.packageEquivalentAfter !== null ? `${formatPlainNumber(item.packageEquivalentAfter)} packs · ` : "";
  return `${packagePart}${formatPlainNumber(item.stockAfter)} ${formatUnit(item.unit)}`;
}

function formatAppointmentDateTimeRange(appointment: AdminData["appointments"][number]) {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(appointment.date));
  const start = toDateTimeFields(appointment.date).time;
  const end = toDateTimeFields(appointment.endDate).time;

  return `${date}, ${start} - ${end}`;
}

function toLocalDateKey(value: string) {
  return toDateTimeFields(value).date;
}

function getWeekStartDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - dayOfWeek + 1);

  return [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatCalendarWeekday(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long"
  }).format(new Date(`${value}T00:00:00`));
}

function buildCalendarGroups(appointments: AdminData["appointments"], startDate: string, endDate: string) {
  const appointmentsByDate = new Map<string, AdminData["appointments"]>();

  for (const appointment of appointments) {
    const date = toLocalDateKey(appointment.date);
    appointmentsByDate.set(date, [...(appointmentsByDate.get(date) ?? []), appointment]);
  }

  const groups: Array<{ date: string; appointments: AdminData["appointments"] }> = [];

  for (let date = startDate; date <= endDate; date = addDaysToDateString(date, 1)) {
    groups.push({
      date,
      appointments: appointmentsByDate.get(date) ?? []
    });
  }

  return groups;
}
export function CalendarSection({
  appointments,
  clients,
  employees,
  products,
  services,
  runAction
}: {
  appointments: AdminData["appointments"];
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  services: AdminData["services"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [calendarView, setCalendarView] = useState<"day" | "week">("day");
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(today);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [reschedulingAppointmentId, setReschedulingAppointmentId] = useState<string | null>(null);
  const [commentingAppointmentId, setCommentingAppointmentId] = useState<string | null>(null);
  const [isCompletionOpen, setIsCompletionOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [completionPreview, setCompletionPreview] = useState<AppointmentConsumablePreview | null>(null);
  const selectedAppointment = appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null;
  const reschedulingAppointment = appointments.find((appointment) => appointment.id === reschedulingAppointmentId) ?? null;
  const commentingAppointment = appointments.find((appointment) => appointment.id === commentingAppointmentId) ?? null;
  const rangeStart = calendarView === "week" ? getWeekStartDateString(calendarAnchorDate) : calendarAnchorDate;
  const rangeEnd = addDaysToDateString(rangeStart, calendarView === "week" ? 6 : 0);
  const visibleAppointments = appointments
    .filter((appointment) => {
      const appointmentDate = toLocalDateKey(appointment.date);
      const matchesDate = appointmentDate >= rangeStart && appointmentDate <= rangeEnd;
      const matchesEmployee = employeeFilter === "all" || appointment.employeeId === employeeFilter;
      const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;

      return matchesDate && matchesEmployee && matchesStatus;
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const groupedAppointments = buildCalendarGroups(visibleAppointments, rangeStart, rangeEnd);
  const periodLabel = calendarView === "week" ? `${formatCalendarDate(rangeStart)} - ${formatCalendarDate(rangeEnd)}` : formatCalendarDate(rangeStart);
  const scheduledCount = visibleAppointments.filter((appointment) => appointment.status === "scheduled").length;

  useEffect(() => {
    if (selectedAppointmentId && !appointments.some((appointment) => appointment.id === selectedAppointmentId)) {
      setSelectedAppointmentId(null);
    }
  }, [appointments, selectedAppointmentId]);

  async function openCompletionPreview(appointmentId: string) {
    setIsCompletionOpen(true);
    setIsPreviewLoading(true);
    setPreviewError("");
    setCompletionPreview(null);

    try {
      setCompletionPreview(await fetchAppointmentConsumablePreview(appointmentId));
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Could not load consumable preview.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function closeCompletionPreview() {
    setIsCompletionOpen(false);
    setCompletionPreview(null);
    setPreviewError("");
  }

  function selectQuickDate(nextView: "day" | "week", date: string) {
    setCalendarView(nextView);
    setCalendarAnchorDate(date);
  }

  function renderAppointmentActions(item: AdminData["appointments"][number]) {
    return (
      <InlineActions
        labels={
          item.status === "scheduled"
            ? ["Details", "Complete", "Reschedule", "Comment", "No-show", "Cancel"]
            : item.status === "completed"
              ? ["Details", "Edit completion", "Comment"]
              : ["Details", "Comment"]
        }
        onAction={(label) => {
          if (label === "Details") {
            setSelectedAppointmentId(item.id);
            return;
          }

          if (label === "Complete" || label === "Edit completion") {
            void openCompletionPreview(item.id);
            return;
          }

          if (label === "Reschedule") {
            setReschedulingAppointmentId(item.id);
            return;
          }

          if (label === "Comment") {
            setCommentingAppointmentId(item.id);
            return;
          }

          void runAction(() =>
            updateAdminAppointment(item.id, {
              status: label === "No-show" ? "no_show" : "cancelled"
            })
          );
        }}
      />
    );
  }

  return (
    <div className="admin-grid">
      <Panel title="Calendar" action="Create appointment manually" onAction={() => setIsCreatingAppointment(true)} wide>
        <div className="calendar-toolbar">
          <div className="segmented-control calendar-view-toggle" aria-label="Calendar view">
            <button className={calendarView === "day" ? "active" : ""} onClick={() => setCalendarView("day")} type="button">
              Day
            </button>
            <button className={calendarView === "week" ? "active" : ""} onClick={() => setCalendarView("week")} type="button">
              Week
            </button>
          </div>
          <div className="calendar-shortcuts" aria-label="Calendar shortcuts">
            <button onClick={() => selectQuickDate("day", today)} type="button">
              Today
            </button>
            <button onClick={() => selectQuickDate("day", addDaysToDateString(today, 1))} type="button">
              Tomorrow
            </button>
            <button onClick={() => selectQuickDate("week", today)} type="button">
              This week
            </button>
          </div>
          <div className="calendar-filter-grid">
            <label>
              <span>Date</span>
              <input type="date" value={calendarAnchorDate} onChange={(event) => setCalendarAnchorDate(event.target.value)} />
            </label>
            <label>
              <span>Employee</span>
              <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
                <option value="all">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No-show</option>
              </select>
            </label>
          </div>
        </div>

        <div className="calendar-summary-strip">
          <div>
            <span>Period</span>
            <strong>{periodLabel}</strong>
          </div>
          <div>
            <span>Appointments</span>
            <strong>{visibleAppointments.length}</strong>
          </div>
          <div>
            <span>Scheduled</span>
            <strong>{scheduledCount}</strong>
          </div>
        </div>

        <div className="calendar-day-groups">
          {groupedAppointments.map((group) => (
            <section className="calendar-day-group" key={group.date}>
              <header className="calendar-day-header">
                <div>
                  <span>{formatCalendarWeekday(group.date)}</span>
                  <strong>{formatCalendarDate(group.date)}</strong>
                </div>
                <small>{group.appointments.length} appointments</small>
              </header>
              {group.appointments.length > 0 ? (
                <DataTable
                  columns={["Time", "Client", "Service", "Employee", "Comment", "Actions", "Status"]}
                  rows={group.appointments.map((item) => [
                    <button className="appointment-open-button" onClick={() => setSelectedAppointmentId(item.id)} type="button">
                      {item.time}
                    </button>,
                    item.client,
                    item.service,
                    item.master,
                    item.comment || "-",
                    renderAppointmentActions(item),
                    <StatusBadge status={item.status} />
                  ])}
                />
              ) : (
                <div className="empty-state">No appointments match these filters.</div>
              )}
            </section>
          ))}
        </div>
      </Panel>
      {selectedAppointment ? (
        <AppointmentDetailsDialog
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointmentId(null)}
          onComment={() => {
            setSelectedAppointmentId(null);
            setCommentingAppointmentId(selectedAppointment.id);
          }}
          onComplete={() => {
            setSelectedAppointmentId(null);
            void openCompletionPreview(selectedAppointment.id);
          }}
          onReschedule={() => {
            setSelectedAppointmentId(null);
            setReschedulingAppointmentId(selectedAppointment.id);
          }}
          onStatusChange={(status) =>
            runAction(async () => {
              await updateAdminAppointment(selectedAppointment.id, { status });
            })
          }
          onPaymentStatusChange={(paymentStatus) =>
            runAction(() =>
              updateAdminAppointment(selectedAppointment.id, {
                paymentStatus,
                paymentAmount: selectedAppointment.amount > 0 ? selectedAppointment.amount : selectedAppointment.revenueTo,
                paymentMethod: selectedAppointment.paymentMethod
              })
            )
          }
        />
      ) : null}
      {isCreatingAppointment ? (
        <AdminModal title="New appointment" onClose={() => setIsCreatingAppointment(false)}>
          <AppointmentCreateForm
            clients={clients}
            employees={employees}
            onCancel={() => setIsCreatingAppointment(false)}
            services={services}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminAppointment(payload);
                setIsCreatingAppointment(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {reschedulingAppointment ? (
        <AdminModal title="Reschedule appointment" onClose={() => setReschedulingAppointmentId(null)}>
          <AppointmentRescheduleForm
            appointments={appointments}
            initialAppointmentId={reschedulingAppointment.id}
            key={reschedulingAppointment.id}
            onCancel={() => setReschedulingAppointmentId(null)}
            onSubmit={(id, payload) =>
              runAction(async () => {
                await rescheduleAdminAppointment(id, payload);
                setReschedulingAppointmentId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {commentingAppointment ? (
        <AdminModal title="Visit comment" onClose={() => setCommentingAppointmentId(null)}>
          <AppointmentCommentForm
            appointments={appointments}
            initialAppointmentId={commentingAppointment.id}
            key={commentingAppointment.id}
            onCancel={() => setCommentingAppointmentId(null)}
            onSubmit={(id, employeeComment) =>
              runAction(async () => {
                await updateAdminAppointmentComment(id, { employeeComment });
                setCommentingAppointmentId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCompletionOpen ? (
        <CompletionPreviewDialog
          error={previewError}
          isLoading={isPreviewLoading}
          onClose={closeCompletionPreview}
          onConfirm={(appointmentId, payload) =>
            runAction(async () => {
              await updateAdminAppointment(appointmentId, { status: "completed", ...payload });
              closeCompletionPreview();
            })
          }
          preview={completionPreview}
          products={products}
        />
      ) : null}
    </div>
  );
}

function AppointmentDetailsDialog({
  appointment,
  onClose,
  onComment,
  onComplete,
  onPaymentStatusChange,
  onReschedule,
  onStatusChange
}: {
  appointment: AdminData["appointments"][number];
  onClose: () => void;
  onComment: () => void;
  onComplete: () => void;
  onPaymentStatusChange: (status: "pending" | "paid" | "refunded") => Promise<void>;
  onReschedule: () => void;
  onStatusChange: (status: "cancelled" | "no_show") => Promise<void>;
}) {
  const isScheduled = appointment.status === "scheduled";
  const clientRevenue = getAppointmentClientRevenueRange(appointment);
  const clientProfit = getAppointmentClientProfitRange(appointment);
  const serviceRows =
    appointment.services.length > 0
      ? appointment.services
      : [
          {
            id: "summary",
            name: appointment.service || "Service",
            duration: appointment.durationMinutes,
            price: appointment.amount,
            priceFrom: null,
            priceTo: null
          }
        ];

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section aria-modal="true" className="admin-modal appointment-detail-modal" role="dialog">
        <div className="panel-header">
          <div>
            <p className="admin-kicker">Appointment details</p>
            <h2>{appointment.client}</h2>
          </div>
          <button aria-label="Close appointment details" className="icon-only-button" onClick={onClose} title="Close" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="appointment-detail">
          <section className="appointment-detail-hero">
            <div>
              <span>{formatAppointmentDateTimeRange(appointment)}</span>
              <strong>{appointment.service || "Appointment"}</strong>
              <small>{appointment.master}</small>
            </div>
            <StatusBadge status={appointment.status} />
          </section>

          <div className="appointment-status-panel">
            <div>
              <span>Visit status</span>
              <StatusBadge status={appointment.status} />
            </div>
            <div>
              <span>Payment status</span>
              <div className="status-button-row" aria-label="Payment status">
                {(["pending", "paid", "refunded"] as const).map((status) => (
                  <button
                    className={appointment.paymentStatus === status ? "active" : ""}
                    key={status}
                    onClick={() => void onPaymentStatusChange(status)}
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="appointment-detail-grid">
            <InfoList
              items={[
                ["Phone", appointment.clientPhone || "-"],
                ["Email", appointment.clientEmail || "-"],
                ["Employee", appointment.master],
                ["Duration", `${appointment.durationMinutes} min`],
                ["Total", appointment.amount > 0 ? adminMoney.format(appointment.amount) : formatMoneyRange(appointment.revenueFrom, appointment.revenueTo)],
                ["Payment", appointment.paymentStatus],
                ["Rating", appointment.rating ? `${appointment.rating}/5` : "-"]
              ]}
            />

            <section className="appointment-service-detail">
              <div className="profile-section-heading">
                <h3>Services</h3>
                <span>{serviceRows.length} selected</span>
              </div>
              <div className="appointment-service-detail-list">
                {serviceRows.map((service) => (
                  <article className="appointment-service-detail-item" key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>{service.duration} min</span>
                    </div>
                    <small>{formatServicePrice(service)}</small>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="appointment-finance-card">
            <div className="profile-section-heading">
              <h3>Procedure finances</h3>
              <span>{appointment.paymentStatus}</span>
            </div>
            <div className="appointment-finance-metrics">
              <div>
                <span>Services total</span>
                <strong>{formatMoneyRange(appointment.revenueFrom, appointment.revenueTo)}</strong>
              </div>
              <div>
                <span>Client paid</span>
                <strong>{formatMoneyRange(clientRevenue.from, clientRevenue.to)}</strong>
              </div>
              <div>
                <span>Consumables</span>
                <strong>{formatNullableMoney(appointment.consumableCost)}</strong>
              </div>
              <div>
                <span>Net profit</span>
                <strong>{formatNullableMoneyRange(clientProfit.from, clientProfit.to)}</strong>
              </div>
            </div>
            <InfoList
              items={[
                ["Payment method", appointment.paymentMethod],
                ["Payment status", appointment.paymentStatus],
                ["Amount source", appointment.amount > 0 ? "actual payment" : "service price estimate"]
              ]}
            />
          </section>

          <section className="appointment-audit-card">
            <div className="profile-section-heading">
              <h3>Change history</h3>
              <span>{appointment.auditLogs.length} events</span>
            </div>
            {appointment.auditLogs.length > 0 ? (
              <div className="appointment-audit-list">
                {appointment.auditLogs.map((log) => (
                  <article key={log.id}>
                    <div>
                      <strong>{log.summary}</strong>
                      <span>{log.actor} · {formatShortDate(log.createdAt)}</span>
                    </div>
                    <StatusBadge status={log.eventType} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="modal-state">No changes have been recorded yet.</div>
            )}
          </section>

          <div className="appointment-comment-grid">
            <article>
              <span>Client comment</span>
              <p>{appointment.clientComment || "No client comment."}</p>
            </article>
            <article>
              <span>Internal comment</span>
              <p>{appointment.employeeComment || "No internal comment."}</p>
            </article>
          </div>
        </div>

        <div className="modal-actions appointment-detail-actions">
          <button className="secondary-button compact-button" onClick={onClose} type="button">
            Close
          </button>
          <button className="secondary-button compact-button" onClick={onComment} type="button">
            Comment
          </button>
          {isScheduled ? (
            <>
              <button className="secondary-button compact-button" onClick={onReschedule} type="button">
                Reschedule
              </button>
              <button className="secondary-button compact-button" onClick={() => void onStatusChange("no_show")} type="button">
                No-show
              </button>
              <button className="secondary-button compact-button" onClick={() => void onStatusChange("cancelled")} type="button">
                Cancel
              </button>
              <button className="primary-button compact-button" onClick={onComplete} type="button">
                Complete
              </button>
            </>
          ) : appointment.status === "completed" ? (
            <button className="primary-button compact-button" onClick={onComplete} type="button">
              Edit completion
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function CompletionPreviewDialog({
  error,
  isLoading,
  onClose,
  onConfirm,
  preview,
  products
}: {
  error: string;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (
    appointmentId: string,
    payload: {
      paymentAmount: number;
      paymentMethod: "cash" | "card" | "blik" | "transfer";
      consumables: Array<{ productId: string; quantity: number; unit: MeasurementUnit }>;
    }
  ) => Promise<void>;
  preview: AppointmentConsumablePreview | null;
  products: AdminData["products"];
}) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "blik" | "transfer">("cash");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [extraConsumables, setExtraConsumables] = useState<Array<{ id: string; productId: string; quantity: string }>>([]);
  const [newConsumable, setNewConsumable] = useState({ productId: "", quantity: "" });

  useEffect(() => {
    if (!preview) {
      return;
    }

    setPaymentAmount(String(preview.financials.paymentAmount));
    setPaymentMethod(preview.financials.paymentMethod);
    setQuantities(Object.fromEntries(preview.items.map((item) => [item.productId, String(item.quantity)])));
    setExtraConsumables([]);
    setNewConsumable({ productId: "", quantity: "" });
  }, [preview?.appointment.id]);

  const baseItems =
    preview?.items.map((item) => {
      const quantity = Math.max(0, Number(quantities[item.productId] ?? item.quantity) || 0);
      const stockAfter = item.stockContentAmount !== null ? Math.max(item.stockContentAmount - quantity, 0) : null;
      const packageEquivalentAfter = item.contentAmount && stockAfter !== null ? stockAfter / item.contentAmount : null;
      const hasConfigurationIssue = item.contentAmount === null || item.stockContentAmount === null || Boolean(item.issue && !item.issue.includes("Not enough"));
      const enough = !hasConfigurationIssue && (item.stockContentAmount === null || item.stockContentAmount >= quantity);

      return {
        ...item,
        quantity,
        stockAfter,
        packageEquivalentAfter,
        cost: item.unitCost === null ? null : item.unitCost * quantity,
        enough
      };
    }) ?? [];
  const extraItems = extraConsumables
    .map((extra) => {
      const product = products.find((item) => item.id === extra.productId);

      if (!product) {
        return null;
      }

      const quantity = Math.max(0, Number(extra.quantity) || 0);
      const unit = product.contentUnit ?? "ml";
      const unitCost = product.purchase > 0 && product.contentAmount ? product.purchase / product.contentAmount : null;
      const stockAfter = product.stockContentAmount !== null ? Math.max(product.stockContentAmount - quantity, 0) : null;
      const issue =
        product.contentAmount === null || product.stockContentAmount === null || product.contentUnit === null
          ? `Product ${product.name} does not have package content configured.`
          : product.stockContentAmount < quantity
            ? `Not enough consumable stock for ${product.name}.`
            : null;

      return {
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        services: "Unplanned material",
        quantity,
        unit,
        contentAmount: product.contentAmount,
        unitCost: unitCost === null ? null : roundDisplayMoney(unitCost),
        cost: unitCost === null ? null : unitCost * quantity,
        stockContentAmount: product.stockContentAmount,
        stockAfter,
        packageEquivalentBefore:
          product.contentAmount && product.stockContentAmount !== null ? product.stockContentAmount / product.contentAmount : null,
        packageEquivalentAfter: product.contentAmount && stockAfter !== null ? stockAfter / product.contentAmount : null,
        enough: !issue,
        issue,
        extraId: extra.id
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const actualItems = [...baseItems, ...extraItems];
  const usedProductIds = new Set([...baseItems.map((item) => item.productId), ...extraConsumables.map((item) => item.productId)]);
  const availableExtraProducts = products.filter(
    (product) =>
      canUseProductInProcedure(product) &&
      product.contentAmount !== null &&
      product.contentUnit !== null &&
      product.stockContentAmount !== null &&
      !usedProductIds.has(product.id)
  );
  const actualConsumableCost = actualItems.some((item) => item.cost === null && item.quantity > 0)
    ? null
    : roundDisplayMoney(actualItems.reduce((sum, item) => sum + (item.cost ?? 0), 0));
  const receivedAmount = Math.max(0, Number(paymentAmount) || 0);
  const profitAfterConsumables = actualConsumableCost === null ? null : roundDisplayMoney(receivedAmount - actualConsumableCost);
  const canConfirm = preview ? preview.canComplete && receivedAmount >= 0 && actualItems.every((item) => item.enough) : false;
  const completionMode = preview?.status === "completed" ? "Edit completed appointment" : "Complete appointment";

  function addExtraConsumable() {
    const productId = newConsumable.productId || availableExtraProducts[0]?.id;
    const quantity = Number(newConsumable.quantity);

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    setExtraConsumables((current) => [...current, { id: `${productId}-${Date.now()}`, productId, quantity: String(quantity) }]);
    setNewConsumable({ productId: "", quantity: "" });
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section aria-modal="true" className="admin-modal completion-modal" role="dialog">
        <div className="panel-header">
          <div>
            <p className="admin-kicker">Completion workflow</p>
            <h2>{completionMode}</h2>
          </div>
          <button aria-label="Close completion preview" className="icon-only-button" onClick={onClose} title="Close" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        {isLoading ? <div className="modal-state">Loading consumables...</div> : null}
        {error ? <div className="admin-alert">{error}</div> : null}

        {preview ? (
          <>
            <div className="completion-summary-strip">
              <div>
                <span>Client</span>
                <strong>{preview.appointment.client}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{formatShortDate(preview.appointment.time)}</strong>
              </div>
              <div>
                <span>Services total</span>
                <strong>{formatMoneyRange(preview.financials.revenueFrom, preview.financials.revenueTo)}</strong>
              </div>
            </div>

            {preview.warnings.length > 0 ? (
              <div className="preview-warning-list">
                {preview.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            ) : null}

            <div className="completion-accounting-layout">
              <section className="completion-section">
                <div className="completion-section-heading">
                  <div>
                    <span>Step 1</span>
                    <h3>Actual consumables</h3>
                  </div>
                  <small>{actualItems.length} materials</small>
                </div>
                <div className="consumable-preview-list">
                  {actualItems.length > 0 ? (
                    actualItems.map((item) => (
                      <article className={item.enough ? "consumable-preview-row" : "consumable-preview-row warning"} key={String("extraId" in item ? item.extraId : item.productId)}>
                        <div>
                          <strong>{item.productName}</strong>
                          <span>{item.services}</span>
                        </div>
                        <label className="consumable-quantity-field">
                          <small>actual use</small>
                          <span>
                            <input
                              min="0"
                              step="0.01"
                              type="number"
                              value={"extraId" in item ? extraConsumables.find((extra) => extra.id === item.extraId)?.quantity ?? String(item.quantity) : quantities[item.productId] ?? String(item.quantity)}
                              onChange={(event) => {
                                if ("extraId" in item) {
                                  setExtraConsumables((current) =>
                                    current.map((extra) => (extra.id === item.extraId ? { ...extra, quantity: event.target.value } : extra))
                                  );
                                  return;
                                }

                                setQuantities((current) => ({ ...current, [item.productId]: event.target.value }));
                              }}
                            />
                            {formatUnit(item.unit)}
                          </span>
                        </label>
                        <div>
                          <small>cost</small>
                          <strong>{formatNullableMoney(item.cost === null ? null : roundDisplayMoney(item.cost))}</strong>
                        </div>
                        <div>
                          <small>stock after</small>
                          <strong>{formatPreviewStock(item)}</strong>
                        </div>
                        {"extraId" in item ? (
                          <button
                            aria-label="Remove unplanned material"
                            className="icon-only-button mini"
                            onClick={() => setExtraConsumables((current) => current.filter((extra) => extra.id !== item.extraId))}
                            type="button"
                          >
                            <X aria-hidden="true" size={14} />
                          </button>
                        ) : (
                          <StatusBadge status={item.enough ? "ready" : "blocked"} />
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="modal-state">No internal consumables are configured for this appointment.</div>
                  )}
                </div>
                <div className="completion-add-material">
                  <label>
                    <span>Add unplanned material</span>
                    <select
                      value={newConsumable.productId}
                      onChange={(event) => setNewConsumable((current) => ({ ...current, productId: event.target.value }))}
                    >
                      <option value="">Select product</option>
                      {availableExtraProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.contentUnit ? formatUnit(product.contentUnit) : "unit"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Amount</span>
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={newConsumable.quantity}
                      onChange={(event) => setNewConsumable((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </label>
                  <button className="secondary-button compact-button" disabled={availableExtraProducts.length === 0} onClick={addExtraConsumable} type="button">
                    Add material
                  </button>
                </div>
              </section>

              <section className="completion-section">
                <div className="completion-section-heading">
                  <div>
                    <span>Step 2</span>
                    <h3>Payment & profit</h3>
                  </div>
                </div>
                <div className="completion-payment-grid">
                  <label>
                    <span>Client paid</span>
                    <input min="0" step="0.01" type="number" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
                  </label>
                  <label>
                    <span>Payment method</span>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="blik">BLIK</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </label>
                  <div>
                    <span>Consumables cost</span>
                    <strong>{formatNullableMoney(actualConsumableCost)}</strong>
                  </div>
                  <div>
                    <span>Net profit</span>
                    <strong>{formatNullableMoney(profitAfterConsumables)}</strong>
                  </div>
                </div>
              </section>
            </div>

            <div className="modal-actions">
              <button className="secondary-button compact-button" onClick={onClose} type="button">
                Close
              </button>
              <button
                className="primary-button compact-button"
                disabled={!canConfirm}
                onClick={() =>
                  void onConfirm(preview.appointment.id, {
                    paymentAmount: receivedAmount,
                    paymentMethod,
                    consumables: actualItems.map((item) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                      unit: item.unit
                    }))
                  })
                }
                type="button"
              >
                {preview.status === "completed" ? "Save corrections" : "Confirm completion"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function AppointmentCreateForm({
  clients,
  employees,
  onCancel,
  services,
  onSubmit
}: {
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  onCancel: () => void;
  services: AdminData["services"];
  onSubmit: (payload: AdminAppointmentInput) => Promise<void>;
}) {
  const activeServices = services.filter((service) => service.active);
  const serviceGroups = buildAppointmentServiceGroups(activeServices);
  const [collapsedServiceGroups, setCollapsedServiceGroups] = useState<string[]>([]);
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "",
    clientMode: clients.length > 0 ? "existing" : "new",
    clientId: clients[0]?.id ?? "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    date: today,
    time: "09:00",
    status: "scheduled",
    clientComment: "",
    employeeComment: ""
  });
  const [serviceIds, setServiceIds] = useState<string[]>(activeServices[0] ? [activeServices[0].id] : []);

  function toggleService(id: string) {
    setServiceIds((current) => (current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]));
  }

  function toggleServiceGroup(groupId: string) {
    setCollapsedServiceGroups((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isExistingClient = form.clientMode === "existing" && form.clientId;

    void onSubmit({
      employeeId: form.employeeId,
      serviceIds,
      startTime: toIsoDateTime(form.date, form.time),
      status: form.status as AdminAppointmentInput["status"],
      clientId: isExistingClient ? form.clientId : undefined,
      client: isExistingClient
        ? undefined
        : {
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            email: form.email
          },
      clientComment: form.clientComment || undefined,
      employeeComment: form.employeeComment || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Employee</span>
        <select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <div className="appointment-service-picker">
        <span>Services</span>
        <div className="service-groups compact">
          {serviceGroups.length > 0 ? (
            serviceGroups.map((group) => {
              const isOpen = !collapsedServiceGroups.includes(group.id);
              const selectedCount = group.services.filter((service) => serviceIds.includes(service.id)).length;

              return (
                <section className="service-group" key={group.id}>
                  <button
                    aria-expanded={isOpen}
                    className="service-group-toggle"
                    onClick={() => toggleServiceGroup(group.id)}
                    type="button"
                  >
                    <span className={isOpen ? "service-group-arrow open" : "service-group-arrow"}>
                      <ArrowRight aria-hidden="true" size={16} />
                    </span>
                    <strong>{group.name}</strong>
                    <span>{selectedCount > 0 ? `${selectedCount}/${group.services.length} selected` : `${group.services.length} services`}</span>
                  </button>
                  {isOpen ? (
                    <div className="appointment-service-list">
                      {group.services.map((service) => (
                        <label className="appointment-service-option" key={service.id}>
                          <input checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} type="checkbox" />
                          <span>
                            <strong>{service.name}</strong>
                            <small>
                              {service.duration} min · {formatServicePrice(service)}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className="empty-state">No active services available.</div>
          )}
        </div>
      </div>
      <div className="form-section">
        <label>
          <span>Date</span>
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
        </label>
        <label>
          <span>Time</span>
          <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
        </label>
      </div>
      <label>
        <span>Client</span>
        <select value={form.clientMode === "existing" ? form.clientId : "new"} onChange={(event) => setForm({ ...form, clientMode: event.target.value === "new" ? "new" : "existing", clientId: event.target.value })}>
          <option value="new">New client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} · {client.phone}
            </option>
          ))}
        </select>
      </label>
      {form.clientMode === "new" ? (
        <div className="client-grid">
          <label>
            <span>First name</span>
            <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
          </label>
          <label>
            <span>Last name</span>
            <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
          </label>
          <label>
            <span>Phone</span>
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
        </div>
      ) : null}
      <label>
        <span>Client comment</span>
        <textarea value={form.clientComment} onChange={(event) => setForm({ ...form, clientComment: event.target.value })} rows={3} />
      </label>
      <label>
        <span>Visit comment</span>
        <textarea value={form.employeeComment} onChange={(event) => setForm({ ...form, employeeComment: event.target.value })} rows={3} />
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={serviceIds.length === 0 || !form.employeeId} type="submit">
          Create appointment
        </button>
      </div>
    </form>
  );
}

function buildAppointmentServiceGroups(services: AdminData["services"]) {
  const groups = new Map<string, { id: string; name: string; services: AdminData["services"] }>();

  for (const service of services) {
    const groupId = service.categoryId ?? "uncategorized";
    const groupName = service.category?.name ?? "Uncategorized";
    const group = groups.get(groupId) ?? { id: groupId, name: groupName, services: [] };
    group.services.push(service);
    groups.set(groupId, group);
  }

  return [...groups.values()].sort((left, right) => {
    if (left.id === "uncategorized") {
      return 1;
    }

    if (right.id === "uncategorized") {
      return -1;
    }

    return left.name.localeCompare(right.name);
  });
}

function AppointmentRescheduleForm({
  appointments,
  initialAppointmentId,
  onCancel,
  onSubmit
}: {
  appointments: AdminData["appointments"];
  initialAppointmentId?: string;
  onCancel: () => void;
  onSubmit: (id: string, payload: { startTime: string; endTime: string; employeeComment?: string }) => Promise<void>;
}) {
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId ?? appointments[0]?.id ?? "");
  const selected = appointments.find((appointment) => appointment.id === appointmentId) ?? appointments[0];
  const initial = selected ? toDateTimeFields(selected.date) : { date: today, time: "09:00" };
  const [form, setForm] = useState({ date: initial.date, time: initial.time, employeeComment: "" });

  useEffect(() => {
    if (!selected) {
      return;
    }

    const next = toDateTimeFields(selected.date);
    setForm({ date: next.date, time: next.time, employeeComment: selected.employeeComment });
  }, [selected?.id]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) {
      return;
    }

    const duration = new Date(selected.endDate).getTime() - new Date(selected.date).getTime();
    const startTime = new Date(toIsoDateTime(form.date, form.time));
    const endTime = new Date(startTime.getTime() + duration);

    void onSubmit(selected.id, {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      employeeComment: form.employeeComment || selected.employeeComment || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Appointment</span>
        <select value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}>
          {appointments.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {appointment.time} · {appointment.client} · {appointment.service}
            </option>
          ))}
        </select>
      </label>
      <div className="form-section">
        <label>
          <span>New date</span>
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
        </label>
        <label>
          <span>New time</span>
          <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
        </label>
      </div>
      <label>
        <span>Reschedule comment</span>
        <textarea value={form.employeeComment} onChange={(event) => setForm({ ...form, employeeComment: event.target.value })} rows={3} />
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={!selected} type="submit">
          Reschedule
        </button>
      </div>
    </form>
  );
}

function AppointmentCommentForm({
  appointments,
  initialAppointmentId,
  onCancel,
  onSubmit
}: {
  appointments: AdminData["appointments"];
  initialAppointmentId?: string;
  onCancel: () => void;
  onSubmit: (id: string, employeeComment: string) => Promise<void>;
}) {
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId ?? appointments[0]?.id ?? "");
  const selected = appointments.find((appointment) => appointment.id === appointmentId) ?? appointments[0];
  const [comment, setComment] = useState(selected?.employeeComment ?? "");

  useEffect(() => {
    setComment(selected?.employeeComment ?? "");
  }, [selected?.id]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selected) {
      void onSubmit(selected.id, comment);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Appointment</span>
        <select value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}>
          {appointments.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {appointment.time} · {appointment.client}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Internal comment</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} />
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={!selected} type="submit">
          Save comment
        </button>
      </div>
    </form>
  );
}
