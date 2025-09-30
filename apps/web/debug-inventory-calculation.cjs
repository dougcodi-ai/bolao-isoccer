require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function debugInventoryCalculation() {
  try {
    console.log('🔍 DEBUG: Cálculo do inventário de boosters\n');

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

    // 2. Buscar todas as compras
    console.log('💰 Verificando todas as compras...');
    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (purchasesError) {
      console.error('❌ Erro ao buscar compras:', purchasesError.message);
      return;
    }

    console.log(`📊 Total de registros de compras: ${purchases.length}`);
    
    const purchaseTotals = {};
    purchases.forEach((purchase, index) => {
      console.log(`  ${index + 1}. ${purchase.booster}: ${purchase.amount} unidades | ${new Date(purchase.created_at).toLocaleString('pt-BR')} | Source: ${purchase.source || 'N/A'}`);
      purchaseTotals[purchase.booster] = (purchaseTotals[purchase.booster] || 0) + purchase.amount;
    });

    console.log('\n📦 Totais por booster (compras):');
    Object.entries(purchaseTotals).forEach(([booster, total]) => {
      console.log(`  🎯 ${booster}: ${total} unidades`);
    });

    // 3. Verificar estrutura da tabela booster_usages
    console.log('\n🔍 Verificando estrutura da tabela booster_usages...');
    const { data: usagesStructure, error: structureError } = await supabaseAdmin
      .from('booster_usages')
      .select('*')
      .limit(1);

    if (structureError) {
      console.log('❌ Erro ao acessar booster_usages:', structureError.message);
      console.log('💡 Tabela pode não existir ou ter estrutura diferente');
    } else {
      console.log('✅ Tabela booster_usages acessível');
      if (usagesStructure && usagesStructure.length > 0) {
        console.log('📋 Colunas disponíveis:', Object.keys(usagesStructure[0]));
      }
    }

    // 3. Buscar todos os usos
    console.log('\n🎮 Verificando todos os usos...');
    let usages = [];
    let usagesError = null;
    
    try {
      const { data, error } = await supabaseAdmin
        .from('booster_usages')
        .select('*')
        .eq('user_id', userId);
      
      usages = data || [];
      usagesError = error;
    } catch (err) {
      usagesError = err;
    }

    if (usagesError) {
      console.error('❌ Erro ao buscar usos:', usagesError.message);
      return;
    }

    console.log(`📊 Total de registros de usos: ${usages.length}`);
    
    const usageTotals = {};
    if (usages.length > 0) {
      usages.forEach((usage, index) => {
        console.log(`  ${index + 1}. ${usage.booster}: Status ${usage.status} | ${new Date(usage.created_at).toLocaleString('pt-BR')} | Pool: ${usage.pool_id || 'N/A'}`);
        
        // Contar apenas usos que reduzem o inventário
        if (usage.status === 'consumed' || usage.status === 'pending') {
          usageTotals[usage.booster] = (usageTotals[usage.booster] || 0) + 1;
        }
      });

      console.log('\n📉 Totais por booster (usos que reduzem):');
      Object.entries(usageTotals).forEach(([booster, total]) => {
        console.log(`  🎯 ${booster}: ${total} usos`);
      });
    } else {
      console.log('  📭 Nenhum uso encontrado');
    }

    // 4. Calcular inventário final (como o hook faz)
    console.log('\n🧮 CÁLCULO DO INVENTÁRIO (como o hook faz):');
    console.log('═'.repeat(60));
    
    const finalInventory = {};
    
    // Adicionar compras
    for (const purchase of purchases) {
      const key = String(purchase.booster);
      finalInventory[key] = (finalInventory[key] || 0) + (Number(purchase.amount) || 0);
    }
    
    console.log('📈 Após adicionar compras:', finalInventory);
    
    // Subtrair usos
    for (const usage of usages) {
      const key = String(usage.booster);
      const status = String(usage.status || "consumed");
      if (status === "consumed" || status === "pending") {
        finalInventory[key] = Math.max(0, (finalInventory[key] || 0) - 1);
      }
    }
    
    console.log('📉 Após subtrair usos:', finalInventory);

    // 5. Comparar com o que o hook real retorna
    console.log('\n🔄 Testando hook real...');
    
    // Simular exatamente o que o hook faz
    const [{ data: hookPurchases, error: errP }, { data: hookUsages, error: errU }] = await Promise.all([
      supabase.from("booster_purchases").select("booster, amount").eq("user_id", userId),
      supabase.from("booster_usages").select("booster, status").eq("user_id", userId),
    ]);
    
    if (errP || errU) {
      console.error('❌ Erro no hook:', errP?.message || errU?.message);
      return;
    }
    
    const hookInventory = {};
    for (const row of (hookPurchases || [])) {
      const key = String(row.booster);
      hookInventory[key] = (hookInventory[key] || 0) + (Number(row.amount) || 0);
    }
    
    for (const u of (hookUsages || [])) {
      const key = String(u.booster);
      const status = String(u.status || "consumed");
      if (status === "consumed" || status === "pending") {
        hookInventory[key] = Math.max(0, (hookInventory[key] || 0) - 1);
      }
    }
    
    console.log('🎣 Hook real retorna:', hookInventory);

    // 6. Análise de discrepâncias
    console.log('\n🔍 ANÁLISE DE DISCREPÂNCIAS:');
    console.log('═'.repeat(60));
    
    const allBoosters = new Set([
      ...Object.keys(purchaseTotals),
      ...Object.keys(usageTotals),
      ...Object.keys(finalInventory),
      ...Object.keys(hookInventory)
    ]);
    
    let hasDiscrepancy = false;
    
    for (const booster of allBoosters) {
      const purchased = purchaseTotals[booster] || 0;
      const used = usageTotals[booster] || 0;
      const calculated = finalInventory[booster] || 0;
      const hookResult = hookInventory[booster] || 0;
      const expected = Math.max(0, purchased - used);
      
      console.log(`\n🎯 ${booster.toUpperCase()}:`);
      console.log(`  📈 Comprado: ${purchased}`);
      console.log(`  📉 Usado: ${used}`);
      console.log(`  🧮 Esperado: ${expected}`);
      console.log(`  📊 Calculado: ${calculated}`);
      console.log(`  🎣 Hook: ${hookResult}`);
      
      if (calculated !== expected) {
        console.log(`  ❌ ERRO: Cálculo incorreto (${calculated} ≠ ${expected})`);
        hasDiscrepancy = true;
      } else if (hookResult !== expected) {
        console.log(`  ❌ ERRO: Hook incorreto (${hookResult} ≠ ${expected})`);
        hasDiscrepancy = true;
      } else {
        console.log(`  ✅ CORRETO`);
      }
    }

    // 7. Verificar se há registros duplicados ou problemáticos
    console.log('\n🔍 VERIFICAÇÃO DE PROBLEMAS:');
    console.log('═'.repeat(60));
    
    // Verificar compras duplicadas
    const purchaseGroups = {};
    purchases.forEach(p => {
      const key = `${p.booster}_${p.amount}_${p.created_at}`;
      purchaseGroups[key] = (purchaseGroups[key] || 0) + 1;
    });
    
    const duplicatePurchases = Object.entries(purchaseGroups).filter(([_, count]) => count > 1);
    if (duplicatePurchases.length > 0) {
      console.log('❌ COMPRAS DUPLICADAS ENCONTRADAS:');
      duplicatePurchases.forEach(([key, count]) => {
        console.log(`  🔄 ${key}: ${count} registros`);
      });
    } else {
      console.log('✅ Nenhuma compra duplicada encontrada');
    }
    
    // Verificar usos órfãos (sem compra correspondente)
    const orphanUsages = usages.filter(u => !purchaseTotals[u.booster]);
    if (orphanUsages.length > 0) {
      console.log('❌ USOS ÓRFÃOS ENCONTRADOS (sem compra correspondente):');
      orphanUsages.forEach(u => {
        console.log(`  👻 ${u.booster}: ${u.status} | ${new Date(u.created_at).toLocaleString('pt-BR')}`);
      });
    } else {
      console.log('✅ Nenhum uso órfão encontrado');
    }

    // 8. Conclusões
    console.log('\n🎯 CONCLUSÕES:');
    console.log('═'.repeat(60));
    
    if (!hasDiscrepancy) {
      console.log('✅ CÁLCULO CORRETO: O hook está funcionando perfeitamente');
      console.log('💡 O problema da duplicação pode estar no frontend/interface');
      console.log('🔍 Verifique se há múltiplas chamadas do hook ou cache incorreto');
    } else {
      console.log('❌ PROBLEMA NO CÁLCULO: Há discrepâncias no inventário');
      console.log('💡 Verifique os registros de compras e usos');
      console.log('🔧 Pode haver dados inconsistentes no banco');
    }

    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Verificar a interface da carteira para ver se mostra os valores corretos');
    console.log('2. Fazer uma compra real na interface e verificar se duplica');
    console.log('3. Verificar se o realtime está funcionando na aplicação real');

  } catch (error) {
    console.error('❌ Erro no debug:', error.message);
    console.error(error);
  }
}

debugInventoryCalculation();