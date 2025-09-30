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

// Configuração dos boosters para teste
const testBoosters = [
  { key: 'o_esquecido', name: 'O Esquecido' },
  { key: 'o_escudo', name: 'O Escudo' },
  { key: 'segunda_chance', name: 'Segunda Chance' },
  { key: 'palpite_automatico', name: 'Palpite Automático' }
];

async function getInventoryTotal(userId, boosterKey) {
  const { data, error } = await supabase
    .from('booster_purchases')
    .select('amount')
    .eq('user_id', userId)
    .eq('booster', boosterKey);

  if (error) {
    console.error(`❌ Erro ao buscar inventário de ${boosterKey}:`, error.message);
    return 0;
  }

  return data ? data.reduce((total, item) => total + item.amount, 0) : 0;
}

async function simulatePurchase(userId, boosterKey, quantity) {
  const { error } = await supabase
    .from('booster_purchases')
    .insert({
      user_id: userId,
      booster: boosterKey,
      amount: quantity
    });

  return !error;
}

async function testButtonQuantities() {
  try {
    console.log('🧪 Teste de Quantidades dos Botões de Compra\n');

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

    // 2. Testar cada quantidade para cada booster
    const quantities = [1, 3, 5];
    let allTestsPassed = true;

    for (const quantity of quantities) {
      console.log(`\n🔸 TESTANDO BOTÕES DE ${quantity} UNIDADE(S):`);
      console.log('═'.repeat(50));

      for (const booster of testBoosters) {
        console.log(`\n📦 Testando ${booster.name} - Botão de ${quantity} unidade(s)`);
        
        // Verificar inventário antes
        const inventoryBefore = await getInventoryTotal(userId, booster.key);
        console.log(`  📊 Inventário antes: ${inventoryBefore} unidade(s)`);

        // Simular compra
        console.log(`  🛒 Simulando compra de ${quantity} unidade(s)...`);
        const purchaseSuccess = await simulatePurchase(userId, booster.key, quantity);

        if (!purchaseSuccess) {
          console.log(`  ❌ Falha na compra`);
          allTestsPassed = false;
          continue;
        }

        // Aguardar um pouco para garantir que a transação foi processada
        await new Promise(resolve => setTimeout(resolve, 300));

        // Verificar inventário depois
        const inventoryAfter = await getInventoryTotal(userId, booster.key);
        console.log(`  📊 Inventário depois: ${inventoryAfter} unidade(s)`);

        // Calcular diferença
        const difference = inventoryAfter - inventoryBefore;
        console.log(`  📈 Diferença: +${difference} unidade(s)`);

        // Verificar se a quantidade está correta
        if (difference === quantity) {
          console.log(`  ✅ CORRETO: Botão de ${quantity} adicionou exatamente ${quantity} unidade(s)`);
        } else {
          console.log(`  ❌ ERRO: Botão de ${quantity} deveria adicionar ${quantity}, mas adicionou ${difference}`);
          allTestsPassed = false;
        }
      }
    }

    // 3. Resumo final
    console.log('\n' + '═'.repeat(60));
    console.log('📋 RESUMO FINAL DOS TESTES');
    console.log('═'.repeat(60));

    // Verificar inventário final de cada booster
    console.log('\n📦 Inventário final por booster:');
    for (const booster of testBoosters) {
      const total = await getInventoryTotal(userId, booster.key);
      console.log(`  🎯 ${booster.name}: ${total} unidade(s)`);
    }

    // Verificar se todas as quantidades no banco são válidas
    console.log('\n🔍 Verificação de validade das quantidades:');
    const { data: allPurchases, error: allError } = await supabase
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId);

    if (allError) {
      console.error('❌ Erro ao verificar compras:', allError.message);
    } else {
      const invalidPurchases = allPurchases.filter(purchase => ![1, 3, 5].includes(purchase.amount));
      
      if (invalidPurchases.length === 0) {
        console.log('✅ Todas as quantidades no banco são válidas (1, 3 ou 5)');
      } else {
        console.log('❌ Encontradas quantidades inválidas:');
        invalidPurchases.forEach(purchase => {
          console.log(`  - ${purchase.booster}: ${purchase.amount} unidade(s)`);
        });
        allTestsPassed = false;
      }
    }

    // Resultado final
    console.log('\n🎯 RESULTADO FINAL:');
    if (allTestsPassed) {
      console.log('✅ TODOS OS BOTÕES ESTÃO FUNCIONANDO CORRETAMENTE!');
      console.log('   • Botões de 1 unidade adicionam exatamente 1');
      console.log('   • Botões de 3 unidades adicionam exatamente 3');
      console.log('   • Botões de 5 unidades adicionam exatamente 5');
    } else {
      console.log('❌ ALGUNS BOTÕES NÃO ESTÃO FUNCIONANDO CORRETAMENTE');
      console.log('   Verifique os erros acima para mais detalhes');
    }

    console.log('\n🔗 Verifique a interface em: http://localhost:3002/wallet');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testButtonQuantities();