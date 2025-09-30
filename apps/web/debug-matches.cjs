const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMatches() {
  console.log('🔍 Verificando jogos na tabela matches...\n');

  try {
    // Verificar pools disponíveis
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, code')
      .limit(10);

    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
      return;
    }

    console.log(`📊 Pools encontrados: ${pools?.length || 0}`);
    if (pools && pools.length > 0) {
      pools.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.name} (${pool.code}) - ID: ${pool.id}`);
      });
    }

    if (!pools || pools.length === 0) {
      console.log('⚠️ Nenhum pool encontrado!');
      return;
    }

    // Verificar jogos para o primeiro pool
    const firstPool = pools[0];
    console.log(`\n🎯 Verificando jogos para o pool: ${firstPool.name} (${firstPool.id})`);

    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('pool_id', firstPool.id)
      .limit(10);

    if (matchesError) {
      console.error('❌ Erro ao buscar jogos:', matchesError);
      return;
    }

    console.log(`📊 Jogos encontrados: ${matches?.length || 0}`);
    if (matches && matches.length > 0) {
      matches.forEach((match, index) => {
        console.log(`   ${index + 1}. ${match.home_team} vs ${match.away_team} - ${new Date(match.start_time).toLocaleString()}`);
      });
    } else {
      console.log('⚠️ Nenhum jogo encontrado para este pool!');
      
      // Verificar se há jogos em qualquer pool
      console.log('\n🔍 Verificando jogos em todos os pools...');
      const { data: allMatches, error: allMatchesError } = await supabase
        .from('matches')
        .select('pool_id, home_team, away_team, start_time')
        .limit(10);

      if (allMatchesError) {
        console.error('❌ Erro ao buscar todos os jogos:', allMatchesError);
        return;
      }

      console.log(`📊 Total de jogos na tabela: ${allMatches?.length || 0}`);
      if (allMatches && allMatches.length > 0) {
        allMatches.forEach((match, index) => {
          console.log(`   ${index + 1}. Pool ${match.pool_id}: ${match.home_team} vs ${match.away_team}`);
        });
      }
    }

    // Verificar usuários
    console.log('\n👥 Verificando usuários...');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .limit(5);

    if (usersError) {
      console.error('❌ Erro ao buscar usuários:', usersError);
    } else {
      console.log(`📊 Usuários encontrados: ${users?.length || 0}`);
      if (users && users.length > 0) {
        users.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.display_name} - ID: ${user.id}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugMatches().catch(console.error);