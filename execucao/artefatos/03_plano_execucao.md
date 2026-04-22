# 03 Plano de Execucao

## Fase 1 - Fundacao do servico

Objetivo:
- estabelecer a base tecnica do email-service no repositorio novo.

Entregaveis:
- bootstrap do servico NestJS;
- configuracao de PostgreSQL, RabbitMQ e MinIO/S3;
- estrutura modular inicial;
- padrao de autenticacao herdada;
- observabilidade minima;
- SQL inicial do schema do email-service.

Critero de pronto:
- o servico sobe, autentica com o modelo atual e possui contratos e estrutura preparados para sync e operacao.

## Fase 2 - Sync incremental e persistencia canonica

Objetivo:
- implementar ingestao IMAP sem duplicidade.

Entregaveis:
- MailAccount, MailFolder, MailMessage, MailFolderPresence e MailSyncCheckpoint;
- processamento incremental por conta/pasta;
- reprocessamento idempotente;
- tratamento de UIDVALIDITY;
- eventos email.received.

Critero de pronto:
- a mesma mensagem em multiplas pastas existe uma vez no dominio e varias vezes apenas nas presencas.

## Fase 3 - Parsing, anexos e threading

Objetivo:
- transformar a mensagem sincronizada em dado operacional.

Entregaveis:
- parsing de headers, HTML e texto;
- extracao e armazenamento de anexos em MinIO/S3;
- thread engine conservador;
- eventos email.parsed e email.threaded.

Critero de pronto:
- threads basicas de reply corporativo ficam estaveis e auditaveis.

## Fase 4 - Vinculo MVP com garantias

Objetivo:
- conectar e-mail ao dominio de garantia sem heuristica excessiva.

Entregaveis:
- contratos REST internos com garantia-service;
- auto-vinculo por assunto, corpo e heranca de thread;
- inbox de nao vinculados;
- vinculacao e desvinculacao manual;
- auditoria da decisao;
- eventos email.linked e email.link.failed.

Critero de pronto:
- toda mensagem fica auto-vinculada com criterio seguro ou aguardando revisao manual.

## Fase 5 - Frontend operacional

Objetivo:
- permitir uso diario da equipe de garantia.

Entregaveis:
- inbox geral;
- inbox por conta;
- lista de nao vinculados;
- detalhe de thread;
- acoes manuais;
- historico de auditoria.

Critero de pronto:
- o time opera o fluxo sem depender do modulo antigo de e-mails do garantia-service.

## Fase 6 - Outbound centralizado

Objetivo:
- mover envio SMTP para o email-service.

Entregaveis:
- resposta, encaminhamento e novos envios;
- OutboundMessage;
- eventos email.sent;
- rastreabilidade ponta a ponta.

Critero de pronto:
- respostas de garantia sao enviadas pelo email-service e registradas com thread e auditoria.

## Fase 7 - Cutover progressivo e retirada do legado

Objetivo:
- separar definitivamente o backend de e-mail do garantia-service.

Entregaveis:
- shadow run por conta;
- comparacao entre legado e novo fluxo;
- migracao progressiva das caixas;
- retirada do polling/estado de inbox do garantia-service;
- rebaixamento do n8n para papel periferico.

Critero de pronto:
- cada conta opera integralmente pelo email-service com rollback controlado por conta.