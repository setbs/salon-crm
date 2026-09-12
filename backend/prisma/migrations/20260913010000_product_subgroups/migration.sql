CREATE TABLE "product_subgroups" (
  "id" BIGSERIAL PRIMARY KEY,
  "category_id" BIGINT NOT NULL REFERENCES "product_categories"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  CONSTRAINT "product_subgroups_category_id_name_key" UNIQUE ("category_id", "name")
);
ALTER TABLE "products" ADD COLUMN "subgroup_id" BIGINT REFERENCES "product_subgroups"("id") ON DELETE SET NULL;
CREATE INDEX "products_subgroup_id_idx" ON "products"("subgroup_id");
