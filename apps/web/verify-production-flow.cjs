require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function verifyProductionFlow() {
  try {
    console.log('🔍 VERIFICAÇÃO DO FLUXO DE PRODUÇÃO\n');
    console.log('═'.repeat(60));

    // 1. Verificar compras recentes (últimas 24 horas)
    console.log('📊 Verificando compras recentes...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: recentPurchases, error: purchasesError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    if (purchasesError) {
      console.error('❌ Erro ao verificar compras:', purchasesError.message);
      return;
    }

    console.log(`📦 Total de compras nas últimas 24h: ${recentPurchases.length}`);

    if (recentPurchases.length > 0) {
      console.log('\n🔍 Detalhes das compras recentes:');
      recentPurchases.forEach((purchase, index) => {
        console.log(`  ${index + 1}. ${purchase.booster} x${purchase.amount} | Source: ${purchase.source || 'N/A'} | ${new Date(purchase.created_at).toLocaleString('pt-BR')}`);
      });
    }

    // 2. Verificar pagamentos correspondentes
    console.log('\n💳 Verificando pagamentos correspondentes...');
    const { data: recentPayments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('❌ Erro ao verificar pagamentos:', paymentsError.message);
      return;
    }

    console.log(`💰 Total de pagamentos nas últimas 24h: ${recentPayments.length}`);

    if (recentPayments.length > 0) {
      console.log('\n🔍 Detalhes dos pagamentos recentes:');
      recentPayments.forEach((payment, index) => {
        console.log(`  ${index + 1}. ${payment.amount_cents/100} BRL | Status: ${payment.status} | ${new Date(payment.created_at).toLocaleString('pt-BR')}`);
      });
    }

    // 3. Verificar logs de idempotência
    console.log('\n🔒 Verificando logs de idempotência...');
    let idempotencyLogs = [];
    const { data: idempotencyData, error: idempotencyError } = await supabaseAdmin
      .from('idempotency_logs')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    if (idempotencyError) {
      if (idempotencyError.message.includes('Could not find the table')) {
        console.log('⚠️  Tabela idempotency_logs não existe - isso é um problema!');
      } else {
        console.error('❌ Erro ao verificar logs de idempotência:', idempotencyError.message);
        return;
      }
    } else {
      idempotencyLogs = idempotencyData || [];
      console.log(`🔐 Total de logs de idempotência nas últimas 24h: ${idempotencyLogs.length}`);

      if (idempotencyLogs.length > 0) {
        console.log('\n🔍 Detalhes dos logs de idempotência:');
        idempotencyLogs.forEach((log, index) => {
          console.log(`  ${index + 1}. Key: ${log.idempotency_key} | Action: ${log.action} | ${new Date(log.created_at).toLocaleString('pt-BR')}`);
        });
      }
    }

    // 4. Análise do fluxo
    console.log('\n📈 ANÁLISE DO FLUXO:');
    console.log('═'.repeat(40));

    const purchasesFromWebhook = recentPurchases.filter(p => p.source === 'stripe_webhook').length;
    const purchasesFromTest = recentPurchases.filter(p => p.source === 'test' || !p.source).length;

    console.log(`✅ Compras via webhook do Stripe: ${purchasesFromWebhook}`);
    console.log(`⚠️  Compras diretas/teste: ${purchasesFromTest}`);

    // 5. Verificar correlação entre compras e pagamentos
    if (recentPurchases.length > 0 && recentPayments.length === 0) {
      console.log('\n❌ PROBLEMA DETECTADO:');
      console.log('   - Há compras registradas mas nenhum pagamento');
      console.log('   - Isso indica que as compras estão sendo feitas diretamente no banco');
      console.log('   - Possível causa: Scripts de teste ou bypass do Stripe');
    } else if (recentPurchases.length === 0 && recentPayments.length > 0) {
      console.log('\n❌ PROBLEMA DETECTADO:');
      console.log('   - Há pagamentos mas nenhuma compra registrada');
      console.log('   - Isso indica problema no webhook do Stripe');
    } else if (recentPurchases.length > 0 && recentPayments.length > 0) {
      console.log('\n✅ FLUXO APARENTEMENTE NORMAL:');
      console.log('   - Há tanto compras quanto pagamentos registrados');
      console.log('   - Verificar se as quantidades fazem sentido');
    } else {
      console.log('\n ℹ️  NENHUMA ATIVIDADE RECENTE:');
      console.log('   - Não há compras nem pagamentos nas últimas 24h');
      console.log('   - Isso é normal se não houve atividade de usuários');
    }

    // 6. Verificar scripts de teste suspeitos
    console.log('\n🧪 VERIFICANDO SCRIPTS DE TESTE:');
    console.log('═'.repeat(40));

    const testScriptsWithDirectInserts = [
      'test-real-purchase.cjs',
      'test-valid-purchases.cjs',
      'complete-inventory-reset.cjs',
      'admin-clean-boosters.cjs'
    ];

    console.log('⚠️  Scripts que fazem inserções diretas detectados:');
    testScriptsWithDirectInserts.forEach(script => {
      console.log(`   - ${script}`);
    });

    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('═'.repeat(40));
    
    if (purchasesFromTest > 0) {
      console.log('1. ❌ Remover ou desabilitar scripts de teste em produção');
      console.log('2. 🔒 Garantir que apenas o webhook do Stripe pode inserir compras');
      console.log('3. 🧪 Usar ambiente de teste separado para scripts de desenvolvimento');
    }
    
    if (recentPurchases.length > 0 && idempotencyLogs.length === 0) {
      console.log('4. 🔐 Implementar logs de idempotência para todas as compras');
      console.log('5. 🔍 Verificar se o webhook está registrando corretamente');
    }

    console.log('6. 📊 Monitorar regularmente a correlação compras/pagamentos');
    console.log('7. 🚨 Configurar alertas para compras sem pagamentos correspondentes');

  } catch (error) {
    console.error('❌ Erro na verificação:', error.message);
    console.error(error);
  }
}

verifyProductionFlow();