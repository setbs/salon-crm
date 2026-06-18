CREATE TABLE appointment_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  details JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX appointment_audit_logs_appointment_id_idx ON appointment_audit_logs(appointment_id);
CREATE INDEX appointment_audit_logs_actor_user_id_idx ON appointment_audit_logs(actor_user_id);
CREATE INDEX appointment_audit_logs_created_at_idx ON appointment_audit_logs(created_at);
