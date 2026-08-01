import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAdminClientProfile, type AdminClientProfile, type AdminData } from "../../api";
import { AdminModal, DataTable, InfoList, InlineActions, Panel, StatusBadge } from "../../components/admin-ui";
import { adminMoney } from "../../utils/format";

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ClientsSection({ clients }: { clients: AdminData["clients"] }) {
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientProfile, setClientProfile] = useState<AdminClientProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredClients = normalizedSearch
    ? clients.filter((client) =>
        [client.name, client.phone, client.email ?? ""].some((value) => value.toLowerCase().includes(normalizedSearch))
      )
    : clients;

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
          setProfileError(error instanceof Error ? error.message : "Could not load client profile.");
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
      <Panel title="Clients" wide>
        <div className="admin-search wide">
          <Search aria-hidden="true" size={17} />
          <input
            placeholder="Name, phone, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <DataTable
          columns={["Client", "Phone", "Email", "Visits", "Spent", "Actions"]}
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
                  <InlineActions labels={["View"]} onAction={() => setSelectedClientId(item.id)} />
                ])
              : [["No clients found", "-", "-", "-", "-", "-"]]
          }
        />
      </Panel>
      {selectedClientId ? (
        <AdminModal title={clientProfile ? `Client: ${clientProfile.name}` : "Client profile"} onClose={() => setSelectedClientId(null)}>
          {isLoadingProfile ? <div className="modal-state">Loading client profile...</div> : null}
          {profileError ? <div className="admin-alert">{profileError}</div> : null}
          {clientProfile ? <ClientProfileDialog profile={clientProfile} /> : null}
        </AdminModal>
      ) : null}
    </div>
  );
}

function ClientProfileDialog({ profile }: { profile: AdminClientProfile }) {
  return (
    <div className="client-profile">
      <InfoList
        items={[
          ["Phone", profile.phone],
          ["Email", profile.email ?? "-"],
          ["Latest note", profile.comment || "no comments"]
        ]}
      />

      <div className="profile-summary-grid">
        <div>
          <span>Visits</span>
          <strong>{profile.visits}</strong>
        </div>
        <div>
          <span>Total spent</span>
          <strong>{adminMoney.format(profile.spent)}</strong>
        </div>
        <div>
          <span>Purchases</span>
          <strong>{profile.sales.length}</strong>
        </div>
      </div>

      <section className="profile-section">
        <div className="profile-section-heading">
          <h3>Appointments</h3>
          <span>{profile.appointments.length} records</span>
        </div>
        <DataTable
          columns={["Date", "Service", "Employee", "Payment", "Rating", "Comment", "Status"]}
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
              : [["No appointments", "-", "-", "-", "-", "-", "-"]]
          }
        />
      </section>

      <section className="profile-section">
        <div className="profile-section-heading">
          <h3>Purchases</h3>
          <span>{profile.sales.length} records</span>
        </div>
        <DataTable
          columns={["Date", "Products", "Qty", "Employee", "Payment", "Total"]}
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
              : [["No purchases", "-", "-", "-", "-", "-"]]
          }
        />
      </section>
    </div>
  );
}
