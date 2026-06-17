import { z } from "zod";

const idStringSchema = z.string().regex(/^\d+$/);
const optionalCategoryIdSchema = idStringSchema.optional().or(z.literal(""));
const optionalDisplayPriceSchema = z.preprocess((value) => (value === "" ? null : value), z.coerce.number().nonnegative().nullable()).optional();
const consumableUnitSchema = z.enum(["ml", "gram"]);
const serviceConsumableSchema = z.object({
  productId: idStringSchema,
  quantity: z.coerce.number().positive(),
  unit: consumableUnitSchema
});

function validateDisplayPriceRange(input: { priceFrom?: number | null; priceTo?: number | null }, context: z.RefinementCtx) {
  if (input.priceFrom !== undefined && input.priceFrom !== null && input.priceTo !== undefined && input.priceTo !== null && input.priceTo < input.priceFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Price to must be greater than or equal to price from.",
      path: ["priceTo"]
    });
  }
}

export const updateAppointmentSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  clientComment: z.string().trim().max(1000).optional(),
  employeeComment: z.string().trim().max(1000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
});

export const createAppointmentSchema = z.object({
  employeeId: idStringSchema,
  serviceIds: z.array(idStringSchema).min(1),
  startTime: z.string().datetime(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  clientId: idStringSchema.optional().or(z.literal("")),
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

export const createServiceSchema = z
  .object({
    categoryId: optionalCategoryIdSchema,
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(1000).optional(),
    duration: z.coerce.number().int().positive(),
    price: z.coerce.number().nonnegative(),
    priceFrom: optionalDisplayPriceSchema,
    priceTo: optionalDisplayPriceSchema,
    active: z.boolean().default(true),
    employeeIds: z.array(idStringSchema).default([]),
    consumables: z.array(serviceConsumableSchema).default([])
  })
  .superRefine(validateDisplayPriceRange);

export const updateServiceSchema = z
  .object({
    categoryId: optionalCategoryIdSchema.optional(),
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(1000).optional(),
    duration: z.coerce.number().int().positive().optional(),
    price: z.coerce.number().nonnegative().optional(),
    priceFrom: optionalDisplayPriceSchema,
    priceTo: optionalDisplayPriceSchema,
    active: z.boolean().optional(),
    employeeIds: z.array(idStringSchema).optional(),
    consumables: z.array(serviceConsumableSchema).optional()
  })
  .superRefine(validateDisplayPriceRange);

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
  min: z.coerce.number().int().nonnegative(),
  contentAmount: z.coerce.number().positive().optional(),
  contentUnit: consumableUnitSchema.optional()
});

export const updateProductSchema = createProductSchema.partial();

export const createStockMovementSchema = z
  .object({
    productId: idStringSchema,
    movementType: z.enum(["purchase", "adjustment", "return"]),
    amountMode: z.enum(["packages", "content"]),
    amount: z.coerce.number(),
    reason: z.string().trim().max(500).optional()
  })
  .superRefine((input, context) => {
    if (input.amountMode === "packages" && !Number.isInteger(input.amount)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Package amount must be a whole number.",
        path: ["amount"]
      });
    }

    if (input.movementType === "adjustment") {
      if (input.amount === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Adjustment amount cannot be zero.",
          path: ["amount"]
        });
      }

      return;
    }

    if (input.amount <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be positive.",
        path: ["amount"]
      });
    }
  });

export const createSaleSchema = z.object({
  productId: idStringSchema,
  quantity: z.coerce.number().int().positive(),
  clientId: idStringSchema.optional().or(z.literal("")),
  employeeId: idStringSchema.optional().or(z.literal("")),
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
