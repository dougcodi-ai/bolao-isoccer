require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function cleanAndTestCorrectQuantities() {
  try {
    console.log('🧹 Limpeza e teste com quantidades corretas\n');

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

    // 2. Limpar compras existentes
    console.log('🗑️ Limpando compras existentes...');
    const { error: deleteError } = await supabase
      .from('booster_purchases')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('❌ Erro ao limpar compras:', deleteError.message);
      return;
    }

    console.log('✅ Compras anteriores removidas');

    // 3. Limpar notificações relacionadas
    console.log('🗑️ Limpando notificações...');
    const { error: notifDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'booster_purchase');

    if (notifDeleteError) {
      console.warn('⚠️ Erro ao limpar notificações:', notifDeleteError.message);
    } else {
      console.log('✅ Notificações removidas');
    }

    // 4. Testar compras com quantidades corretas (1, 3, 5)
    console.log('\n💰 Testando compras com quantidades corretas...');
    
    const correctPurchases = [
      { booster: 'o_esquecido', amount: 1, description: '1x O Esquecido' },
      { booster: 'o_esquecido', amount: 3, description: '3x O Esquecido' },
      { booster: 'segunda_chance', amount: 5, description: '5x Segunda Chance' },
      { booster: 'o_escudo', amount: 3, description: '3x O Escudo' },
      { booster: 'palpite_automatico', amount: 1, description: '1x Palpite Automático' }
    ];

    for (const purchase of correctPurchases) {
      console.log(`\n🛒 Comprando: ${purchase.description}`);
      
      // Verificar se a quantidade é válida
      if (![1, 3, 5].includes(purchase.amount)) {
        console.error(`❌ Quantidade inválida: ${purchase.amount} (deve ser 1, 3 ou 5)`);
        continue;
      }

      // Inserir compra
      const { data, error } = await supabase
        .from('booster_purchases')
        .insert({
          user_id: userId,
          booster: purchase.booster,
          amount: purchase.amount,
          source: 'purchase'
        })
        .select();

      if (error) {
        console.error(`❌ Erro ao comprar ${purchase.booster}:`, error.message);
      } else {
        console.log(`✅ ${purchase.description} comprado com sucesso!`);
        
        // Criar notificação
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'booster_purchase',
            title: 'Booster adquirido',
            body: `Você comprou ${purchase.amount}x ${purchase.booster.replace(/_/g, ' ')}.`,
            meta: { booster: purchase.booster, qty: purchase.amount }
          });
          console.log(`📢 Notificação criada`);
        } catch (notifError) {
          console.warn(`⚠️ Erro ao criar notificação:`, notifError.message);
        }
      }

      // Aguardar um pouco entre compras
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Verificar inventário final
    console.log('\n📊 Verificando inventário final...');
    const { data: inventory, error: invError } = await supabase
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId);

    if (invError) {
      console.error('❌ Erro ao verificar inventário:', invError.message);
    } else {
      const totals = {};
      inventory.forEach(item => {
        totals[item.booster] = (totals[item.booster] || 0) + item.amount;
      });

      console.log('🎁 Inventário final:');
      Object.entries(totals).forEach(([booster, total]) => {
        console.log(`  🎯 ${booster}: ${total} unidade(s)`);
      });

      // 6. Verificar se todas as quantidades são válidas
      console.log('\n🔍 Verificação de validade:');
      let allValid = true;
      for (const item of inventory) {
        if (![1, 3, 5].includes(item.amount)) {
          console.log(`❌ Quantidade inválida encontrada: ${item.booster} = ${item.amount}`);
          allValid = false;
        }
      }

      if (allValid) {
        console.log('✅ Todas as quantidades são válidas (1, 3 ou 5)');
      }

      console.log('\n🎉 Teste concluído!');
      console.log('🔗 Acesse http://localhost:3002/wallet para verificar na interface');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

cleanAndTestCorrectQuantities();