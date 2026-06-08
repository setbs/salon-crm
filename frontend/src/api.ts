export type Service = {
  id: string;
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

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed.");
  }

  return data as T;
}
