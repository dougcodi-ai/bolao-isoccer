require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestMatches() {
  console.log('🏟️ Criando partidas de teste...');

  try {
    // Buscar o bolão de teste
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, code')
      .eq('code', '9GSH4Y')
      .single();

    if (poolsError || !pools) {
      console.error('❌ Erro ao buscar bolão de teste:', poolsError);
      return;
    }

    console.log(`✅ Bolão encontrado: ${pools.name} (${pools.code})`);

    // Criar partidas de teste
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const testMatches = [
      {
        pool_id: pools.id,
        home_team: 'Flamengo',
        away_team: 'Palmeiras',
        start_time: tomorrow.toISOString(),
        home_score: null,
        away_score: null
      },
      {
        pool_id: pools.id,
        home_team: 'São Paulo',
        away_team: 'Corinthians',
        start_time: dayAfterTomorrow.toISOString(),
        home_score: null,
        away_score: null
      },
      {
        pool_id: pools.id,
        home_team: 'Santos',
        away_team: 'Grêmio',
        start_time: yesterday.toISOString(),
        home_score: 2,
        away_score: 1
      }
    ];

    // Inserir partidas
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .insert(testMatches)
      .select();

    if (matchesError) {
      console.error('❌ Erro ao criar partidas:', matchesError);
      return;
    }

    console.log(`✅ ${matches.length} partidas criadas com sucesso:`);
    matches.forEach((match, index) => {
      const date = new Date(match.start_time).toLocaleString('pt-BR');
      const status = match.home_score !== null ? 'Finalizada' : 'Agendada';
      console.log(`  ${index + 1}. ${match.home_team} x ${match.away_team} - ${date} (${status})`);
    });

    // Testar busca de partidas
    console.log('\n🔍 Testando busca de partidas...');
    const { data: allMatches, error: searchError } = await supabase
      .from('matches')
      .select('*')
      .eq('pool_id', pools.id)
      .order('start_time', { ascending: true });

    if (searchError) {
      console.error('❌ Erro ao buscar partidas:', searchError);
      return;
    }

    console.log(`✅ Total de partidas no bolão: ${allMatches.length}`);
    
    // Separar partidas futuras e passadas
    const futureMatches = allMatches.filter(match => new Date(match.start_time) > now);
    const pastMatches = allMatches.filter(match => new Date(match.start_time) <= now);

    console.log(`📅 Partidas futuras: ${futureMatches.length}`);
    console.log(`📊 Partidas passadas: ${pastMatches.length}`);

    console.log('\n🎉 Partidas de teste criadas com sucesso!');
    console.log('Agora você pode testar a funcionalidade de palpites na página.');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createTestMatches();