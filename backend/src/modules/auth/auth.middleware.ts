import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../utils/http-error.js";
import { type AuthenticatedUser, type CrmAuthenticatedUser, verifySessionToken } from "./auth.crypto.js";

type AuthenticatedRequest = Request & {
  user?: CrmAuthenticatedUser;
};

export async function requireCrmUser(request: Request, _response: Response, next: NextFunction) {
  try {
    const header = request.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

    if (!token) {
      throw new HttpError(401, "Sign in to CRM.");
    }

    const user = await verifySessionToken(token);

    if (!isCrmAuthenticatedUser(user)) {
      throw new HttpError(403, "You do not have access to CRM.");
    }

    (request as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function getAuthenticatedUser(request: Request) {
  const user = (request as AuthenticatedRequest).user;

  if (!user) {
    throw new HttpError(401, "Sign in to CRM.");
  }

  return user;
}

export function assertAdmin(user: CrmAuthenticatedUser) {
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "This action is available only to the main admin.");
  }
}

function isCrmAuthenticatedUser(user: AuthenticatedUser): user is CrmAuthenticatedUser {
  return user.role === "ADMIN" || user.role === "EMPLOYEE";
}
