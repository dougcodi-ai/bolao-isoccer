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

async function createSecurityLogsTable() {
    console.log('📋 Criando tabela security_logs...');
    
    // Primeiro, vamos tentar criar usando uma abordagem mais simples
    try {
        // Verificar se a tabela já existe
        const { data: existingTable, error: checkError } = await supabase
            .from('security_logs')
            .select('count', { count: 'exact', head: true });

        if (!checkError) {
            console.log('✅ Tabela security_logs já existe');
            return true;
        }

        // Se chegou aqui, a tabela não existe, vamos criar usando SQL direto
        console.log('🔧 Tentando criar tabela via SQL...');
        
        // Como não podemos usar exec_sql, vamos tentar uma abordagem alternativa
        // Criar a tabela usando insert em uma tabela temporária que force a criação
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS public.security_logs (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                event_type TEXT NOT NULL,
                user_id UUID,
                ip_address TEXT NOT NULL,
                user_agent TEXT NOT NULL,
                message TEXT,
                metadata JSONB DEFAULT '{}',
                severity TEXT NOT NULL DEFAULT 'info',
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                resolved BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        // Tentar executar via RPC se existir uma função personalizada
        try {
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: createTableSQL });
            if (!error) {
                console.log('✅ Tabela security_logs criada via RPC');
                return true;
            }
        } catch (rpcError) {
            console.log('⚠️  RPC não disponível, tentando abordagem alternativa...');
        }

        // Se chegou aqui, vamos usar uma abordagem diferente
        // Vamos criar um registro de migração para indicar que precisa ser feito manualmente
        console.log('📝 Registrando necessidade de migração manual...');
        
        return false;

    } catch (error) {
        console.error('❌ Erro ao criar tabela security_logs:', error.message);
        return false;
    }
}

async function createDatabaseAuditTable() {
    console.log('📋 Criando tabela database_audit_logs...');
    
    try {
        const { data: existingTable, error: checkError } = await supabase
            .from('database_audit_logs')
            .select('count', { count: 'exact', head: true });

        if (!checkError) {
            console.log('✅ Tabela database_audit_logs já existe');
            return true;
        }

        console.log('📝 Tabela database_audit_logs precisa ser criada manualmente');
        return false;

    } catch (error) {
        console.error('❌ Erro ao verificar tabela database_audit_logs:', error.message);
        return false;
    }
}

async function createLGPDTable() {
    console.log('📋 Criando tabela lgpd_compliance_logs...');
    
    try {
        const { data: existingTable, error: checkError } = await supabase
            .from('lgpd_compliance_logs')
            .select('count', { count: 'exact', head: true });

        if (!checkError) {
            console.log('✅ Tabela lgpd_compliance_logs já existe');
            return true;
        }

        console.log('📝 Tabela lgpd_compliance_logs precisa ser criada manualmente');
        return false;

    } catch (error) {
        console.error('❌ Erro ao verificar tabela lgpd_compliance_logs:', error.message);
        return false;
    }
}

async function createSecurityFunctions() {
    console.log('🔧 Verificando funções de segurança...');
    
    try {
        // Testar get_security_stats
        const { data: stats, error: statsError } = await supabase.rpc('get_security_stats');
        
        if (!statsError) {
            console.log('✅ Função get_security_stats já existe');
        } else {
            console.log('📝 Função get_security_stats precisa ser criada manualmente');
        }

        // Testar detect_suspicious_activity
        const { data: suspicious, error: suspiciousError } = await supabase.rpc('detect_suspicious_activity');
        
        if (!suspiciousError) {
            console.log('✅ Função detect_suspicious_activity já existe');
        } else {
            console.log('📝 Função detect_suspicious_activity precisa ser criada manualmente');
        }

        // Testar cleanup_old_logs
        const { data: cleanup, error: cleanupError } = await supabase.rpc('cleanup_old_logs');
        
        if (!cleanupError) {
            console.log('✅ Função cleanup_old_logs já existe');
        } else {
            console.log('📝 Função cleanup_old_logs precisa ser criada manualmente');
        }

        return !statsError && !suspiciousError && !cleanupError;

    } catch (error) {
        console.error('❌ Erro ao verificar funções:', error.message);
        return false;
    }
}

async function applyMigrations() {
    console.log('🚀 Iniciando aplicação de migrações de segurança...\n');

    let allSuccess = true;

    // Verificar conectividade
    console.log('🔍 Verificando conectividade com Supabase...');
    try {
        const { data, error } = await supabase.from('pools').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('❌ Erro de conectividade:', error.message);
            return;
        }
        console.log('✅ Conectividade confirmada\n');
    } catch (error) {
        console.error('❌ Erro de conectividade:', error.message);
        return;
    }

    // Aplicar migrações
    const securityLogsSuccess = await createSecurityLogsTable();
    const auditLogsSuccess = await createDatabaseAuditTable();
    const lgpdLogsSuccess = await createLGPDTable();
    const functionsSuccess = await createSecurityFunctions();

    allSuccess = securityLogsSuccess && auditLogsSuccess && lgpdLogsSuccess && functionsSuccess;

    console.log('\n📋 RESUMO DA MIGRAÇÃO');
    console.log('='.repeat(50));
    
    if (allSuccess) {
        console.log('🎉 Todas as migrações foram aplicadas com sucesso!');
        console.log('✅ Sistema de segurança configurado e pronto para uso');
    } else {
        console.log('⚠️  Algumas migrações precisam ser aplicadas manualmente');
        console.log('');
        console.log('📖 INSTRUÇÕES:');
        console.log('1. Acesse o dashboard do Supabase: https://supabase.com/dashboard');
        console.log('2. Vá para SQL Editor');
        console.log('3. Execute os SQLs do arquivo MANUAL_MIGRATION_GUIDE.md');
        console.log('4. Execute o teste: node scripts/test-after-manual-migration.js');
        console.log('');
        console.log('📁 Arquivos de migração disponíveis:');
        console.log('   - supabase/migrations/20241220_security_logs.sql');
        console.log('   - supabase/migrations/20241220_lgpd_tables.sql');
        console.log('   - supabase/migrations/20241220_database_audit.sql');
    }

    return allSuccess;
}

// Executar migrações
applyMigrations().catch(console.error);