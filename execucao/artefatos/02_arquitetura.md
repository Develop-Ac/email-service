# 02 Arquitetura

## Visao geral

Arquitetura recomendada:
- email-service como servico independente e dono do dominio de e-mail;
- garantia-service como dono exclusivo do dominio de garantia;
- frontend Next.js como camada de operacao humana;
- RabbitMQ como coluna de processamento assincrono e publicacao de eventos;
- REST interno como mecanismo sincrono entre servicos.

## Separacao de responsabilidades

### email-service

Responsavel por:
- gestao de contas e pastas IMAP/SMTP;
- sync incremental;
- parsing e normalizacao de mensagem;
- presenca por pasta;
- threading;
- vinculacao automatica e manual;
- envio de e-mail;
- auditoria;
- eventos;
- busca operacional.

### garantia-service

Responsavel por:
- CRUD e regras da entidade garantia;
- validacao de existencia e estado da garantia;
- timeline e regras de negocio do processo de garantia;
- exposicao de contratos REST internos para o email-service.

### frontend Next.js

Responsavel por:
- inbox operacional;
- nao vinculados;
- tela de thread;
- decisao manual de vinculo/desvinculo;
- resposta e encaminhamento;
- consulta da auditoria.

### n8n

Responsavel por:
- automacoes perifericas;
- consumo de eventos do email-service;
- integracoes acessorias;
- nunca o estado canonico do dominio de e-mail.

## Topologia sugerida

- API HTTP do email-service;
- worker de sync IMAP;
- worker de parsing;
- worker de threading;
- worker de vinculacao;
- worker de envio;
- worker de publicacao de eventos;
- PostgreSQL;
- RabbitMQ;
- MinIO/S3.

## Modelo canonico aprovado

Decisao fechada:
- 1 MailMessage canonica;
- N MailFolderPresence.

Consequencias:
- mover mensagem de pasta nao duplica dominio;
- flags de pasta ficam na presenca;
- thread e vinculo se apoiam na mensagem canonica;
- historico de movimentacao por pasta fica rastreavel.

## Dominio minimo recomendado

- MailAccount
- MailFolder
- MailMessage
- MailFolderPresence
- MailThread
- MailAttachment
- MailLink
- MailSyncCheckpoint
- MailAuditLog
- OutboundMessage
- MailEvent

## Estrategia de vinculacao do MVP

Camadas permitidas:
1. heranca por thread ja vinculada;
2. codigo da garantia no assunto;
3. codigo da garantia no corpo;
4. vinculacao manual.

Politica:
- se houver candidato unico e consistente, auto-vincula;
- se houver ambiguidade, vai para fila manual;
- toda heranca deve ser auditada como INHERITED;
- remetente conhecido e heuristicas compostas ficam para fase futura.

## Autenticacao e autorizacao

- autenticacao herdada da intranet atual;
- email-service nao cria IAM paralelo;
- autorizacao via claims/perfis ja emitidos;
- auditoria deve registrar o usuario efetivo da acao manual.