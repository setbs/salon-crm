ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_name_key" ON "product_categories"("name");
