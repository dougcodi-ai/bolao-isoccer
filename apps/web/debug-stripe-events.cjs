const { createClient } = require('@supabase/supabase-js');

async function debugStripeEvents() {
  try {
    // Usar as credenciais do .env.local
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Credenciais do Supabase não encontradas no .env.local');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Analisando eventos Stripe e compras duplicadas...\n');

    // 1. Buscar todas as compras recentes para encontrar o usuário com duplicatas
    const { data: allPurchases, error: allPurchasesError } = await supabase
      .from('booster_purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (allPurchasesError) {
      console.log('❌ Erro ao buscar compras:', allPurchasesError.message);
      return;
    }

    if (!allPurchases || allPurchases.length === 0) {
      console.log('❌ Nenhuma compra encontrada');
      return;
    }

    console.log(`📊 Total de compras recentes: ${allPurchases.length}\n`);

    // 2. Agrupar por usuário e identificar quem tem mais compras
    const userPurchases = {};
    allPurchases.forEach(purchase => {
      if (!userPurchases[purchase.user_id]) {
        userPurchases[purchase.user_id] = [];
      }
      userPurchases[purchase.user_id].push(purchase);
    });

    // 3. Encontrar o usuário com mais compras (provavelmente o que tem duplicatas)
    const userIds = Object.keys(userPurchases);
    const userWithMostPurchases = userIds.reduce((maxUser, currentUser) => {
      return userPurchases[currentUser].length > userPurchases[maxUser].length ? currentUser : maxUser;
    });

    const targetUserId = userWithMostPurchases;
    const purchases = userPurchases[targetUserId];

    console.log(`🎯 Usuário com mais compras: ${targetUserId}`);
    console.log(`📊 Total de compras: ${purchases.length}\n`);

    // 4. Agrupar compras por timestamp para identificar duplicatas
    const groupedByTime = {};
    purchases.forEach(purchase => {
      const timestamp = new Date(purchase.created_at).getTime();
      const timeKey = Math.floor(timestamp / 1000); // Agrupar por segundo
      
      if (!groupedByTime[timeKey]) {
        groupedByTime[timeKey] = [];
      }
      groupedByTime[timeKey].push(purchase);
    });

    // 5. Identificar grupos com duplicatas
    const duplicateGroups = Object.keys(groupedByTime).filter(timeKey => 
      groupedByTime[timeKey].length > 1
    );

    if (duplicateGroups.length === 0) {
      console.log('✅ Nenhuma duplicata encontrada por timestamp');
    } else {
      console.log(`⚠️  ${duplicateGroups.length} grupos de duplicatas encontrados:\n`);
      
      duplicateGroups.forEach(timeKey => {
        const group = groupedByTime[timeKey];
        const timestamp = new Date(parseInt(timeKey) * 1000).toISOString();
        
        console.log(`🕐 Timestamp: ${timestamp}`);
        console.log(`   Duplicatas: ${group.length}`);
        group.forEach((purchase, index) => {
          console.log(`   ${index + 1}. ID: ${purchase.id}, Booster: ${purchase.booster}, Amount: ${purchase.amount}, Created: ${purchase.created_at}`);
        });
        console.log('');
      });
    }

    // 6. Buscar registros de pagamentos relacionados
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: true });

    if (paymentsError) {
      console.log('❌ Erro ao buscar pagamentos:', paymentsError.message);
    } else {
      console.log(`💳 Total de registros de pagamento: ${payments?.length || 0}\n`);
      
      if (payments && payments.length > 0) {
        console.log('📝 Registros de pagamento:');
        payments.forEach((payment, index) => {
          console.log(`  ${index + 1}. Session ID: ${payment.stripe_session_id}, Status: ${payment.status}, Amount: ${payment.amount_cents}, Created: ${payment.created_at}`);
        });
        console.log('');
      }
    }

    // 7. Verificar se há registros de idempotência relacionados aos pagamentos
    if (payments && payments.length > 0) {
      console.log('🔍 Verificando registros de idempotência para as sessões de pagamento:\n');
      
      for (const payment of payments) {
        // Buscar por qualquer chave que contenha o session ID
        const { data: idempotencyRecords, error: idempotencyError } = await supabase
          .from('idempotency_log')
          .select('*')
          .eq('user_id', targetUserId)
          .ilike('key', `%${payment.stripe_session_id}%`);

        if (idempotencyError) {
          console.log(`❌ Erro ao buscar idempotência para ${payment.stripe_session_id}:`, idempotencyError.message);
        } else {
          console.log(`🔑 Session ${payment.stripe_session_id}:`);
          console.log(`   Registros de idempotência: ${idempotencyRecords?.length || 0}`);
          if (idempotencyRecords && idempotencyRecords.length > 0) {
            idempotencyRecords.forEach((record, index) => {
              console.log(`   ${index + 1}. Key: ${record.key}, Created: ${record.created_at}`);
            });
          }
          console.log('');
        }
      }
    }

    // 8. Verificar todos os registros de idempotência para este usuário
    const { data: allIdempotencyRecords, error: allIdempotencyError } = await supabase
      .from('idempotency_log')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (allIdempotencyError) {
      console.log('❌ Erro ao buscar todos os registros de idempotência:', allIdempotencyError.message);
    } else {
      console.log(`🔍 Total de registros de idempotência para o usuário: ${allIdempotencyRecords?.length || 0}\n`);
      
      if (allIdempotencyRecords && allIdempotencyRecords.length > 0) {
        console.log('📝 Todos os registros de idempotência:');
        allIdempotencyRecords.forEach((record, index) => {
          console.log(`  ${index + 1}. Key: ${record.key}, Created: ${record.created_at}`);
        });
      }
    }

  } catch (error) {
    console.log('❌ Erro geral:', error.message);
  }
}

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

debugStripeEvents();