import { z } from "zod";

export const updateAppointmentSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  clientComment: z.string().trim().max(1000).optional(),
  employeeComment: z.string().trim().max(1000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
});

export const createAppointmentSchema = z.object({
  employeeId: z.string().regex(/^\d+$/),
  serviceIds: z.array(z.string().regex(/^\d+$/)).min(1),
  startTime: z.string().datetime(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  clientId: z.string().regex(/^\d+$/).optional().or(z.literal("")),
  client: z
    .object({
      firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100),
      phone: z.string().trim().min(1).max(20),
      email: z.string().trim().email().optional().or(z.literal(""))
    })
    .optional(),
  clientComment: z.string().trim().max(1000).optional(),
  employeeComment: z.string().trim().max(1000).optional()
});

export const createServiceSchema = z.object({
  categoryId: z.string().regex(/^\d+$/).optional().or(z.literal("")),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  duration: z.coerce.number().int().positive(),
  price: z.coerce.number().nonnegative(),
  active: z.boolean().default(true)
});

export const updateServiceSchema = createServiceSchema.partial();

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  active: z.boolean().default(true)
});

export const updateServiceCategorySchema = createServiceCategorySchema.partial();

export const createProductSchema = z.object({
  category: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  brand: z.string().trim().max(255).optional(),
  sku: z.string().trim().max(100).optional(),
  purchase: z.coerce.number().nonnegative().optional(),
  sale: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int(),
  min: z.coerce.number().int().nonnegative()
});

export const updateProductSchema = createProductSchema.partial();

export const createSaleSchema = z.object({
  productId: z.string().regex(/^\d+$/),
  quantity: z.coerce.number().int().positive(),
  clientId: z.string().regex(/^\d+$/).optional().or(z.literal("")),
  employeeId: z.string().regex(/^\d+$/).optional().or(z.literal("")),
  paymentMethod: z.enum(["cash", "card", "blik", "transfer"])
});

export const updatePaymentSchema = z.object({
  status: z.enum(["pending", "paid", "refunded"]),
  method: z.enum(["cash", "card", "blik", "transfer"]).optional()
});

export const updateSettingsSchema = z.object({
  salonName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().max(1000).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
