require('dotenv').config({ path: '.env.local' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createTestPrices() {
  console.log('🔄 Criando preços de teste no Stripe...');
  
  try {
    // Criar produtos primeiro
    const esquecidoProduct = await stripe.products.create({
      name: 'O Esquecido',
      description: 'Booster O Esquecido para palpites',
    });
    
    const escudoProduct = await stripe.products.create({
      name: 'O Escudo',
      description: 'Booster O Escudo para proteção',
    });
    
    const segundaChanceProduct = await stripe.products.create({
      name: 'Segunda Chance',
      description: 'Upgrade Segunda Chance',
    });
    
    const palpiteAutomaticoProduct = await stripe.products.create({
      name: 'Palpite Automático',
      description: 'Upgrade Palpite Automático',
    });
    
    console.log('✅ Produtos criados com sucesso');
    
    // Criar preços para O Esquecido
    const esquecidoP1 = await stripe.prices.create({
      unit_amount: 199, // R$ 1,99
      currency: 'brl',
      product: esquecidoProduct.id,
      nickname: 'O Esquecido - 1 unidade',
    });
    
    const esquecidoP3 = await stripe.prices.create({
      unit_amount: 499, // R$ 4,99
      currency: 'brl',
      product: esquecidoProduct.id,
      nickname: 'O Esquecido - 3 unidades',
    });
    
    const esquecidoP5 = await stripe.prices.create({
      unit_amount: 799, // R$ 7,99
      currency: 'brl',
      product: esquecidoProduct.id,
      nickname: 'O Esquecido - 5 unidades',
    });
    
    // Criar preços para O Escudo
    const escudoP3 = await stripe.prices.create({
      unit_amount: 599, // R$ 5,99
      currency: 'brl',
      product: escudoProduct.id,
      nickname: 'O Escudo - 3 unidades',
    });
    
    const escudoP5 = await stripe.prices.create({
      unit_amount: 899, // R$ 8,99
      currency: 'brl',
      product: escudoProduct.id,
      nickname: 'O Escudo - 5 unidades',
    });
    
    // Criar preços para upgrades
    const segundaChanceP1 = await stripe.prices.create({
      unit_amount: 299, // R$ 2,99
      currency: 'brl',
      product: segundaChanceProduct.id,
      nickname: 'Segunda Chance - 1 unidade',
    });
    
    const palpiteAutomaticoP1 = await stripe.prices.create({
      unit_amount: 399, // R$ 3,99
      currency: 'brl',
      product: palpiteAutomaticoProduct.id,
      nickname: 'Palpite Automático - 1 unidade',
    });
    
    console.log('✅ Preços criados com sucesso');
    
    // Gerar novo mapeamento
    const priceMap = {
      esquecido: {
        p1: esquecidoP1.id,
        p3: esquecidoP3.id,
        p5: esquecidoP5.id
      },
      escudo: {
        p3: escudoP3.id,
        p5: escudoP5.id
      }
    };
    
    const upgradePriceMap = {
      segunda_chance: {
        p1: segundaChanceP1.id
      },
      palpite_automatico: {
        p1: palpiteAutomaticoP1.id
      }
    };
    
    console.log('\n📋 Novo mapeamento de preços para .env.local:');
    console.log(`STRIPE_PRICE_MAP_TEST=${JSON.stringify(priceMap)}`);
    console.log(`STRIPE_UPGRADE_PRICE_MAP_TEST=${JSON.stringify(upgradePriceMap)}`);
    
    console.log('\n🎯 IDs dos preços criados:');
    console.log('O Esquecido:');
    console.log(`  - 1 unidade: ${esquecidoP1.id}`);
    console.log(`  - 3 unidades: ${esquecidoP3.id}`);
    console.log(`  - 5 unidades: ${esquecidoP5.id}`);
    console.log('O Escudo:');
    console.log(`  - 3 unidades: ${escudoP3.id}`);
    console.log(`  - 5 unidades: ${escudoP5.id}`);
    console.log('Upgrades:');
    console.log(`  - Segunda Chance: ${segundaChanceP1.id}`);
    console.log(`  - Palpite Automático: ${palpiteAutomaticoP1.id}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar preços:', error.message);
    process.exit(1);
  }
}

createTestPrices();