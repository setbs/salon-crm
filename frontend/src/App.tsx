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

const bookingMoney = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

const adminMoney = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

const serviceCopy: Record<string, { name: string; description: string }> = {
  "Women's haircut": {
    name: "Жіноча стрижка",
    description: "консультація / миття / укладка"
  },
  "Classic manicure": {
    name: "Класичний манікюр",
    description: "форма / кутикула / покриття"
  },
  "Hair coloring": {
    name: "Фарбування волосся",
    description: "консультація / повне фарбування"
  },
  "Жіноча стрижка": {
    name: "Жіноча стрижка",
    description: "консультація / миття / укладка"
  },
  "Класичний манікюр": {
    name: "Класичний манікюр",
    description: "форма / кутикула / покриття"
  },
  "Фарбування волосся": {
    name: "Фарбування волосся",
    description: "консультація / повне фарбування"
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
  { id: "dashboard", label: "Дашборд", icon: LayoutDashboard },
  { id: "calendar", label: "Календар", icon: CalendarDays },
  { id: "clients", label: "Клієнти", icon: UsersRound },
  { id: "services", label: "Послуги", icon: Scissors },
  { id: "employees", label: "Працівники", icon: UserRound },
  { id: "portfolio", label: "Портфоліо", icon: Camera },
  { id: "products", label: "Товари", icon: Package },
  { id: "sales", label: "Продажі", icon: ShoppingCart },
  { id: "payments", label: "Оплати", icon: CreditCard },
  { id: "reviews", label: "Відгуки", icon: Star },
  { id: "settings", label: "Налаштування", icon: Settings }
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
      setError(loginError instanceof Error ? loginError.message : "Не вдалося увійти.");
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
        <h1>Вхід у CRM</h1>
        {isCheckingAuth ? <div className="admin-panel">Перевірка сесії...</div> : null}
        {error ? <div className="admin-alert">{error}</div> : null}
        <form className="admin-form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input autoComplete="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span>Пароль</span>
            <input
              autoComplete="current-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>
          <button className="primary-button admin-submit" disabled={isSubmitting || isCheckingAuth} type="submit">
            {isSubmitting ? "Вхід..." : "Увійти"}
          </button>
        </form>
        <button className="booking-link light" onClick={onOpenBooking} type="button">
          Перейти до онлайн-запису
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
      setAdminError(error instanceof Error ? error.message : "Невідома помилка адмінського API");
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
      setActionMessage("Зміни збережено.");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Не вдалося виконати дію.");
    }
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">SL</div>
          <div>
            <strong>Color Studio</strong>
            <span>{user.role === "ADMIN" ? "Головний адмін" : "Працівник CRM"}</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Адмін навігація">
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
          Відкрити онлайн-запис
        </button>
        <button className="booking-link" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={16} />
          Вийти
        </button>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">MVP адмінки</p>
            <h1>{visibleNav.find((item) => item.id === activeSection)?.label}</h1>
            <span className="admin-userline">{user.name}</span>
          </div>
          <div className="admin-search">
            <Search aria-hidden="true" size={17} />
            <input placeholder="Пошук у CRM" />
          </div>
        </header>

        {adminError ? <div className="admin-alert">Не вдалося виконати дію: {adminError}</div> : null}
        {actionMessage ? <div className="admin-success">{actionMessage}</div> : null}
        {isLoadingAdmin || !adminData ? (
          <div className="admin-panel">Завантаження CRM даних...</div>
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
    return <ServicesSection services={data.services} categories={data.serviceCategories} runAction={runAction} />;
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
      <MetricCard label="Сьогодні записів" value={String(dashboard.todayAppointments)} note="записи з PostgreSQL" />
      <MetricCard label="Дохід за день" value={adminMoney.format(dashboard.dailyRevenue)} note="оплачені послуги + косметика" />
      <MetricCard
        label="Найближчий запис"
        value={dashboard.nextAppointment?.time ?? "-"}
        note={dashboard.nextAppointment ? `${dashboard.nextAppointment.client}, ${dashboard.nextAppointment.service}` : "немає майбутніх записів"}
      />
      <MetricCard label="Низький залишок" value={String(dashboard.lowStockProducts)} note="товари потребують закупівлі" />

      <Panel title="Сьогоднішні записи" action="Створити запис">
        <DataTable
          columns={["Час", "Клієнт", "Послуга", "Майстер", "Статус"]}
          rows={appointments.map((item) => [item.time, item.client, item.service, item.master, <StatusBadge status={item.status} />])}
        />
      </Panel>

      <Panel title="Потрібно потім">
        <div className="feature-list">
          <span>сторінка "Про салон"</span>
          <span>публічний каталог товарів</span>
          <span>витрати продуктів на послуги</span>
          <span>витратні матеріали тільки для адміна</span>
          <span>відгуки у публічному меню</span>
          <span>експорт записів у CSV</span>
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
      <Panel title="Календар" action="Створити запис вручну">
        <div className="segmented-control" aria-label="Перегляд календаря">
          <button className="active" type="button">
            День
          </button>
          <button type="button">Тиждень</button>
          <button type="button">Місяць</button>
        </div>
        <DataTable
          columns={["Час", "Клієнт", "Послуга", "Майстер", "Коментар", "Дії", "Статус"]}
          rows={appointments.map((item) => [
            item.time,
            item.client,
            item.service,
            item.master,
            item.comment || "-",
            <InlineActions
              labels={["Завершити", "Не прийшов", "Скасувати"]}
              onAction={(label) =>
                runAction(() =>
                  updateAdminAppointment(item.id, {
                    status: label === "Завершити" ? "completed" : label === "Не прийшов" ? "no_show" : "cancelled"
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
    <Panel title="Новий запис">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Майстер</span>
          <select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <div className="checkbox-group">
          <span>Послуги</span>
          {activeServices.map((service) => (
            <label className="checkbox-line" key={service.id}>
              <input checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} type="checkbox" />
              <span>
                {service.name} · {service.duration} хв · {adminMoney.format(service.price)}
              </span>
            </label>
          ))}
        </div>
        <div className="form-section">
          <label>
            <span>Дата</span>
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
          </label>
          <label>
            <span>Час</span>
            <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
          </label>
        </div>
        <label>
          <span>Клієнт</span>
          <select value={form.clientMode === "existing" ? form.clientId : "new"} onChange={(event) => setForm({ ...form, clientMode: event.target.value === "new" ? "new" : "existing", clientId: event.target.value })}>
            <option value="new">Новий клієнт</option>
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
              <span>Ім'я</span>
              <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            </label>
            <label>
              <span>Прізвище</span>
              <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
            </label>
            <label>
              <span>Телефон</span>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
          </div>
        ) : null}
        <label>
          <span>Коментар клієнта</span>
          <textarea value={form.clientComment} onChange={(event) => setForm({ ...form, clientComment: event.target.value })} rows={3} />
        </label>
        <label>
          <span>Коментар до візиту</span>
          <textarea value={form.employeeComment} onChange={(event) => setForm({ ...form, employeeComment: event.target.value })} rows={3} />
        </label>
        <button className="primary-button admin-submit" disabled={serviceIds.length === 0 || !form.employeeId} type="submit">
          Створити запис
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
    <Panel title="Перенести запис">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Запис</span>
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
            <span>Нова дата</span>
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
          </label>
          <label>
            <span>Новий час</span>
            <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
          </label>
        </div>
        <label>
          <span>Коментар до перенесення</span>
          <textarea value={form.employeeComment} onChange={(event) => setForm({ ...form, employeeComment: event.target.value })} rows={3} />
        </label>
        <button className="primary-button admin-submit" disabled={!selected} type="submit">
          Перенести
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
    <Panel title="Коментар до візиту">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Запис</span>
          <select value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}>
            {appointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointment.time} · {appointment.client}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Внутрішній коментар</span>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} />
        </label>
        <button className="primary-button admin-submit" disabled={!selected} type="submit">
          Зберегти коментар
        </button>
      </form>
    </Panel>
  );
}

function ClientsSection({ clients }: { clients: AdminData["clients"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Клієнти" action="Додати клієнта">
        <div className="admin-search wide">
          <Search aria-hidden="true" size={17} />
          <input placeholder="Ім'я, телефон або email" />
        </div>
        <DataTable
          columns={["Клієнт", "Телефон", "Email", "Візити", "Витрачено"]}
          rows={clients.map((item) => [item.name, item.phone, item.email, item.visits, adminMoney.format(item.spent)])}
        />
      </Panel>
      <Panel title="Картка клієнта">
        <InfoList
          items={[
            ["Історія відвідувань", "8 візитів"],
            ["Коментарі", clients[0]?.comment || "немає коментарів"],
            ["Історія покупок", clients[0] ? `${adminMoney.format(clients[0].spent)} загалом` : "немає даних"]
          ]}
        />
      </Panel>
    </div>
  );
}

function ServicesSection({
  services,
  categories,
  runAction
}: {
  services: AdminData["services"];
  categories: AdminData["serviceCategories"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-grid">
      <Panel title="Послуги" action="Додати послугу">
        <DataTable
          columns={["Категорія", "Назва", "Ціна", "Тривалість", "Опис", "Статус"]}
          rows={services.map((item) => [
            item.category?.name ?? "Без категорії",
            item.name,
            adminMoney.format(item.price),
            `${item.duration} хв`,
            item.description,
            <InlineActions
              labels={[item.active ? "Вимкнути" : "Увімкнути"]}
              onAction={() => runAction(() => updateAdminService(item.id, { active: !item.active }))}
            />
          ])}
        />
      </Panel>
      <Panel title="Категорії послуг" action="Додати категорію">
        <InfoList
          items={categories.map((category) => [
            category.name,
            `${category.description ?? "без опису"} · ${category.active ? "активна" : "вимкнена"}`
          ])}
        />
        <div className="category-actions">
          {categories.map((category) => (
            <InlineActions
              key={category.id}
              labels={[category.active ? "Вимкнути" : "Увімкнути"]}
              onAction={() => runAction(() => updateAdminServiceCategory(category.id, { active: !category.active }))}
            />
          ))}
        </div>
      </Panel>
      <ServiceCategoryForm onSubmit={(payload) => runAction(() => createAdminServiceCategory(payload))} />
      <ServiceForm categories={categories} onSubmit={(payload) => runAction(() => createAdminService(payload))} />
    </div>
  );
}

function EmployeesSection({ employees }: { employees: AdminData["employees"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Працівники" action="Додати працівника">
        <DataTable
          columns={["Ім'я", "Спеціалізація", "Робочі години", "Відпустка/вихідний", "Статус"]}
          rows={employees.map((item) => [item.name, item.specialization, item.hours, item.timeOff, item.active ? "активний" : "вимкнений"])}
        />
      </Panel>
      <FormPanel title="Профіль працівника" fields={["Ім'я", "Спеціалізація", "Робочі години", "Відпустка/вихідний", "Увімкнути працівника"]} />
    </div>
  );
}

function PortfolioSection({ portfolio }: { portfolio: AdminData["portfolio"] }) {
  return (
    <div className="admin-grid">
      <Panel title="Портфоліо" action="Завантажити фото">
        <div className="portfolio-grid">
          {portfolio.map((item) => (
            <article className="portfolio-card" key={item.title}>
              <div className="portfolio-preview">
                <Camera aria-hidden="true" />
              </div>
              <strong>{item.title}</strong>
              <span>{item.master}</span>
              <InlineActions labels={[item.visible ? "Сховати" : "Показати", "Видалити"]} />
            </article>
          ))}
        </div>
      </Panel>
      <FormPanel title="Опис роботи" fields={["Фото", "Опис", "Майстер", "Видимість"]} />
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
      <Panel title="Косметика / склад" action="Додати товар">
        <DataTable
          columns={["Категорія", "Товар", "Закупка", "Продаж", "Залишок", "Мін. залишок"]}
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
      <Panel title="Історія руху складу">
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
      <Panel title="Продажі косметики" action="Створити продаж">
        <DataTable
          columns={["Товар", "Кількість", "Клієнт", "Оплата", "Сума"]}
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
      <Panel title="Оплати" action="Додати оплату">
        <DataTable
          columns={["Джерело", "Клієнт", "Спосіб", "Статус", "Сума", "Дії"]}
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
      <Panel title="Підтримувані способи">
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
      <Panel title="Відгуки">
        <DataTable columns={["Клієнт", "Оцінка", "Коментар"]} rows={reviews.map((item) => [item.client, `${item.rating}/5`, item.text])} />
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
      <Panel title="Поточні дані">
        <InfoList
          items={[
            ["Назва", settings.salonName],
            ["Телефон", settings.phone],
            ["Email", settings.email],
            ["Адреса", settings.address],
            ["Години", settings.hours]
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
    <Panel title="Нова категорія">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Назва</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Опис</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <label className="checkbox-line">
          <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
          <span>Активна категорія</span>
        </label>
        <button className="primary-button admin-submit" type="submit">
          Додати категорію
        </button>
      </form>
    </Panel>
  );
}

function ServiceForm({
  categories,
  onSubmit
}: {
  categories: AdminData["serviceCategories"];
  onSubmit: (payload: ServiceInput) => Promise<void>;
}) {
  const [form, setForm] = useState({ categoryId: categories[0]?.id ?? "", name: "", price: "0", duration: "60", description: "", active: true });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      duration: Number(form.duration),
      description: form.description,
      active: form.active
    });
  }

  return (
    <Panel title="Нова послуга">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Категорія</span>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
            <option value="">Без категорії</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Назва</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Ціна</span>
          <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        </label>
        <label>
          <span>Тривалість, хв</span>
          <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
        </label>
        <label>
          <span>Опис</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
        </label>
        <label className="checkbox-line">
          <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
          <span>Активна послуга</span>
        </label>
        <button className="primary-button admin-submit" type="submit">
          Додати послугу
        </button>
      </form>
    </Panel>
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
    <Panel title="Новий товар">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Категорія</span>
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        </label>
        <label>
          <span>Товар</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          <span>Ціна закупки</span>
          <input type="number" min="0" value={form.purchase} onChange={(event) => setForm({ ...form, purchase: event.target.value })} />
        </label>
        <label>
          <span>Ціна продажу</span>
          <input type="number" min="0" value={form.sale} onChange={(event) => setForm({ ...form, sale: event.target.value })} required />
        </label>
        <label>
          <span>Залишок</span>
          <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
        </label>
        <label>
          <span>Мінімальний залишок</span>
          <input type="number" min="0" value={form.min} onChange={(event) => setForm({ ...form, min: event.target.value })} required />
        </label>
        <button className="primary-button admin-submit" type="submit">
          Додати товар
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
    <Panel title="Новий продаж">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Товар</span>
          <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · залишок {product.stock}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Кількість</span>
          <input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
        </label>
        <label>
          <span>Клієнт</span>
          <select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
            <option value="">без клієнта</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Працівник</span>
          <select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })}>
            <option value="">не вказано</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Спосіб оплати</span>
          <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
            <option value="cash">cash</option>
            <option value="card">card</option>
            <option value="blik">blik</option>
            <option value="transfer">transfer</option>
          </select>
        </label>
        <button className="primary-button admin-submit" type="submit">
          Створити продаж
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
    <Panel title="Налаштування салону">
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Назва салону</span>
          <input value={form.salonName} onChange={(event) => setForm({ ...form, salonName: event.target.value })} required />
        </label>
        <label>
          <span>Телефон</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          <span>Адреса</span>
          <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </label>
        <label>
          <span>Логотип</span>
          <input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} />
        </label>
        <label>
          <span>Відкриття</span>
          <input value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} />
        </label>
        <label>
          <span>Закриття</span>
          <input value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} />
        </label>
        <button className="primary-button admin-submit" type="submit">
          Зберегти налаштування
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
            {field.toLowerCase().includes("коментар") || field.toLowerCase().includes("опис") ? <textarea rows={3} /> : <input />}
          </label>
        ))}
        <button className="primary-button admin-submit" type="button">
          Зберегти
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
        const Icon = label === "Видалити" ? Trash2 : label === "Сховати" ? EyeOff : Edit3;
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
    scheduled: "заплановано",
    completed: "завершено",
    cancelled: "скасовано",
    no_show: "не прийшов",
    pending: "очікує",
    paid: "оплачено",
    refunded: "повернено"
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
      const groupName = service.category?.name ?? "Інші послуги";
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
      setError("Оберіть доступний час.");
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
      setError(saveError instanceof Error ? saveError.message : "Не вдалося створити запис.");
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
          <h1>Запис підтверджено</h1>
          <p>
            {client.firstName}, ваш візит зарезервовано на {selectedSlot?.label}, {selectedDate}.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Новий запис
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <button className="mode-switch" onClick={onOpenAdmin} type="button">
        Адмін CRM
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
              <span>м. Броди, вул. Стуса 2</span>
            </div>
            <div className="contact-line">
              <Mail aria-hidden="true" size={18} />
              <span>sl.color.studio@example.com</span>
            </div>
          </section>

          <section className="price-list">
            <div className="section-heading">
              <h1>Прайс</h1>
              <span>Запис онлайн</span>
            </div>

            <div className="price-box">
              <div className="price-title">
                <Scissors aria-hidden="true" size={20} />
                <h2>Послуги</h2>
              </div>

              <div className="service-list">
                {status === "loading" ? <p className="empty-state">Завантаження послуг...</p> : null}
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
                            <small>{copy?.description ?? service.description ?? "індивідуальна консультація"}</small>
                          </span>
                          <span className="service-meta">
                            <strong>{bookingMoney.format(service.price)}</strong>
                            <small>{service.durationMinutes} хв</small>
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
            <p className="eyebrow">Онлайн бронювання</p>
            <h2>Оберіть майстра та час</h2>
          </div>

          {error ? <div className="alert">{error}</div> : null}

          <form onSubmit={handleSubmit} className="booking-form">
            <section className="form-section">
              <label>
                <span className="field-label">
                  <UserRound aria-hidden="true" size={16} />
                  Майстер
                </span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  disabled={selectedServiceIds.length === 0}
                  required
                >
                  <option value="">Оберіть майстра</option>
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
                  Дата
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
                Доступний час
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
                {selectedEmployeeId && slots.length === 0 ? <p className="empty-state">На цю дату вільних годин немає.</p> : null}
                {!selectedEmployeeId ? <p className="empty-state">Спочатку оберіть послугу та майстра.</p> : null}
              </div>
            </section>

            <section className="form-section client-grid">
              <label>
                <span>Ім'я</span>
                <input
                  value={client.firstName}
                  onChange={(event) => setClient({ ...client, firstName: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Прізвище</span>
                <input
                  value={client.lastName}
                  onChange={(event) => setClient({ ...client, lastName: event.target.value })}
                  required
                />
              </label>
              <label>
                <span>Телефон</span>
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
              <span>Коментар</span>
              <textarea value={clientComment} onChange={(event) => setClientComment(event.target.value)} rows={3} />
            </label>

            <footer className="booking-footer">
              <div className="summary">
                <span>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "Майстра не обрано"}</span>
                <strong>{selectedServices.length > 0 ? bookingMoney.format(total.price) : "Оберіть послуги"}</strong>
                <small>{total.duration > 0 ? `${total.duration} хв загалом` : "Прайс зліва активний"}</small>
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
                {status === "saving" ? "Бронювання..." : "Підтвердити запис"}
              </button>
            </footer>
          </form>
        </section>
      </section>
    </main>
  );
}
