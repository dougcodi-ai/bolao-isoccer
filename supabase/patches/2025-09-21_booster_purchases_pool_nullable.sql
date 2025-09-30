-- Ensure booster purchases are USER-scoped, not pool-scoped
-- Make pool_id nullable (drop NOT NULL) so purchases are not tied to a specific pool

alter table if exists public.booster_purchases
  alter column pool_id drop not null;

-- Optional: if an index enforces pool scoping assumptions, none is changed here.
-- RLS already allows users to insert/select their own purchases without requiring pool_id.