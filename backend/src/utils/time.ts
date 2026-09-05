import { HttpError } from "./http-error.js";

const slotStepMinutes = 30;

export function parseIdList(value: unknown): bigint[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  const ids = value.split(",");
  if (ids.length > 30 || ids.some((id) => !/^[1-9]\d{0,17}$/.test(id))) {
    throw new HttpError(400, "Invalid service IDs.");
  }
  return ids.map((id) => BigInt(id));
}

export function parseDate(value: string): Date {
  return atLocalTime(value, "00:00");
}

export function buildSlots(date: string, startTime: string, endTime: string, durationMinutes: number) {
  const workStart = atLocalTime(date, startTime);
  const workEnd = atLocalTime(date, endTime);
  const slots: Array<{ start: Date; end: Date }> = [];

  for (let start = workStart; start.getTime() + durationMinutes * 60_000 <= workEnd.getTime(); start = addMinutes(start, slotStepMinutes)) {
    const end = addMinutes(start, durationMinutes);
    slots.push({ start, end });
  }

  return slots;
}

export function atLocalTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}
