require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function removeInvalidQuantities() {
  try {
    console.log('🧹 Removendo registros com quantidades inválidas\n');

    // 1. Login
    console.log('🔑 Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    const userId = authData.user.id;
    console.log('✅ Login realizado com sucesso');
    console.log(`🆔 User ID: ${userId}\n`);

    // 2. Buscar registros com quantidades inválidas
    console.log('🔍 Buscando registros com quantidades inválidas...');
    const { data: invalidRecords, error: searchError } = await supabase
      .from('booster_purchases')
      .select('id, booster, amount, created_at')
      .eq('user_id', userId)
      .not('amount', 'in', '(1,3,5)')
      .order('created_at', { ascending: true });

    if (searchError) {
      console.error('❌ Erro ao buscar registros:', searchError.message);
      return;
    }

    console.log(`📦 Encontrados ${invalidRecords?.length || 0} registros com quantidades inválidas:`);
    
    if (!invalidRecords || invalidRecords.length === 0) {
      console.log('✅ Nenhum registro com quantidade inválida encontrado');
      return;
    }

    // 3. Listar registros inválidos
    invalidRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id} | ${record.booster}: ${record.amount} unidade(s) | ${new Date(record.created_at).toLocaleString('pt-BR')}`);
    });

    // 4. Remover todos os registros inválidos
    console.log(`\n🗑️ Removendo ${invalidRecords.length} registros inválidos...`);
    
    const idsToDelete = invalidRecords.map(record => record.id);
    
    const { error: deleteError } = await supabase
      .from('booster_purchases')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('❌ Erro ao remover registros:', deleteError.message);
      return;
    }

    console.log('✅ Registros inválidos removidos com sucesso');

    // 5. Verificar resultado final
    console.log('\n🔍 Verificando resultado final...');
    const { data: finalRecords, error: finalError } = await supabase
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (finalError) {
      console.error('❌ Erro ao verificar resultado:', finalError.message);
      return;
    }

    console.log(`📦 Registros restantes: ${finalRecords?.length || 0}`);

    if (finalRecords && finalRecords.length > 0) {
      console.log('\n📋 Registros finais:');
      const totals = {};
      let allValid = true;

      finalRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.booster}: ${record.amount} unidade(s) | ${new Date(record.created_at).toLocaleString('pt-BR')}`);
        totals[record.booster] = (totals[record.booster] || 0) + record.amount;
        
        if (![1, 3, 5].includes(record.amount)) {
          console.log(`    ❌ QUANTIDADE INVÁLIDA: ${record.amount}`);
          allValid = false;
        }
      });

      console.log('\n📈 Totais por booster:');
      Object.entries(totals).forEach(([booster, total]) => {
        console.log(`  🎯 ${booster}: ${total} unidade(s)`);
      });

      if (allValid) {
        console.log('\n✅ Todas as quantidades são válidas (1, 3 ou 5)');
      } else {
        console.log('\n❌ Ainda há quantidades inválidas');
      }
    } else {
      console.log('\n✅ Nenhum registro restante');
    }

    console.log('\n🎉 Limpeza concluída!');
    console.log('🔗 Acesse http://localhost:3002/wallet para verificar na interface');

  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

removeInvalidQuantities();