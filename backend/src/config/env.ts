import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
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

if (env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_ID) {
  if (!process.env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || /dev-only|change[-_ ]|test-only|replace|example/i.test(env.AUTH_SECRET)) {
    throw new Error("Production requires a unique AUTH_SECRET of at least 32 characters.");
  }
  for (const value of [env.FRONTEND_ORIGIN, env.STOREFRONT_ORIGIN]) {
    for (const origin of value.split(",")) {
      const url = new URL(origin.trim());
      if (url.protocol !== "https:" || url.origin !== origin.trim() || /^(localhost|127\.|\[::1\])/.test(url.hostname)) {
        throw new Error("Production CORS origins must be explicit HTTPS origins.");
      }
    }
  }
}
