import {
  ArrowLeft,
  ArrowRight,
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
  deleteAdminServiceCategory,
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
  type MeasurementUnit,
  type ProductInput,
  type SaleInput,
  type Service,
  type ServiceCategoryInput,
  type ServiceInput,
  type SettingsInput,
  type Slot
} from "./api";

const adminMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0
});

const plainHryvnia = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

type DisplayPrice = {
  price: number;
  priceFrom?: number | null;
  priceTo?: number | null;
};

function formatHryvnia(value: number) {
  return `${plainHryvnia.format(value)} ₴`;
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

function formatSelectedServicesPrice(services: DisplayPrice[], fallbackPrice: number) {
  if (services.length === 0 || services.every((service) => service.priceFrom === null && service.priceTo === null)) {
    return formatHryvnia(fallbackPrice);
  }

  const from = services.reduce((sum, service) => sum + (service.priceFrom ?? service.price), 0);
  const to = services.reduce((sum, service) => sum + (service.priceTo ?? service.priceFrom ?? service.price), 0);

  return from === to ? formatHryvnia(from) : `${plainHryvnia.format(from)} - ${plainHryvnia.format(to)} ₴`;
}

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

type AppMode = "home" | "admin" | "booking";
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
  const [mode, setMode] = useState<AppMode>("home");
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
      {mode === "home" ? (
        <HomeView onOpenAdmin={() => setMode("admin")} onOpenBooking={() => setMode("booking")} />
      ) : mode === "admin" ? (
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
        <BookingView onOpenAdmin={() => setMode("admin")} onOpenHome={() => setMode("home")} />
      )}
    </>
  );
}

const homeImages = {
  hero: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1800&q=82",
  color: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=82",
  manicure: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=82",
  care: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=82"
};

const homePortfolio = [
  { title: "Soft blonde color", image: homeImages.color },
  { title: "Clean manicure finish", image: homeImages.manicure },
  { title: "Hair care consultation", image: homeImages.care }
];

type HomePriceCategory = {
  id: string;
  name: string;
  services: Array<{
    id: string;
    name: string;
    description?: string | null;
    durationLabel?: string;
    priceLabel: string;
  }>;
};

const homePriceFallback: HomePriceCategory[] = [
  {
    id: "fallback-hair",
    name: "Hair care",
    services: [
      { id: "fallback-cut", name: "Women's haircut", priceLabel: "500 - 800 ₴" },
      { id: "fallback-color", name: "Hair coloring", priceLabel: "1,800 - 4,500 ₴" },
      { id: "fallback-care", name: "Hair reconstruction", priceLabel: "1,200 - 2,500 ₴" }
    ]
  },
  {
    id: "fallback-nails",
    name: "Nail care",
    services: [
      { id: "fallback-manicure", name: "Classic manicure", priceLabel: "400 - 600 ₴" },
      { id: "fallback-polish", name: "Gel polish", priceLabel: "650 ₴" },
      { id: "fallback-care-nails", name: "Nail care consultation", priceLabel: "300 - 350 ₴" }
    ]
  }
];

function HomeView({ onOpenAdmin, onOpenBooking }: { onOpenAdmin: () => void; onOpenBooking: () => void }) {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch(() => setServices([]));
  }, []);

  const priceCategories = useMemo<HomePriceCategory[]>(() => {
    if (services.length === 0) {
      return homePriceFallback;
    }

    const groups = new Map<string, HomePriceCategory>();

    for (const service of services) {
      const categoryId = service.category?.id ?? "uncategorized";
      const categoryName = service.category?.name ?? "Other services";
      const existing = groups.get(categoryId);
      const item = {
        id: service.id,
        name: service.name,
        description: service.description,
        durationLabel: `${service.durationMinutes} min`,
        priceLabel: formatServicePrice(service)
      };

      if (existing) {
        existing.services.push(item);
      } else {
        groups.set(categoryId, {
          id: categoryId,
          name: categoryName,
          services: [item]
        });
      }
    }

    return [...groups.values()];
  }, [services]);

  return (
    <main className="home-shell">
      <header className="home-nav">
        <button className="home-brand-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
          <span className="home-mark">SL</span>
          <span className="cl-logo-part">Color Studio</span>
        </button>
        <nav aria-label="Public navigation">
          <a href="#about">About</a>
          <a href="#portfolio">Portfolio</a>
          <a href="#price-list">Price list</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="home-nav-actions">
          <button className="secondary-button" onClick={onOpenAdmin} type="button">
            CRM
          </button>
          <button className="primary-button" onClick={onOpenBooking} type="button">
            Book appointment
          </button>
        </div>
      </header>

      <section className="home-hero">
        <img alt="Elegant salon interior with hair styling stations" src={homeImages.hero} />
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <p className="eyebrow">SL Color Studio</p>
          <h1>Beauty salon for hair, color and nail care</h1>
          <p>A calm salon experience with attentive consultations, precise work and clear online booking.</p>
          <div className="home-hero-actions">
            <button className="primary-button" onClick={onOpenBooking} type="button">
              Book appointment
            </button>
            <a href="#price-list">View price list</a>
          </div>
        </div>
      </section>

      <section className="home-section home-about" id="about">
        <div className="home-section-heading">
          <p className="eyebrow">About salon</p>
          <h2>Focused care, clean aesthetics and a clear client path</h2>
          <p>
            SL Color Studio combines color work, hair care and nail services with a CRM workflow that keeps booking,
            schedules and client details organized.
          </p>
        </div>
        <div className="home-about-layout">
          <img alt="Hair care consultation at a beauty salon" src={homeImages.care} />
          <div className="home-about-copy">
            <p>
              The salon page stays simple for clients: learn the atmosphere, see selected work, check contacts, and open
              the price list when they are ready to choose a service.
            </p>
            <div className="home-about-facts">
              <span>Online booking</span>
              <span>Structured price list</span>
              <span>CRM-ready workflow</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section" id="portfolio">
        <div className="home-section-heading">
          <p className="eyebrow">Portfolio</p>
          <h2>Selected work</h2>
          <p>Visual proof matters in beauty services. The gallery can later be connected to CRM portfolio uploads.</p>
        </div>
        <div className="home-portfolio-grid">
          {homePortfolio.map((item) => (
            <figure key={item.title}>
              <img alt={item.title} src={item.image} />
              <figcaption>{item.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="home-price-section" id="price-list">
        <div className="home-price-watermark" aria-hidden="true">
          Price list
        </div>
        <header className="home-price-heading">
          <p className="eyebrow">Services</p>
          <h2>PRICE LIST</h2>
        </header>

        <div className="home-price-list">
          {priceCategories.map((category) => (
            <article className="price-category" key={category.id}>
              <div className="price-category-heading">
                <h3>{category.name}</h3>
                <span aria-hidden="true" />
              </div>
              <div className="price-category-frame">
                <div className="price-category-items">
                  {category.services.map((service) => (
                    <div className="price-row" key={service.id}>
                      <span className="price-service">
                        <strong>{service.name}</strong>
                        {service.description ? <small>{service.description}</small> : null}
                      </span>
                      <span className="price-value">
                        {service.priceLabel}
                        {service.durationLabel ? <small>{service.durationLabel}</small> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="home-price-signature">
          <div className="sl-logo compact" aria-hidden="true">
            <span>S</span>
            <span>L</span>
          </div>
          <span id="color-studio">Color Studio</span>
        </div>
        <button className="primary-button home-centered-action" onClick={onOpenBooking} type="button">
          Book appointment
        </button>
      </section>

      <section className="home-section home-contact" id="contact">
        <div className="home-section-heading">
          <p className="eyebrow">Contact</p>
          <h2>Visit SL Color Studio</h2>
          <p>Book online or contact the salon directly.</p>
        </div>
        <div className="home-contact-grid">
          <div>
            <Phone aria-hidden="true" size={20} />
            <strong>+38 (050) 23 03 408</strong>
            <span>Phone</span>
          </div>
          <div>
            <MapPin aria-hidden="true" size={20} />
            <strong>Brody, Stusa St. 2</strong>
            <span>Address</span>
          </div>
          <div>
            <Mail aria-hidden="true" size={20} />
            <strong>sl.color.studio@example.com</strong>
            <span>Email</span>
          </div>
          <div>
            <Clock aria-hidden="true" size={20} />
            <strong>09:00 - 18:00</strong>
            <span>Working hours</span>
          </div>
        </div>
        <button className="primary-button home-centered-action" onClick={onOpenBooking} type="button">
          Book appointment
        </button>
      </section>
    </main>
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
    return (
      <ServicesSection
        services={data.services}
        categories={data.serviceCategories}
        employees={data.employees}
        products={data.products}
        runAction={runAction}
      />
    );
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
                {service.name} · {service.duration} min · {formatServicePrice(service)}
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
  products,
  runAction
}: {
  services: AdminData["services"];
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
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
          columns={["Category", "Name", "Specialists", "Price", "Duration", "Consumables", "History", "Status", "Actions"]}
          rows={filteredServices.map((item) => [
            item.category?.name ?? "Uncategorized",
            item.name,
            item.employees.length > 0 ? item.employees.map((employee) => employee.name).join(", ") : "not assigned",
            formatServicePrice(item),
            `${item.duration} min`,
            formatConsumables(item.consumables),
            item.appointmentCount > 0 ? `${item.appointmentCount} appointments` : "no appointments",
            item.active ? "active" : "disabled",
            <InlineActions
              labels={[item.active ? "Disable" : "Enable", "Edit", ...(item.canDelete ? ["Delete"] : [])]}
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
              labels={[category.active ? "Disable" : "Enable", "Edit", "Delete"]}
              onAction={(label) => {
                if (label === "Edit") {
                  setEditingCategoryId(category.id);
                  return;
                }

                if (label === "Delete") {
                  void runAction(() => deleteAdminServiceCategory(category.id));
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
      <ServiceForm categories={categories} employees={employees} products={products} onSubmit={(payload) => runAction(() => createAdminService(payload))} />
      {editingService ? (
        <ServiceEditForm
          categories={categories}
          employees={employees}
          products={products}
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
          columns={["Category", "Product", "Purchase", "Sale", "Stock", "Package", "Min. stock"]}
          rows={products.map((item) => [
            item.category,
            item.name,
            adminMoney.format(item.purchase),
            adminMoney.format(item.sale),
            item.stock <= item.min ? <span className="danger-text">{formatProductStock(item)}</span> : formatProductStock(item),
            item.contentAmount ? `${formatPlainNumber(item.contentAmount)} ${formatUnit(item.contentUnit)}` : "not set",
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
  products,
  onSubmit
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  onSubmit: (payload: ServiceInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    categoryId: categories[0]?.id ?? "",
    name: "",
    price: "0",
    priceFrom: "",
    priceTo: "",
    duration: "60",
    description: "",
    active: true,
    employeeIds: employees[0]?.id ? [employees[0].id] : [],
    consumables: [] as ConsumableFormItem[]
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      priceFrom: optionalPriceInput(form.priceFrom),
      priceTo: optionalPriceInput(form.priceTo),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds,
      consumables: toConsumablePayload(form.consumables)
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
          <span>Base price</span>
          <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        </label>
        <label>
          <span>Price from</span>
          <input type="number" min="0" value={form.priceFrom} onChange={(event) => setForm({ ...form, priceFrom: event.target.value })} />
        </label>
        <label>
          <span>Price to</span>
          <input type="number" min="0" value={form.priceTo} onChange={(event) => setForm({ ...form, priceTo: event.target.value })} />
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
        <ConsumableSelector
          items={form.consumables}
          products={products}
          onChange={(consumables) => setForm({ ...form, consumables })}
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
  products,
  onCancel,
  onSubmit,
  service
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  onCancel: () => void;
  onSubmit: (payload: ServiceInput) => Promise<void>;
  service: AdminData["services"][number];
}) {
  const [form, setForm] = useState({
    categoryId: service.categoryId ?? "",
    name: service.name,
    price: String(service.price),
    priceFrom: service.priceFrom === null ? "" : String(service.priceFrom),
    priceTo: service.priceTo === null ? "" : String(service.priceTo),
    duration: String(service.duration),
    description: service.description ?? "",
    active: service.active,
    employeeIds: service.employeeIds,
    consumables: service.consumables.map((consumable) => ({
      productId: consumable.productId,
      quantity: String(consumable.quantity),
      unit: consumable.unit
    })) as ConsumableFormItem[]
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      priceFrom: optionalPriceInput(form.priceFrom),
      priceTo: optionalPriceInput(form.priceTo),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds,
      consumables: toConsumablePayload(form.consumables)
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
          <span>Base price</span>
          <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
        </label>
        <label>
          <span>Price from</span>
          <input type="number" min="0" value={form.priceFrom} onChange={(event) => setForm({ ...form, priceFrom: event.target.value })} />
        </label>
        <label>
          <span>Price to</span>
          <input type="number" min="0" value={form.priceTo} onChange={(event) => setForm({ ...form, priceTo: event.target.value })} />
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
        <ConsumableSelector
          items={form.consumables}
          products={products}
          onChange={(consumables) => setForm({ ...form, consumables })}
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

type ConsumableFormItem = {
  productId: string;
  quantity: string;
  unit: MeasurementUnit;
};

function ConsumableSelector({
  items,
  onChange,
  products
}: {
  items: ConsumableFormItem[];
  onChange: (items: ConsumableFormItem[]) => void;
  products: AdminData["products"];
}) {
  const defaultProductId = products[0]?.id ?? "";

  function addItem() {
    if (!defaultProductId) {
      return;
    }

    onChange([...items, { productId: defaultProductId, quantity: "1", unit: "ml" }]);
  }

  function updateItem(index: number, patch: Partial<ConsumableFormItem>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="consumable-builder">
      <div className="consumable-builder-header">
        <span>Consumable cosmetics</span>
        <button className="secondary-button compact-button" disabled={!defaultProductId} onClick={addItem} type="button">
          Add item
        </button>
      </div>
      <small className="form-note">Internal service parameters for analytics. Clients do not see these values.</small>
      {products.length === 0 ? <small className="form-note">Add products first to use them as consumables.</small> : null}
      {items.map((item, index) => (
        <div className="consumable-row" key={`${item.productId}-${index}`}>
          <label>
            <span>Product</span>
            <select value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {formatProductOption(product)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Amount</span>
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={item.quantity}
              onChange={(event) => updateItem(index, { quantity: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Unit</span>
            <select value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value as MeasurementUnit })}>
              <option value="ml">ml</option>
              <option value="gram">g</option>
            </select>
          </label>
          <button aria-label="Remove consumable" className="icon-only-button" onClick={() => removeItem(index)} title="Remove" type="button">
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function toConsumablePayload(items: ConsumableFormItem[]): ServiceInput["consumables"] {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unit: item.unit
    }));
}

function optionalPriceInput(value: string) {
  return value.trim() ? Number(value) : null;
}

function formatConsumables(consumables: AdminData["services"][number]["consumables"]) {
  if (consumables.length === 0) {
    return "not set";
  }

  return consumables.map((consumable) => `${consumable.productName}: ${consumable.quantity} ${formatUnit(consumable.unit)}`).join(", ");
}

function formatProductOption(product: AdminData["products"][number]) {
  const content = product.contentAmount ? ` · ${formatPlainNumber(product.contentAmount)} ${formatUnit(product.contentUnit)}/pack` : "";
  return `${product.name}${content} · stock ${formatProductStock(product)}`;
}

function formatProductStock(product: AdminData["products"][number]) {
  if (product.stockContentAmount !== null && product.stockPackageEquivalent !== null && product.contentUnit) {
    return `${formatPlainNumber(product.stockPackageEquivalent)} packs · ${formatPlainNumber(product.stockContentAmount)} ${formatUnit(product.contentUnit)}`;
  }

  return String(product.stock);
}

function formatPlainNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(value);
}

function formatUnit(unit: MeasurementUnit | null | undefined) {
  return unit === "gram" ? "g" : "ml";
}

function ProductForm({ onSubmit }: { onSubmit: (payload: ProductInput) => Promise<void> }) {
  const [form, setForm] = useState({
    category: "",
    name: "",
    purchase: "0",
    sale: "0",
    stock: "0",
    min: "0",
    contentAmount: "",
    contentUnit: "ml" as MeasurementUnit
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      category: form.category,
      name: form.name,
      purchase: Number(form.purchase),
      sale: Number(form.sale),
      stock: Number(form.stock),
      min: Number(form.min),
      contentAmount: form.contentAmount ? Number(form.contentAmount) : undefined,
      contentUnit: form.contentAmount ? form.contentUnit : undefined
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
        <label>
          <span>Package content</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.contentAmount}
            onChange={(event) => setForm({ ...form, contentAmount: event.target.value })}
            placeholder="60"
          />
        </label>
        <label>
          <span>Content unit</span>
          <select value={form.contentUnit} onChange={(event) => setForm({ ...form, contentUnit: event.target.value as MeasurementUnit })}>
            <option value="ml">ml</option>
            <option value="gram">g</option>
          </select>
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

type BookingStep = "services" | "employee" | "datetime" | "contact";

const bookingSteps: Array<{ id: BookingStep; label: string }> = [
  { id: "services", label: "Services" },
  { id: "employee", label: "Employee" },
  { id: "datetime", label: "Date & time" },
  { id: "contact", label: "Contact" }
];

function BookingView({ onOpenAdmin, onOpenHome }: { onOpenAdmin: () => void; onOpenHome: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [activeStep, setActiveStep] = useState<BookingStep>("services");
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
      .catch(() => {
        setError("Could not load services. Check that the CRM API is running and refresh the page.");
        setStatus("idle");
      });
  }, []);

  useEffect(() => {
    setSelectedEmployeeId("");
    setSelectedSlot(null);
    setSlots([]);
    setError("");

    if (selectedServiceIds.length === 0) {
      setEmployees([]);
      setIsLoadingEmployees(false);
      return;
    }

    setIsLoadingEmployees(true);
    fetchEmployees(selectedServiceIds)
      .then(setEmployees)
      .catch(() => setError("Could not load employees for the selected services. Try again in a moment."))
      .finally(() => setIsLoadingEmployees(false));
  }, [selectedServiceIds]);

  useEffect(() => {
    let cancelled = false;

    setSelectedSlot(null);
    setError("");

    if (!selectedEmployeeId || selectedServiceIds.length === 0 || !selectedDate) {
      setSlots([]);
      setIsLoadingSlots(false);
      return;
    }

    setIsLoadingSlots(true);
    fetchAvailability(selectedEmployeeId, selectedServiceIds, selectedDate)
      .then((data) => {
        if (!cancelled) {
          setSlots(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load available times. Try another date or refresh the page.");
          setSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
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
  const serviceStepDone = selectedServiceIds.length > 0;
  const employeeStepDone = Boolean(selectedEmployeeId);
  const timeStepDone = Boolean(selectedSlot);
  const detailsStepDone = Boolean(client.firstName.trim() && client.lastName.trim() && client.phone.trim());
  const canSubmit = serviceStepDone && employeeStepDone && timeStepDone && detailsStepDone && status !== "loading" && status !== "saving";
  const activeStepIndex = bookingSteps.findIndex((step) => step.id === activeStep);

  const total = selectedServices.reduce(
    (summary, service) => ({
      duration: summary.duration + service.durationMinutes,
      price: summary.price + service.price
    }),
    { duration: 0, price: 0 }
  );

  function toggleService(id: string) {
    setError("");
    setSelectedSlot(null);
    setSelectedServiceIds((current) =>
      current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]
    );
  }

  function goToStep(step: BookingStep) {
    setError("");
    setActiveStep(step);
  }

  function continueFromServices() {
    if (selectedServiceIds.length === 0) {
      setError("Choose at least one service.");
      return;
    }

    if (isLoadingEmployees) {
      setError("Loading employees for the selected services.");
      return;
    }

    if (employees.length === 0) {
      setError("No employees are available for the selected services.");
      return;
    }

    if (employees.length === 1) {
      setSelectedEmployeeId(employees[0].id);
      setActiveStep("datetime");
      return;
    }

    setActiveStep("employee");
  }

  function chooseEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    setSelectedSlot(null);
    setError("");
    setActiveStep("datetime");
  }

  function continueFromDateTime() {
    if (!selectedEmployeeId) {
      setError("Choose an employee.");
      setActiveStep("employee");
      return;
    }

    if (!selectedSlot) {
      setError("Choose an available time.");
      return;
    }

    setError("");
    setActiveStep("contact");
  }

  function resetBooking() {
    setActiveStep("services");
    setSelectedServiceIds([]);
    setSelectedEmployeeId("");
    setSelectedDate(today);
    setSelectedSlot(null);
    setSlots([]);
    setClient({ firstName: "", lastName: "", phone: "", email: "" });
    setClientComment("");
    setError("");
    setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (selectedServiceIds.length === 0) {
      setError("Choose at least one service.");
      return;
    }

    if (!selectedEmployeeId) {
      setError("Choose an employee.");
      return;
    }

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
          <dl className="confirmation-list">
            <div>
              <dt>Services</dt>
              <dd>{selectedServices.map((service) => service.name).join(", ")}</dd>
            </div>
            <div>
              <dt>Employee</dt>
              <dd>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "Selected employee"}</dd>
            </div>
            <div>
              <dt>Date and time</dt>
              <dd>
                {selectedDate}, {selectedSlot?.label}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {formatSelectedServicesPrice(selectedServices, total.price)} · {total.duration} min
              </dd>
            </div>
          </dl>
          <div className="success-actions">
            <button className="primary-button" type="button" onClick={resetBooking}>
              Book another appointment
            </button>
            <button className="secondary-button" type="button" onClick={onOpenHome}>
              Back to website
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="booking-switches">
        <button className="mode-switch" onClick={onOpenHome} type="button">
          <ArrowLeft aria-hidden="true" size={15} />
          Website
        </button>
        <button className="mode-switch" onClick={onOpenAdmin} type="button">
          Admin CRM
        </button>
      </div>
      <section className="booking-wizard document-frame">
        <header className="wizard-header">
          <div className="wizard-brand">
            <div className="sl-logo compact" aria-hidden="true">
              <span>S</span>
              <span>L</span>
            </div>
            <div>
              <p className="eyebrow">SL Color Studio</p>
              <h1>Book your appointment</h1>
              <p>Choose a service, specialist, time, and leave your contact details.</p>
            </div>
          </div>

          <div className="wizard-contact">
            <span>
              <Phone aria-hidden="true" size={16} />
              +38 (050) 23 03 408
            </span>
            <span>
              <MapPin aria-hidden="true" size={16} />
              Brody, Stusa St. 2
            </span>
          </div>

          <nav className="wizard-steps" aria-label="Booking progress">
            {bookingSteps.map((step, index) => (
              <span className={index < activeStepIndex ? "done" : index === activeStepIndex ? "active" : ""} key={step.id}>
                {step.label}
              </span>
            ))}
          </nav>
        </header>

        {error ? <div className="alert wizard-alert">{error}</div> : null}

        {activeStep === "services" ? (
          <section className="wizard-panel">
            <div className="wizard-panel-heading">
              <p className="eyebrow">Step 1</p>
              <h2>Select services</h2>
              <p>Pick one or more services. The total duration will be calculated automatically.</p>
            </div>

            {status === "loading" ? <p className="empty-state">Loading services...</p> : null}

            <div className="wizard-service-list">
              {groupedServices.map((group) => (
                <section className="wizard-service-category" key={group.id}>
                  <div className="service-category-heading">
                    <h3>{group.name}</h3>
                    {group.description ? <small>{group.description}</small> : null}
                  </div>
                  <div className="wizard-card-grid">
                    {group.services.map((service) => {
                      const selected = selectedServiceIds.includes(service.id);
                      const copy = serviceCopy[service.name];

                      return (
                        <button
                          className={selected ? "wizard-card service-choice selected" : "wizard-card service-choice"}
                          key={service.id}
                          onClick={() => toggleService(service.id)}
                          type="button"
                        >
                          <span className="choice-check" aria-hidden="true">
                            {selected ? <Check size={16} /> : null}
                          </span>
                          <span className="service-text">
                            <strong>{copy?.name ?? service.name}</strong>
                            <small>{copy?.description ?? service.description ?? "Individual consultation"}</small>
                          </span>
                          <span className="service-choice-meta">
                            <strong>{formatServicePrice(service)}</strong>
                            <small>{service.durationMinutes} min</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <footer className="wizard-actions">
              <div className="summary">
                <span>{selectedServices.length > 0 ? `${selectedServices.length} selected` : "No services selected"}</span>
                <strong>{selectedServices.length > 0 ? formatSelectedServicesPrice(selectedServices, total.price) : "Choose services"}</strong>
                <small>{total.duration > 0 ? `${total.duration} min total` : "Start with the service list"}</small>
              </div>
              <button
                className="primary-button icon-button"
                disabled={selectedServiceIds.length === 0 || isLoadingEmployees}
                onClick={continueFromServices}
                type="button"
              >
                <span>{isLoadingEmployees ? "Loading..." : "Continue"}</span>
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </footer>
          </section>
        ) : null}

        {activeStep === "employee" ? (
          <section className="wizard-panel compact-panel">
            <div className="wizard-panel-heading">
              <p className="eyebrow">Step 2</p>
              <h2>Choose an employee</h2>
              <p>Select the specialist who will perform the chosen services.</p>
            </div>

            <div className="employee-choice-grid">
              {employees.map((employee) => (
                <button className="wizard-card employee-choice" key={employee.id} onClick={() => chooseEmployee(employee.id)} type="button">
                  <span className="employee-avatar" aria-hidden="true">
                    {employee.firstName.slice(0, 1)}
                    {employee.lastName.slice(0, 1)}
                  </span>
                  <span>
                    <strong>
                      {employee.firstName} {employee.lastName}
                    </strong>
                    <small>{employee.specialization ?? "Beauty specialist"}</small>
                  </span>
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
              ))}
            </div>

            <footer className="wizard-actions">
              <button className="secondary-button icon-button" onClick={() => goToStep("services")} type="button">
                <ArrowLeft aria-hidden="true" size={18} />
                <span>Back</span>
              </button>
            </footer>
          </section>
        ) : null}

        {activeStep === "datetime" ? (
          <section className="wizard-panel compact-panel">
            <div className="wizard-panel-heading">
              <p className="eyebrow">Step 3</p>
              <h2>Choose date and time</h2>
              <p>
                {selectedEmployee
                  ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} is selected for this visit.`
                  : "Choose when you want to visit the salon."}
              </p>
            </div>

            <div className="appointment-layout">
              <aside className="appointment-summary">
                <span>Visit summary</span>
                <strong>{selectedServices.map((service) => service.name).join(", ")}</strong>
                <small>
                  {formatSelectedServicesPrice(selectedServices, total.price)} · {total.duration} min
                </small>
                <small>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : "Employee not selected"}</small>
              </aside>

              <div className="datetime-panel">
                <label>
                  <span className="field-label">
                    <CalendarDays aria-hidden="true" size={16} />
                    Date
                  </span>
                  <input
                    type="date"
                    min={today}
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setError("");
                    }}
                    required
                  />
                </label>

                <div className="field-label">
                  <Clock aria-hidden="true" size={16} />
                  Available time
                </div>
                <div className="slot-grid roomy">
                  {isLoadingSlots ? <p className="empty-state">Checking available times...</p> : null}
                  {!isLoadingSlots
                    ? slots.map((slot) => (
                        <button
                          className={selectedSlot?.startTime === slot.startTime ? "slot selected" : "slot"}
                          key={slot.startTime}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setError("");
                          }}
                        >
                          {slot.label}
                        </button>
                      ))
                    : null}
                  {selectedEmployeeId && !isLoadingSlots && slots.length === 0 ? (
                    <p className="empty-state">No available times for this date. Try another date or employee.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <footer className="wizard-actions">
              <button className="secondary-button icon-button" onClick={() => goToStep(employees.length > 1 ? "employee" : "services")} type="button">
                <ArrowLeft aria-hidden="true" size={18} />
                <span>Back</span>
              </button>
              <button className="primary-button icon-button" disabled={!selectedSlot} onClick={continueFromDateTime} type="button">
                <span>Continue</span>
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </footer>
          </section>
        ) : null}

        {activeStep === "contact" ? (
          <section className="wizard-panel contact-step">
            <div className="contact-card">
              <div className="wizard-panel-heading">
                <p className="eyebrow">Final step</p>
                <h2>Your contact details</h2>
                <p>We will use these details to identify your booking.</p>
              </div>

              <form onSubmit={handleSubmit} className="booking-form">
                <section className="form-section client-grid">
                  <label>
                    <span>First name</span>
                    <input
                      autoComplete="given-name"
                      value={client.firstName}
                      onChange={(event) => {
                        setClient({ ...client, firstName: event.target.value });
                        setError("");
                      }}
                      required
                    />
                  </label>
                  <label>
                    <span>Last name</span>
                    <input
                      autoComplete="family-name"
                      value={client.lastName}
                      onChange={(event) => {
                        setClient({ ...client, lastName: event.target.value });
                        setError("");
                      }}
                      required
                    />
                  </label>
                  <label>
                    <span>Phone</span>
                    <input
                      autoComplete="tel"
                      inputMode="tel"
                      minLength={5}
                      value={client.phone}
                      onChange={(event) => {
                        setClient({ ...client, phone: event.target.value });
                        setError("");
                      }}
                      required
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      autoComplete="email"
                      type="email"
                      value={client.email}
                      onChange={(event) => {
                        setClient({ ...client, email: event.target.value });
                        setError("");
                      }}
                    />
                  </label>
                </section>

                <label className="full-width">
                  <span>Comment</span>
                  <textarea value={clientComment} onChange={(event) => setClientComment(event.target.value)} rows={3} />
                </label>

                <section className="selection-panel">
                  <div>
                    <span>Appointment</span>
                    <strong>
                      {selectedDate}, {selectedSlot?.label}
                    </strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>
                      {formatSelectedServicesPrice(selectedServices, total.price)} · {total.duration} min
                    </strong>
                  </div>
                </section>

                <footer className="wizard-actions">
                  <button className="secondary-button icon-button" onClick={() => goToStep("datetime")} type="button">
                    <ArrowLeft aria-hidden="true" size={18} />
                    <span>Back</span>
                  </button>
                  <button className="primary-button icon-button" type="submit" disabled={!canSubmit}>
                    <span>{status === "saving" ? "Booking..." : "Confirm appointment"}</span>
                    <Check aria-hidden="true" size={18} />
                  </button>
                </footer>
              </form>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
