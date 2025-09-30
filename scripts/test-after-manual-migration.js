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

async function testSecuritySystem() {
    console.log('🔍 Testando Sistema de Segurança após Migração Manual\n');

    let allTestsPassed = true;

    // Teste 1: Verificar se as tabelas foram criadas
    console.log('📋 Teste 1: Verificando tabelas de segurança...');
    try {
        const { data: tables, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['security_logs', 'database_audit_logs', 'lgpd_compliance_logs']);

        if (error) {
            console.log('⚠️  Não foi possível verificar tabelas via information_schema');
            console.log('   Tentando verificação direta...');
            
            // Verificação direta das tabelas
            const securityLogsTest = await supabase.from('security_logs').select('count', { count: 'exact', head: true });
            const auditLogsTest = await supabase.from('database_audit_logs').select('count', { count: 'exact', head: true });
            const lgpdLogsTest = await supabase.from('lgpd_compliance_logs').select('count', { count: 'exact', head: true });

            if (!securityLogsTest.error && !auditLogsTest.error && !lgpdLogsTest.error) {
                console.log('✅ Todas as tabelas de segurança foram encontradas');
                console.log(`   - security_logs: ${securityLogsTest.count || 0} registros`);
                console.log(`   - database_audit_logs: ${auditLogsTest.count || 0} registros`);
                console.log(`   - lgpd_compliance_logs: ${lgpdLogsTest.count || 0} registros`);
            } else {
                console.log('❌ Algumas tabelas não foram encontradas:');
                if (securityLogsTest.error) console.log(`   - security_logs: ${securityLogsTest.error.message}`);
                if (auditLogsTest.error) console.log(`   - database_audit_logs: ${auditLogsTest.error.message}`);
                if (lgpdLogsTest.error) console.log(`   - lgpd_compliance_logs: ${lgpdLogsTest.error.message}`);
                allTestsPassed = false;
            }
        } else {
            const tableNames = tables.map(t => t.table_name);
            console.log('✅ Tabelas encontradas:', tableNames.join(', '));
        }
    } catch (error) {
        console.log('❌ Erro ao verificar tabelas:', error.message);
        allTestsPassed = false;
    }

    console.log('');

    // Teste 2: Verificar funções de segurança
    console.log('🔧 Teste 2: Verificando funções de segurança...');
    try {
        // Testar get_security_stats
        const { data: stats, error: statsError } = await supabase.rpc('get_security_stats');
        
        if (statsError) {
            console.log('❌ Função get_security_stats não encontrada:', statsError.message);
            allTestsPassed = false;
        } else {
            console.log('✅ Função get_security_stats funcionando');
            console.log('   Estatísticas:', JSON.stringify(stats, null, 2));
        }

        // Testar detect_suspicious_activity
        const { data: suspicious, error: suspiciousError } = await supabase.rpc('detect_suspicious_activity');
        
        if (suspiciousError) {
            console.log('❌ Função detect_suspicious_activity não encontrada:', suspiciousError.message);
            allTestsPassed = false;
        } else {
            console.log('✅ Função detect_suspicious_activity funcionando');
            console.log(`   Atividades suspeitas encontradas: ${suspicious?.length || 0}`);
        }

        // Testar cleanup_old_logs
        const { data: cleanup, error: cleanupError } = await supabase.rpc('cleanup_old_logs');
        
        if (cleanupError) {
            console.log('❌ Função cleanup_old_logs não encontrada:', cleanupError.message);
            allTestsPassed = false;
        } else {
            console.log('✅ Função cleanup_old_logs funcionando');
            console.log(`   Logs limpos: ${cleanup || 0}`);
        }
    } catch (error) {
        console.log('❌ Erro ao testar funções:', error.message);
        allTestsPassed = false;
    }

    console.log('');

    // Teste 3: Inserir log de segurança de teste
    console.log('📝 Teste 3: Testando inserção de log de segurança...');
    try {
        const { data, error } = await supabase
            .from('security_logs')
            .insert({
                event_type: 'test',
                ip_address: '127.0.0.1',
                user_agent: 'Test Script',
                message: 'Teste de inserção após migração manual',
                severity: 'info'
            })
            .select();

        if (error) {
            console.log('❌ Erro ao inserir log de segurança:', error.message);
            allTestsPassed = false;
        } else {
            console.log('✅ Log de segurança inserido com sucesso');
            console.log('   ID do log:', data[0]?.id);
        }
    } catch (error) {
        console.log('❌ Erro ao testar inserção:', error.message);
        allTestsPassed = false;
    }

    console.log('');

    // Teste 4: Verificar RLS (Row Level Security)
    console.log('🔒 Teste 4: Testando políticas de RLS...');
    try {
        // Criar cliente com chave anônima para testar RLS
        const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
        
        const { data, error } = await anonClient
            .from('security_logs')
            .select('*')
            .limit(1);

        if (error && error.message.includes('permission denied')) {
            console.log('✅ RLS funcionando corretamente - acesso negado para usuários anônimos');
        } else if (error) {
            console.log('⚠️  RLS pode não estar configurado corretamente:', error.message);
        } else {
            console.log('⚠️  RLS pode não estar funcionando - usuário anônimo conseguiu acessar dados');
        }
    } catch (error) {
        console.log('❌ Erro ao testar RLS:', error.message);
    }

    console.log('');

    // Teste 5: Verificar índices
    console.log('📊 Teste 5: Verificando índices de performance...');
    try {
        const { data: indexes, error } = await supabase
            .from('pg_indexes')
            .select('indexname, tablename')
            .like('indexname', 'idx_%')
            .in('tablename', ['security_logs', 'database_audit_logs', 'lgpd_compliance_logs']);

        if (error) {
            console.log('⚠️  Não foi possível verificar índices:', error.message);
        } else {
            console.log('✅ Índices encontrados:');
            indexes.forEach(idx => {
                console.log(`   - ${idx.indexname} (${idx.tablename})`);
            });
        }
    } catch (error) {
        console.log('⚠️  Erro ao verificar índices:', error.message);
    }

    console.log('');

    // Resumo final
    console.log('📋 RESUMO DOS TESTES');
    console.log('='.repeat(50));
    
    if (allTestsPassed) {
        console.log('🎉 Todos os testes principais passaram!');
        console.log('✅ Sistema de segurança configurado com sucesso');
        console.log('');
        console.log('🚀 PRÓXIMOS PASSOS:');
        console.log('1. Migre suas APIs existentes para usar o sistema de logs');
        console.log('2. Configure alertas para eventos críticos');
        console.log('3. Implemente dashboard de monitoramento');
        console.log('4. Configure limpeza automática de logs antigos');
        console.log('5. Teste o sistema em produção com dados reais');
    } else {
        console.log('⚠️  Alguns testes falharam');
        console.log('📖 Consulte o MANUAL_MIGRATION_GUIDE.md para aplicar as migrações');
        console.log('🔧 Verifique se todas as migrações foram aplicadas corretamente');
    }
}

// Executar testes
testSecuritySystem().catch(console.error);