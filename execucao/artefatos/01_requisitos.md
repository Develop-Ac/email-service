# 01 Requisitos

## Requisitos funcionais do MVP

1. Cadastrar multiplas contas de e-mail com configuracoes IMAP/SMTP separadas.
2. Sincronizar mensagens recebidas de forma incremental por conta e por pasta.
3. Evitar duplicidade de mensagens entre pastas com modelo canonico.
4. Persistir presenca da mesma mensagem em multiplas pastas.
5. Processar headers, body_text, body_html e anexos.
6. Armazenar anexos em MinIO/S3 e manter metadados no PostgreSQL.
7. Montar threads usando Message-ID, In-Reply-To e References.
8. Permitir vinculacao automatica com garantia por:
   - codigo da garantia no assunto;
   - codigo da garantia no corpo;
   - heranca de thread ja vinculada.
9. Permitir vinculacao e desvinculacao manual no frontend.
10. Registrar auditoria completa de toda decisao automatica ou manual.
11. Permitir resposta e encaminhamento de e-mails pela intranet.
12. Publicar eventos assincronos para outros consumidores.

## Requisitos nao funcionais

- latencia alvo de sync: ate 1 minuto para novas mensagens;
- processamentos internos reexecutaveis e idempotentes;
- segregacao logica por conta;
- autorizacao baseada em claims existentes;
- observabilidade por fila, conta e etapa de processamento;
- cutover progressivo por conta com rollback controlado.

## Requisitos de integracao

- sincronas: REST interno entre email-service e garantia-service;
- assincronas: RabbitMQ;
- frontend: consumo HTTP do email-service;
- n8n: somente como consumidor periferico de eventos.

## Requisitos de dados

- PostgreSQL como armazenamento transacional do dominio de e-mail;
- schema dedicado para o email-service;
- mudancas de banco entregues por SQL direto versionado;
- raw MIME fora do MVP.