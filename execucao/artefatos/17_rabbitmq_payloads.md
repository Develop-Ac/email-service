# 17 RabbitMQ Payloads

## Premissas

- broker: RabbitMQ;
- formato: JSON UTF-8;
- mensagens persistentes;
- retry controlado por fila dedicada;
- DLQ para falhas nao recuperaveis;
- correlation_id obrigatorio;
- versao de payload obrigatoria.

## Envelope padrao

```json
{
  "type": "email.sync.requested",
  "version": 1,
  "correlation_id": "c3f4e6a4-4f17-4e23-b3f1-42518f8fbc0a",
  "occurred_at": "2026-04-22T14:10:00.000Z",
  "source": "email-service.api",
  "actor": {
    "user_id": "u-123",
    "user_name": "Operador Qualidade",
    "roles": ["qualidade", "garantia"]
  },
  "payload": {}
}
```

## Filas do pipeline interno

- queue.email.sync
- queue.email.parse
- queue.email.thread
- queue.email.link
- queue.email.outbound
- queue.email.event.publish
- queue.email.retry
- queue.email.dlq

## Payloads de comando interno

### queue.email.sync

type:
- email.sync.requested

payload:
```json
{
  "account_id": 10,
  "folder_id": 2,
  "force_full_resync": false,
  "reason": "manual_trigger"
}
```

### queue.email.parse

type:
- email.parse.requested

payload:
```json
{
  "account_id": 10,
  "message_id": 90001,
  "folder_presence_id": 120045
}
```

### queue.email.thread

type:
- email.thread.requested

payload:
```json
{
  "account_id": 10,
  "message_id": 90001,
  "strategy": "MESSAGE_ID_HEADERS"
}
```

### queue.email.link

type:
- email.link.requested

payload:
```json
{
  "account_id": 10,
  "message_id": 90001,
  "thread_id": 333,
  "mode": "AUTO",
  "allowed_layers": ["THREAD_INHERITANCE", "SUBJECT_CODE", "BODY_CODE"]
}
```

### queue.email.outbound

type:
- email.outbound.requested

payload:
```json
{
  "outbound_message_id": 501,
  "account_id": 10,
  "thread_id": 333,
  "send_mode": "SMTP"
}
```

### queue.email.event.publish

type:
- email.event.publish.requested

payload:
```json
{
  "mail_event_id": 77701,
  "event_name": "email.linked",
  "routing_key": "email.linked"
}
```

## Eventos de dominio publicados

### email.received

routing_key:
- email.received

payload:
```json
{
  "account_id": 10,
  "folder_id": 2,
  "message_id": 90001,
  "internet_message_id": "<abc@dominio>",
  "internal_date": "2026-04-22T14:00:20.000Z",
  "has_attachments": true
}
```

### email.parsed

routing_key:
- email.parsed

payload:
```json
{
  "account_id": 10,
  "message_id": 90001,
  "subject": "Garantia NI 654321",
  "from": "fornecedor@dominio.com",
  "detected_codes": ["654321"],
  "parse_status": "PARSED"
}
```

### email.threaded

routing_key:
- email.threaded

payload:
```json
{
  "account_id": 10,
  "thread_id": 333,
  "message_id": 90001,
  "thread_key": "th_2f2ce8cc",
  "thread_action": "ATTACHED"
}
```

### email.linked

routing_key:
- email.linked

payload:
```json
{
  "account_id": 10,
  "thread_id": 333,
  "message_id": 90001,
  "entity_type": "GARANTIA",
  "entity_id": "12345",
  "link_mode": "AUTO",
  "link_source": "SUBJECT_CODE",
  "confidence_score": 0.97,
  "matched_value": "654321"
}
```

### email.link.failed

routing_key:
- email.link.failed

payload:
```json
{
  "account_id": 10,
  "thread_id": 333,
  "message_id": 90001,
  "failure_code": "AMBIGUOUS_MATCH",
  "failure_reason": "Codigo encontrado em mais de uma garantia",
  "queued_for_manual_review": true
}
```

### email.sent

routing_key:
- email.sent

payload:
```json
{
  "account_id": 10,
  "outbound_message_id": 501,
  "thread_id": 333,
  "provider_message_id": "<smtp-id@dominio>",
  "sent_at": "2026-04-22T14:14:00.000Z"
}
```

### email.sync.failed

routing_key:
- email.sync.failed

payload:
```json
{
  "account_id": 10,
  "folder_id": 2,
  "failure_code": "IMAP_AUTH_FAILED",
  "failure_reason": "Falha de autenticacao IMAP",
  "retry_count": 3,
  "sent_to_dlq": false
}
```

### email.account.connected

routing_key:
- email.account.connected

payload:
```json
{
  "account_id": 10,
  "email_address": "qualidade@empresa.com",
  "checked_at": "2026-04-22T14:05:00.000Z"
}
```

### email.account.disabled

routing_key:
- email.account.disabled

payload:
```json
{
  "account_id": 10,
  "email_address": "qualidade@empresa.com",
  "reason": "manual_disable",
  "disabled_at": "2026-04-22T14:06:00.000Z"
}
```

## Retry e DLQ

Regra recomendada:
- ate 3 tentativas em queue.email.retry com backoff exponencial;
- depois disso, envia para queue.email.dlq.

Campos adicionais para mensagens de retry:
```json
{
  "retry_count": 2,
  "next_retry_at": "2026-04-22T14:20:00.000Z",
  "last_error": "timeout no garantia-service"
}
```

## Compatibilidade e versao

- todo payload deve carregar version;
- alteracoes breaking geram nova versao;
- consumidores devem validar type + version antes de processar.