const { Client } = require('pg');

const query = `
SELECT
  m.id,
  m.internet_message_id,
  m.subject_raw,
  m.received_at,
  left(coalesce(m.body_html,''), 5000) as body_html,
  left(coalesce(m.body_text,''), 400) as body_text,
  m.has_attachments,
  a.id as attachment_id,
  a.file_name,
  a.content_id,
  a.is_inline,
  a.storage_key
FROM email_core.mail_message m
LEFT JOIN email_core.mail_attachment a ON a.message_id = m.id
WHERE m.subject_raw ILIKE '%551116%'
   OR m.body_html ILIKE '%551116%'
   OR m.body_text ILIKE '%551116%'
ORDER BY m.received_at DESC, a.id ASC
LIMIT 20
`;

(async () => {
  const client = new Client({
    host: 'panel-teste.acacessorios.local',
    port: 5555,
    database: 'intranet',
    user: 'intranet',
    password: 'Ac@2025acesso',
    ssl: false,
  });
  await client.connect();
  const res = await client.query(query);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
