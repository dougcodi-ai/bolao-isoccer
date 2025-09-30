const { createClient } = require('@supabase/supabase-js');

async function detailedDuplicateAnalysis() {
  try {
    // Usar as credenciais do .env.local
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Credenciais do Supabase não encontradas no .env.local');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Análise detalhada de duplicatas...\n');

    // 1. Buscar todas as compras recentes
    const { data: allPurchases, error: allPurchasesError } = await supabase
      .from('booster_purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (allPurchasesError) {
      console.log('❌ Erro ao buscar compras:', allPurchasesError.message);
      return;
    }

    if (!allPurchases || allPurchases.length === 0) {
      console.log('❌ Nenhuma compra encontrada');
      return;
    }

    console.log(`📊 Total de compras analisadas: ${allPurchases.length}\n`);

    // 2. Agrupar por usuário
    const userPurchases = {};
    allPurchases.forEach(purchase => {
      if (!userPurchases[purchase.user_id]) {
        userPurchases[purchase.user_id] = [];
      }
      userPurchases[purchase.user_id].push(purchase);
    });

    console.log(`👥 Total de usuários únicos: ${Object.keys(userPurchases).length}\n`);

    // 3. Analisar cada usuário para duplicatas
    for (const [userId, purchases] of Object.entries(userPurchases)) {
      console.log(`👤 Usuário: ${userId}`);
      console.log(`   Total de compras: ${purchases.length}`);
      
      // Agrupar por booster para detectar duplicatas
      const boosterGroups = {};
      purchases.forEach(purchase => {
        if (!boosterGroups[purchase.booster]) {
          boosterGroups[purchase.booster] = [];
        }
        boosterGroups[purchase.booster].push(purchase);
      });

      // Verificar se há duplicatas por booster
      const duplicatedBoosters = Object.keys(boosterGroups).filter(booster => 
        boosterGroups[booster].length > 1
      );

      if (duplicatedBoosters.length > 0) {
        console.log(`   ⚠️  DUPLICATAS ENCONTRADAS:`);
        duplicatedBoosters.forEach(booster => {
          const group = boosterGroups[booster];
          console.log(`     🎯 ${booster}: ${group.length} compras`);
          group.forEach((purchase, index) => {
            console.log(`       ${index + 1}. ID: ${purchase.id}, Amount: ${purchase.amount}, Created: ${purchase.created_at}, Source: ${purchase.source || 'N/A'}`);
          });
          
          // Calcular intervalos entre compras duplicadas
          if (group.length > 1) {
            for (let i = 1; i < group.length; i++) {
              const prev = new Date(group[i-1].created_at);
              const curr = new Date(group[i].created_at);
              const diffMs = Math.abs(curr - prev);
              const diffSeconds = Math.round(diffMs / 1000);
              console.log(`       ⏱️  Intervalo entre compra ${i} e ${i+1}: ${diffSeconds} segundos`);
            }
          }
        });
      } else {
        console.log(`   ✅ Nenhuma duplicata encontrada`);
      }

      // Mostrar distribuição por source
      const sourceDistribution = {};
      purchases.forEach(purchase => {
        const source = purchase.source || 'N/A';
        sourceDistribution[source] = (sourceDistribution[source] || 0) + 1;
      });
      
      console.log(`   📊 Distribuição por Source:`, sourceDistribution);
      console.log('');
    }

    // 4. Análise geral de duplicatas
    console.log('📈 RESUMO GERAL:\n');
    
    let totalDuplicates = 0;
    let usersWithDuplicates = 0;
    
    for (const [userId, purchases] of Object.entries(userPurchases)) {
      const boosterGroups = {};
      purchases.forEach(purchase => {
        if (!boosterGroups[purchase.booster]) {
          boosterGroups[purchase.booster] = [];
        }
        boosterGroups[purchase.booster].push(purchase);
      });

      const duplicatedBoosters = Object.keys(boosterGroups).filter(booster => 
        boosterGroups[booster].length > 1
      );

      if (duplicatedBoosters.length > 0) {
        usersWithDuplicates++;
        duplicatedBoosters.forEach(booster => {
          totalDuplicates += boosterGroups[booster].length - 1; // -1 porque a primeira não é duplicata
        });
      }
    }

    console.log(`👥 Usuários com duplicatas: ${usersWithDuplicates}`);
    console.log(`🔄 Total de compras duplicadas: ${totalDuplicates}`);
    console.log(`📊 Taxa de duplicação: ${((totalDuplicates / allPurchases.length) * 100).toFixed(2)}%`);

    // 5. Verificar se há registros na tabela payments para usuários com duplicatas
    if (usersWithDuplicates > 0) {
      console.log('\n💳 Verificando registros de pagamentos para usuários com duplicatas:\n');
      
      for (const [userId, purchases] of Object.entries(userPurchases)) {
        const boosterGroups = {};
        purchases.forEach(purchase => {
          if (!boosterGroups[purchase.booster]) {
            boosterGroups[purchase.booster] = [];
          }
          boosterGroups[purchase.booster].push(purchase);
        });

        const hasDuplicates = Object.keys(boosterGroups).some(booster => 
          boosterGroups[booster].length > 1
        );

        if (hasDuplicates) {
          const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          console.log(`👤 Usuário ${userId}:`);
          if (paymentsError) {
            console.log(`   ❌ Erro ao buscar pagamentos: ${paymentsError.message}`);
          } else {
            console.log(`   💳 Registros de pagamento: ${payments?.length || 0}`);
            if (payments && payments.length > 0) {
              payments.forEach((payment, index) => {
                console.log(`     ${index + 1}. Session: ${payment.stripe_session_id}, Status: ${payment.status}, Amount: ${payment.amount_cents}`);
              });
            }
          }

          // Verificar idempotência
          const { data: idempotencyRecords, error: idempotencyError } = await supabase
            .from('idempotency_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (idempotencyError) {
            console.log(`   ❌ Erro ao buscar idempotência: ${idempotencyError.message}`);
          } else {
            console.log(`   🔑 Registros de idempotência: ${idempotencyRecords?.length || 0}`);
            if (idempotencyRecords && idempotencyRecords.length > 0) {
              idempotencyRecords.forEach((record, index) => {
                console.log(`     ${index + 1}. Key: ${record.key}, Created: ${record.created_at}`);
              });
            }
          }
          console.log('');
        }
      }
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

detailedDuplicateAnalysis();