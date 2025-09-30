const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function syncTeamsFromHighlightly() {
  console.log('🔄 Sincronizando times e logos da API Highlightly...\n');

  const apiKey = process.env.RAPIDAPI_KEY;
  const baseURL = 'https://sport-highlights-api.p.rapidapi.com/football';
  
  if (!apiKey || apiKey === 'your_rapidapi_key_here') {
    console.error('❌ RAPIDAPI_KEY não encontrada ou não configurada no .env.local');
    console.log('💡 Configure sua chave da RapidAPI no arquivo .env.local');
    return;
  }

  const headers = {
    'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com',
    'x-rapidapi-key': apiKey
  };

  try {
    // 1. Buscar times do Brasileirão Série A (2025)
    console.log('1️⃣ Buscando times do Brasileirão Série A 2025...');
    
    const serieAResponse = await axios.get(`${baseURL}/matches`, {
      headers,
      params: {
        leagueId: 61205, // Brasileirão Série A
        season: 2025,
        offset: 0,
        limit: 100
      }
    });

    const serieAMatches = serieAResponse.data.data || [];
    console.log(`✅ Encontradas ${serieAMatches.length} partidas da Série A`);

    // 2. Buscar times do Brasileirão Série B (2025)
    console.log('\n2️⃣ Buscando times do Brasileirão Série B 2025...');
    
    const serieBResponse = await axios.get(`${baseURL}/matches`, {
      headers,
      params: {
        leagueId: 62056, // Brasileirão Série B
        season: 2025,
        offset: 0,
        limit: 100
      }
    });

    const serieBMatches = serieBResponse.data.data || [];
    console.log(`✅ Encontradas ${serieBMatches.length} partidas da Série B`);

    // 3. Extrair times únicos de todas as partidas
    console.log('\n3️⃣ Extraindo times únicos...');
    
    const allMatches = [...serieAMatches, ...serieBMatches];
    const teamsMap = new Map();
    
    allMatches.forEach(match => {
      // Time da casa
      if (match.homeTeam) {
        teamsMap.set(match.homeTeam.id, {
          id: match.homeTeam.id,
          name: match.homeTeam.name,
          shortName: match.homeTeam.shortName || match.homeTeam.name,
          logo: match.homeTeam.logo,
          acronym: match.homeTeam.acronym || match.homeTeam.shortName,
          source: 'highlightly'
        });
      }
      
      // Time visitante
      if (match.awayTeam) {
        teamsMap.set(match.awayTeam.id, {
          id: match.awayTeam.id,
          name: match.awayTeam.name,
          shortName: match.awayTeam.shortName || match.awayTeam.name,
          logo: match.awayTeam.logo,
          acronym: match.awayTeam.acronym || match.awayTeam.shortName,
          source: 'highlightly'
        });
      }
    });

    const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    console.log(`✅ Encontrados ${teams.length} times únicos`);

    // 4. Criar mapeamento de logos atualizado
    console.log('\n4️⃣ Criando mapeamento de logos...');
    
    const logoMap = {};
    
    teams.forEach(team => {
      if (team.logo) {
        // Adicionar várias variações do nome para melhor compatibilidade
        const variations = [
          team.name,
          team.shortName,
          team.acronym,
          team.name.toUpperCase(),
          team.shortName?.toUpperCase(),
          team.acronym?.toUpperCase(),
          team.name.toLowerCase(),
          team.shortName?.toLowerCase(),
          team.acronym?.toLowerCase(),
          // Variações específicas para times brasileiros
          team.name.replace(/\s+/g, ' ').trim(),
          team.name.replace(/FC|EC|SC|CR|SE/gi, '').trim(),
          team.name.replace(/\s+(FC|EC|SC|CR|SE)$/gi, '').trim()
        ].filter(Boolean);

        // Remover duplicatas
        const uniqueVariations = [...new Set(variations)];
        
        uniqueVariations.forEach(variation => {
          logoMap[variation] = team.logo;
        });
      }
    });

    console.log(`✅ Criado mapeamento com ${Object.keys(logoMap).length} entradas`);

    // 5. Carregar mapeamento atual e mesclar
    console.log('\n5️⃣ Mesclando com mapeamento existente...');
    
    const logoMapPath = path.join(__dirname, '../../../src/data/teamLogoMap.json');
    let existingLogoMap = {};
    
    try {
      const existingContent = fs.readFileSync(logoMapPath, 'utf8');
      existingLogoMap = JSON.parse(existingContent);
      console.log(`📋 Mapeamento existente carregado com ${Object.keys(existingLogoMap).length} entradas`);
    } catch (error) {
      console.log('⚠️ Mapeamento existente não encontrado, criando novo');
    }

    // Mesclar mapas (novos dados têm prioridade)
    const mergedLogoMap = { ...existingLogoMap, ...logoMap };
    console.log(`✅ Mapeamento mesclado com ${Object.keys(mergedLogoMap).length} entradas totais`);

    // 6. Salvar mapeamento atualizado
    console.log('\n6️⃣ Salvando mapeamento atualizado...');
    
    fs.writeFileSync(logoMapPath, JSON.stringify(mergedLogoMap, null, 2));
    console.log(`✅ Mapeamento salvo em: ${logoMapPath}`);

    // 7. Salvar dados completos dos times
    console.log('\n7️⃣ Salvando dados completos dos times...');
    
    const teamsDataPath = path.join(__dirname, '../../../src/data/teams-highlightly.json');
    const teamsData = {
      timestamp: new Date().toISOString(),
      source: 'sport-highlights-api',
      leagues: {
        'serie-a': {
          id: 61205,
          name: 'Brasileirão Série A',
          season: 2025,
          teams: teams.filter(team => 
            serieAMatches.some(match => 
              match.homeTeam?.id === team.id || match.awayTeam?.id === team.id
            )
          )
        },
        'serie-b': {
          id: 62056,
          name: 'Brasileirão Série B',
          season: 2025,
          teams: teams.filter(team => 
            serieBMatches.some(match => 
              match.homeTeam?.id === team.id || match.awayTeam?.id === team.id
            )
          )
        }
      },
      allTeams: teams,
      totalTeams: teams.length,
      logoMappings: Object.keys(mergedLogoMap).length
    };

    fs.writeFileSync(teamsDataPath, JSON.stringify(teamsData, null, 2));
    console.log(`✅ Dados dos times salvos em: ${teamsDataPath}`);

    // 8. Relatório final
    console.log('\n📊 RELATÓRIO FINAL:');
    console.log(`• Times da Série A: ${teamsData.leagues['serie-a'].teams.length}`);
    console.log(`• Times da Série B: ${teamsData.leagues['serie-b'].teams.length}`);
    console.log(`• Total de times únicos: ${teams.length}`);
    console.log(`• Times com logos: ${teams.filter(t => t.logo).length}`);
    console.log(`• Entradas no mapeamento: ${Object.keys(mergedLogoMap).length}`);

    console.log('\n🏆 Times da Série A 2025:');
    teamsData.leagues['serie-a'].teams.forEach((team, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${team.name} ${team.logo ? '✅' : '❌'}`);
    });

    console.log('\n🥈 Times da Série B 2025:');
    teamsData.leagues['serie-b'].teams.forEach((team, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${team.name} ${team.logo ? '✅' : '❌'}`);
    });

    return {
      success: true,
      totalTeams: teams.length,
      serieATeams: teamsData.leagues['serie-a'].teams.length,
      serieBTeams: teamsData.leagues['serie-b'].teams.length,
      logoMappings: Object.keys(mergedLogoMap).length
    };

  } catch (error) {
    console.error('❌ Erro ao sincronizar times:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      console.log('\n💡 Possíveis soluções:');
      console.log('1. Verificar se a chave da API está correta');
      console.log('2. Verificar se a assinatura da API está ativa');
      console.log('3. Verificar se não excedeu o limite de requisições');
    }
    
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Executar sincronização
syncTeamsFromHighlightly().then(result => {
  if (result?.success) {
    console.log('\n🎯 Sincronização concluída com sucesso!');
  } else {
    console.log('\n❌ Sincronização falhou');
  }
}).catch(console.error);