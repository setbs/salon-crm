import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
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

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api", catalogRouter);
app.use("/api", bookingRouter);
app.use("/api", authRouter);
app.use("/api", adminRouter);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ message: "Validation failed.", issues: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Internal server error." });
});
