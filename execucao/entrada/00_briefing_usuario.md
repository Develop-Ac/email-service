# Briefing do Usuario

## Problema

Hoje o backend de garantias concentra parte relevante da responsabilidade de e-mail:
- envio SMTP dentro do modulo de garantias;
- inbox e vinculacao manual dentro do modulo emails;
- historico de thread parcialmente montado em historico de garantia;
- parte do fluxo operacional ainda depende de n8n.

Esse desenho dificulta:
- reuso por outros contextos alem de garantia;
- escalabilidade de sync e processamento;
- rastreabilidade forte de threading e vinculacao;
- evolucao independente do dominio de e-mail.

## Objetivo

Criar um email-service separado, generico e escalavel para:
- sync IMAP incremental sem duplicidade;
- thread engine;
- vinculacao automatica e manual com garantias no MVP;
- envio de e-mails;
- rastreabilidade e auditoria completas;
- preparacao para multiplos contextos futuros.

## Decisoes travadas

- integracao sincrona entre servicos: REST interno;
- integracao assincrona: RabbitMQ;
- 1 mensagem canonica + N presencas por pasta;
- anexos sempre em MinIO/S3;
- raw MIME fora do MVP;
- auto-vinculo do MVP limitado a:
  - codigo da garantia no corpo;
  - codigo da garantia no assunto;
  - heranca por thread ja vinculada;
  - vinculacao manual;
- autenticacao herdada da intranet;
- autorizacao por claims/perfis existentes;
- email-service sera criado do zero no repositorio email-service;
- backend a ser separado do legado atual: garantia-service.

## Restricoes

- nao escrever implementacao final neste momento;
- nao usar Prisma Migrate como mecanismo de mudanca de banco;
- entregar desenho tecnico pronto para implementacao real;
- preservar operacao durante migracao com cutover progressivo por conta.