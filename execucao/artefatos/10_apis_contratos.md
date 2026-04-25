# 10 APIs e Contratos

## Escopo deste artefato

Este documento formaliza os contratos REST internos entre email-service e garantia-service.

Diretriz fixa:
- sincrono: REST interno;
- assincrono: RabbitMQ.

## Responsabilidades do contrato

O garantia-service deve expor apenas o necessario para que o email-service:
- resolva uma garantia a partir de codigo extraido;
- valide se um vinculo pode ser aplicado;
- obtenha dados minimos de exibicao;
- registre reflexo funcional opcional na timeline de garantia.

O email-service nao deve:
- consultar diretamente tabelas do garantia-service;
- escrever no banco do garantia-service;
- inferir regras de negocio de garantia sem contrato.

## Contratos REST internos propostos

### 0. Ingestao inbound hibrida vinda do n8n

`POST /api/internal/email/messages/ingest`

Uso:
- persistir no schema `email_core` os e-mails recebidos e processados pelo workflow n8n;
- manter `n8n` como motor de recepcao, filtro, extracao de garantia e upload MinIO;
- alimentar a tela operacional e o read model oficial do email-service.

Request:

```json
{
  "accountId": 1,
  "internetMessageId": "<abc123@dominio.com>",
  "inReplyTo": "<thread-parent@dominio.com>",
  "referencesHeader": "<ref-1@dominio.com> <ref-2@dominio.com>",
  "subject": "Retorno garantia NI 123456",
  "fromAddress": "cliente@dominio.com",
  "fromName": "Cliente X",
  "replyToAddress": "cliente@dominio.com",
  "bodyText": "Texto do e-mail",
  "bodyHtml": "<p>Texto do e-mail</p>",
  "headers": {
    "message-id": "<abc123@dominio.com>"
  },
  "to": [
    {
      "email": "qualidade@empresa.com"
    }
  ],
  "cc": [],
  "bcc": [],
  "receivedAt": "2026-04-24T14:20:00.000Z",
  "internalDate": "2026-04-24T14:19:58.000Z",
  "sizeBytes": 18234,
  "attachments": [
    {
      "fileName": "foto-avaria.jpg",
      "storageBucket": "garantias",
      "storageKey": "anexos_email_garantia/abc123/foto-avaria.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 90213,
      "contentId": null,
      "isInline": false
    }
  ],
  "garantiaId": "12345",
  "matchedValue": "123456",
  "linkMode": "AUTO",
  "linkSource": "N8N",
  "linkConfidence": 1
}
```

Resposta 200:

```json
{
  "ok": true,
  "created": true,
  "messageId": 90001,
  "threadId": 333,
  "attachmentCount": 1,
  "linkedGarantiaId": "12345"
}
```

Persistencia esperada:
- `email_core.mail_message`
- `email_core.mail_thread`
- `email_core.mail_attachment`
- `email_core.mail_link`
- `email_core.mail_event`

Persistencia opcional:
- `email_core.mail_folder_presence`, quando o n8n informar pasta e UID.

### 1. Buscar garantia por id

`GET /internal/garantias/{garantiaId}`

Uso:
- detalhe minimo para vinculo manual;
- confirmacao de existencia.

Resposta 200:

```json
{
  "id": 12345,
  "codigo": "123456",
  "notaInterna": "123456",
  "status": 6,
  "statusLabel": "Aguardando Analise de Garantia",
  "nomeFornecedor": "Fornecedor X",
  "emailFornecedor": "fornecedor@dominio.com",
  "aceitaVinculoEmail": true,
  "contexto": "GARANTIA"
}
```

Erros:
- 404 quando a garantia nao existir.

### 2. Buscar garantia por codigo extraido

`GET /internal/garantias/by-codigo/{codigo}`

Uso:
- auto-vinculo por assunto ou corpo;
- sugestao de vinculo manual.

Resposta 200 com match unico:

```json
{
  "matchType": "UNIQUE",
  "items": [
    {
      "id": 12345,
      "codigo": "123456",
      "notaInterna": "123456",
      "status": 6,
      "statusLabel": "Aguardando Analise de Garantia",
      "aceitaVinculoEmail": true
    }
  ]
}
```

Resposta 200 ambigua:

```json
{
  "matchType": "AMBIGUOUS",
  "items": [
    {
      "id": 12345,
      "codigo": "123456",
      "notaInterna": "123456",
      "status": 6,
      "aceitaVinculoEmail": true
    },
    {
      "id": 12400,
      "codigo": "123456",
      "notaInterna": "123456",
      "status": 2,
      "aceitaVinculoEmail": false
    }
  ]
}
```

Resposta 200 sem match:

```json
{
  "matchType": "NONE",
  "items": []
}
```

### 3. Validar possibilidade de vinculo

`POST /internal/garantias/{garantiaId}/validar-vinculo-email`

Uso:
- antes do vinculo manual;
- antes de consolidar auto-vinculo.

Request:

```json
{
  "source": "AUTO_SUBJECT",
  "messageId": 987654,
  "threadId": 111,
  "internetMessageId": "<abc@example.com>",
  "detectedCode": "123456"
}
```

Resposta 200:

```json
{
  "allowed": true,
  "reasonCode": "OK",
  "reasonMessage": "Garantia apta para vinculo.",
  "garantia": {
    "id": 12345,
    "codigo": "123456",
    "status": 6,
    "aceitaVinculoEmail": true
  }
}
```

Resposta 409:

```json
{
  "allowed": false,
  "reasonCode": "STATUS_BLOCKED",
  "reasonMessage": "Garantia nao aceita novos vinculos de e-mail no estado atual."
}
```

### 4. Registrar reflexo funcional de vinculo na timeline da garantia

`POST /internal/garantias/{garantiaId}/timeline/email-linked`

Uso:
- opcional e sincrono apenas quando a regra de negocio exigir reflexo imediato;
- preferencialmente, esse mesmo reflexo deve existir tambem por evento RabbitMQ.

Request:

```json
{
  "emailServiceMessageId": 987654,
  "emailServiceThreadId": 111,
  "linkMode": "AUTO",
  "linkSource": "BODY_CODE",
  "internetMessageId": "<abc@example.com>",
  "subject": "Retorno garantia NI 123456",
  "from": "cliente@dominio.com",
  "receivedAt": "2026-04-22T10:15:00Z"
}
```

Resposta 202:

```json
{
  "accepted": true
}
```

## Regras de contrato

### Timeouts

- consultas: ate 2 segundos;
- validacao de vinculo: ate 3 segundos.

### Fallback de indisponibilidade

Se o garantia-service estiver indisponivel:
- o email-service nao auto-vincula;
- a mensagem vai para fila manual com auditoria de dependencia indisponivel.

### Idempotencia

- `GET` naturalmente idempotente;
- `POST /validar-vinculo-email` deve ser puro do ponto de vista funcional;
- `POST /timeline/email-linked` deve aceitar chave de idempotencia em header.

### Autenticacao entre servicos

- autenticacao interna baseada na infra atual;
- preferencia por token tecnico ou mTLS conforme padrao da intranet;
- identidade do usuario final trafega em headers de contexto quando necessario para auditoria.

## Headers recomendados

- `X-Correlation-Id`
- `X-Request-Id`
- `X-Actor-User-Id`
- `X-Actor-User-Name`
- `X-Actor-Roles`
- `Idempotency-Key` nas operacoes de reflexo funcional.

## Eventos RabbitMQ complementares

Mesmo com REST interno, o contrato alvo entre os servicos deve ser majoritariamente orientado a eventos para reflexos assincronos:
- `email.linked`
- `email.link.failed`
- `email.sent`
- `email.sync.failed`

REST interno fica reservado para consulta e validacao pontual.