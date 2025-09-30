// Script para testar API Highlightly e verificar ligas brasileiras
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'sport-highlights-api.p.rapidapi.com';

console.log('🔑 Chave carregada:', RAPIDAPI_KEY ? `${RAPIDAPI_KEY.substring(0, 10)}...` : 'NENHUMA');

if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'your_rapidapi_key_here') {
  console.error('❌ RAPIDAPI_KEY não encontrada ou não configurada no .env.local');
  console.log('Adicione sua chave real da RapidAPI no arquivo .env.local');
  console.log('RAPIDAPI_KEY=sua_chave_real_aqui');
  process.exit(1);
}

async function testHighlightlyAPI() {
  console.log('🔍 Testando API Highlightly...\n');

  try {
    // 1. Testar conexão básica - buscar países
    console.log('1️⃣ Testando conexão - buscando países...');
    const countriesResponse = await fetch('https://sport-highlights-api.p.rapidapi.com/football/countries', {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    if (!countriesResponse.ok) {
      const errorText = await countriesResponse.text();
      console.log('📋 Headers da resposta:', Object.fromEntries(countriesResponse.headers.entries()));
      console.log('📋 Corpo da resposta:', errorText);
      throw new Error(`Erro na API: ${countriesResponse.status} - ${countriesResponse.statusText}`);
    }

    const countries = await countriesResponse.json();
    console.log('✅ Conexão OK!');
    
    // Encontrar Brasil
    const brazil = countries.find(country => 
      country.name?.toLowerCase().includes('brazil') || 
      country.name?.toLowerCase().includes('brasil')
    );
    
    if (brazil) {
      console.log(`🇧🇷 Brasil encontrado: ID ${brazil.id} - ${brazil.name}\n`);
    } else {
      console.log('⚠️ Brasil não encontrado na lista de países\n');
      console.log('Países disponíveis:', countries.slice(0, 10).map(c => c.name));
      return;
    }

    // 2. Buscar ligas brasileiras
    console.log('2️⃣ Buscando ligas brasileiras...');
    const leaguesResponse = await fetch(`https://sport-highlights-api.p.rapidapi.com/football/leagues?countryCode=${brazil.code}&limit=50`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    if (!leaguesResponse.ok) {
      throw new Error(`Erro ao buscar ligas: ${leaguesResponse.status}`);
    }

    const leaguesData = await leaguesResponse.json();
    const leagues = leaguesData.data || leaguesData.leagues || leaguesData || [];
    console.log(`✅ Encontradas ${leagues.length} ligas brasileiras:\n`);

    // Filtrar ligas relevantes
    const relevantLeagues = leagues.filter(league => {
      const name = league.name?.toLowerCase() || '';
      return (
        name.includes('brasileiro') ||
        name.includes('serie a') ||
        name.includes('serie b') ||
        name.includes('copa do brasil') ||
        name.includes('libertadores') ||
        name.includes('sul-americana') ||
        name.includes('sulamericana')
      );
    });

    console.log('🏆 LIGAS RELEVANTES ENCONTRADAS:');
    console.log('=' .repeat(50));
    relevantLeagues.forEach((league, index) => {
      console.log(`${index + 1}. ${league.name}`);
      console.log(`   ID: ${league.id}`);
      console.log(`   Temporada: ${league.season || 'N/A'}`);
      console.log(`   Logo: ${league.logo || 'N/A'}`);
      console.log('');
    });

    // 3. Testar busca de partidas para uma liga
    if (relevantLeagues.length > 0) {
      const testLeague = relevantLeagues[0];
      console.log(`3️⃣ Testando busca de partidas para: ${testLeague.name}`);
      
      const matchesResponse = await fetch(`https://sport-highlights-api.p.rapidapi.com/football/matches?leagueId=${testLeague.id}&limit=10`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST
        }
      });

      if (matchesResponse.ok) {
        const matches = await matchesResponse.json();
        console.log(`✅ Encontradas ${matches.length} partidas`);
        
        if (matches.length > 0) {
          console.log('\n📅 EXEMPLO DE PARTIDA:');
          const match = matches[0];
          console.log(`${match.home_team?.name || 'Time Casa'} vs ${match.away_team?.name || 'Time Visitante'}`);
          console.log(`Data: ${match.date || 'N/A'}`);
          console.log(`Status: ${match.status || 'N/A'}`);
        }
      } else {
        console.log('⚠️ Erro ao buscar partidas');
      }
    }

    // 4. Verificar rate limits
    console.log('\n4️⃣ Informações de Rate Limit:');
    const headers = leaguesResponse.headers;
    console.log(`Requests restantes: ${headers.get('x-ratelimit-requests-remaining') || 'N/A'}`);
    console.log(`Reset em: ${headers.get('x-ratelimit-requests-reset') || 'N/A'}`);

    // Salvar resultado para análise
    const result = {
      timestamp: new Date().toISOString(),
      brazil_id: brazil.id,
      total_leagues: leagues.length,
      relevant_leagues: relevantLeagues,
      api_status: 'success'
    };

    fs.writeFileSync(
      '../../leagues-highlightly-response.json', 
      JSON.stringify(result, null, 2)
    );

    console.log('\n✅ Teste concluído! Resultado salvo em leagues-highlightly-response.json');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    
    // Salvar erro para análise
    const errorResult = {
      timestamp: new Date().toISOString(),
      error: error.message,
      api_status: 'error'
    };

    fs.writeFileSync(
      '../../leagues-highlightly-error.json', 
      JSON.stringify(errorResult, null, 2)
    );
  }
}

// Executar teste
testHighlightlyAPI();