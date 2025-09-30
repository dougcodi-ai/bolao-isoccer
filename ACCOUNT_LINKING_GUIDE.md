# Guia personalizado de publicação e vínculo (GitHub ↔ Vercel)

Este guia usa seus identificadores informados para publicar a versão inicial (v01) no GitHub e vincular ao Vercel, com o cron diário de logos já configurado pelo `vercel.json`.

- Conta Vercel (slug): `douglas-projects-1a40c905`
- Account ID Vercel: `wRIbVBAc4eXif00l6VaioBE0`
- GitHub user: `dougcodi-ai`

## 1) Criar repositório no GitHub e fazer o primeiro push

Sugerido nome do repositório: `bolao-isoccer` (pode usar outro, se preferir).

No Windows PowerShell, a partir da raiz do projeto:

```powershell
# 1. Inicializa git, adiciona tudo e commita v01
git init
git add .
git commit -m "v01: publicação inicial"

# 2. Define a branch principal
git branch -M main

# 3. Adiciona o remoto do seu GitHub (ajuste o nome do repo se usar outro)
git remote add origin https://github.com/dougcodi-ai/bolao-isoccer.git

# 4. Primeiro push
git push -u origin main
```

Se preferir criar o repositório antes via interface web, crie em: `https://github.com/new` com owner `dougcodi-ai` e nome `bolao-isoccer`, depois execute apenas os comandos 3 e 4 acima.

## 2) Importar o repositório no Vercel

1. Acesse `https://vercel.com/dashboard` logado como `douglas-projects-1a40c905` (Account ID: `wRIbVBAc4eXif00l6VaioBE0`).
2. Clique em "Add New…" → "Project" → "Import Git Repository" e selecione `dougcodi-ai/bolao-isoccer`.
3. Durante a configuração do projeto, adicione as variáveis de ambiente (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (apenas Server)
   - (Opcional) `CRON_SECRET` para proteger a rota de logos por query string.
4. Conclua a importação e aguarde o primeiro deploy. O domínio padrão será algo como `https://<nome-do-projeto>-<hash>.vercel.app`.

## 3) Cron diário de logos

Como já existe `vercel.json` na raiz com:

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

- O Vercel criará automaticamente um Cron Job diário às 06:00 UTC (≈ 03:00 BRT).
- Valide em: Project → Settings → Functions → Cron Jobs.
- Teste manual: abra `https://SEU_DOMINIO/api/jobs/sync-team-logos`.

### (Opcional) Proteger a rota com segredo

Se quiser exigir um segredo, defina `CRON_SECRET` nas variáveis de ambiente de produção do Vercel e chame a rota com query string:

```
/api/jobs/sync-team-logos?secret=SEU_SEGREDO
```

Você pode editar o `vercel.json` para incluir o query string no path:

```json
{
  "crons": [
    {
      "path": "/api/jobs/sync-team-logos?secret=SEU_SEGREDO",
      "schedule": "0 6 * * *"
    }
  ]
}
```

E ajustar a rota para validar `secret` (já há suporte no guia de jobs). Caso prefira, posso implementar essa verificação agora.

## 4) Pós‑deploy e verificação

- Acesse a página `Palpites` e confirme paginação 15/15 por campeonato.
- Verifique logos sendo servidas do Supabase Storage (`team-logos`).
- Confira os logs do cron após a primeira execução.

## 5) Dicas rápidas

- Use o horário de baixa carga (madrugada BRT) para o cron.
- Mantenha as variáveis secretas apenas no ambiente de produção do Vercel.
- Se o projeto for movido para uma organização, o caminho no Vercel muda para `vercel.com/<org>/<project>`, mas o cron continua válido.

---
Se desejar, posso executar os comandos de git local (init/push) por você e preparar o repositório `dougcodi-ai/bolao-isoccer`. Basta confirmar o nome do repo e se quer que eu rode os comandos agora.