CREATE TABLE "employee_schedule_overrides" (
  "id" BIGSERIAL NOT NULL,
  "employee_id" BIGINT NOT NULL,
  "work_date" TIMESTAMP(3) NOT NULL,
  "start_time" VARCHAR(5),
  "end_time" VARCHAR(5),
  "is_closed" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_schedule_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_schedule_overrides_employee_id_work_date_key"
  ON "employee_schedule_overrides"("employee_id", "work_date");

CREATE INDEX "employee_schedule_overrides_employee_id_work_date_idx"
  ON "employee_schedule_overrides"("employee_id", "work_date");

ALTER TABLE "employee_schedule_overrides"
  ADD CONSTRAINT "employee_schedule_overrides_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
