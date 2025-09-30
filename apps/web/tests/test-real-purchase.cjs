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

async function testRealPurchase() {
  try {
    console.log('🧪 TESTE: Compra real com verificação de duplicação\n');

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

    // 2. Verificar inventário inicial
    console.log('📊 Verificando inventário inicial...');
    const { data: initialPurchases, error: initialError } = await supabaseAdmin
      .from('booster_purchases')
      .select('booster, amount')
      .eq('user_id', userId);

    if (initialError) {
      console.error('❌ Erro ao verificar inventário inicial:', initialError.message);
      return;
    }

    const initialInventory = {};
    initialPurchases.forEach(purchase => {
      initialInventory[purchase.booster] = (initialInventory[purchase.booster] || 0) + purchase.amount;
    });

    console.log('📦 Inventário inicial:', initialInventory);
    const initialPalpiteAutomatico = initialInventory.palpite_automatico || 0;
    console.log(`🎯 Palpite Automático inicial: ${initialPalpiteAutomatico} unidades\n`);

    // 3. Fazer uma compra direta no banco (simulando o webhook do Stripe)
    console.log('💳 Simulando compra via webhook do Stripe...');
    console.log('🛒 Comprando 3 unidades de "palpite_automatico"...');
    
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'palpite_automatico',
        amount: 3,
        source: 'stripe_webhook'
      })
      .select();

    if (purchaseError) {
      console.error('❌ Erro na compra:', purchaseError.message);
      return;
    }

    console.log('✅ Compra inserida no banco:', purchaseData[0]);

    // 4. Aguardar um momento para o realtime processar
    console.log('\n⏳ Aguardando processamento realtime (3 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Verificar inventário final
    console.log('\n📊 Verificando inventário final...');
    const { data: finalPurchases, error: finalError } = await supabaseAdmin
      .from('booster_purchases')
      .select('booster, amount, created_at, source')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (finalError) {
      console.error('❌ Erro ao verificar inventário final:', finalError.message);
      return;
    }

    const finalInventory = {};
    finalPurchases.forEach(purchase => {
      finalInventory[purchase.booster] = (finalInventory[purchase.booster] || 0) + purchase.amount;
    });

    console.log('📦 Inventário final:', finalInventory);
    const finalPalpiteAutomatico = finalInventory.palpite_automatico || 0;
    console.log(`🎯 Palpite Automático final: ${finalPalpiteAutomatico} unidades`);

    // 6. Análise
    console.log('\n🔍 ANÁLISE:');
    console.log('═'.repeat(50));
    
    const expectedIncrease = 3;
    const actualIncrease = finalPalpiteAutomatico - initialPalpiteAutomatico;
    
    console.log(`📈 Aumento esperado: ${expectedIncrease} unidades`);
    console.log(`📈 Aumento real: ${actualIncrease} unidades`);
    
    if (actualIncrease === expectedIncrease) {
      console.log('✅ CORRETO: Inventário aumentou corretamente');
    } else if (actualIncrease === expectedIncrease * 2) {
      console.log('❌ DUPLICAÇÃO DETECTADA: Inventário aumentou o dobro!');
    } else {
      console.log(`❌ ERRO INESPERADO: Aumento de ${actualIncrease} unidades`);
    }

    // 7. Verificar se há registros duplicados
    console.log('\n🔍 Verificando registros duplicados...');
    const palpiteAutomaticoRecords = finalPurchases.filter(p => p.booster === 'palpite_automatico');
    
    console.log(`📊 Total de registros de palpite_automatico: ${palpiteAutomaticoRecords.length}`);
    
    palpiteAutomaticoRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. Amount: ${record.amount} | Source: ${record.source || 'N/A'} | Created: ${new Date(record.created_at).toLocaleString('pt-BR')}`);
    });

    // 8. Verificar se há múltiplos registros com a mesma timestamp (possível duplicação)
    const timestamps = palpiteAutomaticoRecords.map(r => r.created_at);
    const uniqueTimestamps = [...new Set(timestamps)];
    
    if (timestamps.length !== uniqueTimestamps.length) {
      console.log('❌ DUPLICAÇÃO DETECTADA: Múltiplos registros com a mesma timestamp!');
      
      const duplicates = timestamps.filter((timestamp, index) => 
        timestamps.indexOf(timestamp) !== index
      );
      
      console.log('🔍 Timestamps duplicados:', duplicates);
    } else {
      console.log('✅ Nenhuma duplicação de timestamp detectada');
    }

    // 9. Instruções para verificação manual
    console.log('\n📋 INSTRUÇÕES PARA VERIFICAÇÃO MANUAL:');
    console.log('═'.repeat(50));
    console.log('1. Abra http://localhost:3002/wallet no navegador');
    console.log('2. Faça login com teste@bolao.com / 123456789');
    console.log('3. Verifique se o inventário mostra:');
    console.log(`   - Palpite Automático: ${finalPalpiteAutomatico} unidades`);
    console.log('4. Se mostrar um valor diferente, há problema no frontend');
    console.log('5. Tente comprar 1 unidade e veja se aumenta 1 ou 2');

    console.log('\n🎯 PRÓXIMOS PASSOS:');
    if (actualIncrease === expectedIncrease) {
      console.log('✅ Banco de dados está funcionando corretamente');
      console.log('🔍 Se há duplicação, o problema está no frontend/realtime');
      console.log('💡 Verifique se há múltiplas instâncias do hook useBoosterInventory');
    } else {
      console.log('❌ Há problema no banco de dados ou na inserção');
      console.log('🔍 Verifique o webhook do Stripe e a API de compra');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error);
  }
}

testRealPurchase();