# 06 Dados SQL

## Premissas do schema inicial

- PostgreSQL com schema dedicado `email_core`.
- Sem uso de Prisma Migrate como mecanismo de implantacao.
- Chaves primarias em `bigserial`.
- Modelo canonico: 1 mensagem em `mail_message` e N presencas em `mail_folder_presence`.
- Anexos binarios fora do banco, em MinIO/S3.
- Sem raw MIME no MVP.
- Integracao com garantia por referencia generica em `mail_link`, sem chave estrangeira cross-service.

## Tabelas principais

### mail_account

Representa cada caixa de e-mail administrada pelo servico.

### mail_folder

Representa cada pasta IMAP conhecida de uma conta.

### mail_sync_checkpoint

Controla o progresso incremental por conta e pasta.

### mail_thread

Representa a conversa consolidada.

### mail_message

Representa a mensagem canonica, independente de quantas pastas a contenham.

### mail_folder_presence

Representa a presenca da mensagem em cada pasta, com UID, UIDVALIDITY e flags remotas.

### mail_attachment

Guarda apenas metadados do anexo e sua localizacao no object storage.

### mail_link

Registra o vinculo entre mensagem/thread e entidade de negocio.

### outbound_message

Historico e fila logica de envio SMTP.

### mail_audit_log

Trilha imutavel das decisoes e acoes humanas ou sistemicas.

### mail_event

Outbox de eventos do dominio de e-mail.

## Indices e regras criticas

- `mail_folder_presence(folder_id, uid_validity, imap_uid)` garante unicidade tecnica por pasta.
- `mail_message(account_id, internet_message_id)` acelera dedupe e threading.
- `mail_link(entity_type, entity_id)` acelera consultas por entidade de negocio.
- `mail_thread(linked_entity_type, linked_entity_id)` acelera inbox por contexto.
- indices full text em assunto e corpo textual para operacao do frontend.

## Estrategia de deduplicacao

Camada 1:
- presenca unica por `folder_id + uid_validity + imap_uid`.

Camada 2:
- mensagem canonica preferencialmente por `internet_message_id` dentro da conta.

Camada 3:
- fallback por `message_fingerprint` quando o Message-ID for ausente ou ruim.

## Artefato SQL associado

- `sql/0001_email_service_initial_schema.sql`