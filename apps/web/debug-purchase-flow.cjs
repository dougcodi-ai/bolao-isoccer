const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente do .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function debugPurchaseFlow() {
  console.log('🔍 Debugando fluxo de compra de boosters...\n');

  try {
    const userId = 'd29be22d-061a-4ab9-bdf9-c3588bc3e012';
    
    console.log('1. 📊 Estado atual do inventário:');
    console.log('================================');
    
    // Buscar compras
    const { data: purchases, error: purchasesError } = await supabase
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('❌ Erro ao buscar compras:', purchasesError.message);
      return;
    }

    console.log(`📦 Total de compras: ${purchases.length}`);
    
    // Agrupar por booster
    const purchasesByBooster = {};
    purchases.forEach(purchase => {
      const booster = purchase.booster;
      if (!purchasesByBooster[booster]) {
        purchasesByBooster[booster] = [];
      }
      purchasesByBooster[booster].push(purchase);
    });

    for (const [booster, boosterPurchases] of Object.entries(purchasesByBooster)) {
      const totalAmount = boosterPurchases.reduce((sum, p) => sum + (p.amount || 1), 0);
      console.log(`  🎯 ${booster}: ${totalAmount} unidades (${boosterPurchases.length} compras)`);
      
      // Mostrar detalhes das compras mais recentes
      const recent = boosterPurchases.slice(0, 3);
      recent.forEach(p => {
        console.log(`    - ${p.created_at}: ${p.amount || 1} unidades (ID: ${p.id})`);
      });
    }

    // Buscar usos
    const { data: usages, error: usagesError } = await supabase
      .from('booster_usages')
      .select('*')
      .eq('user_id', userId)
      .order('used_at', { ascending: false });

    if (usagesError) {
      console.error('❌ Erro ao buscar usos:', usagesError.message);
    } else {
      console.log(`\n🎮 Total de usos: ${usages.length}`);
      
      const usagesByBooster = {};
      usages.forEach(usage => {
        const booster = usage.booster;
        if (!usagesByBooster[booster]) {
          usagesByBooster[booster] = [];
        }
        usagesByBooster[booster].push(usage);
      });

      for (const [booster, boosterUsages] of Object.entries(usagesByBooster)) {
        const consumedCount = boosterUsages.filter(u => u.status === 'consumed' || u.status === 'pending').length;
        console.log(`  🎯 ${booster}: ${consumedCount} consumidos/pendentes de ${boosterUsages.length} total`);
      }
    }

    // Calcular inventário esperado
    console.log('\n2. 🧮 Cálculo do inventário:');
    console.log('============================');
    
    const inventory = {};
    
    // Adicionar compras
    for (const [booster, boosterPurchases] of Object.entries(purchasesByBooster)) {
      const totalAmount = boosterPurchases.reduce((sum, p) => sum + (p.amount || 1), 0);
      inventory[booster] = totalAmount;
    }
    
    // Subtrair usos
    if (usages && usages.length > 0) {
      const usagesByBooster = {};
      usages.forEach(usage => {
        const booster = usage.booster;
        if (!usagesByBooster[booster]) {
          usagesByBooster[booster] = [];
        }
        usagesByBooster[booster].push(usage);
      });

      for (const [booster, boosterUsages] of Object.entries(usagesByBooster)) {
        const consumedCount = boosterUsages.filter(u => u.status === 'consumed' || u.status === 'pending').length;
        inventory[booster] = Math.max(0, (inventory[booster] || 0) - consumedCount);
      }
    }

    console.log('📊 Inventário calculado:');
    for (const [booster, amount] of Object.entries(inventory)) {
      console.log(`  🎯 ${booster}: ${amount} disponíveis`);
    }

    // Verificar compras recentes
    console.log('\n3. 🕐 Compras recentes (últimas 2 horas):');
    console.log('=========================================');
    
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const recentPurchases = purchases.filter(p => p.created_at > twoHoursAgo);
    
    if (recentPurchases.length === 0) {
      console.log('📭 Nenhuma compra recente encontrada');
    } else {
      console.log(`📦 ${recentPurchases.length} compras recentes:`);
      recentPurchases.forEach(p => {
        console.log(`  - ${p.created_at}: ${p.booster} x${p.amount || 1} (ID: ${p.id})`);
      });
    }

    // Verificar pagamentos relacionados
    console.log('\n4. 💳 Verificando pagamentos:');
    console.log('=============================');
    
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (paymentsError) {
      console.error('❌ Erro ao buscar pagamentos:', paymentsError.message);
    } else {
      console.log(`💰 ${payments.length} pagamentos encontrados (últimos 10):`);
      payments.forEach(p => {
        console.log(`  - ${p.created_at}: ${p.status} - ${p.amount_cents ? (p.amount_cents/100).toFixed(2) : 'N/A'} BRL`);
        console.log(`    Session: ${p.stripe_session_id || 'N/A'}`);
      });
    }

    // Verificar logs de idempotência
    console.log('\n5. 🔒 Verificando logs de idempotência:');
    console.log('======================================');
    
    const { data: idempotencyLogs, error: idempotencyError } = await supabase
      .from('idempotency_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (idempotencyError) {
      console.error('❌ Erro ao buscar logs de idempotência:', idempotencyError.message);
    } else {
      console.log(`🔐 ${idempotencyLogs.length} logs de idempotência encontrados:`);
      idempotencyLogs.forEach(log => {
        console.log(`  - ${log.created_at}: ${log.key}`);
      });
    }

    // Verificar notificações
    console.log('\n6. 🔔 Verificando notificações:');
    console.log('===============================');
    
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'booster_purchase')
      .order('created_at', { ascending: false })
      .limit(10);

    if (notificationsError) {
      console.error('❌ Erro ao buscar notificações:', notificationsError.message);
    } else {
      console.log(`🔔 ${notifications.length} notificações de compra encontradas:`);
      notifications.forEach(n => {
        const meta = n.meta || {};
        console.log(`  - ${n.created_at}: ${n.title} - ${meta.booster} x${meta.qty || 1}`);
      });
    }

    console.log('\n📋 RESUMO DO DEBUG:');
    console.log('===================');
    console.log(`✅ Compras totais: ${purchases.length}`);
    console.log(`✅ Usos totais: ${usages ? usages.length : 0}`);
    console.log(`✅ Compras recentes: ${recentPurchases.length}`);
    console.log(`✅ Pagamentos: ${payments ? payments.length : 0}`);
    console.log(`✅ Logs de idempotência: ${idempotencyLogs ? idempotencyLogs.length : 0}`);
    console.log(`✅ Notificações: ${notifications ? notifications.length : 0}`);
    
    console.log('\n🎯 INVENTÁRIO FINAL CALCULADO:');
    for (const [booster, amount] of Object.entries(inventory)) {
      console.log(`   ${booster}: ${amount} disponíveis`);
    }

  } catch (error) {
    console.error('❌ Erro durante debug:', error.message);
  }
}

debugPurchaseFlow();