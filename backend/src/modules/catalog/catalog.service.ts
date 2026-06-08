import { listActiveEmployees, listActiveServices } from "./catalog.repository.js";

export async function getServices() {
  const services = await listActiveServices();

  return services.map((service) => ({
    id: service.id.toString(),
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    price: Number(service.price)
  }));
}

export async function getEmployees(serviceIds: bigint[]) {
  const employees = await listActiveEmployees(serviceIds);

  return employees.map((employee) => ({
    id: employee.id.toString(),
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    specialization: employee.specialization,
    description: employee.description,
    services: employee.services.map(({ service }) => ({
      id: service.id.toString(),
      name: service.name
    }))
  }));
}
