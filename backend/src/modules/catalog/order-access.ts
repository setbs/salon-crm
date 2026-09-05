import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

export function createOrderAccess() {
  const accessToken = randomBytes(32).toString("hex");
  return { accessToken, accessTokenHash: hashOrderAccessToken(accessToken).toString("hex") };
}

function hashOrderAccessToken(token: string) {
  return createHash("sha256").update(token).digest();
}

export async function requireOrderAccess(idValue: string, token?: string) {
  if (!/^[1-9]\d{0,18}$/.test(idValue) || BigInt(idValue) > 9223372036854775807n) {
    throw new HttpError(404, "Order not found.");
  }
  const id = BigInt(idValue);
  const order = await prisma.storeOrder.findUnique({ where: { id }, select: { accessTokenHash: true } });
  assertOrderToken(order?.accessTokenHash, token);
  return id;
}

export function assertOrderToken(storedHash: string | null | undefined, token?: string) {
  const validToken = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  // Compare fixed-size digests even for nonexistent and legacy orders.
  const expected = storedHash && /^[a-f0-9]{64}$/.test(storedHash)
    ? Buffer.from(storedHash, "hex") : Buffer.alloc(32);
  const matches = timingSafeEqual(hashOrderAccessToken(validToken ? token : ""), expected);
  if (!validToken || !storedHash || !matches) {
    throw new HttpError(404, "Order not found.");
  }
}
