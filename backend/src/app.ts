import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { z } from "zod";
import { env } from "./config/env.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { bookingRouter } from "./modules/booking/booking.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { HttpError } from "./utils/http-error.js";

export const app = express();

const allowedOrigins = parseAllowedOrigins(env.FRONTEND_ORIGIN, env.STOREFRONT_ORIGIN);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isLocalViteOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "public/uploads")));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", catalogRouter);
app.use("/api", bookingRouter);
app.use("/api", authRouter);
app.use("/api", adminRouter);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    const details = formatZodValidationDetails(error);
    response.status(400).json({
      message: details.length > 0 ? `Validation failed: ${details.join(" ")}` : "Validation failed.",
      details,
      issues: error.flatten()
    });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Internal server error." });
});

function formatZodValidationDetails(error: z.ZodError) {
  return error.issues.map((issue) => {
    const field = formatValidationPath(issue.path);

    return field ? `${field}: ${issue.message}.` : `${issue.message}.`;
  });
}

function formatValidationPath(path: Array<string | number>) {
  if (path.length === 0) {
    return "";
  }

  return path
    .map((part) =>
      String(part)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
    )
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseAllowedOrigins(...origins: string[]) {
  return new Set(
    origins.flatMap((origin) =>
      origin
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function isLocalViteOrigin(origin: string) {
  try {
    const url = new URL(origin);

    return url.protocol === "http:" && /^51\d{2}$/.test(url.port) && isLocalDevelopmentHost(url.hostname);
  } catch {
    return false;
  }
}

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || isPrivateNetworkHost(hostname);
}

function isPrivateNetworkHost(hostname: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const [first, second, third, fourth] = hostname.split(".").map(Number);

  if ([first, second, third, fourth].some((part) => part < 0 || part > 255)) {
    return false;
  }

  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
