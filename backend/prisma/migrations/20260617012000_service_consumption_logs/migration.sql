ALTER TABLE "products"
ADD COLUMN "stock_content_amount" DECIMAL(10,2);

UPDATE "products"
SET "stock_content_amount" = "stock_quantity" * "content_amount"
WHERE "content_amount" IS NOT NULL;

CREATE TABLE "service_consumption_logs" (
  "id" BIGSERIAL NOT NULL,
  "appointment_id" BIGINT NOT NULL,
  "service_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL,
  "unit" "ConsumableUnit" NOT NULL,
  "stock_content_before" DECIMAL(10,2),
  "stock_content_after" DECIMAL(10,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "service_consumption_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_consumption_logs_appointment_id_idx" ON "service_consumption_logs"("appointment_id");
CREATE INDEX "service_consumption_logs_product_id_idx" ON "service_consumption_logs"("product_id");

ALTER TABLE "service_consumption_logs"
ADD CONSTRAINT "service_consumption_logs_appointment_id_fkey"
FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_consumption_logs"
ADD CONSTRAINT "service_consumption_logs_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_consumption_logs"
ADD CONSTRAINT "service_consumption_logs_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
