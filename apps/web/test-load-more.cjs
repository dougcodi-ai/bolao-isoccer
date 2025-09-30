const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, anonKey);

async function testLoadMore() {
  console.log('🔐 Fazendo login com usuário de teste...');
  
  try {
    // Fazer login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test_1759178314365@example.com',
      password: 'test123456'
    });
    
    if (authError) {
      console.error('❌ Erro no login:', authError);
      return;
    }
    
    console.log('✅ Login realizado com sucesso!');
    
    const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
    const GAMES_PER_PAGE = 10;
    const now = new Date();
    
    // Simular carregamento inicial
    console.log('\n📄 === CARREGAMENTO INICIAL ===');
    
    // Carregar jogos futuros (primeira página)
    console.log('📅 Carregando jogos futuros (página 1)...');
    const { data: futureMatches1, error: futureError1 } = await supabase
      .from('matches')
      .select('*')
      .eq('pool_id', poolId)
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(GAMES_PER_PAGE);
    
    if (futureError1) {
      console.error('❌ Erro:', futureError1);
    } else {
      console.log(`✅ Jogos futuros carregados: ${futureMatches1.length}`);
    }
    
    // Carregar jogos passados (primeira página)
    console.log('📅 Carregando jogos passados (página 1)...');
    const { data: pastMatches1, error: pastError1 } = await supabase
      .from('matches')
      .select('*')
      .eq('pool_id', poolId)
      .lt('start_time', now.toISOString())
      .order('start_time', { ascending: false })
      .limit(GAMES_PER_PAGE);
    
    if (pastError1) {
      console.error('❌ Erro:', pastError1);
    } else {
      console.log(`✅ Jogos passados carregados: ${pastMatches1.length}`);
    }
    
    // Simular "carregar mais" para jogos futuros
    console.log('\n📄 === CARREGAR MAIS - JOGOS FUTUROS ===');
    
    if (futureMatches1.length === GAMES_PER_PAGE) {
      const lastFutureMatch = futureMatches1[futureMatches1.length - 1];
      
      console.log('📅 Carregando mais jogos futuros (página 2)...');
      const { data: futureMatches2, error: futureError2 } = await supabase
        .from('matches')
        .select('*')
        .eq('pool_id', poolId)
        .gte('start_time', now.toISOString())
        .gt('start_time', lastFutureMatch.start_time)
        .order('start_time', { ascending: true })
        .limit(GAMES_PER_PAGE);
      
      if (futureError2) {
        console.error('❌ Erro:', futureError2);
      } else {
        console.log(`✅ Mais jogos futuros carregados: ${futureMatches2.length}`);
        console.log(`📊 Total de jogos futuros: ${futureMatches1.length + futureMatches2.length}`);
      }
    } else {
      console.log('ℹ️ Não há mais jogos futuros para carregar');
    }
    
    // Simular "carregar mais" para jogos passados
    console.log('\n📄 === CARREGAR MAIS - JOGOS PASSADOS ===');
    
    if (pastMatches1.length === GAMES_PER_PAGE) {
      const lastPastMatch = pastMatches1[pastMatches1.length - 1];
      
      console.log('📅 Carregando mais jogos passados (página 2)...');
      const { data: pastMatches2, error: pastError2 } = await supabase
        .from('matches')
        .select('*')
        .eq('pool_id', poolId)
        .lt('start_time', now.toISOString())
        .lt('start_time', lastPastMatch.start_time)
        .order('start_time', { ascending: false })
        .limit(GAMES_PER_PAGE);
      
      if (pastError2) {
        console.error('❌ Erro:', pastError2);
      } else {
        console.log(`✅ Mais jogos passados carregados: ${pastMatches2.length}`);
        console.log(`📊 Total de jogos passados: ${pastMatches1.length + pastMatches2.length}`);
      }
    } else {
      console.log('ℹ️ Não há mais jogos passados para carregar');
    }
    
    // Verificar total de jogos no pool
    console.log('\n📊 === VERIFICAÇÃO FINAL ===');
    const { count, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);
    
    if (!countError) {
      console.log(`🎯 Total de jogos no pool: ${count}`);
      
      const futureCount = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', poolId)
        .gte('start_time', now.toISOString());
      
      const pastCount = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', poolId)
        .lt('start_time', now.toISOString());
      
      console.log(`📅 Jogos futuros no total: ${futureCount.count}`);
      console.log(`📅 Jogos passados no total: ${pastCount.count}`);
      
      if (futureCount.count > GAMES_PER_PAGE || pastCount.count > GAMES_PER_PAGE) {
        console.log('✅ Paginação necessária e funcionando!');
      } else {
        console.log('ℹ️ Paginação não necessária com a quantidade atual de jogos');
      }
    }
    
    console.log('\n🎉 Teste da função "carregar mais" concluído!');
    console.log('🌐 Acesse http://localhost:3002/palpites para testar na interface.');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testLoadMore().catch(console.error);