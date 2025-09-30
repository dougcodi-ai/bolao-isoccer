# Supabase: Esquema, RLS e Guia de Validação

Este documento descreve as tabelas, políticas RLS e como aplicá-las/validá-las no seu projeto Supabase para o ISoccer.

## Pré‑requisitos
- Projeto Supabase criado e acessível em: `https://rltqilyhdtwyriovfetx.supabase.co`
- Chaves já configuradas no app:
  - Frontend: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (em apps/web/.env.local)
  - Nunca commitar a Service Role Key (somente use na Dashboard quando necessário)

## Aplicando o schema
1. Acesse o painel do Supabase do seu projeto.
2. Vá em SQL Editor.
3. Abra o arquivo local `supabase/schema.sql` e copie todo o conteúdo.
4. Cole no SQL Editor e execute.
5. Verifique se todas as tabelas e políticas foram criadas sem erros.

> Observação: O script ativa a extensão `uuid-ossp` e cria as tabelas com RLS e políticas necessárias.

## Tabelas criadas
- public.profiles
  - id (uuid, PK, = auth.users.id)
  - display_name (text)
  - created_at (timestamptz)
  - RLS: select/insert/update apenas pelo próprio usuário

- public.pools (bolões)
  - id (uuid, PK)
  - name (text, not null)
  - code (text, unique, not null) — código de convite
  - owner_id (uuid, FK -> auth.users.id)
  - premium (boolean, default false)
  - max_members (int, default 50)
  - created_at (timestamptz)
  - RLS:
    - select: apenas membros ou owner
    - insert: autenticado pode criar se owner_id = auth.uid()
    - update/delete: apenas owner

- public.pool_members (membros do bolão)
  - pool_id (uuid, FK -> pools.id)
  - user_id (uuid, FK -> auth.users.id)
  - role (text: owner|admin|member, default member)
  - joined_at (timestamptz)
  - PK: (pool_id, user_id)
  - RLS:
    - select: somente o próprio usuário vê sua associação
    - insert: usuário só insere a própria linha
    - update/delete: apenas owner/admin do respectivo bolão

- public.matches (jogos)
  - id (uuid, PK)
  - pool_id (uuid, FK -> pools.id)
  - home_team, away_team (text)
  - start_time (timestamptz)
  - home_score, away_score (int, opcionais)
  - created_at (timestamptz)
  - RLS:
    - select: membros do bolão
    - all/manage: apenas owner/admin

- public.predictions (palpites)
  - match_id (uuid, FK -> matches.id)
  - user_id (uuid, FK -> auth.users.id)
  - home_pred, away_pred (int)
  - created_at (timestamptz)
  - PK: (match_id, user_id)
  - RLS:
    - select: usuário vê os próprios palpites em bolões que participa
    - insert/update: permitido apenas antes do início do jogo e para o próprio usuário

- public.points (pontuação)
  - pool_id (uuid, FK -> pools.id)
  - user_id (uuid, FK -> auth.users.id)
  - points (int, default 0)
  - updated_at (timestamptz)
  - PK: (pool_id, user_id)
  - RLS:
    - select: membros do bolão
    - update: owner/admin

- public.booster_purchases (compras de boosters)
  - id (uuid, PK)
  - pool_id (uuid, FK -> pools.id)
  - user_id (uuid, FK -> auth.users.id)
  - booster (text)
  - amount (int)
  - created_at (timestamptz)
  - RLS:
    - select: apenas o próprio usuário
    - insert: permitido se usuário pertence ao bolão

## Fluxos implementados no app
- Criar bolão (apps/web/src/app/bolao/criar/page.tsx)
  - Gera `code` único
  - Insere em `pools` (owner_id = usuário atual)
  - Insere o owner em `pool_members` com role `owner`
  - Exibe o `code` para convite

- Entrar em bolão por código (apps/web/src/app/bolao/entrar/page.tsx)
  - Busca `pools` por `code`
  - Evita duplicidade em `pool_members`
  - Insere o usuário em `pool_members`

- Dashboard (apps/web/src/app/dashboard/page.tsx)
  - Lista `pools` visíveis ao usuário (RLS restringe à participação/ownership)

## Validação prática das RLS
Use dois usuários de teste (A e B):
1. A faz login e cria um bolão: deve funcionar (insert em `pools` e `pool_members`).
2. A vê o bolão no Dashboard: deve listar.
3. B faz login e tenta acessar Dashboard: não deve ver o bolão de A (antes de entrar).
4. A compartilha `code` com B; B entra usando a página “Entrar em bolão”: deve funcionar (insert em `pool_members`).
5. B agora vê o bolão de A no Dashboard: deve listar.
6. B tenta atualizar um `pool` (não há UI, mas via Console → PostgREST com bearer do usuário B, a operação deve falhar): update/delete só owner.
7. Palpites: só é possível inserir/alterar antes de `start_time` do jogo; após o início, as operações devem falhar pelo RLS.

## Dicas e troubleshoot
- Em Authentication → URL Configuration, inclua http://localhost:3000 e http://localhost:3001 nas Redirect URLs.
- Confirme as variáveis em apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).
- Caso a extensão `uuid-ossp` não esteja disponível, execute também `create extension if not exists "pgcrypto";` e troque default `uuid_generate_v4()` por `gen_random_uuid()` no schema.
- Erros de RLS com select em `pools`: verifique se o usuário está em `pool_members` daquele `pool`.

## Próximos passos
- Criar páginas de detalhe de bolão (`/bolao/[id]`), jogos, palpites e ranking.
- Automatizar atualização de `points` após fechamento de partidas.