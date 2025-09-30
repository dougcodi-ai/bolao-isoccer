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

async function debugRealtimeDuplication() {
  try {
    console.log('🔍 DEBUG: Investigando duplicação no realtime\n');

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

    // 2. Configurar listener realtime para monitorar eventos
    console.log('👂 Configurando listener realtime...');
    
    let realtimeEvents = [];
    
    const channel = supabase
      .channel(`debug_purchases_${userId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'booster_purchases', 
          filter: `user_id=eq.${userId}` 
        },
        (payload) => {
          const timestamp = new Date().toISOString();
          const event = {
            timestamp,
            type: 'INSERT',
            data: payload.new,
            eventId: payload.eventType + '_' + Date.now()
          };
          realtimeEvents.push(event);
          console.log(`📡 REALTIME EVENT ${realtimeEvents.length}:`, {
            timestamp,
            booster: payload.new?.booster,
            amount: payload.new?.amount,
            id: payload.new?.id
          });
        }
      )
      .subscribe();

    console.log('✅ Listener configurado\n');

    // 3. Aguardar um momento para garantir que o listener está ativo
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Fazer uma inserção controlada
    console.log('💉 Inserindo 1 registro de teste...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('booster_purchases')
      .insert({
        user_id: userId,
        booster: 'debug_test',
        amount: 7 // Quantidade única para identificar facilmente
      })
      .select();

    if (insertError) {
      console.error('❌ Erro na inserção:', insertError.message);
      return;
    }

    console.log('✅ Inserção realizada:', insertData[0]);

    // 5. Aguardar eventos realtime
    console.log('\n⏳ Aguardando eventos realtime (5 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6. Analisar eventos capturados
    console.log('\n📊 ANÁLISE DOS EVENTOS REALTIME:');
    console.log('═'.repeat(60));
    
    console.log(`📡 Total de eventos capturados: ${realtimeEvents.length}`);
    
    if (realtimeEvents.length === 0) {
      console.log('⚠️ NENHUM EVENTO REALTIME CAPTURADO');
      console.log('   Isso pode indicar problema na configuração do realtime');
    } else if (realtimeEvents.length === 1) {
      console.log('✅ COMPORTAMENTO NORMAL - 1 evento para 1 inserção');
      console.log('📋 Evento capturado:');
      console.log(JSON.stringify(realtimeEvents[0], null, 2));
    } else {
      console.log('❌ DUPLICAÇÃO DETECTADA!');
      console.log(`   Esperado: 1 evento | Capturado: ${realtimeEvents.length} eventos`);
      console.log('\n📋 Todos os eventos:');
      realtimeEvents.forEach((event, index) => {
        console.log(`\n  Evento ${index + 1}:`);
        console.log(`    Timestamp: ${event.timestamp}`);
        console.log(`    Booster: ${event.data?.booster}`);
        console.log(`    Amount: ${event.data?.amount}`);
        console.log(`    ID: ${event.data?.id}`);
      });
    }

    // 7. Verificar se há múltiplos canais ou listeners
    console.log('\n🔍 VERIFICANDO POSSÍVEIS CAUSAS:');
    
    // Simular o comportamento do hook useBoosterInventory
    let simulatedInventory = { debug_test: 0 };
    
    console.log('🧮 Simulando cálculo do hook:');
    console.log(`   Estado inicial: debug_test = ${simulatedInventory.debug_test}`);
    
    realtimeEvents.forEach((event, index) => {
      const amount = event.data?.amount || 0;
      simulatedInventory.debug_test += amount;
      console.log(`   Após evento ${index + 1}: debug_test = ${simulatedInventory.debug_test} (+${amount})`);
    });
    
    console.log(`\n📊 RESULTADO FINAL SIMULADO: debug_test = ${simulatedInventory.debug_test}`);
    
    if (simulatedInventory.debug_test === 7) {
      console.log('✅ Cálculo correto - sem duplicação');
    } else {
      console.log('❌ Cálculo incorreto - há duplicação no realtime!');
      console.log(`   Esperado: 7 | Calculado: ${simulatedInventory.debug_test}`);
    }

    // 8. Verificar no banco de dados
    console.log('\n🗄️ VERIFICAÇÃO NO BANCO DE DADOS:');
    const { data: dbRecords, error: dbError } = await supabaseAdmin
      .from('booster_purchases')
      .select('*')
      .eq('user_id', userId)
      .eq('booster', 'debug_test')
      .order('created_at', { ascending: true });

    if (dbError) {
      console.error('❌ Erro ao verificar banco:', dbError.message);
    } else {
      console.log(`📦 Registros no banco: ${dbRecords.length}`);
      dbRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id} | Amount: ${record.amount} | Created: ${new Date(record.created_at).toLocaleString('pt-BR')}`);
      });
      
      const totalInDB = dbRecords.reduce((sum, record) => sum + record.amount, 0);
      console.log(`📊 Total no banco: ${totalInDB}`);
      
      if (totalInDB === simulatedInventory.debug_test) {
        console.log('✅ Banco e simulação coincidem');
      } else {
        console.log('❌ Discrepância entre banco e simulação!');
      }
    }

    // 9. Limpeza
    console.log('\n🧹 Limpando registros de teste...');
    await supabaseAdmin
      .from('booster_purchases')
      .delete()
      .eq('user_id', userId)
      .eq('booster', 'debug_test');

    // 10. Fechar canal
    supabase.removeChannel(channel);
    console.log('✅ Canal realtime fechado');

    console.log('\n🎯 CONCLUSÃO:');
    if (realtimeEvents.length > 1) {
      console.log('❌ PROBLEMA CONFIRMADO: Há duplicação nos eventos realtime');
      console.log('💡 SOLUÇÃO: Revisar configuração do listener no useBoosterInventory');
    } else if (realtimeEvents.length === 1) {
      console.log('✅ REALTIME OK: Não há duplicação nos eventos');
      console.log('💡 INVESTIGAR: O problema pode estar em outro lugar');
    } else {
      console.log('⚠️ REALTIME NÃO FUNCIONOU: Verificar configuração');
    }

  } catch (error) {
    console.error('❌ Erro no debug:', error.message);
    console.error(error);
  }
}

debugRealtimeDuplication();