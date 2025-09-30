-- Patch: Boosters catalog, booster_activations, matches.status, basic RLS
-- Execute in Supabase SQL Editor (idempotent)

-- 1) Boosters catalog
create table if not exists public.boosters (
  id text primary key,
  name text not null,
  description text,
  kind text check (kind in ('temporal','by_match')) not null default 'by_match',
  default_duration_days int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.boosters enable row level security;
-- Public read catalog (idempotente via checagem no catálogo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'boosters' AND p.policyname = 'Boosters public read'
  ) THEN
    CREATE POLICY "Boosters public read" ON public.boosters
    FOR SELECT USING (true);
  END IF;
END
$$;
-- Only admins could manage via SQL; skipping explicit admin policy here

-- Seed minimal catalog if missing
insert into public.boosters (id, name, description, kind, default_duration_days, metadata)
select 'o_esquecido', 'O Esquecido', 'Permite inserir palpite até T-15 (janela estendida após T-60).', 'by_match', null, '{}'::jsonb
where not exists (select 1 from public.boosters where id = 'o_esquecido');

insert into public.boosters (id, name, description, kind, default_duration_days, metadata)
select 'segunda_chance', 'Segunda Chance', 'Permite alterar um palpite já feito até o início (T0).', 'by_match', null, '{}'::jsonb
where not exists (select 1 from public.boosters where id = 'segunda_chance');

insert into public.boosters (id, name, description, kind, default_duration_days, metadata)
select 'o_escudo', 'O Escudo', 'Protege palpites por 7 dias corridos a partir da ativação.', 'temporal', 7, '{}'::jsonb
where not exists (select 1 from public.boosters where id = 'o_escudo');

insert into public.boosters (id, name, description, kind, default_duration_days, metadata)
select 'palpite_automatico', 'Palpite Automático', 'Gera palpite padrão (2x0 mandante) no fechamento (T-60) se não houver palpite.', 'temporal', 7, jsonb_build_object('default_home_goals',2,'default_away_goals',0)
where not exists (select 1 from public.boosters where id = 'palpite_automatico');

-- 2) Booster activations (global or per-match)
create table if not exists public.booster_activations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid references public.pools(id) on delete cascade,
  booster_id text not null references public.boosters(id) on delete cascade,
  scope text check (scope in ('global','match')) not null default 'match',
  match_id uuid references public.matches(id) on delete set null,
  activated_at timestamptz default now(),
  expires_at timestamptz,
  status text check (status in ('active','expired','revoked')) default 'active',
  notes text
);

create index if not exists idx_booster_activations_user on public.booster_activations(user_id);
create index if not exists idx_booster_activations_match on public.booster_activations(match_id);
create index if not exists idx_booster_activations_expiry on public.booster_activations(expires_at);

alter table public.booster_activations enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_activations' AND p.policyname = 'User can view own booster activations'
  ) THEN
    CREATE POLICY "User can view own booster activations" ON public.booster_activations
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_activations' AND p.policyname = 'User can insert own booster activations (pool members)'
  ) THEN
    CREATE POLICY "User can insert own booster activations (pool members)" ON public.booster_activations
    FOR INSERT WITH CHECK (
      user_id = auth.uid() AND (
        pool_id IS NULL OR EXISTS (
          SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid()
        )
      )
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_activations' AND p.policyname = 'Owners/Admins manage booster activations in pool'
  ) THEN
    CREATE POLICY "Owners/Admins manage booster activations in pool" ON public.booster_activations
    FOR ALL USING (
      pool_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
    ) WITH CHECK (
      pool_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
    );
  END IF;
END
$$;

-- 3) Matches status per PRD
alter table if exists public.matches add column if not exists status text check (status in ('scheduled','live','finished','pending_result')) default 'scheduled';
create index if not exists idx_matches_pool_status on public.matches(pool_id, status);

-- 4) Booster usages status already added in prior patch; ensure table exists
create table if not exists public.booster_usages (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  booster text not null,
  used_at timestamptz default now(),
  expires_at timestamptz,
  status text check (status in ('pending','consumed','expired','refunded')) default 'consumed'
);

alter table public.booster_usages enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_usages' AND p.policyname = 'User can view own booster usages'
  ) THEN
    CREATE POLICY "User can view own booster usages" ON public.booster_usages
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_usages' AND p.policyname = 'User can insert own booster usages (pool members)'
  ) THEN
    CREATE POLICY "User can insert own booster usages (pool members)" ON public.booster_usages
    FOR INSERT WITH CHECK (
      user_id = auth.uid() AND (
        pool_id IS NULL OR EXISTS(
          SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid()
        )
      )
    );
  END IF;
END
$$;