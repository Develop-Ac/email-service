# email-service

Servico de e-mail corporativo desacoplado do garantia-service.

Objetivo imediato:
- retirar do garantia-service a responsabilidade de inbox, threading, vinculacao e envio de e-mails;
- concentrar essa responsabilidade em um servico proprio e reutilizavel;
- manter o garantia-service focado apenas em regras de negocio de garantia.

Premissas aprovadas:
- integracao sincrona interna: REST;
- integracao assincrona: RabbitMQ;
- anexos obrigatoriamente em MinIO/S3;
- sem raw MIME no MVP;
- modelo canonico de mensagem: 1 mensagem + N presencas por pasta;
- autenticacao herdada da intranet atual;
- autorizacao por claims/perfis ja existentes.

Documentacao de trabalho:
- execucao/entrada/00_briefing_usuario.md
- execucao/artefatos/00_objetivo.md
- execucao/artefatos/01_requisitos.md
- execucao/artefatos/02_arquitetura.md
- execucao/artefatos/03_plano_execucao.md
- execucao/artefatos/04_backend.md
- execucao/artefatos/06_dados_sql.md
- execucao/artefatos/07_integracoes.md
- execucao/artefatos/10_apis_contratos.md
- execucao/artefatos/08_devops.md
- execucao/artefatos/17_rabbitmq_payloads.md
- execucao/artefatos/18_cutover_legado_novo.md
- execucao/artefatos/16_resumo_final.md

Artefato SQL inicial:
- sql/0001_email_service_initial_schema.sql