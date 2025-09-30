# Job diário de logos: Guia de agendamento

Este guia explica como agendar a execução diária da rota `GET /api/jobs/sync-team-logos` para sincronizar logos dos times dos 5 campeonatos canônicos (BRA-1, BRA-2, BRCUP, LIB, SULA).

## Pré‑requisitos
- Rota implementada: `apps/web/src/app/api/jobs/sync-team-logos/route.ts`.
- Variáveis de ambiente configuradas no projeto (produção):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (apenas no servidor)
- Domínio público da aplicação (ex.: `https://seu-projeto.vercel.app`).

> Observação: O horário de agendamento recomendado é 03:00 BRT. Em UTC, isso equivale a 06:00 (ajuste conforme DST). Expressões CRON geralmente são definidas em UTC.

## Opção A: Vercel Cron (Dashboard ou vercel.json)

### Via Dashboard (recomendado)
1. Abra o projeto no Vercel.
2. Acesse: Settings → Functions → Cron Jobs.
3. Crie um novo Cron Job:
   - Path: `/api/jobs/sync-team-logos`
   - Schedule: `0 6 * * *` (executa diariamente às 06:00 UTC ≈ 03:00 BRT)
   - Region: (padrão) ou a região onde seu projeto roda melhor.
4. Salve e verifique nos logs após a primeira execução.

### Via arquivo vercel.json (controle por código)
Crie (ou edite) `vercel.json` na raiz do projeto com:

```json
{
  "crons": [
    {
      "path": "/api/jobs/sync-team-logos",
      "schedule": "0 6 * * *"
    }
  ]
}
```

> Dicas:
> - O horário é em UTC; ajuste para o horário desejado.
> - O cron executa um `GET` no path indicado.
> - Mantenha a rota idempotente. Ela já usa upsert no Storage e atualiza `football_teams.logo_path`.

## Opção B: Google Cloud Scheduler (gatilho HTTP)

1. Crie um job via `gcloud` CLI (ou pelo Console):

```bash
gcloud scheduler jobs create http sync-team-logos \
  --schedule="0 6 * * *" \
  --time-zone="America/Sao_Paulo" \
  --http-method=GET \
  --uri="https://SEU_DOMINIO/api/jobs/sync-team-logos"
```

2. (Opcional) Proteção com OIDC se a rota exigir autenticação:

```bash
gcloud scheduler jobs create http sync-team-logos \
  --schedule="0 6 * * *" \
  --time-zone="America/Sao_Paulo" \
  --http-method=GET \
  --uri="https://SEU_DOMINIO/api/jobs/sync-team-logos" \
  --oidc-service-account-email="SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --oidc-token-audience="https://SEU_DOMINIO/" 
```

> Caso mantenha a rota pública (sem OIDC/secret), garanta limites de rate e monitore para evitar abusos.

## Verificação e Monitoramento
- Teste manual: abra `https://SEU_DOMINIO/api/jobs/sync-team-logos` no navegador.
- Logs:
  - Vercel: Project → Logs.
  - GCP: Cloud Scheduler → Job → Logs.
- Métrica de sucesso: resposta JSON com `updatedCount` e `skippedCount` > 0 periodicamente.

## Boas práticas
- Agende em janela de baixa carga (ex.: madrugada BRT).
- Mantenha a rota idempotente (já implementado no job).
- Evite baixar logos repetidamente: o job já pula times com `logo_path` preenchido.
- Se necessário, adicione um segredo simples (ex.: cabeçalho `x-cron-secret`) e valide na rota.

## Troubleshooting
- 403/401 ao usar Service Role: confirme `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente do ambiente de produção.
- 404: confirme o path exato `/api/jobs/sync-team-logos` e o domínio.
- Erros de upload: verifique se o bucket `team-logos` existe e é público para leitura.

---
Com este agendamento, a sincronização diária de logos mantém o Front-End rápido e consistente, aproveitando o cache no Supabase Storage e reduzindo chamadas diretas ao provider externo.