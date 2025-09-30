require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testBoosterUsages() {
  console.log('🧪 Testando estrutura da tabela booster_usages...\n');

  // Primeiro, vamos tentar inserir um registro de teste para ver quais colunas existem
  const testUsage = {
    user_id: '00000000-0000-0000-0000-000000000000', // UUID de teste
    booster: 'test_booster',
    status: 'consumed',
    used_at: new Date().toISOString()
  };

  console.log('📝 Tentando inserir registro de teste...');
  const { data: insertData, error: insertError } = await supabaseAdmin
    .from('booster_usages')
    .insert(testUsage)
    .select();

  if (insertError) {
    console.log('❌ Erro ao inserir:', insertError.message);
    console.log('💡 Isso nos ajuda a entender a estrutura da tabela');
    
    // Se o erro menciona colunas específicas, podemos entender a estrutura
    if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
      console.log('🔍 Parece que algumas colunas não existem na tabela');
    }
  } else {
    console.log('✅ Registro inserido com sucesso:', insertData);
    
    // Limpar o registro de teste
    if (insertData && insertData[0]) {
      await supabaseAdmin
        .from('booster_usages')
        .delete()
        .eq('id', insertData[0].id);
      console.log('🧹 Registro de teste removido');
    }
  }

  // Tentar com estrutura mínima
  console.log('\n📝 Tentando com estrutura mínima...');
  const minimalUsage = {
    user_id: '00000000-0000-0000-0000-000000000000',
    booster: 'test_booster'
  };

  const { data: minimalData, error: minimalError } = await supabaseAdmin
    .from('booster_usages')
    .insert(minimalUsage)
    .select();

  if (minimalError) {
    console.log('❌ Erro com estrutura mínima:', minimalError.message);
  } else {
    console.log('✅ Estrutura mínima funcionou:', minimalData);
    
    // Limpar
    if (minimalData && minimalData[0]) {
      await supabaseAdmin
        .from('booster_usages')
        .delete()
        .eq('id', minimalData[0].id);
      console.log('🧹 Registro mínimo removido');
    }
  }
}

testBoosterUsages();