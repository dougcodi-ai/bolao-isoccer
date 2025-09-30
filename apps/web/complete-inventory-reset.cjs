require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Usar service role key para acesso administrativo
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function completeInventoryReset() {
  try {
    console.log('🧹 RESET COMPLETO DO INVENTÁRIO DE TODOS OS USUÁRIOS\n');

    // 1. Verificar quantos registros existem
    console.log('🔍 Verificando registros existentes...');
    const { data: allRecords, error: countError } = await supabaseAdmin
      .from('booster_purchases')
      .select('id, user_id, booster, amount, created_at');

    if (countError) {
      console.error('❌ Erro ao contar registros:', countError.message);
      return;
    }

    console.log(`📦 Total de registros encontrados: ${allRecords?.length || 0}`);

    if (!allRecords || allRecords.length === 0) {
      console.log('✅ Nenhum registro encontrado - inventário já está vazio');
      return;
    }

    // 2. Mostrar estatísticas por usuário
    const userStats = {};
    allRecords.forEach(record => {
      if (!userStats[record.user_id]) {
        userStats[record.user_id] = { total: 0, boosters: {} };
      }
      userStats[record.user_id].total++;
      userStats[record.user_id].boosters[record.booster] = 
        (userStats[record.user_id].boosters[record.booster] || 0) + record.amount;
    });

    console.log('\n📊 Estatísticas por usuário:');
    Object.entries(userStats).forEach(([userId, stats]) => {
      console.log(`\n👤 Usuário: ${userId}`);
      console.log(`   📦 Total de compras: ${stats.total}`);
      Object.entries(stats.boosters).forEach(([booster, amount]) => {
        console.log(`   🎯 ${booster}: ${amount} unidade(s)`);
      });
    });

    // 3. Remover TODOS os registros
    console.log('\n🗑️ Removendo TODOS os registros de booster_purchases...');
    
    const { error: deleteError } = await supabaseAdmin
      .from('booster_purchases')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Condição que sempre será verdadeira

    if (deleteError) {
      console.error('❌ Erro ao remover registros:', deleteError.message);
      return;
    }

    console.log('✅ Todos os registros removidos com sucesso');

    // 4. Verificar se realmente foi limpo
    console.log('\n🔍 Verificando limpeza...');
    const { data: remainingRecords, error: verifyError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*');

    if (verifyError) {
      console.error('❌ Erro na verificação:', verifyError.message);
      return;
    }

    if (!remainingRecords || remainingRecords.length === 0) {
      console.log('✅ LIMPEZA CONFIRMADA - Nenhum registro restante');
    } else {
      console.log(`❌ ATENÇÃO: Ainda existem ${remainingRecords.length} registros`);
      remainingRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.booster}: ${record.amount} unidade(s)`);
      });
    }

    // 5. Também limpar notificações relacionadas (se existirem)
    console.log('\n🧹 Limpando notificações relacionadas...');
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .like('message', '%booster%');

    if (notifError) {
      console.log('⚠️ Aviso: Erro ao limpar notificações (pode não existir tabela):', notifError.message);
    } else {
      console.log('✅ Notificações relacionadas limpas');
    }

    console.log('\n🎉 RESET COMPLETO FINALIZADO!');
    console.log('📊 Estado atual: INVENTÁRIO ZERADO PARA TODOS OS USUÁRIOS');
    console.log('🔗 Verifique a interface em: http://localhost:3002/wallet');

  } catch (error) {
    console.error('❌ Erro no reset completo:', error.message);
    console.error(error);
  }
}

completeInventoryReset();