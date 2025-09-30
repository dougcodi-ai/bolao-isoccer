# Publicar no GitHub (v01) e vincular à Vercel

Este guia ensina como publicar seu projeto no GitHub (versão inicial v01) e depois vinculá‑lo à Vercel, incluindo o agendamento diário do job de logos.

## 1) Criar repositório no GitHub
- Acesse o GitHub e crie um repositório novo (público ou privado).
- Nome sugerido: `bolao-isoccer` (ou outro de sua preferência).
- Não adicione README/License pelo GitHub; vamos subir tudo localmente.

## 2) Inicializar Git local e fazer o primeiro push
Abra o PowerShell e execute (ajuste o caminho e o repositório):

```powershell
cd "C:\Users\doug_\OneDrive\Documentos\Aplicativo Bolão\Bolão ISoccer"

git init
git branch -M main

# Garanta que .env e .env.local NÃO serão comitados
git status

git add .
git commit -m "v0.1: projeto inicial"

# Substitua pelos seus dados
git remote add origin https://github.com/<seu-usuario>/<seu-repo>.git

git push -u origin main

# Crie a tag v01
git tag v0.1.0
git push origin v0.1.0
```

> Dica: se o Git pedir login, use um Personal Access Token (PAT) do GitHub em vez de senha.

## 3) Configurar Vercel (importar repositório)
- Acesse Vercel → New Project → Import Git Repository.
- Se for monorepo: defina `Root Directory` = `apps/web` (onde está o app Next.js).
- Configure as variáveis de ambiente (em Production e Preview):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (apenas no servidor; nunca comitar em arquivos)

## 4) Agendar o job diário de logos (Vercel Cron)
Crie um Cron Job em Settings → Functions → Cron Jobs:
- Path: `/api/jobs/sync-team-logos`
- Schedule: `0 6 * * *` (06:00 UTC ≈ 03:00 BRT)

Alternativa por arquivo: o projeto já inclui `vercel.json` na raiz com o cron configurado. Ao importar o repo, a Vercel lerá este arquivo e criará o cron automaticamente.

## 5) Verificar execução
- Acesse `https://SEU_DOMINIO/api/jobs/sync-team-logos` para testar manualmente.
- Consulte os logs da Vercel após a primeira execução do cron.
- Resposta esperada: JSON com `updatedCount` e `skippedCount`.

## 6) Boas práticas e segurança
- Nunca comitar `SUPABASE_SERVICE_ROLE_KEY`; mantenha apenas nas variáveis de ambiente da Vercel (ou serviço de hospedagem).
- `.env`, `.env.local` já estão ignorados em `.gitignore`.
- Agende o cron em janela de baixa carga.

## 7) Opcional: Google Cloud Scheduler
Se preferir GCP, crie um job HTTP (em UTC):

```bash
gcloud scheduler jobs create http sync-team-logos \
  --schedule="0 6 * * *" \
  --time-zone="America/Sao_Paulo" \
  --http-method=GET \
  --uri="https://SEU_DOMINIO/api/jobs/sync-team-logos"
```

> Para proteger com OIDC, adicione `--oidc-*` como no guia em `apps/web/CRON_LOGOS_JOB_GUIDE.md`.

## 8) Próximas versões
- Após ajustes, crie novas tags: `git tag v0.2.0 && git push origin v0.2.0`.
- Use Pull Requests para organizar as mudanças entre versões.