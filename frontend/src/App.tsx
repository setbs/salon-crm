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
  UsersRound,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAdminServiceCategory,
  createAdminAppointment,
  createAdminEmployee,
  createAdminEmployeeTimeOff,
  createAdminPortfolioPhoto,
  createAdminProduct,
  createAdminSale,
  createAdminService,
  createAdminStockMovement,
  createAppointment,
  deleteAdminEmployeeTimeOff,
  deleteAdminPortfolioPhoto,
  deleteAdminService,
  deleteAdminServiceCategory,
  fetchAdminData,
  fetchAvailability,
  fetchAppointmentConsumablePreview,
  fetchAdminClientProfile,
  fetchCurrentUser,
  fetchEmployees,
  fetchPortfolio,
  fetchServices,
  getStoredAuthToken,
  loginCrm,
  setStoredAuthToken,
  updateAdminAppointment,
  rescheduleAdminAppointment,
  updateAdminAppointmentComment,
  updateAdminEmployee,
  updateAdminEmployeeWorkingHours,
  updateAdminPayment,
  updateAdminPortfolioPhoto,
  updateAdminProduct,
  updateAdminService,
  updateAdminServiceCategory,
  updateAdminSettings,
  uploadAdminPortfolioImage,
  type AdminData,
  type AdminAppointmentInput,
  type AdminClientProfile,
  type AppointmentConsumablePreview,
  type AuthUser,
  type Employee,
  type EmployeeInput,
  type EmployeeTimeOffInput,
  type EmployeeWorkingHoursInput,
  type MeasurementUnit,
  type PortfolioInput,
  type PortfolioPhoto,
  type ProductInput,
  type SaleInput,
  type Service,
  type ServiceCategoryInput,
  type ServiceInput,
  type SettingsInput,
  type StockMovementInput,
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

type SuggestedSlot = {
  date: string;
  slot: Slot;
};

type SuggestedDay = {
  date: string;
  firstSlot: Slot;
  slotCount: number;
};

async function fetchNearestAvailabilitySuggestions(employeeId: string, serviceIds: string[], startDate: string, slotLimit = 3, dayLimit = 2) {
  const slots: SuggestedSlot[] = [];
  const days: SuggestedDay[] = [];

  for (let offset = 0; offset <= 30 && (slots.length < slotLimit || days.length < dayLimit); offset += 1) {
    const date = addDaysToDateString(startDate, offset);
    const daySlots = await fetchAvailability(employeeId, serviceIds, date);

    if (daySlots.length > 0 && days.length < dayLimit) {
      days.push({ date, firstSlot: daySlots[0], slotCount: daySlots.length });
    }

    for (const slot of daySlots) {
      if (slots.length >= slotLimit) {
        break;
      }

      slots.push({ date, slot });
    }
  }

  return {
    days,
    slots
  };
}

function formatSlotCount(value: number) {
  if (value === 1) {
    return "1 time";
  }

  return `${value} times`;
}

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatSuggestedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(`${value}T00:00:00`));
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
const weekDays = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" }
];

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

const homePortfolioFallback = [
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
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch(() => setServices([]));

    fetchPortfolio()
      .then(setPortfolio)
      .catch(() => setPortfolio([]));
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
  const visiblePortfolio =
    portfolio.length > 0
      ? portfolio.map((item) => ({ title: item.title, image: item.imageUrl, caption: item.employee }))
      : homePortfolioFallback.map((item) => ({ ...item, caption: item.title }));

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
          <p>Visual proof matters in beauty services. The gallery is managed from the CRM portfolio section.</p>
        </div>
        <div className="home-portfolio-grid">
          {visiblePortfolio.map((item) => (
            <figure key={item.title}>
              <img alt={item.title} src={item.image} onError={(event) => { event.currentTarget.src = homeImages.care; }} />
              <figcaption>{item.title}{item.caption && item.caption !== item.title ? ` · ${item.caption}` : ""}</figcaption>
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
    return <DashboardSection dashboard={data.dashboard} analytics={data.consumableAnalytics} appointments={data.appointments} />;
  }

  if (section === "dashboard") {
    return <DashboardSection dashboard={data.dashboard} analytics={data.consumableAnalytics} appointments={data.appointments} />;
  }

  if (section === "calendar") {
    return (
      <CalendarSection
        appointments={data.appointments}
        clients={data.clients}
        employees={data.employees}
        products={data.products}
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
    return (
      <EmployeesSection
        canManage={user.role === "ADMIN"}
        currentEmployeeId={user.employeeId}
        employees={data.employees}
        runAction={runAction}
        services={data.services}
      />
    );
  }

  if (section === "portfolio") {
    return <PortfolioSection employees={data.employees} portfolio={data.portfolio} runAction={runAction} />;
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

function DashboardSection({
  dashboard,
  analytics,
  appointments
}: {
  dashboard: AdminData["dashboard"];
  analytics: AdminData["consumableAnalytics"];
  appointments: AdminData["appointments"];
}) {
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
      <MetricCard label="Consumables used" value={formatAnalyticsTotals(analytics)} note={`${analytics.logsCount} write-offs · ${analytics.periodLabel.toLowerCase()}`} />
      <MetricCard label="Low consumables" value={String(analytics.lowConsumableProducts)} note="package-content stock alerts" />

      <Panel title="Today's appointments" action="Create appointment">
        <DataTable
          columns={["Time", "Client", "Service", "Employee", "Status"]}
          rows={appointments.map((item) => [item.time, item.client, item.service, item.master, <StatusBadge status={item.status} />])}
        />
      </Panel>

      <Panel title="Consumable analytics">
        <DataTable
          columns={["Product", "Used", "Appointments", "Current stock"]}
          rows={
            analytics.products.length > 0
              ? analytics.products.map((item) => [
                  item.productCategory ? `${item.productName} · ${item.productCategory}` : item.productName,
                  `${formatPlainNumber(item.usedQuantity)} ${formatUnit(item.unit)}`,
                  `${item.appointmentCount} appointments`,
                  formatAnalyticsStock(item)
                ])
              : [["No write-offs yet", "-", "-", "-"]]
          }
        />
      </Panel>

      <Panel title="Recent write-offs">
        <InfoList
          items={
            analytics.recentLogs.length > 0
              ? analytics.recentLogs.map((log) => [
                  `${formatShortDate(log.createdAt)} · ${log.productName}`,
                  `${formatPlainNumber(log.quantity)} ${formatUnit(log.unit)} · ${log.serviceName} · ${log.clientName}`
                ])
              : [["No data", "Complete an appointment with consumables to see write-offs here."]]
          }
        />
      </Panel>
    </div>
  );
}

function CalendarSection({
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
              <div className="appointment-financial-summary">
                <div>
                  <span>Services total</span>
                  <strong>{formatMoneyRange(appointment.revenueFrom, appointment.revenueTo)}</strong>
                </div>
                <div>
                  <span>Revenue from client</span>
                  <strong>{formatMoneyRange(clientRevenue.from, clientRevenue.to)}</strong>
                </div>
                <div>
                  <span>Consumables cost</span>
                  <strong>{formatNullableMoney(appointment.consumableCost)}</strong>
                </div>
                <div>
                  <span>After consumables</span>
                  <strong>{formatNullableMoneyRange(clientProfit.from, clientProfit.to)}</strong>
                </div>
              </div>
            </section>
          </div>

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
    (product) => product.contentAmount !== null && product.contentUnit !== null && product.stockContentAmount !== null && !usedProductIds.has(product.id)
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
      <section aria-modal="true" className="admin-modal" role="dialog">
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

function ClientsSection({ clients }: { clients: AdminData["clients"] }) {
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
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [collapsedServiceGroups, setCollapsedServiceGroups] = useState<string[]>([]);
  const editingService = services.find((service) => service.id === editingServiceId) ?? null;
  const editingCategory = categories.find((category) => category.id === editingCategoryId) ?? null;
  const serviceGroups = buildServiceGroups(services, categories, categoryFilter);

  function toggleServiceGroup(groupId: string) {
    setCollapsedServiceGroups((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  }

  function renderServiceActions(item: AdminData["services"][number]) {
    return (
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
    );
  }

  return (
    <div className="admin-grid">
      <Panel title="Service categories" action="Add category" onAction={() => setIsCreatingCategory(true)} wide>
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
      <Panel title="Services" action="Add service" onAction={() => setIsCreatingService(true)} wide>
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
        <div className="service-groups">
          {serviceGroups.length > 0 ? (
            serviceGroups.map((group) => {
              const isOpen = !collapsedServiceGroups.includes(group.id);

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
                    <span>{group.services.length} services</span>
                  </button>
                  {isOpen ? (
                    group.services.length > 0 ? (
                      <DataTable
                        columns={["Name", "Description", "Specialists", "Price", "Duration", "Consumables", "History", "Status", "Actions"]}
                        rows={group.services.map((item) => [
                          item.name,
                          item.description || "-",
                          item.employees.length > 0 ? item.employees.map((employee) => employee.name).join(", ") : "not assigned",
                          formatServicePrice(item),
                          `${item.duration} min`,
                          formatConsumables(item.consumables),
                          item.appointmentCount > 0 ? `${item.appointmentCount} appointments` : "no appointments",
                          item.active ? "active" : "disabled",
                          renderServiceActions(item)
                        ])}
                      />
                    ) : (
                      <div className="empty-state">No services in this category.</div>
                    )
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className="empty-state">No services match this category filter.</div>
          )}
        </div>
      </Panel>
      {isCreatingCategory ? (
        <AdminModal title="New category" onClose={() => setIsCreatingCategory(false)}>
          <ServiceCategoryForm
            onCancel={() => setIsCreatingCategory(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminServiceCategory(payload);
                setIsCreatingCategory(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingCategory ? (
        <AdminModal title={`Edit category: ${editingCategory.name}`} onClose={() => setEditingCategoryId(null)}>
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
        </AdminModal>
      ) : null}
      {isCreatingService ? (
        <AdminModal title="New service" onClose={() => setIsCreatingService(false)}>
          <ServiceForm
            categories={categories}
            employees={employees}
            products={products}
            onCancel={() => setIsCreatingService(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminService(payload);
                setIsCreatingService(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingService ? (
        <AdminModal title={`Edit service: ${editingService.name}`} onClose={() => setEditingServiceId(null)}>
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
        </AdminModal>
      ) : null}
    </div>
  );
}

function buildServiceGroups(
  services: AdminData["services"],
  categories: AdminData["serviceCategories"],
  categoryFilter: string
) {
  const uncategorizedServices = services.filter((service) => !service.categoryId);

  if (categoryFilter === "") {
    return [
      {
        id: "uncategorized",
        name: "Uncategorized",
        services: uncategorizedServices
      }
    ];
  }

  if (categoryFilter !== "all") {
    const selectedCategory = categories.find((category) => category.id === categoryFilter);

    if (!selectedCategory) {
      return [];
    }

    return [
      {
        id: selectedCategory.id,
        name: selectedCategory.name,
        services: services.filter((service) => service.categoryId === selectedCategory.id)
      }
    ];
  }

  const groups = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: services.filter((service) => service.categoryId === category.id)
    }))
    .filter((group) => group.services.length > 0);

  if (uncategorizedServices.length > 0) {
    groups.push({
      id: "uncategorized",
      name: "Uncategorized",
      services: uncategorizedServices
    });
  }

  return groups;
}

function EmployeesSection({
  canManage,
  currentEmployeeId,
  employees,
  runAction,
  services
}: {
  canManage: boolean;
  currentEmployeeId: string | null;
  employees: AdminData["employees"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
  services: AdminData["services"];
}) {
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [schedulingEmployeeId, setSchedulingEmployeeId] = useState<string | null>(null);
  const editingEmployee = employees.find((employee) => employee.id === editingEmployeeId) ?? null;
  const schedulingEmployee = employees.find((employee) => employee.id === schedulingEmployeeId) ?? null;

  return (
    <div className="admin-grid">
      <Panel action={canManage ? "Add employee" : undefined} onAction={() => setIsCreatingEmployee(true)} title="Employees" wide>
        <DataTable
          columns={["Employee", "Contact", "Description", "Specialization", "Services", "Working hours", "Time off", "Status", "Actions"]}
          rows={
            employees.length > 0
              ? employees.map((item) => [
                  item.name,
                  <>
                    {item.email ?? "no email"}
                    <br />
                    {item.phone}
                  </>,
                  item.description || "-",
                  item.specialization || "-",
                  item.services.length > 0 ? item.services.map((service) => service.name).join(", ") : "not assigned",
                  item.hours,
                  item.timeOff,
                  item.active ? "active" : "disabled",
                  canManage || item.id === currentEmployeeId ? (
                    <InlineActions
                      labels={[...(canManage ? [item.active ? "Disable" : "Enable", "Edit"] : []), "Schedule"]}
                      onAction={(label) => {
                        if (label === "Edit") {
                          setEditingEmployeeId(item.id);
                          return;
                        }

                        if (label === "Schedule") {
                          setSchedulingEmployeeId(item.id);
                          return;
                        }

                        void runAction(() => updateAdminEmployee(item.id, { active: !item.active }));
                      }}
                    />
                  ) : (
                    "-"
                  )
                ])
              : [["No employees yet", "-", "-", "-", "-", "-", "-", "-", "-"]]
          }
        />
      </Panel>
      {isCreatingEmployee ? (
        <AdminModal title="New employee" onClose={() => setIsCreatingEmployee(false)}>
          <EmployeeForm
            onCancel={() => setIsCreatingEmployee(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminEmployee(payload);
                setIsCreatingEmployee(false);
              })
            }
            services={services}
          />
        </AdminModal>
      ) : null}
      {editingEmployee ? (
        <AdminModal title={`Edit employee: ${editingEmployee.name}`} onClose={() => setEditingEmployeeId(null)}>
          <EmployeeForm
            employee={editingEmployee}
            key={editingEmployee.id}
            onCancel={() => setEditingEmployeeId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminEmployee(editingEmployee.id, payload);
                setEditingEmployeeId(null);
              })
            }
            services={services}
          />
        </AdminModal>
      ) : null}
      {schedulingEmployee ? (
        <AdminModal title={`Schedule: ${schedulingEmployee.name}`} onClose={() => setSchedulingEmployeeId(null)}>
          <EmployeeScheduleForm
            employee={schedulingEmployee}
            onCancel={() => setSchedulingEmployeeId(null)}
            onCreateTimeOff={(payload) => runAction(() => createAdminEmployeeTimeOff(schedulingEmployee.id, payload))}
            onDeleteTimeOff={(timeOffId) => runAction(() => deleteAdminEmployeeTimeOff(schedulingEmployee.id, timeOffId))}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminEmployeeWorkingHours(schedulingEmployee.id, payload);
                setSchedulingEmployeeId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
    </div>
  );
}

function EmployeeForm({
  employee,
  onCancel,
  onSubmit,
  services
}: {
  employee?: AdminData["employees"][number];
  onCancel: () => void;
  onSubmit: (payload: EmployeeInput) => Promise<void>;
  services: AdminData["services"];
}) {
  const serviceGroups = buildAppointmentServiceGroups(services);
  const [collapsedServiceGroups, setCollapsedServiceGroups] = useState<string[]>([]);
  const [form, setForm] = useState({
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    phone: employee?.phone ?? "",
    email: employee?.email ?? "",
    password: "",
    specialization: employee?.specialization ?? "",
    description: employee?.description ?? "",
    active: employee?.active ?? true
  });
  const [serviceIds, setServiceIds] = useState<string[]>(employee?.serviceIds ?? []);
  const isEditing = Boolean(employee);

  function toggleService(id: string) {
    setServiceIds((current) => (current.includes(id) ? current.filter((serviceId) => serviceId !== id) : [...current, id]));
  }

  function toggleServiceGroup(groupId: string) {
    setCollapsedServiceGroups((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      email: form.email,
      password: form.password || undefined,
      specialization: form.specialization || undefined,
      description: form.description || undefined,
      active: form.active,
      serviceIds
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="form-section">
        <label>
          <span>First name</span>
          <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
        </label>
        <label>
          <span>Last name</span>
          <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
        </label>
      </div>
      <div className="form-section">
        <label>
          <span>Phone</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
      </div>
      <div className="form-section">
        <label>
          <span>Password</span>
          <input
            minLength={8}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder={isEditing ? "Leave empty to keep current password" : ""}
            required={!isEditing}
            type="password"
            value={form.password}
          />
        </label>
        <label>
          <span>Specialization</span>
          <input value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} />
        </label>
      </div>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>Employee is active</span>
      </label>
      <div className="appointment-service-picker">
        <span>Assigned services</span>
        <div className="service-groups compact">
          {serviceGroups.length > 0 ? (
            serviceGroups.map((group) => {
              const isOpen = !collapsedServiceGroups.includes(group.id);
              const selectedCount = group.services.filter((service) => serviceIds.includes(service.id)).length;

              return (
                <section className="service-group" key={group.id}>
                  <button aria-expanded={isOpen} className="service-group-toggle" onClick={() => toggleServiceGroup(group.id)} type="button">
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
                              {service.duration} min · {formatServicePrice(service)} · {service.active ? "active" : "disabled"}
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
            <div className="empty-state">No services available.</div>
          )}
        </div>
      </div>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" type="submit">
          {isEditing ? "Save employee" : "Create employee"}
        </button>
      </div>
    </form>
  );
}

function EmployeeScheduleForm({
  employee,
  onCancel,
  onCreateTimeOff,
  onDeleteTimeOff,
  onSubmit
}: {
  employee: AdminData["employees"][number];
  onCancel: () => void;
  onCreateTimeOff: (payload: EmployeeTimeOffInput) => Promise<void>;
  onDeleteTimeOff: (timeOffId: string) => Promise<void>;
  onSubmit: (payload: EmployeeWorkingHoursInput) => Promise<void>;
}) {
  const [days, setDays] = useState(() =>
    weekDays.reduce<Record<number, { enabled: boolean; startTime: string; endTime: string }>>((acc, day) => {
      const hour = employee.workingHours.find((item) => item.dayOfWeek === day.value);
      acc[day.value] = {
        enabled: Boolean(hour),
        startTime: hour?.startTime ?? "09:00",
        endTime: hour?.endTime ?? "18:00"
      };
      return acc;
    }, {})
  );
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: today,
    startTime: "09:00",
    endDate: today,
    endTime: "18:00",
    reason: ""
  });

  function updateDay(dayOfWeek: number, patch: Partial<{ enabled: boolean; startTime: string; endTime: string }>) {
    setDays((current) => ({
      ...current,
      [dayOfWeek]: {
        ...current[dayOfWeek],
        ...patch
      }
    }));
  }

  function submitHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      hours: weekDays
        .filter((day) => days[day.value].enabled)
        .map((day) => ({
          dayOfWeek: day.value,
          startTime: days[day.value].startTime,
          endTime: days[day.value].endTime
        }))
    });
  }

  function submitTimeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onCreateTimeOff({
      startTime: toIsoDateTime(timeOffForm.startDate, timeOffForm.startTime),
      endTime: toIsoDateTime(timeOffForm.endDate, timeOffForm.endTime),
      reason: timeOffForm.reason || undefined
    });
  }

  return (
    <div className="employee-schedule">
      <form className="admin-form" onSubmit={submitHours}>
        <div className="schedule-week">
          {weekDays.map((day) => (
            <section className={days[day.value].enabled ? "schedule-day active" : "schedule-day"} key={day.value}>
              <label className="checkbox-line">
                <input checked={days[day.value].enabled} onChange={(event) => updateDay(day.value, { enabled: event.target.checked })} type="checkbox" />
                <span>{day.label}</span>
              </label>
              <div className="form-section">
                <label>
                  <span>Start</span>
                  <input
                    disabled={!days[day.value].enabled}
                    onChange={(event) => updateDay(day.value, { startTime: event.target.value })}
                    type="time"
                    value={days[day.value].startTime}
                  />
                </label>
                <label>
                  <span>End</span>
                  <input
                    disabled={!days[day.value].enabled}
                    onChange={(event) => updateDay(day.value, { endTime: event.target.value })}
                    type="time"
                    value={days[day.value].endTime}
                  />
                </label>
              </div>
            </section>
          ))}
        </div>
        <div className="form-actions">
          <button className="secondary-button compact-button" onClick={onCancel} type="button">
            Close
          </button>
          <button className="primary-button admin-submit" type="submit">
            Save weekly schedule
          </button>
        </div>
      </form>

      <div className="schedule-divider" />

      <section className="schedule-timeoff">
        <div>
          <p className="admin-kicker">Time off</p>
          <DataTable
            columns={["Period", "Reason", "Actions"]}
            rows={
              employee.timeOffItems.length > 0
                ? employee.timeOffItems.map((item) => [
                    `${formatShortDate(item.startTime)} - ${formatShortDate(item.endTime)}`,
                    item.reason || "-",
                    <InlineActions labels={["Delete"]} onAction={() => void onDeleteTimeOff(item.id)} />
                  ])
                : [["No blocked periods", "-", "-"]]
            }
          />
        </div>

        <form className="admin-form" onSubmit={submitTimeOff}>
          <div className="form-section">
            <label>
              <span>Start date</span>
              <input
                onChange={(event) => setTimeOffForm({ ...timeOffForm, startDate: event.target.value })}
                type="date"
                value={timeOffForm.startDate}
              />
            </label>
            <label>
              <span>Start time</span>
              <input
                onChange={(event) => setTimeOffForm({ ...timeOffForm, startTime: event.target.value })}
                type="time"
                value={timeOffForm.startTime}
              />
            </label>
          </div>
          <div className="form-section">
            <label>
              <span>End date</span>
              <input onChange={(event) => setTimeOffForm({ ...timeOffForm, endDate: event.target.value })} type="date" value={timeOffForm.endDate} />
            </label>
            <label>
              <span>End time</span>
              <input onChange={(event) => setTimeOffForm({ ...timeOffForm, endTime: event.target.value })} type="time" value={timeOffForm.endTime} />
            </label>
          </div>
          <label>
            <span>Reason</span>
            <input value={timeOffForm.reason} onChange={(event) => setTimeOffForm({ ...timeOffForm, reason: event.target.value })} />
          </label>
          <button className="secondary-button compact-button" type="submit">
            Add time off
          </button>
        </form>
      </section>
    </div>
  );
}

function PortfolioSection({
  employees,
  portfolio,
  runAction
}: {
  employees: AdminData["employees"];
  portfolio: AdminData["portfolio"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [isCreatingPhoto, setIsCreatingPhoto] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const editingPhoto = portfolio.find((photo) => photo.id === editingPhotoId) ?? null;

  return (
    <div className="admin-grid">
      <Panel title="Portfolio" action="Add photo" onAction={() => setIsCreatingPhoto(true)} wide>
        <div className="portfolio-grid">
          {portfolio.length > 0 ? portfolio.map((item) => (
            <article className="portfolio-card" key={item.id}>
              <div className="portfolio-preview">
                <img alt={item.title} src={item.imageUrl} onError={(event) => { event.currentTarget.style.display = "none"; }} />
              </div>
              <strong>{item.title}</strong>
              <span>{item.master}</span>
              <span>{item.visible ? "visible" : "hidden"}</span>
              <InlineActions
                labels={[item.visible ? "Hide" : "Show", "Edit", "Delete"]}
                onAction={(label) => {
                  if (label === "Edit") {
                    setEditingPhotoId(item.id);
                    return;
                  }

                  if (label === "Delete") {
                    void runAction(() => deleteAdminPortfolioPhoto(item.id));
                    return;
                  }

                  void runAction(() => updateAdminPortfolioPhoto(item.id, { visible: !item.visible }));
                }}
              />
            </article>
          )) : <div className="empty-state">No portfolio photos yet.</div>}
        </div>
      </Panel>
      {isCreatingPhoto ? (
        <AdminModal title="New portfolio photo" onClose={() => setIsCreatingPhoto(false)}>
          <PortfolioPhotoForm
            employees={employees}
            onCancel={() => setIsCreatingPhoto(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminPortfolioPhoto(payload);
                setIsCreatingPhoto(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingPhoto ? (
        <AdminModal title={`Edit portfolio photo`} onClose={() => setEditingPhotoId(null)}>
          <PortfolioPhotoForm
            employees={employees}
            key={editingPhoto.id}
            onCancel={() => setEditingPhotoId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminPortfolioPhoto(editingPhoto.id, payload);
                setEditingPhotoId(null);
              })
            }
            photo={editingPhoto}
          />
        </AdminModal>
      ) : null}
    </div>
  );
}

function PortfolioPhotoForm({
  employees,
  onCancel,
  onSubmit,
  photo
}: {
  employees: AdminData["employees"];
  onCancel: () => void;
  onSubmit: (payload: PortfolioInput) => Promise<void>;
  photo?: AdminData["portfolio"][number];
}) {
  const [form, setForm] = useState({
    employeeId: photo?.employeeId ?? employees[0]?.id ?? "",
    imageUrl: photo?.imageUrl ?? "",
    description: photo?.description ?? "",
    visible: photo?.visible ?? true
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await uploadAdminPortfolioImage(file);
      setForm((current) => ({ ...current, imageUrl: result.imageUrl }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      employeeId: form.employeeId,
      imageUrl: form.imageUrl,
      description: form.description || undefined,
      visible: form.visible
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
      <label>
        <span>Upload from device</span>
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={isUploading}
          onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
      {uploadError ? <p className="form-note">{uploadError}</p> : null}
      <label>
        <span>{isUploading ? "Uploading photo..." : "Photo URL"}</span>
        <input disabled={isUploading} value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.visible} onChange={(event) => setForm({ ...form, visible: event.target.checked })} type="checkbox" />
        <span>Visible on public website</span>
      </label>
      {form.imageUrl ? (
        <div className="portfolio-form-preview">
          <img alt="Portfolio preview" src={form.imageUrl} />
        </div>
      ) : null}
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={!form.employeeId || isUploading} type="submit">
          {isUploading ? "Uploading..." : "Save photo"}
        </button>
      </div>
    </form>
  );
}

function ProductsSection({
  products,
  runAction
}: {
  products: AdminData["products"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCreatingStockMovement, setIsCreatingStockMovement] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;

  return (
    <div className="admin-grid">
      <Panel title="Products / inventory" action="Add product" onAction={() => setIsCreatingProduct(true)}>
        <DataTable
          columns={["Category", "Product", "Purchase", "Sale", "Stock", "Package", "Status", "Actions"]}
          rows={products.map((item) => [
            item.category,
            item.name,
            adminMoney.format(item.purchase),
            adminMoney.format(item.sale),
            item.stockStatus === "low" ? <span className="danger-text">{formatProductStock(item)}</span> : formatProductStock(item),
            item.contentAmount ? `${formatPlainNumber(item.contentAmount)} ${formatUnit(item.contentUnit)}` : "not set",
            <StatusBadge status={item.stockStatus} />,
            <InlineActions labels={["Edit"]} onAction={() => setEditingProductId(item.id)} />
          ])}
        />
      </Panel>
      {isCreatingProduct ? (
        <AdminModal title="New product" onClose={() => setIsCreatingProduct(false)}>
          <ProductForm
            onCancel={() => setIsCreatingProduct(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProduct(payload);
                setIsCreatingProduct(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingProduct ? (
        <AdminModal title={`Edit product: ${editingProduct.name}`} onClose={() => setEditingProductId(null)}>
          <ProductForm
            key={editingProduct.id}
            onCancel={() => setEditingProductId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProduct(editingProduct.id, payload);
                setEditingProductId(null);
              })
            }
            product={editingProduct}
          />
        </AdminModal>
      ) : null}
      {isCreatingStockMovement ? (
        <AdminModal title="Stock movement" onClose={() => setIsCreatingStockMovement(false)}>
          <StockMovementForm
            onCancel={() => setIsCreatingStockMovement(false)}
            products={products}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminStockMovement(payload);
                setIsCreatingStockMovement(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      <Panel title="Stock movement history" action="Add movement" onAction={() => setIsCreatingStockMovement(true)}>
        <InfoList
          items={products
            .flatMap((product) =>
              product.movements.map((movement) => [
                movement.type,
                `${formatStockMovementAmount(movement)} ${product.name}${movement.reason ? ` · ${movement.reason}` : ""}`
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

function ServiceCategoryForm({
  onCancel,
  onSubmit
}: {
  onCancel: () => void;
  onSubmit: (payload: ServiceCategoryInput) => Promise<void>;
}) {
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
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" type="submit">
          Add category
        </button>
      </div>
    </form>
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
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" type="submit">
          Save category
        </button>
      </div>
    </form>
  );
}

function ServiceForm({
  categories,
  employees,
  onCancel,
  products,
  onSubmit
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  onCancel: () => void;
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
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          Add service
        </button>
      </div>
    </form>
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
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          Save service
        </button>
      </div>
    </form>
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

function formatStockMovementAmount(movement: AdminData["products"][number]["movements"][number]) {
  if (movement.contentQuantity !== null && movement.contentUnit) {
    const sign = movement.contentQuantity > 0 ? "+" : "";
    return `${sign}${formatPlainNumber(movement.contentQuantity)} ${formatUnit(movement.contentUnit)}`;
  }

  const sign = movement.quantity > 0 ? "+" : "";
  return `${sign}${movement.quantity} packs`;
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

function formatAnalyticsStock(item: AdminData["consumableAnalytics"]["products"][number]) {
  if (item.stockContentAmount !== null && item.stockPackageEquivalent !== null) {
    return `${formatPlainNumber(item.stockPackageEquivalent)} packs · ${formatPlainNumber(item.stockContentAmount)} ${formatUnit(item.unit)}`;
  }

  return "not tracked";
}

function formatPreviewStock(item: AppointmentConsumablePreview["items"][number]) {
  if (item.stockAfter === null) {
    return "not tracked";
  }

  const packagePart = item.packageEquivalentAfter !== null ? `${formatPlainNumber(item.packageEquivalentAfter)} packs · ` : "";
  return `${packagePart}${formatPlainNumber(item.stockAfter)} ${formatUnit(item.unit)}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + mondayOffset);

  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short"
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
    const group = appointmentsByDate.get(date) ?? [];
    group.push(appointment);
    appointmentsByDate.set(date, group);
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

function formatPlainNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(value);
}

function formatUnit(unit: MeasurementUnit | null | undefined) {
  return unit === "gram" ? "g" : "ml";
}

function ProductForm({
  onCancel,
  onSubmit,
  product
}: {
  onCancel?: () => void;
  onSubmit: (payload: ProductInput) => Promise<void>;
  product?: AdminData["products"][number];
}) {
  const [form, setForm] = useState({
    category: product?.category ?? "",
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    purchase: String(product?.purchase ?? 0),
    sale: String(product?.sale ?? 0),
    stock: String(product?.stock ?? 0),
    min: String(product?.min ?? 0),
    contentAmount: product?.contentAmount ? String(product.contentAmount) : "",
    contentUnit: product?.contentUnit ?? ("ml" as MeasurementUnit)
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      category: form.category,
      name: form.name,
      brand: form.brand || undefined,
      sku: form.sku || undefined,
      purchase: Number(form.purchase),
      sale: Number(form.sale),
      stock: Number(form.stock),
      min: Number(form.min),
      contentAmount: form.contentAmount ? Number(form.contentAmount) : undefined,
      contentUnit: form.contentAmount ? form.contentUnit : undefined
    });
  }

  return (
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
        <span>Brand</span>
        <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
      </label>
      <label>
        <span>SKU</span>
        <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
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
      <div className="form-actions">
        {onCancel ? (
          <button className="secondary-button compact-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
        <button className="primary-button admin-submit" type="submit">
          {product ? "Save product" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function StockMovementForm({
  onCancel,
  onSubmit,
  products
}: {
  onCancel: () => void;
  onSubmit: (payload: StockMovementInput) => Promise<void>;
  products: AdminData["products"];
}) {
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    movementType: "purchase" as StockMovementInput["movementType"],
    amountMode: "packages" as StockMovementInput["amountMode"],
    amount: "1",
    reason: ""
  });
  const selectedProduct = products.find((product) => product.id === form.productId) ?? products[0];
  const canUseContent = Boolean(selectedProduct?.contentAmount && selectedProduct.contentUnit);

  useEffect(() => {
    if (form.amountMode === "content" && !canUseContent) {
      setForm((current) => ({ ...current, amountMode: "packages" }));
    }
  }, [canUseContent, form.amountMode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    void onSubmit({
      productId: form.productId,
      movementType: form.movementType,
      amountMode: form.amountMode,
      amount: Number(form.amount),
      reason: form.reason || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Product</span>
        <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {formatProductOption(product)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Movement type</span>
        <select value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value as StockMovementInput["movementType"] })}>
          <option value="purchase">Purchase</option>
          <option value="adjustment">Adjustment</option>
          <option value="return">Return</option>
        </select>
      </label>
      <label>
        <span>Amount mode</span>
        <select value={form.amountMode} onChange={(event) => setForm({ ...form, amountMode: event.target.value as StockMovementInput["amountMode"] })}>
          <option value="packages">Packages</option>
          <option value="content" disabled={!canUseContent}>
            {selectedProduct?.contentUnit ? formatUnit(selectedProduct.contentUnit) : "ml/g"}
          </option>
        </select>
      </label>
      <label>
        <span>{form.amountMode === "content" ? `Amount, ${formatUnit(selectedProduct?.contentUnit)}` : "Packages"}</span>
        <input
          step={form.amountMode === "content" ? "0.01" : "1"}
          type="number"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          required
        />
      </label>
      <label>
        <span>Reason</span>
        <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} rows={3} />
      </label>
      {form.movementType === "adjustment" ? <small className="form-note">Adjustment can be positive or negative.</small> : null}
      {!canUseContent ? <small className="form-note">Configure package content on the product to use ml/g movements.</small> : null}
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={!selectedProduct} type="submit">
          Save movement
        </button>
      </div>
    </form>
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

function AdminModal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section aria-modal="true" className="admin-modal" role="dialog">
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

function Panel({
  title,
  action,
  children,
  onAction,
  wide
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
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
        const Icon =
          label === "Details"
            ? FileText
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

function StatusBadge({ status }: { status: string }) {
  const statusLabels: Record<string, string> = {
    scheduled: "scheduled",
    completed: "completed",
    cancelled: "cancelled",
    no_show: "no-show",
    pending: "pending",
    paid: "paid",
    refunded: "refunded",
    ready: "ready",
    blocked: "blocked",
    ok: "ok",
    low: "low",
    not_tracked: "not tracked"
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
  const [loadedSlotsDate, setLoadedSlotsDate] = useState("");
  const [nearestSlots, setNearestSlots] = useState<SuggestedSlot[]>([]);
  const [nearestDays, setNearestDays] = useState<SuggestedDay[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingNearestSlots, setIsLoadingNearestSlots] = useState(false);
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
    setLoadedSlotsDate("");
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

    setError("");

    if (!selectedEmployeeId || selectedServiceIds.length === 0 || !selectedDate) {
      setSlots([]);
      setLoadedSlotsDate("");
      setIsLoadingSlots(false);
      return;
    }

    setIsLoadingSlots(true);
    setLoadedSlotsDate("");
    fetchAvailability(selectedEmployeeId, selectedServiceIds, selectedDate)
      .then((data) => {
        if (!cancelled) {
          setSlots(data);
          setLoadedSlotsDate(selectedDate);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load available times. Try another date or refresh the page.");
          setSlots([]);
          setLoadedSlotsDate("");
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

  const shouldShowAvailabilitySuggestions = Boolean(
    selectedEmployeeId && selectedServiceIds.length > 0 && selectedDate && loadedSlotsDate === selectedDate && !isLoadingSlots && slots.length === 0
  );

  useEffect(() => {
    let cancelled = false;

    setNearestDays([]);
    setNearestSlots([]);

    if (!shouldShowAvailabilitySuggestions) {
      setIsLoadingNearestSlots(false);
      return;
    }

    setIsLoadingNearestSlots(true);
    fetchNearestAvailabilitySuggestions(selectedEmployeeId, selectedServiceIds, today)
      .then((data) => {
        if (!cancelled) {
          setNearestDays(data.days);
          setNearestSlots(data.slots);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNearestDays([]);
          setNearestSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingNearestSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId, selectedServiceIds, shouldShowAvailabilitySuggestions]);

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
    setLoadedSlotsDate("");
    setNearestDays([]);
    setNearestSlots([]);
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
                      setSelectedSlot(null);
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

                {shouldShowAvailabilitySuggestions ? (
                  <div className="nearest-suggestions-grid">
                    <div className="nearest-slots">
                      <div className="field-label">
                        <CalendarDays aria-hidden="true" size={16} />
                        Nearest days
                      </div>
                      <div className="nearest-day-list">
                        {isLoadingNearestSlots ? <p className="empty-state">Looking for available days...</p> : null}
                        {!isLoadingNearestSlots && nearestDays.length > 0
                          ? nearestDays.map((suggestion) => (
                              <button
                                className={selectedDate === suggestion.date ? "nearest-day selected" : "nearest-day"}
                                key={suggestion.date}
                                onClick={() => {
                                  setSelectedDate(suggestion.date);
                                  setSelectedSlot(null);
                                  setError("");
                                }}
                                type="button"
                              >
                                <strong>{formatSuggestedDate(suggestion.date)}</strong>
                                <span>
                                  {formatSlotCount(suggestion.slotCount)} · from {suggestion.firstSlot.label}
                                </span>
                              </button>
                            ))
                          : null}
                        {!isLoadingNearestSlots && nearestDays.length === 0 ? <p className="empty-state">No available days found in the next 30 days.</p> : null}
                      </div>
                    </div>

                    <div className="nearest-slots">
                      <div className="field-label">
                        <CalendarDays aria-hidden="true" size={16} />
                        Nearest terms
                      </div>
                      <div className="nearest-slot-list">
                        {isLoadingNearestSlots ? <p className="empty-state">Looking for the nearest available terms...</p> : null}
                        {!isLoadingNearestSlots && nearestSlots.length > 0
                          ? nearestSlots.map((suggestion) => (
                              <button
                                className={selectedSlot?.startTime === suggestion.slot.startTime ? "nearest-slot selected" : "nearest-slot"}
                                key={`${suggestion.date}-${suggestion.slot.startTime}`}
                                onClick={() => {
                                  setSelectedDate(suggestion.date);
                                  setSelectedSlot(suggestion.slot);
                                  setError("");
                                }}
                                type="button"
                              >
                                <strong>{formatSuggestedDate(suggestion.date)}</strong>
                                <span>{suggestion.slot.label}</span>
                              </button>
                            ))
                          : null}
                        {!isLoadingNearestSlots && nearestSlots.length === 0 ? <p className="empty-state">No available terms found in the next 30 days.</p> : null}
                      </div>
                    </div>
                  </div>
                ) : null}

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
