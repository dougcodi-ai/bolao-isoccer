// Test script para verificar o fluxo de checkout do Stripe
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_URL = 'http://localhost:3002';

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function testStripeCheckout() {
  console.log('🧪 Testando fluxo de checkout do Stripe...\n');

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
    console.log('✅ Login realizado com sucesso\n');

    // 2. Testar API de checkout para diferentes boosters
    console.log('2. Testando mapeamento de preços...');
    
    const boosters = ['shield', 'forgotten', 'second_chance', 'auto_pick'];
    
    for (const booster of boosters) {
      try {
        const response = await fetch(`${BASE_URL}/api/stripe/checkout/booster`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            boosterKey: booster,
            priceKey: 'p1',
            qty: 1
          })
        });

        const result = await response.json();
        
        if (result.ok && result.url) {
          console.log(`${booster}: ✅ OK - URL gerada`);
        } else {
          console.log(`${booster}: ❌ ${result.message || 'Erro desconhecido'}`);
        }
      } catch (error) {
        console.log(`${booster}: ❌ Erro - ${error.message}`);
      }
    }

    // 3. Logout
    await supabase.auth.signOut();
    console.log('\n✅ Teste concluído');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testStripeCheckout().catch(console.error);