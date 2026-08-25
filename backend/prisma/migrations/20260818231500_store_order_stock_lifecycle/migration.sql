ALTER TABLE "store_orders"
ADD COLUMN "stock_deducted_at" TIMESTAMP(3),
ADD COLUMN "stock_restored_at" TIMESTAMP(3);
