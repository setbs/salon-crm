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
};

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string | null;
  description: string | null;
  services: Array<{ id: string; name: string }>;
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

export type AdminAppointment = {
  id: string;
  time: string;
  date: string;
  client: string;
  service: string;
  master: string;
  status: string;
  comment: string;
  amount: number;
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

export type AdminService = {
  id: string;
  categoryId: string | null;
  category: AdminServiceCategory | null;
  name: string;
  price: number;
  duration: number;
  description: string | null;
  active: boolean;
};

export type AdminServiceCategory = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type AdminEmployee = {
  id: string;
  name: string;
  specialization: string | null;
  active: boolean;
  hours: string;
  timeOff: string;
};

export type AdminPortfolioPhoto = {
  id: string;
  title: string;
  master: string;
  imageUrl: string;
  visible: boolean;
};

export type AdminProduct = {
  id: string;
  category: string;
  name: string;
  purchase: number;
  sale: number;
  stock: number;
  min: number;
  movements: Array<{ type: string; quantity: number; reason: string | null; createdAt: string }>;
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
  duration: number;
  description?: string;
  active: boolean;
};

export type ServiceCategoryInput = {
  name: string;
  description?: string;
  active: boolean;
};

export type ProductInput = {
  category: string;
  name: string;
  purchase?: number;
  sale: number;
  stock: number;
  min: number;
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

type ApiResponse<T> = {
  data: T;
};

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

export async function createAppointment(payload: AppointmentPayload) {
  return request<ApiResponse<{ id: string; startTime: string }>>("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then((response) => response.data);
}

export async function fetchAdminData(): Promise<AdminData> {
  const [dashboard, appointments, clients, serviceCategories, services, employees, portfolio, products, sales, payments, reviews, settings] = await Promise.all([
    getAdmin<AdminDashboard>("dashboard"),
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

  return { dashboard, appointments, clients, serviceCategories, services, employees, portfolio, products, sales, payments, reviews, settings };
}

async function getAdmin<T>(resource: string) {
  return request<ApiResponse<T>>(`/api/admin/${resource}`).then((response) => response.data);
}

export async function updateAdminAppointment(id: string, payload: { status?: string; employeeComment?: string }) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/appointments/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function createAdminService(payload: ServiceInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/services", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminService(id: string, payload: Partial<ServiceInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/services/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function createAdminServiceCategory(payload: ServiceCategoryInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/service-categories", jsonRequest("POST", payload)).then((response) => response.data);
}

export async function updateAdminServiceCategory(id: string, payload: Partial<ServiceCategoryInput>) {
  return request<ApiResponse<{ id: string }>>(`/api/admin/service-categories/${id}`, jsonRequest("PATCH", payload)).then((response) => response.data);
}

export async function createAdminProduct(payload: ProductInput) {
  return request<ApiResponse<{ id: string }>>("/api/admin/products", jsonRequest("POST", payload)).then((response) => response.data);
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

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed.");
  }

  return data as T;
}
