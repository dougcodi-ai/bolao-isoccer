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

async function manualCleanBoosters() {
  try {
    console.log('🧹 Limpeza manual de boosters\n');

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

    // 2. Listar todos os registros com IDs
    console.log('🔍 Listando todos os registros...');
    const { data: allRecords, error: listError } = await supabase
      .from('booster_purchases')
      .select('id, booster, amount, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (listError) {
      console.error('❌ Erro ao listar registros:', listError.message);
      return;
    }

    console.log(`📦 Encontrados ${allRecords?.length || 0} registros:`);
    
    if (!allRecords || allRecords.length === 0) {
      console.log('✅ Nenhum registro encontrado');
      return;
    }

    // 3. Identificar registros com quantidades inválidas
    const invalidRecords = allRecords.filter(record => ![1, 3, 5].includes(record.amount));
    const validRecords = allRecords.filter(record => [1, 3, 5].includes(record.amount));

    console.log(`\n📊 Análise dos registros:`);
    console.log(`  ✅ Registros válidos: ${validRecords.length}`);
    console.log(`  ❌ Registros inválidos: ${invalidRecords.length}`);

    if (invalidRecords.length > 0) {
      console.log(`\n❌ Registros com quantidades inválidas:`);
      invalidRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id} | ${record.booster}: ${record.amount} unidade(s) | ${new Date(record.created_at).toLocaleString('pt-BR')}`);
      });

      // 4. Remover registros inválidos um por um
      console.log(`\n🗑️ Removendo registros inválidos...`);
      
      for (const record of invalidRecords) {
        console.log(`\n🗑️ Removendo ID ${record.id} (${record.booster}: ${record.amount})...`);
        
        const { error: deleteError } = await supabase
          .from('booster_purchases')
          .delete()
          .eq('id', record.id);

        if (deleteError) {
          console.error(`❌ Erro ao remover ID ${record.id}:`, deleteError.message);
        } else {
          console.log(`✅ ID ${record.id} removido com sucesso`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 5. Verificar resultado
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
    }

    console.log('\n🎉 Limpeza manual concluída!');
    console.log('🔗 Acesse http://localhost:3002/wallet para verificar na interface');

  } catch (error) {
    console.error('❌ Erro na limpeza manual:', error.message);
  }
}

manualCleanBoosters();