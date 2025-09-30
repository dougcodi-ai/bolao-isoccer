require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function checkBoosterInventory() {
  try {
    console.log('🔍 Verificando inventário de boosters...\n');

    // 1. Buscar usuário de teste pelo ID (vamos usar um ID específico)
    const testUserId = '00000000-0000-0000-0000-000000000001'; // ID do usuário de teste
    
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', testUserId)
      .single();

    if (userError) {
      console.log('❌ Usuário de teste não encontrado na tabela profiles:', userError.message);
      console.log('ℹ️  Vamos verificar boosters diretamente pelo ID do usuário');
    } else {
      console.log('✅ Usuário encontrado:', user);
    }

    const userId = testUserId;
    console.log('🆔 User ID:', userId);

    // 2. Verificar boosters ativados
    console.log('\n🎯 Verificando boosters ativados...');
    const { data: activations, error: activationError } = await supabase
      .from('booster_activations')
      .select('*')
      .eq('user_id', userId)
      .order('activated_at', { ascending: false });

    if (activationError) {
      console.error('❌ Erro ao buscar ativações:', activationError.message);
    } else {
      console.log(`📊 Total de ativações: ${activations?.length || 0}`);
      if (activations && activations.length > 0) {
        activations.forEach((activation, index) => {
          console.log(`  ${index + 1}. ${activation.booster_key} - Status: ${activation.status} - Ativado em: ${activation.activated_at}`);
        });
      } else {
        console.log('  📭 Nenhuma ativação encontrada');
      }
    }

    // 3. Verificar compras de boosters
    console.log('\n💰 Verificando compras de boosters...');
    const { data: purchases, error: purchaseError } = await supabase
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (purchaseError) {
      console.error('❌ Erro ao buscar compras:', purchaseError.message);
    } else {
      console.log(`📊 Total de compras: ${purchases?.length || 0}`);
      if (purchases && purchases.length > 0) {
        purchases.forEach((purchase, index) => {
          console.log(`  ${index + 1}. ${purchase.booster_key} - Qty: ${purchase.qty} - Status: ${purchase.status} - Criado: ${purchase.created_at}`);
        });
      } else {
        console.log('  📭 Nenhuma compra encontrada');
      }
    }

    // 4. Verificar pagamentos
    console.log('\n💳 Verificando pagamentos...');
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (paymentError) {
      console.error('❌ Erro ao buscar pagamentos:', paymentError.message);
    } else {
      console.log(`📊 Total de pagamentos: ${payments?.length || 0}`);
      if (payments && payments.length > 0) {
        payments.forEach((payment, index) => {
          console.log(`  ${index + 1}. Stripe Session: ${payment.stripe_session_id} - Status: ${payment.status} - Valor: ${payment.amount_cents} centavos`);
        });
      } else {
        console.log('  📭 Nenhum pagamento encontrado');
      }
    }

    // 5. Verificar se há boosters disponíveis para ativação
    console.log('\n🎁 Verificando boosters disponíveis para ativação...');
    
    // Contar boosters comprados mas não ativados
    const boosterTypes = ['o_esquecido', 'segunda_chance', 'o_escudo', 'palpite_automatico'];
    
    for (const boosterKey of boosterTypes) {
        // Contar compras
        const { data: purchaseCount } = await supabase
          .from('booster_purchases')
          .select('amount')
          .eq('user_id', userId)
          .eq('booster', boosterKey);

        const totalPurchased = purchaseCount?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        // Contar ativações
        const { data: activationCount } = await supabase
          .from('booster_activations')
          .select('id')
          .eq('user_id', userId)
          .eq('booster_id', boosterKey);

        const totalActivated = activationCount?.length || 0;
        const available = totalPurchased - totalActivated;

        console.log(`  🎯 ${boosterKey}: ${available} disponível(is) (${totalPurchased} comprado(s) - ${totalActivated} ativado(s))`);
      }

  } catch (error) {
    console.error('💥 Erro durante a verificação:', error.message);
  }
}

checkBoosterInventory();