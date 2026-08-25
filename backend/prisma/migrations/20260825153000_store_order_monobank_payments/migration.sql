CREATE TYPE "StorePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

ALTER TABLE "store_orders"
  ADD COLUMN "payment_status" "StorePaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "payment_provider" VARCHAR(50),
  ADD COLUMN "monobank_invoice_id" VARCHAR(100),
  ADD COLUMN "payment_page_url" VARCHAR(1000),
  ADD COLUMN "payment_amount" DECIMAL(10, 2),
  ADD COLUMN "payment_currency" VARCHAR(3) NOT NULL DEFAULT 'UAH',
  ADD COLUMN "payment_failure_reason" VARCHAR(500),
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "payment_modified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "store_orders_monobank_invoice_id_key" ON "store_orders"("monobank_invoice_id");
CREATE INDEX "store_orders_payment_status_created_at_idx" ON "store_orders"("payment_status", "created_at");
