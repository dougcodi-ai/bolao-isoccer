require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

console.log('🧪 TESTE: Processamento direto de compra de booster\n');

async function testBoosterProcessing() {
  try {
    // Cliente anônimo para login
    const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // Cliente admin para operações de backend
    const sbAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔑 Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'teste@bolao.com',
      password: '123456789'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    const userId = authData.user.id;
    console.log('✅ Login realizado com sucesso');
    console.log('🆔 User ID:', userId);

    // Função para calcular inventário
    const calculateInventory = async (userId) => {
      const { data: purchases, error } = await sbAdmin
        .from('booster_purchases')
        .select('booster, amount')
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao buscar compras:', error);
        return {};
      }

      const inventory = {};
      purchases.forEach(purchase => {
        inventory[purchase.booster] = (inventory[purchase.booster] || 0) + purchase.amount;
      });

      return inventory;
    };

    console.log('\n📊 Verificando inventário inicial...');
    const initialInventory = await calculateInventory(userId);
    console.log('Inventário inicial:', initialInventory);

    // Simular compra de 2 shields
    const boosterKey = 'o_escudo';
    const qty = 2;

    console.log(`\n💰 Processando compra de ${qty}x ${boosterKey}...`);

    // Inserir compra diretamente
    const { error: purchaseError } = await sbAdmin
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: boosterKey,
        amount: qty
      });

    if (purchaseError) {
      console.error('❌ Erro ao inserir compra:', purchaseError.message);
      return;
    }

    console.log('✅ Compra inserida com sucesso');

    // Inserir notificação
    try {
      await sbAdmin.from('notifications').insert({
        user_id: userId,
        type: 'booster_purchase',
        title: 'Booster adquirido',
        body: `Você comprou ${qty}x ${boosterKey.replace(/_/g, ' ')}.`,
        meta: { booster: boosterKey, qty }
      });
      console.log('✅ Notificação criada');
    } catch (notifError) {
      console.log('⚠️ Erro na notificação (não crítico):', notifError.message);
    }

    console.log('\n📊 Verificando inventário final...');
    const finalInventory = await calculateInventory(userId);
    console.log('Inventário final:', finalInventory);

    // Comparar inventários
    const initialShields = initialInventory[boosterKey] || 0;
    const finalShields = finalInventory[boosterKey] || 0;
    const difference = finalShields - initialShields;

    console.log('\n📈 Comparação de inventários:');
    console.log(`${boosterKey} inicial:`, initialShields);
    console.log(`${boosterKey} final:`, finalShields);
    console.log('Diferença:', difference);

    if (difference === qty) {
      console.log('✅ Compra processada corretamente!');
    } else {
      console.log('❌ Compra não foi processada corretamente');
    }

    // Logout
    await supabase.auth.signOut();
    console.log('\n🚪 Logout realizado');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testBoosterProcessing().then(() => {
  console.log('\n✅ Teste concluído');
});