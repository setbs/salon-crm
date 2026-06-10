import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

export type AuthenticatedUser = {
  id: string;
  role: "ADMIN" | "EMPLOYEE";
  employeeId: string | null;
  name: string;
  email: string | null;
};

type SessionPayload = AuthenticatedUser & {
  exp: number;
};

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, hash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(user: AuthenticatedUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    throw new HttpError(401, "Invalid session. Please sign in again.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }

  if (payload.role !== "ADMIN" && payload.role !== "EMPLOYEE") {
    throw new HttpError(403, "You do not have access to CRM.");
  }

  return {
    id: payload.id,
    role: payload.role,
    employeeId: payload.employeeId,
    name: payload.name,
    email: payload.email
  } satisfies AuthenticatedUser;
}

function sign(value: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("base64url");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
