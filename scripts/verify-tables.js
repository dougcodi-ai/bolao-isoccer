import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        process.env[key] = value;
      }
    }
  }
}

// Carregar variáveis de ambiente
loadEnvFile();

// Configuração do Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyTables() {
  console.log('🔍 Verificando tabelas criadas...\n');

  try {
    // Verificar tabelas usando SQL direto
    const { data: tables, error } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('security_logs', 'database_audit_logs', 'lgpd_compliance_logs', 'security_migrations')
          ORDER BY table_name;
        `
      });

    if (error) {
      console.log('❌ Erro ao verificar tabelas:', error.message);
      
      // Tentar uma abordagem alternativa
      console.log('\n🔄 Tentando abordagem alternativa...');
      
      const queries = [
        "SELECT 'security_logs' as table_name WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_logs' AND table_schema = 'public')",
        "SELECT 'database_audit_logs' as table_name WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'database_audit_logs' AND table_schema = 'public')",
        "SELECT 'lgpd_compliance_logs' as table_name WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lgpd_compliance_logs' AND table_schema = 'public')",
        "SELECT 'security_migrations' as table_name WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_migrations' AND table_schema = 'public')"
      ];

      for (const query of queries) {
        try {
          const { data: result, error: queryError } = await supabase
            .rpc('exec_sql', { sql_query: query });
          
          if (!queryError && result && result.length > 0) {
            console.log(`✅ Tabela ${result[0].table_name} existe`);
          } else {
            console.log(`❌ Tabela não encontrada na query: ${query}`);
          }
        } catch (e) {
          console.log(`❌ Erro na query: ${e.message}`);
        }
      }
    } else {
      console.log('✅ Tabelas encontradas:', tables);
    }

    // Verificar funções
    console.log('\n🔍 Verificando funções...');
    
    const { data: functions, error: funcError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name IN ('get_security_stats', 'detect_suspicious_activity', 'cleanup_old_logs')
          ORDER BY routine_name;
        `
      });

    if (funcError) {
      console.log('❌ Erro ao verificar funções:', funcError.message);
    } else {
      console.log('✅ Funções encontradas:', functions);
    }

  } catch (error) {
    console.error('❌ Erro durante verificação:', error.message);
  }
}

verifyTables();