require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function resetAllInventories() {
  try {
    console.log('🧹 VARREDURA 360° - ZERANDO INVENTÁRIO DE TODOS OS USUÁRIOS\n');
    console.log('⚠️  ATENÇÃO: Esta operação irá deletar TODOS os registros de compras e usos de boosters!');
    console.log('═'.repeat(80));

    // 1. Verificar quantos registros existem
    console.log('\n📊 VERIFICANDO ESTADO ATUAL...');
    
    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from('booster_purchases')
      .select('user_id, booster, amount')
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('❌ Erro ao buscar compras:', purchasesError.message);
      return;
    }

    console.log(`📦 Total de registros de compras: ${purchases.length}`);
    
    // Agrupar por usuário
    const userPurchases = {};
    purchases.forEach(p => {
      if (!userPurchases[p.user_id]) {
        userPurchases[p.user_id] = {};
      }
      userPurchases[p.user_id][p.booster] = (userPurchases[p.user_id][p.booster] || 0) + p.amount;
    });

    console.log(`👥 Usuários com inventário: ${Object.keys(userPurchases).length}`);
    
    // Mostrar resumo por usuário
    Object.entries(userPurchases).forEach(([userId, boosters], index) => {
      console.log(`\n  👤 Usuário ${index + 1} (${userId.substring(0, 8)}...):`);
      Object.entries(boosters).forEach(([booster, amount]) => {
        console.log(`    🎯 ${booster}: ${amount} unidades`);
      });
    });

    // 2. Verificar usos (se a tabela existir)
    console.log('\n🎮 VERIFICANDO USOS...');
    try {
      const { data: usages, error: usagesError } = await supabaseAdmin
        .from('booster_usages')
        .select('user_id, booster, status');

      if (usagesError) {
        console.log('❌ Erro ao acessar booster_usages:', usagesError.message);
        console.log('💡 Tabela pode não existir - continuando sem ela');
      } else {
        console.log(`🎮 Total de registros de usos: ${usages.length}`);
      }
    } catch (err) {
      console.log('❌ Tabela booster_usages não encontrada - continuando sem ela');
    }

    // 3. Confirmar operação
    console.log('\n⚠️  CONFIRMAÇÃO NECESSÁRIA:');
    console.log('Esta operação irá:');
    console.log('1. 🗑️  Deletar TODOS os registros da tabela booster_purchases');
    console.log('2. 🗑️  Deletar TODOS os registros da tabela booster_usages (se existir)');
    console.log('3. 🔄 Resetar o inventário de TODOS os usuários para zero');
    console.log('\n⏰ Aguardando 5 segundos antes de prosseguir...');
    
    // Aguardar 5 segundos
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Deletar registros de compras
    console.log('\n🗑️  DELETANDO REGISTROS DE COMPRAS...');
    const { error: deleteError } = await supabaseAdmin
      .from('booster_purchases')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos exceto um ID impossível

    if (deleteError) {
      console.error('❌ Erro ao deletar compras:', deleteError.message);
      return;
    }

    console.log('✅ Todos os registros de compras foram deletados');

    // 5. Deletar registros de usos (se a tabela existir)
    console.log('\n🗑️  DELETANDO REGISTROS DE USOS...');
    try {
      const { error: deleteUsagesError } = await supabaseAdmin
        .from('booster_usages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deletar todos exceto um ID impossível

      if (deleteUsagesError) {
        console.log('❌ Erro ao deletar usos:', deleteUsagesError.message);
        console.log('💡 Continuando mesmo assim...');
      } else {
        console.log('✅ Todos os registros de usos foram deletados');
      }
    } catch (err) {
      console.log('💡 Tabela booster_usages não encontrada - pulando');
    }

    // 6. Verificar se a limpeza foi bem-sucedida
    console.log('\n🔍 VERIFICANDO LIMPEZA...');
    
    const { data: remainingPurchases, error: checkError } = await supabaseAdmin
      .from('booster_purchases')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('❌ Erro ao verificar limpeza:', checkError.message);
      return;
    }

    if (remainingPurchases && remainingPurchases.length === 0) {
      console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
      console.log('🎯 Todos os inventários foram zerados');
    } else {
      console.log('❌ ATENÇÃO: Ainda existem registros na tabela');
      console.log(`📊 Registros restantes: ${remainingPurchases.length}`);
    }

    // 7. Instruções para o próximo passo
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('═'.repeat(80));
    console.log('1. 🛒 Fazer uma compra real na interface da carteira');
    console.log('2. 👀 Verificar o que é mostrado no frontend');
    console.log('3. 🔍 Verificar o que foi inserido no banco de dados');
    console.log('4. 📊 Comparar os valores para identificar a duplicação');
    console.log('\n🎯 ESTADO ATUAL: Sistema limpo e pronto para teste!');

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error.message);
    console.error(error);
  }
}

resetAllInventories();