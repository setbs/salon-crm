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

app.use(cors({ origin: env.FRONTEND_ORIGIN }));
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
