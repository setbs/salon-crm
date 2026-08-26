export type Service = {
  id: string;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
  } | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  priceFrom: number | null;
  priceTo: number | null;
};

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
  description: string | null;
  services: Array<{ id: string; name: string }>;
};

export type PortfolioPhoto = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  employee: string;
};

export type PublicProduct = {
  id: string;
  category: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
  } | null;
  name: string;
  brand: string | null;
  description: string | null;
  quote: string | null;
  imageUrl: string | null;
  purpose: ProductPurpose;
  price: number;
  contentAmount: number | null;
  contentUnit: MeasurementUnit | null;
  stockQuantity: number;
  components: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  inStock: boolean;
};

export type Slot = {
  startTime: string;
  endTime: string;
  label: string;
};

export type AppointmentPayload = {
  employeeId: string;
  serviceIds: string[];
  startTime: string;
  client: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
  clientComment?: string;
};

export type AdminDashboard = {
  todayAppointments: number;
  dailyRevenue: number;
  nextAppointment: AdminAppointment | null;
  lowStockProducts: number;
};

export type AppointmentConsumablePreviewItem = {
  productId: string;
  productName: string;
  productCategory: string | null;
  services: string;
  quantity: number;
  unit: MeasurementUnit;
  contentAmount: number | null;
  unitCost: number | null;
  cost: number | null;
  stockContentAmount: number | null;
  stockAfter: number | null;
  packageEquivalentBefore: number | null;
  packageEquivalentAfter: number | null;
  enough: boolean;
  issue: string | null;
};

export type AppointmentConsumablePreview = {
  appointment: {
    id: string;
    client: string;
    service: string;
    master: string;
    time: string;
  };
  financials: {
    revenueFrom: number;
    revenueTo: number;
    paymentAmount: number;
    paymentMethod: "cash" | "card" | "blik" | "transfer";
    consumableCost: number | null;
    profitAfterConsumablesFrom: number | null;
    profitAfterConsumablesTo: number | null;
  };
  status: string;
  alreadyWrittenOff: boolean;
  canComplete: boolean;
  warnings: string[];
  items: AppointmentConsumablePreviewItem[];
};

export type AdminConsumableAnalytics = {
  periodLabel: string;
  logsCount: number;
  totalMl: number;
  totalGram: number;
  lowConsumableProducts: number;
  products: Array<{
    productId: string;
    productName: string;
    productCategory: string | null;
    usedQuantity: number;
    unit: MeasurementUnit;
    appointmentCount: number;
    serviceCount: number;
    stockContentAmount: number | null;
    stockPackageEquivalent: number | null;
  }>;
  recentLogs: Array<{
    id: string;
    createdAt: string;
    productName: string;
    serviceName: string;
    clientName: string;
    quantity: number;
    unit: MeasurementUnit;
  }>;
};

export type AdminBusinessAnalytics = {
  periodLabel: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    appointmentCount: number;
    revenueFrom: number;
    revenueTo: number;
    consumableCost: number | null;
    profitFrom: number | null;
    profitTo: number | null;
  }>;
  productSalesByBrand: Array<{
    name: string;
    quantity: number;
    revenue: number;
    profit: number | null;
  }>;
  productSalesByCategory: Array<{
    name: string;
    quantity: number;
    revenue: number;
    profit: number | null;
  }>;
  restock: Array<{
    productId: string;
    productName: string;
    categoryName: string | null;
    brandName: string | null;
    stockQuantity: number;
    minStockQuantity: number;
    contentAmount: number | null;
    contentUnit: MeasurementUnit | null;
    stockContentAmount: number | null;
    stockPackageEquivalent: number | null;
    packagesToBuy: number;
  }>;
  materialUsageByService: Array<{
    serviceId: string;
    serviceName: string;
    appointmentCount: number;
    usedMl: number;
    usedGram: number;
    consumableCost: number | null;
    revenueFrom: number;
    revenueTo: number;
    profitFrom: number | null;
    profitTo: number | null;
  }>;
  procedureProductUsage: Array<{
    productId: string;
    productName: string;
    categoryName: string | null;
    brandName: string | null;
    usedQuantity: number;
    unit: MeasurementUnit;
    appointmentCount: number;
    serviceCount: number;
    consumableCost: number | null;
    averagePerAppointment: number | null;
    stockContentAmount: number | null;
    stockPackageEquivalent: number | null;
    estimatedProceduresLeft: number | null;
  }>;
  dailyTrend: Array<{
    date: string;
    revenueFrom: number;
    revenueTo: number;
    profitFrom: number | null;
    profitTo: number | null;
  }>;
  comparison: {
    previousPeriodLabel: string;
    completedVisits: AnalyticsComparisonMetric;
    serviceRevenue: AnalyticsComparisonMetric;
    serviceProfit: AnalyticsNullableComparisonMetric;
    productRevenue: AnalyticsComparisonMetric;
    productProfit: AnalyticsNullableComparisonMetric;
  };
  attentionItems: Array<{
    severity: "info" | "warning" | "risk";
    title: string;
    detail: string;
  }>;
  employeePerformance: Array<{
    employeeId: string;
    employeeName: string;
    completedVisits: number;
    revenueFrom: number;
    revenueTo: number;
    consumableCost: number | null;
    profitFrom: number | null;
    profitTo: number | null;
    averageProfitFrom: number | null;
    averageProfitTo: number | null;
    usedMl: number;
    usedGram: number;
  }>;
};

export type AdminBusinessAnalyticsPeriod = "week" | "month" | "custom";

export type AnalyticsComparisonMetric = {
  current: number;
  previous: number;
  changePercent: number;
};

export type AnalyticsNullableComparisonMetric = {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
};

export type AdminAppointment = {
  id: string;
  time: string;
  date: string;
  endDate: string;
  employeeId: string;
  serviceIds: string[];
  services: Array<{
    id: string;
    name: string;
    duration: number;
    price: number;
    priceFrom: number | null;
    priceTo: number | null;
  }>;
  durationMinutes: number;
  clientId: string;
  client: string;
  clientPhone: string;
  clientEmail: string | null;
  service: string;
  master: string;
  status: string;
  clientComment: string;
  employeeComment: string;
  comment: string;
  amount: number;
  paymentStatus: string;
  paymentMethod: "cash" | "card" | "blik" | "transfer";
  rating: number | null;
  revenueFrom: number;
  revenueTo: number;
  consumableCost: number | null;
  profitAfterConsumablesFrom: number | null;
  profitAfterConsumablesTo: number | null;
  auditLogs: Array<{
    id: string;
    eventType: string;
    summary: string;
    actor: string;
    createdAt: string;
  }>;
};

export type AdminClient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visits: number;
  spent: number;
  comment: string;
  nameAliases: Array<{
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    source: string | null;
    createdAt: string;
  }>;
  emailAliases: Array<{
    id: string;
    email: string;
    source: string | null;
    createdAt: string;
  }>;
};

export type AdminClientProfile = AdminClient & {
  firstName: string;
  lastName: string;
  notes: Array<{
    id: string;
    text: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  }>;
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    service: string;
    employee: string;
    status: string;
    amount: number;
    paymentStatus: string;
    clientComment: string;
    employeeComment: string;
    rating: number | null;
  }>;
  sales: Array<{
    id: string;
    saleDate: string;
    products: string;
    quantity: number;
    employee: string | null;
    paymentStatus: string;
    paymentMethod: string;
    total: number;
  }>;
};

export type AdminService = {
  id: string;
  categoryId: string | null;
  category: AdminServiceCategory | null;
  name: string;
  price: number;
  priceFrom: number | null;
  priceTo: number | null;
  duration: number;
  description: string | null;
  active: boolean;
  appointmentCount: number;
  canDelete: boolean;
  consumables: AdminServiceConsumable[];
  employeeIds: string[];
  employees: Array<{ id: string; name: string; specialization: string | null }>;
};

export type MeasurementUnit = "ml" | "gram";
export type ProductPurpose = "sale" | "procedure" | "both";

export type AdminServiceConsumable = {
  productId: string;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unit: MeasurementUnit;
  productContentAmount: number | null;
  productContentUnit: MeasurementUnit | null;
};

export type AdminServiceCategory = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type AdminWorkingHour = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type AdminTimeOff = {
  id: string;
  startTime: string;
  endTime: string;
  reason: string | null;
};

export type AdminScheduleOverride = {
  id: string;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  isClosed: boolean;
  reason: string | null;
};

export type AdminEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string | null;
  specialization: string | null;
  description: string | null;
  active: boolean;
  serviceIds: string[];
  services: Array<{
    id: string;
    name: string;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  workingHours: AdminWorkingHour[];
  scheduleOverrides: AdminScheduleOverride[];
  timeOffItems: AdminTimeOff[];
  hours: string;
  timeOff: string;
};

export type AdminPortfolioPhoto = {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  master: string;
  imageUrl: string;
  visible: boolean;
};

export type AdminProduct = {
  id: string;
  categoryId: string | null;
  brandId: string | null;
  category: string;
  brand: string | null;
  sku: string | null;
  imageUrl: string | null;
  name: string;
  description: string | null;
  quote: string | null;
  purpose: ProductPurpose;
  purchase: number;
  sale: number;
  stock: number;
  min: number;
  popularityBoost: number;
  contentAmount: number | null;
  contentUnit: MeasurementUnit | null;
  stockContentAmount: number | null;
  stockPackageEquivalent: number | null;
  components: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  stockStatus: "ok" | "low" | "not_tracked";
  movements: Array<{
    type: string;
    quantity: number;
    contentQuantity: number | null;
    contentUnit: MeasurementUnit | null;
    reason: string | null;
    createdAt: string;
  }>;
};

export type AdminProductCategory = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type AdminProductBrand = {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
};

export type AdminProductComponent = {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
};

export type AdminSale = {
  id: string;
  product: string;
  qty: number;
  client: string;
  employee: string | null;
  paymentId: string | null;
  payment: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  netTotal: number;
  saleDate: string;
};

export type AdminPaymentAuditLog = {
  id: string;
  eventType: string;
  summary: string;
  actor: string;
  createdAt: string;
  details: Record<string, unknown> | null;
};

export type AdminPayment = {
  id: string;
  source: string;
  client: string;
  method: string;
  status: string;
  amount: number;
  netAmount: number;
  paidAt: string | null;
  auditLogs: AdminPaymentAuditLog[];
};

export type AdminReview = {
  id: string;
  client: string;
  employee: string;
  service: string;
  rating: number;
  text: string;
};

export type StoreOrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "completed" | "cancelled";
export type StorePaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type AdminStoreOrder = {
  id: string;
  status: StoreOrderStatus;
  paymentStatus: StorePaymentStatus;
  paymentProvider: string | null;
  monobankInvoiceId: string | null;
  paymentUrl: string | null;
  paymentError: string | null;
  paidAt: string | null;
  customer: { firstName: string; lastName: string; phone: string; email: string | null };
  deliveryMethod: "pickup" | "delivery";
  deliveryAddress: string | null;
  comment: string | null;
  totalAmount: number;
  stockDeductedAt: string | null;
  stockRestoredAt: string | null;
  createdAt: string;
  items: Array<{ id: string; productId: string; productName: string; unitPrice: number; quantity: number }>;
};

export type AdminSettings = {
  salonName: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  hours: string;
};

export type AdminData = {
  dashboard: AdminDashboard;
  consumableAnalytics: AdminConsumableAnalytics;
  businessAnalytics: AdminBusinessAnalytics;
  appointments: AdminAppointment[];
  clients: AdminClient[];
  serviceCategories: AdminServiceCategory[];
  services: AdminService[];
  employees: AdminEmployee[];
  portfolio: AdminPortfolioPhoto[];
  productCategories: AdminProductCategory[];
  productBrands: AdminProductBrand[];
  productComponents: AdminProductComponent[];
  products: AdminProduct[];
  sales: AdminSale[];
  storeOrders: AdminStoreOrder[];
  payments: AdminPayment[];
  reviews: AdminReview[];
  settings: AdminSettings;
};

export type ServiceInput = {
  categoryId?: string;
  name: string;
  price: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  duration: number;
  description?: string;
  active: boolean;
  employeeIds: string[];
  consumables: Array<{
    productId: string;
    quantity: number;
    unit: MeasurementUnit;
  }>;
};

export type ServiceCategoryInput = {
  name: string;
  description?: string;
  active: boolean;
};

export type EmployeeInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password?: string;
  specialization?: string;
  description?: string;
  active: boolean;
  serviceIds: string[];
};

export type EmployeeWorkingHoursInput = {
  hours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
};

export type EmployeeTimeOffInput = {
  startTime: string;
  endTime: string;
  reason?: string;
};

export type EmployeeScheduleOverrideInput = {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isClosed: boolean;
  reason?: string;
};

export type PortfolioInput = {
  employeeId: string;
  imageUrl: string;
  description?: string;
  visible: boolean;
};

export type AdminAppointmentInput = {
  employeeId: string;
  serviceIds: string[];
  startTime: string;
  status?: "scheduled" | "completed" | "cancelled" | "no_show";
  clientId?: string;
  client?: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
  clientComment?: string;
  employeeComment?: string;
};

export type ProductInput = {
  categoryId?: string;
  category?: string;
  brandId?: string;
  name: string;
  description?: string;
  quote?: string;
  brand?: string;
  sku?: string;
  imageUrl?: string;
  purpose?: ProductPurpose;
  purchase?: number;
  sale: number;
  stock: number;
  min: number;
  popularityBoost?: number;
  contentAmount?: number;
  contentUnit?: MeasurementUnit;
  componentIds?: string[];
};

export type ProductCategoryInput = {
  name: string;
  description?: string;
  imageUrl?: string;
};

export type ProductBrandInput = {
  name: string;
  description?: string;
};

export type ProductComponentInput = {
  name: string;
  description?: string;
};

export type StockMovementInput = {
  productId: string;
  movementType: "purchase" | "adjustment" | "return";
  amountMode: "packages" | "content";
  amount: number;
  reason?: string;
};

export type SaleInput = {
  productId: string;
  quantity: number;
  clientId?: string;
  employeeId?: string;
  paymentMethod: "cash" | "card" | "blik" | "transfer";
};

export type SettingsInput = {
  salonName: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  openingTime?: string;
  closingTime?: string;
};

export type AuthUser = {
  id: string;
  role: "ADMIN" | "EMPLOYEE";
  employeeId: string | null;
  name: string;
  email: string | null;
};

export type LoginResult = {
  token: string;
  user: AuthUser;
};

type ApiResponse<T> = {
  data: T;
};

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const authTokenKey = "salon-crm-token";

export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const normalizedPath = url.startsWith("/") ? url : `/${url}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

export function getStoredAuthToken() {
  return localStorage.getItem(authTokenKey);
}

export function setStoredAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(authTokenKey, token);
  } else {
    localStorage.removeItem(authTokenKey);
  }
}

export async function loginCrm(payload: { email: string; password: string }) {
  const data = await request<ApiResponse<LoginResult>>("/api/auth/login", jsonRequest("POST", payload), false).then((response) => response.data);
  setStoredAuthToken(data.token);
  return data;
}

export async function fetchCurrentUser() {
  return request<ApiResponse<AuthUser>>("/api/auth/me").then((response) => response.data);
}

export async function fetchServices() {
  return request<ApiResponse<Service[]>>("/api/services").then((response) => response.data);
}

export async function fetchEmployees(serviceIds: string[]) {
  const query = serviceIds.length > 0 ? `?serviceIds=${serviceIds.join(",")}` : "";
  return request<ApiResponse<Employee[]>>(`/api/employees${query}`).then((response) => response.data);
}

export async function fetchAvailability(employeeId: string, serviceIds: string[], date: string) {
  const params = new URLSearchParams({
    employeeId,
    serviceIds: serviceIds.join(","),
    date
  });
  return request<ApiResponse<Slot[]>>(`/api/availability?${params}`).then((response) => response.data);
}

export async function fetchPortfolio() {
  return request<ApiResponse<PortfolioPhoto[]>>("/api/portfolio").then((response) => response.data);
}

export async function fetchProducts() {
  return request<ApiResponse<PublicProduct[]>>("/api/products").then((response) => response.data);
}

export async function createAppointment(payload: AppointmentPayload) {
  return request<ApiResponse<{ id: string; startTime: string }>>("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then((response) => response.data);
}

export async function fetchAdminData(): Promise<AdminData> {
  const [dashboard, consumableAnalytics, businessAnalytics, appointments, clients, serviceCategories, services, employees, portfolio, productCategories, productBrands, productComponents, products, sales, storeOrders, payments, reviews, settings] = await Promise.all([
    getAdmin<AdminDashboard>("dashboard"),
    getAdmin<AdminConsumableAnalytics>("consumable-analytics"),
    getAdmin<AdminBusinessAnalytics>("business-analytics"),
    getAdmin<AdminAppointment[]>("appointments"),
    getAdmin<AdminClient[]>("clients"),
    getAdmin<AdminServiceCategory[]>("service-categories"),
    getAdmin<AdminService[]>("services"),
    getAdmin<AdminEmployee[]>("employees"),
    getAdmin<AdminPortfolioPhoto[]>("portfolio"),
    getAdmin<AdminProductCategory[]>("product-categories"),
    getAdmin<AdminProductBrand[]>("product-brands"),
    getAdmin<AdminProductComponent[]>("product-components"),
    getAdmin<AdminProduct[]>("products"),
    getAdmin<AdminSale[]>("sales"),
    getAdmin<AdminStoreOrder[]>("store-orders"),
    getAdmin<AdminPayment[]>("payments"),
    getAdmin<AdminReview[]>("reviews"),
    getAdmin<AdminSettings>("settings")
  ]);

  return { dashboard, consumableAnalytics, businessAnalytics, appointments, clients, serviceCategories, services, employees, portfolio, productCategories, productBrands, productComponents, products, sales, storeOrders, payments, reviews, settings };
}

export async function fetchAdminBusinessAnalytics(input: { period: AdminBusinessAnalyticsPeriod; from?: string; to?: string }) {
  const params = new URLSearchParams({ period: input.period });

  if (input.period === "custom") {
    if (input.from) {
      params.set("from", input.from);
    }

    if (input.to) {
      params.set("to", input.to);
    }
  }

  return getAdmin<AdminBusinessAnalytics>(`business-analytics?${params}`);
}

async function getAdmin<T>(resource: string) {
  return request<ApiResponse<T>>(`/api/admin/${resource}`).then((response) => response.data);
}

export async function updateAdminAppointment(
  id: string,
  payload: {
    status?: string;
    employeeComment?: string;
    paymentAmount?: number;
    paymentMethod?: "cash" | "card" | "blik" | "transfer";
    paymentStatus?: "pending" | "paid" | "refunded";
    consumables?: Array<{ productId: string; quantity: number; unit?: MeasurementUnit }>;
  }
) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/appointments/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function createAdminAppointment(payload: AdminAppointmentInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/appointments", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function rescheduleAdminAppointment(id: string, payload: { startTime: string; endTime?: string; employeeComment?: string }) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/appointments/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function updateAdminAppointmentComment(id: string, payload: { employeeComment: string }) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/appointments/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function fetchAppointmentConsumablePreview(id: string) {
  return request<ApiResponse<AppointmentConsumablePreview>>(`/api/admin/appointments/${id}/consumables-preview`).then((response) => response.data);
}

export async function fetchAdminClientProfile(id: string) {
  return request<ApiResponse<AdminClientProfile>>(`/api/admin/clients/${id}`).then((response) => response.data);
}

export async function createAdminClientNote(id: string, payload: { text: string }) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/clients/${id}/notes`, jsonRequest("POST", payload)).then((response) => response.data);
}

export async function createAdminPortfolioPhoto(payload: PortfolioInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/portfolio", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminPortfolioPhoto(id: string, payload: Partial<PortfolioInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/portfolio/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminPortfolioPhoto(id: string) {
  return request<void>(`/api/admin/portfolio/${id}`, { method: "DELETE" });
}

export async function uploadAdminPortfolioImage(file: File) {
  return request<ApiResponse<{ imageUrl: string }>>(`/api/admin/uploads/portfolio`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file
  }).then((response) => response.data);
}

export async function uploadAdminProductImage(file: File) {
  return request<ApiResponse<{ imageUrl: string }>>(`/api/admin/uploads/products`, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file
  }).then((response) => response.data);
}

export async function createAdminService(payload: ServiceInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/services", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminService(id: string, payload: Partial<ServiceInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/services/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminService(id: string) {
  return request<void>(`/api/admin/services/${id}`, { method: "DELETE" });
}

export async function createAdminServiceCategory(payload: ServiceCategoryInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/service-categories", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminServiceCategory(id: string, payload: Partial<ServiceCategoryInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/service-categories/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminServiceCategory(id: string) {
  return request<void>(`/api/admin/service-categories/${id}`, { method: "DELETE" });
}

export async function createAdminEmployee(payload: EmployeeInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/employees", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminEmployee(id: string, payload: Partial<EmployeeInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/employees/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function updateAdminEmployeeWorkingHours(id: string, payload: EmployeeWorkingHoursInput) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/employees/${id}/working-hours`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function createAdminEmployeeScheduleOverride(id: string, payload: EmployeeScheduleOverrideInput) {
  return request<ApiResponse<{ id: string; count: number }>>(`/api/admin/employees/${id}/schedule-overrides`, jsonRequest("POST", payload)).then(
    (response) => response.data
  );
}

export async function deleteAdminEmployeeScheduleOverride(employeeId: string, overrideId: string) {
  return request<void>(`/api/admin/employees/${employeeId}/schedule-overrides/${overrideId}`, { method: "DELETE" });
}

export async function createAdminEmployeeTimeOff(id: string, payload: EmployeeTimeOffInput) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/employees/${id}/time-off`, jsonRequest("POST", payload)).then((response) => response.data);
}

export async function deleteAdminEmployeeTimeOff(employeeId: string, timeOffId: string) {
  return request<void>(`/api/admin/employees/${employeeId}/time-off/${timeOffId}`, { method: "DELETE" });
}

export async function createAdminProduct(payload: ProductInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/products", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminProduct(id: string, payload: Partial<ProductInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/products/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminProduct(id: string) {
  return request<void>(`/api/admin/products/${id}`, { method: "DELETE" });
}

export async function createAdminProductCategory(payload: ProductCategoryInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/product-categories", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminProductCategory(id: string, payload: Partial<ProductCategoryInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/product-categories/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminProductCategory(id: string) {
  return request<void>(`/api/admin/product-categories/${id}`, { method: "DELETE" });
}

export async function createAdminProductBrand(payload: ProductBrandInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/product-brands", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminProductBrand(id: string, payload: Partial<ProductBrandInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/product-brands/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminProductBrand(id: string) {
  return request<void>(`/api/admin/product-brands/${id}`, { method: "DELETE" });
}

export async function createAdminProductComponent(payload: ProductComponentInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/product-components", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminProductComponent(id: string, payload: Partial<ProductComponentInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/product-components/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function deleteAdminProductComponent(id: string) {
  return request<void>(`/api/admin/product-components/${id}`, { method: "DELETE" });
}

export async function createAdminStockMovement(payload: StockMovementInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/stock-movements", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminStoreOrder(id: string, status: StoreOrderStatus) {
  return request<ApiResponse<AdminStoreOrder>>(`/api/admin/store-orders/${id}`, jsonRequest("PATCH", { status })).then((response) => response.data);
}

export async function createAdminSale(payload: SaleInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/sales", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminPayment(id: string, payload: { status: string; method?: string; reason?: string; returnToStock?: boolean }) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/payments/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function updateAdminSettings(payload: SettingsInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/settings", jsonRequest("PATCH", payload)).then((response) => response.data);
}

function jsonRequest(method: "POST" | "PATCH", payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
}

async function request<T>(input: RequestInfo, init: RequestInit = {}, withAuth = true): Promise<T> {
  const response = await fetch(resolveApiUrl(input), withAuth ? withAuthHeader(init) : init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data));
  }

  return data as T;
}

function resolveApiUrl(input: RequestInfo): RequestInfo {
  if (typeof input !== "string" || !API_BASE_URL || !input.startsWith("/")) {
    return input;
  }

  return `${API_BASE_URL}${input}`;
}

function getApiErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return "Request failed.";
  }

  const body = data as { message?: unknown; details?: unknown; issues?: unknown };
  const message = typeof body.message === "string" ? body.message : "Request failed.";

  if (!/^validation failed\.?$/i.test(message.trim())) {
    return message;
  }

  const details = getApiErrorDetails(body.details);

  if (details.length > 0) {
    return `Validation failed: ${details.join(" ")}`;
  }

  const issueDetails = getFlattenedIssueDetails(body.issues);

  if (issueDetails.length > 0) {
    return `Validation failed: ${issueDetails.join(" ")}`;
  }

  return message;
}

function getApiErrorDetails(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getFlattenedIssueDetails(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const issueBody = value as { formErrors?: unknown; fieldErrors?: unknown };
  const formErrors = Array.isArray(issueBody.formErrors) ? issueBody.formErrors : [];
  const fieldErrors =
    issueBody.fieldErrors && typeof issueBody.fieldErrors === "object" ? Object.entries(issueBody.fieldErrors as Record<string, unknown>) : [];

  return [
    ...formErrors.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    ...fieldErrors.flatMap(([field, errors]) =>
      Array.isArray(errors)
        ? errors
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => `${formatApiFieldName(field)}: ${item}.`)
        : []
    )
  ];
}

function formatApiFieldName(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function withAuthHeader(init: RequestInit): RequestInit {
  const token = getStoredAuthToken();

  if (!token) {
    return init;
  }

  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  };
}
