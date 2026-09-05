import "dotenv/config";
import { prisma } from "../config/prisma.js";
import { expireReservations } from "../modules/catalog/order-lifecycle.js";
import { reconcileOrderPayments, recoverUnknownAttempt } from "../modules/payments/monobank.service.js";

async function main() {
  const [attemptId, invoiceId, ...extra] = process.argv.slice(2);
  if (attemptId || invoiceId) {
    if (!attemptId || !invoiceId || extra.length || process.env.ALLOW_PAYMENT_RECOVERY !== "true") {
      throw new Error("Recovery requires ALLOW_PAYMENT_RECOVERY=true and attemptId invoiceId.");
    }
    await recoverUnknownAttempt(attemptId, invoiceId);
    console.log(JSON.stringify({ event: "payment_recovery_completed" }));
    return;
  }
  // Bounded batches; a cron run that follows resumes from the oldest lastCheckedAt.
  const released = await expireReservations(200);
  const candidates = await prisma.paymentAttempt.findMany({ where: {
    status: { not: "REFUNDED" },
    OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 60_000) } }]
  }, orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } }, take: 100, select: { orderId: true } });
  for (const orderId of new Set(candidates.map((attempt) => attempt.orderId))) await reconcileOrderPayments(orderId);
  console.log(JSON.stringify({ event: "payment_maintenance_completed", released }));
}
main().catch(() => {
  console.error(JSON.stringify({ event: "payment_maintenance_failed" }));
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
