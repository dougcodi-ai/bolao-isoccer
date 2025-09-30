require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Usar service role key para bypass de RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function adminCleanBoosters() {
  try {
    console.log('🔧 Limpeza administrativa de boosters\n');

    // 1. Primeiro, vamos identificar o usuário de teste
    const testEmail = 'teste@bolao.com';
    
    console.log('🔍 Buscando usuário de teste...');
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Erro ao buscar usuários:', userError.message);
      return;
    }

    const testUser = users.users.find(user => user.email === testEmail);
    if (!testUser) {
      console.error('❌ Usuário de teste não encontrado');
      return;
    }

    const userId = testUser.id;
    console.log(`✅ Usuário encontrado: ${userId}\n`);

    // 2. Listar todos os registros
    console.log('📋 Listando todos os registros...');
    const { data: allRecords, error: listError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (listError) {
      console.error('❌ Erro ao listar registros:', listError.message);
      return;
    }

    console.log(`📦 Total de registros: ${allRecords?.length || 0}`);

    if (!allRecords || allRecords.length === 0) {
      console.log('✅ Nenhum registro encontrado');
      return;
    }

    // 3. Separar registros válidos e inválidos
    const validRecords = allRecords.filter(record => [1, 3, 5].includes(record.amount));
    const invalidRecords = allRecords.filter(record => ![1, 3, 5].includes(record.amount));

    console.log(`\n📊 Análise:`);
    console.log(`  ✅ Registros válidos: ${validRecords.length}`);
    console.log(`  ❌ Registros inválidos: ${invalidRecords.length}`);

    if (invalidRecords.length > 0) {
      console.log(`\n❌ Registros inválidos encontrados:`);
      invalidRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id} | ${record.booster}: ${record.amount} unidade(s)`);
      });

      // 4. Remover TODOS os registros inválidos usando admin
      console.log(`\n🗑️ Removendo ${invalidRecords.length} registros inválidos com privilégios administrativos...`);
      
      for (const record of invalidRecords) {
        console.log(`🗑️ Removendo ID ${record.id}...`);
        
        const { error: deleteError } = await supabaseAdmin
          .from('booster_purchases')
          .delete()
          .eq('id', record.id);

        if (deleteError) {
          console.error(`❌ Erro ao remover ID ${record.id}:`, deleteError.message);
        } else {
          console.log(`✅ ID ${record.id} removido`);
        }
      }
    }

    // 5. Verificação final
    console.log('\n🔍 Verificação final...');
    const { data: finalRecords, error: finalError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError.message);
      return;
    }

    console.log(`📦 Registros finais: ${finalRecords?.length || 0}`);

    if (finalRecords && finalRecords.length > 0) {
      const totals = {};
      let hasInvalid = false;

      console.log('\n📋 Registros restantes:');
      finalRecords.forEach((record, index) => {
        const isValid = [1, 3, 5].includes(record.amount);
        const status = isValid ? '✅' : '❌';
        
        console.log(`  ${index + 1}. ${status} ${record.booster}: ${record.amount} unidade(s)`);
        totals[record.booster] = (totals[record.booster] || 0) + record.amount;
        
        if (!isValid) hasInvalid = true;
      });

      console.log('\n📈 Totais por booster:');
      Object.entries(totals).forEach(([booster, total]) => {
        console.log(`  🎯 ${booster}: ${total} unidade(s)`);
      });

      if (!hasInvalid) {
        console.log('\n✅ Todas as quantidades são válidas!');
      } else {
        console.log('\n❌ Ainda há quantidades inválidas');
      }
    }

    console.log('\n🎉 Limpeza administrativa concluída!');

  } catch (error) {
    console.error('❌ Erro na limpeza administrativa:', error.message);
    console.error(error);
  }
}

adminCleanBoosters();