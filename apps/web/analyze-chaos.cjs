require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function analyzeChaos() {
  try {
    console.log('🔥 ANÁLISE DO CAOS - VARREDURA COMPLETA\n');
    console.log('📋 RELATÓRIO DO QUE ACONTECEU:');
    console.log('1. ✅ Comprou 1 O Esquecido - funcionou');
    console.log('2. ❌ Comprou 3 O Escudo - adicionou +1 O Esquecido e 6 O Escudo');
    console.log('3. ✅ Comprou Segunda Chance - funcionou');
    console.log('4. ❌ Comprou Palpite Automático - alterou tudo');
    console.log('═'.repeat(80));

    // Login para obter o user_id
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    const userId = authData.user.id;
    console.log(`🆔 Analisando usuário: ${userId.substring(0, 8)}...\n`);

    // Buscar TODAS as compras em ordem cronológica
    console.log('📊 TODAS AS COMPRAS (ordem cronológica):');
    const { data: allPurchases, error: purchasesError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (purchasesError) {
      console.error('❌ Erro ao buscar compras:', purchasesError.message);
      return;
    }

    console.log(`📦 Total de registros: ${allPurchases.length}\n`);

    // Mostrar cada compra com timestamp detalhado
    allPurchases.forEach((purchase, index) => {
      const timestamp = new Date(purchase.created_at);
      console.log(`${index + 1}. 🎯 ${purchase.booster}: ${purchase.amount} unidades`);
      console.log(`   ⏰ ${timestamp.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      })}`);
      console.log(`   🔗 Source: ${purchase.source || 'N/A'}`);
      console.log(`   🆔 ID: ${purchase.id}`);
      console.log('');
    });

    // Agrupar por timestamp para detectar compras simultâneas
    console.log('🔍 ANÁLISE DE COMPRAS SIMULTÂNEAS:');
    console.log('═'.repeat(60));
    
    const timestampGroups = {};
    allPurchases.forEach(purchase => {
      const timestamp = new Date(purchase.created_at).getTime();
      const roundedTimestamp = Math.floor(timestamp / 1000) * 1000; // Arredondar para segundos
      
      if (!timestampGroups[roundedTimestamp]) {
        timestampGroups[roundedTimestamp] = [];
      }
      timestampGroups[roundedTimestamp].push(purchase);
    });

    Object.entries(timestampGroups).forEach(([timestamp, purchases]) => {
      const date = new Date(parseInt(timestamp));
      console.log(`⏰ ${date.toLocaleTimeString('pt-BR')} (${purchases.length} registros):`);
      
      if (purchases.length > 1) {
        console.log('🚨 COMPRAS SIMULTÂNEAS DETECTADAS!');
        purchases.forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.booster}: ${p.amount} | Source: ${p.source}`);
        });
      } else {
        const p = purchases[0];
        console.log(`  ✅ ${p.booster}: ${p.amount} | Source: ${p.source}`);
      }
      console.log('');
    });

    // Calcular inventário final
    console.log('📊 INVENTÁRIO FINAL (calculado):');
    console.log('═'.repeat(60));
    
    const finalInventory = {};
    allPurchases.forEach(purchase => {
      const key = purchase.booster;
      finalInventory[key] = (finalInventory[key] || 0) + purchase.amount;
    });

    Object.entries(finalInventory).forEach(([booster, amount]) => {
      console.log(`🎯 ${booster}: ${amount} unidades`);
    });

    // Comparar com o que deveria ser
    console.log('\n🎯 O QUE DEVERIA SER (baseado no relato):');
    console.log('═'.repeat(60));
    console.log('🎯 o_esquecido: 1 unidade (comprou 1)');
    console.log('🎯 o_escudo: 3 unidades (comprou 3)');
    console.log('🎯 segunda_chance: 1 unidade (comprou 1)');
    console.log('🎯 palpite_automatico: 1 unidade (comprou 1)');
    console.log('📊 TOTAL ESPERADO: 6 registros');

    // Identificar discrepâncias
    console.log('\n🔥 DISCREPÂNCIAS IDENTIFICADAS:');
    console.log('═'.repeat(60));
    
    const expected = {
      'o_esquecido': 1,
      'o_escudo': 3,
      'segunda_chance': 1,
      'palpite_automatico': 1
    };

    let hasDiscrepancy = false;
    Object.entries(expected).forEach(([booster, expectedAmount]) => {
      const actualAmount = finalInventory[booster] || 0;
      if (actualAmount !== expectedAmount) {
        console.log(`❌ ${booster}: Esperado ${expectedAmount}, Atual ${actualAmount} (diferença: ${actualAmount - expectedAmount})`);
        hasDiscrepancy = true;
      } else {
        console.log(`✅ ${booster}: Correto (${actualAmount})`);
      }
    });

    // Verificar registros extras
    Object.entries(finalInventory).forEach(([booster, amount]) => {
      if (!expected[booster]) {
        console.log(`❓ ${booster}: ${amount} unidades (não esperado)`);
        hasDiscrepancy = true;
      }
    });

    if (!hasDiscrepancy) {
      console.log('✅ Nenhuma discrepância encontrada');
    }

    // Análise de padrões
    console.log('\n🔍 ANÁLISE DE PADRÕES:');
    console.log('═'.repeat(60));
    
    // Verificar se há padrão nos sources
    const sourceCount = {};
    allPurchases.forEach(p => {
      const source = p.source || 'N/A';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    console.log('📊 Distribuição por Source:');
    Object.entries(sourceCount).forEach(([source, count]) => {
      console.log(`  🔗 ${source}: ${count} registros`);
    });

    // Verificar intervalos entre compras
    console.log('\n⏰ Intervalos entre compras:');
    for (let i = 1; i < allPurchases.length; i++) {
      const prev = new Date(allPurchases[i-1].created_at);
      const curr = new Date(allPurchases[i].created_at);
      const diff = curr.getTime() - prev.getTime();
      
      console.log(`  ${i}. ${Math.round(diff/1000)}s entre ${allPurchases[i-1].booster} e ${allPurchases[i].booster}`);
    }

    // Conclusões e próximos passos
    console.log('\n🎯 CONCLUSÕES:');
    console.log('═'.repeat(60));
    console.log('1. 🔥 HÁ DUPLICAÇÃO CONFIRMADA no banco de dados');
    console.log('2. 📊 O problema NÃO é visual - está no backend');
    console.log('3. 🔗 Pode estar relacionado ao webhook do Stripe');
    console.log('4. ⚡ Pode haver race conditions ou múltiplas chamadas');
    console.log('5. 🎯 Precisa investigar o código de compra');

    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. 🔍 Analisar o código do webhook do Stripe');
    console.log('2. 🔍 Verificar o código de compra no frontend');
    console.log('3. 🛠️ Implementar idempotência nas compras');
    console.log('4. 🧹 Limpar os dados duplicados');

  } catch (error) {
    console.error('❌ Erro na análise:', error.message);
    console.error(error);
  }
}

analyzeChaos();