import { HttpError } from "../../utils/http-error.js";
import { atLocalTime, buildSlots, overlaps, parseDate } from "../../utils/time.js";
import {
  countEmployeeServices,
  createAppointmentWithClient,
  findActiveServicesByIds,
  findAppointmentsForDay,
  findTimeOffForRange,
  findWorkingHour
} from "./booking.repository.js";
import type { CreateAppointmentInput } from "./booking.schemas.js";

export async function getAvailability(input: { employeeId: bigint; serviceIds: bigint[]; date: string }) {
  const services = await findActiveServicesByIds(input.serviceIds);

  if (services.length !== input.serviceIds.length) {
    throw new HttpError(400, "One or more selected services are unavailable.");
  }

  const totalDuration = services.reduce((sum, service) => sum + service.durationMinutes, 0);
  const selectedDate = parseDate(input.date);
  const workingHour = await findWorkingHour(input.employeeId, selectedDate.getDay());

  if (!workingHour) {
    return [];
  }

  const dayStart = atLocalTime(input.date, "00:00");
  const dayEnd = atLocalTime(input.date, "23:59");
  const appointments = await findAppointmentsForDay(input.employeeId, dayStart, dayEnd);
  const timeOff = await findTimeOffForRange(input.employeeId, dayStart, dayEnd);

  return buildSlots(input.date, workingHour.startTime, workingHour.endTime, totalDuration)
    .filter((slot) => appointments.every((appointment) => !overlaps(slot.start, slot.end, appointment.startTime, appointment.endTime)))
    .filter((slot) => timeOff.every((entry) => !overlaps(slot.start, slot.end, entry.startTime, entry.endTime)))
    .map((slot) => ({
      startTime: slot.start.toISOString(),
      endTime: slot.end.toISOString(),
      label: slot.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    }));
}

export async function bookAppointment(input: CreateAppointmentInput) {
  const employeeId = BigInt(input.employeeId);
  const serviceIds = input.serviceIds.map((id) => BigInt(id));
  const startTime = new Date(input.startTime);
  const services = await findActiveServicesByIds(serviceIds);

  if (services.length !== serviceIds.length) {
    throw new HttpError(400, "One or more selected services are unavailable.");
  }

  const employeeServices = await countEmployeeServices(employeeId, serviceIds);

  if (employeeServices !== serviceIds.length) {
    throw new HttpError(400, "Selected employee does not provide all selected services.");
  }

  const durationMinutes = services.reduce((sum, service) => sum + service.durationMinutes, 0);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
  await ensureSlotWithinEmployeeSchedule(employeeId, startTime, endTime);
  const appointment = await createAppointmentWithClient({
    employeeId,
    serviceIds,
    startTime,
    endTime,
    client: input.client,
    clientComment: input.clientComment
  });

  if (!appointment) {
    throw new HttpError(409, "This time slot is no longer available.");
  }

  return {
    id: appointment.id.toString(),
    status: appointment.status,
    startTime: appointment.startTime.toISOString(),
    endTime: appointment.endTime.toISOString(),
    client: {
      firstName: appointment.client.firstName,
      lastName: appointment.client.lastName,
      phone: appointment.client.phone,
      email: appointment.client.email
    },
    employee: {
      id: appointment.employee.id.toString(),
      firstName: appointment.employee.user.firstName,
      lastName: appointment.employee.user.lastName
    },
    services: appointment.services.map(({ service }) => ({
      id: service.id.toString(),
      name: service.name,
      price: Number(service.price)
    }))
  };
}

async function ensureSlotWithinEmployeeSchedule(employeeId: bigint, startTime: Date, endTime: Date) {
  if (!isSameLocalDay(startTime, endTime)) {
    throw new HttpError(409, "Appointments must fit within one working day.");
  }

  const workingHour = await findWorkingHour(employeeId, startTime.getDay());

  if (!workingHour) {
    throw new HttpError(409, "The selected employee is not working at this time.");
  }

  const startClock = toClockTime(startTime);
  const endClock = toClockTime(endTime);

  if (startClock < workingHour.startTime || endClock > workingHour.endTime) {
    throw new HttpError(409, "The selected time is outside the employee working hours.");
  }

  const timeOff = await findTimeOffForRange(employeeId, startTime, endTime);

  if (timeOff.length > 0) {
    throw new HttpError(409, "The selected employee has time off during this period.");
  }
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function toClockTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}
