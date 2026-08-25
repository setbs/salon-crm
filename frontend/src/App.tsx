import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Clock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  Scissors,
  Settings,
  ShoppingCart,
  Store,
  Star,
  Trash2,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { AdminModal, DataTable, InfoList, InlineActions, Panel, StatusBadge } from "./components/admin-ui";
import { CalendarSection } from "./features/calendar/CalendarSection";
import { ClientsSection } from "./features/clients/ClientsSection";
import { DashboardSection } from "./features/dashboard/DashboardSection";
import { ProductsSection } from "./features/products/ProductsSection";
import { ServicesSection } from "./features/services/ServicesSection";
import { StoreOrdersSection } from "./features/store-orders/StoreOrdersSection";
import { adminMoney, formatPlainNumber, formatUnit, plainHryvnia } from "./utils/format";
import {
  createAdminEmployee,
  createAdminEmployeeScheduleOverride,
  createAdminEmployeeTimeOff,
  createAdminPortfolioPhoto,
  createAdminSale,
  createAppointment,
  deleteAdminEmployeeTimeOff,
  deleteAdminEmployeeScheduleOverride,
  deleteAdminPortfolioPhoto,
  fetchAdminData,
  fetchAvailability,
  fetchCurrentUser,
  fetchEmployees,
  fetchPortfolio,
  fetchProducts,
  fetchServices,
  getStoredAuthToken,
  loginCrm,
  setStoredAuthToken,
  updateAdminEmployee,
  updateAdminEmployeeWorkingHours,
  updateAdminPayment,
  updateAdminPortfolioPhoto,
  updateAdminSettings,
  uploadAdminPortfolioImage,
  type AdminData,
  type AuthUser,
  type Employee,
  type EmployeeInput,
  type EmployeeScheduleOverrideInput,
  type EmployeeTimeOffInput,
  type EmployeeWorkingHoursInput,
  type MeasurementUnit,
  type PortfolioInput,
  type PortfolioPhoto,
  type ProductPurpose,
  type PublicProduct,
  type SaleInput,
  type Service,
  type SettingsInput,
  type Slot
} from "./api";

type DisplayPrice = {
  price: number;
  priceFrom?: number | null;
  priceTo?: number | null;
};

function formatHryvnia(value: number) {
  return `${plainHryvnia.format(value)} ₴`;
}

function canSellProduct(product: { purpose?: ProductPurpose }) {
  return !product.purpose || product.purpose === "sale" || product.purpose === "both";
}

function canUseProductInProcedure(product: { purpose?: ProductPurpose }) {
  return !product.purpose || product.purpose === "procedure" || product.purpose === "both";
}

function formatNetMoney(value: number, status?: string) {
  if (status === "pending") {
    return "not paid";
  }

  return adminMoney.format(value);
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

type SuggestedSlot = {
  date: string;
  slot: Slot;
};

type SuggestedDay = {
  date: string;
  firstSlot: Slot;
  slotCount: number;
};

type BookingClientForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

type BookingContactField = keyof BookingClientForm | "comment";
type BookingContactErrors = Partial<Record<BookingContactField, string>>;

function BookingEmptyState({ action, detail, title }: { action?: ReactNode; detail: string; title: string }) {
  return (
    <div className="booking-empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function getBookingContactErrors(client: BookingClientForm, comment: string): BookingContactErrors {
  const errors: BookingContactErrors = {};
  const firstName = client.firstName.trim();
  const lastName = client.lastName.trim();
  const phone = client.phone.trim();
  const email = client.email.trim();
  const digitCount = phone.replace(/\D/g, "").length;

  if (!firstName) {
    errors.firstName = "First name is required.";
  } else if (firstName.length > 100) {
    errors.firstName = "First name must be 100 characters or fewer.";
  }

  if (!lastName) {
    errors.lastName = "Last name is required.";
  } else if (lastName.length > 100) {
    errors.lastName = "Last name must be 100 characters or fewer.";
  }

  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (phone.length < 5 || phone.length > 20 || digitCount < 5 || !/^[+\d\s()-]+$/.test(phone)) {
    errors.phone = "Phone must contain 5-20 digits or phone symbols.";
  }

  if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email))) {
    errors.email = "Email must include a valid domain, for example name@example.com.";
  }

  if (comment.trim().length > 1000) {
    errors.comment = "Comment must be 1000 characters or fewer.";
  }

  return errors;
}

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

function getBookingErrorMessage(error: unknown, fallback: string) {
  const rawMessage = error instanceof Error ? error.message.trim() : "";

  if (!rawMessage) {
    return fallback;
  }

  if (/request failed|internal server/i.test(rawMessage)) {
    return "Something went wrong. Please try again in a moment or contact the salon.";
  }

  if (/slot|available|overlap|time/i.test(rawMessage)) {
    return "This time is no longer available. Please choose another slot.";
  }

  return rawMessage;
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

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatSuggestedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(`${value}T00:00:00`));
}

type AppMode = "home" | "admin" | "booking" | "shop";
type SalonMode = "home" | "booking" | "shop";
type AdminSection =
  | "dashboard"
  | "calendar"
  | "clients"
  | "services"
  | "employees"
  | "portfolio"
  | "products"
  | "sales"
  | "store-orders"
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
  { id: "store-orders", label: "Store orders", icon: Store },
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

export function SalonApp() {
  const [mode, setMode] = useState<SalonMode>("home");

  return (
    <>
      {mode === "home" ? (
        <HomeView onOpenBooking={() => setMode("booking")} onOpenShop={() => setMode("shop")} />
      ) : mode === "shop" ? (
        <ShopView onOpenBooking={() => setMode("booking")} onOpenHome={() => setMode("home")} />
      ) : (
        <BookingView onOpenHome={() => setMode("home")} />
      )}
    </>
  );
}

export function CrmApp() {
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

  return authUser ? (
    <AdminPanel onLogout={logout} user={authUser} />
  ) : (
    <LoginView
      isCheckingAuth={isCheckingAuth}
      onSuccess={(user) => {
        setAuthUser(user);
      }}
    />
  );
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
        <HomeView onOpenAdmin={() => setMode("admin")} onOpenBooking={() => setMode("booking")} onOpenShop={() => setMode("shop")} />
      ) : mode === "shop" ? (
        <ShopView onOpenAdmin={() => setMode("admin")} onOpenBooking={() => setMode("booking")} onOpenHome={() => setMode("home")} />
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
  care: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=82",
  products: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1800&q=82"
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

const shopProductFallback: PublicProduct[] = [
  {
    id: "fallback-shampoo-hyaluronic",
    category: { id: "fallback-shampoos", name: "Hair shampoos", description: "Daily professional home care", imageUrl: null },
    name: "Shampoo with hyaluronic acid",
    brand: "Professional cosmetics",
    description: "For all hair types",
    quote: "A clean start for hair that needs lightness and shine.",
    imageUrl: null,
    purpose: "sale",
    price: 950,
    contentAmount: 250,
    contentUnit: "ml",
    stockQuantity: 5,
    components: [],
    inStock: true
  },
  {
    id: "fallback-shampoo-blackberry",
    category: { id: "fallback-shampoos", name: "Hair shampoos", description: "Daily professional home care", imageUrl: null },
    name: "Shampoo with blackberry extract",
    brand: "Professional cosmetics",
    description: "Soft cleansing and shine",
    quote: "A daily ritual for softness without heaviness.",
    imageUrl: null,
    purpose: "sale",
    price: 900,
    contentAmount: 250,
    contentUnit: "ml",
    stockQuantity: 5,
    components: [],
    inStock: true
  },
  {
    id: "fallback-conditioner-centella",
    category: { id: "fallback-conditioners", name: "Hair conditioners", description: "Smoothness and easy combing", imageUrl: null },
    name: "Conditioner with centella extract",
    brand: "Professional cosmetics",
    description: "For dry and sensitive hair",
    quote: "Care that leaves the hair calm, smooth and easier to style.",
    imageUrl: null,
    purpose: "sale",
    price: 1050,
    contentAmount: 250,
    contentUnit: "ml",
    stockQuantity: 5,
    components: [],
    inStock: true
  },
  {
    id: "fallback-conditioner-lotus",
    category: { id: "fallback-conditioners", name: "Hair conditioners", description: "Smoothness and easy combing", imageUrl: null },
    name: "Conditioner with lotus extract",
    brand: "Professional cosmetics",
    description: "Light care without heaviness",
    quote: "A soft finish for hair that should move naturally.",
    imageUrl: null,
    purpose: "sale",
    price: 1050,
    contentAmount: 250,
    contentUnit: "ml",
    stockQuantity: 5,
    components: [],
    inStock: true
  }
];

function HomeView({
  onOpenAdmin,
  onOpenBooking,
  onOpenShop
}: {
  onOpenAdmin?: () => void;
  onOpenBooking: () => void;
  onOpenShop: () => void;
}) {
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
          <a className="nav-feature-link" href="#price-list">Price list</a>
          <button className="nav-feature-link" onClick={onOpenShop} type="button">Cosmetics</button>
          <a href="#contact">Contact</a>
        </nav>
        <div className="home-nav-actions">
          {onOpenAdmin ? (
            <button className="secondary-button" onClick={onOpenAdmin} type="button">
              CRM
            </button>
          ) : null}
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
            <button className="secondary-button" onClick={onOpenShop} type="button">
              Professional cosmetics
            </button>
            <a href="#price-list">View price list</a>
          </div>
        </div>
        <aside className="home-hero-card" aria-label="Salon visit highlights">
          <span>Next visit</span>
          <strong>Consultation, service, care plan</strong>
          <div>
            <small>Clear timing</small>
            <small>Online booking</small>
            <small>Professional cosmetics</small>
          </div>
        </aside>
      </section>

      <section className="home-experience-strip" aria-label="Salon experience">
        <article>
          <CalendarDays aria-hidden="true" size={20} />
          <span>Book without calls</span>
          <p>Choose a service, specialist and time in a few steps.</p>
        </article>
        <article>
          <Scissors aria-hidden="true" size={20} />
          <span>Price before visit</span>
          <p>Categories are grouped in a clean price list.</p>
        </article>
        <article>
          <Package aria-hidden="true" size={20} />
          <span>Care after salon</span>
          <p>Professional cosmetics are kept in a separate catalog.</p>
        </article>
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
            <blockquote className="home-about-quote">
              A visit should feel easy before the client even sits in the chair.
            </blockquote>
          </div>
        </div>
      </section>

      <section className="home-atmosphere">
        <div className="home-atmosphere-copy">
          <p className="eyebrow">Salon rhythm</p>
          <h2>Soft visuals, precise work and a calmer flow</h2>
          <p>
            The public page keeps the client focused: atmosphere first, then examples of work, then prices and contact.
            Behind it, CRM keeps the operational part tidy.
          </p>
          <button className="secondary-button" onClick={onOpenBooking} type="button">
            Start booking
          </button>
        </div>
        <div className="home-atmosphere-collage" aria-hidden="true">
          <img alt="" src={homeImages.color} />
          <img alt="" src={homeImages.manicure} />
          <img alt="" src={homeImages.products} />
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

type ShopProductCategory = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  products: PublicProduct[];
};

function groupShopProducts(products: PublicProduct[]) {
  const groups = new Map<string, ShopProductCategory>();

  for (const product of products) {
    const categoryId = product.category?.id ?? "uncategorized";
    const categoryName = product.category?.name ?? "Home care";
    const existing = groups.get(categoryId);

    if (existing) {
      existing.products.push(product);
    } else {
      groups.set(categoryId, {
        id: categoryId,
        name: categoryName,
        description: product.category?.description ?? null,
        imageUrl: product.category?.imageUrl ?? null,
        products: [product]
      });
    }
  }

  return [...groups.values()];
}

function formatProductVolume(product: PublicProduct) {
  if (!product.contentAmount || !product.contentUnit) {
    return "home care";
  }

  return `${formatPlainNumber(product.contentAmount)} ${formatUnit(product.contentUnit)}`;
}

function ShopView({
  onOpenAdmin,
  onOpenBooking,
  onOpenHome
}: {
  onOpenAdmin?: () => void;
  onOpenBooking: () => void;
  onOpenHome: () => void;
}) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetchProducts()
      .then((items) => {
        setProducts(items);
        setStatus("ready");
      })
      .catch(() => {
        setProducts([]);
        setStatus("error");
      });
  }, []);

  const visibleProducts = useMemo(() => {
    return products.length > 0 ? products : shopProductFallback;
  }, [products]);
  const categories = useMemo(() => groupShopProducts(visibleProducts), [visibleProducts]);

  return (
    <main className="shop-shell">
      <header className="home-nav shop-nav">
        <button className="home-brand-button" onClick={onOpenHome} type="button">
          <span className="home-mark">SL</span>
          <span className="cl-logo-part">Color Studio</span>
        </button>
        <nav aria-label="Shop navigation">
          <button onClick={onOpenHome} type="button">Salon</button>
          <a href="#shop-catalog">Catalog</a>
          <a href="#shop-contact">Contact</a>
        </nav>
        <div className="home-nav-actions">
          {onOpenAdmin ? (
            <button className="secondary-button" onClick={onOpenAdmin} type="button">
              CRM
            </button>
          ) : null}
          <button className="primary-button" onClick={onOpenBooking} type="button">
            Book appointment
          </button>
        </div>
      </header>

      <section className="shop-hero">
        <img alt="Professional hair care cosmetics bottles" src={homeImages.products} />
        <div className="shop-hero-overlay" />
        <div className="shop-hero-content">
          <p className="eyebrow">Professional home care</p>
          <h1>Professional cosmetics</h1>
          <p>Products selected for salon clients: shampoos, conditioners and care formulas grouped by category.</p>
          <div className="home-hero-actions">
            <a href="#shop-catalog">View catalog</a>
            <button className="primary-button" onClick={onOpenBooking} type="button">
              Ask specialist
            </button>
          </div>
        </div>
      </section>

      <section className="shop-catalog" id="shop-catalog">
        <div className="shop-watermark" aria-hidden="true">
          Professional cosmetics
        </div>
        <header className="home-price-heading shop-heading">
          <p className="eyebrow">Product catalog</p>
          <h2>HOME CARE</h2>
          <span>{visibleProducts.length} products</span>
        </header>

        {status === "loading" ? <div className="empty-state">Loading cosmetics...</div> : null}
        {status === "error" ? <div className="admin-alert">Could not load products. Showing demo catalog.</div> : null}

        <div className="shop-category-list">
          {categories.map((category) => (
            <article className="shop-category-card" key={category.id}>
              <div className="shop-category-media">
                <img alt="" src={category.imageUrl ?? homeImages.products} />
                <span>Professional care</span>
              </div>
              <div className="shop-category-body">
                <div className="shop-category-heading">
                  <div>
                    <h3>{category.name}</h3>
                    {category.description ? <p>{category.description}</p> : null}
                  </div>
                  <span>{category.products.length} items</span>
                </div>

                <div className="shop-product-list">
                  {category.products.map((product) => (
                    <button className="shop-product-row" key={product.id} onClick={() => setSelectedProduct(product)} type="button">
                      <div className="shop-product-image">
                        {product.imageUrl ? (
                          <img
                            alt={product.name}
                            src={product.imageUrl}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span>{product.brand?.slice(0, 2) || "SL"}</span>
                        )}
                      </div>
                      <div className="shop-product-copy">
                        <strong>{product.name}</strong>
                        <small>{product.description || product.brand || "Professional salon care"}</small>
                      </div>
                      <div className="shop-product-meta">
                        <span>{product.brand || "SL Color Studio"}</span>
                        <span>{formatProductVolume(product)}</span>
                        <strong>{formatHryvnia(product.price)}</strong>
                      </div>
                    </button>
                  ))}
                </div>

                <button className="shop-category-action" onClick={onOpenBooking} type="button">
                  Request recommendation <ArrowRight aria-hidden="true" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-contact" id="shop-contact">
        <div className="home-section-heading">
          <p className="eyebrow">Contact</p>
          <h2>Choose care with a specialist</h2>
          <p>The catalog is managed from CRM inventory. Ask the salon team which product fits your hair and color history.</p>
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
            <span>Pick up in salon</span>
          </div>
        </div>
      </section>
      {selectedProduct ? <ProductDetailDialog onClose={() => setSelectedProduct(null)} onRequest={onOpenBooking} product={selectedProduct} /> : null}
    </main>
  );
}

function ProductDetailDialog({
  onClose,
  onRequest,
  product
}: {
  onClose: () => void;
  onRequest: () => void;
  product: PublicProduct;
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section aria-modal="true" className="admin-modal product-detail-modal" role="dialog">
        <div className="panel-header">
          <div>
            <p className="admin-kicker">{product.brand || "Professional cosmetics"}</p>
            <h2>{product.name}</h2>
          </div>
          <button aria-label="Close product details" className="icon-only-button" onClick={onClose} title="Close" type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="product-detail-layout">
          <div className="product-detail-image">
            {product.imageUrl ? <img alt={product.name} src={product.imageUrl} /> : <span>{product.brand?.slice(0, 2) || "SL"}</span>}
          </div>
          <div className="product-detail-copy">
            <p>{product.description || "Professional salon care selected for home routine support."}</p>
            <div className="product-detail-meta">
              <span>{product.category?.name ?? "Home care"}</span>
              <span>{formatProductVolume(product)}</span>
              <strong>{formatHryvnia(product.price)}</strong>
            </div>
            {product.quote ? <blockquote>{product.quote}</blockquote> : <blockquote>Professional care should feel precise, calm and easy to keep at home.</blockquote>}
          </div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button compact-button" onClick={onClose} type="button">
            Close
          </button>
          <button className="primary-button compact-button" onClick={onRequest} type="button">
            Ask specialist
          </button>
        </div>
      </section>
    </div>
  );
}

function LoginView({
  isCheckingAuth,
  onOpenBooking,
  onSuccess
}: {
  isCheckingAuth: boolean;
  onOpenBooking?: () => void;
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
        {onOpenBooking ? (
          <button className="booking-link light" onClick={onOpenBooking} type="button">
            Go to online booking
          </button>
        ) : null}
      </section>
    </main>
  );
}

function AdminPanel({ onLogout, onOpenBooking, user }: { onLogout: () => void; onOpenBooking?: () => void; user: AuthUser }) {
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

        {onOpenBooking ? (
          <button className="booking-link" onClick={onOpenBooking} type="button">
            Open online booking
          </button>
        ) : null}
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
    return (
      <DashboardSection
        dashboard={data.dashboard}
        analytics={data.consumableAnalytics}
        businessAnalytics={data.businessAnalytics}
        appointments={data.appointments}
        products={data.products}
      />
    );
  }

  if (section === "dashboard") {
    return (
      <DashboardSection
        dashboard={data.dashboard}
        analytics={data.consumableAnalytics}
        businessAnalytics={data.businessAnalytics}
        appointments={data.appointments}
        products={data.products}
      />
    );
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
    return <ClientsSection clients={data.clients} runAction={runAction} />;
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
    return <ProductsSection brands={data.productBrands} categories={data.productCategories} components={data.productComponents} products={data.products} runAction={runAction} />;
  }

  if (section === "sales") {
    return <SalesSection sales={data.sales} products={data.products} clients={data.clients} employees={data.employees} runAction={runAction} />;
  }

  if (section === "store-orders") {
    return <StoreOrdersSection orders={data.storeOrders} runAction={runAction} />;
  }

  if (section === "payments") {
    return <PaymentsSection payments={data.payments} runAction={runAction} />;
  }

  if (section === "reviews") {
    return <ReviewsSection reviews={data.reviews} />;
  }

  return <SettingsSection settings={data.settings} runAction={runAction} />;
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
            onCreateScheduleOverride={(payload) => runAction(() => createAdminEmployeeScheduleOverride(schedulingEmployee.id, payload))}
            onDeleteScheduleOverride={(overrideId) => runAction(() => deleteAdminEmployeeScheduleOverride(schedulingEmployee.id, overrideId))}
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
  onCreateScheduleOverride,
  onCreateTimeOff,
  onDeleteScheduleOverride,
  onDeleteTimeOff,
  onSubmit
}: {
  employee: AdminData["employees"][number];
  onCancel: () => void;
  onCreateScheduleOverride: (payload: EmployeeScheduleOverrideInput) => Promise<void>;
  onCreateTimeOff: (payload: EmployeeTimeOffInput) => Promise<void>;
  onDeleteScheduleOverride: (overrideId: string) => Promise<void>;
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
  const [overrideForm, setOverrideForm] = useState({
    startDate: today,
    endDate: addDaysToDateString(today, 30),
    startTime: "09:00",
    endTime: "18:00",
    isClosed: false,
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

  function submitScheduleOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onCreateScheduleOverride({
      startDate: overrideForm.startDate,
      endDate: overrideForm.endDate,
      startTime: overrideForm.isClosed ? undefined : overrideForm.startTime,
      endTime: overrideForm.isClosed ? undefined : overrideForm.endTime,
      isClosed: overrideForm.isClosed,
      reason: overrideForm.reason || undefined
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
          <p className="admin-kicker">Custom period schedule</p>
          <DataTable
            columns={["Date", "Hours", "Reason", "Actions"]}
            rows={
              employee.scheduleOverrides.length > 0
                ? employee.scheduleOverrides.map((item) => [
                    formatDateOnly(item.workDate),
                    item.isClosed ? "closed" : `${item.startTime}-${item.endTime}`,
                    item.reason || "-",
                    <InlineActions labels={["Delete"]} onAction={() => void onDeleteScheduleOverride(item.id)} />
                  ])
                : [["No custom schedule days", "-", "-", "-"]]
            }
          />
        </div>

        <form className="admin-form" onSubmit={submitScheduleOverride}>
          <div className="form-section">
            <label>
              <span>From date</span>
              <input
                onChange={(event) => setOverrideForm({ ...overrideForm, startDate: event.target.value })}
                type="date"
                value={overrideForm.startDate}
              />
            </label>
            <label>
              <span>To date</span>
              <input
                min={overrideForm.startDate}
                onChange={(event) => setOverrideForm({ ...overrideForm, endDate: event.target.value })}
                type="date"
                value={overrideForm.endDate}
              />
            </label>
          </div>
          <label className="checkbox-line">
            <input checked={overrideForm.isClosed} onChange={(event) => setOverrideForm({ ...overrideForm, isClosed: event.target.checked })} type="checkbox" />
            <span>Close this period</span>
          </label>
          {!overrideForm.isClosed ? (
            <div className="form-section">
              <label>
                <span>Start</span>
                <input onChange={(event) => setOverrideForm({ ...overrideForm, startTime: event.target.value })} type="time" value={overrideForm.startTime} />
              </label>
              <label>
                <span>End</span>
                <input onChange={(event) => setOverrideForm({ ...overrideForm, endTime: event.target.value })} type="time" value={overrideForm.endTime} />
              </label>
            </div>
          ) : null}
          <label>
            <span>Reason</span>
            <input value={overrideForm.reason} onChange={(event) => setOverrideForm({ ...overrideForm, reason: event.target.value })} />
          </label>
          <small className="form-note neutral-note">Overrides replace the weekly schedule for selected dates. Maximum range is 62 days.</small>
          <button className="secondary-button compact-button" type="submit">
            Apply period schedule
          </button>
        </form>
      </section>

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
  const saleProducts = products.filter(canSellProduct);
  const [isSaleFormOpen, setIsSaleFormOpen] = useState(false);
  const [refundSale, setRefundSale] = useState<AdminData["sales"][number] | null>(null);

  return (
    <>
      <div className="admin-grid">
        <Panel title="Product sales" action="Create sale" onAction={() => setIsSaleFormOpen(true)} wide>
          <DataTable
            columns={["Product", "Quantity", "Client", "Payment", "Net amount", "Actions"]}
            rows={sales.map((item) => [
              item.product,
              item.qty,
              item.client,
              <span className="payment-cell">
                <StatusBadge status={item.paymentStatus} />
                <small>{item.paymentMethod}</small>
              </span>,
              <span className={item.netTotal < 0 ? "net-amount negative" : item.netTotal > 0 ? "net-amount positive" : "net-amount"}>{formatNetMoney(item.netTotal, item.paymentStatus)}</span>,
              item.paymentId && item.paymentStatus !== "refunded" ? <InlineActions labels={["Refund"]} onAction={() => setRefundSale(item)} /> : "-"
            ])}
          />
        </Panel>
      </div>

      {isSaleFormOpen ? (
        <AdminModal className="sale-form-modal" onClose={() => setIsSaleFormOpen(false)} title="Create product sale">
          <SaleForm
            clients={clients}
            employees={employees}
            onCancel={() => setIsSaleFormOpen(false)}
            onSubmit={(payload) => runAction(() => createAdminSale(payload)).then(() => setIsSaleFormOpen(false))}
            products={saleProducts}
          />
        </AdminModal>
      ) : null}

      {refundSale ? (
        <RefundSaleModal
          onClose={() => setRefundSale(null)}
          onSubmit={(payload) =>
            runAction(() =>
              updateAdminPayment(refundSale.paymentId ?? "", {
                status: "refunded",
                method: refundSale.paymentMethod,
                reason: payload.reason,
                returnToStock: payload.returnToStock
              })
            ).then(() => setRefundSale(null))
          }
          sale={refundSale}
        />
      ) : null}
    </>
  );
}

function PaymentsSection({
  payments,
  runAction
}: {
  payments: AdminData["payments"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [selectedPayment, setSelectedPayment] = useState<AdminData["payments"][number] | null>(null);

  return (
    <>
      <div className="admin-grid">
        <Panel title="Payments" action="Add payment">
          <DataTable
            columns={["Source", "Client", "Method", "Status", "Net amount", "Actions"]}
            rows={payments.map((item) => {
              const actionLabels = [
                "Details",
                ...(item.status === "paid" ? [] : ["paid"]),
                ...(item.status !== "refunded" && item.source !== "Products" ? ["refunded"] : [])
              ];

              return [
                item.source,
                item.client,
                item.method,
                <StatusBadge status={item.status} />,
                <span className={item.netAmount < 0 ? "net-amount negative" : item.netAmount > 0 ? "net-amount positive" : "net-amount"}>{formatNetMoney(item.netAmount, item.status)}</span>,
                <InlineActions
                  labels={actionLabels}
                  onAction={(label) => {
                    if (label === "Details") {
                      setSelectedPayment(item);
                      return;
                    }

                    void runAction(() => updateAdminPayment(item.id, { status: label, method: item.method }));
                  }}
                />
              ];
            })}
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

      {selectedPayment ? <PaymentAuditModal onClose={() => setSelectedPayment(null)} payment={selectedPayment} /> : null}
    </>
  );
}

function RefundSaleModal({
  onClose,
  onSubmit,
  sale
}: {
  onClose: () => void;
  onSubmit: (payload: { reason: string; returnToStock: boolean }) => Promise<void>;
  sale: AdminData["sales"][number];
}) {
  const [reason, setReason] = useState("");
  const [returnToStock, setReturnToStock] = useState(true);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({ reason, returnToStock });
  }

  return (
    <AdminModal className="sale-refund-modal" onClose={onClose} title="Refund product sale">
      <div className="payment-summary-strip">
        <div>
          <span>Sale</span>
          <strong>{sale.product}</strong>
        </div>
        <div>
          <span>Client</span>
          <strong>{sale.client}</strong>
        </div>
        <div>
          <span>Amount</span>
          <strong>{adminMoney.format(sale.total)}</strong>
        </div>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <label className="checkbox-line">
          <input checked={returnToStock} onChange={(event) => setReturnToStock(event.target.checked)} type="checkbox" />
          <span>Return sold products to stock</span>
        </label>
        <label>
          <span>Refund reason</span>
          <textarea maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Optional, but useful for audit" rows={4} value={reason} />
        </label>
        <p className="form-note neutral-note">{returnToStock ? "Stock will be increased once. Repeating the same stock return will be blocked." : "Only money will be refunded. Product stock will stay unchanged."}</p>
        <div className="modal-actions">
          <button className="secondary-button compact-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button admin-submit" type="submit">
            Refund sale
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

function PaymentAuditModal({ onClose, payment }: { onClose: () => void; payment: AdminData["payments"][number] }) {
  return (
    <AdminModal className="payment-audit-modal" onClose={onClose} title="Payment details">
      <div className="payment-summary-strip">
        <div>
          <span>Source</span>
          <strong>{payment.source}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>
            <StatusBadge status={payment.status} />
          </strong>
        </div>
        <div>
          <span>Net amount</span>
          <strong className={payment.netAmount < 0 ? "net-amount negative" : payment.netAmount > 0 ? "net-amount positive" : "net-amount"}>{formatNetMoney(payment.netAmount, payment.status)}</strong>
        </div>
      </div>
      <InfoList
        items={[
          ["Client", payment.client],
          ["Method", payment.method],
          ["Original amount", adminMoney.format(payment.amount)],
          ["Paid/refunded at", payment.paidAt ? formatStockMovementDateTime(payment.paidAt) : "-"]
        ]}
      />
      <section className="appointment-audit-card">
        <h3>Audit trail</h3>
        <div className="appointment-audit-list">
          {payment.auditLogs.length > 0 ? (
            payment.auditLogs.map((log) => (
              <article key={log.id}>
                <div>
                  <strong>{log.summary}</strong>
                  <span>
                    {formatStockMovementDateTime(log.createdAt)} · {log.actor}
                    {typeof log.details?.reason === "string" && log.details.reason ? ` · ${log.details.reason}` : ""}
                  </span>
                </div>
                <StatusBadge status={log.eventType} />
              </article>
            ))
          ) : (
            <div className="modal-state">No audit events yet.</div>
          )}
        </div>
      </section>
    </AdminModal>
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStockMovementDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatStockMovementTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStockMovementDateTime(value: string) {
  return `${formatStockMovementDate(value)}, ${formatStockMovementTime(value)}`;
}

function SaleForm({
  products,
  clients,
  employees,
  onCancel,
  onSubmit
}: {
  products: AdminData["products"];
  clients: AdminData["clients"];
  employees: AdminData["employees"];
  onCancel?: () => void;
  onSubmit: (payload: SaleInput) => Promise<void>;
}) {
  const [form, setForm] = useState({ productId: products[0]?.id ?? "", quantity: "1", clientId: "", employeeId: "", paymentMethod: "cash" });

  useEffect(() => {
    if (!products.some((product) => product.id === form.productId)) {
      setForm((current) => ({ ...current, productId: products[0]?.id ?? "" }));
    }
  }, [form.productId, products]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.productId) {
      return;
    }

    void onSubmit({
      productId: form.productId,
      quantity: Number(form.quantity),
      clientId: form.clientId,
      employeeId: form.employeeId,
      paymentMethod: form.paymentMethod as SaleInput["paymentMethod"]
    });
  }

  const formContent = (
    <form className="admin-form" onSubmit={submit}>
        <label>
          <span>Product</span>
          <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
            {products.length === 0 ? <option value="">No products for sale</option> : null}
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
      <div className="form-actions">
        {onCancel ? (
          <button className="secondary-button compact-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
        <button className="primary-button admin-submit" disabled={!form.productId} type="submit">
          Create sale
        </button>
      </div>
    </form>
  );

  return onCancel ? formContent : <Panel title="New sale">{formContent}</Panel>;
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

type BookingStep = "services" | "employee" | "datetime" | "contact";

const bookingSteps: Array<{ id: BookingStep; label: string }> = [
  { id: "services", label: "Services" },
  { id: "employee", label: "Employee" },
  { id: "datetime", label: "Date & time" },
  { id: "contact", label: "Contact" }
];

function BookingView({ onOpenAdmin, onOpenHome }: { onOpenAdmin?: () => void; onOpenHome: () => void }) {
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
  const [client, setClient] = useState<BookingClientForm>({ firstName: "", lastName: "", phone: "", email: "" });
  const [clientComment, setClientComment] = useState("");
  const [contactErrors, setContactErrors] = useState<BookingContactErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "success">("loading");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ id: string; startTime: string } | null>(null);

  useEffect(() => {
    void loadServices();
  }, []);

  function loadServices() {
    setStatus("loading");
    setError("");

    fetchServices()
      .then((data) => {
        setServices(data);
        setStatus("idle");
      })
      .catch((loadError) => {
        setError(getBookingErrorMessage(loadError, "Could not load services. Check that the CRM API is running and refresh the page."));
        setStatus("idle");
      });
  }

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
      .catch((loadError) => setError(getBookingErrorMessage(loadError, "Could not load employees for the selected services. Try again in a moment.")))
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
      .catch((loadError) => {
        if (!cancelled) {
          setError(getBookingErrorMessage(loadError, "Could not load available times. Try another date or refresh the page."));
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

  function clearContactError(field: BookingContactField) {
    setContactErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

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
    setContactErrors({});
    setConfirmation(null);
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

    const nextContactErrors = getBookingContactErrors(client, clientComment);

    if (Object.keys(nextContactErrors).length > 0) {
      setContactErrors(nextContactErrors);
      setError(`Please correct the contact details: ${Object.values(nextContactErrors).join(" ")}`);
      return;
    }

    setContactErrors({});
    setStatus("saving");

    try {
      const createdAppointment = await createAppointment({
        employeeId: selectedEmployeeId,
        serviceIds: selectedServiceIds,
        startTime: selectedSlot.startTime,
        client,
        clientComment: clientComment || undefined
      });
      setConfirmation(createdAppointment);
      setStatus("success");
    } catch (saveError) {
      setError(getBookingErrorMessage(saveError, "Could not create the appointment."));
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
            {client.firstName}, your visit is reserved for {selectedSlot?.label} on {formatSuggestedDate(selectedDate)}.
          </p>
          <div className="success-highlight">
            <span>Booking reference</span>
            <strong>{confirmation ? `#${confirmation.id}` : "confirmed"}</strong>
          </div>
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
          <div className="success-next-steps">
            <strong>Next step</strong>
            <span>Save the date. The salon team will use your phone number to identify this booking if anything changes.</span>
          </div>
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
        {onOpenAdmin ? (
          <button className="mode-switch" onClick={onOpenAdmin} type="button">
            Admin CRM
          </button>
        ) : null}
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

            {status === "loading" ? <BookingEmptyState title="Loading services" detail="We are preparing the current service list." /> : null}

            {status !== "loading" && services.length === 0 ? (
              <BookingEmptyState
                title="No services available online"
                detail="The salon may be updating the price list. Try refreshing the services or contact the salon directly."
                action={
                  <button className="secondary-button compact-button" onClick={() => void loadServices()} type="button">
                    Refresh services
                  </button>
                }
              />
            ) : null}

            {status !== "loading" && services.length > 0 ? (
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
            ) : null}

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

            {isLoadingEmployees ? <BookingEmptyState title="Finding specialists" detail="We are matching your selected services with available employees." /> : null}

            {!isLoadingEmployees && employees.length === 0 ? (
              <BookingEmptyState
                title="No specialist matches these services"
                detail="Choose another service combination or contact the salon so we can help you pick the right appointment."
                action={
                  <button className="secondary-button compact-button" onClick={() => goToStep("services")} type="button">
                    Change services
                  </button>
                }
              />
            ) : null}

            {!isLoadingEmployees && employees.length > 0 ? (
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
            ) : null}

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
                  {isLoadingSlots ? <BookingEmptyState title="Checking available times" detail="One moment, we are looking at the salon calendar." /> : null}
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
                    <BookingEmptyState title="No slots on this date" detail="Try another date or use one of the nearest available options below." />
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

              <form onSubmit={handleSubmit} className="booking-form" noValidate>
                <section className="form-section client-grid">
                  <label>
                    <span>First name</span>
                    <input
                      aria-describedby={contactErrors.firstName ? "booking-first-name-error" : undefined}
                      aria-invalid={Boolean(contactErrors.firstName)}
                      autoComplete="given-name"
                      maxLength={100}
                      value={client.firstName}
                      onChange={(event) => {
                        setClient({ ...client, firstName: event.target.value });
                        clearContactError("firstName");
                        setError("");
                      }}
                      required
                    />
                    {contactErrors.firstName ? (
                      <small className="field-error" id="booking-first-name-error">
                        {contactErrors.firstName}
                      </small>
                    ) : null}
                  </label>
                  <label>
                    <span>Last name</span>
                    <input
                      aria-describedby={contactErrors.lastName ? "booking-last-name-error" : undefined}
                      aria-invalid={Boolean(contactErrors.lastName)}
                      autoComplete="family-name"
                      maxLength={100}
                      value={client.lastName}
                      onChange={(event) => {
                        setClient({ ...client, lastName: event.target.value });
                        clearContactError("lastName");
                        setError("");
                      }}
                      required
                    />
                    {contactErrors.lastName ? (
                      <small className="field-error" id="booking-last-name-error">
                        {contactErrors.lastName}
                      </small>
                    ) : null}
                  </label>
                  <label>
                    <span>Phone</span>
                    <input
                      aria-describedby={contactErrors.phone ? "booking-phone-error" : undefined}
                      aria-invalid={Boolean(contactErrors.phone)}
                      autoComplete="tel"
                      inputMode="tel"
                      maxLength={20}
                      minLength={5}
                      value={client.phone}
                      onChange={(event) => {
                        setClient({ ...client, phone: event.target.value });
                        clearContactError("phone");
                        setError("");
                      }}
                      required
                    />
                    {contactErrors.phone ? (
                      <small className="field-error" id="booking-phone-error">
                        {contactErrors.phone}
                      </small>
                    ) : null}
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      aria-describedby={contactErrors.email ? "booking-email-error" : undefined}
                      aria-invalid={Boolean(contactErrors.email)}
                      autoComplete="email"
                      maxLength={255}
                      type="email"
                      value={client.email}
                      onChange={(event) => {
                        setClient({ ...client, email: event.target.value });
                        clearContactError("email");
                        setError("");
                      }}
                    />
                    {contactErrors.email ? (
                      <small className="field-error" id="booking-email-error">
                        {contactErrors.email}
                      </small>
                    ) : null}
                  </label>
                </section>

                <label className="full-width">
                  <span>Comment</span>
                  <textarea
                    aria-describedby={contactErrors.comment ? "booking-comment-error" : undefined}
                    aria-invalid={Boolean(contactErrors.comment)}
                    maxLength={1000}
                    value={clientComment}
                    onChange={(event) => {
                      setClientComment(event.target.value);
                      clearContactError("comment");
                      setError("");
                    }}
                    rows={3}
                  />
                  {contactErrors.comment ? (
                    <small className="field-error" id="booking-comment-error">
                      {contactErrors.comment}
                    </small>
                  ) : null}
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
