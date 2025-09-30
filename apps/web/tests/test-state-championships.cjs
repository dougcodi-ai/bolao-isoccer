const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testStateChampionships() {
  console.log('🔍 Testando busca por campeonatos estaduais na API TheSportsDB...\n');

  const apiKey = process.env.TSDB_API_KEY || "123";
  const baseUrl = process.env.TSDB_BASE_URL || "https://www.thesportsdb.com/api/v1/json";
  
  const client = axios.create({ 
    baseURL: baseUrl, 
    timeout: 10000 
  });

  const searchTerms = [
    'São Paulo',
    'Rio de Janeiro', 
    'Paulista',
    'Carioca',
    'Mineiro',
    'Gaúcho',
    'Baiano',
    'Paranaense',
    'Pernambucano',
    'Catarinense',
    'Goiano',
    'Capixaba',
    'Potiguar',
    'Sergipano',
    'Paraibano',
    'Alagoano',
    'Maranhense',
    'Piauiense',
    'Cearense',
    'Acreano',
    'Rondoniense',
    'Tocantinense',
    'Brasiliense',
    'Mato-Grossense',
    'Sul-Mato-Grossense'
  ];

  for (const term of searchTerms) {
    try {
      console.log(`🔍 Buscando por "${term}"...`);
      
      // Busca por nome de liga
      const response = await client.get(`/${apiKey}/search_all_leagues.php?s=${encodeURIComponent(term)}`);
      const data = response.data;
      const leagues = data?.leagues || [];
      
      if (leagues.length > 0) {
        console.log(`✅ Encontradas ${leagues.length} ligas para "${term}":`);
        leagues.forEach((league, index) => {
          console.log(`   ${index + 1}. ${league?.strLeague || 'Nome não disponível'}`);
          console.log(`      ID: ${league?.idLeague || 'N/A'}`);
          console.log(`      País: ${league?.strCountry || 'N/A'}`);
          console.log(`      Esporte: ${league?.strSport || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log(`❌ Nenhuma liga encontrada para "${term}"`);
      }
      
      // Pequena pausa para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Erro ao buscar "${term}":`, error.message);
    }
  }

  // Teste adicional: buscar por "Brazil" para ver se há mais ligas
  try {
    console.log('\n🔍 Buscando todas as ligas com "Brazil" no nome...');
    const response = await client.get(`/${apiKey}/search_all_leagues.php?s=Brazil`);
    const data = response.data;
    const leagues = data?.leagues || [];
    
    console.log(`📊 Total de ligas encontradas com "Brazil": ${leagues.length}`);
    leagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league?.strLeague || 'Nome não disponível'} (ID: ${league?.idLeague})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar "Brazil":', error.message);
  }

  // Teste adicional: buscar por "Campeonato"
  try {
    console.log('\n🔍 Buscando todas as ligas com "Campeonato" no nome...');
    const response = await client.get(`/${apiKey}/search_all_leagues.php?s=Campeonato`);
    const data = response.data;
    const leagues = data?.leagues || [];
    
    console.log(`📊 Total de ligas encontradas com "Campeonato": ${leagues.length}`);
    leagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league?.strLeague || 'Nome não disponível'} (ID: ${league?.idLeague})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar "Campeonato":', error.message);
  }
}

testStateChampionships();