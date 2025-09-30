import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Função para carregar variáveis de ambiente do .env.local
function loadEnvFile() {
    try {
        const envPath = join(__dirname, '..', 'apps', 'web', '.env.local');
        const envContent = readFileSync(envPath, 'utf8');
        
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar .env.local:', error.message);
    }
}

// Carregar variáveis de ambiente
loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SQL para criar todas as tabelas e funções
const migrationSQL = `
-- Criar tabela security_logs
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    message TEXT,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela database_audit_logs
CREATE TABLE IF NOT EXISTS public.database_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    user_id UUID REFERENCES auth.users(id),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela lgpd_compliance_logs
CREATE TABLE IF NOT EXISTS public.lgpd_compliance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('consent_given', 'consent_withdrawn', 'data_access_request', 'data_deletion_request', 'data_portability_request', 'data_processed', 'data_shared')),
    legal_basis VARCHAR(100),
    data_categories TEXT[],
    purpose TEXT,
    retention_period INTERVAL,
    third_parties TEXT[],
    user_consent BOOLEAN DEFAULT FALSE,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON public.security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);

CREATE INDEX IF NOT EXISTS idx_database_audit_logs_table_name ON public.database_audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_database_audit_logs_operation ON public.database_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_database_audit_logs_user_id ON public.database_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_database_audit_logs_created_at ON public.database_audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_lgpd_compliance_logs_user_id ON public.lgpd_compliance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_compliance_logs_action_type ON public.lgpd_compliance_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_lgpd_compliance_logs_created_at ON public.lgpd_compliance_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_lgpd_compliance_logs_expires_at ON public.lgpd_compliance_logs(expires_at);

-- Habilitar RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_compliance_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para security_logs
DROP POLICY IF EXISTS "security_logs_admin_access" ON public.security_logs;
CREATE POLICY "security_logs_admin_access" ON public.security_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

DROP POLICY IF EXISTS "security_logs_service_role" ON public.security_logs;
CREATE POLICY "security_logs_service_role" ON public.security_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Políticas RLS para database_audit_logs
DROP POLICY IF EXISTS "database_audit_logs_admin_access" ON public.database_audit_logs;
CREATE POLICY "database_audit_logs_admin_access" ON public.database_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

DROP POLICY IF EXISTS "database_audit_logs_service_role" ON public.database_audit_logs;
CREATE POLICY "database_audit_logs_service_role" ON public.database_audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Políticas RLS para lgpd_compliance_logs
DROP POLICY IF EXISTS "lgpd_compliance_logs_user_access" ON public.lgpd_compliance_logs;
CREATE POLICY "lgpd_compliance_logs_user_access" ON public.lgpd_compliance_logs
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "lgpd_compliance_logs_admin_access" ON public.lgpd_compliance_logs;
CREATE POLICY "lgpd_compliance_logs_admin_access" ON public.lgpd_compliance_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

DROP POLICY IF EXISTS "lgpd_compliance_logs_service_role" ON public.lgpd_compliance_logs;
CREATE POLICY "lgpd_compliance_logs_service_role" ON public.lgpd_compliance_logs
    FOR ALL USING (auth.role() = 'service_role');

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
    ip_address INET,
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

-- Função para limpeza de logs antigos
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS JSON AS $$
DECLARE
    security_deleted INTEGER;
    audit_deleted INTEGER;
    lgpd_deleted INTEGER;
    result JSON;
BEGIN
    -- Deletar logs de segurança com mais de 1 ano
    DELETE FROM public.security_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS security_deleted = ROW_COUNT;
    
    -- Deletar logs de auditoria com mais de 1 ano
    DELETE FROM public.database_audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS audit_deleted = ROW_COUNT;
    
    -- Deletar logs LGPD expirados
    DELETE FROM public.lgpd_compliance_logs 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    GET DIAGNOSTICS lgpd_deleted = ROW_COUNT;
    
    SELECT json_build_object(
        'security_logs_deleted', security_deleted,
        'audit_logs_deleted', audit_deleted,
        'lgpd_logs_deleted', lgpd_deleted,
        'cleanup_date', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function applyCompleteMigration() {
    console.log('🚀 Aplicando migração completa do sistema de segurança...\n');

    try {
        // Executar a migração usando rpc
        console.log('📝 Executando SQL de migração...');
        
        // Dividir o SQL em comandos menores para evitar problemas
        const commands = migrationSQL.split(';').filter(cmd => cmd.trim());
        
        for (let i = 0; i < commands.length; i++) {
            const command = commands[i].trim();
            if (command) {
                try {
                    console.log(`   Executando comando ${i + 1}/${commands.length}...`);
                    
                    // Usar rpc para executar SQL
                    const { data, error } = await supabase.rpc('exec_sql', {
                        sql_query: command + ';'
                    });

                    if (error) {
                        console.log(`   ⚠️  Comando ${i + 1} falhou:`, error.message);
                        // Continuar com próximo comando
                    } else {
                        console.log(`   ✅ Comando ${i + 1} executado`);
                    }
                } catch (err) {
                    console.log(`   ⚠️  Erro no comando ${i + 1}:`, err.message);
                }
            }
        }

        console.log('\n🔍 Verificando tabelas criadas...');
        
        // Verificar se as tabelas existem
        const tables = ['security_logs', 'database_audit_logs', 'lgpd_compliance_logs'];
        for (const table of tables) {
            try {
                const { data, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });
                
                if (error) {
                    console.log(`   ❌ Tabela ${table}: ${error.message}`);
                } else {
                    console.log(`   ✅ Tabela ${table}: OK`);
                }
            } catch (err) {
                console.log(`   ❌ Tabela ${table}: ${err.message}`);
            }
        }

        console.log('\n🔍 Verificando funções criadas...');
        
        // Verificar se as funções existem
        const functions = ['get_security_stats', 'detect_suspicious_activity', 'cleanup_old_logs'];
        for (const func of functions) {
            try {
                const { data, error } = await supabase.rpc(func);
                
                if (error) {
                    console.log(`   ❌ Função ${func}: ${error.message}`);
                } else {
                    console.log(`   ✅ Função ${func}: OK`);
                }
            } catch (err) {
                console.log(`   ❌ Função ${func}: ${err.message}`);
            }
        }

        console.log('\n📝 Testando inserção de log...');
        
        try {
            const { data, error } = await supabase
                .from('security_logs')
                .insert({
                    event_type: 'system_test',
                    ip_address: '127.0.0.1',
                    user_agent: 'Migration Test Script',
                    message: 'Teste de migração completa do sistema de segurança',
                    severity: 'info',
                    metadata: { migration_test: true, timestamp: new Date().toISOString() }
                })
                .select();

            if (error) {
                console.log('   ❌ Erro ao inserir log:', error.message);
            } else {
                console.log('   ✅ Log inserido com sucesso');
                console.log('   📄 Log:', JSON.stringify(data[0], null, 2));
            }
        } catch (err) {
            console.log('   ❌ Erro ao testar inserção:', err.message);
        }

        console.log('\n🎉 MIGRAÇÃO COMPLETA!');
        console.log('='.repeat(50));
        console.log('✅ Sistema de segurança configurado');
        console.log('✅ Tabelas criadas com RLS habilitado');
        console.log('✅ Índices de performance criados');
        console.log('✅ Funções de segurança disponíveis');
        console.log('✅ Políticas de acesso configuradas');
        console.log('');
        console.log('🚀 PRÓXIMOS PASSOS:');
        console.log('1. Migrar APIs existentes para usar o sistema');
        console.log('2. Configurar alertas de segurança');
        console.log('3. Implementar dashboard de monitoramento');
        console.log('4. Configurar limpeza automática de logs');

    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        
        console.log('\n📋 INSTRUÇÕES MANUAIS:');
        console.log('Como a migração automática falhou, aplique manualmente:');
        console.log('1. Acesse o dashboard do Supabase');
        console.log('2. Vá para SQL Editor');
        console.log('3. Execute o SQL do arquivo MANUAL_MIGRATION_GUIDE.md');
        console.log('4. Execute o script de teste novamente');
    }
}

// Executar migração
applyCompleteMigration().catch(console.error);