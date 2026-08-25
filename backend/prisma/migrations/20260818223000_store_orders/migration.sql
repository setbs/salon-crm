CREATE TYPE "StoreOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "StoreDeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

CREATE TABLE "store_orders" (
  "id" BIGSERIAL NOT NULL,
  "status" "StoreOrderStatus" NOT NULL DEFAULT 'PENDING',
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(30) NOT NULL,
  "email" VARCHAR(255),
  "delivery_method" "StoreDeliveryMethod" NOT NULL,
  "delivery_address" VARCHAR(500),
  "comment" VARCHAR(1000),
  "total_amount" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "store_order_items" (
  "id" BIGSERIAL NOT NULL,
  "order_id" BIGINT NOT NULL,
  "product_id" BIGINT NOT NULL,
  "product_name" VARCHAR(255) NOT NULL,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "store_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_order_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "store_orders_status_created_at_idx" ON "store_orders"("status", "created_at");
CREATE INDEX "store_order_items_order_id_idx" ON "store_order_items"("order_id");
CREATE INDEX "store_order_items_product_id_idx" ON "store_order_items"("product_id");

ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "store_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
