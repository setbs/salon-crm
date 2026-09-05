import { Prisma, StoreOrderStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

type Tx = Prisma.TransactionClient;
export const RESERVATION_TTL_MS = 30 * 60_000;
export const orderWithItems = { items: { orderBy: { productId: "asc" as const } } };
export type OrderWithItems = Prisma.StoreOrderGetPayload<{ include: typeof orderWithItems }>;

export async function lockOrder(tx: Tx, id: bigint) {
  await tx.$queryRaw`SELECT id FROM store_orders WHERE id = ${id} FOR UPDATE`;
  const order = await tx.storeOrder.findUnique({ where: { id }, include: orderWithItems });
  if (!order) throw new HttpError(404, "Order not found.");
  return order;
}

export async function orderEvent(tx: Tx, orderId: bigint, eventType: string, details?: Prisma.InputJsonObject) {
  await tx.orderLifecycleEvent.create({ data: { orderId, eventType, details } });
}

export async function reserveOrder(tx: Tx, order: OrderWithItems) {
  if (order.reservationState === "ACTIVE" || order.reservationState === "CONSUMED") return;
  for (const item of order.items) {
    if (item.quantity <= 0) throw new HttpError(409, "Invalid order quantity.");
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${item.productId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: item.productId } });
    if (!product?.isActive || !["SALE", "BOTH"].includes(product.productPurpose)) throw new HttpError(409, "Product unavailable.");
    const content = product.contentAmount && product.stockContentAmount !== null ? product.contentAmount.mul(item.quantity) : null;
    const updated = await tx.product.updateMany({
      where: { id: item.productId, stockQuantity: { gte: item.quantity },
        ...(content ? { stockContentAmount: { gte: content } } : {}) },
      data: { stockQuantity: { decrement: item.quantity }, ...(content ? { stockContentAmount: { decrement: content } } : {}) }
    });
    if (updated.count !== 1) throw new HttpError(409, "Not enough available stock.");
    await tx.storeOrderItem.update({ where: { id: item.id }, data: { reservedContentQuantity: content } });
    await tx.stockMovement.create({ data: { productId: item.productId, movementType: "ADJUSTMENT",
      quantity: -item.quantity, contentQuantity: content?.negated(), reason: `Reservation for store order #${order.id}` } });
  }
  await tx.storeOrder.update({ where: { id: order.id }, data: {
    reservationState: "ACTIVE", reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS)
  } });
  await orderEvent(tx, order.id, "reservation_created");
}

export async function releaseReservation(tx: Tx, order: OrderWithItems, reason: string) {
  if (order.reservationState !== "ACTIVE" || order.paymentStatus === "PAID") return;
  for (const item of order.items) {
    await tx.product.update({ where: { id: item.productId }, data: {
      stockQuantity: { increment: item.quantity },
      ...(item.reservedContentQuantity ? { stockContentAmount: { increment: item.reservedContentQuantity } } : {})
    } });
    await tx.stockMovement.create({ data: { productId: item.productId, movementType: "ADJUSTMENT",
      quantity: item.quantity, contentQuantity: item.reservedContentQuantity,
      reason: `Released reservation for store order #${order.id}: ${reason}` } });
  }
  await tx.storeOrder.update({ where: { id: order.id }, data: { reservationState: "RELEASED", paymentPageUrl: null } });
  await orderEvent(tx, order.id, "reservation_released", { reason });
}

export async function consumeReservation(tx: Tx, order: OrderWithItems) {
  if (order.stockDeductedAt || order.reservationState === "CONSUMED") return;
  if (order.reservationState !== "ACTIVE") throw new HttpError(409, "Order has no reservation.");
  // Available stock was already reduced on reservation; conversion has zero inventory delta.
  for (const item of order.items) await tx.stockMovement.create({ data: {
    productId: item.productId, movementType: "SALE", quantity: 0,
    reason: `Reservation converted to sale for store order #${order.id}: ${item.quantity} units`
  } });
  await tx.storeOrder.update({ where: { id: order.id }, data: {
    reservationState: "CONSUMED", stockDeductedAt: new Date()
  } });
}

export async function expireReservation(tx: Tx, order: OrderWithItems) {
  if (order.reservationState !== "ACTIVE" || !order.reservationExpiresAt ||
      order.reservationExpiresAt > new Date() || order.paymentStatus === "PAID") return false;
  await releaseReservation(tx, order, "expired");
  await tx.storeOrder.update({ where: { id: order.id }, data: { status: "CANCELLED", paymentPageUrl: null } });
  await orderEvent(tx, order.id, "order_expired");
  return true;
}

export async function expireReservations(limit = 50) {
  const orders = await prisma.storeOrder.findMany({ where: {
    reservationState: "ACTIVE", reservationExpiresAt: { lte: new Date() }, paymentStatus: { not: "PAID" }
  }, orderBy: { reservationExpiresAt: "asc" }, take: limit, select: { id: true } });
  let released = 0;
  for (const order of orders) {
    if (await prisma.$transaction(async (tx) => expireReservation(tx, await lockOrder(tx, order.id)))) released++;
  }
  return released;
}

export async function changeStoreOrderStatus(id: bigint, target: StoreOrderStatus) {
  return prisma.$transaction(async (tx) => {
    let order = await lockOrder(tx, id);
    if (order.status === target) return order;
    const allowed: Record<StoreOrderStatus, StoreOrderStatus[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["SHIPPED", "CANCELLED"], SHIPPED: ["COMPLETED"], COMPLETED: [], CANCELLED: []
    };
    if (!allowed[order.status].includes(target)) throw new HttpError(409, "Invalid order transition.");
    if (order.requiresReview) throw new HttpError(409, "Order requires payment review.");
    if (target === "CANCELLED") {
      if (order.paymentStatus === "PAID") throw new HttpError(409, "Refund the payment before cancelling a paid order.");
      await releaseReservation(tx, order, "admin_cancel");
      if (order.stockDeductedAt && !order.stockRestoredAt) {
        for (const item of order.items) {
          const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
          const content = order.reservationState === "LEGACY" ? product.contentAmount?.mul(item.quantity) : item.reservedContentQuantity;
          await tx.product.update({ where: { id: item.productId }, data: {
            stockQuantity: { increment: item.quantity }, ...(content ? { stockContentAmount: { increment: content } } : {})
          } });
          await tx.stockMovement.create({ data: { productId: item.productId, movementType: "RETURN",
            quantity: item.quantity, contentQuantity: content, reason: `Cancelled store order #${id}` } });
        }
        await tx.storeOrder.update({ where: { id }, data: { stockRestoredAt: new Date() } });
      }
    } else {
      if (order.paymentStatus !== "PAID") throw new HttpError(409, "Order must be paid before fulfillment.");
      if (!order.stockDeductedAt) {
        if (order.reservationState === "LEGACY") await reserveOrder(tx, order);
        order = await lockOrder(tx, id);
        await consumeReservation(tx, order);
      }
    }
    await orderEvent(tx, id, target === "CANCELLED" ? "order_cancelled" : "order_status_changed", { target });
    return tx.storeOrder.update({ where: { id }, data: { status: target, ...(target === "CANCELLED" ? { paymentPageUrl: null } : {}) }, include: orderWithItems });
  });
}
