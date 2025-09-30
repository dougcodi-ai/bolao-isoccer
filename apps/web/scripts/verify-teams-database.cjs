const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyTeamsInDatabase() {
  console.log('🔍 Verificando times e logos no banco de dados...\n');

  try {
    // 1. Verificar se existe tabela de times
    console.log('1️⃣ Verificando estrutura de tabelas...');
    
    // Tentar acessar diretamente a tabela teams
    let hasTeamsTable = false;
    try {
      const { data: teamsTest, error: teamsTestError } = await supabase
        .from('teams')
        .select('*')
        .limit(1);
      
      if (!teamsTestError) {
        hasTeamsTable = true;
        console.log('✅ Tabela "teams" encontrada');
      }
    } catch (error) {
      console.log('⚠️ Tabela "teams" não encontrada');
    }

    // 2. Verificar tabela matches para extrair times únicos
    console.log('\n2️⃣ Verificando times nas partidas...');
    
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('home_team, away_team')
      .limit(1000);

    if (matchesError) {
      console.error('❌ Erro ao buscar partidas:', matchesError);
      return;
    }

    // Extrair times únicos
    const teamsSet = new Set();
    matches?.forEach(match => {
      if (match.home_team) teamsSet.add(match.home_team);
      if (match.away_team) teamsSet.add(match.away_team);
    });

    const uniqueTeams = Array.from(teamsSet).sort();
    console.log(`✅ Encontrados ${uniqueTeams.length} times únicos nas partidas`);
    console.log('🏆 Times encontrados:');
    uniqueTeams.forEach((team, index) => {
      console.log(`${(index + 1).toString().padStart(2, '0')}. ${team}`);
    });

    // 3. Verificar mapeamento de logos atual
    console.log('\n3️⃣ Verificando mapeamento de logos...');
    
    const fs = require('fs');
    const path = require('path');
    const logoMapPath = path.join(__dirname, '../../../src/data/teamLogoMap.json');
    
    let teamLogoMap = {};
    try {
      const logoMapContent = fs.readFileSync(logoMapPath, 'utf8');
      teamLogoMap = JSON.parse(logoMapContent);
      console.log(`📋 Arquivo teamLogoMap.json encontrado com ${Object.keys(teamLogoMap).length} entradas`);
    } catch (error) {
      console.log('⚠️ Arquivo teamLogoMap.json não encontrado ou inválido');
    }

    // 4. Verificar cobertura de logos
    console.log('\n4️⃣ Verificando cobertura de logos...');
    
    const teamsWithLogos = [];
    const teamsWithoutLogos = [];

    uniqueTeams.forEach(team => {
      const normalizedTeam = team.toUpperCase().trim();
      const hasLogo = teamLogoMap[normalizedTeam] || 
                     teamLogoMap[team] || 
                     teamLogoMap[team.toLowerCase()] ||
                     teamLogoMap[team.toUpperCase()];
      
      if (hasLogo) {
        teamsWithLogos.push({ team, logo: hasLogo });
      } else {
        teamsWithoutLogos.push(team);
      }
    });

    console.log(`✅ Times com logos: ${teamsWithLogos.length}/${uniqueTeams.length} (${((teamsWithLogos.length/uniqueTeams.length)*100).toFixed(1)}%)`);
    console.log(`❌ Times sem logos: ${teamsWithoutLogos.length}`);

    if (teamsWithoutLogos.length > 0) {
      console.log('\n🚨 Times sem logos:');
      teamsWithoutLogos.forEach((team, index) => {
        console.log(`${(index + 1).toString().padStart(2, '0')}. ${team}`);
      });
    }

    // 5. Verificar dados na tabela teams (se existir)
    console.log('\n5️⃣ Verificando dados na tabela teams...');
    
    if (hasTeamsTable) {
      const { data: teamsTable, error: teamsTableError } = await supabase
        .from('teams')
        .select('*')
        .limit(5);

      if (!teamsTableError && teamsTable && teamsTable.length > 0) {
        console.log(`✅ Tabela "teams" contém ${teamsTable.length} registros (amostra)`);
        console.log('📋 Estrutura da tabela teams:', Object.keys(teamsTable[0] || {}));
      } else {
        console.log('⚠️ Tabela "teams" existe mas está vazia');
      }
    } else {
      console.log('⚠️ Tabela "teams" não existe');
      console.log('💡 Recomendação: Criar tabela de times para armazenar dados da API Highlightly');
    }

    // 6. Verificar dados da API Highlightly
    console.log('\n6️⃣ Verificando dados da API Highlightly...');
    
    const highlightlyResponsePath = path.join(__dirname, '../../../leagues-highlightly-response.json');
    try {
      const highlightlyData = JSON.parse(fs.readFileSync(highlightlyResponsePath, 'utf8'));
      console.log('✅ Dados da API Highlightly encontrados');
      console.log(`📊 Campeonatos disponíveis: ${highlightlyData.relevant_leagues?.length || 0}`);
      
      if (highlightlyData.relevant_leagues) {
        console.log('🏆 Campeonatos brasileiros disponíveis:');
        highlightlyData.relevant_leagues.forEach((league, index) => {
          console.log(`${(index + 1).toString().padStart(2, '0')}. ${league.name} (ID: ${league.id})`);
        });
      }
    } catch (error) {
      console.log('⚠️ Dados da API Highlightly não encontrados');
      console.log('💡 Execute o script test-api.js para obter dados da API');
    }

    // 7. Resumo e recomendações
    console.log('\n📊 RESUMO:');
    console.log(`• Times únicos encontrados: ${uniqueTeams.length}`);
    console.log(`• Times com logos: ${teamsWithLogos.length} (${((teamsWithLogos.length/uniqueTeams.length)*100).toFixed(1)}%)`);
    console.log(`• Times sem logos: ${teamsWithoutLogos.length}`);
    console.log(`• Tabela de times: ${hasTeamsTable ? 'Existe' : 'Não existe'}`);

    console.log('\n💡 RECOMENDAÇÕES:');
    if (teamsWithoutLogos.length > 0) {
      console.log('1. Atualizar teamLogoMap.json com logos dos times faltantes');
    }
    if (!hasTeamsTable) {
      console.log('2. Criar tabela "teams" para armazenar dados da API Highlightly');
    }
    console.log('3. Implementar sincronização automática com API Highlightly');
    console.log('4. Implementar cache local de logos para performance');

    return {
      totalTeams: uniqueTeams.length,
      teamsWithLogos: teamsWithLogos.length,
      teamsWithoutLogos: teamsWithoutLogos.length,
      coveragePercentage: ((teamsWithLogos.length/uniqueTeams.length)*100).toFixed(1),
      missingTeams: teamsWithoutLogos,
      hasTeamsTable: hasTeamsTable
    };

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar verificação
verifyTeamsInDatabase().then(result => {
  if (result) {
    console.log('\n🎯 Verificação concluída!');
  }
}).catch(console.error);