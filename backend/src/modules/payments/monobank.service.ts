import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { assertOrderToken } from "../catalog/order-access.js";
import { consumeReservation, expireReservation, lockOrder, orderEvent, releaseReservation, reserveOrder } from "../catalog/order-lifecycle.js";

const MONOBANK_API_URL = "https://api.monobank.ua";
const UAH_CCY = 980;
const CHECK_INTERVAL_MS = 60_000;
const ACTIVE = ["CREATING", "PENDING", "UNKNOWN"] as const;
const monobankCreateInvoiceSchema = z.object({ invoiceId: z.string().min(1).max(100), pageUrl: z.string().url().max(1000) });
const monobankPublicKeySchema = z.object({ key: z.string().min(1) });
const monobankWebhookSchema = z.object({
  invoiceId: z.string().min(1).max(100), status: z.string(),
  amount: z.number().int().optional(), finalAmount: z.number().int().nullable().optional(),
  ccy: z.number().int().optional(), modifiedDate: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  reference: z.string().nullable().optional()
});
type BankEvent = z.infer<typeof monobankWebhookSchema>;
let cachedPublicKeyBase64: string | null = null;
let lastPublicKeyFetch = 0;

class InvoiceRejected extends Error {}

export async function createMonobankPaymentForOrder(orderId: bigint, accessToken?: string) {
  const plan = await prisma.$transaction(async (tx) => {
    let order = await lockOrder(tx, orderId);
    assertOrderToken(order.accessTokenHash, accessToken);
    if (order.status === "CANCELLED" || ["PAID", "REFUNDED"].includes(order.paymentStatus)) {
      throw new HttpError(409, "Order cannot be paid in its current state.");
    }
    if (await expireReservation(tx, order)) return null;
    if (order.requiresReview || order.reservationState === "LEGACY") throw new HttpError(409, "Order requires manual review.");
    const attempts = await tx.paymentAttempt.findMany({ where: { orderId }, orderBy: { attemptNumber: "desc" } });
    const active = attempts.find((attempt) => ACTIVE.includes(attempt.status as typeof ACTIVE[number]));
    if (active) {
      if (active.status === "CREATING" && Date.now() - active.createdAt.getTime() > 30_000) {
        await tx.paymentAttempt.update({ where: { id: active.id }, data: { status: "UNKNOWN", failureReason: "CREATE_RESULT_UNKNOWN" } });
        await orderEvent(tx, orderId, "reconciliation_required", { attemptId: active.id, reason: "CREATE_RESULT_UNKNOWN" });
      }
      return null;
    }
    if (attempts.length >= 5) throw new HttpError(409, "Payment attempt limit reached. Contact the salon.");
    if (order.reservationState === "RELEASED") {
      if (!attempts.length || !["FAILED", "EXPIRED"].includes(attempts[0].status)) throw new HttpError(409, "Order has no valid reservation.");
      await reserveOrder(tx, order);
      order = await lockOrder(tx, orderId);
    }
    if (order.reservationState !== "ACTIVE") throw new HttpError(409, "Order has no valid reservation.");
    const id = crypto.randomUUID();
    const attempt = await tx.paymentAttempt.create({ data: {
      id, orderId, attemptNumber: (attempts[0]?.attemptNumber ?? 0) + 1, reference: id,
      amount: order.totalAmount, lastCheckedAt: new Date()
    } });
    await tx.storeOrder.update({ where: { id: orderId }, data: { paymentStatus: "PENDING", paymentPageUrl: null, paymentFailureReason: null } });
    await orderEvent(tx, orderId, "payment_attempt_created", { attemptId: id });
    return { order, attempt };
  });
  if (!plan) return readPaymentStatus(orderId);

  // Commit the unique active attempt before contacting the provider.
  let invoice: z.infer<typeof monobankCreateInvoiceSchema>;
  try {
    if (!env.MONOBANK_TOKEN) throw new InvoiceRejected("PAYMENT_NOT_CONFIGURED");
    invoice = await createMonobankInvoice({
      orderId: String(orderId), reference: plan.attempt.reference, customerEmail: plan.order.email,
      totalAmount: plan.attempt.amount, validity: Math.max(1, Math.floor((plan.order.reservationExpiresAt!.getTime() - Date.now()) / 1000)),
      items: plan.order.items.map((item) => ({ code: String(item.productId), name: item.productName, quantity: item.quantity, unitPrice: item.unitPrice }))
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: plan.attempt.id } });
      if (!["CREATING", "UNKNOWN"].includes(attempt.status) || attempt.providerInvoiceId) return;
      const rejected = error instanceof InvoiceRejected;
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: {
        status: rejected ? "FAILED" : "UNKNOWN", failureReason: rejected ? "CREATE_REJECTED" : "CREATE_RESULT_UNKNOWN"
      } });
      if (rejected) {
        await releaseReservation(tx, order, "invoice_rejected");
        await tx.storeOrder.update({ where: { id: orderId }, data: { paymentStatus: "FAILED", paymentFailureReason: "Payment provider rejected invoice creation." } });
      }
      await orderEvent(tx, orderId, rejected ? "payment_attempt_failed" : "reconciliation_required", { attemptId: attempt.id });
    });
    return readPaymentStatus(orderId);
  }
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: plan.attempt.id } });
    if (attempt.providerInvoiceId && attempt.providerInvoiceId !== invoice.invoiceId) throw new HttpError(409, "Invoice binding conflict.");
    if (!["CREATING", "UNKNOWN"].includes(attempt.status)) return;
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: {
      providerInvoiceId: invoice.invoiceId, paymentUrl: invoice.pageUrl, status: "PENDING", lastCheckedAt: new Date()
    } });
    await tx.storeOrder.update({ where: { id: orderId }, data: {
      monobankInvoiceId: invoice.invoiceId, paymentProvider: "monobank", paymentAmount: attempt.amount,
      paymentPageUrl: order.status !== "CANCELLED" && order.reservationState === "ACTIVE" && !order.requiresReview ? invoice.pageUrl : null
    } });
    await orderEvent(tx, orderId, "payment_invoice_bound", { attemptId: attempt.id });
  });
  return readPaymentStatus(orderId);
}

export async function getPublicStorePaymentStatus(orderId: bigint) {
  await reconcileOrderPayments(orderId);
  await prisma.$transaction(async (tx) => { await expireReservation(tx, await lockOrder(tx, orderId)); });
  return readPaymentStatus(orderId);
}

async function readPaymentStatus(orderId: bigint) {
  const order = await prisma.storeOrder.findUnique({ where: { id: orderId }, include: { paymentAttempts: { orderBy: { attemptNumber: "desc" } } } });
  if (!order) throw new HttpError(404, "Order not found.");
  const active = order.paymentAttempts.find((attempt) => ACTIVE.includes(attempt.status as typeof ACTIVE[number]));
  const uncertain = active?.status === "UNKNOWN";
  const blocked = order.requiresReview || order.status === "CANCELLED" || ["PAID", "REFUNDED"].includes(order.paymentStatus);
  return {
    id: String(order.id), status: order.status.toLowerCase(), paymentStatus: order.paymentStatus.toLowerCase(),
    totalAmount: Number(order.totalAmount),
    paymentUrl: !blocked && order.reservationState === "ACTIVE" && active?.status === "PENDING" ? active.paymentUrl : null,
    paymentError: order.requiresReview || uncertain ? "Payment requires verification by the salon. Do not pay again." : order.paymentFailureReason,
    paidAt: order.paidAt?.toISOString() ?? null, createdAt: order.createdAt.toISOString(),
    canRetry: !blocked && !active && order.reservationState !== "LEGACY" && order.paymentAttempts.length < 5,
    requiresReview: order.requiresReview || uncertain, paymentAttemptStatus: active?.status.toLowerCase() ?? null,
    reservationState: order.reservationState.toLowerCase()
  };
}

export async function handleMonobankWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!env.MONOBANK_TOKEN) throw new HttpError(503, "Monobank token is not configured.");
  if (!signature) throw new HttpError(401, "Missing Monobank webhook signature.");
  const verified = (await verifyMonobankSignature(rawBody, signature)) || (await verifyMonobankSignature(rawBody, signature, true));
  if (!verified) throw new HttpError(401, "Invalid Monobank webhook signature.");
  await applyBankEvent(monobankWebhookSchema.parse(JSON.parse(rawBody.toString("utf8"))));
  return { ok: true };
}

async function applyBankEvent(payload: BankEvent) {
  const found = await prisma.paymentAttempt.findUnique({ where: { providerInvoiceId: payload.invoiceId } });
  if (!found) return; // Never use an unbound reference as authority.
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, found.orderId);
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: found.id } });
    const modifiedAt = new Date(payload.modifiedDate);
    if (attempt.providerModifiedAt && modifiedAt <= attempt.providerModifiedAt) return;
    const status = bankStatus(payload.status);
    if (!status || attempt.status === "REFUNDED" || (attempt.status === "PAID" && !["PAID", "REFUNDED"].includes(status))) return;
    if (["FAILED", "EXPIRED"].includes(attempt.status) && !["PAID", "REFUNDED"].includes(status)) return;
    const amountMatches = payload.ccy === UAH_CCY && payload.amount === moneyToMinorUnits(attempt.amount) &&
      (status !== "PAID" || (payload.finalAmount ?? payload.amount) === moneyToMinorUnits(attempt.amount)) &&
      (status !== "REFUNDED" || !payload.finalAmount);
    if (!amountMatches || (payload.reference && payload.reference !== attempt.reference)) {
      await tx.storeOrder.update({ where: { id: order.id }, data: { requiresReview: true, reviewReason: "PAYMENT_MISMATCH", paymentPageUrl: null } });
      await orderEvent(tx, order.id, "payment_mismatch", { attemptId: attempt.id });
      return;
    }
    // A late success for an older attempt may coexist with a newer invoice. Keep both histories.
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: {
      status, providerModifiedAt: modifiedAt, failureReason: status === "FAILED" ? "PROVIDER_FAILURE" : null
    } });
    if (status === "PAID") {
      if (order.settledAttemptId === attempt.id) return;
      const otherActive = await tx.paymentAttempt.count({ where: { orderId: order.id, id: { not: attempt.id }, status: { in: [...ACTIVE] } } });
      const exceptional = !!order.settledAttemptId || order.paymentStatus === "REFUNDED" || order.status === "CANCELLED" ||
        order.reservationState !== "ACTIVE" || !order.reservationExpiresAt || order.reservationExpiresAt <= new Date();
      if (!exceptional) await consumeReservation(tx, order);
      else await releaseReservation(tx, order, "late_success");
      const reason = order.settledAttemptId ? "MULTIPLE_PAYMENTS" : exceptional ? "LATE_OR_LEGACY_SUCCESS" : "OLDER_ATTEMPT_PAID";
      await tx.storeOrder.update({ where: { id: order.id }, data: {
        paymentStatus: order.paymentStatus === "REFUNDED" ? "REFUNDED" : "PAID",
        settledAttemptId: order.settledAttemptId ?? attempt.id, paidAt: order.paidAt ?? modifiedAt,
        paymentPageUrl: null, paymentModifiedAt: modifiedAt,
        ...((exceptional || otherActive) ? { requiresReview: true, reviewReason: reason } : {})
      } });
      await orderEvent(tx, order.id, exceptional || otherActive ? "late_success" : "payment_success", { attemptId: attempt.id, reason: exceptional || otherActive ? reason : "NORMAL" });
    } else if (status === "REFUNDED") {
      if (!order.settledAttemptId || order.settledAttemptId === attempt.id) {
        await releaseReservation(tx, order, "refund");
        await tx.storeOrder.update({ where: { id: order.id }, data: {
          paymentStatus: "REFUNDED", paymentPageUrl: null, paymentModifiedAt: modifiedAt,
          settledAttemptId: order.settledAttemptId ?? attempt.id
        } });
      }
      await orderEvent(tx, order.id, "payment_refunded", { attemptId: attempt.id });
    } else if (status === "FAILED" || status === "EXPIRED") {
      const otherActive = await tx.paymentAttempt.count({ where: { orderId: order.id, status: { in: [...ACTIVE] } } });
      if (!otherActive && !["PAID", "REFUNDED"].includes(order.paymentStatus)) {
        await releaseReservation(tx, order, status.toLowerCase());
        await tx.storeOrder.update({ where: { id: order.id }, data: {
          paymentStatus: "FAILED", paymentFailureReason: "Payment was not completed.", paymentPageUrl: null
        } });
      }
      await orderEvent(tx, order.id, "payment_attempt_failed", { attemptId: attempt.id, status });
    }
  });
}

export async function reconcileOrderPayments(orderId: bigint) {
  await prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    await tx.paymentAttempt.updateMany({ where: { orderId, providerInvoiceId: null }, data: { lastCheckedAt: new Date() } });
    const stale = await tx.paymentAttempt.findMany({ where: { orderId, status: "CREATING", createdAt: { lt: new Date(Date.now() - 30_000) } } });
    for (const attempt of stale) {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", failureReason: "CREATE_RESULT_UNKNOWN" } });
      await orderEvent(tx, orderId, "reconciliation_required", { attemptId: attempt.id });
    }
  });
  if (!env.MONOBANK_TOKEN) return;
  const attempts = await prisma.paymentAttempt.findMany({ where: { orderId, providerInvoiceId: { not: null }, status: { not: "REFUNDED" } }, take: 5, orderBy: { attemptNumber: "desc" } });
  for (const attempt of attempts) {
    const claimed = await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, OR: [
      { lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - CHECK_INTERVAL_MS) } }
    ] }, data: { lastCheckedAt: new Date() } });
    if (!claimed.count) continue;
    try {
      const payload = await fetchInvoiceStatus(attempt.providerInvoiceId!);
      if (payload.invoiceId !== attempt.providerInvoiceId) throw new Error("Invoice mismatch");
      await applyBankEvent(payload);
    } catch {
      await prisma.$transaction(async (tx) => { await orderEvent(tx, orderId, "reconciliation_required", { attemptId: attempt.id, reason: "STATUS_UNAVAILABLE" }); });
    }
  }
}

// Operator-only recovery: invoice ID must be independently obtained from the bank.
export async function recoverUnknownAttempt(attemptId: string, invoiceId: string) {
  const payload = await fetchInvoiceStatus(invoiceId);
  await prisma.$transaction(async (tx) => {
    const found = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    await lockOrder(tx, found.orderId);
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (payload.invoiceId !== invoiceId || payload.reference !== attempt.reference || payload.ccy !== UAH_CCY ||
      payload.amount !== moneyToMinorUnits(attempt.amount) || attempt.providerInvoiceId ||
      !["CREATING", "UNKNOWN"].includes(attempt.status)) throw new HttpError(409, "Invoice recovery verification failed.");
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { providerInvoiceId: invoiceId, lastCheckedAt: new Date() } });
    await orderEvent(tx, attempt.orderId, "payment_invoice_recovered", { attemptId });
  });
  await applyBankEvent(payload);
}

async function fetchInvoiceStatus(invoiceId: string) {
  const response = await fetch(`${MONOBANK_API_URL}/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, {
    signal: AbortSignal.timeout(5_000), headers: { "X-Token": env.MONOBANK_TOKEN }
  });
  if (!response.ok) throw new Error("Invoice status unavailable");
  return monobankWebhookSchema.parse(await response.json());
}

function bankStatus(status: string) {
  if (status === "success") return "PAID";
  if (status === "failure" || status === "failed") return "FAILED";
  if (status === "expired") return "EXPIRED";
  if (["reversed", "refund", "refunded"].includes(status)) return "REFUNDED";
  if (["created", "processing", "hold"].includes(status)) return "PENDING";
  return null;
}

async function createMonobankInvoice(input: {
  orderId: string;
  reference: string;
  validity: number;
  customerEmail: string | null;
  totalAmount: Prisma.Decimal;
  items: Array<{ code: string; name: string; quantity: number; unitPrice: Prisma.Decimal }>;
}) {
  const redirectUrl = buildFrontendUrl(`/order/payment-result?orderId=${encodeURIComponent(input.orderId)}`);
  const webHookUrl = buildWebhookUrl();
  const payload = {
    amount: moneyToMinorUnits(input.totalAmount),
    ccy: UAH_CCY,
    validity: input.validity,
    redirectUrl,
    ...(webHookUrl ? { webHookUrl } : {}),
    merchantPaymInfo: {
      reference: input.reference,
      destination: `Оплата замовлення #${input.orderId}`,
      comment: `SL Color Studio order #${input.orderId}`,
      ...(input.customerEmail ? { customerEmails: [input.customerEmail] } : {}),
      basketOrder: input.items.map((item) => {
        const unitPrice = moneyToMinorUnits(item.unitPrice);

        return {
          code: item.code,
          name: item.name.slice(0, 128),
          qty: item.quantity,
          sum: unitPrice,
          total: unitPrice * item.quantity,
          unit: "шт."
        };
      })
    }
  };

  const response = await fetch(`${MONOBANK_API_URL}/api/merchant/invoice/create`, {
    signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Token": env.MONOBANK_TOKEN
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if ([400, 403, 404, 405, 422].includes(response.status)) throw new InvoiceRejected("CREATE_REJECTED");
    throw new Error("CREATE_RESULT_UNKNOWN");
  }

  return monobankCreateInvoiceSchema.parse(body);
}

function buildWebhookUrl() {
  const backendUrl = normalizePublicUrl(env.BACKEND_PUBLIC_URL);

  if (!backendUrl || !backendUrl.toLowerCase().startsWith("https://")) {
    return undefined;
  }

  return `${backendUrl}/api/payments/monobank/webhook`;
}

async function verifyMonobankSignature(rawBody: Buffer, xSignBase64: string, refreshKey = false) {
  const publicKeyBase64 = await getMonobankPublicKey(refreshKey);
  const verify = crypto.createVerify("SHA256");

  verify.write(rawBody);
  verify.end();

  return verify.verify(Buffer.from(publicKeyBase64, "base64"), Buffer.from(xSignBase64, "base64"));
}

async function getMonobankPublicKey(refresh = false) {
  if (cachedPublicKeyBase64 && (!refresh || Date.now() - lastPublicKeyFetch < 60_000)) {
    return cachedPublicKeyBase64;
  }

  const response = await fetch(`${MONOBANK_API_URL}/api/merchant/pubkey`, {
    signal: AbortSignal.timeout(5_000),
    headers: { "X-Token": env.MONOBANK_TOKEN }
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(502, `Could not load Monobank public key (${response.status}).`);
  }

  cachedPublicKeyBase64 = monobankPublicKeySchema.parse(body).key;
  lastPublicKeyFetch = Date.now();
  return cachedPublicKeyBase64;
}

function moneyToMinorUnits(value: Prisma.Decimal) {
  return Number(value.mul(100).toFixed(0));
}

function buildFrontendUrl(path: string) {
  const frontendUrl = normalizePublicUrl(env.STOREFRONT_ORIGIN) || normalizePublicUrl(env.FRONTEND_URL);

  if (!frontendUrl) {
    throw new Error("Storefront redirect URL is not configured. Set STOREFRONT_ORIGIN.");
  }

  return `${frontendUrl}${path}`;
}

function normalizePublicUrl(value: string) {
  const url = value.split(",")[0]?.trim().replace(/\/$/, "") ?? "";

  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (/^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?/i.test(url)) {
    return `http://${url}`;
  }

  return `https://${url}`;
}
