import { z } from "zod";

export const storeReviewSchema = z.object({
  authorName: z.string().trim().min(2).max(100),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(1200),
  website: z.string().max(0).optional()
});

export const storeOrderSchema = z.object({
  customer: z.object({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email().max(255).optional().or(z.literal(""))
  }),
  deliveryMethod: z.enum(["pickup", "delivery"]),
  deliveryAddress: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(1000).optional(),
  items: z.array(z.object({ productId: z.string().regex(/^\d+$/), quantity: z.number().int().min(1).max(99) })).min(1).max(50)
}).superRefine((value, context) => {
  if (value.deliveryMethod === "delivery" && (!value.deliveryAddress || value.deliveryAddress.length < 5)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryAddress"], message: "Delivery address is required" });
  }
  if (new Set(value.items.map((item) => item.productId)).size !== value.items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Products must be unique" });
  }
});
