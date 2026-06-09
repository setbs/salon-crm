import { Router } from "express";
import { getAuthenticatedUser, requireCrmUser } from "./auth.middleware.js";
import { loginSchema } from "./auth.schemas.js";
import { login } from "./auth.service.js";

export const authRouter = Router();

authRouter.post("/auth/login", async (request, response, next) => {
  try {
    const body = loginSchema.parse(request.body);
    response.json({ data: await login(body) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/auth/me", requireCrmUser, (request, response, next) => {
  try {
    response.json({ data: getAuthenticatedUser(request) });
  } catch (error) {
    next(error);
  }
});
