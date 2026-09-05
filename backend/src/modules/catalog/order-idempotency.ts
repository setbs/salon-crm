import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { HttpError } from "../../utils/http-error.js";
import type { StoreOrderInput } from "./catalog.repository.js";

export function orderIdempotency(key: string | undefined, input: StoreOrderInput) {
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new HttpError(400, "A 256-bit Idempotency-Key is required.");
  const normalized = {
    customer: { firstName: input.customer.firstName.trim(), lastName: input.customer.lastName.trim(),
      phone: input.customer.phone.trim(), email: input.customer.email?.trim() || null },
    deliveryMethod: input.deliveryMethod,
    deliveryAddress: input.deliveryMethod === "delivery" ? input.deliveryAddress?.trim() || null : null,
    comment: input.comment?.trim() || null,
    items: input.items.map((item) => ({ productId: BigInt(item.productId).toString(), quantity: item.quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId))
  };
  return { key, keyHash: digest(key), requestHash: digest(JSON.stringify(normalized)) };
}

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function encryptionKey(key: string) { return createHash("sha256").update("order-response-v1:" + key).digest(); }

// The random client key is never persisted. Bind ciphertext to the normalized request.
export function encryptOrderToken(token: string, key: string, requestHash: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(requestHash));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptOrderToken(encrypted: string, key: string, requestHash: string) {
  const bytes = Buffer.from(encrypted, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(key), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(requestHash));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
