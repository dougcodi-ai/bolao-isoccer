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

async function executeSQL(sql) {
  try {
    // Tentar via API REST direta
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql_query: sql
      })
    });

    if (response.ok) {
      const result = await response.text();
      return { success: true, result };
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createTablesDirectly() {
  console.log('🔧 Tentando criar tabelas usando SQL direto...\n');

  // SQL simplificado para criar apenas a tabela security_logs
  const createSecurityLogsSQL = `
    CREATE TABLE IF NOT EXISTS public.security_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id UUID,
        ip_address TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        severity TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  console.log('1. Criando tabela security_logs...');
  const result1 = await executeSQL(createSecurityLogsSQL);
  
  if (result1.success) {
    console.log('✅ Tabela security_logs criada com sucesso');
  } else {
    console.log('❌ Erro ao criar security_logs:', result1.error);
  }

  // Criar índices
  const createIndexesSQL = `
    CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON public.security_logs(timestamp);
  `;

  console.log('2. Criando índices...');
  const result2 = await executeSQL(createIndexesSQL);
  
  if (result2.success) {
    console.log('✅ Índices criados com sucesso');
  } else {
    console.log('❌ Erro ao criar índices:', result2.error);
  }

  // Habilitar RLS
  const enableRLSSQL = `
    ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
  `;

  console.log('3. Habilitando RLS...');
  const result3 = await executeSQL(enableRLSSQL);
  
  if (result3.success) {
    console.log('✅ RLS habilitado com sucesso');
  } else {
    console.log('❌ Erro ao habilitar RLS:', result3.error);
  }

  // Tentar inserir um registro de teste
  console.log('\n4. Testando inserção...');
  
  try {
    const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/security_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        event_type: 'test',
        ip_address: '127.0.0.1',
        user_agent: 'Direct SQL Test',
        message: 'Teste de criação direta de tabela',
        severity: 'info'
      })
    });

    if (testResponse.ok) {
      const testResult = await testResponse.json();
      console.log('✅ Inserção de teste bem-sucedida:', testResult[0]?.id);
    } else {
      const errorText = await testResponse.text();
      console.log('❌ Erro na inserção de teste:', testResponse.status, errorText);
    }
  } catch (error) {
    console.log('❌ Erro na inserção de teste:', error.message);
  }

  console.log('\n🎉 Processo de criação direta concluído!');
}

createTablesDirectly();