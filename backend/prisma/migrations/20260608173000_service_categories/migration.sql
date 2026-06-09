CREATE TABLE "service_categories" (
  "id" BIGSERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "services" ADD COLUMN "category_id" BIGINT;

CREATE UNIQUE INDEX "service_categories_name_key" ON "service_categories"("name");

ALTER TABLE "services"
  ADD CONSTRAINT "services_category_id_fkey"
  FOREIGN KEY ("category_id")
  REFERENCES "service_categories"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
