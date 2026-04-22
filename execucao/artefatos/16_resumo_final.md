# 16 Resumo Final

## Decisao consolidada

Foi aprovado o desenho de um email-service dedicado, criado do zero no repositorio email-service, para retirar do garantia-service toda a responsabilidade de inbox, threading, vinculacao e envio de e-mails.

## Pilares travados

- REST interno para integracao sincrona entre email-service e garantia-service;
- RabbitMQ para integracao assincrona e pipeline interno;
- modelo canonico: 1 mensagem + N presencas por pasta;
- anexos em MinIO/S3;
- sem raw MIME no MVP;
- auto-vinculo do MVP restrito a corpo, assunto e heranca de thread;
- autenticacao e autorizacao herdadas da intranet atual.

## Resultado esperado apos implementacao

- garantia-service focado apenas em garantia;
- email-service como nucleo reutilizavel de e-mail corporativo;
- frontend operando inbox e revisao manual sobre o novo servico;
- n8n fora do centro da logica de e-mail.

## Proximo passo recomendado

Com a arquitetura e o plano aprovados, o proximo passo tecnico e detalhar o schema SQL inicial do email-service e a decomposicao dos modulos NestJS/filas para iniciar a implementacao controlada.