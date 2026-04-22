# 04 Backend

## Escopo do backend a ser separado

O backend atual que concentra responsabilidades de e-mail esta no repositorio garantia-service.

Pontos identificados no estado atual:
- envio SMTP em src/email;
- operacao de inbox e vinculacao manual em src/emails;
- dependencia direta do modulo de garantias do EmailService;
- acoplamento da timeline de garantia com fatos de e-mail;
- schema atual contendo tabelas de caixa de entrada no dominio de garantia.

## Separacao recomendada

### Sai do garantia-service

- configuracao de contas de e-mail;
- sync IMAP;
- persistencia de inbox;
- parsing de mensagens;
- anexos de e-mail;
- thread engine;
- vinculacao automatica/manual de e-mail;
- envio SMTP corporativo do fluxo de garantia;
- API de inbox e thread;
- eventos do dominio de e-mail.

### Fica no garantia-service

- entidade Garantia e suas regras;
- historico funcional do processo de garantia;
- validacao de existencia e status da garantia;
- contratos REST internos usados pelo email-service;
- consumo de eventos de e-mail que precisem refletir no dominio de garantia.

## Contratos REST internos previstos no garantia-service

Exemplos conceituais:
- GET /internal/garantias/{id}
- GET /internal/garantias/by-codigo/{codigo}
- POST /internal/garantias/{id}/validar-vinculo-email
- POST /internal/garantias/{id}/timeline/email-linked

Regra:
- o email-service nao acessa tabelas do dominio de garantia diretamente;
- a integracao sincrona entre servicos sera exclusivamente via REST interno.

## Impacto esperado no garantia-service

Remocao futura de:
- src/email;
- src/emails;
- trechos de envio SMTP em src/garantias;
- tabelas legadas de inbox como fonte primaria.

Substituicao por:
- cliente REST interno para consultar ou validar garantia;
- consumidor RabbitMQ para fatos assincronos do email-service;
- timeline de negocio atualizada por contrato/evento, nao por persistencia local de inbox.

## Decomposicao interna do email-service

### Modulos de dominio e aplicacao

#### AppModule

Responsabilidade:
- composicao principal do servico;
- carregamento de configuracao, observabilidade e modulos internos.

#### AuthIntegrationModule

Responsabilidade:
- interpretar claims e perfis da intranet atual;
- expor guards e policy checks;
- nao armazenar identidade como fonte primaria.

#### AccountModule

Responsabilidade:
- cadastro e administracao de MailAccount;
- teste de conectividade IMAP/SMTP;
- habilitacao e desabilitacao de contas.

Entidades centrais:
- mail_account;
- mail_folder.

#### SyncModule

Responsabilidade:
- coordenar sincronizacao incremental IMAP;
- gerenciar MailSyncCheckpoint;
- controlar locks por conta e pasta;
- emitir jobs de parse.

Entidades centrais:
- mail_sync_checkpoint;
- mail_folder_presence.

#### ParseModule

Responsabilidade:
- extrair headers, subject, body_text, body_html e participantes;
- detectar anexos e encaminhar streaming para storage;
- produzir metadados para thread e link.

Entidades centrais:
- mail_message;
- mail_attachment.

#### ThreadModule

Responsabilidade:
- localizar ou criar MailThread;
- anexar mensagem a thread existente;
- aplicar heranca de vinculo quando permitido.

Entidades centrais:
- mail_thread;
- mail_message.thread_id.

#### LinkingModule

Responsabilidade:
- aplicar o auto-vinculo do MVP;
- gerenciar fila de nao vinculados;
- registrar MailLink e MailAuditLog;
- chamar o garantia-service via REST interno quando necessario.

Entidades centrais:
- mail_link;
- mail_audit_log.

#### InboxModule

Responsabilidade:
- listar threads, mensagens e nao vinculados;
- expor filtros, busca e detalhamento operacional para o frontend.

#### OutboundModule

Responsabilidade:
- montar resposta e encaminhamento;
- enviar via SMTP;
- registrar OutboundMessage e atualizar thread.

Entidades centrais:
- outbound_message.

#### SearchModule

Responsabilidade:
- consulta por assunto, remetente, codigo da garantia e conteudo textual;
- consolidacao de filtros para inbox e auditoria.

#### AuditModule

Responsabilidade:
- registrar trilha imutavel de sistema e usuario;
- expor consulta de auditoria.

#### EventModule

Responsabilidade:
- implementar outbox transacional;
- publicar eventos no RabbitMQ;
- tratar retry e DLQ de publicacao.

#### StorageModule

Responsabilidade:
- encapsular MinIO/S3;
- upload, download e assinatura de anexos;
- controlar naming e prefixos de bucket.

## Workers recomendados

### worker-sync

Consome:
- queue.email.sync

Responsabilidade:
- polling IMAP incremental por conta/pasta;
- producao de jobs de parse.

### worker-parse

Consome:
- queue.email.parse

Responsabilidade:
- parsing estruturado da mensagem;
- persistencia de anexos;
- encaminhamento para thread.

### worker-thread

Consome:
- queue.email.thread

Responsabilidade:
- resolver thread_id;
- publicar para vinculacao.

### worker-link

Consome:
- queue.email.link

Responsabilidade:
- executar regras do MVP;
- consultar garantia-service por REST;
- registrar resultado e auditoria.

### worker-outbound

Consome:
- queue.email.outbound

Responsabilidade:
- efetuar envio SMTP;
- registrar sucesso ou erro;
- disparar evento email.sent.

### worker-event-publisher

Consome:
- queue.email.event.publish

Responsabilidade:
- publicar outbox em RabbitMQ;
- retry e dead-letter quando necessario.

## Estrutura sugerida de pastas NestJS

```text
src/
	app.module.ts
	common/
	config/
	auth-integration/
	accounts/
	sync/
	parse/
	threads/
	linking/
	inbox/
	outbound/
	audit/
	events/
	storage/
	garantia-client/
	health/
```

## Fronteiras internas importantes

- SyncModule nunca decide vinculo de negocio.
- ThreadModule nunca consulta diretamente a entidade garantia.
- LinkingModule nunca acessa banco do garantia-service.
- OutboundModule nao deve conter regra de negocio de garantia.
- InboxModule le o estado consolidado; nao dispara side effect ao listar.