import { z } from "zod";

export const availabilityQuerySchema = z.object({
  employeeId: z.string().regex(/^[1-9]\d{0,17}$/),
  serviceIds: z.string().min(1).max(600),
  date: z.string().date()
});

export const createAppointmentSchema = z.object({
  employeeId: z.string().regex(/^[1-9]\d{0,17}$/),
  serviceIds: z.array(z.string().regex(/^[1-9]\d{0,17}$/)).min(1).max(30),
  startTime: z.string().datetime(),
  client: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(5).max(20),
    email: z.string().trim().email().max(255).optional().or(z.literal(""))
  }),
  clientComment: z.string().trim().max(1000).optional()
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
