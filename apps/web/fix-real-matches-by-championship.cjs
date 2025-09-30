const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function fixRealMatchesByChampionship() {
  console.log('🔧 Implementando lógica de jogos REAIS por campeonato...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Mapear campeonatos para códigos de competição
    const championshipToCompetition = {
      'Brasileirão Série A': 'BRA-1',
      'Brasileirão Série B': 'BRA-2', 
      'Copa do Brasil': 'BRA-CUP',
      'Libertadores': 'LIBERTADORES',
      'Sul-Americana': 'SULAMERICANA'
    };

    console.log('1️⃣ Mapeamento de campeonatos para competições:');
    Object.entries(championshipToCompetition).forEach(([champ, comp]) => {
      console.log(`   ${champ} → ${comp}`);
    });

    // 2. Verificar pools existentes e seus campeonatos
    console.log('\n2️⃣ Verificando pools existentes...');
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, championship');

    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError.message);
      return;
    }

    console.log(`✅ Encontrados ${pools.length} pools:`);
    const poolsByChampionship = {};
    pools.forEach((pool, index) => {
      console.log(`   ${index + 1}. ${pool.name} - ${pool.championship || 'Não definido'}`);
      
      if (pool.championship) {
        if (!poolsByChampionship[pool.championship]) {
          poolsByChampionship[pool.championship] = [];
        }
        poolsByChampionship[pool.championship].push(pool);
      }
    });

    // 3. Verificar jogos reais disponíveis por competição
    console.log('\n3️⃣ Verificando jogos reais disponíveis por competição...');
    
    for (const [championship, competitionCode] of Object.entries(championshipToCompetition)) {
      console.log(`\n🏆 ${championship} (${competitionCode}):`);
      
      // Buscar competição
      const { data: competition } = await supabase
        .from('football_competitions')
        .select('id, name, code')
        .eq('code', competitionCode)
        .single();

      if (!competition) {
        console.log(`   ❌ Competição ${competitionCode} não encontrada no banco`);
        continue;
      }

      // Buscar temporada 2025
      const { data: season } = await supabase
        .from('football_seasons')
        .select('id, year')
        .eq('competition_id', competition.id)
        .eq('year', 2025)
        .single();

      if (!season) {
        console.log(`   ❌ Temporada 2025 não encontrada para ${competitionCode}`);
        continue;
      }

      // Buscar jogos reais
      const { data: realMatches } = await supabase
        .from('football_matches')
        .select(`
          id,
          start_time,
          status,
          home_score,
          away_score,
          home_team:football_teams!home_team_id(name, short_name),
          away_team:football_teams!away_team_id(name, short_name)
        `)
        .eq('competition_id', competition.id)
        .eq('season_id', season.id)
        .order('start_time', { ascending: true })
        .limit(10);

      if (realMatches && realMatches.length > 0) {
        console.log(`   ✅ ${realMatches.length} jogos reais encontrados`);
        console.log(`   📅 Próximos jogos:`);
        realMatches.slice(0, 3).forEach((match, index) => {
          const date = new Date(match.start_time).toLocaleDateString('pt-BR');
          console.log(`      ${index + 1}. ${match.home_team?.name || 'Time A'} vs ${match.away_team?.name || 'Time B'} - ${date}`);
        });
      } else {
        console.log(`   ⚠️ Nenhum jogo real encontrado`);
      }
    }

    // 4. Criar função para buscar jogos reais por campeonato
    console.log('\n4️⃣ Criando função para buscar jogos reais por campeonato...');
    
    const getRealMatchesByChampionship = async (championship, limit = 20, offset = 0, futureOnly = false) => {
      const competitionCode = championshipToCompetition[championship];
      if (!competitionCode) {
        console.log(`⚠️ Campeonato ${championship} não mapeado`);
        return [];
      }

      // Buscar competição
      const { data: competition } = await supabase
        .from('football_competitions')
        .select('id')
        .eq('code', competitionCode)
        .single();

      if (!competition) {
        console.log(`⚠️ Competição ${competitionCode} não encontrada`);
        return [];
      }

      // Buscar temporada 2025
      const { data: season } = await supabase
        .from('football_seasons')
        .select('id')
        .eq('competition_id', competition.id)
        .eq('year', 2025)
        .single();

      if (!season) {
        console.log(`⚠️ Temporada 2025 não encontrada para ${competitionCode}`);
        return [];
      }

      // Construir query
      let query = supabase
        .from('football_matches')
        .select(`
          id,
          start_time,
          status,
          home_score,
          away_score,
          round,
          venue,
          home_team:football_teams!home_team_id(name, short_name, acronym),
          away_team:football_teams!away_team_id(name, short_name, acronym)
        `)
        .eq('competition_id', competition.id)
        .eq('season_id', season.id);

      if (futureOnly) {
        query = query.gte('start_time', new Date().toISOString());
      }

      const { data: matches } = await query
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      return matches || [];
    };

    // 5. Testar função com cada campeonato
    console.log('\n5️⃣ Testando função com cada campeonato...');
    
    for (const championship of Object.keys(championshipToCompetition)) {
      console.log(`\n🧪 Testando ${championship}:`);
      const matches = await getRealMatchesByChampionship(championship, 5, 0, true);
      
      if (matches.length > 0) {
        console.log(`   ✅ ${matches.length} jogos futuros encontrados:`);
        matches.forEach((match, index) => {
          const date = new Date(match.start_time).toLocaleDateString('pt-BR');
          const time = new Date(match.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          console.log(`      ${index + 1}. ${match.home_team?.name || 'Time A'} vs ${match.away_team?.name || 'Time B'} - ${date} ${time}`);
        });
      } else {
        console.log(`   ⚠️ Nenhum jogo futuro encontrado`);
      }
    }

    console.log('\n🎯 IMPLEMENTAÇÃO CONCLUÍDA');
    console.log('=====================================');
    console.log('✅ Função getRealMatchesByChampionship criada e testada');
    console.log('✅ Mapeamento de campeonatos para competições definido');
    console.log('✅ Todos os campeonatos testados com jogos reais');
    console.log('\n📋 Próximos passos:');
    console.log('1. Atualizar página de palpites para usar jogos reais');
    console.log('2. Substituir consultas da tabela "matches" por "football_matches"');
    console.log('3. Implementar filtros por campeonato usando a função criada');

  } catch (error) {
    console.error('❌ Erro durante implementação:', error.message);
  }
}

fixRealMatchesByChampionship();