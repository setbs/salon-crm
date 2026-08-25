import { z } from "zod";

const idStringSchema = z.string().regex(/^\d+$/);
const optionalCategoryIdSchema = idStringSchema.optional().or(z.literal(""));
const optionalDisplayPriceSchema = z.preprocess((value) => (value === "" ? null : value), z.coerce.number().nonnegative().nullable()).optional();
const timeStringSchema = z.string().regex(/^\d{2}:\d{2}$/);
const consumableUnitSchema = z.enum(["ml", "gram"]);
const productPurposeSchema = z.enum(["sale", "procedure", "both"]);
const paymentMethodSchema = z.enum(["cash", "card", "blik", "transfer"]);
const paymentStatusSchema = z.enum(["pending", "paid", "refunded"]);
const serviceConsumableSchema = z.object({
  productId: idStringSchema,
  quantity: z.coerce.number().positive(),
  unit: consumableUnitSchema
});
const appointmentConsumableOverrideSchema = z.object({
  productId: idStringSchema,
  quantity: z.coerce.number().nonnegative(),
  unit: consumableUnitSchema.optional()
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
  endTime: z.string().datetime().optional(),
  paymentAmount: z.coerce.number().nonnegative().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  consumables: z.array(appointmentConsumableOverrideSchema).optional()
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

export const createClientNoteSchema = z.object({
  text: z.string().trim().min(1).max(3000)
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

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(20),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  specialization: z.string().trim().max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  active: z.boolean().default(true),
  serviceIds: z.array(idStringSchema).default([])
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  serviceIds: z.array(idStringSchema).optional()
});

const workingHourSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: timeStringSchema,
    endTime: timeStringSchema
  })
  .refine((input) => input.endTime > input.startTime, {
    message: "End time must be later than start time.",
    path: ["endTime"]
  });

export const updateEmployeeWorkingHoursSchema = z
  .object({
    hours: z.array(workingHourSchema).max(7)
  })
  .superRefine((input, context) => {
    const days = new Set<number>();

    for (const hour of input.hours) {
      if (days.has(hour.dayOfWeek)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each weekday can be configured only once.",
          path: ["hours"]
        });
        return;
      }

      days.add(hour.dayOfWeek);
    }
  });

export const createEmployeeTimeOffSchema = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    reason: z.string().trim().max(500).optional()
  })
  .refine((input) => new Date(input.endTime) > new Date(input.startTime), {
    message: "End time must be later than start time.",
    path: ["endTime"]
  });

export const createEmployeeScheduleOverrideSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    isClosed: z.boolean().default(false),
    reason: z.string().trim().max(500).optional()
  })
  .superRefine((input, context) => {
    if (input.endDate < input.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be later than or equal to start date.",
        path: ["endDate"]
      });
    }

    if (!input.isClosed) {
      if (!input.startTime || !input.endTime) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start and end time are required for working days.",
          path: ["startTime"]
        });
      } else if (input.endTime <= input.startTime) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End time must be later than start time.",
          path: ["endTime"]
        });
      }
    }
  });

export const createPortfolioPhotoSchema = z.object({
  employeeId: idStringSchema,
  imageUrl: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(1000).optional(),
  visible: z.boolean().default(true)
});

export const updatePortfolioPhotoSchema = createPortfolioPhotoSchema.partial();

export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  imageUrl: z.string().trim().max(1000).optional()
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

export const createProductBrandSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional()
});

export const updateProductBrandSchema = createProductBrandSchema.partial();

export const createProductComponentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(3000).optional()
});

export const updateProductComponentSchema = createProductComponentSchema.partial();

export const createProductSchema = z.object({
  categoryId: idStringSchema.optional().or(z.literal("")),
  category: z.string().trim().max(255).optional(),
  brandId: idStringSchema.optional().or(z.literal("")),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  quote: z.string().trim().max(1000).optional(),
  brand: z.string().trim().max(255).optional(),
  sku: z.string().trim().max(100).optional(),
  imageUrl: z.string().trim().max(1000).optional(),
  purpose: productPurposeSchema.optional(),
  purchase: z.coerce.number().nonnegative().optional(),
  sale: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int(),
  min: z.coerce.number().int().nonnegative(),
  popularityBoost: z.coerce.number().int().min(0).max(1000).optional(),
  contentAmount: z.coerce.number().positive().optional(),
  contentUnit: consumableUnitSchema.optional(),
  componentIds: z.array(idStringSchema).default([])
});

export const updateProductSchema = createProductSchema.partial().extend({
  componentIds: z.array(idStringSchema).optional()
});

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
  method: z.enum(["cash", "card", "blik", "transfer"]).optional(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  returnToStock: z.boolean().optional()
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

export const updateStoreOrderSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "completed", "cancelled"])
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
