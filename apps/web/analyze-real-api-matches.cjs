const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function analyzeRealAPIMatches() {
  console.log('🔍 Analisando jogos reais da API e categorização por campeonato...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Verificar tabela football_matches (jogos reais da API)
    console.log('1️⃣ Verificando tabela football_matches (jogos reais da API)...');
    const { data: footballMatches, error: footballError } = await supabase
      .from('football_matches')
      .select('*')
      .limit(5);

    if (footballError) {
      console.log('❌ Erro ao acessar football_matches:', footballError.message);
    } else if (footballMatches && footballMatches.length > 0) {
      console.log(`✅ Encontrados ${footballMatches.length} jogos reais na tabela football_matches`);
      console.log('📋 Estrutura de um jogo real:');
      console.log(JSON.stringify(footballMatches[0], null, 2));
    } else {
      console.log('⚠️ Nenhum jogo encontrado na tabela football_matches');
    }

    // 2. Verificar tabela football_competitions
    console.log('\n2️⃣ Verificando tabela football_competitions...');
    const { data: competitions, error: compError } = await supabase
      .from('football_competitions')
      .select('*');

    if (compError) {
      console.log('❌ Erro ao acessar football_competitions:', compError.message);
    } else if (competitions && competitions.length > 0) {
      console.log(`✅ Encontradas ${competitions.length} competições:`);
      competitions.forEach((comp, index) => {
        console.log(`   ${index + 1}. ${comp.name} (${comp.code}) - País: ${comp.country}`);
      });
    } else {
      console.log('⚠️ Nenhuma competição encontrada');
    }

    // 3. Verificar tabela football_seasons
    console.log('\n3️⃣ Verificando tabela football_seasons...');
    const { data: seasons, error: seasonError } = await supabase
      .from('football_seasons')
      .select('*, football_competitions(name, code)')
      .order('year', { ascending: false });

    if (seasonError) {
      console.log('❌ Erro ao acessar football_seasons:', seasonError.message);
    } else if (seasons && seasons.length > 0) {
      console.log(`✅ Encontradas ${seasons.length} temporadas:`);
      seasons.forEach((season, index) => {
        console.log(`   ${index + 1}. ${season.football_competitions?.name} ${season.year}`);
      });
    } else {
      console.log('⚠️ Nenhuma temporada encontrada');
    }

    // 4. Verificar relação entre football_matches e competitions
    console.log('\n4️⃣ Verificando relação entre jogos reais e competições...');
    const { data: matchesWithCompetitions, error: matchCompError } = await supabase
      .from('football_matches')
      .select(`
        id,
        start_time,
        status,
        home_score,
        away_score,
        football_competitions(name, code, country),
        football_seasons(year),
        home_team:football_teams!home_team_id(name, short_name),
        away_team:football_teams!away_team_id(name, short_name)
      `)
      .limit(10);

    if (matchCompError) {
      console.log('❌ Erro ao buscar jogos com competições:', matchCompError.message);
    } else if (matchesWithCompetitions && matchesWithCompetitions.length > 0) {
      console.log(`✅ Encontrados ${matchesWithCompetitions.length} jogos reais com competições:`);
      matchesWithCompetitions.forEach((match, index) => {
        console.log(`   ${index + 1}. ${match.home_team?.name || 'Time A'} vs ${match.away_team?.name || 'Time B'}`);
        console.log(`      Competição: ${match.football_competitions?.name} (${match.football_competitions?.code})`);
        console.log(`      Temporada: ${match.football_seasons?.year}`);
        console.log(`      Data: ${new Date(match.start_time).toLocaleDateString('pt-BR')}`);
        console.log('');
      });
    } else {
      console.log('⚠️ Nenhum jogo real encontrado com competições');
    }

    // 5. Verificar como pools se relacionam com jogos reais
    console.log('\n5️⃣ Verificando relação entre pools e jogos reais...');
    const { data: poolsData, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(5);

    if (poolsError && /column .*championship.* does not exist/i.test(poolsError.message)) {
      console.log('⚠️ Campo championship não existe na tabela pools');
      const { data: poolsWithoutChamp } = await supabase
        .from('pools')
        .select('id, name')
        .limit(5);
      console.log('📋 Pools existentes (sem campo championship):');
      poolsWithoutChamp?.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.name} (ID: ${pool.id})`);
      });
    } else if (poolsData && poolsData.length > 0) {
      console.log('📋 Pools com campo championship:');
      poolsData.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.name} - Championship: ${pool.championship || 'Não definido'}`);
      });
    }

    // 6. Verificar tabela matches (jogos dos pools)
    console.log('\n6️⃣ Verificando tabela matches (jogos dos pools)...');
    const { data: poolMatches, error: poolMatchError } = await supabase
      .from('matches')
      .select('id, pool_id, home_team, away_team, start_time, status')
      .limit(5);

    if (poolMatchError) {
      console.log('❌ Erro ao acessar matches:', poolMatchError.message);
    } else if (poolMatches && poolMatches.length > 0) {
      console.log(`✅ Encontrados ${poolMatches.length} jogos na tabela matches (pools)`);
      console.log('📋 Estrutura de um jogo de pool:');
      console.log(JSON.stringify(poolMatches[0], null, 2));
    } else {
      console.log('⚠️ Nenhum jogo encontrado na tabela matches');
    }

    console.log('\n🎯 ANÁLISE CONCLUÍDA');
    console.log('=====================================');
    console.log('Para resolver o problema dos jogos reais por campeonato:');
    console.log('1. Os jogos reais estão na tabela football_matches');
    console.log('2. As competições estão na tabela football_competitions');
    console.log('3. Os pools precisam ser associados às competições corretas');
    console.log('4. A lógica de filtragem deve usar football_matches ao invés de matches');

  } catch (error) {
    console.error('❌ Erro durante análise:', error.message);
  }
}

analyzeRealAPIMatches();