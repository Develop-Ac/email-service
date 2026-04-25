BEGIN;

CREATE SCHEMA IF NOT EXISTS email_core;

CREATE TABLE email_core.mail_account (
  id BIGSERIAL PRIMARY KEY,
  tenant_key VARCHAR(100) NOT NULL,
  context_type VARCHAR(50) NOT NULL DEFAULT 'GARANTIA',
  account_name VARCHAR(255) NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  imap_host VARCHAR(255) NOT NULL,
  imap_port INTEGER NOT NULL,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  smtp_host VARCHAR(255) NOT NULL,
  smtp_port INTEGER NOT NULL,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  auth_secret_ref VARCHAR(255) NOT NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  send_enabled BOOLEAN NOT NULL DEFAULT true,
  status_code VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  last_connection_check_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mail_account_email UNIQUE (tenant_key, email_address),
  CONSTRAINT ck_mail_account_status CHECK (status_code IN ('ACTIVE', 'DISABLED', 'ERROR'))
);

CREATE TABLE email_core.mail_folder (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES email_core.mail_account(id) ON DELETE CASCADE,
  remote_folder_key VARCHAR(255) NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  delimiter VARCHAR(10) NULL,
  uid_validity BIGINT NULL,
  uid_next_hint BIGINT NULL,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mail_folder_remote UNIQUE (account_id, remote_folder_key)
);

CREATE TABLE email_core.mail_sync_checkpoint (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES email_core.mail_account(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES email_core.mail_folder(id) ON DELETE CASCADE,
  uid_validity_seen BIGINT NULL,
  last_uid_processed BIGINT NULL,
  last_internal_date TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_error_at TIMESTAMPTZ NULL,
  last_error_message TEXT NULL,
  lock_token VARCHAR(120) NULL,
  lock_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mail_sync_checkpoint UNIQUE (account_id, folder_id)
);

CREATE TABLE email_core.mail_thread (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES email_core.mail_account(id) ON DELETE CASCADE,
  canonical_subject VARCHAR(500) NULL,
  normalized_subject VARCHAR(500) NULL,
  thread_key VARCHAR(255) NOT NULL,
  status_code VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  linked_entity_type VARCHAR(50) NULL,
  linked_entity_id VARCHAR(100) NULL,
  link_mode VARCHAR(20) NULL,
  link_confidence NUMERIC(5,4) NULL,
  first_message_at TIMESTAMPTZ NULL,
  last_message_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mail_thread_key UNIQUE (account_id, thread_key),
  CONSTRAINT ck_mail_thread_status CHECK (status_code IN ('OPEN', 'LINKED', 'REVIEW_REQUIRED', 'CONFLICTED', 'ARCHIVED')),
  CONSTRAINT ck_mail_thread_link_mode CHECK (link_mode IS NULL OR link_mode IN ('AUTO', 'MANUAL', 'INHERITED'))
);

CREATE TABLE email_core.mail_message (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES email_core.mail_account(id) ON DELETE CASCADE,
  thread_id BIGINT NULL REFERENCES email_core.mail_thread(id) ON DELETE SET NULL,
  internet_message_id VARCHAR(1000) NULL,
  in_reply_to VARCHAR(1000) NULL,
  references_header TEXT NULL,
  message_fingerprint VARCHAR(128) NOT NULL,
  subject_raw VARCHAR(1000) NULL,
  normalized_subject VARCHAR(1000) NULL,
  from_address VARCHAR(255) NULL,
  from_name VARCHAR(255) NULL,
  reply_to_address VARCHAR(255) NULL,
  sender_address VARCHAR(255) NULL,
  body_text TEXT NULL,
  body_html TEXT NULL,
  headers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  participants_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  parsing_status VARCHAR(30) NOT NULL DEFAULT 'INGESTED',
  direction VARCHAR(20) NOT NULL DEFAULT 'INBOUND',
  sent_at TIMESTAMPTZ NULL,
  internal_date TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  size_bytes BIGINT NULL,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mail_message_fingerprint UNIQUE (account_id, message_fingerprint),
  CONSTRAINT ck_mail_message_status CHECK (parsing_status IN ('INGESTED', 'PARSED', 'THREADED', 'LINKED_AUTO', 'LINKED_MANUAL', 'REVIEW_PENDING', 'PROCESSING_ERROR')),
  CONSTRAINT ck_mail_message_direction CHECK (direction IN ('INBOUND', 'OUTBOUND'))
);

CREATE UNIQUE INDEX uq_mail_message_internet_message_id
  ON email_core.mail_message (account_id, internet_message_id)
  WHERE internet_message_id IS NOT NULL;

CREATE TABLE email_core.mail_folder_presence (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES email_core.mail_message(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES email_core.mail_folder(id) ON DELETE CASCADE,
  uid_validity BIGINT NOT NULL,
  imap_uid BIGINT NOT NULL,
  is_seen BOOLEAN NOT NULL DEFAULT false,
  is_answered BOOLEAN NOT NULL DEFAULT false,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  is_deleted_remote BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mail_folder_presence UNIQUE (folder_id, uid_validity, imap_uid)
);

CREATE TABLE email_core.mail_attachment (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES email_core.mail_message(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(255) NULL,
  size_bytes BIGINT NULL,
  content_id VARCHAR(500) NULL,
  checksum_sha256 VARCHAR(128) NULL,
  is_inline BOOLEAN NOT NULL DEFAULT false,
  storage_bucket VARCHAR(255) NOT NULL,
  storage_key VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_core.mail_link (
  id BIGSERIAL PRIMARY KEY,
  target_type VARCHAR(20) NOT NULL,
  target_id BIGINT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  link_mode VARCHAR(20) NOT NULL,
  link_source VARCHAR(40) NOT NULL,
  confidence_score NUMERIC(5,4) NULL,
  detected_code VARCHAR(100) NULL,
  reason_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mail_link_target CHECK (target_type IN ('MESSAGE', 'THREAD')),
  CONSTRAINT ck_mail_link_mode CHECK (link_mode IN ('AUTO', 'MANUAL', 'INHERITED')),
  CONSTRAINT ck_mail_link_source CHECK (link_source IN ('THREAD_INHERITANCE', 'SUBJECT_CODE', 'BODY_CODE', 'MANUAL', 'N8N'))
);

CREATE TABLE email_core.outbound_message (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES email_core.mail_account(id) ON DELETE CASCADE,
  thread_id BIGINT NULL REFERENCES email_core.mail_thread(id) ON DELETE SET NULL,
  parent_message_id BIGINT NULL REFERENCES email_core.mail_message(id) ON DELETE SET NULL,
  subject VARCHAR(1000) NOT NULL,
  body_text TEXT NULL,
  body_html TEXT NULL,
  header_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  bcc_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  send_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  provider_message_id VARCHAR(1000) NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  created_by_user_id VARCHAR(100) NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_outbound_message_status CHECK (send_status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED'))
);

CREATE TABLE email_core.mail_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(100) NULL,
  account_id BIGINT NULL REFERENCES email_core.mail_account(id) ON DELETE SET NULL,
  thread_id BIGINT NULL REFERENCES email_core.mail_thread(id) ON DELETE SET NULL,
  message_id BIGINT NULL REFERENCES email_core.mail_message(id) ON DELETE SET NULL,
  payload_before JSONB NULL,
  payload_after JSONB NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NULL,
  correlation_id VARCHAR(120) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mail_audit_actor_type CHECK (actor_type IN ('SYSTEM', 'USER', 'SERVICE'))
);

CREATE TABLE email_core.mail_event (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  payload_json JSONB NOT NULL,
  publish_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_mail_event_status CHECK (publish_status IN ('PENDING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER'))
);

CREATE INDEX idx_mail_account_context
  ON email_core.mail_account (tenant_key, context_type, status_code);

CREATE INDEX idx_mail_folder_account
  ON email_core.mail_folder (account_id, sync_enabled);

CREATE INDEX idx_mail_checkpoint_lock
  ON email_core.mail_sync_checkpoint (lock_until, last_success_at);

CREATE INDEX idx_mail_thread_entity
  ON email_core.mail_thread (linked_entity_type, linked_entity_id, last_message_at DESC);

CREATE INDEX idx_mail_thread_status
  ON email_core.mail_thread (account_id, status_code, last_message_at DESC);

CREATE INDEX idx_mail_message_thread
  ON email_core.mail_message (thread_id, received_at DESC);

CREATE INDEX idx_mail_message_received
  ON email_core.mail_message (account_id, internal_date DESC, received_at DESC);

CREATE INDEX idx_mail_message_from
  ON email_core.mail_message (from_address, internal_date DESC);

CREATE INDEX idx_mail_message_subject_fts
  ON email_core.mail_message USING GIN (to_tsvector('simple', COALESCE(normalized_subject, '')));

CREATE INDEX idx_mail_message_body_fts
  ON email_core.mail_message USING GIN (to_tsvector('simple', COALESCE(body_text, '')));

CREATE INDEX idx_mail_presence_message
  ON email_core.mail_folder_presence (message_id, folder_id);

CREATE INDEX idx_mail_presence_remote_state
  ON email_core.mail_folder_presence (folder_id, is_deleted_remote, last_seen_at DESC);

CREATE INDEX idx_mail_attachment_message
  ON email_core.mail_attachment (message_id);

CREATE INDEX idx_mail_link_entity
  ON email_core.mail_link (entity_type, entity_id, is_active, created_at DESC);

CREATE INDEX idx_mail_link_target
  ON email_core.mail_link (target_type, target_id, is_active);

CREATE INDEX idx_outbound_status
  ON email_core.outbound_message (send_status, queued_at DESC);

CREATE INDEX idx_mail_audit_message
  ON email_core.mail_audit_log (message_id, created_at DESC);

CREATE INDEX idx_mail_audit_thread
  ON email_core.mail_audit_log (thread_id, created_at DESC);

CREATE INDEX idx_mail_audit_correlation
  ON email_core.mail_audit_log (correlation_id, created_at DESC);

CREATE INDEX idx_mail_event_status
  ON email_core.mail_event (publish_status, occurred_at);

COMMIT;