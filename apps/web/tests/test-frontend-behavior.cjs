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

// Simular o comportamento do useBoosterInventory
class MockBoosterInventory {
  constructor(userId) {
    this.userId = userId;
    this.inventory = {};
    this.listeners = [];
    this.eventCount = 0;
  }

  async fetchInventory() {
    console.log('📊 Buscando inventário do banco...');
    
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
    console.log('📦 Inventário carregado:', inv);
    return inv;
  }

  setupRealtimeListener() {
    console.log('👂 Configurando listener realtime...');
    
    const channel = supabase
      .channel(`inv_purchases_${this.userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booster_purchases", filter: `user_id=eq.${this.userId}` },
        (payload) => {
          this.eventCount++;
          const nr = payload?.new || payload?.record || {};
          const booster = nr?.booster;
          const amount = typeof nr?.amount === "number" ? nr.amount : 1;
          
          console.log(`📡 EVENTO REALTIME ${this.eventCount}:`, {
            booster,
            amount,
            id: nr?.id,
            timestamp: new Date().toISOString()
          });
          
          if (!booster) return;
          
          // Simular exatamente o que o hook faz
          this.inventory[booster] = (this.inventory[booster] || 0) + amount;
          
          console.log(`🔄 Inventário atualizado: ${booster} = ${this.inventory[booster]}`);
        },
      )
      .subscribe();

    this.listeners.push(channel);
    return channel;
  }

  cleanup() {
    console.log('🧹 Limpando listeners...');
    this.listeners.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        console.warn('Erro ao remover canal:', e.message);
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

async function testFrontendBehavior() {
  try {
    console.log('🎭 TESTE: Simulando comportamento real do frontend\n');

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

    // 2. Criar instância do mock do hook
    const mockHook = new MockBoosterInventory(userId);

    // 3. Buscar inventário inicial (como o hook faz)
    await mockHook.fetchInventory();
    console.log('📊 Estado inicial:', mockHook.getInventory());

    // 4. Configurar listener realtime
    mockHook.setupRealtimeListener();
    
    // Aguardar um momento para o listener estar ativo
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Simular compra via API (como a interface faz)
    console.log('\n💳 Simulando compra via API...');
    console.log('🛒 Comprando 5 unidades de "palpite_automatico"...');
    
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'palpite_automatico',
        amount: 5
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
    console.log('═'.repeat(50));
    
    const finalInventory = mockHook.getInventory();
    const eventCount = mockHook.getEventCount();
    
    console.log(`📡 Eventos realtime capturados: ${eventCount}`);
    console.log('📦 Inventário final (mock):', finalInventory);
    
    const expectedAmount = 5;
    const actualAmount = finalInventory.palpite_automatico || 0;
    
    console.log(`\n🎯 ANÁLISE:`);
    console.log(`   Esperado: ${expectedAmount} unidades`);
    console.log(`   Calculado pelo mock: ${actualAmount} unidades`);
    
    if (actualAmount === expectedAmount) {
      console.log('✅ CORRETO: Mock calculou corretamente');
    } else if (actualAmount === expectedAmount * 2) {
      console.log('❌ DUPLICAÇÃO: Mock calculou o dobro (possível duplicação realtime)');
    } else {
      console.log(`❌ ERRO: Valor inesperado (${actualAmount})`);
    }

    // 8. Verificar banco de dados real
    console.log('\n🗄️ VERIFICAÇÃO NO BANCO:');
    const { data: dbRecords, error: dbError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .eq('booster', 'palpite_automatico')
      .order('created_at', { ascending: true });

    if (dbError) {
      console.error('❌ Erro ao verificar banco:', dbError.message);
    } else {
      console.log(`📦 Registros no banco: ${dbRecords.length}`);
      
      let totalInDB = 0;
      dbRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. Amount: ${record.amount} | Created: ${new Date(record.created_at).toLocaleString('pt-BR')}`);
        totalInDB += record.amount;
      });
      
      console.log(`📊 Total real no banco: ${totalInDB}`);
      
      if (totalInDB === actualAmount) {
        console.log('✅ Mock e banco coincidem');
      } else {
        console.log('❌ Discrepância entre mock e banco!');
        console.log(`   Banco: ${totalInDB} | Mock: ${actualAmount}`);
      }
    }

    // 9. Simular múltiplas instâncias do hook (possível causa da duplicação)
    console.log('\n🔄 TESTE: Múltiplas instâncias do hook');
    console.log('═'.repeat(50));
    
    const mockHook2 = new MockBoosterInventory(userId);
    await mockHook2.fetchInventory();
    mockHook2.setupRealtimeListener();
    
    console.log('📊 Hook 1 - Inventário:', mockHook.getInventory());
    console.log('📊 Hook 2 - Inventário:', mockHook2.getInventory());
    
    // Aguardar um momento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fazer outra compra
    console.log('\n🛒 Fazendo segunda compra (3 unidades)...');
    const { data: purchase2Data, error: purchase2Error } = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'segunda_chance',
        amount: 3
      })
      .select();

    if (purchase2Error) {
      console.error('❌ Erro na segunda compra:', purchase2Error.message);
    } else {
      console.log('✅ Segunda compra inserida:', purchase2Data[0]);
      
      // Aguardar eventos
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('\n📊 APÓS SEGUNDA COMPRA:');
      console.log(`📡 Hook 1 - Eventos: ${mockHook.getEventCount()} | Inventário:`, mockHook.getInventory());
      console.log(`📡 Hook 2 - Eventos: ${mockHook2.getEventCount()} | Inventário:`, mockHook2.getInventory());
      
      const hook1Amount = mockHook.getInventory().segunda_chance || 0;
      const hook2Amount = mockHook2.getInventory().segunda_chance || 0;
      
      if (hook1Amount === 3 && hook2Amount === 3) {
        console.log('✅ Ambos os hooks calcularam corretamente');
      } else {
        console.log('❌ Problema detectado nos hooks múltiplos');
        console.log(`   Hook 1: ${hook1Amount} | Hook 2: ${hook2Amount}`);
      }
    }

    // 10. Limpeza
    console.log('\n🧹 Limpeza...');
    mockHook.cleanup();
    mockHook2.cleanup();

    console.log('\n🎯 CONCLUSÕES:');
    console.log('═'.repeat(50));
    
    if (eventCount === 0) {
      console.log('❌ PROBLEMA: Realtime não está funcionando');
      console.log('💡 POSSÍVEL CAUSA: Configuração do Supabase ou permissões');
    } else if (actualAmount > expectedAmount) {
      console.log('❌ PROBLEMA: Há duplicação no cálculo');
      console.log('💡 POSSÍVEL CAUSA: Múltiplos listeners ou eventos duplicados');
    } else {
      console.log('✅ COMPORTAMENTO NORMAL: Sem duplicação detectada');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error);
  }
}

testFrontendBehavior();