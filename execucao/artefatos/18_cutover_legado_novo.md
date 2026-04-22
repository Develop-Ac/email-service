# 18 Cutover Legado x Novo Servico

## Objetivo

Migrar do modelo atual (garantia-service + n8n no fluxo de e-mail) para o email-service sem parar operacao e sem perder rastreabilidade.

## Principios

- cutover progressivo por conta;
- rollback por conta;
- sem big-bang;
- evidencias de qualidade por fase;
- estado canonico deve migrar para email-service;
- n8n deixa de ser nucleo e vira consumidor periferico.

## Etapas do cutover

### Etapa 0 - Preparacao

1. Publicar email-service em ambiente de homologacao/producao.
2. Aplicar SQL inicial `0001_email_service_initial_schema.sql`.
3. Configurar RabbitMQ, filas e DLQ.
4. Configurar integracao REST interna email-service -> garantia-service.
5. Habilitar observabilidade minima (logs, metricas, health).

Saida esperada:
- servico novo ativo, mas sem trafego de negocio.

### Etapa 1 - Shadow Sync

1. Selecionar 1 conta piloto de baixo risco.
2. Rodar sync no email-service sem expor inbox ao usuario final.
3. Manter fluxo legado ativo em paralelo.
4. Comparar diariamente:
   - volume de mensagens;
   - deduplicacao;
   - anexos;
   - threads;
   - latencia.

Saida esperada:
- divergencia abaixo do limite acordado por 5 dias uteis consecutivos.

### Etapa 2 - Read Cutover

1. Frontend passa a ler inbox/thread do email-service para conta piloto.
2. Legado continua recebendo, mas sem ser tela principal.
3. Vinculo manual ja operando no email-service.

Saida esperada:
- operacao diaria consegue trabalhar no frontend novo sem perda funcional.

### Etapa 3 - Linking Cutover

1. Ativar auto-vinculo do MVP no email-service para conta piloto.
2. Desativar vinculacao automatica equivalente no legado.
3. Manter auditoria reforcada de decisoes auto/manual.

Saida esperada:
- fila de nao vinculados sob controle;
- sem falso positivo critico sem rastreabilidade.

### Etapa 4 - Outbound Cutover

1. Ativar resposta/encaminhamento pelo email-service.
2. Desativar envio SMTP direto no garantia-service para a conta piloto.
3. Validar threading de saida e recebimento de respostas.

Saida esperada:
- envio e resposta estao ponta a ponta no novo servico.

### Etapa 5 - Desativacao por conta no legado

1. Bloquear polling/processamento legado para a conta piloto.
2. Manter somente leitura historica no legado por janela de seguranca.
3. Confirmar que n8n consome apenas eventos do email-service.

Saida esperada:
- conta piloto 100% no novo servico.

### Etapa 6 - Rollout para demais contas

1. Repetir etapas 1 a 5 para cada conta.
2. Migrar contas por ondas pequenas.
3. Priorizar contas de menor criticidade nas primeiras ondas.

Saida esperada:
- todas as contas migradas com risco controlado.

## Criterios de go/no-go por etapa

Go quando:
- erro de sync < 1%;
- fila DLQ sem crescimento continuo;
- tempo medio de processamento dentro do SLA;
- sem incidente funcional critico de vinculo.

No-go quando:
- divergencia relevante entre legado e novo;
- volume alto de falha de parse ou thread;
- indisponibilidade frequente de integracao REST com garantia-service.

## Estrategia de rollback

Rollback por conta, nunca global:

1. Marcar conta como `LEGACY_ACTIVE` em feature flag.
2. Frontend volta a ler fluxo legado para a conta.
3. Suspender workers novos da conta.
4. Preservar dados ja capturados no email-service para analise.
5. Abrir incidente com causa raiz e plano de correcao.

## Feature flags recomendadas

- `EMAIL_SERVICE_SYNC_ENABLED_BY_ACCOUNT`
- `EMAIL_SERVICE_READ_ENABLED_BY_ACCOUNT`
- `EMAIL_SERVICE_AUTO_LINK_ENABLED_BY_ACCOUNT`
- `EMAIL_SERVICE_OUTBOUND_ENABLED_BY_ACCOUNT`
- `EMAIL_SERVICE_LEGACY_FALLBACK_ENABLED`

## Matriz de responsabilidade no cutover

email-service:
- sync, parse, thread, link, outbound, eventos.

garantia-service:
- validacao de garantia e regras de aceitacao de vinculo.

frontend:
- operar inbox/thread/vinculo no backend novo.

n8n:
- consumir eventos; nao processar inbox como fonte primaria.

operacao:
- acompanhar metricas, aprovar viradas, executar rollback quando necessario.

## Checklist por conta antes da virada final

1. Credenciais IMAP/SMTP validadas.
2. Sync inicial concluido sem erro critico.
3. Auto-vinculo MVP validado com amostra real.
4. Fluxo manual validado pela equipe de qualidade.
5. Outbound validado com thread de ida e volta.
6. Eventos RabbitMQ consumidos por garantia-service e n8n.
7. Plano de rollback testado.