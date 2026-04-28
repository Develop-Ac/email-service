const { Client } = require('pg');

const client = new Client({
  host: 'panel-teste.acacessorios.local',
  port: 5555,
  database: 'intranet',
  user: 'intranet',
  password: 'Ac@2025acesso',
  ssl: false,
});

const previewSql = `
WITH cid_refs AS (
  SELECT
    m.id AS message_id,
    refs.ordinality AS rn,
    refs.match[1] AS content_id
  FROM email_core.mail_message m
  CROSS JOIN LATERAL regexp_matches(coalesce(m.body_html, ''), 'cid:([^"''\\s>]+)', 'gi') WITH ORDINALITY AS refs(match, ordinality)
), attachment_rows AS (
  SELECT
    a.id AS attachment_id,
    a.message_id,
    row_number() OVER (PARTITION BY a.message_id ORDER BY a.id) AS rn,
    a.file_name,
    a.content_id AS current_content_id
  FROM email_core.mail_attachment a
)
SELECT
  ar.attachment_id,
  ar.message_id,
  ar.file_name,
  ar.current_content_id,
  cr.content_id AS inferred_content_id
FROM attachment_rows ar
JOIN cid_refs cr
  ON cr.message_id = ar.message_id
 AND cr.rn = ar.rn
WHERE coalesce(ar.current_content_id, '') = ''
ORDER BY ar.message_id DESC, ar.attachment_id ASC
LIMIT 50;
`;

const updateSql = `
WITH cid_refs AS (
  SELECT
    m.id AS message_id,
    refs.ordinality AS rn,
    refs.match[1] AS content_id
  FROM email_core.mail_message m
  CROSS JOIN LATERAL regexp_matches(coalesce(m.body_html, ''), 'cid:([^"''\\s>]+)', 'gi') WITH ORDINALITY AS refs(match, ordinality)
), attachment_rows AS (
  SELECT
    a.id AS attachment_id,
    a.message_id,
    row_number() OVER (PARTITION BY a.message_id ORDER BY a.id) AS rn
  FROM email_core.mail_attachment a
)
UPDATE email_core.mail_attachment a
SET content_id = cr.content_id,
  is_inline = true
FROM attachment_rows ar
JOIN cid_refs cr
  ON cr.message_id = ar.message_id
 AND cr.rn = ar.rn
WHERE a.id = ar.attachment_id
  AND coalesce(a.content_id, '') = '';
`;

(async () => {
  await client.connect();
  const preview = await client.query(previewSql);
  console.log('PREVIEW');
  console.log(JSON.stringify(preview.rows, null, 2));
  const update = await client.query(updateSql);
  console.log('UPDATED_ROWS');
  console.log(update.rowCount);
  const verify = await client.query(previewSql);
  console.log('REMAINING_PREVIEW');
  console.log(JSON.stringify(verify.rows, null, 2));
  await client.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
