const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function testTheSportsDB() {
  console.log('🔍 Testando API TheSportsDB para campeonatos brasileiros...\n');

  const apiKey = process.env.TSDB_API_KEY || "123";
  const baseUrl = process.env.TSDB_BASE_URL || "https://www.thesportsdb.com/api/v1/json";
  
  const client = axios.create({ 
    baseURL: baseUrl, 
    timeout: 10000 
  });

  try {
    // 1. Buscar todas as ligas do Brasil
    console.log('📡 Buscando todas as ligas do Brasil...');
    const response = await client.get(`/${apiKey}/search_all_leagues.php?c=Brazil`);
    const data = response.data;
    
    console.log('✅ Resposta recebida!');
    console.log('📊 Estrutura da resposta:', Object.keys(data));
    
    const leagues = data?.leagues || [];
    console.log(`\n🏆 Total de ligas brasileiras encontradas: ${leagues.length}\n`);
    
    // Filtrar campeonatos relevantes
    const relevantLeagues = leagues.filter(league => {
      const name = (league?.strLeague || '').toLowerCase();
      
      return (
        // Campeonatos nacionais
        name.includes('serie a') ||
        name.includes('serie b') ||
        name.includes('copa do brasil') ||
        name.includes('brasileiro') ||
        // Campeonatos estaduais
        name.includes('paulista') ||
        name.includes('carioca') ||
        name.includes('paulistão') ||
        name.includes('cariocão') ||
        name.includes('mineiro') ||
        name.includes('gaúcho') ||
        name.includes('gaucho') ||
        name.includes('paranaense') ||
        name.includes('baiano') ||
        name.includes('pernambucano') ||
        name.includes('catarinense') ||
        name.includes('goiano') ||
        name.includes('capixaba') ||
        name.includes('potiguar') ||
        name.includes('sergipano') ||
        name.includes('paraibano') ||
        name.includes('alagoano') ||
        name.includes('maranhense') ||
        name.includes('piauiense') ||
        name.includes('cearense') ||
        name.includes('acreano') ||
        name.includes('rondoniense') ||
        name.includes('tocantinense') ||
        name.includes('brasiliense') ||
        name.includes('mato-grossense') ||
        name.includes('sul-mato-grossense')
      );
    });

    console.log('🎯 Campeonatos relevantes encontrados:');
    console.log('=' .repeat(80));
    
    relevantLeagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league?.strLeague || 'Nome não disponível'}`);
      console.log(`   ID: ${league?.idLeague || 'N/A'}`);
      console.log(`   Esporte: ${league?.strSport || 'N/A'}`);
      console.log(`   País: ${league?.strCountry || 'N/A'}`);
      if (league?.strLogo) console.log(`   Logo: ${league.strLogo}`);
      if (league?.strDescription) console.log(`   Descrição: ${league.strDescription.substring(0, 100)}...`);
      console.log('');
    });

    // Mostrar todas as ligas para referência
    console.log('\n📋 TODAS AS LIGAS BRASILEIRAS:');
    console.log('=' .repeat(80));
    
    leagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league?.strLeague || 'Nome não disponível'}`);
      console.log(`   ID: ${league?.idLeague || 'N/A'}`);
      console.log(`   Esporte: ${league?.strSport || 'N/A'}`);
      console.log('');
    });

    // Salvar resultado em arquivo JSON para análise
    const fs = require('fs');
    fs.writeFileSync('thesportsdb-brazil-leagues.json', JSON.stringify(data, null, 2));
    console.log('💾 Resposta completa salva em thesportsdb-brazil-leagues.json');

    // 2. Testar busca específica por Paulista
    console.log('\n🔍 Testando busca específica por "Paulista"...');
    try {
      const paulistaResponse = await client.get(`/${apiKey}/search_all_leagues.php?s=Paulista`);
      const paulistaData = paulistaResponse.data;
      const paulistaLeagues = paulistaData?.leagues || [];
      
      console.log(`📊 Ligas encontradas com "Paulista": ${paulistaLeagues.length}`);
      paulistaLeagues.forEach((league, index) => {
        console.log(`${index + 1}. ${league?.strLeague || 'Nome não disponível'} (ID: ${league?.idLeague})`);
      });
    } catch (error) {
      console.error('❌ Erro na busca por Paulista:', error.message);
    }

    // 3. Testar busca específica por Carioca
    console.log('\n🔍 Testando busca específica por "Carioca"...');
    try {
      const cariocaResponse = await client.get(`/${apiKey}/search_all_leagues.php?s=Carioca`);
      const cariocaData = cariocaResponse.data;
      const cariocaLeagues = cariocaData?.leagues || [];
      
      console.log(`📊 Ligas encontradas com "Carioca": ${cariocaLeagues.length}`);
      cariocaLeagues.forEach((league, index) => {
        console.log(`${index + 1}. ${league?.strLeague || 'Nome não disponível'} (ID: ${league?.idLeague})`);
      });
    } catch (error) {
      console.error('❌ Erro na busca por Carioca:', error.message);
    }

  } catch (error) {
    console.error('❌ Erro ao consultar API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    }
  }
}

testTheSportsDB();