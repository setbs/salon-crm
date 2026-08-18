CREATE TABLE payment_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  details JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX payment_audit_logs_payment_id_idx ON payment_audit_logs(payment_id);
CREATE INDEX payment_audit_logs_actor_user_id_idx ON payment_audit_logs(actor_user_id);
CREATE INDEX payment_audit_logs_created_at_idx ON payment_audit_logs(created_at);
