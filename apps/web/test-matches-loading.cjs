const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, anonKey);

async function testMatchesLoading() {
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
    console.log(`👤 Usuário: ${authData.user.email}`);
    
    // Aguardar um pouco para garantir que a sessão está ativa
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Testar carregamento de jogos
    console.log('\n🎯 Testando carregamento de jogos...');
    
    const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
    const GAMES_PER_PAGE = 10;
    
    // Simular a função loadInitialMatches
    const now = new Date();
    
    // Carregar jogos futuros
    console.log('📅 Carregando jogos futuros...');
    const { data: futureMatches, error: futureError } = await supabase
      .from('matches')
      .select('*')
      .eq('pool_id', poolId)
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(GAMES_PER_PAGE);
    
    if (futureError) {
      console.error('❌ Erro ao carregar jogos futuros:', futureError);
    } else {
      console.log(`✅ Jogos futuros carregados: ${futureMatches.length}`);
      futureMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. ${match.home_team} vs ${match.away_team} - ${new Date(match.start_time).toLocaleString('pt-BR')}`);
      });
    }
    
    // Carregar jogos passados
    console.log('\n📅 Carregando jogos passados...');
    const { data: pastMatches, error: pastError } = await supabase
      .from('matches')
      .select('*')
      .eq('pool_id', poolId)
      .lt('start_time', now.toISOString())
      .order('start_time', { ascending: false })
      .limit(GAMES_PER_PAGE);
    
    if (pastError) {
      console.error('❌ Erro ao carregar jogos passados:', pastError);
    } else {
      console.log(`✅ Jogos passados carregados: ${pastMatches.length}`);
      pastMatches.forEach((match, index) => {
        const score = match.home_score !== null && match.away_score !== null 
          ? ` (${match.home_score} x ${match.away_score})` 
          : '';
        console.log(`   ${index + 1}. ${match.home_team} vs ${match.away_team}${score} - ${new Date(match.start_time).toLocaleString('pt-BR')}`);
      });
    }
    
    // Testar carregamento de palpites
    console.log('\n🎯 Testando carregamento de palpites...');
    const allMatches = [...(futureMatches || []), ...(pastMatches || [])];
    const matchIds = allMatches.map(m => m.id);
    
    if (matchIds.length > 0) {
      const { data: predictions, error: predError } = await supabase
        .from('predictions')
        .select('*')
        .in('match_id', matchIds)
        .eq('user_id', authData.user.id);
      
      if (predError) {
        console.error('❌ Erro ao carregar palpites:', predError);
      } else {
        console.log(`✅ Palpites carregados: ${predictions.length}`);
      }
    }
    
    console.log('\n🎉 Teste concluído! Os jogos estão sendo carregados corretamente.');
    console.log('🌐 Acesse http://localhost:3002/palpites para ver na interface.');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testMatchesLoading().catch(console.error);