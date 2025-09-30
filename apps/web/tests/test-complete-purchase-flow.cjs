// Script para testar o fluxo completo de compra via Stripe
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const BASE_URL = 'http://localhost:3002';

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function getInventory(userId) {
  const { data: purchases, error } = await supabaseAdmin
    .from('booster_purchases')
    .select('booster, amount')
    .eq('user_id', userId);

  if (error) {
    console.error('❌ Erro ao buscar compras:', error.message);
    return {};
  }

  const inventory = {};
  purchases.forEach(purchase => {
    inventory[purchase.booster] = (inventory[purchase.booster] || 0) + purchase.amount;
  });

  return inventory;
}

async function testCompletePurchaseFlow() {
  console.log('🧪 TESTE: Fluxo completo de compra via Stripe\n');

  try {
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

    const session = authData.session;
    const userId = authData.user.id;
    console.log('✅ Login realizado com sucesso');
    console.log(`🆔 User ID: ${userId}\n`);

    // 2. Verificar inventário inicial
    console.log('📊 Verificando inventário inicial...');
    const initialInventory = await getInventory(userId);
    console.log('Inventário inicial:', initialInventory);

    // 3. Criar sessão de checkout
    console.log('\n💳 Criando sessão de checkout para "shield"...');
    const response = await fetch(`${BASE_URL}/api/stripe/checkout/booster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        boosterKey: 'shield',
        priceKey: 'p1',
        qty: 2
      })
    });

    const result = await response.json();
    
    if (!result.ok || !result.url) {
      console.error('❌ Erro ao criar sessão de checkout:', result.message);
      return;
    }

    console.log('✅ Sessão de checkout criada com sucesso');
    console.log(`🔗 URL do Stripe: ${result.url}`);

    // 4. Extrair session_id da URL
    const urlParams = new URL(result.url);
    const sessionId = urlParams.searchParams.get('session_id') || 
                     urlParams.pathname.split('/').pop();
    
    console.log(`🎫 Session ID: ${sessionId}`);

    // 5. Simular webhook do Stripe (checkout.session.completed)
    console.log('\n🔔 Simulando webhook do Stripe...');
    
    const webhookPayload = {
      id: `evt_test_${Date.now()}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          metadata: {
            boosterKey: 'shield',
            qty: '2',
            userId: userId
          },
          amount_total: 1000, // R$ 10,00 em centavos
          currency: 'brl'
        }
      }
    };

    const webhookResponse = await fetch(`${BASE_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_signature'
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log(`Webhook response status: ${webhookResponse.status}`);
    
    if (webhookResponse.ok) {
      console.log('✅ Webhook processado com sucesso');
    } else {
      const webhookError = await webhookResponse.text();
      console.log('❌ Erro no webhook:', webhookError);
    }

    // 6. Aguardar um pouco para o processamento
    console.log('\n⏳ Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Verificar inventário final
    console.log('📊 Verificando inventário final...');
    const finalInventory = await getInventory(userId);
    console.log('Inventário final:', finalInventory);

    // 8. Comparar inventários
    console.log('\n📈 Comparação de inventários:');
    const initialShield = initialInventory.o_escudo || 0;
    const finalShield = finalInventory.o_escudo || 0;
    const difference = finalShield - initialShield;

    console.log(`Shield inicial: ${initialShield}`);
    console.log(`Shield final: ${finalShield}`);
    console.log(`Diferença: ${difference}`);

    if (difference === 2) {
      console.log('✅ Compra processada corretamente! +2 shields adicionados');
    } else {
      console.log('❌ Compra não foi processada corretamente');
    }

    // 9. Logout
    await supabase.auth.signOut();
    console.log('\n✅ Teste concluído');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testCompletePurchaseFlow().catch(console.error);