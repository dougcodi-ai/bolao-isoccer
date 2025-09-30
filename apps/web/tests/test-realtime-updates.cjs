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

async function testRealtimeUpdates() {
  try {
    console.log('⚡ Teste de atualizações em tempo real\n');

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

    // 2. Verificar inventário atual
    console.log('📊 Verificando inventário atual...');
    const { data: currentPurchases, error: currentError } = await supabase
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId)
      .eq('booster', 'segunda_chance');

    if (currentError) {
      console.error('❌ Erro ao verificar inventário:', currentError.message);
      return;
    }

    const currentAmount = currentPurchases?.reduce((sum, p) => sum + p.amount, 0) || 0;
    console.log(`🎯 Segunda Chance atual: ${currentAmount} unidade(s)`);

    console.log('\n🌐 INSTRUÇÕES:');
    console.log('1. Abra http://localhost:3002/wallet em seu navegador');
    console.log('2. Observe a quantidade atual de "Segunda Chance"');
    console.log('3. Pressione ENTER quando estiver pronto para simular a compra');
    console.log('4. Observe se a quantidade se atualiza automaticamente na interface\n');

    // Aguardar input do usuário
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    console.log('🛒 Simulando compra de 3x Segunda Chance...');
    console.log('⏰ A interface deve se atualizar automaticamente em alguns segundos...\n');

    // 3. Simular compra
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'segunda_chance',
        amount: 3,
        source: 'purchase'
      })
      .select();

    if (purchaseError) {
      console.error('❌ Erro ao simular compra:', purchaseError.message);
      return;
    }

    console.log('✅ Compra inserida no banco de dados');
    console.log(`📈 Nova quantidade esperada: ${currentAmount + 3} unidade(s)`);

    // 4. Aguardar um pouco para as atualizações
    console.log('\n⏳ Aguardando 3 segundos para propagação...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Verificar se foi atualizado
    const { data: updatedPurchases, error: updatedError } = await supabase
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId)
      .eq('booster', 'segunda_chance');

    if (updatedError) {
      console.error('❌ Erro ao verificar inventário atualizado:', updatedError.message);
      return;
    }

    const updatedAmount = updatedPurchases?.reduce((sum, p) => sum + p.amount, 0) || 0;
    console.log(`📊 Segunda Chance atualizada: ${updatedAmount} unidade(s)`);

    if (updatedAmount === currentAmount + 3) {
      console.log('✅ Banco de dados atualizado corretamente');
    } else {
      console.log('⚠️ Inconsistência no banco de dados');
    }

    console.log('\n🎯 VERIFICAÇÃO MANUAL:');
    console.log('- A quantidade na interface foi atualizada automaticamente?');
    console.log('- O span mostrou "Atualizando inventário..." durante o processo?');
    console.log('- A nova quantidade apareceu sem precisar recarregar a página?');

    console.log('\n✨ Teste de tempo real concluído!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testRealtimeUpdates();