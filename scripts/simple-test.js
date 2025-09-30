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

async function simpleTest() {
  console.log('🔍 Teste simples de conectividade...\n');

  try {
    // Tentar listar algumas tabelas conhecidas
    console.log('1. Testando conectividade básica...');
    
    // Verificar se conseguimos acessar alguma tabela existente
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id')
      .limit(1);
    
    if (poolsError) {
      console.log('❌ Erro ao acessar tabela pools:', poolsError.message);
    } else {
      console.log('✅ Conectividade OK - conseguiu acessar tabela pools');
    }

    // Tentar acessar as tabelas de segurança
    console.log('\n2. Testando acesso às tabelas de segurança...');
    
    const securityTables = ['security_logs', 'database_audit_logs', 'lgpd_compliance_logs'];
    
    for (const tableName of securityTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Tabela ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ Tabela ${tableName}: acessível`);
        }
      } catch (e) {
        console.log(`❌ Tabela ${tableName}: erro de conexão - ${e.message}`);
      }
    }

    console.log('\n3. Verificando URL e configuração...');
    console.log('URL:', SUPABASE_URL);
    console.log('Service Key configurada:', SUPABASE_SERVICE_KEY ? 'Sim' : 'Não');

  } catch (error) {
    console.error('❌ Erro durante teste:', error.message);
  }
}

simpleTest();