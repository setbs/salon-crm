import crypto from "node:crypto";
import { Prisma, StorePaymentStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

const MONOBANK_API_URL = "https://api.monobank.ua";
const UAH_CCY = 980;

const monobankCreateInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  pageUrl: z.string().url()
});

const monobankPublicKeySchema = z.object({
  key: z.string().min(1)
});

const monobankWebhookSchema = z.object({
  invoiceId: z.string().optional(),
  status: z.string(),
  failureReason: z.string().optional().nullable(),
  errCode: z.union([z.string(), z.number()]).optional().nullable(),
  amount: z.number().int().optional(),
  finalAmount: z.number().int().optional().nullable(),
  ccy: z.number().int().optional(),
  modifiedDate: z.string().optional(),
  reference: z.string().optional().nullable()
});

let cachedPublicKeyBase64: string | null = null;

export async function createMonobankPaymentForOrder(orderId: bigint) {
  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  if (!order) {
    throw new HttpError(404, "Order not found.");
  }

  if (order.paymentStatus === StorePaymentStatus.PAID) {
    return formatStorePaymentStatus(order);
  }

  if (order.status === "CANCELLED") {
    throw new HttpError(409, "Cannot pay a cancelled order.");
  }

  if (!env.MONOBANK_TOKEN) {
    const updated = await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: StorePaymentStatus.FAILED,
        paymentProvider: "monobank",
        paymentAmount: order.totalAmount,
        paymentFailureReason: "Monobank token is not configured."
      }
    });

    return formatStorePaymentStatus(updated);
  }

  try {
    const invoice = await createMonobankInvoice({
      orderId: order.id.toString(),
      customerEmail: order.email,
      totalAmount: order.totalAmount,
      items: order.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    });

    const updated = await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: StorePaymentStatus.PENDING,
        paymentProvider: "monobank",
        monobankInvoiceId: invoice.invoiceId,
        paymentPageUrl: invoice.pageUrl,
        paymentAmount: order.totalAmount,
        paymentCurrency: "UAH",
        paymentFailureReason: null
      }
    });

    return formatStorePaymentStatus(updated);
  } catch (error) {
    const updated = await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus: StorePaymentStatus.FAILED,
        paymentProvider: "monobank",
        paymentAmount: order.totalAmount,
        paymentFailureReason: error instanceof Error ? error.message : "Payment invoice could not be created."
      }
    });

    return formatStorePaymentStatus(updated);
  }
}

export async function getPublicStorePaymentStatus(orderId: bigint) {
  const order = await prisma.storeOrder.findUnique({ where: { id: orderId } });

  if (!order) {
    throw new HttpError(404, "Order not found.");
  }

  return formatStorePaymentStatus(order);
}

export async function handleMonobankWebhook(rawBody: Buffer, signature: string | undefined) {
  if (!env.MONOBANK_TOKEN) {
    throw new HttpError(503, "Monobank token is not configured.");
  }

  if (!signature) {
    throw new HttpError(401, "Missing Monobank webhook signature.");
  }

  const verified = (await verifyMonobankSignature(rawBody, signature)) || (await verifyMonobankSignature(rawBody, signature, true));

  if (!verified) {
    throw new HttpError(401, "Invalid Monobank webhook signature.");
  }

  const payload = monobankWebhookSchema.parse(JSON.parse(rawBody.toString("utf8")));
  const orderId = parseWebhookOrderId(payload.reference);
  const modifiedAt = payload.modifiedDate ? new Date(payload.modifiedDate) : new Date();
  const nextStatus = mapMonobankStatus(payload.status);
  const expectedAmount = payload.finalAmount ?? payload.amount;

  await prisma.$transaction(async (transaction) => {
    const orderByInvoice = payload.invoiceId ? await transaction.storeOrder.findFirst({ where: { monobankInvoiceId: payload.invoiceId } }) : null;
    const order = orderByInvoice ?? (orderId ? await transaction.storeOrder.findUnique({ where: { id: orderId } }) : null);

    if (!order) {
      return;
    }

    if (order.paymentModifiedAt && modifiedAt < order.paymentModifiedAt) {
      return;
    }

    const amountMatches = expectedAmount === undefined || moneyToMinorUnits(order.paymentAmount ?? order.totalAmount) === expectedAmount;
    const paymentStatus = amountMatches ? nextStatus : StorePaymentStatus.FAILED;
    const failureReason = amountMatches ? payload.failureReason ?? null : "Monobank payment amount does not match the order amount.";

    if (order.paymentStatus === StorePaymentStatus.PAID && paymentStatus !== StorePaymentStatus.REFUNDED && paymentStatus !== StorePaymentStatus.PAID) {
      return;
    }

    await transaction.storeOrder.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        paymentProvider: "monobank",
        monobankInvoiceId: orderByInvoice || !order.monobankInvoiceId ? payload.invoiceId ?? order.monobankInvoiceId : order.monobankInvoiceId,
        paymentAmount: order.paymentAmount ?? order.totalAmount,
        paymentCurrency: payload.ccy === UAH_CCY || !payload.ccy ? "UAH" : String(payload.ccy),
        paymentFailureReason: paymentStatus === StorePaymentStatus.FAILED ? failureReason : null,
        paidAt: paymentStatus === StorePaymentStatus.PAID ? order.paidAt ?? modifiedAt : order.paidAt,
        paymentModifiedAt: modifiedAt
      }
    });
  });

  return { ok: true };
}

function formatStorePaymentStatus(order: {
  id: bigint;
  status: string;
  paymentStatus: StorePaymentStatus;
  totalAmount: Prisma.Decimal;
  paymentPageUrl: string | null;
  paymentFailureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: order.id.toString(),
    status: order.status.toLowerCase(),
    paymentStatus: order.paymentStatus.toLowerCase(),
    totalAmount: Number(order.totalAmount),
    paymentUrl: order.paymentPageUrl,
    paymentError: order.paymentFailureReason,
    paidAt: order.paidAt?.toISOString() ?? null,
    canRetry: order.paymentStatus !== StorePaymentStatus.PAID,
    createdAt: order.createdAt.toISOString()
  };
}

async function createMonobankInvoice(input: {
  orderId: string;
  customerEmail: string | null;
  totalAmount: Prisma.Decimal;
  items: Array<{ name: string; quantity: number; unitPrice: Prisma.Decimal }>;
}) {
  const redirectUrl = buildFrontendUrl(`/order/payment-result?orderId=${encodeURIComponent(input.orderId)}`);
  const webHookUrl = buildWebhookUrl();
  const payload = {
    amount: moneyToMinorUnits(input.totalAmount),
    ccy: UAH_CCY,
    redirectUrl,
    ...(webHookUrl ? { webHookUrl } : {}),
    merchantPaymInfo: {
      reference: input.orderId,
      destination: `Оплата замовлення #${input.orderId}`,
      comment: `SL Color Studio order #${input.orderId}`,
      ...(input.customerEmail ? { customerEmails: [input.customerEmail] } : {}),
      basketOrder: input.items.map((item) => {
        const unitPrice = moneyToMinorUnits(item.unitPrice);

        return {
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
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Token": env.MONOBANK_TOKEN
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = getMonobankErrorMessage(body, response.status);
    throw new Error(message);
  }

  return monobankCreateInvoiceSchema.parse(body);
}

function buildWebhookUrl() {
  const backendUrl = env.BACKEND_PUBLIC_URL.trim().replace(/\/$/, "");

  if (!backendUrl || !backendUrl.toLowerCase().startsWith("https://")) {
    return undefined;
  }

  return `${backendUrl}/api/payments/monobank/webhook`;
}

function getMonobankErrorMessage(body: unknown, status: number) {
  const details = getMonobankErrorDetails(body);
  return details ? `Monobank invoice failed (${status}): ${details}` : `Monobank invoice failed (${status}).`;
}

function getMonobankErrorDetails(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const record = body as Record<string, unknown>;
  const candidates = ["errorDescription", "message", "error", "errText", "failureReason", "description"];

  for (const key of candidates) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const errCode = record.errCode;

  if (typeof errCode === "string" || typeof errCode === "number") {
    return `errCode ${errCode}`;
  }

  try {
    return JSON.stringify(body).slice(0, 400);
  } catch {
    return null;
  }
}

async function verifyMonobankSignature(rawBody: Buffer, xSignBase64: string, refreshKey = false) {
  const publicKeyBase64 = await getMonobankPublicKey(refreshKey);
  const verify = crypto.createVerify("SHA256");

  verify.write(rawBody);
  verify.end();

  return verify.verify(Buffer.from(publicKeyBase64, "base64"), Buffer.from(xSignBase64, "base64"));
}

async function getMonobankPublicKey(refresh = false) {
  if (cachedPublicKeyBase64 && !refresh) {
    return cachedPublicKeyBase64;
  }

  const response = await fetch(`${MONOBANK_API_URL}/api/merchant/pubkey`, {
    headers: { "X-Token": env.MONOBANK_TOKEN }
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new HttpError(502, `Could not load Monobank public key (${response.status}).`);
  }

  cachedPublicKeyBase64 = monobankPublicKeySchema.parse(body).key;
  return cachedPublicKeyBase64;
}

function moneyToMinorUnits(value: Prisma.Decimal) {
  return Number(value.mul(100).toFixed(0));
}

function buildFrontendUrl(path: string) {
  return `${env.FRONTEND_URL.replace(/\/$/, "")}${path}`;
}

function parseWebhookOrderId(reference: string | null | undefined) {
  return reference && /^\d+$/.test(reference) ? BigInt(reference) : null;
}

function mapMonobankStatus(status: string) {
  const normalized = status.toLowerCase();

  if (["success", "hold"].includes(normalized)) {
    return StorePaymentStatus.PAID;
  }

  if (["failure", "failed", "expired"].includes(normalized)) {
    return StorePaymentStatus.FAILED;
  }

  if (["reversed", "refund", "refunded"].includes(normalized)) {
    return StorePaymentStatus.REFUNDED;
  }

  return StorePaymentStatus.PENDING;
}
