# Guia de Migração Manual - Sistema de Segurança

Como as migrações automáticas não estão funcionando devido a limitações da API do Supabase, você precisará aplicar as migrações manualmente através do dashboard.

## 📋 Pré-requisitos

1. Acesso ao dashboard do Supabase: https://supabase.com/dashboard
2. Permissões de administrador no projeto
3. Acesso ao SQL Editor do Supabase

## 🔧 Passo a Passo

### 1. Acessar o SQL Editor

1. Faça login no dashboard do Supabase
2. Selecione seu projeto
3. Vá para **SQL Editor** no menu lateral
4. Clique em **New Query**

### 2. Aplicar Migração 1: Security Logs

Copie e cole o seguinte SQL no editor:

```sql
-- Criar tabela de logs de segurança
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'auth_failed',
        'auth_success', 
        'rate_limit_exceeded',
        'suspicious_activity',
        'sql_injection_attempt',
        'xss_attempt',
        'unauthorized_access',
        'data_access',
        'admin_action',
        'payment_fraud',
        'account_lockout',
        'test'
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical', 'info')),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON public.security_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON public.security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_resolved ON public.security_logs(resolved);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_security_logs_severity_resolved ON public.security_logs(severity, resolved);

-- RLS (Row Level Security) - apenas administradores podem acessar
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Política para administradores (assumindo que existe uma coluna role em profiles)
CREATE POLICY "Admins can view all security logs" ON public.security_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para inserção pelo sistema (service role)
CREATE POLICY "System can insert security logs" ON public.security_logs
    FOR INSERT WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.security_logs IS 'Logs de eventos de segurança do sistema';
COMMENT ON COLUMN public.security_logs.event_type IS 'Tipo do evento de segurança';
COMMENT ON COLUMN public.security_logs.severity IS 'Nível de severidade do evento';
COMMENT ON COLUMN public.security_logs.metadata IS 'Dados adicionais do evento em formato JSON';
```

Clique em **Run** para executar.

### 3. Aplicar Migração 2: LGPD Compliance

```sql
-- Criar tabela de logs de conformidade LGPD
CREATE TABLE IF NOT EXISTS public.lgpd_compliance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'consent_given',
        'consent_withdrawn',
        'data_access_request',
        'data_deletion_request',
        'data_portability_request',
        'data_rectification_request',
        'data_processing_objection',
        'automated_decision_objection',
        'data_breach_notification',
        'privacy_policy_update'
    )),
    legal_basis TEXT NOT NULL CHECK (legal_basis IN (
        'consent',
        'contract',
        'legal_obligation',
        'vital_interests',
        'public_task',
        'legitimate_interests'
    )),
    data_categories TEXT[] NOT NULL,
    processing_purposes TEXT[] NOT NULL,
    retention_period INTERVAL,
    third_party_sharing BOOLEAN DEFAULT FALSE,
    automated_decision_making BOOLEAN DEFAULT FALSE,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'rejected', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lgpd_logs_user_id ON public.lgpd_compliance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_logs_action_type ON public.lgpd_compliance_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_lgpd_logs_status ON public.lgpd_compliance_logs(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_logs_created_at ON public.lgpd_compliance_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_lgpd_logs_expires_at ON public.lgpd_compliance_logs(expires_at);

-- RLS (Row Level Security)
ALTER TABLE public.lgpd_compliance_logs ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem apenas seus próprios logs
CREATE POLICY "Users can view own LGPD logs" ON public.lgpd_compliance_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Política para administradores verem todos os logs
CREATE POLICY "Admins can view all LGPD logs" ON public.lgpd_compliance_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para inserção pelo sistema
CREATE POLICY "System can insert LGPD logs" ON public.lgpd_compliance_logs
    FOR INSERT WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.lgpd_compliance_logs IS 'Logs de conformidade com a LGPD';
COMMENT ON COLUMN public.lgpd_compliance_logs.action_type IS 'Tipo de ação relacionada à LGPD';
COMMENT ON COLUMN public.lgpd_compliance_logs.legal_basis IS 'Base legal para o processamento dos dados';
COMMENT ON COLUMN public.lgpd_compliance_logs.data_categories IS 'Categorias de dados pessoais envolvidos';
```

### 4. Aplicar Migração 3: Database Audit

```sql
-- Criar tabela de auditoria do banco de dados
CREATE TABLE IF NOT EXISTS public.database_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    operation TEXT NOT NULL CHECK (operation IN ('select', 'insert', 'update', 'delete', 'upsert')),
    table_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    filters JSONB DEFAULT '{}',
    data JSONB DEFAULT '{}',
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON public.database_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.database_audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.database_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.database_audit_logs(timestamp);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation ON public.database_audit_logs(table_name, operation);

-- RLS (Row Level Security) - apenas administradores podem acessar
ALTER TABLE public.database_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para administradores
CREATE POLICY "Admins can view all audit logs" ON public.database_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para inserção pelo sistema
CREATE POLICY "System can insert audit logs" ON public.database_audit_logs
    FOR INSERT WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.database_audit_logs IS 'Logs de auditoria de operações no banco de dados';
COMMENT ON COLUMN public.database_audit_logs.operation IS 'Tipo de operação realizada';
COMMENT ON COLUMN public.database_audit_logs.table_name IS 'Nome da tabela afetada';
COMMENT ON COLUMN public.database_audit_logs.filters IS 'Filtros aplicados na operação';
COMMENT ON COLUMN public.database_audit_logs.data IS 'Dados envolvidos na operação';
```

### 5. Criar Funções de Segurança

```sql
-- Função para obter estatísticas de segurança
CREATE OR REPLACE FUNCTION public.get_security_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_events', (SELECT COUNT(*) FROM public.security_logs),
        'events_last_24h', (SELECT COUNT(*) FROM public.security_logs WHERE created_at >= NOW() - INTERVAL '24 hours'),
        'suspicious_ips', (SELECT COUNT(DISTINCT ip_address) FROM public.security_logs WHERE severity IN ('high', 'critical')),
        'failed_logins', (SELECT COUNT(*) FROM public.security_logs WHERE event_type = 'auth_failed'),
        'sql_injection_attempts', (SELECT COUNT(*) FROM public.security_logs WHERE event_type = 'sql_injection_attempt'),
        'xss_attempts', (SELECT COUNT(*) FROM public.security_logs WHERE event_type = 'xss_attempt'),
        'rate_limit_violations', (SELECT COUNT(*) FROM public.security_logs WHERE event_type = 'rate_limit_exceeded')
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para detectar atividade suspeita
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity()
RETURNS TABLE(
    user_id UUID,
    ip_address TEXT,
    event_count BIGINT,
    severity_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.user_id,
        sl.ip_address,
        COUNT(*) as event_count,
        CASE 
            WHEN COUNT(*) > 100 THEN 'critical'
            WHEN COUNT(*) > 50 THEN 'high'
            WHEN COUNT(*) > 20 THEN 'medium'
            ELSE 'low'
        END as severity_level
    FROM public.security_logs sl
    WHERE sl.created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY sl.user_id, sl.ip_address
    HAVING COUNT(*) > 10
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpeza automática de logs antigos
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Deletar logs de segurança com mais de 1 ano
    DELETE FROM public.security_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Deletar logs de auditoria com mais de 1 ano
    DELETE FROM public.database_audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    -- Deletar logs LGPD expirados
    DELETE FROM public.lgpd_compliance_logs 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões para o service role
GRANT ALL ON public.security_logs TO service_role;
GRANT ALL ON public.lgpd_compliance_logs TO service_role;
GRANT ALL ON public.database_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.get_security_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs() TO service_role;
```

## ✅ Verificação

Após aplicar todas as migrações, execute este SQL para verificar se tudo foi criado corretamente:

```sql
-- Verificar se as tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('security_logs', 'database_audit_logs', 'lgpd_compliance_logs')
ORDER BY table_name;

-- Verificar se as funções foram criadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_security_stats', 'detect_suspicious_activity', 'cleanup_old_logs')
ORDER BY routine_name;

-- Testar inserção de um log de segurança
INSERT INTO public.security_logs (
    event_type, 
    ip_address, 
    user_agent, 
    message, 
    severity
) VALUES (
    'test', 
    '127.0.0.1', 
    'Manual Test', 
    'Teste de migração manual', 
    'info'
);

-- Verificar se o log foi inserido
SELECT COUNT(*) as total_logs FROM public.security_logs;
```

## 🚀 Próximos Passos

Após aplicar as migrações manualmente:

1. Teste o sistema de segurança usando os scripts de teste
2. Configure o dashboard de monitoramento
3. Migre suas APIs existentes usando o guia de migração
4. Configure alertas e monitoramento contínuo

## 📞 Suporte

Se encontrar problemas durante a migração manual:

1. Verifique se você tem permissões de administrador
2. Certifique-se de que não há conflitos com tabelas existentes
3. Execute as migrações uma por vez
4. Verifique os logs de erro no dashboard do Supabase