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

// Importar o sistema de segurança
const { securitySystem, logSecurity, logAudit, logLGPD, getStats, detectSuspicious, SecurityEventTypes, SeverityLevels } = await import('../apps/web/lib/security.js');

async function testSecuritySystem() {
    console.log('🛡️  Testando Sistema de Segurança Simplificado\n');

    if (!securitySystem.isEnabled) {
        console.log('❌ Sistema de segurança não está habilitado');
        console.log('   Verifique as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
        return;
    }

    console.log('✅ Sistema de segurança habilitado\n');

    // Teste 1: Log de evento de segurança
    console.log('📝 Teste 1: Registrando evento de segurança...');
    const securityLog = await logSecurity({
        type: SecurityEventTypes.API_REQUEST,
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser/1.0',
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        message: 'Teste de log de segurança',
        severity: SeverityLevels.INFO,
        metadata: { test: true, timestamp: new Date().toISOString() }
    });

    if (securityLog) {
        console.log('   ✅ Log de segurança criado:', securityLog.id);
    } else {
        console.log('   ❌ Falha ao criar log de segurança');
    }

    // Teste 2: Log de auditoria
    console.log('\n📝 Teste 2: Registrando log de auditoria...');
    const auditLog = await logAudit({
        tableName: 'pools',
        operation: 'INSERT',
        userId: null,
        newValues: { name: 'Teste Pool', description: 'Pool de teste' },
        changedFields: ['name', 'description'],
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser/1.0'
    });

    if (auditLog) {
        console.log('   ✅ Log de auditoria criado:', auditLog.id);
    } else {
        console.log('   ❌ Falha ao criar log de auditoria');
    }

    // Teste 3: Log LGPD
    console.log('\n📝 Teste 3: Registrando log LGPD...');
    const lgpdLog = await logLGPD({
        userId: null,
        actionType: 'consent_given',
        legalBasis: 'consent',
        dataCategories: ['personal_data', 'contact_info'],
        purpose: 'Participação em bolões',
        userConsent: true,
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser/1.0',
        metadata: { test: true }
    });

    if (lgpdLog) {
        console.log('   ✅ Log LGPD criado:', lgpdLog.id);
    } else {
        console.log('   ❌ Falha ao criar log LGPD');
    }

    // Teste 4: Obter estatísticas
    console.log('\n📊 Teste 4: Obtendo estatísticas de segurança...');
    const stats = await getStats();

    if (stats) {
        console.log('   ✅ Estatísticas obtidas:');
        console.log('   📈 Total de eventos:', stats.total_events);
        console.log('   📈 Eventos últimas 24h:', stats.events_last_24h);
        console.log('   📈 IPs suspeitos:', stats.suspicious_ips);
        console.log('   📈 Falhas de login:', stats.failed_logins);
    } else {
        console.log('   ❌ Falha ao obter estatísticas');
    }

    // Teste 5: Detectar atividade suspeita
    console.log('\n🔍 Teste 5: Detectando atividade suspeita...');
    const suspicious = await detectSuspicious();

    if (suspicious !== null) {
        console.log(`   ✅ Detecção executada: ${suspicious.length} atividades suspeitas encontradas`);
        if (suspicious.length > 0) {
            console.log('   🚨 Atividades suspeitas:');
            suspicious.forEach((activity, index) => {
                console.log(`      ${index + 1}. IP: ${activity.ip_address}, Eventos: ${activity.event_count}, Severidade: ${activity.severity_level}`);
            });
        }
    } else {
        console.log('   ❌ Falha na detecção de atividade suspeita');
    }

    // Criar alguns logs adicionais para teste
    console.log('\n📝 Criando logs adicionais para teste...');
    const additionalLogs = [
        {
            type: SecurityEventTypes.AUTH_SUCCESS,
            ipAddress: '192.168.1.101',
            message: 'Login bem-sucedido',
            severity: SeverityLevels.INFO
        },
        {
            type: SecurityEventTypes.AUTH_FAILED,
            ipAddress: '192.168.1.102',
            message: 'Tentativa de login falhada',
            severity: SeverityLevels.WARNING
        },
        {
            type: SecurityEventTypes.RATE_LIMIT,
            ipAddress: '192.168.1.103',
            message: 'Rate limit excedido',
            severity: SeverityLevels.ERROR
        }
    ];

    for (const logData of additionalLogs) {
        const log = await logSecurity(logData);
        if (log) {
            console.log(`   ✅ Log ${logData.type} criado`);
        }
    }

    // Resumo final
    console.log('\n📋 RESUMO DOS TESTES');
    console.log('='.repeat(50));
    
    const allTestsPassed = securityLog && auditLog && lgpdLog && stats && suspicious !== null;
    
    if (allTestsPassed) {
        console.log('🎉 Todos os testes passaram!');
        console.log('✅ Sistema de segurança funcionando perfeitamente');
        console.log('');
        console.log('🚀 FUNCIONALIDADES TESTADAS:');
        console.log('1. ✅ Logs de segurança');
        console.log('2. ✅ Logs de auditoria');
        console.log('3. ✅ Logs de conformidade LGPD');
        console.log('4. ✅ Estatísticas de segurança');
        console.log('5. ✅ Detecção de atividades suspeitas');
        console.log('');
        console.log('📊 PRÓXIMOS PASSOS:');
        console.log('   - Integrar com APIs existentes');
        console.log('   - Configurar alertas automáticos');
        console.log('   - Implementar dashboard de monitoramento');
        console.log('   - Configurar limpeza automática');
    } else {
        console.log('⚠️  Alguns testes falharam');
        console.log('🔧 Verifique as configurações e permissões');
        console.log('');
        console.log('❌ TESTES FALHADOS:');
        if (!securityLog) console.log('   - Logs de segurança');
        if (!auditLog) console.log('   - Logs de auditoria');
        if (!lgpdLog) console.log('   - Logs LGPD');
        if (!stats) console.log('   - Estatísticas');
        if (suspicious === null) console.log('   - Detecção de atividades suspeitas');
    }

    return allTestsPassed;
}

// Executar testes
testSecuritySystem()
    .then(success => {
        if (success) {
            console.log('\n🎯 Sistema de segurança pronto para produção!');
        } else {
            console.log('\n🔧 Sistema de segurança precisa de ajustes');
        }
    })
    .catch(error => {
        console.error('\n❌ Erro durante os testes:', error.message);
    });