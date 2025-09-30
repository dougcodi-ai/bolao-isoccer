-- Patch: Função atômica de consumo de booster com advisory lock
-- Executar no Supabase SQL Editor (idempotente)

set search_path = public;

create or replace function public.consume_booster(
  p_user_id uuid,
  p_booster text,
  p_pool_id uuid default null,
  p_match_id uuid default null,
  p_status text default 'consumed'
) returns table(ok boolean, usage_id uuid)
language plpgsql
security definer
as $$
declare
  v_purchased int;
  v_consumed int;
  v_available int;
  v_new_id uuid;
begin
  -- Lock transacional por usuário+booster para evitar race conditions
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(coalesce(p_booster, '')));

  -- Quantidade adquirida
  select coalesce(sum(amount), 0) into v_purchased
  from public.booster_purchases
  where user_id = p_user_id and booster = p_booster;

  -- Quantidade já consumida/reservada (status in ('consumed','pending')) para evitar oversubscription
  select coalesce(count(*), 0) into v_consumed
  from public.booster_usages
  where user_id = p_user_id and booster = p_booster and status in ('consumed','pending');

  v_available := v_purchased - v_consumed;

  if v_available < 1 then
    ok := false;
    usage_id := null;
    return;
  end if;

  insert into public.booster_usages (pool_id, user_id, match_id, booster, status)
  values (p_pool_id, p_user_id, p_match_id, p_booster, coalesce(p_status, 'consumed'))
  returning id into v_new_id;

  ok := true;
  usage_id := v_new_id;
  return;
end;
$$;

-- Opcional: conceder execução para authenticated e anon (consumo via endpoint com service role é recomendado)
-- grant execute on function public.consume_booster(uuid, text, uuid, uuid, text) to authenticated, anon;