-- Patch: add round and team acronyms to public.matches
alter table if exists public.matches add column if not exists round int;
alter table if exists public.matches add column if not exists home_acr text;
alter table if exists public.matches add column if not exists away_acr text;
-- Optional index for faster filters by round
create index if not exists idx_matches_pool_round on public.matches(pool_id, round);