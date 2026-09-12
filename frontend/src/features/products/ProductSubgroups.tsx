import { useState, type FormEvent } from "react";
import { Pencil, Trash2, X, Plus, Check } from "lucide-react";
import { type AdminProductCategory, saveAdminProductSubgroup, deleteAdminProductSubgroup } from "../../api";
import { useCrmT } from "../../crm-i18n";

export function ProductSubgroups({ category, runAction }: { category: AdminProductCategory; runAction: (action: () => Promise<unknown>) => Promise<void> }) {
  const t = useCrmT();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  function reset() { setName(""); setEditingId(undefined); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try { await runAction(async () => { await saveAdminProductSubgroup(category.id, name.trim(), editingId); reset(); }); }
    finally { setBusy(false); }
  }
  return <div className="product-subgroups">
    <form onSubmit={submit} className="subgroup-form">
      <label><span>{t("subgroup")}</span><input required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></label>
      <button type="submit" className="panel-action" disabled={busy || !name.trim()}>{editingId ? <Check size={16} /> : <Plus size={16} />}{editingId ? t("save") : t("addSubgroup")}</button>
      {editingId ? <button type="button" className="panel-action" title={t("cancel")} aria-label={t("cancel")} onClick={reset}><X size={16} /></button> : null}
    </form>
    <div className="subgroup-list">
      {(category.subgroups ?? []).map(group => <div className="subgroup-row" key={group.id}>
        <span>{group.name}</span><small>{group.productCount} {t("products")}</small>
        <button type="button" disabled={busy} className="panel-action" title={t("edit")} aria-label={t("edit")} onClick={() => { setEditingId(group.id); setName(group.name); }}><Pencil size={16} /></button>
        <button type="button" disabled={busy} className="panel-action" title={t("delete")} aria-label={t("delete")} onClick={async () => {
          if (!window.confirm(t("removeSubgroupConfirm"))) return;
          setBusy(true);
          try { await runAction(async () => { await deleteAdminProductSubgroup(category.id, group.id); if (editingId === group.id) reset(); }); }
          finally { setBusy(false); }
        }}><Trash2 size={16} /></button>
      </div>)}
    </div>
  </div>;
}
