Objetivo
- Gerar uma chave nativa da Highlightly e configurar o projeto para usar o endpoint nativo via toggle `RAPIDAPI_USE_NATIVE=true`.

Passo a passo
- Crie sua conta na Highlightly: acesse `https://highlightly.net/login` e finalize o cadastro.
- Acesse o Dashboard: após login, vá ao painel e localize a seção de gerenciamento de API Keys.
- Gere uma API Key: clique em "Create API Key" (ou equivalente), copie o token gerado. Observação: esta chave é distinta da RapidAPI; contas não são sincronizadas entre plataformas.
- Verifique a cobertura: a documentação geral está em `https://highlightly.net/documentation/sports/`. Para futebol, as rotas seguem o mesmo padrão com base `https://sports.highlightly.net`.

Configuração no projeto
- Abra `apps/web/.env.local` e defina:
  - `RAPIDAPI_USE_NATIVE=true`
  - `RAPIDAPI_KEY=<SUA_CHAVE_DESTACADA_DA_HIGHLIGHTLY>`
- Não é necessário `x-rapidapi-host` quando usar a plataforma nativa.

Validação rápida
- Rode `node apps/web/scripts/seed-football.cjs`.
- O script exibirá a base utilizada: `[Highlightly] Base: https://sports.highlightly.net/football | Native: true`.
- Em caso de erro 401, confirme se a chave é da plataforma nativa (não RapidAPI) e se foi copiada corretamente.

Observações
- Caso queira voltar à RapidAPI, altere `RAPIDAPI_USE_NATIVE=false` mantendo `RAPIDAPI_KEY` com a sua chave do RapidAPI.
- Para diagnosticar disponibilidade de ligas, use `node lib/highlightly/check-leagues.cjs`.