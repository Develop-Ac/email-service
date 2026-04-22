# 00 Objetivo

## Objetivo principal

Implantar um email-service independente do garantia-service, capaz de se tornar o nucleo corporativo de inbox e outbox, mantendo no garantia-service apenas as regras do dominio de garantia.

## Resultado esperado

Ao final do MVP, o ambiente deve possuir:
- um backend dedicado para e-mail no repositorio email-service;
- um contrato REST interno entre email-service e garantia-service;
- um backbone assincrono via RabbitMQ para eventos e processamento interno;
- sync IMAP incremental idempotente;
- threading auditavel;
- vinculacao automatica limitada e segura para garantias;
- fallback manual no frontend;
- envio SMTP centralizado;
- armazenamento consistente de anexos em MinIO/S3.

## Nao objetivos do MVP

- heuristicas avancadas de matching;
- IAM proprio do email-service;
- armazenamento de raw MIME;
- expansao operacional completa para todos os dominios corporativos;
- substituicao imediata total do n8n sem fase de convivencia.