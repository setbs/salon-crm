import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { TextEncoder } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

const JWT_ISSUER = "salon-crm";
const STAFF_ACCESS_TOKEN_TTL = "12h";
const CLIENT_ACCESS_TOKEN_TTL = "30m";
const jwtSecret = new TextEncoder().encode(env.AUTH_SECRET);

export type AuthenticatedUser = {
  id: string;
  role: "ADMIN" | "EMPLOYEE" | "CLIENT";
  employeeId: string | null;
  name: string;
  email: string | null;
  credentialVersion?: string;
};

export type CrmAuthenticatedUser = AuthenticatedUser & {
  role: "ADMIN" | "EMPLOYEE";
};

const sessionPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["ADMIN", "EMPLOYEE", "CLIENT"]),
  employeeId: z.string().nullable(),
  name: z.string().min(1),
  email: z.string().email().nullable(),
  credentialVersion: z.string().length(64)
});

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, hash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expected.length, (error, key) => error ? reject(error) : resolve(key));
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function credentialVersion(passwordHash: string | null) {
  return createHash("sha256").update(passwordHash ?? "").digest("hex");
}

export async function createSessionToken(user: AuthenticatedUser, passwordHash: string | null = null) {
  const expiresIn = user.role === "CLIENT" ? CLIENT_ACCESS_TOKEN_TTL : STAFF_ACCESS_TOKEN_TTL;

  return new SignJWT({
    role: user.role,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    credentialVersion: credentialVersion(passwordHash)
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(jwtSecret);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, { issuer: JWT_ISSUER, algorithms: ["HS256"], requiredClaims: ["exp", "iat", "sub"] });
    const sessionPayload = sessionPayloadSchema.parse(payload);

    return {
      id: sessionPayload.sub,
      role: sessionPayload.role,
      employeeId: sessionPayload.employeeId,
      name: sessionPayload.name,
      email: sessionPayload.email,
      credentialVersion: sessionPayload.credentialVersion
    } satisfies AuthenticatedUser;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpError(401, "Invalid session. Please sign in again.");
    }

    throw new HttpError(401, "Session expired or invalid. Please sign in again.");
  }
}
