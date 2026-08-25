CREATE TABLE "product_components" (
  "id" BIGSERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_components_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_components_name_key" ON "product_components"("name");

CREATE TABLE "product_component_items" (
  "product_id" BIGINT NOT NULL,
  "component_id" BIGINT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "product_component_items_pkey" PRIMARY KEY ("product_id", "component_id")
);

CREATE INDEX "product_component_items_component_id_idx" ON "product_component_items"("component_id");

ALTER TABLE "product_component_items"
  ADD CONSTRAINT "product_component_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_component_items"
  ADD CONSTRAINT "product_component_items_component_id_fkey"
  FOREIGN KEY ("component_id") REFERENCES "product_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
