import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  STOREFRONT_ORIGIN: z.string().default("http://localhost:5174"),
  FRONTEND_URL: z.string().default("http://localhost:5174"),
  BACKEND_PUBLIC_URL: z.string().default(""),
  MONOBANK_TOKEN: z.string().default(""),
  AUTH_SECRET: z.string().min(24).default("dev-only-salon-crm-auth-secret-change-me")
});

export const env = envSchema.parse(process.env);
