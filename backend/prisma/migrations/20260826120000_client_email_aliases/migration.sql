CREATE TABLE "client_email_aliases" (
  "id" BIGSERIAL NOT NULL,
  "client_id" BIGINT NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "source" VARCHAR(80),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_email_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_email_aliases_client_id_email_key"
  ON "client_email_aliases"("client_id", "email");

CREATE INDEX "client_email_aliases_client_id_idx" ON "client_email_aliases"("client_id");
CREATE INDEX "client_email_aliases_email_idx" ON "client_email_aliases"("email");

ALTER TABLE "client_email_aliases"
  ADD CONSTRAINT "client_email_aliases_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "client_email_aliases" ("client_id", "email", "source", "created_at")
SELECT "id", "email", 'existing_client', "created_at"
FROM "users"
WHERE "role" = 'CLIENT' AND "email" IS NOT NULL;
