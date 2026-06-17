export type Service = {
  id: string;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    description: string | null;
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
};

export type AdminClient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visits: number;
  spent: number;
  comment: string;
};

export type AdminClientProfile = AdminClient & {
  firstName: string;
  lastName: string;
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
  category: string;
  brand: string | null;
  sku: string | null;
  name: string;
  purchase: number;
  sale: number;
  stock: number;
  min: number;
  contentAmount: number | null;
  contentUnit: MeasurementUnit | null;
  stockContentAmount: number | null;
  stockPackageEquivalent: number | null;
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

export type AdminSale = {
  id: string;
  product: string;
  qty: number;
  client: string;
  employee: string | null;
  payment: string;
  total: number;
  saleDate: string;
};

export type AdminPayment = {
  id: string;
  source: string;
  client: string;
  method: string;
  status: string;
  amount: number;
  paidAt: string | null;
};

export type AdminReview = {
  id: string;
  client: string;
  employee: string;
  service: string;
  rating: number;
  text: string;
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
  appointments: AdminAppointment[];
  clients: AdminClient[];
  serviceCategories: AdminServiceCategory[];
  services: AdminService[];
  employees: AdminEmployee[];
  portfolio: AdminPortfolioPhoto[];
  products: AdminProduct[];
  sales: AdminSale[];
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
  category: string;
  name: string;
  brand?: string;
  sku?: string;
  purchase?: number;
  sale: number;
  stock: number;
  min: number;
  contentAmount?: number;
  contentUnit?: MeasurementUnit;
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

const authTokenKey = "salon-crm-token";

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

export async function createAppointment(payload: AppointmentPayload) {
  return request<ApiResponse<{ id: string; startTime: string }>>("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then((response) => response.data);
}

export async function fetchAdminData(): Promise<AdminData> {
  const [dashboard, consumableAnalytics, appointments, clients, serviceCategories, services, employees, portfolio, products, sales, payments, reviews, settings] = await Promise.all([
    getAdmin<AdminDashboard>("dashboard"),
    getAdmin<AdminConsumableAnalytics>("consumable-analytics"),
    getAdmin<AdminAppointment[]>("appointments"),
    getAdmin<AdminClient[]>("clients"),
    getAdmin<AdminServiceCategory[]>("service-categories"),
    getAdmin<AdminService[]>("services"),
    getAdmin<AdminEmployee[]>("employees"),
    getAdmin<AdminPortfolioPhoto[]>("portfolio"),
    getAdmin<AdminProduct[]>("products"),
    getAdmin<AdminSale[]>("sales"),
    getAdmin<AdminPayment[]>("payments"),
    getAdmin<AdminReview[]>("reviews"),
    getAdmin<AdminSettings>("settings")
  ]);

  return { dashboard, consumableAnalytics, appointments, clients, serviceCategories, services, employees, portfolio, products, sales, payments, reviews, settings };
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

export async function createAdminStockMovement(payload: StockMovementInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/stock-movements", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function createAdminSale(payload: SaleInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/sales", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminPayment(id: string, payload: { status: string; method?: string }) {
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
  const response = await fetch(input, withAuth ? withAuthHeader(init) : init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed.");
  }

  return data as T;
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
