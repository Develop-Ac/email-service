# 08 DevOps

## Topologia operacional recomendada

Componentes:
- api do email-service;
- worker-sync;
- worker-parse;
- worker-thread;
- worker-link;
- worker-outbound;
- worker-event-publisher;
- PostgreSQL;
- RabbitMQ;
- MinIO/S3.

## Filas iniciais

- queue.email.sync
- queue.email.parse
- queue.email.thread
- queue.email.link
- queue.email.outbound
- queue.email.event.publish
- queue.email.retry
- queue.email.dlq

## Observabilidade minima

Metricas:
- lag de sync por conta;
- quantidade de mensagens novas por conta;
- tempo medio de parsing;
- taxa de falha por fila;
- tempo de vinculacao;
- tamanho da fila de nao vinculados;
- taxa de reprocessamento.

Logs:
- correlation_id por mensagem;
- account_id;
- folder_id;
- thread_id;
- message_id_header;
- etapa atual do pipeline.

Health checks:
- banco;
- RabbitMQ;
- MinIO/S3;
- readiness da API;
- conectividade das contas em job separado e controlado.

## Deploy e migracao operacional

Regra de implantacao:
- primeiro subir email-service em paralelo;
- depois conectar conta piloto;
- depois rodar shadow mode;
- depois fazer cutover por conta.

## Banco de dados

Diretriz obrigatoria:
- entregar SQL direto versionado;
- nao usar Prisma Migrate como estrategia de implantacao.