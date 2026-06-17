CREATE TYPE "ConsumableUnit" AS ENUM ('ML', 'GRAM');

ALTER TABLE "products"
ADD COLUMN "content_amount" DECIMAL(10,2),
ADD COLUMN "content_unit" "ConsumableUnit";

CREATE TABLE "service_consumables" (
  "id" BIGSERIAL NOT NULL,
  "service_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL,
  "unit" "ConsumableUnit" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_consumables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_consumables_service_id_product_id_key" ON "service_consumables"("service_id", "product_id");

ALTER TABLE "service_consumables"
ADD CONSTRAINT "service_consumables_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_consumables"
ADD CONSTRAINT "service_consumables_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
