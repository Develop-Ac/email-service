# 07 Integracoes

## Diretriz aprovada

- integracao sincrona: REST interno;
- integracao assincrona: RabbitMQ.

## Integracao sincrona - REST interno

Uso recomendado:
- resolver garantia a partir do codigo extraido;
- validar se a garantia aceita vinculacao;
- obter dados minimos para UX operacional;
- consultar estado atual de garantia no momento do vinculo manual.

Padrao:
- chamadas autenticadas internamente;
- timeout curto;
- idempotencia nas operacoes de consulta/validacao;
- degradacao controlada para fila manual quando o garantia-service estiver indisponivel.

## Integracao assincrona - RabbitMQ

Uso recomendado:
- pipeline interno do email-service;
- eventos publicados para garantia-service, n8n e futuros consumidores;
- retries e dead-letter;
- desacoplamento temporal entre ingestao, parsing, thread, link e notificacoes.

## Eventos iniciais recomendados

- email.received
- email.parsed
- email.threaded
- email.linked
- email.link.failed
- email.sent
- email.sync.failed
- email.account.connected
- email.account.disabled

## Papel do garantia-service nas integracoes

Como provedor REST:
- resolver e validar garantias.

Como consumidor RabbitMQ:
- receber email.linked;
- receber email.sent;
- receber eventos relevantes para timeline e indicadores.

## Papel do n8n nas integracoes

- origem hibrida de ingestao inbound enquanto o recebimento IMAP ficar centralizado no workflow existente;
- chama `POST /api/internal/email/messages/ingest` para persistir read model oficial em `email_core`;
- continua executando filtro, extracao de garantia, upload de anexos no MinIO e automacoes complementares;
- consumidor de eventos RabbitMQ ou webhook derivado do email-service quando necessario.

## Estrategia de anexos e inline (MinIO)

- bucket padrao: `garantias`;
- prefixo recomendado: `anexos_email_garantia/{messageIdSanitizado}/`;
- para cada arquivo (anexo normal ou inline), persistir:
- `fileName`
- `storageBucket`
- `storageKey`
- `mimeType`
- `sizeBytes`
- `contentId` (quando existir)
- `isInline`.

Regra funcional:
- imagens inline devem ser identificadas por `contentId` e renderizadas no frontend substituindo `cid:` por URL assinada;
- anexos nao inline permanecem na lista de arquivos para download;
- fallback de tipo/icone no frontend deve usar extensao quando `mimeType` nao vier preenchido.