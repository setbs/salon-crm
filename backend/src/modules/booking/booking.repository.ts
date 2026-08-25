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

export function findScheduleOverride(employeeId: bigint, workDate: Date) {
  return prisma.employeeScheduleOverride.findUnique({
    where: { employeeId_workDate: { employeeId, workDate } }
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

export function findTimeOffForRange(employeeId: bigint, startTime: Date, endTime: Date) {
  return prisma.employeeTimeOff.findMany({
    where: {
      employeeId,
      startTime: { lt: endTime },
      endTime: { gt: startTime }
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
    const existingClient = await findClientByPhone(transaction, input.client.phone);
    const emailOwner = email ? await transaction.user.findUnique({ where: { email } }) : null;

    if (emailOwner && emailOwner.role !== UserRole.CLIENT) {
      throw new HttpError(409, "This email is already used by a CRM account.");
    }

    if (emailOwner && existingClient && emailOwner.id !== existingClient.id) {
      throw new HttpError(409, "This email is already assigned to another client.");
    }

    if (emailOwner && !existingClient) {
      throw new HttpError(409, "This email is already assigned to another client.");
    }

    const client = existingClient
      ? await transaction.user.update({
          where: { id: existingClient.id },
          data: {
            phone: input.client.phone,
            email: existingClient.email ?? email
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

    await rememberClientNameAlias(transaction, client.id, input.client.firstName, input.client.lastName, "public_booking");

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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function findClientByPhone(transaction: Prisma.TransactionClient, phone: string) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const [client] = await transaction.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM users
    WHERE role = ${UserRole.CLIENT}::"UserRole"
      AND regexp_replace(phone, '\\D', '', 'g') = ${normalizedPhone}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return client ? transaction.user.findUnique({ where: { id: client.id } }) : null;
}

async function rememberClientNameAlias(
  transaction: Prisma.TransactionClient,
  clientId: bigint,
  firstName: string,
  lastName: string,
  source: string
) {
  await transaction.clientNameAlias.upsert({
    where: {
      clientId_firstName_lastName: {
        clientId,
        firstName,
        lastName
      }
    },
    update: {},
    create: {
      clientId,
      firstName,
      lastName,
      source
    }
  });
}
