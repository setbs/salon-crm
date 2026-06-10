import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { createSessionToken, type AuthenticatedUser, verifyPassword } from "./auth.crypto.js";
import type { loginSchema } from "./auth.schemas.js";
import type { z } from "zod";

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { employeeProfile: true }
  });

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new HttpError(401, "Invalid email or password.");
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.EMPLOYEE) {
    throw new HttpError(403, "You do not have access to CRM.");
  }

  if (user.role === UserRole.EMPLOYEE && !user.employeeProfile) {
    throw new HttpError(403, "Employee profile is not configured.");
  }

  const sessionUser: AuthenticatedUser = {
    id: user.id.toString(),
    role: user.role,
    employeeId: user.employeeProfile?.id.toString() ?? null,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email
  };

  return {
    token: createSessionToken(sessionUser),
    user: sessionUser
  };
}
