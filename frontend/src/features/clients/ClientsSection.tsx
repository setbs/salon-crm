import { Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createAdminClientNote, fetchAdminClientProfile, type AdminClientProfile, type AdminData } from "../../api";
import { AdminModal, DataTable, InfoList, InlineActions, Panel, StatusBadge } from "../../components/admin-ui";
import { useCrmT } from "../../crm-i18n";
import { adminMoney } from "../../utils/format";

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ClientsSection({
  clients,
  runAction
}: {
  clients: AdminData["clients"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useCrmT();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<AdminClientProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredClients = normalizedSearch
    ? clients.filter((client) =>
        [client.name, client.phone, client.email ?? "", ...client.nameAliases.map((alias) => alias.name)].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        )
      )
    : clients;

  async function reloadSelectedClientProfile() {
    if (!selectedClientId) {
      return;
    }

    setClientProfile(await fetchAdminClientProfile(selectedClientId));
  }

  useEffect(() => {
    let cancelled = false;

    if (!selectedClientId) {
      setClientProfile(null);
      setProfileError("");
      setIsLoadingProfile(false);
      return;
    }

    setClientProfile(null);
    setProfileError("");
    setIsLoadingProfile(true);
    fetchAdminClientProfile(selectedClientId)
      .then((profile) => {
        if (!cancelled) {
          setClientProfile(profile);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProfileError(error instanceof Error ? error.message : t("couldNotLoadClientProfile"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);

  return (
    <div className="admin-grid">
      <Panel title={t("clients")} wide>
        <div className="admin-search wide">
          <Search aria-hidden="true" size={17} />
          <input
            placeholder={t("namePhoneEmail")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <DataTable
          columns={[t("client"), t("phone"), t("email"), t("visits"), t("spent"), t("actions")]}
          rows={
            filteredClients.length > 0
              ? filteredClients.map((item) => [
                  <button className="table-link-button" onClick={() => setSelectedClientId(item.id)} type="button">
                    {item.name}
                  </button>,
                  item.phone,
                  item.email ?? "-",
                  item.visits,
                  adminMoney.format(item.spent),
                  <InlineActions labels={[t("view")]} onAction={() => setSelectedClientId(item.id)} />
                ])
              : [[t("noClientsFound"), "-", "-", "-", "-", "-"]]
          }
        />
      </Panel>
      {selectedClientId ? (
        <AdminModal title={clientProfile ? `${t("client")}: ${clientProfile.name}` : t("clientProfile")} onClose={() => setSelectedClientId(null)}>
          {isLoadingProfile ? <div className="modal-state">{t("loadingClientProfile")}</div> : null}
          {profileError ? <div className="admin-alert">{profileError}</div> : null}
          {clientProfile ? (
            <ClientProfileDialog
              profile={clientProfile}
              onCreateNote={(text) =>
                runAction(async () => {
                  await createAdminClientNote(clientProfile.id, { text });
                  await reloadSelectedClientProfile();
                })
              }
            />
          ) : null}
        </AdminModal>
      ) : null}
    </div>
  );
}

function ClientProfileDialog({ onCreateNote, profile }: { onCreateNote: (text: string) => Promise<void>; profile: AdminClientProfile }) {
  const t = useCrmT();
  const [noteText, setNoteText] = useState("");

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = noteText.trim();

    if (!text) {
      return;
    }

    void onCreateNote(text).then(() => setNoteText(""));
  }

  return (
    <div className="client-profile">
      <InfoList
        items={[
          [t("phone"), profile.phone],
          [t("email"), profile.email ?? "-"],
          [t("latestNote"), profile.comment || t("noClientNotesYet")]
        ]}
      />

      <section className="profile-section client-alias-section">
        <div className="profile-section-heading">
          <h3>{t("registeredNames")}</h3>
          <span>{profile.nameAliases.length} {t("variants")}</span>
        </div>
        <div className="client-alias-list">
          {profile.nameAliases.length > 0 ? (
            profile.nameAliases.map((alias) => (
              <span key={alias.id} title={alias.source ?? undefined}>
                {alias.name}
              </span>
            ))
          ) : (
            <span>{profile.name}</span>
          )}
        </div>
      </section>

      <div className="profile-summary-grid">
        <div>
          <span>{t("visits")}</span>
          <strong>{profile.visits}</strong>
        </div>
        <div>
          <span>{t("totalSpent")}</span>
          <strong>{adminMoney.format(profile.spent)}</strong>
        </div>
        <div>
          <span>{t("purchases")}</span>
          <strong>{profile.sales.length}</strong>
        </div>
      </div>

      <section className="profile-section client-notes-section">
        <div className="profile-section-heading">
          <h3>{t("clientNotes")}</h3>
          <span>{profile.notes.length} {t("notes")}</span>
        </div>
        <form className="client-note-form" onSubmit={submitNote}>
          <textarea
            maxLength={3000}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder={t("writeInternalClientNote")}
            rows={4}
            value={noteText}
          />
          <button className="primary-button compact-button" disabled={!noteText.trim()} type="submit">
            {t("saveNote")}
          </button>
        </form>
        <div className="client-note-list">
          {profile.notes.length > 0 ? (
            profile.notes.map((note) => (
              <article key={note.id}>
                <p>{note.text}</p>
                <small>
                  {note.author} · {formatShortDate(note.createdAt)}
                </small>
              </article>
            ))
          ) : (
            <div className="modal-state">{t("noNotesForClient")}</div>
          )}
        </div>
      </section>

      <section className="profile-section">
        <div className="profile-section-heading">
          <h3>{t("appointments")}</h3>
          <span>{profile.appointments.length} {t("records")}</span>
        </div>
        <DataTable
          columns={[t("date"), t("service"), t("employee"), t("payment"), t("rating"), t("comment"), t("status")]}
          rows={
            profile.appointments.length > 0
              ? profile.appointments.map((appointment) => [
                  `${formatShortDate(appointment.date)} · ${appointment.time}`,
                  appointment.service || "-",
                  appointment.employee,
                  `${adminMoney.format(appointment.amount)} · ${appointment.paymentStatus}`,
                  appointment.rating ? `${appointment.rating}/5` : "-",
                  appointment.clientComment || appointment.employeeComment || "-",
                  <StatusBadge status={appointment.status} />
                ])
              : [[t("noAppointments"), "-", "-", "-", "-", "-", "-"]]
          }
        />
      </section>

      <section className="profile-section">
        <div className="profile-section-heading">
          <h3>{t("purchases")}</h3>
          <span>{profile.sales.length} {t("records")}</span>
        </div>
        <DataTable
          columns={[t("date"), t("products"), t("qty"), t("employee"), t("payment"), t("total")]}
          rows={
            profile.sales.length > 0
              ? profile.sales.map((sale) => [
                  formatShortDate(sale.saleDate),
                  sale.products || "-",
                  sale.quantity,
                  sale.employee ?? "-",
                  `${sale.paymentMethod} · ${sale.paymentStatus}`,
                  adminMoney.format(sale.total)
                ])
              : [[t("noPurchases"), "-", "-", "-", "-", "-"]]
          }
        />
      </section>
    </div>
  );
}
