const axios = require('axios');

async function testSportHighlightsAPI() {
  const apiKey = 'a5fc713fbbmshc9723050504d059p1aedeejsn7641ae079f5d';
  const baseURL = 'https://sport-highlights-api.p.rapidapi.com/football';
  const leagueId = 61205; // Brasileirão Série A
  
  const headers = {
    'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
    'x-rapidapi-key': apiKey
  };

  try {
    console.log('🔍 Testando Sport Highlights API...\n');

    // Buscar partidas do Brasileirão 2025
    console.log('📅 Buscando partidas do Brasileirão 2025...');
    const matchesResponse = await axios.get(`${baseURL}/matches`, {
      headers,
      params: {
        leagueId: leagueId,
        season: 2025,
        offset: 0,
        limit: 100
      }
    });

    const matches = matchesResponse.data.data || [];
    console.log(`✅ Encontradas ${matches.length} partidas`);
    console.log(`📊 Total de partidas na liga: ${matchesResponse.data.pagination?.totalCount || 0}\n`);

    // Extrair times únicos das partidas
    const teamsMap = new Map();
    
    matches.forEach(match => {
      // Time da casa
      if (match.homeTeam) {
        teamsMap.set(match.homeTeam.id, {
          id: match.homeTeam.id,
          name: match.homeTeam.name,
          logo: match.homeTeam.logo
        });
      }
      
      // Time visitante
      if (match.awayTeam) {
        teamsMap.set(match.awayTeam.id, {
          id: match.awayTeam.id,
          name: match.awayTeam.name,
          logo: match.awayTeam.logo
        });
      }
    });

    const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    console.log(`🏆 Times encontrados no Brasileirão 2025 (${teams.length} times):`);
    teams.forEach((team, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${team.name} (ID: ${team.id})`);
    });

    console.log('\n📋 Estrutura de uma partida de exemplo:');
    if (matches.length > 0) {
      console.log(JSON.stringify(matches[0], null, 2));
    }

    // Testar endpoint de times diretamente
    console.log('\n🔍 Testando endpoint de times...');
    try {
      const teamsResponse = await axios.get(`${baseURL}/teams`, {
        headers,
        params: {
          offset: 0,
          limit: 50
        }
      });
      
      console.log(`✅ Endpoint de times funcionou. Total: ${teamsResponse.data.pagination?.totalCount || 0} times`);
      console.log('📋 Estrutura de um time de exemplo:');
      if (teamsResponse.data.data && teamsResponse.data.data.length > 0) {
        console.log(JSON.stringify(teamsResponse.data.data[0], null, 2));
      }
    } catch (error) {
      console.log(`❌ Erro no endpoint de times: ${error.response?.data?.message || error.message}`);
    }

    return {
      success: true,
      totalMatches: matchesResponse.data.pagination?.totalCount || 0,
      matchesFetched: matches.length,
      teams: teams,
      teamsCount: teams.length
    };

  } catch (error) {
    console.error('❌ Erro ao testar API:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Executar o teste
testSportHighlightsAPI().then(result => {
  console.log('\n🎯 Resultado do teste:', result);
}).catch(console.error);