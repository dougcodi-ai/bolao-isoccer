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

async function checkPurchaseQuantities() {
  try {
    console.log('🔍 Verificação detalhada das quantidades de boosters\n');

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

    // 2. Verificar todas as compras individuais
    console.log('📊 Verificando todas as compras individuais...');
    const { data: allPurchases, error: purchasesError } = await supabase
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (purchasesError) {
      console.error('❌ Erro ao verificar compras:', purchasesError.message);
      return;
    }

    console.log(`📦 Total de registros de compra: ${allPurchases?.length || 0}\n`);

    // 3. Agrupar por booster e mostrar detalhes
    const boosterGroups = {};
    for (const purchase of allPurchases || []) {
      if (!boosterGroups[purchase.booster]) {
        boosterGroups[purchase.booster] = [];
      }
      boosterGroups[purchase.booster].push(purchase);
    }

    console.log('🎯 Detalhamento por booster:\n');
    
    for (const [boosterKey, purchases] of Object.entries(boosterGroups)) {
      console.log(`📋 ${boosterKey.toUpperCase()}:`);
      
      let totalAmount = 0;
      purchases.forEach((purchase, index) => {
        console.log(`  ${index + 1}. Quantidade: ${purchase.amount} | Data: ${new Date(purchase.created_at).toLocaleString('pt-BR')} | Source: ${purchase.source}`);
        totalAmount += purchase.amount;
      });
      
      console.log(`  📊 TOTAL: ${totalAmount} unidade(s)`);
      console.log(`  🔢 Número de compras: ${purchases.length}`);
      
      // Verificar se as quantidades estão corretas (1, 3, 5)
      const invalidQuantities = purchases.filter(p => ![1, 3, 5].includes(p.amount));
      if (invalidQuantities.length > 0) {
        console.log(`  ⚠️  QUANTIDADES INVÁLIDAS encontradas:`);
        invalidQuantities.forEach(p => {
          console.log(`    - ${p.amount} unidade(s) (deveria ser 1, 3 ou 5)`);
        });
      } else {
        console.log(`  ✅ Todas as quantidades são válidas (1, 3 ou 5)`);
      }
      
      console.log('');
    }

    // 4. Resumo final
    console.log('📈 RESUMO FINAL:');
    const totalInventory = {};
    for (const [boosterKey, purchases] of Object.entries(boosterGroups)) {
      const total = purchases.reduce((sum, p) => sum + p.amount, 0);
      totalInventory[boosterKey] = total;
      console.log(`  🎯 ${boosterKey}: ${total} unidade(s)`);
    }

    // 5. Verificar o que está sendo exibido na interface
    console.log('\n🖥️  COMPARAÇÃO COM INTERFACE:');
    console.log('Interface mostra:');
    console.log('  - O Esquecido: 10 disponíveis');
    console.log('  - Escudo: 10 disponíveis');
    console.log('  - Segunda Chance: 6 disponíveis');
    console.log('  - Palpite Automático: 0 disponíveis');
    
    console.log('\nBanco de dados mostra:');
    for (const [booster, qty] of Object.entries(totalInventory)) {
      console.log(`  - ${booster}: ${qty} disponíveis`);
    }

    // 6. Identificar discrepâncias
    console.log('\n🔍 ANÁLISE DE DISCREPÂNCIAS:');
    const interfaceData = {
      'o_esquecido': 10,
      'o_escudo': 10, 
      'segunda_chance': 6,
      'palpite_automatico': 0
    };

    for (const [booster, interfaceQty] of Object.entries(interfaceData)) {
      const dbQty = totalInventory[booster] || 0;
      if (dbQty !== interfaceQty) {
        console.log(`  ⚠️  ${booster}: Interface=${interfaceQty}, DB=${dbQty} (diferença: ${dbQty - interfaceQty})`);
      } else {
        console.log(`  ✅ ${booster}: Interface e DB coincidem (${dbQty})`);
      }
    }

  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
  }
}

checkPurchaseQuantities();