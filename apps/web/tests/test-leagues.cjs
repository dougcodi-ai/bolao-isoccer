const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testHighlightlyAPI() {
  console.log('🔍 Testando API Sport Highlights para listar campeonatos...\n');

  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  const baseUrl = process.env.HIGHLIGHTLY_BASE_URL || "https://football-highlights-api.p.rapidapi.com/football";
  
  if (!apiKey) {
    console.error('❌ HIGHLIGHTLY_API_KEY não encontrada no .env');
    return;
  }

  const headers = {
    "X-API-Key": apiKey,
    "x-rapidapi-key": apiKey,
    "Accept": "application/json",
  };
  
  if (process.env.HIGHLIGHTLY_RAPIDAPI_HOST) {
    headers["x-rapidapi-host"] = process.env.HIGHLIGHTLY_RAPIDAPI_HOST;
  }

  const client = axios.create({ 
    baseURL: baseUrl, 
    headers, 
    timeout: 15000 
  });

  try {
    console.log('📡 Fazendo chamada para /leagues...');
    const response = await client.get('/leagues');
    const data = response.data;
    
    console.log('✅ Resposta recebida!');
    console.log('📊 Estrutura da resposta:', Object.keys(data));
    
    const leagues = data?.leagues || data?.data || data || [];
    console.log(`\n🏆 Total de campeonatos encontrados: ${leagues.length}\n`);
    
    // Filtrar campeonatos relevantes
    const relevantLeagues = leagues.filter(league => {
      const name = (league?.name || league?.displayName || '').toLowerCase();
      const country = (league?.country?.name || league?.countryName || '').toLowerCase();
      
      return (
        // Copa do Mundo 2026
        (name.includes('world cup') && name.includes('2026')) ||
        (name.includes('copa do mundo') && name.includes('2026')) ||
        // Campeonatos brasileiros
        (country.includes('brazil') || country.includes('brasil')) ||
        // Campeonatos estaduais específicos
        name.includes('paulista') ||
        name.includes('carioca') ||
        name.includes('paulistão') ||
        name.includes('cariocão')
      );
    });

    console.log('🎯 Campeonatos relevantes encontrados:');
    console.log('=' .repeat(80));
    
    relevantLeagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league?.name || league?.displayName || 'Nome não disponível'}`);
      console.log(`   ID: ${league?.id || league?.leagueId || 'N/A'}`);
      console.log(`   País: ${league?.country?.name || league?.countryName || 'N/A'}`);
      console.log(`   Temporada: ${league?.season || league?.currentSeason || 'N/A'}`);
      if (league?.logo) console.log(`   Logo: ${league.logo}`);
      console.log('');
    });

    // Mostrar todos os campeonatos para referência
    console.log('\n📋 TODOS OS CAMPEONATOS DISPONÍVEIS:');
    console.log('=' .repeat(80));
    
    leagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league?.name || league?.displayName || 'Nome não disponível'}`);
      console.log(`   ID: ${league?.id || league?.leagueId || 'N/A'}`);
      console.log(`   País: ${league?.country?.name || league?.countryName || 'N/A'}`);
      if (league?.season) console.log(`   Temporada: ${league.season}`);
      console.log('');
    });

    // Salvar resultado em arquivo JSON para análise
    const fs = require('fs');
    fs.writeFileSync('leagues-response.json', JSON.stringify(data, null, 2));
    console.log('💾 Resposta completa salva em leagues-response.json');

  } catch (error) {
    console.error('❌ Erro ao consultar API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    }
  }
}

testHighlightlyAPI();