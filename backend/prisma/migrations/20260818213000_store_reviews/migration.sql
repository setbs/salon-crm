CREATE TABLE "store_reviews" (
  "id" BIGSERIAL NOT NULL,
  "author_name" VARCHAR(100) NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(1200) NOT NULL,
  "is_published" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE INDEX "store_reviews_is_published_created_at_idx" ON "store_reviews"("is_published", "created_at");
