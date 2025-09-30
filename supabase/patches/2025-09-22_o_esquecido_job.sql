-- Patch: Stored procedure + cron job para booster "O Esquecido" (idempotente)
set search_path = public;

create or replace function public.run_o_esquecido(
  p_since interval default interval '24 hours'
) returns void
language plpgsql
security definer
as $$
declare
  r record;
  v_ok boolean;
  v_usage_id uuid;
begin
  -- Itera por jogos cujo prazo expirou recentemente (últimas p_since horas)
  for r in
    select m.id as match_id, m.pool_id, pm.user_id
    from public.matches m
    join public.pool_members pm on pm.pool_id = m.pool_id
    where m.start_time <= now()
      and m.start_time >= now() - p_since
  loop
    -- Evitar corridas por usuário+partida
    perform pg_advisory_xact_lock(hashtext(r.user_id::text), hashtext(r.match_id::text || ':o_esquecido'));

    -- Se já existe palpite ativo, pula
    if exists (
      select 1 from public.predictions p
      where p.match_id = r.match_id and p.user_id = r.user_id and p.status = 'active'
    ) then
      continue;
    end if;

    -- Reserva 1 uso do booster como 'pending' (inventário)
    select ok, usage_id into v_ok, v_usage_id
    from public.consume_booster(r.user_id, 'o_esquecido', r.pool_id, r.match_id, 'pending');

    if not v_ok then
      continue; -- sem estoque disponível
    end if;

    -- Insere palpite 2x0 (mandante) se ainda não existir
    insert into public.predictions (match_id, user_id, home_pred, away_pred, status, market)
    values (r.match_id, r.user_id, 2, 0, 'active', '1x2')
    on conflict do nothing;

    if not found then
      -- Conflito/Outro processo inseriu: desfaz reserva
      update public.booster_usages set status = 'refunded' where id = v_usage_id;
      continue;
    end if;

    -- Finaliza consumo do booster
    update public.booster_usages set status = 'consumed' where id = v_usage_id;

    -- Notificação simples (opcional, Realtime pode notificar por mudanças em predictions/booster_usages)
    insert into public.notifications (user_id, pool_id, type, title, body, meta)
    values (
      r.user_id,
      r.pool_id,
      'booster:o_esquecido:aplicado',
      'O Esquecido aplicado automaticamente',
      'Aplicamos o palpite 2x0 para o mandante porque o prazo expirou sem palpite.',
      jsonb_build_object('match_id', r.match_id, 'booster','o_esquecido')
    );
  end loop;
end;
$$;

-- Habilita pg_cron e agenda execução (idempotente)
create extension if not exists pg_cron with schema extensions;
select cron.schedule('o_esquecido_every_10_min', '*/10 * * * *', $$call public.run_o_esquecido();$$)
where not exists (select 1 from cron.job where jobname = 'o_esquecido_every_10_min');