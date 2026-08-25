import type { ReactNode } from "react";
import { Check, Edit3, EyeOff, FileText, Plus, RotateCcw, Trash2, X } from "lucide-react";

export function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function AdminModal({
  children,
  className,
  onClose,
  title
}: {
  children: ReactNode;
  className?: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section aria-modal="true" className={className ? `admin-modal ${className}` : "admin-modal"} role="dialog">
        <div className="panel-header">
          <h2>{title}</h2>
          <button aria-label="Close modal" className="icon-only-button" onClick={onClose} title="Close" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  onAction,
  wide
}: {
  title: string;
  action?: string;
  children: ReactNode;
  onAction?: () => void;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "admin-panel wide-panel" : "admin-panel"}>
      <header className="panel-header">
        <h2>{title}</h2>
        {action ? (
          <button className="panel-action" onClick={onAction} type="button">
            <Plus aria-hidden="true" size={16} />
            {action}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaginationControls({
  currentPage,
  label,
  onPageChange,
  pageCount
}: {
  currentPage: number;
  label: string;
  onPageChange: (page: number) => void;
  pageCount: number;
}) {
  return (
    <div className="pagination-controls">
      <span>{label}</span>
      <div>
        <button className="secondary-button compact-button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button">
          Previous
        </button>
        <strong>
          {currentPage} / {pageCount}
        </strong>
        <button className="secondary-button compact-button" disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button">
          Next
        </button>
      </div>
    </div>
  );
}

export function InfoList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="info-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InlineActions({ labels, onAction }: { labels: string[]; onAction?: (label: string) => void }) {
  return (
    <div className="inline-actions">
      {labels.map((label) => {
        const Icon =
          label === "Details"
            ? FileText
            : label === "Refund" || label === "refunded"
              ? RotateCcw
            : label === "Complete" || label === "paid"
              ? Check
              : label === "Delete" || label === "Cancel"
                ? Trash2
                : label === "Hide" || label === "No-show"
                  ? EyeOff
                  : Edit3;

        return (
          <button aria-label={label} key={label} onClick={() => onAction?.(label)} title={label} type="button">
            <Icon aria-hidden="true" size={15} />
          </button>
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusLabels: Record<string, string> = {
    scheduled: "scheduled",
    completed: "completed",
    cancelled: "cancelled",
    no_show: "no-show",
    pending: "pending",
    active: "active",
    disabled: "disabled",
    paid: "paid",
    refunded: "refunded",
    ready: "ready",
    blocked: "blocked",
    ok: "ok",
    low: "low",
    out: "out",
    confirmed: "confirmed",
    processing: "processing",
    shipped: "shipped",
    not_tracked: "not tracked",
    payment_updated: "payment",
    payment_created: "created",
    payment_refunded: "refund",
    status_updated: "status",
    completion_corrected: "corrected"
  };

  return <span className={`status-badge ${status}`}>{statusLabels[status] ?? status}</span>;
}
