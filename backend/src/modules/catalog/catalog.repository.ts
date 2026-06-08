import { prisma } from "../../config/prisma.js";

export function listActiveServices() {
  return prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" }
  });
}

export function listActiveEmployees(serviceIds: bigint[]) {
  return prisma.employee.findMany({
    where: {
      isActive: true,
      ...(serviceIds.length > 0
        ? {
            AND: serviceIds.map((serviceId) => ({
              services: { some: { serviceId } }
            }))
          }
        : {})
    },
    include: {
      user: true,
      services: { include: { service: true } }
    },
    orderBy: { user: { firstName: "asc" } }
  });
}
