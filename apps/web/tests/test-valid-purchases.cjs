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

// Configuração dos boosters
const boosters = {
  'o_esquecido': { name: 'O Esquecido', prices: { p1: 3.90, p3: 11.11, p5: 17.55 } },
  'o_escudo': { name: 'O Escudo', prices: { p1: 4.90, p3: 13.96, p5: 22.05 } },
  'segunda_chance': { name: 'Segunda Chance', prices: { p1: 4.90, p3: 13.96, p5: 22.05 } },
  'palpite_automatico': { name: 'Palpite Automático', prices: { p1: 9.90, p3: 28.21, p5: 44.55 } }
};

async function testValidPurchases() {
  try {
    console.log('🧪 Teste de compras com quantidades válidas\n');

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
    console.log('📦 Inventário atual:');
    const { data: currentInventory, error: inventoryError } = await supabase
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId);

    if (inventoryError) {
      console.error('❌ Erro ao verificar inventário:', inventoryError.message);
      return;
    }

    const currentTotals = {};
    if (currentInventory) {
      currentInventory.forEach(item => {
        currentTotals[item.booster] = (currentTotals[item.booster] || 0) + item.amount;
      });
    }

    Object.entries(boosters).forEach(([key, booster]) => {
      const total = currentTotals[key] || 0;
      console.log(`  🎯 ${booster.name}: ${total} unidade(s)`);
    });

    console.log('\n🛒 Testando compras com quantidades válidas...\n');

    // 3. Testar compra de 1 unidade
    console.log('🔸 Teste 1: Comprando 1 unidade de "O Esquecido"');
    const purchase1 = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'o_esquecido',
        amount: 1,
        price: boosters.o_esquecido.prices.p1
      });

    if (purchase1.error) {
      console.error('❌ Erro na compra 1:', purchase1.error.message);
    } else {
      console.log('✅ Compra de 1 unidade realizada com sucesso');
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Testar compra de 3 unidades
    console.log('\n🔸 Teste 2: Comprando 3 unidades de "Segunda Chance"');
    const purchase2 = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'segunda_chance',
        amount: 3,
        price: boosters.segunda_chance.prices.p3
      });

    if (purchase2.error) {
      console.error('❌ Erro na compra 2:', purchase2.error.message);
    } else {
      console.log('✅ Compra de 3 unidades realizada com sucesso');
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Testar compra de 5 unidades
    console.log('\n🔸 Teste 3: Comprando 5 unidades de "Palpite Automático"');
    const purchase3 = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'palpite_automatico',
        amount: 5,
        price: boosters.palpite_automatico.prices.p5
      });

    if (purchase3.error) {
      console.error('❌ Erro na compra 3:', purchase3.error.message);
    } else {
      console.log('✅ Compra de 5 unidades realizada com sucesso');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 6. Verificar inventário final
    console.log('\n📦 Inventário final:');
    const { data: finalInventory, error: finalError } = await supabase
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId);

    if (finalError) {
      console.error('❌ Erro ao verificar inventário final:', finalError.message);
      return;
    }

    const finalTotals = {};
    if (finalInventory) {
      finalInventory.forEach(item => {
        finalTotals[item.booster] = (finalTotals[item.booster] || 0) + item.amount;
      });
    }

    console.log('\n📊 Comparação de inventário:');
    Object.entries(boosters).forEach(([key, booster]) => {
      const before = currentTotals[key] || 0;
      const after = finalTotals[key] || 0;
      const diff = after - before;
      const diffText = diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : '';
      
      console.log(`  🎯 ${booster.name}: ${before} → ${after} ${diffText}`);
    });

    // 7. Verificar se todas as quantidades são válidas
    console.log('\n🔍 Verificação de validade:');
    const { data: allPurchases, error: allError } = await supabase
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId);

    if (allError) {
      console.error('❌ Erro ao verificar todas as compras:', allError.message);
      return;
    }

    let allValid = true;
    const invalidPurchases = allPurchases.filter(purchase => ![1, 3, 5].includes(purchase.amount));

    if (invalidPurchases.length > 0) {
      console.log('❌ Encontradas quantidades inválidas:');
      invalidPurchases.forEach(purchase => {
        console.log(`  - ${purchase.booster}: ${purchase.amount} unidade(s)`);
      });
      allValid = false;
    } else {
      console.log('✅ Todas as quantidades são válidas (1, 3 ou 5)');
    }

    console.log('\n🎉 Teste concluído!');
    console.log('🔗 Verifique a interface em: http://localhost:3002/wallet');
    
    if (allValid) {
      console.log('✅ Todos os boosters estão com quantidades corretas');
    } else {
      console.log('❌ Ainda há problemas com as quantidades');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testValidPurchases();