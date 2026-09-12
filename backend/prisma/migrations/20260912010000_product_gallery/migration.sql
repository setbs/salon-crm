ALTER TABLE "products" ADD COLUMN "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "products" SET "image_urls" = ARRAY["image_url"] WHERE "image_url" IS NOT NULL AND "image_url" <> '';
