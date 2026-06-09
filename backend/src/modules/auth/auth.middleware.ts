import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../utils/http-error.js";
import { type AuthenticatedUser, verifySessionToken } from "./auth.crypto.js";

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export function requireCrmUser(request: Request, _response: Response, next: NextFunction) {
  try {
    const header = request.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

    if (!token) {
      throw new HttpError(401, "Увійдіть у CRM.");
    }

    (request as AuthenticatedRequest).user = verifySessionToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUser(request: Request) {
  const user = (request as AuthenticatedRequest).user;

  if (!user) {
    throw new HttpError(401, "Увійдіть у CRM.");
  }

  return user;
}

export function assertAdmin(user: AuthenticatedUser) {
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Ця дія доступна тільки головному адміну.");
  }
}
