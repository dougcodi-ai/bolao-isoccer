-- Supabase schema for ISoccer pools MVP
-- Run this in Supabase SQL editor. It creates tables and RLS policies.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (optional, to store display name)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are viewable by owner" on public.profiles
for select using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles
for insert with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles
for update using (auth.uid() = id);

-- Pools (bolões)
create table if not exists public.pools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  championship text, -- Campeonato associado ao bolão
  premium boolean default false,
  max_members int default 50,
  created_at timestamp with time zone default now()
);

alter table public.pools enable row level security;
-- Evita referenciar pool_members antes de existir
create policy "Pools readable by owner" on public.pools
for select using (owner_id = auth.uid());
create policy "Owner can update pool" on public.pools
for update using (owner_id = auth.uid());
create policy "Owner can delete pool" on public.pools
for delete using (owner_id = auth.uid());
create policy "Anyone can create a pool when authenticated" on public.pools
for insert with check (auth.uid() = owner_id);

-- Pool members
create table if not exists public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'owner' | 'admin' | 'member'
  joined_at timestamp with time zone default now(),
  primary key (pool_id, user_id)
);

alter table public.pool_members enable row level security;
create policy "Members can view their membership" on public.pool_members
for select using (user_id = auth.uid());
create policy "Members can join pools" on public.pool_members
for insert with check (user_id = auth.uid());
create policy "Owners/admins can update roles" on public.pool_members
for update using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);
create policy "Owners/admins can remove members" on public.pool_members
for delete using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

-- Agora que pool_members existe, acrescenta leitura por membros em pools
create policy "Pools readable by members" on public.pools
for select using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = id and m.user_id = auth.uid()
  )
);

-- Matches (jogos)
create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  start_time timestamp with time zone not null,
  home_score int,
  away_score int,
  created_at timestamp with time zone default now()
);

alter table public.matches enable row level security;
create policy "Matches viewable by members" on public.matches
for select using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid()
  )
);
create policy "Owners/admins can manage matches" on public.matches
for all using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

-- Predictions (palpites)
create table if not exists public.predictions (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  home_pred int not null,
  away_pred int not null,
  created_at timestamp with time zone default now(),
  primary key (match_id, user_id)
);

alter table public.predictions enable row level security;
create policy "Users can view their predictions in pools they are members of" on public.predictions
for select using (
  exists (
    select 1 from public.matches mt
    join public.pool_members pm on pm.pool_id = mt.pool_id
    where mt.id = match_id and pm.user_id = auth.uid()
  ) and user_id = auth.uid()
);
create policy "Users insert/update their predictions before match starts" on public.predictions
for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.matches mt
    where mt.id = match_id and mt.start_time > now()
  )
);
create policy "Users can update their predictions before match starts" on public.predictions
for update using (
  user_id = auth.uid() and exists (
    select 1 from public.matches mt
    where mt.id = match_id and mt.start_time > now()
  )
);

-- Points (pontuações)
create table if not exists public.points (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points int not null default 0,
  updated_at timestamp with time zone default now(),
  primary key (pool_id, user_id)
);

alter table public.points enable row level security;
create policy "Members view points" on public.points
for select using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid()
  )
);
create policy "System (owner/admin) updates points" on public.points
for update using (
  exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid() and m.role in ('owner','admin')
  )
);

-- Allow members to insert their own points row
create policy "Members can insert own points" on public.points
for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid()
  )
);

-- Allow members to update their own points
create policy "Members can update own points" on public.points
for update using (
  user_id = auth.uid() and exists (
    select 1 from public.pool_members m
    where m.pool_id = pool_id and m.user_id = auth.uid()
  )
);

-- Booster purchases (micro-transactions placeholder)
create table if not exists public.booster_purchases (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid references public.pools(id) on delete cascade, -- nullable: compra pertence ao usuário
  user_id uuid not null references auth.users(id) on delete cascade,
  booster text not null,
  amount int not null default 1,
  created_at timestamp with time zone default now()
);

alter table public.booster_purchases enable row level security;
-- Policies atualizadas para inventário por usuário (sem vínculo obrigatório ao bolão)
drop policy if exists "Members can view own boosters" on public.booster_purchases;
create policy "Users can view own boosters" on public.booster_purchases
for select using (user_id = auth.uid());
drop policy if exists "Members can buy boosters for pools they belong to" on public.booster_purchases;
create policy "Users can buy boosters for themselves" on public.booster_purchases
for insert with check (user_id = auth.uid());

-- Enforce max members per pool
create or replace function public.enforce_pool_member_limit() returns trigger as $$
begin
  -- Prevent insert if pool has reached max_members
  if (
    select count(*) from public.pool_members where pool_id = new.pool_id
  ) >= (
    select max_members from public.pools where id = new.pool_id
  ) then
    raise exception 'Limite de membros atingido para este bolão.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Ensure trigger exists (idempotent)
drop trigger if exists trg_enforce_pool_member_limit on public.pool_members;
create trigger trg_enforce_pool_member_limit
before insert on public.pool_members
for each row execute function public.enforce_pool_member_limit();

-- Plan/payment columns for pools
alter table public.pools add column if not exists plan_key text check (plan_key in ('free','craque','lenda','fenomeno','galera')) default 'free';
alter table public.pools add column if not exists price_cents int default 0;
alter table public.pools add column if not exists payment_status text check (payment_status in ('pending','paid','canceled')) default 'paid';
alter table public.pools add column if not exists championship text;
alter table public.pools add column if not exists stripe_session_id text;

-- ==========================================
-- Football canonical tables (provider-agnostic)
-- ==========================================

-- Competitions
create table if not exists public.football_competitions (
  id uuid primary key default uuid_generate_v4(),
  code text, -- e.g., BRA-1
  name text not null,
  country text,
  ext_provider text, -- e.g., kariofreire, future providers
  ext_id text,
  created_at timestamptz default now()
);

create unique index if not exists idx_football_competitions_provider_ext
  on public.football_competitions (ext_provider, ext_id);
create unique index if not exists idx_football_competitions_code
  on public.football_competitions (code);

alter table public.football_competitions enable row level security;
create policy "Football competitions public read" on public.football_competitions
for select using (true);

-- Seasons
create table if not exists public.football_seasons (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references public.football_competitions(id) on delete cascade,
  year int not null,
  name text,
  start_date date,
  end_date date,
  ext_provider text,
  ext_id text,
  created_at timestamptz default now()
);

create unique index if not exists idx_football_seasons_unique
  on public.football_seasons (competition_id, year);
create unique index if not exists idx_football_seasons_provider_ext
  on public.football_seasons (ext_provider, ext_id);

alter table public.football_seasons enable row level security;
create policy "Football seasons public read" on public.football_seasons
for select using (true);

-- Teams
create table if not exists public.football_teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  short_name text,
  acronym text,
  country text,
  logo_path text, -- storage path under team-logos bucket
  ext_provider text,
  ext_id text,
  created_at timestamptz default now()
);

create unique index if not exists idx_football_teams_provider_ext
  on public.football_teams (ext_provider, ext_id);

alter table public.football_teams enable row level security;
create policy "Football teams public read" on public.football_teams
for select using (true);

-- Matches
create table if not exists public.football_matches (
  id uuid primary key default uuid_generate_v4(),
  competition_id uuid not null references public.football_competitions(id) on delete cascade,
  season_id uuid not null references public.football_seasons(id) on delete cascade,
  round text,
  matchday int,
  start_time timestamptz not null,
  status text not null check (status in ('scheduled','live','finished','postponed','canceled','suspended')),
  home_team_id uuid not null references public.football_teams(id),
  away_team_id uuid not null references public.football_teams(id),
  home_score int,
  away_score int,
  venue text,
  referee text,
  ext_provider text,
  ext_id text,
  created_at timestamptz default now()
);

create index if not exists idx_football_matches_comp_season_day
  on public.football_matches (competition_id, season_id, matchday);
create unique index if not exists idx_football_matches_provider_ext
  on public.football_matches (ext_provider, ext_id);

alter table public.football_matches enable row level security;
create policy "Football matches public read" on public.football_matches
for select using (true);

-- ==========================================
-- Supabase Storage bucket for team logos
-- ==========================================
-- Create public bucket 'team-logos' if it doesn't exist
insert into storage.buckets (id, name, public)
select 'team-logos', 'team-logos', true
where not exists (select 1 from storage.buckets where id = 'team-logos');

-- Public read policy for objects in 'team-logos'
create policy "Public read access for team-logos" on storage.objects
for select using (bucket_id = 'team-logos');

-- Note: No insert/update/delete policies are defined so only Service Role can write.