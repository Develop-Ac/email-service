BEGIN;

ALTER TABLE email_core.mail_link
  DROP CONSTRAINT IF EXISTS ck_mail_link_source;

ALTER TABLE email_core.mail_link
  ADD CONSTRAINT ck_mail_link_source
  CHECK (link_source IN ('THREAD_INHERITANCE', 'SUBJECT_CODE', 'BODY_CODE', 'MANUAL', 'N8N'));

COMMIT;