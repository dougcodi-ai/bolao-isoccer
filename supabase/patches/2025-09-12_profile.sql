-- Patch: Perfil do Usuário, Boosters (usos), Achievements, Pagamentos, Avatares
-- Executar no SQL Editor do Supabase

-- 1) Profiles: avatar e preferences
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists preferences jsonb default '{}'::jsonb;

-- 2) Booster usages (histórico de uso)
create table if not exists public.booster_usages (
  id uuid primary key default uuid_generate_v4(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  booster text not null,
  used_at timestamptz default now(),
  expires_at timestamptz
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
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_usages' AND p.policyname = 'User can insert own booster usages in pools they belong'
  ) THEN
    CREATE POLICY "User can insert own booster usages in pools they belong" ON public.booster_usages
    FOR INSERT WITH CHECK (
      user_id = auth.uid() AND EXISTS(
        SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid()
      )
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'booster_usages' AND p.policyname = 'Owners/Admins manage booster usages in own pool'
  ) THEN
    CREATE POLICY "Owners/Admins manage booster usages in own pool" ON public.booster_usages
    FOR ALL USING (
      EXISTS(
        SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
    ) WITH CHECK (
      EXISTS(
        SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
    );
  END IF;
END
$$;

-- 3) Achievements básicos
create table if not exists public.user_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  earned_at timestamptz default now(),
  meta jsonb
);

alter table public.user_achievements enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'user_achievements' AND p.policyname = 'User can view own achievements'
  ) THEN
    CREATE POLICY "User can view own achievements" ON public.user_achievements
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'user_achievements' AND p.policyname = 'User can insert own achievements'
  ) THEN
    CREATE POLICY "User can insert own achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

-- 4) Histórico de pagamentos (gravado pelo webhook)
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  pool_id uuid references public.pools(id) on delete set null,
  amount_cents int,
  status text check (status in ('pending','paid','canceled','failed')) default 'paid',
  stripe_session_id text,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'payments' AND p.policyname = 'User can view own payments'
  ) THEN
    CREATE POLICY "User can view own payments" ON public.payments
    FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'payments' AND p.policyname = 'Pool owner/admin can view pool payments'
  ) THEN
    CREATE POLICY "Pool owner/admin can view pool payments" ON public.payments
    FOR SELECT USING (
      EXISTS(
        SELECT 1 FROM public.pool_members m WHERE m.pool_id = pool_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
      )
    );
  END IF;
END
$$;

-- 5) Permitir que membro saia do bolão
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = 'pool_members' AND p.policyname = 'Member can leave pool'
  ) THEN
    CREATE POLICY "Member can leave pool" ON public.pool_members
    FOR DELETE USING (user_id = auth.uid());
  END IF;
END
$$;

-- 6) Bucket de avatares (leitura pública, upload autenticado)
insert into storage.buckets (id, name, public)
select 'avatars', 'avatars', true
where not exists (select 1 from storage.buckets where id = 'avatars');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = 'Public read access for avatars'
  ) THEN
    CREATE POLICY "Public read access for avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = 'Authenticated can upload avatars'
  ) THEN
    CREATE POLICY "Authenticated can upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = 'Authenticated can update avatars'
  ) THEN
    CREATE POLICY "Authenticated can update avatars" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects' AND p.policyname = 'Authenticated can delete avatars'
  ) THEN
    CREATE POLICY "Authenticated can delete avatars" ON storage.objects
    FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END
$$;