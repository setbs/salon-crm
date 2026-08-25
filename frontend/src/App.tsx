import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Clock,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Instagram,
  Mail,
  Menu,
  MapPin,
  Package,
  Phone,
  Search,
  Scissors,
  Send,
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
import {
  CrmLanguageContext,
  crmLabel,
  readStoredCrmLanguage,
  storeCrmLanguage,
  useCrmT,
  type CrmLanguage,
  type CrmTextKey
} from "./crm-i18n";
import logoFull from "./images/logos/logo-full.png";
import logoMain from "./images/logos/logo-main.png";
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

function formatServicePrice(value: DisplayPrice, language: PublicLanguage = "en") {
  if (value.priceFrom !== null && value.priceFrom !== undefined && value.priceTo !== null && value.priceTo !== undefined) {
    return `${plainHryvnia.format(value.priceFrom)} - ${plainHryvnia.format(value.priceTo)} ₴`;
  }

  if (value.priceFrom !== null && value.priceFrom !== undefined) {
    return `${language === "uk" ? "від" : "from"} ${formatHryvnia(value.priceFrom)}`;
  }

  if (value.priceTo !== null && value.priceTo !== undefined) {
    return `${language === "uk" ? "до" : "up to"} ${formatHryvnia(value.priceTo)}`;
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

function getBookingContactErrors(client: BookingClientForm, comment: string, language: PublicLanguage = "en"): BookingContactErrors {
  const errors: BookingContactErrors = {};
  const firstName = client.firstName.trim();
  const lastName = client.lastName.trim();
  const phone = client.phone.trim();
  const email = client.email.trim();
  const digitCount = phone.replace(/\D/g, "").length;
  const isUk = language === "uk";

  if (!firstName) {
    errors.firstName = isUk ? "Імʼя обовʼязкове." : "First name is required.";
  } else if (firstName.length > 100) {
    errors.firstName = isUk ? "Імʼя має містити не більше 100 символів." : "First name must be 100 characters or fewer.";
  }

  if (!lastName) {
    errors.lastName = isUk ? "Прізвище обовʼязкове." : "Last name is required.";
  } else if (lastName.length > 100) {
    errors.lastName = isUk ? "Прізвище має містити не більше 100 символів." : "Last name must be 100 characters or fewer.";
  }

  if (!phone) {
    errors.phone = isUk ? "Номер телефону обовʼязковий." : "Phone number is required.";
  } else if (phone.length < 5 || phone.length > 20 || digitCount < 5 || !/^[+\d\s()-]+$/.test(phone)) {
    errors.phone = isUk ? "Телефон має містити 5-20 цифр або телефонних символів." : "Phone must contain 5-20 digits or phone symbols.";
  }

  if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email))) {
    errors.email = isUk ? "Email має містити коректний домен, наприклад name@example.com." : "Email must include a valid domain, for example name@example.com.";
  }

  if (comment.trim().length > 1000) {
    errors.comment = isUk ? "Коментар має містити не більше 1000 символів." : "Comment must be 1000 characters or fewer.";
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
type PublicLanguage = "en" | "uk";
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

const adminNav: Array<{ id: AdminSection; labelKey: CrmTextKey; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { id: "calendar", labelKey: "calendar", icon: CalendarDays },
  { id: "clients", labelKey: "clients", icon: UsersRound },
  { id: "services", labelKey: "services", icon: Scissors },
  { id: "employees", labelKey: "employees", icon: UserRound },
  { id: "portfolio", labelKey: "portfolio", icon: Camera },
  { id: "products", labelKey: "products", icon: Package },
  { id: "sales", labelKey: "sales", icon: ShoppingCart },
  { id: "store-orders", labelKey: "storeOrders", icon: Store },
  { id: "payments", labelKey: "payments", icon: CreditCard },
  { id: "reviews", labelKey: "reviews", icon: Star },
  { id: "settings", labelKey: "settings", icon: Settings }
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

const publicText = {
  en: {
    about: "About",
    portfolio: "Portfolio",
    priceList: "Price list",
    cosmetics: "Cosmetics",
    contact: "Contact",
    bookAppointment: "Book appointment",
    professionalCosmetics: "Professional cosmetics",
    viewPriceList: "View price list",
    heroTitle: "Beauty salon for hair, color and nail care",
    heroText: "A calm salon experience with attentive consultations, precise work and clear online booking.",
    nextVisit: "Next visit",
    visitHighlights: "Consultation, service, care plan",
    clearTiming: "Clear timing",
    onlineBooking: "Online booking",
    bookWithoutCalls: "Book without calls",
    bookWithoutCallsText: "Choose a service, specialist and time in a few steps.",
    priceBeforeVisit: "Price before visit",
    priceBeforeVisitText: "Categories are grouped in a clean price list.",
    careAfterSalon: "Care after salon",
    careAfterSalonText: "Professional cosmetics are kept in a separate catalog.",
    aboutSalon: "About salon",
    aboutTitle: "Focused care, clean aesthetics and a clear client path",
    aboutText: "SL Color Studio combines color work, hair care and nail services with a CRM workflow that keeps booking, schedules and client details organized.",
    aboutCopy: "The salon page stays simple for clients: learn the atmosphere, see selected work, check contacts, and open the price list when they are ready to choose a service.",
    structuredPriceList: "Structured price list",
    crmReadyWorkflow: "CRM-ready workflow",
    aboutQuote: "A visit should feel easy before the client even sits in the chair.",
    salonRhythm: "Salon rhythm",
    atmosphereTitle: "Soft visuals, precise work and a calmer flow",
    atmosphereText: "The public page keeps the client focused: atmosphere first, then examples of work, then prices and contact. Behind it, CRM keeps the operational part tidy.",
    startBooking: "Start booking",
    selectedWork: "Selected work",
    portfolioText: "Visual proof matters in beauty services. The gallery is managed from the CRM portfolio section.",
    services: "Services",
    visitTitle: "Visit SL Color Studio",
    visitText: "Book online or contact the salon directly.",
    phone: "Phone",
    address: "Address",
    workingHours: "Working hours",
    switchToUk: "Українська версія",
    switchToEn: "English version",
    languageHint: "Language",
    salon: "Salon",
    catalog: "Catalog",
    shopHeroEyebrow: "Professional home care",
    shopHeroTitle: "Professional cosmetics",
    shopHeroText: "Products selected for salon clients: shampoos, conditioners and care formulas grouped by category.",
    viewCatalog: "View catalog",
    askSpecialist: "Ask specialist",
    productCatalog: "Product catalog",
    homeCare: "HOME CARE",
    products: "products",
    loadingCosmetics: "Loading cosmetics...",
    productsError: "Could not load products. Showing demo catalog.",
    professionalCare: "Professional care",
    items: "items",
    salonCare: "Professional salon care",
    requestRecommendation: "Request recommendation",
    shopContactTitle: "Choose care with a specialist",
    shopContactText: "The catalog is managed from CRM inventory. Ask the salon team which product fits your hair and color history.",
    pickUpInSalon: "Pick up in salon",
    website: "Website",
    appointmentConfirmed: "Appointment confirmed",
    bookingReference: "Booking reference",
    employee: "Employee",
    selectedEmployee: "Selected employee",
    dateAndTime: "Date and time",
    total: "Total",
    nextStep: "Next step",
    successNote: "Save the date. The salon team will use your phone number to identify this booking if anything changes.",
    bookAnother: "Book another appointment",
    backToWebsite: "Back to website",
    bookYourAppointment: "Book your appointment",
    bookingIntro: "Choose a service, specialist, time, and leave your contact details.",
    step1: "Step 1",
    step2: "Step 2",
    step3: "Step 3",
    finalStep: "Final step",
    selectServices: "Select services",
    selectServicesText: "Pick one or more services. The total duration will be calculated automatically.",
    loadingServices: "Loading services",
    loadingServicesText: "We are preparing the current service list.",
    noServices: "No services available online",
    noServicesText: "The salon may be updating the price list. Try refreshing the services or contact the salon directly.",
    refreshServices: "Refresh services",
    individualConsultation: "Individual consultation",
    selected: "selected",
    noServicesSelected: "No services selected",
    chooseServices: "Choose services",
    minTotal: "min total",
    startWithServices: "Start with the service list",
    loading: "Loading...",
    continue: "Continue",
    chooseEmployee: "Choose an employee",
    chooseEmployeeText: "Select the specialist who will perform the chosen services.",
    findingSpecialists: "Finding specialists",
    findingSpecialistsText: "We are matching your selected services with available employees.",
    noSpecialist: "No specialist matches these services",
    noSpecialistText: "Choose another service combination or contact the salon so we can help you pick the right appointment.",
    changeServices: "Change services",
    beautySpecialist: "Beauty specialist",
    back: "Back",
    chooseDateTime: "Choose date and time",
    chooseVisitTime: "Choose when you want to visit the salon.",
    selectedForVisit: "is selected for this visit.",
    visitSummary: "Visit summary",
    employeeNotSelected: "Employee not selected",
    date: "Date",
    availableTime: "Available time",
    checkingTimes: "Checking available times",
    checkingTimesText: "One moment, we are looking at the salon calendar.",
    noSlots: "No slots on this date",
    noSlotsText: "Try another date or use one of the nearest available options below.",
    nearestDays: "Nearest days",
    nearestTerms: "Nearest terms",
    lookingDays: "Looking for available days...",
    lookingTerms: "Looking for the nearest available terms...",
    noDaysFound: "No available days found in the next 30 days.",
    noTermsFound: "No available terms found in the next 30 days.",
    from: "from",
    timeSingular: "time",
    timePlural: "times",
    contactDetails: "Your contact details",
    contactDetailsText: "We will use these details to identify your booking.",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    comment: "Comment",
    appointment: "Appointment",
    booking: "Booking...",
    confirmAppointment: "Confirm appointment",
    chooseServiceError: "Choose at least one service.",
    loadingEmployeesError: "Loading employees for the selected services.",
    noEmployeesError: "No employees are available for the selected services.",
    chooseEmployeeError: "Choose an employee.",
    chooseTimeError: "Choose an available time.",
    correctContactDetails: "Please correct the contact details:",
    loadServicesError: "Could not load services. Check that the CRM API is running and refresh the page.",
    loadEmployeesError: "Could not load employees for the selected services. Try again in a moment.",
    loadTimesError: "Could not load available times. Try another date or refresh the page.",
    createAppointmentError: "Could not create the appointment.",
    otherServices: "Other services",
    appointmentReserved: "your visit is reserved for",
    onDate: "on",
    confirmed: "confirmed"
  },
  uk: {
    about: "Про салон",
    portfolio: "Портфоліо",
    priceList: "Прайс лист",
    cosmetics: "Косметика",
    contact: "Контакти",
    bookAppointment: "Записатися",
    professionalCosmetics: "Професійна косметика",
    viewPriceList: "Переглянути прайс",
    heroTitle: "Салон краси для волосся, кольору та професійного догляду",
    heroText: "Професійне фарбування, стрижки та догляд за волоссям з уважною консультацією, точним підбором рішень і комфортною атмосферою.",
    nextVisit: "Наступний візит",
    visitHighlights: "Консультація, процедура, план догляду",
    clearTiming: "Чіткий час",
    onlineBooking: "Iндивідуальний підхід",
    bookWithoutCalls: "Запис без дзвінків",
    bookWithoutCallsText: "Оберіть послугу, спеціаліста та час у кілька кроків.",
    priceBeforeVisit: "Ціна до візиту",
    priceBeforeVisitText: "Категорії зібрані у чистий та зрозумілий прайс лист.",
    careAfterSalon: "Догляд після салону",
    careAfterSalonText: "Професійна косметика винесена в окремий каталог.",
    aboutSalon: "Про салон",
    aboutTitle: "Твій простір краси, турботи та впевненості",
    aboutText: "SL Color Studio — це місце, де ми підкреслюємо твою індивідуальність і створюємо образ, у якому ти почуватимешся собою.",
    aboutCopy: "Для нас важливий не лише результат, а й сам процес. Спокійна атмосфера, професійний підхід, якісні матеріали та чесні рекомендації — без нав'язування зайвих процедур.",
    structuredPriceList: "Якісні матеріали",
    crmReadyWorkflow: "Комфортна атмосфера",
    aboutQuote: "Ми хочемо, щоб після кожного візиту ти виходила не просто з новою зачіскою, а з відчуттям, що сьогодні зробила щось приємне для себе",
    salonRhythm: "Ритм салону",
    atmosphereTitle: "Твій стиль. Наша увага до деталей.",
    atmosphereText: "SL Color Studio — це простір, де професійність поєднується з естетикою та комфортом. Ми уважно слухаємо твої побажання, допомагаємо знайти найкраще рішення та створюємо результат, який гармонійно доповнює саме тебе.",
    startBooking: "Записатись",
    selectedWork: "Роботи, якими ми пишаємося",
    portfolioText: "Кожна робота — це поєднання техніки, стилю та уваги до деталей.",
    services: "Послуги",
    visitTitle: "Завітайте до SL Color Studio",
    visitText: "Запишіться онлайн або звʼяжіться із салоном напряму.",
    phone: "Телефон",
    address: "Адреса",
    workingHours: "Години роботи",
    switchToUk: "Українська версія",
    switchToEn: "English version",
    languageHint: "Мова",
    salon: "Салон",
    catalog: "Каталог",
    shopHeroEyebrow: "Професійний домашній догляд",
    shopHeroTitle: "Професійна косметика",
    shopHeroText: "Продукти, підібрані для клієнтів салону: шампуні, кондиціонери та формули догляду, згруповані за категоріями.",
    viewCatalog: "Переглянути каталог",
    askSpecialist: "Запитати спеціаліста",
    productCatalog: "Каталог товарів",
    homeCare: "ДОМАШНІЙ ДОГЛЯД",
    products: "товарів",
    loadingCosmetics: "Завантажуємо косметику...",
    productsError: "Не вдалося завантажити товари. Показуємо демо-каталог.",
    professionalCare: "Професійний догляд",
    items: "позицій",
    salonCare: "Професійний салонний догляд",
    requestRecommendation: "Попросити рекомендацію",
    shopContactTitle: "Оберіть догляд зі спеціалістом",
    shopContactText: "Каталог керується зі складу CRM. Запитайте команду салону, який продукт підійде вашому волоссю та історії фарбування.",
    pickUpInSalon: "Самовивіз із салону",
    website: "Сайт",
    appointmentConfirmed: "Запис підтверджено",
    bookingReference: "Номер запису",
    employee: "Спеціаліст",
    selectedEmployee: "Обраний спеціаліст",
    dateAndTime: "Дата і час",
    total: "Разом",
    nextStep: "Наступний крок",
    successNote: "Збережіть дату. Команда салону використає ваш номер телефону, щоб знайти запис, якщо щось зміниться.",
    bookAnother: "Записатися ще раз",
    backToWebsite: "Повернутися на сайт",
    bookYourAppointment: "Записатися на візит",
    bookingIntro: "Оберіть послугу, спеціаліста, час і залиште контактні дані.",
    step1: "Крок 1",
    step2: "Крок 2",
    step3: "Крок 3",
    finalStep: "Фінальний крок",
    selectServices: "Оберіть послуги",
    selectServicesText: "Оберіть одну або кілька послуг. Загальна тривалість порахується автоматично.",
    loadingServices: "Завантажуємо послуги",
    loadingServicesText: "Готуємо актуальний список послуг.",
    noServices: "Немає послуг для онлайн-запису",
    noServicesText: "Салон може оновлювати прайс. Спробуйте оновити список або звʼяжіться із салоном напряму.",
    refreshServices: "Оновити послуги",
    individualConsultation: "Індивідуальна консультація",
    selected: "обрано",
    noServicesSelected: "Послуги не обрані",
    chooseServices: "Оберіть послуги",
    minTotal: "хв загалом",
    startWithServices: "Почніть зі списку послуг",
    loading: "Завантаження...",
    continue: "Далі",
    chooseEmployee: "Оберіть спеціаліста",
    chooseEmployeeText: "Оберіть спеціаліста, який виконає вибрані послуги.",
    findingSpecialists: "Шукаємо спеціалістів",
    findingSpecialistsText: "Підбираємо працівників під вибрані послуги.",
    noSpecialist: "Немає спеціаліста для цих послуг",
    noSpecialistText: "Оберіть іншу комбінацію послуг або звʼяжіться із салоном, щоб ми допомогли підібрати запис.",
    changeServices: "Змінити послуги",
    beautySpecialist: "Beauty-спеціаліст",
    back: "Назад",
    chooseDateTime: "Оберіть дату і час",
    chooseVisitTime: "Оберіть, коли хочете завітати до салону.",
    selectedForVisit: "обраний для цього візиту.",
    visitSummary: "Підсумок візиту",
    employeeNotSelected: "Спеціаліст не обраний",
    date: "Дата",
    availableTime: "Доступний час",
    checkingTimes: "Перевіряємо доступний час",
    checkingTimesText: "Зачекайте, переглядаємо календар салону.",
    noSlots: "На цю дату немає вільного часу",
    noSlotsText: "Спробуйте іншу дату або скористайтеся найближчими доступними варіантами нижче.",
    nearestDays: "Найближчі дні",
    nearestTerms: "Найближчі терміни",
    lookingDays: "Шукаємо доступні дні...",
    lookingTerms: "Шукаємо найближчі доступні терміни...",
    noDaysFound: "У наступні 30 днів доступних днів не знайдено.",
    noTermsFound: "У наступні 30 днів доступних термінів не знайдено.",
    from: "від",
    timeSingular: "термін",
    timePlural: "термінів",
    contactDetails: "Ваші контактні дані",
    contactDetailsText: "Ми використаємо ці дані, щоб ідентифікувати ваш запис.",
    firstName: "Імʼя",
    lastName: "Прізвище",
    email: "Email",
    comment: "Коментар",
    appointment: "Запис",
    booking: "Записуємо...",
    confirmAppointment: "Підтвердити запис",
    chooseServiceError: "Оберіть хоча б одну послугу.",
    loadingEmployeesError: "Завантажуємо спеціалістів для вибраних послуг.",
    noEmployeesError: "Для вибраних послуг немає доступних спеціалістів.",
    chooseEmployeeError: "Оберіть спеціаліста.",
    chooseTimeError: "Оберіть доступний час.",
    correctContactDetails: "Будь ласка, виправте контактні дані:",
    loadServicesError: "Не вдалося завантажити послуги. Перевірте, чи CRM API запущений, і оновіть сторінку.",
    loadEmployeesError: "Не вдалося завантажити спеціалістів для вибраних послуг. Спробуйте ще раз за мить.",
    loadTimesError: "Не вдалося завантажити доступний час. Спробуйте іншу дату або оновіть сторінку.",
    createAppointmentError: "Не вдалося створити запис.",
    otherServices: "Інші послуги",
    appointmentReserved: "ваш візит зарезервовано на",
    onDate: "на",
    confirmed: "підтверджено"
  }
} satisfies Record<PublicLanguage, Record<string, string>>;

function publicLabel(language: PublicLanguage, key: keyof typeof publicText.en) {
  return publicText[language][key];
}

function getVisibleAdminNav(user: AuthUser) {
  if (user.role === "ADMIN") {
    return adminNav;
  }

  return adminNav.filter((item) => employeeSections.includes(item.id));
}

export function SalonApp() {
  const [mode, setMode] = useState<SalonMode>("home");
  const [language, setLanguage] = useState<PublicLanguage>("uk");
  const toggleLanguage = () => setLanguage((current) => (current === "en" ? "uk" : "en"));

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <>
      {mode === "home" ? (
        <HomeView language={language} onToggleLanguage={toggleLanguage} onOpenBooking={() => setMode("booking")} onOpenShop={() => setMode("shop")} />
      ) : mode === "shop" ? (
        <ShopView language={language} onToggleLanguage={toggleLanguage} onOpenBooking={() => setMode("booking")} onOpenHome={() => setMode("home")} />
      ) : (
        <BookingView language={language} onOpenHome={() => setMode("home")} />
      )}
    </>
  );
}

export function CrmApp() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => Boolean(getStoredAuthToken()));
  const [crmLanguage, setCrmLanguage] = useState<CrmLanguage>(() => readStoredCrmLanguage());

  useEffect(() => {
    document.documentElement.lang = crmLanguage;
    storeCrmLanguage(crmLanguage);
  }, [crmLanguage]);

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
    <AdminPanel language={crmLanguage} onLanguageChange={setCrmLanguage} onLogout={logout} user={authUser} />
  ) : (
    <LoginView
      isCheckingAuth={isCheckingAuth}
      language={crmLanguage}
      onSuccess={(user) => {
        setAuthUser(user);
      }}
    />
  );
}

export function App() {
  const [mode, setMode] = useState<AppMode>("home");
  const [language, setLanguage] = useState<PublicLanguage>("uk");
  const [crmLanguage, setCrmLanguage] = useState<CrmLanguage>(() => readStoredCrmLanguage());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(() => Boolean(getStoredAuthToken()));
  const toggleLanguage = () => setLanguage((current) => (current === "en" ? "uk" : "en"));

  useEffect(() => {
    document.documentElement.lang = mode === "admin" ? crmLanguage : language;
  }, [crmLanguage, language, mode]);

  useEffect(() => {
    storeCrmLanguage(crmLanguage);
  }, [crmLanguage]);

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
        <HomeView language={language} onToggleLanguage={toggleLanguage} onOpenAdmin={() => setMode("admin")} onOpenBooking={() => setMode("booking")} onOpenShop={() => setMode("shop")} />
      ) : mode === "shop" ? (
        <ShopView language={language} onToggleLanguage={toggleLanguage} onOpenAdmin={() => setMode("admin")} onOpenBooking={() => setMode("booking")} onOpenHome={() => setMode("home")} />
      ) : mode === "admin" ? (
        authUser ? (
          <AdminPanel language={crmLanguage} onLanguageChange={setCrmLanguage} onLogout={logout} onOpenBooking={() => setMode("booking")} user={authUser} />
        ) : (
          <LoginView
            isCheckingAuth={isCheckingAuth}
            language={crmLanguage}
            onOpenBooking={() => setMode("booking")}
            onSuccess={(user) => {
              setAuthUser(user);
              setMode("admin");
            }}
          />
        )
      ) : (
        <BookingView language={language} onOpenAdmin={() => setMode("admin")} onOpenHome={() => setMode("home")} />
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

const salonPhoneDisplay = "+38 (050) 23 03 408";
const salonPhoneHref = "tel:+380502303408";
const salonEmail = "sl.color.studio@example.com";
const salonAddressUk = "вулиця Стуса, 2, Броди, Львівська область, Україна, 80601";
const salonAddressEn = "Stusa St. 2, Brody, Lviv Oblast, Ukraine, 80601";
const salonHours = "09:00 - 18:00";
const salonInstagramHref = "https://www.instagram.com/sl.color.studio_brody/";
const salonTelegramHref = "https://t.me/svitlanakoloryst";
const salonMapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonAddressUk)}`;

const salonSocialLinks = [
  { href: salonInstagramHref, label: "Instagram", icon: <Instagram size={15} /> },
  { href: salonTelegramHref, label: "Telegram", icon: <Send size={15} /> },
  { href: salonPhoneHref, label: "Phone", icon: <Phone size={15} /> }
];

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
  language = "en",
  onOpenAdmin,
  onOpenBooking,
  onOpenShop,
  onToggleLanguage
}: {
  language?: PublicLanguage;
  onOpenAdmin?: () => void;
  onOpenBooking: () => void;
  onOpenShop: () => void;
  onToggleLanguage?: () => void;
}) {
  const t = (key: keyof typeof publicText.en) => publicLabel(language, key);
  const [services, setServices] = useState<Service[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);
  const [portfolioPage, setPortfolioPage] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        priceLabel: formatServicePrice(service, language)
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
  }, [language, services]);
  const visiblePortfolio =
    portfolio.length > 0
      ? portfolio.map((item) => ({ title: item.title, image: item.imageUrl, caption: item.employee }))
      : homePortfolioFallback.map((item) => ({ ...item, caption: item.title }));
  const portfolioPageSize = 3;
  const portfolioPageCount = Math.max(1, Math.ceil(visiblePortfolio.length / portfolioPageSize));
  const safePortfolioPage = Math.min(portfolioPage, portfolioPageCount - 1);
  const pagedPortfolio = visiblePortfolio.slice(safePortfolioPage * portfolioPageSize, safePortfolioPage * portfolioPageSize + portfolioPageSize);

  useEffect(() => {
    setPortfolioPage(0);
  }, [portfolio.length]);

  return (
    <main className="home-shell">
      <header className="home-nav">
        <button
          aria-expanded={isMenuOpen}
          aria-label={language === "uk" ? "Відкрити меню" : "Open menu"}
          className="home-menu-button"
          onClick={() => setIsMenuOpen((value) => !value)}
          type="button"
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button className="home-brand-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
          <img className="home-nav-logo" src={logoFull} alt="SL Color Studio" />
        </button>
        <nav className={isMenuOpen ? "is-open" : ""} aria-label="Public navigation">
          <a href="#about" onClick={() => setIsMenuOpen(false)}>{t("about")}</a>
          <a href="#portfolio" onClick={() => setIsMenuOpen(false)}>{t("portfolio")}</a>
          <a className="nav-feature-link" href="#price-list" onClick={() => setIsMenuOpen(false)}>{t("priceList")}</a>
          <button className="nav-feature-link" onClick={() => { setIsMenuOpen(false); onOpenShop(); }} type="button">{t("cosmetics")}</button>
          <a href="#salon-footer" onClick={() => setIsMenuOpen(false)}>{t("contact")}</a>
          <button className="mobile-nav-action" onClick={() => { setIsMenuOpen(false); onOpenBooking(); }} type="button">{t("bookAppointment")}</button>
        </nav>
        <div className="home-nav-actions">
          <div className="home-social-links" aria-label={language === "uk" ? "Соціальні мережі" : "Social links"}>
            {salonSocialLinks.map((link) => (
              <a
                aria-label={link.label}
                className="home-social-link"
                href={link.href}
                key={link.label}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                target={link.href.startsWith("http") ? "_blank" : undefined}
              >
                {link.icon}
              </a>
            ))}
          </div>
          {onOpenAdmin ? (
            <button className="secondary-button" onClick={onOpenAdmin} type="button">
              CRM
            </button>
          ) : null}
          <button className="primary-button" onClick={onOpenBooking} type="button">
            {t("bookAppointment")}
          </button>
        </div>
      </header>

      <section className="home-hero">
        <img alt="Elegant salon interior with hair styling stations" src={homeImages.hero} />
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <p className="eyebrow">SL Color Studio</p>
          <h1>{t("heroTitle")}</h1>
          <p>{t("heroText")}</p>
          <div className="home-hero-actions">
            <button className="primary-button" onClick={onOpenBooking} type="button">
              {t("bookAppointment")}
            </button>
            <button className="secondary-button" onClick={onOpenShop} type="button">
              {t("professionalCosmetics")}
            </button>
            <a href="#price-list">{t("viewPriceList")}</a>
          </div>
        </div>
        {/* <aside className="home-hero-card" aria-label="Salon visit highlights">
          <span>{t("nextVisit")}</span>
          <strong>{t("visitHighlights")}</strong>
          <div>
            <small>{t("clearTiming")}</small>
            <small>{t("onlineBooking")}</small>
            <small>{t("professionalCosmetics")}</small>
          </div>
        </aside> */}
      </section>

      <section className="home-experience-strip" aria-label="Salon experience">
        <article>
          <CalendarDays aria-hidden="true" size={20} />
          <span>{t("bookWithoutCalls")}</span>
          <p>{t("bookWithoutCallsText")}</p>
        </article>
        <article>
          <Scissors aria-hidden="true" size={20} />
          <span>{t("priceBeforeVisit")}</span>
          <p>{t("priceBeforeVisitText")}</p>
        </article>
        <article>
          <Package aria-hidden="true" size={20} />
          <span>{t("careAfterSalon")}</span>
          <p>{t("careAfterSalonText")}</p>
        </article>
      </section>

      <section className="home-section home-about" id="about">
        <div className="home-section-heading">
          <p className="eyebrow">{t("aboutSalon")}</p>
          <h2>{t("aboutTitle")}</h2>
          <p>{t("aboutText")}</p>
        </div>
        <div className="home-about-layout">
          <img alt="Hair care consultation at a beauty salon" src={homeImages.care} />
          <div className="home-about-copy">
            <p>{t("aboutCopy")}</p>
            <div className="home-about-facts">
              <span>{t("onlineBooking")}</span>
              <span>{t("structuredPriceList")}</span>
              <span>{t("crmReadyWorkflow")}</span>
            </div>
            <blockquote className="home-about-quote">
              {t("aboutQuote")}
            </blockquote>
          </div>
        </div>
      </section>

      <section className="home-atmosphere">
        <div className="home-atmosphere-copy">
          <p className="eyebrow">{t("salonRhythm")}</p>
          <h2>{t("atmosphereTitle")}</h2>
          <p>{t("atmosphereText")}</p>
          <button className="secondary-button" onClick={onOpenBooking} type="button">
            {t("startBooking")}
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
          <p className="eyebrow">{t("portfolio")}</p>
          <h2>{t("selectedWork")}</h2>
          <p>{t("portfolioText")}</p>
        </div>
        <div className="home-portfolio-grid">
          {pagedPortfolio.map((item) => (
            <figure key={item.title}>
              <img alt={item.title} src={item.image} onError={(event) => { event.currentTarget.src = homeImages.care; }} />
              <figcaption>{item.title}{item.caption && item.caption !== item.title ? ` · ${item.caption}` : ""}</figcaption>
            </figure>
          ))}
        </div>
        {portfolioPageCount > 1 ? (
          <div className="home-portfolio-pagination" aria-label={language === "uk" ? "Пагінація портфоліо" : "Portfolio pagination"}>
            <button
              aria-label={language === "uk" ? "Попередні роботи" : "Previous portfolio items"}
              disabled={safePortfolioPage === 0}
              onClick={() => setPortfolioPage((page) => Math.max(0, page - 1))}
              type="button"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              {Array.from({ length: portfolioPageCount }, (_, index) => (
                <button
                  aria-label={`${language === "uk" ? "Сторінка" : "Page"} ${index + 1}`}
                  className={index === safePortfolioPage ? "active" : ""}
                  key={index}
                  onClick={() => setPortfolioPage(index)}
                  type="button"
                />
              ))}
            </div>
            <button
              aria-label={language === "uk" ? "Наступні роботи" : "Next portfolio items"}
              disabled={safePortfolioPage >= portfolioPageCount - 1}
              onClick={() => setPortfolioPage((page) => Math.min(portfolioPageCount - 1, page + 1))}
              type="button"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        ) : null}
      </section>

      <section className="home-price-section" id="price-list">
        <div className="home-price-watermark" aria-hidden="true">
          {t("priceList")}
        </div>
        <header className="home-price-heading">
          <p className="eyebrow">{t("services")}</p>
          <h2>{t("priceList").toUpperCase()}</h2>
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
          <img className="home-price-logo signature-logo" src={logoMain} alt="SL Color Studio" />
        </div>
        <button className="primary-button home-centered-action" onClick={onOpenBooking} type="button">
          {t("bookAppointment")}
        </button>
      </section>
      <SalonFooter language={language} onOpenBooking={onOpenBooking} onOpenShop={onOpenShop} onToggleLanguage={onToggleLanguage} />
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

function SalonFooter({
  language,
  onOpenBooking,
  onOpenShop,
  onToggleLanguage
}: {
  language: PublicLanguage;
  onOpenBooking: () => void;
  onOpenShop: () => void;
  onToggleLanguage?: () => void;
}) {
  const t = (key: keyof typeof publicText.en) => publicLabel(language, key);
  const salonAddress = language === "uk" ? salonAddressUk : salonAddressEn;
  const gallery = [
    { src: homeImages.color, alt: language === "uk" ? "Робота з кольором у SL Color Studio" : "Color work at SL Color Studio" },
    { src: homeImages.care, alt: language === "uk" ? "Консультація з догляду у салоні" : "Salon care consultation" },
    { src: homeImages.manicure, alt: language === "uk" ? "Догляд за нігтями у салоні" : "Nail care at the salon" },
    { src: homeImages.products, alt: language === "uk" ? "Професійна косметика салону" : "Professional salon cosmetics" }
  ];

  return (
    <footer className="salon-footer" id="salon-footer">
      <div className="salon-footer-hero">
        <a className="salon-footer-map" href={salonMapHref} rel="noreferrer" target="_blank" aria-label={language === "uk" ? "Відкрити адресу салону на мапі" : "Open salon address on map"}>
          <span className="salon-footer-map-cta">
            {language === "uk" ? "Відкрити на мапі" : "Open on map"} <ExternalLink size={13} />
          </span>
          <span className="salon-map-line salon-map-line-one" />
          <span className="salon-map-line salon-map-line-two" />
          <span className="salon-map-line salon-map-line-three" />
          <span className="salon-map-marker">
            <MapPin size={28} />
          </span>
        </a>

        <div className="salon-footer-contact">
          <div className="salon-footer-block-title"><span>{t("address")}</span></div>
          <p className="salon-footer-contact-line">
            <MapPin size={18} />
            <span><strong>SL Color Studio:</strong> {salonAddress}</span>
          </p>
          <div className="salon-footer-block-title"><span>{t("contact")}</span></div>
          <a className="salon-footer-contact-line" href={salonPhoneHref}>
            <Phone size={18} />
            <span>{salonPhoneDisplay}</span>
          </a>
          <a className="salon-footer-contact-line" href={`mailto:${salonEmail}`}>
            <Mail size={18} />
            <span>{salonEmail}</span>
          </a>
          <p className="salon-footer-contact-line">
            <Clock size={18} />
            <span>{salonHours}</span>
          </p>
          <a className="salon-footer-contact-line" href={salonInstagramHref} rel="noreferrer" target="_blank">
            <Instagram size={18} />
            <span>Instagram SL Color Studio</span>
          </a>
          <a className="salon-footer-contact-line" href={salonTelegramHref} rel="noreferrer" target="_blank">
            <Send size={18} />
            <span>@svitlanakoloryst</span>
          </a>
        </div>

        <div className="salon-footer-gallery">
          <div className="salon-footer-block-title"><span>{t("portfolio")}</span></div>
          <div className="salon-footer-gallery-grid">
            {gallery.map((image) => (
              <img alt={image.alt} key={image.src} loading="lazy" src={image.src} />
            ))}
          </div>
        </div>
      </div>

      <div className="salon-footer-links">
        <div>
          <h2>{language === "uk" ? "Навігація" : "Navigation"}</h2>
          <a href="#about">{t("about")}</a>
          <a href="#portfolio">{t("portfolio")}</a>
          <a href="#price-list">{t("priceList")}</a>
          <a href="#salon-footer">{t("contact")}</a>
        </div>
        <div>
          <h2>{language === "uk" ? "Дії" : "Actions"}</h2>
          <button onClick={onOpenBooking} type="button">{t("bookAppointment")}</button>
          <button onClick={onOpenShop} type="button">{t("professionalCosmetics")}</button>
          {onToggleLanguage ? (
            <button onClick={onToggleLanguage} type="button">
              {language === "en" ? t("switchToUk") : t("switchToEn")}
            </button>
          ) : null}
        </div>
        <div>
          <h2>{language === "uk" ? "Інформація" : "Information"}</h2>
          <a href={salonPhoneHref}>{language === "uk" ? "Консультація перед записом" : "Consultation before booking"}</a>
          <a href={salonMapHref} rel="noreferrer" target="_blank">{language === "uk" ? "Як нас знайти" : "How to find us"}</a>
          <a href={salonInstagramHref} rel="noreferrer" target="_blank">Instagram</a>
        </div>
      </div>

      <div className="salon-footer-brand">
        <button className="salon-footer-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
          <img src={logoFull} alt="SL Color Studio" />
        </button>
        <p>{language === "uk" ? "Салонний догляд, точний колір і зручний онлайн-запис." : "Salon care, precise color and convenient online booking."}</p>
        <small>© {new Date().getFullYear()} SL Color Studio. {language === "uk" ? "Усі права захищено." : "All rights reserved."}</small>
      </div>
    </footer>
  );
}

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
  language = "en",
  onOpenAdmin,
  onOpenBooking,
  onOpenHome,
  onToggleLanguage
}: {
  language?: PublicLanguage;
  onOpenAdmin?: () => void;
  onOpenBooking: () => void;
  onOpenHome: () => void;
  onToggleLanguage?: () => void;
}) {
  const t = (key: keyof typeof publicText.en) => publicLabel(language, key);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        <button
          aria-expanded={isMenuOpen}
          aria-label={language === "uk" ? "Відкрити меню" : "Open menu"}
          className="home-menu-button"
          onClick={() => setIsMenuOpen((value) => !value)}
          type="button"
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button className="home-brand-button" onClick={onOpenHome} type="button">
          <img className="home-nav-logo" src={logoFull} alt="SL Color Studio" />
        </button>
        <nav className={isMenuOpen ? "is-open" : ""} aria-label="Shop navigation">
          <button onClick={() => { setIsMenuOpen(false); onOpenHome(); }} type="button">{t("salon")}</button>
          <a href="#shop-catalog" onClick={() => setIsMenuOpen(false)}>{t("catalog")}</a>
          <a href="#shop-contact" onClick={() => setIsMenuOpen(false)}>{t("contact")}</a>
          <button className="mobile-nav-action" onClick={() => { setIsMenuOpen(false); onOpenBooking(); }} type="button">{t("bookAppointment")}</button>
        </nav>
        <div className="home-nav-actions">
          <div className="home-social-links" aria-label={language === "uk" ? "Соціальні мережі" : "Social links"}>
            {salonSocialLinks.map((link) => (
              <a
                aria-label={link.label}
                className="home-social-link"
                href={link.href}
                key={link.label}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                target={link.href.startsWith("http") ? "_blank" : undefined}
              >
                {link.icon}
              </a>
            ))}
          </div>
          {onOpenAdmin ? (
            <button className="secondary-button" onClick={onOpenAdmin} type="button">
              CRM
            </button>
          ) : null}
          <button className="primary-button" onClick={onOpenBooking} type="button">
            {t("bookAppointment")}
          </button>
        </div>
      </header>

      <section className="shop-hero">
        <img alt="Professional hair care cosmetics bottles" src={homeImages.products} />
        <div className="shop-hero-overlay" />
        <div className="shop-hero-content">
          <p className="eyebrow">{t("shopHeroEyebrow")}</p>
          <h1>{t("shopHeroTitle")}</h1>
          <p>{t("shopHeroText")}</p>
          <div className="home-hero-actions">
            <a href="#shop-catalog">{t("viewCatalog")}</a>
            <button className="primary-button" onClick={onOpenBooking} type="button">
              {t("askSpecialist")}
            </button>
          </div>
        </div>
      </section>

      <section className="shop-catalog" id="shop-catalog">
        <div className="shop-watermark" aria-hidden="true">
          {t("professionalCosmetics")}
        </div>
        <header className="home-price-heading shop-heading">
          <p className="eyebrow">{t("productCatalog")}</p>
          <h2>{t("homeCare")}</h2>
          <span>{visibleProducts.length} {t("products")}</span>
        </header>

        {status === "loading" ? <div className="empty-state">{t("loadingCosmetics")}</div> : null}
        {status === "error" ? <div className="admin-alert">{t("productsError")}</div> : null}

        <div className="shop-category-list">
          {categories.map((category) => (
            <article className="shop-category-card" key={category.id}>
              <div className="shop-category-media">
                <img alt="" src={category.imageUrl ?? homeImages.products} />
                <span>{t("professionalCare")}</span>
              </div>
              <div className="shop-category-body">
                <div className="shop-category-heading">
                  <div>
                    <h3>{category.name}</h3>
                    {category.description ? <p>{category.description}</p> : null}
                  </div>
                  <span>{category.products.length} {t("items")}</span>
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
                        <small>{product.description || product.brand || t("salonCare")}</small>
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
                  {t("requestRecommendation")} <ArrowRight aria-hidden="true" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-contact" id="shop-contact">
        <div className="home-section-heading">
          <p className="eyebrow">{t("contact")}</p>
          <h2>{t("shopContactTitle")}</h2>
          <p>{t("shopContactText")}</p>
        </div>
        <div className="home-contact-grid">
          <div>
            <Phone aria-hidden="true" size={20} />
            <strong>+38 (050) 23 03 408</strong>
            <span>{t("phone")}</span>
          </div>
          <div>
            <MapPin aria-hidden="true" size={20} />
            <strong>{language === "uk" ? "Броди, вул. Стуса, 2" : "Brody, Stusa St. 2"}</strong>
            <span>{t("pickUpInSalon")}</span>
          </div>
        </div>
      </section>
      <SalonFooter language={language} onOpenBooking={onOpenBooking} onOpenShop={() => window.scrollTo({ top: 0, behavior: "smooth" })} onToggleLanguage={onToggleLanguage} />
      {selectedProduct ? <ProductDetailDialog language={language} onClose={() => setSelectedProduct(null)} onRequest={onOpenBooking} product={selectedProduct} /> : null}
    </main>
  );
}

function ProductDetailDialog({
  language = "en",
  onClose,
  onRequest,
  product
}: {
  language?: PublicLanguage;
  onClose: () => void;
  onRequest: () => void;
  product: PublicProduct;
}) {
  const t = (key: keyof typeof publicText.en) => publicLabel(language, key);

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section aria-modal="true" className="admin-modal product-detail-modal" role="dialog">
        <div className="panel-header">
          <div>
            <p className="admin-kicker">{product.brand || t("professionalCosmetics")}</p>
            <h2>{product.name}</h2>
          </div>
          <button aria-label={language === "uk" ? "Закрити деталі товару" : "Close product details"} className="icon-only-button" onClick={onClose} title={language === "uk" ? "Закрити" : "Close"} type="button">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="product-detail-layout">
          <div className="product-detail-image">
            {product.imageUrl ? <img alt={product.name} src={product.imageUrl} /> : <span>{product.brand?.slice(0, 2) || "SL"}</span>}
          </div>
          <div className="product-detail-copy">
            <p>{product.description || (language === "uk" ? "Професійний салонний догляд, підібраний для домашньої рутини." : "Professional salon care selected for home routine support.")}</p>
            <div className="product-detail-meta">
              <span>{product.category?.name ?? "Home care"}</span>
              <span>{formatProductVolume(product)}</span>
              <strong>{formatHryvnia(product.price)}</strong>
            </div>
            {product.quote ? <blockquote>{product.quote}</blockquote> : <blockquote>{language === "uk" ? "Професійний догляд має бути точним, спокійним і легким для дому." : "Professional care should feel precise, calm and easy to keep at home."}</blockquote>}
          </div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button compact-button" onClick={onClose} type="button">
            {language === "uk" ? "Закрити" : "Close"}
          </button>
          <button className="primary-button compact-button" onClick={onRequest} type="button">
            {t("askSpecialist")}
          </button>
        </div>
      </section>
    </div>
  );
}

function LoginView({
  isCheckingAuth,
  language = "uk",
  onOpenBooking,
  onSuccess
}: {
  isCheckingAuth: boolean;
  language?: CrmLanguage;
  onOpenBooking?: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const t = (key: CrmTextKey) => crmLabel(language, key);
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
      setError(loginError instanceof Error ? loginError.message : t("couldNotSignIn"));
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
        <h1>{t("crmSignIn")}</h1>
        {isCheckingAuth ? <div className="admin-panel">{t("checkingSession")}</div> : null}
        {error ? <div className="admin-alert">{error}</div> : null}
        <form className="admin-form" onSubmit={submit}>
          <label>
            <span>{t("email")}</span>
            <input autoComplete="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            <span>{t("password")}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>
          <button className="primary-button admin-submit" disabled={isSubmitting || isCheckingAuth} type="submit">
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>
        </form>
        {onOpenBooking ? (
          <button className="booking-link light" onClick={onOpenBooking} type="button">
            {t("goToOnlineBooking")}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function AdminPanel({
  language,
  onLanguageChange,
  onLogout,
  onOpenBooking,
  user
}: {
  language: CrmLanguage;
  onLanguageChange: (language: CrmLanguage) => void;
  onLogout: () => void;
  onOpenBooking?: () => void;
  user: AuthUser;
}) {
  const t = (key: CrmTextKey) => crmLabel(language, key);
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const visibleNav = getVisibleAdminNav(user);
  const activeNavItem = visibleNav.find((item) => item.id === activeSection) ?? visibleNav[0];

  async function loadAdminData() {
    setIsLoadingAdmin(true);
    try {
      const data = await fetchAdminData();
      setAdminData(data);
      setAdminError("");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : t("unknownAdminApiError"));
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
      setActionMessage(t("changesSaved"));
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : t("couldNotCompleteActionShort"));
    }
  }

  return (
    <CrmLanguageContext.Provider value={language}>
      <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo">SL</div>
          <div>
            <strong>Color Studio</strong>
            <span>{user.role === "ADMIN" ? t("mainAdmin") : t("crmEmployee")}</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label={t("adminNavigation")}>
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
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {onOpenBooking ? (
          <button className="booking-link" onClick={onOpenBooking} type="button">
            {t("openOnlineBooking")}
          </button>
        ) : null}
        <button className="booking-link" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={16} />
          {t("signOut")}
        </button>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">{t("adminMvp")}</p>
            <h1>{activeNavItem ? t(activeNavItem.labelKey) : t("dashboard")}</h1>
            <span className="admin-userline">{user.name}</span>
          </div>
          <div className="admin-search">
            <Search aria-hidden="true" size={17} />
            <input placeholder={t("searchCrm")} />
          </div>
        </header>

        {adminError ? <div className="admin-alert">{t("couldNotCompleteAction")} {adminError}</div> : null}
        {actionMessage ? <div className="admin-success">{actionMessage}</div> : null}
        {isLoadingAdmin || !adminData ? (
          <div className="admin-panel">{t("loadingCrmData")}</div>
        ) : (
          <AdminContent language={language} onLanguageChange={onLanguageChange} section={activeSection} data={adminData} runAction={runAdminAction} user={user} />
        )}
      </section>
    </main>
    </CrmLanguageContext.Provider>
  );
}

function AdminContent({
  language,
  onLanguageChange,
  section,
  data,
  runAction,
  user
}: {
  language: CrmLanguage;
  onLanguageChange: (language: CrmLanguage) => void;
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

  return <SettingsSection language={language} onLanguageChange={onLanguageChange} settings={data.settings} runAction={runAction} />;
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
  const t = useCrmT();
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [schedulingEmployeeId, setSchedulingEmployeeId] = useState<string | null>(null);
  const editingEmployee = employees.find((employee) => employee.id === editingEmployeeId) ?? null;
  const schedulingEmployee = employees.find((employee) => employee.id === schedulingEmployeeId) ?? null;

  return (
    <div className="admin-grid">
      <Panel action={canManage ? t("addEmployee") : undefined} onAction={() => setIsCreatingEmployee(true)} title={t("employees")} wide>
        <DataTable
          columns={[t("employee"), t("contact"), t("description"), t("specialization"), t("services"), t("workingHours"), t("timeOff"), t("status"), t("actions")]}
          rows={
            employees.length > 0
              ? employees.map((item) => [
                  item.name,
                  <>
                    {item.email ?? t("noEmail")}
                    <br />
                    {item.phone}
                  </>,
                  item.description || "-",
                  item.specialization || "-",
                  item.services.length > 0 ? item.services.map((service) => service.name).join(", ") : t("notAssigned"),
                  item.hours,
                  item.timeOff,
                  item.active ? t("active") : t("disabled"),
                  canManage || item.id === currentEmployeeId ? (
                    <InlineActions
                      labels={[...(canManage ? [item.active ? t("disable") : t("enable"), t("edit")] : []), t("schedule")]}
                      onAction={(label) => {
                        if (label === t("edit")) {
                          setEditingEmployeeId(item.id);
                          return;
                        }

                        if (label === t("schedule")) {
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
              : [[t("noEmployeesYet"), "-", "-", "-", "-", "-", "-", "-", "-"]]
          }
        />
      </Panel>
      {isCreatingEmployee ? (
        <AdminModal title={t("newEmployee")} onClose={() => setIsCreatingEmployee(false)}>
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
        <AdminModal title={`${t("editEmployee")}: ${editingEmployee.name}`} onClose={() => setEditingEmployeeId(null)}>
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
        <AdminModal title={`${t("employeeSchedule")}: ${schedulingEmployee.name}`} onClose={() => setSchedulingEmployeeId(null)}>
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
  const t = useCrmT();
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
          <span>{t("firstName")}</span>
          <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
        </label>
        <label>
          <span>{t("lastName")}</span>
          <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
        </label>
      </div>
      <div className="form-section">
        <label>
          <span>{t("phone")}</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
        </label>
        <label>
          <span>{t("email")}</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
      </div>
      <div className="form-section">
        <label>
          <span>{t("password")}</span>
          <input
            minLength={8}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder={isEditing ? t("leavePasswordEmpty") : ""}
            required={!isEditing}
            type="password"
            value={form.password}
          />
        </label>
        <label>
          <span>{t("specialization")}</span>
          <input value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} />
        </label>
      </div>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>{t("employeeIsActive")}</span>
      </label>
      <div className="appointment-service-picker">
        <span>{t("assignedServices")}</span>
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
                    <span>{selectedCount > 0 ? `${selectedCount}/${group.services.length} ${t("selected")}` : `${group.services.length} ${t("services")}`}</span>
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
            <div className="empty-state">{t("noServicesAvailable")}</div>
          )}
        </div>
      </div>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" type="submit">
          {isEditing ? t("saveEmployee") : t("createEmployee")}
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
  const t = useCrmT();

  return (
    <div className="admin-grid">
      <Panel title={t("reviews")}>
        <DataTable columns={[t("client"), t("rating"), t("comment")]} rows={reviews.map((item) => [item.client, `${item.rating}/5`, item.text])} />
      </Panel>
    </div>
  );
}

function SettingsSection({
  language,
  onLanguageChange,
  settings,
  runAction
}: {
  language: CrmLanguage;
  onLanguageChange: (language: CrmLanguage) => void;
  settings: AdminData["settings"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = (key: CrmTextKey) => crmLabel(language, key);

  return (
    <div className="admin-grid">
      <Panel title={t("interfaceLanguage")}>
        <label className="admin-language-picker">
          <span>{t("language")}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as CrmLanguage)}>
            <option value="uk">{t("ukrainian")}</option>
            <option value="en">{t("english")}</option>
          </select>
        </label>
        <p className="admin-help-text">{t("languageHelp")}</p>
        <p className="admin-help-text">{t("ukrainianDefaultNote")}</p>
      </Panel>
      <SettingsForm language={language} settings={settings} onSubmit={(payload) => runAction(() => updateAdminSettings(payload))} />
      <Panel title={t("currentData")}>
        <InfoList
          items={[
            [t("name"), settings.salonName],
            [t("phone"), settings.phone],
            [t("email"), settings.email],
            [t("address"), settings.address],
            [t("hours"), settings.hours]
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

function SettingsForm({
  language,
  settings,
  onSubmit
}: {
  language: CrmLanguage;
  settings: AdminData["settings"];
  onSubmit: (payload: SettingsInput) => Promise<void>;
}) {
  const t = (key: CrmTextKey) => crmLabel(language, key);
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
    <Panel title={t("salonSettings")}>
      <form className="admin-form" onSubmit={submit}>
        <label>
          <span>{t("salonName")}</span>
          <input value={form.salonName} onChange={(event) => setForm({ ...form, salonName: event.target.value })} required />
        </label>
        <label>
          <span>{t("phone")}</span>
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        <label>
          <span>{t("email")}</span>
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          <span>{t("address")}</span>
          <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </label>
        <label>
          <span>{t("logo")}</span>
          <input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} />
        </label>
        <label>
          <span>{t("opening")}</span>
          <input value={form.openingTime} onChange={(event) => setForm({ ...form, openingTime: event.target.value })} />
        </label>
        <label>
          <span>{t("closing")}</span>
          <input value={form.closingTime} onChange={(event) => setForm({ ...form, closingTime: event.target.value })} />
        </label>
        <button className="primary-button admin-submit" type="submit">
          {t("saveSettings")}
        </button>
      </form>
    </Panel>
  );
}

type BookingStep = "services" | "employee" | "datetime" | "contact";

const bookingSteps: Array<{ id: BookingStep; key: keyof typeof publicText.en }> = [
  { id: "services", key: "services" },
  { id: "employee", key: "employee" },
  { id: "datetime", key: "dateAndTime" },
  { id: "contact", key: "contact" }
];

function BookingView({ language = "en", onOpenAdmin, onOpenHome }: { language?: PublicLanguage; onOpenAdmin?: () => void; onOpenHome: () => void }) {
  const t = (key: keyof typeof publicText.en) => publicLabel(language, key);
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
        setError(getBookingErrorMessage(loadError, t("loadServicesError")));
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
      .catch((loadError) => setError(getBookingErrorMessage(loadError, t("loadEmployeesError"))))
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
          setError(getBookingErrorMessage(loadError, t("loadTimesError")));
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
      const groupName = service.category?.name ?? t("otherServices");
      const groupDescription = service.category?.description ?? null;
      const existing = groups.get(groupId);

      if (existing) {
        existing.services.push(service);
      } else {
        groups.set(groupId, { id: groupId, name: groupName, description: groupDescription, services: [service] });
      }
    }

    return [...groups.values()];
  }, [language, services]);

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
      setError(t("chooseServiceError"));
      return;
    }

    if (isLoadingEmployees) {
      setError(t("loadingEmployeesError"));
      return;
    }

    if (employees.length === 0) {
      setError(t("noEmployeesError"));
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
      setError(t("chooseEmployeeError"));
      setActiveStep("employee");
      return;
    }

    if (!selectedSlot) {
      setError(t("chooseTimeError"));
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
      setError(t("chooseServiceError"));
      return;
    }

    if (!selectedEmployeeId) {
      setError(t("chooseEmployeeError"));
      return;
    }

    if (!selectedSlot) {
      setError(t("chooseTimeError"));
      return;
    }

    const nextContactErrors = getBookingContactErrors(client, clientComment, language);

    if (Object.keys(nextContactErrors).length > 0) {
      setContactErrors(nextContactErrors);
      setError(`${t("correctContactDetails")} ${Object.values(nextContactErrors).join(" ")}`);
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
      setError(getBookingErrorMessage(saveError, t("createAppointmentError")));
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
          <h1>{t("appointmentConfirmed")}</h1>
          <p>
            {client.firstName}, {t("appointmentReserved")} {selectedSlot?.label} {t("onDate")} {formatSuggestedDate(selectedDate)}.
          </p>
          <div className="success-highlight">
            <span>{t("bookingReference")}</span>
            <strong>{confirmation ? `#${confirmation.id}` : t("confirmed")}</strong>
          </div>
          <dl className="confirmation-list">
            <div>
              <dt>{t("services")}</dt>
              <dd>{selectedServices.map((service) => service.name).join(", ")}</dd>
            </div>
            <div>
              <dt>{t("employee")}</dt>
              <dd>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : t("selectedEmployee")}</dd>
            </div>
            <div>
              <dt>{t("dateAndTime")}</dt>
              <dd>
                {selectedDate}, {selectedSlot?.label}
              </dd>
            </div>
            <div>
              <dt>{t("total")}</dt>
              <dd>
                {formatSelectedServicesPrice(selectedServices, total.price)} · {total.duration} min
              </dd>
            </div>
          </dl>
          <div className="success-next-steps">
            <strong>{t("nextStep")}</strong>
            <span>{t("successNote")}</span>
          </div>
          <div className="success-actions">
            <button className="primary-button" type="button" onClick={resetBooking}>
              {t("bookAnother")}
            </button>
            <button className="secondary-button" type="button" onClick={onOpenHome}>
              {t("backToWebsite")}
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
          {t("website")}
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
              <h1>{t("bookYourAppointment")}</h1>
              <p>{t("bookingIntro")}</p>
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
                {t(step.key)}
              </span>
            ))}
          </nav>
        </header>

        {error ? <div className="alert wizard-alert">{error}</div> : null}

        {activeStep === "services" ? (
          <section className="wizard-panel">
            <div className="wizard-panel-heading">
              <p className="eyebrow">{t("step1")}</p>
              <h2>{t("selectServices")}</h2>
              <p>{t("selectServicesText")}</p>
            </div>

            {status === "loading" ? <BookingEmptyState title={t("loadingServices")} detail={t("loadingServicesText")} /> : null}

            {status !== "loading" && services.length === 0 ? (
              <BookingEmptyState
                title={t("noServices")}
                detail={t("noServicesText")}
                action={
                  <button className="secondary-button compact-button" onClick={() => void loadServices()} type="button">
                    {t("refreshServices")}
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
                              <small>{copy?.description ?? service.description ?? t("individualConsultation")}</small>
                            </span>
                            <span className="service-choice-meta">
                              <strong>{formatServicePrice(service, language)}</strong>
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
                <span>{selectedServices.length > 0 ? `${selectedServices.length} ${t("selected")}` : t("noServicesSelected")}</span>
                <strong>{selectedServices.length > 0 ? formatSelectedServicesPrice(selectedServices, total.price) : t("chooseServices")}</strong>
                <small>{total.duration > 0 ? `${total.duration} ${t("minTotal")}` : t("startWithServices")}</small>
              </div>
              <button
                className="primary-button icon-button"
                disabled={selectedServiceIds.length === 0 || isLoadingEmployees}
                onClick={continueFromServices}
                type="button"
              >
                <span>{isLoadingEmployees ? t("loading") : t("continue")}</span>
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </footer>
          </section>
        ) : null}

        {activeStep === "employee" ? (
          <section className="wizard-panel compact-panel">
            <div className="wizard-panel-heading">
              <p className="eyebrow">{t("step2")}</p>
              <h2>{t("chooseEmployee")}</h2>
              <p>{t("chooseEmployeeText")}</p>
            </div>

            {isLoadingEmployees ? <BookingEmptyState title={t("findingSpecialists")} detail={t("findingSpecialistsText")} /> : null}

            {!isLoadingEmployees && employees.length === 0 ? (
              <BookingEmptyState
                title={t("noSpecialist")}
                detail={t("noSpecialistText")}
                action={
                  <button className="secondary-button compact-button" onClick={() => goToStep("services")} type="button">
                    {t("changeServices")}
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
                      <small>{employee.specialization ?? t("beautySpecialist")}</small>
                    </span>
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                ))}
              </div>
            ) : null}

            <footer className="wizard-actions">
              <button className="secondary-button icon-button" onClick={() => goToStep("services")} type="button">
                <ArrowLeft aria-hidden="true" size={18} />
                <span>{t("back")}</span>
              </button>
            </footer>
          </section>
        ) : null}

        {activeStep === "datetime" ? (
          <section className="wizard-panel compact-panel">
            <div className="wizard-panel-heading">
              <p className="eyebrow">{t("step3")}</p>
              <h2>{t("chooseDateTime")}</h2>
              <p>
                {selectedEmployee
                  ? `${selectedEmployee.firstName} ${selectedEmployee.lastName} ${t("selectedForVisit")}`
                  : t("chooseVisitTime")}
              </p>
            </div>

            <div className="appointment-layout">
              <aside className="appointment-summary">
                <span>{t("visitSummary")}</span>
                <strong>{selectedServices.map((service) => service.name).join(", ")}</strong>
                <small>
                  {formatSelectedServicesPrice(selectedServices, total.price)} · {total.duration} min
                </small>
                <small>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : t("employeeNotSelected")}</small>
              </aside>

              <div className="datetime-panel">
                <label>
                  <span className="field-label">
                    <CalendarDays aria-hidden="true" size={16} />
                    {t("date")}
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
                  {t("availableTime")}
                </div>
                <div className="slot-grid roomy">
                  {isLoadingSlots ? <BookingEmptyState title={t("checkingTimes")} detail={t("checkingTimesText")} /> : null}
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
                    <BookingEmptyState title={t("noSlots")} detail={t("noSlotsText")} />
                  ) : null}
                </div>

                {shouldShowAvailabilitySuggestions ? (
                  <div className="nearest-suggestions-grid">
                    <div className="nearest-slots">
                      <div className="field-label">
                        <CalendarDays aria-hidden="true" size={16} />
                        {t("nearestDays")}
                      </div>
                      <div className="nearest-day-list">
                        {isLoadingNearestSlots ? <p className="empty-state">{t("lookingDays")}</p> : null}
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
                                  {language === "uk" ? `${suggestion.slotCount} ${suggestion.slotCount === 1 ? t("timeSingular") : t("timePlural")}` : formatSlotCount(suggestion.slotCount)} · {t("from")} {suggestion.firstSlot.label}
                                </span>
                              </button>
                            ))
                          : null}
                        {!isLoadingNearestSlots && nearestDays.length === 0 ? <p className="empty-state">{t("noDaysFound")}</p> : null}
                      </div>
                    </div>

                    <div className="nearest-slots">
                      <div className="field-label">
                        <CalendarDays aria-hidden="true" size={16} />
                        {t("nearestTerms")}
                      </div>
                      <div className="nearest-slot-list">
                        {isLoadingNearestSlots ? <p className="empty-state">{t("lookingTerms")}</p> : null}
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
                        {!isLoadingNearestSlots && nearestSlots.length === 0 ? <p className="empty-state">{t("noTermsFound")}</p> : null}
                      </div>
                    </div>
                  </div>
                ) : null}

              </div>
            </div>

            <footer className="wizard-actions">
              <button className="secondary-button icon-button" onClick={() => goToStep(employees.length > 1 ? "employee" : "services")} type="button">
                <ArrowLeft aria-hidden="true" size={18} />
                <span>{t("back")}</span>
              </button>
              <button className="primary-button icon-button" disabled={!selectedSlot} onClick={continueFromDateTime} type="button">
                <span>{t("continue")}</span>
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </footer>
          </section>
        ) : null}

        {activeStep === "contact" ? (
          <section className="wizard-panel contact-step">
            <div className="contact-card">
              <div className="wizard-panel-heading">
                <p className="eyebrow">{t("finalStep")}</p>
                <h2>{t("contactDetails")}</h2>
                <p>{t("contactDetailsText")}</p>
              </div>

              <form onSubmit={handleSubmit} className="booking-form" noValidate>
                <section className="form-section client-grid">
                  <label>
                    <span>{t("firstName")}</span>
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
                    <span>{t("lastName")}</span>
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
                    <span>{t("phone")}</span>
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
                    <span>{t("email")}</span>
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
                  <span>{t("comment")}</span>
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
                    <span>{t("appointment")}</span>
                    <strong>
                      {selectedDate}, {selectedSlot?.label}
                    </strong>
                  </div>
                  <div>
                    <span>{t("total")}</span>
                    <strong>
                      {formatSelectedServicesPrice(selectedServices, total.price)} · {total.duration} min
                    </strong>
                  </div>
                </section>

                <footer className="wizard-actions">
                  <button className="secondary-button icon-button" onClick={() => goToStep("datetime")} type="button">
                    <ArrowLeft aria-hidden="true" size={18} />
                    <span>{t("back")}</span>
                  </button>
                  <button className="primary-button icon-button" type="submit" disabled={!canSubmit}>
                    <span>{status === "saving" ? t("booking") : t("confirmAppointment")}</span>
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
