import { z } from "zod";

export const availabilityQuerySchema = z.object({
  employeeId: z.string().regex(/^\d+$/),
  serviceIds: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const createAppointmentSchema = z.object({
  employeeId: z.string().regex(/^\d+$/),
  serviceIds: z.array(z.string().regex(/^\d+$/)).min(1),
  startTime: z.string().datetime(),
  client: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(5).max(20),
    email: z.string().trim().email().optional().or(z.literal(""))
  }),
  clientComment: z.string().trim().max(1000).optional()
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
