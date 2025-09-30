const { createClient } = require('@supabase/supabase-js');

async function checkIdempotencyTable() {
  try {
    // Usar as credenciais do .env.local
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Credenciais do Supabase não encontradas no .env.local');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Verificando tabela idempotency_log...\n');

    // 1. Tentar acessar a tabela diretamente
    const { data: records, error: recordsError } = await supabase
      .from('idempotency_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recordsError) {
      if (recordsError.message.includes('does not exist') || recordsError.message.includes('relation') || recordsError.code === '42P01') {
        console.log('❌ Tabela idempotency_log NÃO EXISTE!');
        console.log('   Erro:', recordsError.message);
        return;
      } else {
        console.log('❌ Erro ao acessar tabela:', recordsError.message);
        return;
      }
    }

    console.log('✅ Tabela idempotency_log existe e é acessível');
    console.log(`📊 Total de registros recentes: ${records?.length || 0}`);
    
    if (records && records.length > 0) {
      console.log('\n🔍 Últimos registros:');
      records.forEach((record, index) => {
        console.log(`  ${index + 1}. user_id: ${record.user_id}, key: ${record.key}, created_at: ${record.created_at}`);
      });
    }

    // 2. Verificar registros do usuário de teste
    const testUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const { data: testRecords, error: testError } = await supabase
      .from('idempotency_log')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false });

    if (testError) {
      console.log('❌ Erro ao buscar registros do usuário de teste:', testError.message);
      return;
    }

    console.log(`\n🧪 Registros do usuário de teste (${testUserId}): ${testRecords?.length || 0}`);
    
    if (testRecords && testRecords.length > 0) {
      console.log('\n📝 Registros de idempotência do teste:');
      testRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. key: ${record.key}, created_at: ${record.created_at}`);
      });
    } else {
      console.log('   Nenhum registro de idempotência encontrado para o usuário de teste');
    }

    // 3. Verificar se há registros duplicados (mesmo user_id e key)
    const { data: allRecords, error: allError } = await supabase
      .from('idempotency_log')
      .select('user_id, key, created_at')
      .order('created_at', { ascending: false });

    if (allError) {
      console.log('❌ Erro ao buscar todos os registros:', allError.message);
      return;
    }

    if (allRecords && allRecords.length > 0) {
      const duplicates = {};
      allRecords.forEach(record => {
        const key = `${record.user_id}:${record.key}`;
        if (!duplicates[key]) {
          duplicates[key] = [];
        }
        duplicates[key].push(record.created_at);
      });

      const duplicateKeys = Object.keys(duplicates).filter(key => duplicates[key].length > 1);
      
      if (duplicateKeys.length > 0) {
        console.log('\n⚠️  REGISTROS DUPLICADOS ENCONTRADOS:');
        duplicateKeys.forEach(key => {
          console.log(`  - ${key}: ${duplicates[key].length} registros`);
          duplicates[key].forEach((timestamp, index) => {
            console.log(`    ${index + 1}. ${timestamp}`);
          });
        });
      } else {
        console.log('\n✅ Nenhum registro duplicado encontrado na tabela idempotency_log');
      }
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

checkIdempotencyTable();