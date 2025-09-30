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

async function createSecurityLogsTable() {
  console.log('🔧 Criando tabela security_logs manualmente...\n');

  try {
    // SQL para criar a tabela security_logs
    const createTableSQL = `
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
    `;

    console.log('1. Criando tabela...');
    
    // Usar uma abordagem diferente - tentar via REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        sql_query: createTableSQL
      })
    });

    if (!response.ok) {
      console.log('❌ Erro na API REST:', response.status, response.statusText);
      
      // Tentar abordagem alternativa - usar SQL direto
      console.log('🔄 Tentando abordagem alternativa...');
      
      // Vamos tentar inserir um registro de teste para ver se a tabela existe
      const { data: testData, error: testError } = await supabase
        .from('security_logs')
        .insert({
          event_type: 'test',
          ip_address: '127.0.0.1',
          user_agent: 'Test Script',
          message: 'Teste de criação de tabela',
          severity: 'info'
        })
        .select();

      if (testError) {
        console.log('❌ Tabela não existe ou erro:', testError.message);
        
        // Vamos tentar criar via SQL usando uma função personalizada
        console.log('🔄 Tentando criar via função personalizada...');
        
        // Primeiro, vamos criar uma função para executar SQL
        const createFunctionSQL = `
          CREATE OR REPLACE FUNCTION public.create_security_table()
          RETURNS TEXT AS $$
          BEGIN
            EXECUTE '
              CREATE TABLE IF NOT EXISTS public.security_logs (
                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                  event_type TEXT NOT NULL,
                  user_id UUID,
                  ip_address TEXT NOT NULL,
                  user_agent TEXT NOT NULL,
                  message TEXT,
                  metadata JSONB DEFAULT ''{}''::jsonb,
                  severity TEXT NOT NULL,
                  timestamp TIMESTAMPTZ DEFAULT NOW(),
                  resolved BOOLEAN DEFAULT FALSE,
                  created_at TIMESTAMPTZ DEFAULT NOW()
              );
            ';
            RETURN 'Tabela criada com sucesso';
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;

        const { data: funcData, error: funcError } = await supabase
          .rpc('exec_sql', { sql_query: createFunctionSQL });

        if (funcError) {
          console.log('❌ Erro ao criar função:', funcError.message);
        } else {
          console.log('✅ Função criada, executando...');
          
          const { data: execData, error: execError } = await supabase
            .rpc('create_security_table');

          if (execError) {
            console.log('❌ Erro ao executar função:', execError.message);
          } else {
            console.log('✅ Resultado:', execData);
          }
        }
      } else {
        console.log('✅ Tabela já existe e funcionando:', testData);
      }
    } else {
      const result = await response.json();
      console.log('✅ Tabela criada via REST API:', result);
    }

  } catch (error) {
    console.error('❌ Erro durante criação manual:', error.message);
  }
}

createSecurityLogsTable();