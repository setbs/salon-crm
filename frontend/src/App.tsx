import {
  CalendarDays,
  Camera,
  Check,
  Clock,
  CreditCard,
  Edit3,
  EyeOff,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  Scissors,
  Settings,
  ShoppingCart,
  Star,
  Trash2,
  UserRound,
  UsersRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAdminServiceCategory,
  createAdminAppointment,
  createAdminProduct,
  createAdminSale,
  createAdminService,
  createAppointment,
  deleteAdminService,
  fetchAdminData,
  fetchAvailability,
  fetchCurrentUser,
  fetchEmployees,
  fetchServices,
  getStoredAuthToken,
  loginCrm,
  setStoredAuthToken,
  updateAdminAppointment,
  rescheduleAdminAppointment,
  updateAdminAppointmentComment,
  updateAdminPayment,
  updateAdminService,
  updateAdminServiceCategory,
  updateAdminSettings,
  type AdminData,
  type AdminAppointmentInput,
  type AuthUser,
  type Employee,
  type ProductInput,
  type SaleInput,
  type Service,
  type ServiceCategoryInput,
  type ServiceInput,
  type SettingsInput,
  type Slot
} from "./api";

const bookingMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

const adminMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

const serviceCopy: Record<string, { name: string; description: string }> = {
  "Women's haircut": {
    name: "Women's haircut",
    description: "consultation / wash / styling"
  },
  "Classic manicure": {
    name: "Classic manicure",
    description: "shape / cuticle care / polish"
  },
  "Hair coloring": {
    name: "Hair coloring",
    description: "consultation / full color service"
  }
};

const today = new Date().toISOString().slice(0, 10);

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

type AppMode = "admin" | "booking";
type AdminSection =
  | "dashboard"
  | "calendar"
  | "clients"
  | "services"
  | "employees"
  | "portfolio"
  | "products"
  | "sales"
  | "payments"
  | "reviews"
  | "settings";

const adminNav: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "clients", label: "Clients", icon: UsersRound },
  { id: "services", label: "Services", icon: Scissors },
  { id: "employees", label: "Employees", icon: UserRound },
  { id: "portfolio", label: "Portfolio", icon: Camera },
  { id: "products", label: "Products", icon: Package },
  { id: "sales", label: "Sales", icon: ShoppingCart },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "settings", label: "Settings", icon: Settings }
];

const employeeSections: AdminSection[] = ["dashboard", "calendar", "clients", "employees", "portfolio", "payments", "reviews"];

function getVisibleAdminNav(user: AuthUser) {
  if (user.role === "ADMIN") {
    return adminNav;
  }

  return adminNav.filter((item) => employeeSections.includes(item.id));
}

export function App() {
  const [mode, setMode] = useState<AppMode>("admin");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => Boolean(getStoredAuthToken()));

  useEffect(() => {
    if (!getStoredAuthToken()) {
      setIsCheckingAuth(false);
      return;
    }

    fetchCurrentUser()
      .then(setAuthUser)
      .catch(() => {
        setStoredAuthToken(null);
        setAuthUser(null);
      })
      .finally(() => setIsCheckingAuth(false));
  }, []);

  function logout() {
    setStoredAuthToken(null);
    setAuthUser(null);
  }

  return (
    <>
      {mode === "admin" ? (
        authUser ? (
          <AdminPanel onLogout={logout} onOpenBooking={() => setMode("booking")} user={authUser} />
        ) : (
          <LoginView
            isCheckingAuth={isCheckingAuth}
            onOpenBooking={() => setMode("booking")}
            onSuccess={(user) => {
              setAuthUser(user);
              setMode("admin");
            }}
          />
        )
      ) : (
        <BookingView onOpenAdmin={() => setMode("admin")} />
      )}
    </>
  );
}

function LoginView({
  isCheckingAuth,
  onOpenBooking,
  onSuccess
}: {
  isCheckingAuth: boolean;
  onOpenBooking: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await loginCrm(form);
      onSuccess(result.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel document-frame">
        <div className="sl-logo compact" aria-hidden="true">
          <span>S</span>
          <span>L</span>
        </div>
        <p className="eyebrow">SL Color Studio</p>
        <h1>CRM Sign In</h1>
        {isCheckingAuth ? <div className="admin-panel">Checking session...</div> : null}
        {error ? <div className="admin-alert">{error}</div> : null}
        <form className="admin-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input autoComplete="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>
          <button className="primary-button admin-submit" disabled={isSubmitting || isCheckingAuth} type="submit">
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <button className="booking-link light" onClick={onOpenBooking} type="button">
          Go to online booking
        </button>
      </section>
    </main>
  );
}

function AdminPanel({ onLogout, onOpenBooking, user }: { onLogout: () => void; onOpenBooking: () => void; user: AuthUser }) {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const visibleNav = getVisibleAdminNav(user);

  async function loadAdminData() {
    setIsLoadingAdmin(true);
    try {
      const data = await fetchAdminData();
      setAdminData(data);
      setAdminError("");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Unknown admin API error");
    } finally {
      setIsLoadingAdmin(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    if (!visibleNav.some((item) => item.id === activeSection)) {
      setActiveSection("dashboard");
    }
  }, [activeSection, visibleNav]);

  async function runAdminAction(action: () => Promise<unknown>) {
    setAdminError("");
    setActionMessage("");

    try {
      await action();
      await loadAdminData();
      setActionMessage("Changes saved.");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Could not complete the action.");
    }
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">SL</div>
          <div>
            <strong>Color Studio</strong>
            <span>{user.role === "ADMIN" ? "Main Admin" : "CRM Employee"}</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeSection === item.id ? "admin-nav-item active" : "admin-nav-item"}
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="booking-link" onClick={onOpenBooking} type="button">
          Open online booking
        </button>
        <button className="booking-link" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={16} />
          Sign out
        </button>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Admin MVP</p>
            <h1>{visibleNav.find((item) => item.id === activeSection)?.label}</h1>
            <span className="admin-userline">{user.name}</span>
          </div>
          <div className="admin-search">
            <Search aria-hidden="true" size={17} />
            <input placeholder="Search CRM" />
          </div>
        </header>

        {adminError ? <div className="admin-alert">Could not complete the action: {adminError}</div> : null}
        {actionMessage ? <div className="admin-success">{actionMessage}</div> : null}
        {isLoadingAdmin || !adminData ? (
          <div className="admin-panel">Loading CRM data...</div>
        ) : (
          <AdminContent section={activeSection} data={adminData} runAction={runAdminAction} user={user} />
        )}
      </section>
    </main>
  );
}

function AdminContent({
  section,
  data,
  runAction,
  user
}: {
  section: AdminSection;
  data: AdminData;
  runAction: (action: () => Promise<unknown>) => Promise<void>;
  user: AuthUser;
}) {
  if (user.role !== "ADMIN" && !employeeSections.includes(section)) {
    return <DashboardSection dashboard={data.dashboard} appointments={data.appointments} />;
  }

  if (section === "dashboard") {
    return <DashboardSection dashboard={data.dashboard} appointments={data.appointments} />;
  }

  if (section === "calendar") {
    return (
      <CalendarSection
        appointments={data.appointments}
        clients={data.clients}
        employees={data.employees}
        services={data.services}
        runAction={runAction}
      />
    );
  }

  if (section === "clients") {
    return <ClientsSection clients={data.clients} />;
  }

  if (section === "services") {
    return <ServicesSection services={data.services} categories={data.serviceCategories} employees={data.employees} runAction={runAction} />;
  }

  if (section === "employees") {
    return <EmployeesSection employees={data.employees} />;
  }

  if (section === "portfolio") {
    return <PortfolioSection portfolio={data.portfolio} />;
  }

  if (section === "products") {
    return <ProductsSection products={data.products} runAction={runAction} />;
  }

  if (section === "sales") {
    return <SalesSection sales={data.sales} products={data.products} clients={data.clients} employees={data.employees} runAction={runAction} />;
  }

  if (section === "payments") {
    return <PaymentsSection payments={data.payments} runAction={runAction} />;
  }

  if (section === "reviews") {
    return <ReviewsSection reviews={data.reviews} />;
  }

  return <SettingsSection settings={data.settings} runAction={runAction} />;
}

function DashboardSection({ dashboard, appointments }: { dashboard: AdminData["dashboard"]; appointments: AdminData["appointments"] }) {
  return (
    <div className="admin-grid">
      <MetricCard label="Appointments today" value={String(dashboard.todayAppointments)} note="records from PostgreSQL" />
      <MetricCard label="Daily revenue" value={adminMoney.format(dashboard.dailyRevenue)} note="paid services + products" />
      <MetricCard
        label="Next appointment"
        value={dashboard.nextAppointment?.time ?? "-"}
        note={dashboard.nextAppointment ? `${dashboard.nextAppointment.client}, ${dashboard.nextAppointment.service}` : "no upcoming appointments"}
      />
      <MetricCard label="Low stock" value={String(dashboard.lowStockProducts)} note="products need restocking" />

      <Panel title="Today's appointments" action="Create appointment">
        <DataTable
          columns={["Time", "Client", "Service", "Employee", "Status"]}
          rows={appointments.map((item) => [item.time, item.client, item.service, item.master, <StatusBadge status={item.status} />])}
        />
      </Panel>

      <Panel title="Later backlog">
        <div className="feature-list">
          <span>About salon page</span>
          <span>public product catalog</span>
          <span>product consumption per service</span>
          <span>admin-only consumables</span>
          <span>reviews in public navigation</span>
          <span>CSV appointment export</span>
        </div>
      </Panel>
    </div>
  );
}

function CalendarSection({
  appointments,
  clients,
  employees,
  services,
  runAction
}: {
  appointments: AdminData["appointments"];
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  services: AdminData["services"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-grid">
      <Panel title="Calendar" action="Create appointment manually">
        <div className="segmented-control" aria-label="Calendar view">
          <button className="active" type="button">
            Day
          </button>
          <button type="button">Week</button>
          <button type="button">Month</button>
        </div>
        <DataTable
          columns={["Time", "Client", "Service", "Employee", "Comment", "Actions", "Status"]}
          rows={appointments.map((item) => [
            item.time,
            item.client,
            item.service,
            item.master,
            item.comment || "-",
            <InlineActions
              labels={["Complete", "No-show", "Cancel"]}
              onAction={(label) =>
                runAction(() =>
                  updateAdminAppointment(item.id, {
                    status: label === "Complete" ? "completed" : label === "No-show" ? "no_show" : "cancelled"
                  })
                )
              }
            />,
            <StatusBadge status={item.status} />
          ])}
        />
      </Panel>
      <AppointmentCreateForm
        clients={clients}
        employees={employees}
        services={services}
        onSubmit={(payload) => runAction(() => createAdminAppointment(payload))}
      />
      <AppointmentRescheduleForm appointments={appointments} onSubmit={(id, payload) => runAction(() => rescheduleAdminAppointment(id, payload))} />
      <AppointmentCommentForm appointments={appointments} onSubmit={(id, employeeComment) => runAction(() => updateAdminAppointmentComment(id, { employeeComment }))} />
    </div>
  );
}

function AppointmentCreateForm({
  clients,
  employees,
  services,
  onSubmit
}: {
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  services: AdminData["services"];
  onSubmit: (payload: AdminAppointmentInput) => Promise<void>;
}) {
  const activeServices = services.filter((service) => service.active);
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
    <Panel title="New appointment">
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
        <div className="checkbox-group">
          <span>Services</span>
          {activeServices.map((service) => (
            <label className="checkbox-line" key={service.id}>
              <input checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} type="checkbox" />
              <span>
                {service.name} · {service.duration} min · {adminMoney.format(service.price)}
              </span>
            </label>
          ))}
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
        <button className="primary-button admin-submit" disabled={serviceIds.length === 0 || !form.employeeId} type="submit">
          Create appointment
        </button>
      </form>
    </Panel>
  );
}

function AppointmentRescheduleForm({
  appointments,
  onSubmit
}: {
  appointments: AdminData["appointments"];
  onSubmit: (id: string, payload: { startTime: string; endTime: string; employeeComment?: string }) => Promise<void>;
}) {
  const [appointmentId, setAppointmentId] = useState(appointments[0]?.id ?? "");
  const selected = appointments.find((appointment) => appointment.id === appointmentId) ?? appointments[0];
  const initial = selected ? toDateTimeFields(selected.date) : { date: today, time: "09:00" };
  const [form, setForm] = useState({ date: initial.date, time: initial.time, employeeComment: "" });

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
    <Panel title="Reschedule appointment">
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
        <button className="primary-button admin-submit" disabled={!selected} type="submit">
          Reschedule
        </button>
      </form>
    </Panel>
  );
}

function AppointmentCommentForm({
  appointments,
  onSubmit
}: {
  appointments: AdminData["appointments"];
  onSubmit: (id: string, employeeComment: string) => Promise<void>;
}) {
  const [appointmentId, setAppointmentId] = useState(appointments[0]?.id ?? "");
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
    <Panel title="Visit comment">
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
        <button className="primary-button admin-submit" disabled={!selected} type="submit">
          Save comment
        </button>
      </form>
    </Panel>
  );
}

function ClientsSection({ clients }: { clients: AdminData["clients"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Clients" action="Add client">
        <div className="admin-search wide">
          <Search aria-hidden="true" size={17} />
          <input placeholder="Name, phone, or email" />
        </div>
        <DataTable
          columns={["Client", "Phone", "Email", "Visits", "Spent"]}
          rows={clients.map((item) => [item.name, item.phone, item.email, item.visits, adminMoney.format(item.spent)])}
        />
      </Panel>
      <Panel title="Client profile">
        <InfoList
          items={[
            ["Visit history", "8 visits"],
            ["Comments", clients[0]?.comment || "no comments"],
            ["Purchase history", clients[0] ? `${adminMoney.format(clients[0].spent)} total` : "no data"]
          ]}
        />
      </Panel>
    </div>
  );
}

function ServicesSection({
  services,
  categories,
  employees,
  runAction
}: {
  services: AdminData["services"];
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const filteredServices = categoryFilter === "all" ? services : services.filter((service) => (service.categoryId ?? "") === categoryFilter);
  const editingService = services.find((service) => service.id === editingServiceId) ?? null;
  const editingCategory = categories.find((category) => category.id === editingCategoryId) ?? null;

  return (
    <div className="admin-grid">
      <Panel title="Services" action="Add service">
        <div className="table-toolbar">
          <label>
            <span>Category filter</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DataTable
          columns={["Category", "Name", "Specialists", "Price", "Duration", "Description", "Status", "Actions"]}
          rows={filteredServices.map((item) => [
            item.category?.name ?? "Uncategorized",
            item.name,
            item.employees.length > 0 ? item.employees.map((employee) => employee.name).join(", ") : "not assigned",
            adminMoney.format(item.price),
            `${item.duration} min`,
            item.description || "no description",
            item.active ? "active" : "disabled",
            <InlineActions
              labels={[item.active ? "Disable" : "Enable", "Edit", "Delete"]}
              onAction={(label) => {
                if (label === "Edit") {
                  setEditingServiceId(item.id);
                  return;
                }

                if (label === "Delete") {
                  void runAction(() => deleteAdminService(item.id));
                  return;
                }

                void runAction(() => updateAdminService(item.id, { active: !item.active }));
              }}
            />
          ])}
        />
      </Panel>
      <Panel title="Service categories" action="Add category">
        <DataTable
          columns={["Name", "Description", "Status", "Actions"]}
          rows={categories.map((category) => [
            category.name,
            category.description ?? "no description",
            category.active ? "active" : "disabled",
            <InlineActions
              labels={[category.active ? "Disable" : "Enable", "Edit"]}
              onAction={(label) => {
                if (label === "Edit") {
                  setEditingCategoryId(category.id);
                  return;
                }

                void runAction(() => updateAdminServiceCategory(category.id, { active: !category.active }));
              }}
            />
          ])}
        />
      </Panel>
      <ServiceCategoryForm onSubmit={(payload) => runAction(() => createAdminServiceCategory(payload))} />
      {editingCategory ? (
        <ServiceCategoryEditForm
          category={editingCategory}
          key={editingCategory.id}
          onCancel={() => setEditingCategoryId(null)}
          onSubmit={(payload) =>
            runAction(async () => {
              await updateAdminServiceCategory(editingCategory.id, payload);
              setEditingCategoryId(null);
            })
          }
        />
      ) : null}
      <ServiceForm categories={categories} employees={employees} onSubmit={(payload) => runAction(() => createAdminService(payload))} />
      {editingService ? (
        <ServiceEditForm
          categories={categories}
          employees={employees}
          key={editingService.id}
          service={editingService}
          onCancel={() => setEditingServiceId(null)}
          onSubmit={(payload) =>
            runAction(async () => {
              await updateAdminService(editingService.id, payload);
              setEditingServiceId(null);
            })
          }
        />
      ) : null}
    </div>
  );
}

function EmployeesSection({ employees }: { employees: AdminData["employees"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Employees" action="Add employee">
        <DataTable
          columns={["First name", "Specialization", "Working hours", "Time off/day off", "Status"]}
          rows={employees.map((item) => [item.name, item.specialization, item.hours, item.timeOff, item.active ? "active" : "disabled"])}
        />
      </Panel>
      <FormPanel title="Employee profile" fields={["First name", "Specialization", "Working hours", "Time off/day off", "Enable employee"]} />
    </div>
  );
}

function PortfolioSection({ portfolio }: { portfolio: AdminData["portfolio"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Portfolio" action="Upload photo">
        <div className="portfolio-grid">
          {portfolio.map((item) => (
            <article className="portfolio-card" key={item.title}>
              <div className="portfolio-preview">
                <Camera aria-hidden="true" />
              </div>
              <strong>{item.title}</strong>
              <span>{item.master}</span>
              <InlineActions labels={[item.visible ? "Hide" : "Show", "Delete"]} />
            </article>
          ))}
        </div>
      </Panel>
      <FormPanel title="Work description" fields={["Photo", "Description", "Employee", "Visibility"]} />
    </div>
  );
}

function ProductsSection({
  products,
  runAction
}: {
  products: AdminData["products"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-grid">
      <Panel title="Products / inventory" action="Add product">
        <DataTable
          columns={["Category", "Product", "Purchase", "Sale", "Stock", "Min. stock"]}
          rows={products.map((item) => [
            item.category,
            item.name,
            adminMoney.format(item.purchase),
            adminMoney.format(item.sale),
            item.stock <= item.min ? <span className="danger-text">{item.stock}</span> : item.stock,
            item.min
          ])}
        />
      </Panel>
      <ProductForm onSubmit={(payload) => runAction(() => createAdminProduct(payload))} />
      <Panel title="Stock movement history">
        <InfoList
          items={products
            .flatMap((product) =>
              product.movements.map((movement) => [
                movement.type,
                `${movement.quantity > 0 ? "+" : ""}${movement.quantity} ${product.name}${movement.reason ? ` · ${movement.reason}` : ""}`
              ] as [string, string])
            )
            .slice(0, 6)}
        />
      </Panel>
    </div>
  );
}

function SalesSection({
  sales,
  products,
  clients,
  employees,
  runAction
}: {
  sales: AdminData["sales"];
  products: AdminData["products"];
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-grid">
      <Panel title="Product sales" action="Create sale">
        <DataTable
          columns={["Product", "Quantity", "Client", "Payment", "Amount"]}
          rows={sales.map((item) => [item.product, item.qty, item.client, item.payment, adminMoney.format(item.total)])}
        />
      </Panel>
      <SaleForm products={products} clients={clients} employees={employees} onSubmit={(payload) => runAction(() => createAdminSale(payload))} />
    </div>
  );
}

function PaymentsSection({
  payments,
  runAction
}: {
  payments: AdminData["payments"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-grid">
      <Panel title="Payments" action="Add payment">
        <DataTable
          columns={["Source", "Client", "Method", "Status", "Amount", "Actions"]}
          rows={payments.map((item) => [
            item.source,
            item.client,
            item.method,
            <StatusBadge status={item.status} />,
            adminMoney.format(item.amount),
            <InlineActions labels={["paid", "refunded"]} onAction={(label) => runAction(() => updateAdminPayment(item.id, { status: label }))} />
          ])}
        />
      </Panel>
      <Panel title="Supported methods">
        <div className="feature-list">
          <span>cash</span>
          <span>card</span>
          <span>blik</span>
          <span>transfer</span>
        </div>
      </Panel>
    </div>
  );
}

function ReviewsSection({ reviews }: { reviews: AdminData["reviews"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Reviews">
        <DataTable columns={["Client", "Rating", "Comment"]} rows={reviews.map((item) => [item.client, `${item.rating}/5`, item.text])} />
      </Panel>
    </div>
  );
}

function SettingsSection({
  settings,
  runAction
}: {
  settings: AdminData["settings"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-grid">
      <SettingsForm settings={settings} onSubmit={(payload) => runAction(() => updateAdminSettings(payload))} />
      <Panel title="Current data">
        <InfoList
          items={[
            ["Name", settings.salonName],
            ["Phone", settings.phone],
            ["Email", settings.email],
            ["Address", settings.address],
            ["Hours", settings.hours]
          ]}
        />
      </Panel>
    </div>
  );
}

function ServiceCategoryForm({ onSubmit }: { onSubmit: (payload: ServiceCategoryInput) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", description: "", active: true });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name,
      description: form.description,
      active: form.active
    });
  }

  return (
    <Panel title="New category">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <label className="checkbox-line">
          <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
          <span>Active category</span>
        </label>
        <button className="primary-button admin-submit" type="submit">
          Add category
        </button>
      </form>
    </Panel>
  );
}

function ServiceCategoryEditForm({
  category,
  onCancel,
  onSubmit
}: {
  category: AdminData["serviceCategories"][number];
  onCancel: () => void;
  onSubmit: (payload: ServiceCategoryInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: category.name,
    description: category.description ?? "",
    active: category.active
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name,
      description: form.description,
      active: form.active
    });
  }

  return (
    <Panel title={`Edit category: ${category.name}`}>
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <label className="checkbox-line">
          <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
          <span>Active category</span>
        </label>
        <div className="form-actions">
          <button className="primary-button admin-submit" type="submit">
            Save category
          </button>
          <button className="booking-link light" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

function ServiceForm({
  categories,
  employees,
  onSubmit
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  onSubmit: (payload: ServiceInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    categoryId: categories[0]?.id ?? "",
    name: "",
    price: "0",
    duration: "60",
    description: "",
    active: true,
    employeeIds: employees[0]?.id ? [employees[0].id] : []
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds
    });
  }

  return (
    <Panel title="New service">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Category</span>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Price</span>
          <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        </label>
        <label>
          <span>Duration, min</span>
          <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
        </label>
        <label>
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <EmployeeSelector
          employees={employees}
          selectedIds={form.employeeIds}
          onChange={(employeeIds) => setForm({ ...form, employeeIds })}
        />
        {form.employeeIds.length === 0 ? <small className="form-note">Assign at least one specialist so clients can book this service.</small> : null}
        <label className="checkbox-line">
          <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
          <span>Active service</span>
        </label>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          Add service
        </button>
      </form>
    </Panel>
  );
}

function ServiceEditForm({
  categories,
  employees,
  onCancel,
  onSubmit,
  service
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  onCancel: () => void;
  onSubmit: (payload: ServiceInput) => Promise<void>;
  service: AdminData["services"][number];
}) {
  const [form, setForm] = useState({
    categoryId: service.categoryId ?? "",
    name: service.name,
    price: String(service.price),
    duration: String(service.duration),
    description: service.description ?? "",
    active: service.active,
    employeeIds: service.employeeIds
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds
    });
  }

  return (
    <Panel title={`Edit service: ${service.name}`}>
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Category</span>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Price</span>
          <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        </label>
        <label>
          <span>Duration, min</span>
          <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
        </label>
        <label>
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <EmployeeSelector
          employees={employees}
          selectedIds={form.employeeIds}
          onChange={(employeeIds) => setForm({ ...form, employeeIds })}
        />
        {form.employeeIds.length === 0 ? <small className="form-note">Assign at least one specialist so clients can book this service.</small> : null}
        <label className="checkbox-line">
          <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
          <span>Active service</span>
        </label>
        <div className="form-actions">
          <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
            Save service
          </button>
          <button className="booking-link light" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}

function EmployeeSelector({
  employees,
  onChange,
  selectedIds
}: {
  employees: AdminData["employees"];
  onChange: (employeeIds: string[]) => void;
  selectedIds: string[];
}) {
  function toggleEmployee(employeeId: string) {
    onChange(selectedIds.includes(employeeId) ? selectedIds.filter((id) => id !== employeeId) : [...selectedIds, employeeId]);
  }

  return (
    <div className="checkbox-group">
      <span>Specialists</span>
      {employees.length > 0 ? (
        employees.map((employee) => (
          <label className="checkbox-line" key={employee.id}>
            <input checked={selectedIds.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} type="checkbox" />
            <span>{employee.specialization ? `${employee.name} · ${employee.specialization}` : employee.name}</span>
          </label>
        ))
      ) : (
        <small>No employees available. Add an employee before publishing the service.</small>
      )}
    </div>
  );
}

function ProductForm({ onSubmit }: { onSubmit: (payload: ProductInput) => Promise<void> }) {
  const [form, setForm] = useState({ category: "", name: "", purchase: "0", sale: "0", stock: "0", min: "0" });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      category: form.category,
      name: form.name,
      purchase: Number(form.purchase),
      sale: Number(form.sale),
      stock: Number(form.stock),
      min: Number(form.min)
    });
  }

  return (
    <Panel title="New product">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Category</span>
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        </label>
        <label>
          <span>Product</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Purchase price</span>
          <input type="number" min="0" value={form.purchase} onChange={(event) => setForm({ ...form, purchase: event.target.value })} />
        </label>
        <label>
          <span>Sale price</span>
          <input type="number" min="0" value={form.sale} onChange={(event) => setForm({ ...form, sale: event.target.value })} required />
        </label>
        <label>
          <span>Stock</span>
          <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
        </label>
        <label>
          <span>Minimum stock</span>
          <input type="number" min="0" value={form.min} onChange={(event) => setForm({ ...form, min: event.target.value })} required />
        </label>
        <button className="primary-button admin-submit" type="submit">
          Add product
        </button>
      </form>
    </Panel>
  );
}

function SaleForm({
  products,
  clients,
  employees,
  onSubmit
}: {
  products: AdminData["products"];
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  onSubmit: (payload: SaleInput) => Promise<void>;
}) {
  const [form, setForm] = useState({ productId: products[0]?.id ?? "", quantity: "1", clientId: "", employeeId: "", paymentMethod: "cash" });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      productId: form.productId,
      quantity: Number(form.quantity),
      clientId: form.clientId,
      employeeId: form.employeeId,
      paymentMethod: form.paymentMethod as SaleInput["paymentMethod"]
    });
  }

  return (
    <Panel title="New sale">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Product</span>
          <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · stock {product.stock}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Quantity</span>
          <input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
        </label>
        <label>
          <span>Client</span>
          <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
            <option value="">no client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Employee</span>
          <select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
            <option value="">not specified</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Payment method</span>
          <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            <option value="cash">cash</option>
            <option value="card">card</option>
            <option value="blik">blik</option>
            <option value="transfer">transfer</option>
          </select>
        </label>
        <button className="primary-button admin-submit" type="submit">
          Create sale
        </button>
      </form>
    </Panel>
  );
}

function SettingsForm({ settings, onSubmit }: { settings: AdminData["settings"]; onSubmit: (payload: SettingsInput) => Promise<void> }) {
  const [openingTime = "09:00", closingTime = "18:00"] = settings.hours.split("-");
  const [form, setForm] = useState({
    salonName: settings.salonName,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    logoUrl: settings.logoUrl,
    openingTime,
    closingTime
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(form);
  }

  return (
    <Panel title="Salon settings">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Salon name</span>
          <input value={form.salonName} onChange={(event) => setForm({ ...form, salonName: event.target.value })} required />
        </label>
        <label>
          <span>Phone</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          <span>Address</span>
          <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </label>
        <label>
          <span>Logo</span>
          <input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} />
        </label>
        <label>
          <span>Opening</span>
          <input value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} />
        </label>
        <label>
          <span>Closing</span>
          <input value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} />
        </label>
        <button className="primary-button admin-submit" type="submit">
          Save settings
        </button>
      </form>
    </Panel>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="admin-panel">
      <header className="panel-header">
        <h2>{title}</h2>
        {action ? (
          <button className="panel-action" type="button">
            <Plus aria-hidden="true" size={16} />
            {action}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function FormPanel({ title, fields }: { title: string; fields: string[] }) {
  return (
    <Panel title={title}>
      <form className="admin-form">
        {fields.map((field) => (
          <label key={field}>
            <span>{field}</span>
            {field.toLowerCase().includes("comment") || field.toLowerCase().includes("description") ? <textarea rows={3} /> : <input />}
          </label>
        ))}
        <button className="primary-button admin-submit" type="button">
          Save
        </button>
      </form>
    </Panel>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<React.ReactNode>> }) {
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

function InfoList({ items }: { items: Array<[string, string]> }) {
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

function InlineActions({ labels, onAction }: { labels: string[]; onAction?: (label: string) => void }) {
  return (
    <div className="inline-actions">
      {labels.map((label) => {
        const Icon = label === "Delete" ? Trash2 : label === "Hide" ? EyeOff : Edit3;
        return (
          <button aria-label={label} key={label} onClick={() => onAction?.(label)} title={label} type="button">
            <Icon aria-hidden="true" size={15} />
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusLabels: Record<string, string> = {
    scheduled: "scheduled",
    completed: "completed",
    cancelled: "cancelled",
    no_show: "no-show",
    pending: "pending",
    paid: "paid",
    refunded: "refunded"
  };

  return <span className={`status-badge ${status}`}>{statusLabels[status] ?? status}</span>;
}

function BookingView({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [client, setClient] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [clientComment, setClientComment] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "success">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchServices()
      .then((data) => {
        setServices(data);
        setStatus("idle");
      })
      .catch((loadError: Error) => {
        setError(loadError.message);
        setStatus("idle");
      });
  }, []);

  useEffect(() => {
    setSelectedEmployeeId("");
    setSelectedSlot(null);
    setSlots([]);

    fetchEmployees(selectedServiceIds)
      .then(setEmployees)
      .catch((loadError: Error) => setError(loadError.message));
  }, [selectedServiceIds]);

  useEffect(() => {
    setSelectedSlot(null);

    if (!selectedEmployeeId || selectedServiceIds.length === 0 || !selectedDate) {
      setSlots([]);
      return;
    }

    fetchAvailability(selectedEmployeeId, selectedServiceIds, selectedDate)
      .then(setSlots)
      .catch((loadError: Error) => setError(loadError.message));
  }, [selectedEmployeeId, selectedServiceIds, selectedDate]);

  const selectedServices = useMemo(
    () => services.filter((service) => selectedServiceIds.includes(service.id)),
    [services, selectedServiceIds]
  );

  const groupedServices = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; description: string | null; services: Service[] }>();

    for (const service of services) {
      const groupId = service.category?.id ?? "uncategorized";
      const groupName = service.category?.name ?? "Other services";
      const groupDescription = service.category?.description ?? null;
      const existing = groups.get(groupId);

      if (existing) {
        existing.services.push(service);
      } else {
        groups.set(groupId, { id: groupId, name: groupName, description: groupDescription, services: [service] });
      }
    }

    return [...groups.values()];
  }, [services]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  const total = selectedServices.reduce(
    (summary, service) => ({
      duration: summary.duration + service.durationMinutes,
      price: summary.price + service.price
    }),
    { duration: 0, price: 0 }
  );

  function toggleService(id: string) {
    setError("");
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedSlot) {
      setError("Choose an available time.");
      return;
    }

    setStatus("saving");

    try {
      await createAppointment({
        employeeId: selectedEmployeeId,
        serviceIds: selectedServiceIds,
        startTime: selectedSlot.startTime,
        client,
        clientComment: clientComment || undefined
      });
      setStatus("success");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create the appointment.");
      setStatus("idle");
    }
  }

  if (status === "success") {
    return (
      <main className="success-screen">
        <section className="success-panel document-frame">
          <div className="sl-logo compact" aria-hidden="true">
            <span>S</span>
            <span>L</span>
          </div>
          <div className="success-icon">
            <Check aria-hidden="true" size={30} />
          </div>
          <p className="eyebrow">SL Color Studio</p>
          <h1>Appointment confirmed</h1>
          <p>
            {client.firstName}, your visit is reserved for {selectedSlot?.label}, {selectedDate}.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            New appointment
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <button className="mode-switch" onClick={onOpenAdmin} type="button">
        Admin CRM
      </button>
      <section className="booking-document document-frame">
        <aside className="brand-column">
          <header className="brand-card">
            <div className="sl-logo" aria-hidden="true">
              <span>S</span>
              <span>L</span>
            </div>
            <div>
              <p className="studio-name">Color Studio</p>
              <div className="brand-rule" />
            </div>
          </header>

          <section className="contact-panel">
            <div className="contact-line">
              <Phone aria-hidden="true" size={18} />
              <span>+38 (050) 23 03 408</span>
            </div>
            <div className="contact-line">
              <MapPin aria-hidden="true" size={18} />
              <span>Brody, Stusa St. 2</span>
            </div>
            <div className="contact-line">
              <Mail aria-hidden="true" size={18} />
              <span>sl.color.studio@example.com</span>
            </div>
          </section>

          <section className="price-list">
            <div className="section-heading">
              <h1>Price List</h1>
              <span>Online booking</span>
            </div>

            <div className="price-box">
              <div className="price-title">
                <Scissors aria-hidden="true" size={20} />
                <h2>Services</h2>
              </div>

              <div className="service-list">
                {status === "loading" ? <p className="empty-state">Loading services...</p> : null}
                {groupedServices.map((group) => (
                  <div className="service-category" key={group.id}>
                    <div className="service-category-heading">
                      <h3>{group.name}</h3>
                      {group.description ? <small>{group.description}</small> : null}
                    </div>
                    {group.services.map((service) => {
                      const selected = selectedServiceIds.includes(service.id);
                      const copy = serviceCopy[service.name];

                      return (
                        <button
                          className={selected ? "service-row selected" : "service-row"}
                          key={service.id}
                          onClick={() => toggleService(service.id)}
                          type="button"
                        >
                          <span className="service-text">
                            <strong>{copy?.name ?? service.name}</strong>
                            <small>{copy?.description ?? service.description ?? "individual consultation"}</small>
                          </span>
                          <span className="service-meta">
                            <strong>{bookingMoney.format(service.price)}</strong>
                            <small>{service.durationMinutes} min</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>

        <section className="form-column">
          <div className="form-heading">
            <p className="eyebrow">Online booking</p>
            <h2>Choose an employee and time</h2>
          </div>

          {error ? <div className="alert">{error}</div> : null}

          <form onSubmit={handleSubmit} className="booking-form">
            <section className="form-section">
              <label>
                <span className="field-label">
                  <UserRound aria-hidden="true" size={16} />
                  Employee
                </span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  disabled={selectedServiceIds.length === 0}
                  required
                >
                  <option value="">Choose an employee</option>
                  {employees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.firstName} {employee.lastName} · {employee.specialization}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="field-label">
                  <CalendarDays aria-hidden="true" size={16} />
                  Date
                </span>
                <input
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  required
                />
              </label>
            </section>

            <section className="form-section">
              <div className="field-label">
                <Clock aria-hidden="true" size={16} />
                Available time
              </div>
              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    className={selectedSlot?.startTime === slot.startTime ? "slot selected" : "slot"}
                    key={slot.startTime}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.label}
                  </button>
                ))}
                {selectedEmployeeId && slots.length === 0 ? <p className="empty-state">No available times for this date.</p> : null}
                {!selectedEmployeeId ? <p className="empty-state">Choose a service and employee first.</p> : null}
              </div>
            </section>

            <section className="form-section client-grid">
              <label>
                <span>First name</span>
                <input
                  value={client.firstName}
                  onChange={(event) => setClient({ ...client, firstName: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  value={client.lastName}
                  onChange={(event) => setClient({ ...client, lastName: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Phone</span>
                <input value={client.phone} onChange={(event) => setClient({ ...client, phone: event.target.value })} required />
              </label>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={client.email}
                  onChange={(event) => setClient({ ...client, email: event.target.value })}
                />
              </label>
            </section>

            <label className="full-width">
              <span>Comment</span>
              <textarea value={clientComment} onChange={(event) => setClientComment(event.target.value)} rows={3} />
            </label>

            <footer className="booking-footer">
              <div className="summary">
                <span>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "No employee selected"}</span>
                <strong>{selectedServices.length > 0 ? bookingMoney.format(total.price) : "Choose services"}</strong>
                <small>{total.duration > 0 ? `${total.duration} min total` : "Select services from the price list"}</small>
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  status === "loading" ||
                  status === "saving" ||
                  selectedServiceIds.length === 0 ||
                  !selectedEmployeeId ||
                  !selectedSlot
                }
              >
                {status === "saving" ? "Booking..." : "Confirm appointment"}
              </button>
            </footer>
          </form>
        </section>
      </section>
    </main>
  );
}
