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
        'account_lockout'
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
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

-- Função para limpeza automática de logs antigos (manter apenas 90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.security_logs 
    WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para limpeza automática (executar diariamente)
-- Nota: Em produção, isso seria melhor feito via cron job ou scheduled function
CREATE OR REPLACE FUNCTION trigger_cleanup_security_logs()
RETURNS trigger AS $$
BEGIN
    -- Executar limpeza apenas ocasionalmente para não impactar performance
    IF random() < 0.01 THEN -- 1% de chance a cada inserção
        PERFORM cleanup_old_security_logs();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_logs_cleanup_trigger
    AFTER INSERT ON public.security_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_security_logs();

-- Função para detectar IPs suspeitos
CREATE OR REPLACE FUNCTION get_suspicious_ips(hours_back INTEGER DEFAULT 1)
RETURNS TABLE(ip_address TEXT, event_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.ip_address,
        COUNT(*) as event_count
    FROM public.security_logs sl
    WHERE 
        sl.timestamp >= NOW() - (hours_back || ' hours')::INTERVAL
        AND sl.event_type IN ('auth_failed', 'rate_limit_exceeded', 'sql_injection_attempt', 'xss_attempt')
    GROUP BY sl.ip_address
    HAVING COUNT(*) > 10
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para estatísticas de segurança
CREATE OR REPLACE FUNCTION get_security_stats(timeframe TEXT DEFAULT 'day')
RETURNS TABLE(
    event_type TEXT,
    severity TEXT,
    event_count BIGINT
) AS $$
DECLARE
    interval_text TEXT;
BEGIN
    CASE timeframe
        WHEN 'hour' THEN interval_text := '1 hour';
        WHEN 'day' THEN interval_text := '1 day';
        WHEN 'week' THEN interval_text := '7 days';
        WHEN 'month' THEN interval_text := '30 days';
        ELSE interval_text := '1 day';
    END CASE;

    RETURN QUERY
    SELECT 
        sl.event_type,
        sl.severity,
        COUNT(*) as event_count
    FROM public.security_logs sl
    WHERE sl.timestamp >= NOW() - interval_text::INTERVAL
    GROUP BY sl.event_type, sl.severity
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar coluna role na tabela profiles se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'role'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator'));
        
        -- Criar índice para role
        CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
    END IF;
END $$;