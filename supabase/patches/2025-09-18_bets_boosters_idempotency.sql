-- Patch: predictions status/market/outcome, booster_usages status, booster_purchases source, idempotency_log, notifications
-- Executar no SQL Editor do Supabase

-- 1) Predictions: adicionar status e market (+ outcome opcional para 1x2)
alter table public.predictions
  add column if not exists status text check (status in ('active','reverted_by_undo')) default 'active';

alter table public.predictions
  add column if not exists market text not null default '1x2';

alter table public.predictions
  add column if not exists outcome smallint check (outcome in (-1,0,1));

create index if not exists idx_predictions_active_match on public.predictions (match_id) where status = 'active';

-- 2) Booster usages: status para expiração/reembolso/consumo
alter table public.booster_usages
  add column if not exists status text check (status in ('pending','consumed','expired','refunded')) default 'pending';

-- 3) Booster purchases: origem da aquisição (purchase/refund/bonus)
alter table public.booster_purchases
  add column if not exists source text default 'purchase';

-- 4) Idempotency log: armazenamento de respostas por 24h (acesso apenas via service role)
create table if not exists public.idempotency_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  request_hash text,
  response jsonb,
  status_code int,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours'),
  unique (user_id, key)
);

alter table public.idempotency_log enable row level security;
-- Sem políticas propositais: apenas service role (bypassa RLS) acessa

create index if not exists idx_idem_expires_at on public.idempotency_log (expires_at);

-- 5) Notifications simples (mural/in-app)
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid references public.pools(id) on delete set null,
  type text not null,
  title text,
  body text,
  meta jsonb,
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table public.notifications enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'notifications' AND p.policyname = 'User can view own notifications'
  ) THEN
    CREATE POLICY "User can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'notifications' AND p.policyname = 'User can insert own notifications'
  ) THEN
    CREATE POLICY "User can insert own notifications" ON public.notifications
    FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;
-- Atualizações de leitura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'notifications' AND p.policyname = 'User can mark own notifications read'
  ) THEN
    CREATE POLICY "User can mark own notifications read" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;