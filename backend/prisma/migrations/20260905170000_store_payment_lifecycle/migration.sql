CREATE TYPE "ReservationState" AS ENUM ('LEGACY', 'ACTIVE', 'RELEASED', 'CONSUMED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATING', 'PENDING', 'UNKNOWN', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');
ALTER TABLE "store_orders"
  ADD COLUMN "idempotency_key_hash" VARCHAR(64),
  ADD COLUMN "request_hash" VARCHAR(64),
  ADD COLUMN "encrypted_access_token" TEXT,
  ADD COLUMN "reservation_state" "ReservationState" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "reservation_expires_at" TIMESTAMP(3),
  ADD COLUMN "requires_review" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "review_reason" VARCHAR(100),
  ADD COLUMN "settled_attempt_id" UUID;
ALTER TABLE "store_order_items" ADD COLUMN "reserved_content_quantity" DECIMAL(10,2);
CREATE UNIQUE INDEX "store_orders_idempotency_key_hash_key" ON "store_orders"("idempotency_key_hash");
CREATE INDEX "store_orders_reservation_state_reservation_expires_at_idx" ON "store_orders"("reservation_state", "reservation_expires_at");
CREATE TABLE "payment_attempts" (
  "id" UUID PRIMARY KEY,
  "order_id" BIGINT NOT NULL REFERENCES "store_orders"("id") ON DELETE CASCADE,
  "attempt_number" INTEGER NOT NULL,
  "provider" VARCHAR(50) NOT NULL DEFAULT 'monobank',
  "provider_invoice_id" VARCHAR(100),
  "reference" VARCHAR(100) NOT NULL,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATING',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'UAH',
  "payment_url" VARCHAR(1000),
  "failure_reason" VARCHAR(100),
  "provider_modified_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "payment_attempts_provider_invoice_id_key" ON "payment_attempts"("provider_invoice_id");
CREATE UNIQUE INDEX "payment_attempts_reference_key" ON "payment_attempts"("reference");
CREATE UNIQUE INDEX "payment_attempts_order_id_attempt_number_key" ON "payment_attempts"("order_id", "attempt_number");
CREATE UNIQUE INDEX "payment_attempts_one_active_per_order" ON "payment_attempts"("order_id")
  WHERE "status" IN ('CREATING', 'PENDING', 'UNKNOWN');
CREATE INDEX "payment_attempts_status_last_checked_at_idx" ON "payment_attempts"("status", "last_checked_at");
CREATE TABLE "order_lifecycle_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "order_id" BIGINT NOT NULL REFERENCES "store_orders"("id") ON DELETE CASCADE,
  "event_type" VARCHAR(80) NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "order_lifecycle_events_order_id_created_at_idx" ON "order_lifecycle_events"("order_id", "created_at");
-- Preserve existing invoices without inventing reservations or touching stock.
INSERT INTO "payment_attempts" ("id", "order_id", "attempt_number", "provider_invoice_id", "reference",
  "status", "amount", "currency", "payment_url", "provider_modified_at", "created_at", "updated_at")
SELECT md5('legacy-store-order-' || id)::uuid, id, 1, monobank_invoice_id, id::text,
  payment_status::text::"PaymentAttemptStatus", COALESCE(payment_amount, total_amount),
  payment_currency, payment_page_url, payment_modified_at, created_at, updated_at
FROM store_orders WHERE monobank_invoice_id IS NOT NULL;
UPDATE store_orders SET settled_attempt_id = md5('legacy-store-order-' || id)::uuid
WHERE monobank_invoice_id IS NOT NULL AND payment_status IN ('PAID', 'REFUNDED');
