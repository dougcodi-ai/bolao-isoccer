-- Migração: Auditoria e Segurança do Banco de Dados
-- Executar no SQL Editor do Supabase

-- Tabela para logs de auditoria do banco de dados
create table if not exists public.database_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  operation text not null check (operation in ('select', 'insert', 'update', 'delete', 'upsert')),
  user_id uuid references auth.users(id) on delete set null,
  filters jsonb,
  data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- Índices para performance
create index if not exists idx_database_audit_logs_table_name on public.database_audit_logs (table_name);
create index if not exists idx_database_audit_logs_operation on public.database_audit_logs (operation);
create index if not exists idx_database_audit_logs_user_id on public.database_audit_logs (user_id);
create index if not exists idx_database_audit_logs_created_at on public.database_audit_logs (created_at);
create index if not exists idx_database_audit_logs_ip_address on public.database_audit_logs (ip_address);

-- RLS para tabela de auditoria
alter table public.database_audit_logs enable row level security;

-- Apenas administradores podem visualizar logs de auditoria
create policy "Admins can view all audit logs" on public.database_audit_logs
  for select using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'admin'
    )
  );

-- Apenas o sistema pode inserir logs de auditoria
create policy "System can insert audit logs" on public.database_audit_logs
  for insert with check (true);

-- Função para limpeza automática de logs de auditoria antigos (após 1 ano)
create or replace function clean_old_audit_logs()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.database_audit_logs 
  where created_at < now() - interval '1 year';
end;
$$;

-- Função para obter estatísticas de auditoria
create or replace function get_audit_statistics(days_back integer default 7)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
  start_date timestamptz;
begin
  start_date := now() - (days_back || ' days')::interval;
  
  select jsonb_build_object(
    'total_operations', count(*),
    'operations_by_type', (
      select jsonb_object_agg(operation, count)
      from (
        select operation, count(*) as count
        from public.database_audit_logs
        where created_at >= start_date
        group by operation
      ) op_counts
    ),
    'operations_by_table', (
      select jsonb_object_agg(table_name, count)
      from (
        select table_name, count(*) as count
        from public.database_audit_logs
        where created_at >= start_date
        group by table_name
        order by count desc
        limit 10
      ) table_counts
    ),
    'unique_users', (
      select count(distinct user_id)
      from public.database_audit_logs
      where created_at >= start_date and user_id is not null
    ),
    'unique_ips', (
      select count(distinct ip_address)
      from public.database_audit_logs
      where created_at >= start_date and ip_address is not null
    )
  ) into result
  from public.database_audit_logs
  where created_at >= start_date;
  
  return result;
end;
$$;

-- Função para detectar atividade suspeita no banco de dados
create or replace function detect_suspicious_database_activity(hours_back integer default 1)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
  start_time timestamptz;
begin
  start_time := now() - (hours_back || ' hours')::interval;
  
  select jsonb_build_object(
    'high_frequency_users', (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'operation_count', count,
          'operations_per_minute', round(count::numeric / (hours_back * 60), 2)
        )
      )
      from (
        select user_id, count(*) as count
        from public.database_audit_logs
        where created_at >= start_time 
          and user_id is not null
        group by user_id
        having count(*) > 100 * hours_back -- Mais de 100 operações por hora
        order by count desc
        limit 10
      ) high_freq
    ),
    'suspicious_ips', (
      select jsonb_agg(
        jsonb_build_object(
          'ip_address', ip_address,
          'operation_count', count,
          'unique_users', unique_users,
          'operations_per_minute', round(count::numeric / (hours_back * 60), 2)
        )
      )
      from (
        select 
          ip_address, 
          count(*) as count,
          count(distinct user_id) as unique_users
        from public.database_audit_logs
        where created_at >= start_time 
          and ip_address is not null
        group by ip_address
        having count(*) > 200 * hours_back -- Mais de 200 operações por hora por IP
           or count(distinct user_id) > 10 -- Mais de 10 usuários diferentes por IP
        order by count desc
        limit 10
      ) suspicious_ips
    ),
    'bulk_operations', (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', user_id,
          'table_name', table_name,
          'operation', operation,
          'count', count,
          'time_window', time_window
        )
      )
      from (
        select 
          user_id,
          table_name,
          operation,
          count(*) as count,
          min(created_at) || ' - ' || max(created_at) as time_window
        from public.database_audit_logs
        where created_at >= start_time
          and operation in ('insert', 'update', 'delete')
        group by user_id, table_name, operation, 
                 date_trunc('minute', created_at)
        having count(*) > 50 -- Mais de 50 operações do mesmo tipo na mesma tabela por minuto
        order by count desc
        limit 20
      ) bulk_ops
    )
  ) into result;
  
  return result;
end;
$$;

-- Função para obter logs de auditoria com filtros
create or replace function get_audit_logs(
  table_filter text default null,
  operation_filter text default null,
  user_filter uuid default null,
  hours_back integer default 24,
  limit_count integer default 100
)
returns table (
  id uuid,
  table_name text,
  operation text,
  user_id uuid,
  filters jsonb,
  data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz
)
language plpgsql
security definer
as $$
declare
  start_time timestamptz;
begin
  start_time := now() - (hours_back || ' hours')::interval;
  
  return query
  select 
    dal.id,
    dal.table_name,
    dal.operation,
    dal.user_id,
    dal.filters,
    dal.data,
    dal.ip_address,
    dal.user_agent,
    dal.created_at
  from public.database_audit_logs dal
  where dal.created_at >= start_time
    and (table_filter is null or dal.table_name = table_filter)
    and (operation_filter is null or dal.operation = operation_filter)
    and (user_filter is null or dal.user_id = user_filter)
  order by dal.created_at desc
  limit limit_count;
end;
$$;

-- Trigger para limpeza automática de logs antigos (executa diariamente)
create or replace function schedule_audit_cleanup()
returns void
language plpgsql
as $$
begin
  -- Esta função seria chamada por um cron job
  perform clean_old_audit_logs();
end;
$$;

-- Comentários para documentação
comment on table public.database_audit_logs is 'Logs de auditoria para operações do banco de dados';
comment on column public.database_audit_logs.table_name is 'Nome da tabela acessada';
comment on column public.database_audit_logs.operation is 'Tipo de operação (select, insert, update, delete, upsert)';
comment on column public.database_audit_logs.user_id is 'ID do usuário que executou a operação';
comment on column public.database_audit_logs.filters is 'Filtros aplicados na operação (WHERE clauses)';
comment on column public.database_audit_logs.data is 'Dados inseridos/atualizados na operação';
comment on column public.database_audit_logs.ip_address is 'Endereço IP de origem da operação';
comment on column public.database_audit_logs.user_agent is 'User Agent do cliente que executou a operação';

-- Grants para funções
grant execute on function clean_old_audit_logs() to service_role;
grant execute on function get_audit_statistics(integer) to service_role;
grant execute on function detect_suspicious_database_activity(integer) to service_role;
grant execute on function get_audit_logs(text, text, uuid, integer, integer) to service_role;
grant execute on function schedule_audit_cleanup() to service_role;