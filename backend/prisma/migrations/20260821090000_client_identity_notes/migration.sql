CREATE TABLE "client_name_aliases" (
  "id" BIGSERIAL NOT NULL,
  "client_id" BIGINT NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "source" VARCHAR(80),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_name_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_notes" (
  "id" BIGSERIAL NOT NULL,
  "client_id" BIGINT NOT NULL,
  "author_user_id" BIGINT,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_name_aliases_client_id_first_name_last_name_key"
  ON "client_name_aliases"("client_id", "first_name", "last_name");

CREATE INDEX "client_name_aliases_client_id_idx" ON "client_name_aliases"("client_id");
CREATE INDEX "client_notes_client_id_idx" ON "client_notes"("client_id");
CREATE INDEX "client_notes_author_user_id_idx" ON "client_notes"("author_user_id");

ALTER TABLE "client_name_aliases"
  ADD CONSTRAINT "client_name_aliases_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_notes"
  ADD CONSTRAINT "client_notes_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_notes"
  ADD CONSTRAINT "client_notes_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "client_name_aliases" ("client_id", "first_name", "last_name", "source", "created_at")
SELECT "id", "first_name", "last_name", 'existing_client', "created_at"
FROM "users"
WHERE "role" = 'CLIENT';
