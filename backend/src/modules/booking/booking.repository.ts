import { AppointmentStatus, UserRole, type Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

export function findActiveServicesByIds(serviceIds: bigint[]) {
  return prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true }
  });
}

export function countEmployeeServices(employeeId: bigint, serviceIds: bigint[]) {
  return prisma.employeeService.count({
    where: { employeeId, serviceId: { in: serviceIds } }
  });
}

export function findWorkingHour(employeeId: bigint, dayOfWeek: number) {
  return prisma.workingHour.findUnique({
    where: { employeeId_dayOfWeek: { employeeId, dayOfWeek } }
  });
}

export function findAppointmentsForDay(employeeId: bigint, dayStart: Date, dayEnd: Date) {
  return prisma.appointment.findMany({
    where: {
      employeeId,
      status: { not: AppointmentStatus.CANCELLED },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart }
    },
    select: { startTime: true, endTime: true }
  });
}

export function createAppointmentWithClient(input: {
  employeeId: bigint;
  serviceIds: bigint[];
  startTime: Date;
  endTime: Date;
  clientComment?: string;
  client: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
}) {
  return prisma.$transaction(async (transaction) => {
    const conflict = await transaction.appointment.findFirst({
      where: {
        employeeId: input.employeeId,
        status: { not: AppointmentStatus.CANCELLED },
        startTime: { lt: input.endTime },
        endTime: { gt: input.startTime }
      }
    });

    if (conflict) {
      return null;
    }

    const email = input.client.email?.trim() || null;
    const existingClient = email ? await transaction.user.findUnique({ where: { email } }) : null;

    if (existingClient && existingClient.role !== UserRole.CLIENT) {
      throw new HttpError(409, "This email is already used by a CRM account.");
    }

    const client = existingClient
      ? await transaction.user.update({
          where: { id: existingClient.id },
          data: {
            firstName: input.client.firstName,
            lastName: input.client.lastName,
            phone: input.client.phone
          }
        })
      : await transaction.user.create({
          data: {
            firstName: input.client.firstName,
            lastName: input.client.lastName,
            phone: input.client.phone,
            email
          }
        });

    return transaction.appointment.create({
      data: {
        clientId: client.id,
        employeeId: input.employeeId,
        startTime: input.startTime,
        endTime: input.endTime,
        clientComment: input.clientComment,
        services: {
          create: input.serviceIds.map((serviceId) => ({ serviceId }))
        }
      },
      include: appointmentDetailsInclude
    });
  });
}

const appointmentDetailsInclude = {
  client: true,
  employee: { include: { user: true } },
  services: { include: { service: true } }
} satisfies Prisma.AppointmentInclude;
