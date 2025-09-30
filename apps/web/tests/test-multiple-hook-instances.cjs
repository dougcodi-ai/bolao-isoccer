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

// Simular múltiplas instâncias do hook useBoosterInventory
class BoosterInventoryHook {
  constructor(userId, name) {
    this.userId = userId;
    this.name = name;
    this.inventory = {};
    this.listeners = [];
    this.eventCount = 0;
    this.isActive = false;
  }

  async fetchInventory() {
    console.log(`📊 [${this.name}] Buscando inventário do banco...`);
    
    const [{ data: purchases, error: errP }, { data: usages, error: errU }] = await Promise.all([
      supabase.from("booster_purchases").select("booster, amount").eq("user_id", this.userId),
      supabase.from("booster_usages").select("booster, status").eq("user_id", this.userId),
    ]);
    
    if (errP) throw errP;
    if (errU) throw errU;
    
    const inv = {};
    for (const row of (purchases || [])) {
      const key = String(row.booster);
      inv[key] = (inv[key] || 0) + (Number(row.amount) || 0);
    }
    
    for (const u of (usages || [])) {
      const key = String(u.booster);
      const status = String(u.status || "consumed");
      if (status === "consumed" || status === "pending") {
        inv[key] = Math.max(0, (inv[key] || 0) - 1);
      }
    }
    
    this.inventory = inv;
    console.log(`📦 [${this.name}] Inventário carregado:`, inv);
    return inv;
  }

  setupRealtimeListener() {
    if (this.isActive) {
      console.log(`⚠️ [${this.name}] Listener já está ativo!`);
      return;
    }

    console.log(`👂 [${this.name}] Configurando listener realtime...`);
    this.isActive = true;
    
    const channel = supabase
      .channel(`inv_purchases_${this.userId}_${this.name}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booster_purchases", filter: `user_id=eq.${this.userId}` },
        (payload) => {
          this.eventCount++;
          const nr = payload?.new || payload?.record || {};
          const booster = nr?.booster;
          const amount = typeof nr?.amount === "number" ? nr.amount : 1;
          
          console.log(`📡 [${this.name}] EVENTO REALTIME ${this.eventCount}:`, {
            booster,
            amount,
            id: nr?.id,
            timestamp: new Date().toISOString()
          });
          
          if (!booster) return;
          
          // Simular exatamente o que o hook faz
          this.inventory[booster] = (this.inventory[booster] || 0) + amount;
          
          console.log(`🔄 [${this.name}] Inventário atualizado: ${booster} = ${this.inventory[booster]}`);
        },
      )
      .subscribe();

    this.listeners.push(channel);
    return channel;
  }

  cleanup() {
    console.log(`🧹 [${this.name}] Limpando listeners...`);
    this.isActive = false;
    this.listeners.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn(`[${this.name}] Erro ao remover canal:`, e.message);
      }
    });
    this.listeners = [];
  }

  getInventory() {
    return { ...this.inventory };
  }

  getEventCount() {
    return this.eventCount;
  }
}

async function testMultipleHookInstances() {
  try {
    console.log('🎭 TESTE: Múltiplas instâncias do hook useBoosterInventory\n');

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

    // 2. Criar múltiplas instâncias do hook (simulando páginas diferentes)
    console.log('🏗️ Criando múltiplas instâncias do hook...');
    const walletHook = new BoosterInventoryHook(userId, 'WALLET');
    const boostersHook = new BoosterInventoryHook(userId, 'BOOSTERS');
    const palpitesHook = new BoosterInventoryHook(userId, 'PALPITES');

    // 3. Buscar inventário inicial em todas as instâncias
    console.log('\n📊 Buscando inventário inicial em todas as instâncias...');
    await Promise.all([
      walletHook.fetchInventory(),
      boostersHook.fetchInventory(),
      palpitesHook.fetchInventory()
    ]);

    console.log('\n📦 Estado inicial:');
    console.log('  WALLET:', walletHook.getInventory());
    console.log('  BOOSTERS:', boostersHook.getInventory());
    console.log('  PALPITES:', palpitesHook.getInventory());

    // 4. Configurar listeners realtime em todas as instâncias
    console.log('\n👂 Configurando listeners realtime...');
    walletHook.setupRealtimeListener();
    boostersHook.setupRealtimeListener();
    palpitesHook.setupRealtimeListener();
    
    // Aguardar um momento para os listeners estarem ativos
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Fazer uma compra e verificar se há duplicação
    console.log('\n💳 Fazendo compra de teste...');
    console.log('🛒 Comprando 2 unidades de "segunda_chance"...');
    
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'segunda_chance',
        amount: 2,
        source: 'test_multiple_hooks'
      })
      .select();

    if (purchaseError) {
      console.error('❌ Erro na compra:', purchaseError.message);
      return;
    }

    console.log('✅ Compra inserida no banco:', purchaseData[0]);

    // 6. Aguardar eventos realtime
    console.log('\n⏳ Aguardando eventos realtime (5 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 7. Verificar estado após realtime
    console.log('\n📊 ESTADO APÓS REALTIME:');
    console.log('═'.repeat(60));
    
    const walletInventory = walletHook.getInventory();
    const boostersInventory = boostersHook.getInventory();
    const palpitesInventory = palpitesHook.getInventory();
    
    console.log(`📡 Eventos capturados:`);
    console.log(`  WALLET: ${walletHook.getEventCount()} eventos`);
    console.log(`  BOOSTERS: ${boostersHook.getEventCount()} eventos`);
    console.log(`  PALPITES: ${palpitesHook.getEventCount()} eventos`);
    
    console.log(`\n📦 Inventário final:`);
    console.log(`  WALLET:`, walletInventory);
    console.log(`  BOOSTERS:`, boostersInventory);
    console.log(`  PALPITES:`, palpitesInventory);
    
    const walletAmount = walletInventory.segunda_chance || 0;
    const boostersAmount = boostersInventory.segunda_chance || 0;
    const palpitesAmount = palpitesInventory.segunda_chance || 0;
    
    console.log(`\n🎯 ANÁLISE - Segunda Chance:`);
    console.log(`  WALLET: ${walletAmount} unidades`);
    console.log(`  BOOSTERS: ${boostersAmount} unidades`);
    console.log(`  PALPITES: ${palpitesAmount} unidades`);

    // 8. Verificar se todas as instâncias têm o mesmo valor
    const allSame = walletAmount === boostersAmount && boostersAmount === palpitesAmount;
    
    if (allSame) {
      console.log('✅ CONSISTENTE: Todas as instâncias têm o mesmo valor');
      
      // Verificar se o valor está correto
      const { data: dbRecords, error: dbError } = await supabaseAdmin
        .from('booster_purchases')
        .select('amount')
        .eq('user_id', userId)
        .eq('booster', 'segunda_chance');

      if (!dbError) {
        const totalInDB = dbRecords.reduce((sum, r) => sum + r.amount, 0);
        console.log(`📊 Total no banco: ${totalInDB}`);
        
        if (walletAmount === totalInDB) {
          console.log('✅ CORRETO: Valor coincide com o banco');
        } else {
          console.log('❌ ERRO: Valor não coincide com o banco');
          console.log(`   Hooks: ${walletAmount} | Banco: ${totalInDB}`);
        }
      }
    } else {
      console.log('❌ INCONSISTENTE: Instâncias têm valores diferentes!');
      console.log('💡 Isso indica problema de sincronização entre hooks');
    }

    // 9. Testar se o problema é acumulativo
    console.log('\n🔄 TESTE ACUMULATIVO: Segunda compra...');
    console.log('🛒 Comprando mais 1 unidade de "segunda_chance"...');
    
    const { data: purchase2Data, error: purchase2Error } = await supabaseAdmin
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'segunda_chance',
        amount: 1,
        source: 'test_multiple_hooks_2'
      })
      .select();

    if (purchase2Error) {
      console.error('❌ Erro na segunda compra:', purchase2Error.message);
    } else {
      console.log('✅ Segunda compra inserida:', purchase2Data[0]);
      
      // Aguardar eventos
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n📊 APÓS SEGUNDA COMPRA:');
      const wallet2 = walletHook.getInventory().segunda_chance || 0;
      const boosters2 = boostersHook.getInventory().segunda_chance || 0;
      const palpites2 = palpitesHook.getInventory().segunda_chance || 0;
      
      console.log(`  WALLET: ${wallet2} unidades (eventos: ${walletHook.getEventCount()})`);
      console.log(`  BOOSTERS: ${boosters2} unidades (eventos: ${boostersHook.getEventCount()})`);
      console.log(`  PALPITES: ${palpites2} unidades (eventos: ${palpitesHook.getEventCount()})`);
      
      const expectedTotal = walletAmount + 1;
      if (wallet2 === expectedTotal && boosters2 === expectedTotal && palpites2 === expectedTotal) {
        console.log('✅ CORRETO: Todas as instâncias atualizaram corretamente');
      } else {
        console.log('❌ PROBLEMA: Nem todas as instâncias atualizaram corretamente');
      }
    }

    // 10. Limpeza
    console.log('\n🧹 Limpeza...');
    walletHook.cleanup();
    boostersHook.cleanup();
    palpitesHook.cleanup();

    console.log('\n🎯 CONCLUSÕES:');
    console.log('═'.repeat(60));
    
    const totalEvents = walletHook.getEventCount() + boostersHook.getEventCount() + palpitesHook.getEventCount();
    
    if (totalEvents === 0) {
      console.log('❌ PROBLEMA: Realtime não está funcionando');
      console.log('💡 CAUSA: Configuração do Supabase ou permissões');
    } else if (totalEvents > 6) { // 3 hooks × 2 compras = 6 eventos esperados
      console.log('❌ PROBLEMA: Muitos eventos realtime');
      console.log('💡 CAUSA: Possível duplicação de eventos');
    } else {
      console.log('✅ COMPORTAMENTO NORMAL: Eventos realtime funcionando');
    }

    console.log('\n💡 RECOMENDAÇÕES:');
    if (!allSame) {
      console.log('🔧 Implementar singleton ou context para o hook useBoosterInventory');
      console.log('🔧 Evitar múltiplas instâncias do mesmo hook para o mesmo usuário');
    }
    
    console.log('🔧 Verificar se o realtime está configurado corretamente');
    console.log('🔧 Considerar usar um estado global (Redux/Zustand) para o inventário');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error);
  }
}

testMultipleHookInstances();