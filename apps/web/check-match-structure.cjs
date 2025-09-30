const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkMatchStructure() {
  console.log('🔍 Verificando estrutura completa dos jogos...\n');
  
  try {
    // Buscar um jogo de exemplo para ver todos os campos
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .limit(3);
    
    if (error) {
      console.error('❌ Erro:', error);
      return;
    }
    
    if (matches && matches.length > 0) {
      console.log('📊 Estrutura completa de um jogo:');
      console.log(JSON.stringify(matches[0], null, 2));
      
      console.log('\n🔍 Todos os campos disponíveis:');
      Object.keys(matches[0]).forEach(key => {
        const value = matches[0][key];
        console.log(`   ${key}: ${typeof value} = ${value}`);
      });
      
      // Verificar se há campos relacionados a competição/campeonato
      const competitionFields = Object.keys(matches[0]).filter(key => 
        key.toLowerCase().includes('competition') ||
        key.toLowerCase().includes('league') ||
        key.toLowerCase().includes('tournament') ||
        key.toLowerCase().includes('championship') ||
        key.toLowerCase().includes('round') ||
        key.toLowerCase().includes('season')
      );
      
      console.log('\n🏆 Campos relacionados a campeonato encontrados:');
      if (competitionFields.length > 0) {
        competitionFields.forEach(field => {
          console.log(`   ${field}: ${matches[0][field]}`);
        });
      } else {
        console.log('   ❌ Nenhum campo de campeonato encontrado nos jogos');
      }
      
      // Verificar diferentes jogos para ver variações
      console.log('\n📋 Verificando variações em outros jogos:');
      for (let i = 0; i < Math.min(matches.length, 3); i++) {
        console.log(`\nJogo ${i + 1}: ${matches[i].home_team} vs ${matches[i].away_team}`);
        competitionFields.forEach(field => {
          console.log(`   ${field}: ${matches[i][field]}`);
        });
      }
    }
    
    // Verificar se existe uma tabela de competições separada
    console.log('\n🔍 Verificando se existe tabela de competições...');
    
    try {
      const { data: competitions } = await supabase
        .from('competitions')
        .select('*')
        .limit(5);
      
      if (competitions) {
        console.log('✅ Tabela competitions encontrada:');
        console.log(JSON.stringify(competitions, null, 2));
      }
    } catch (compError) {
      console.log('❌ Tabela competitions não encontrada');
    }
    
    // Verificar tabela leagues
    try {
      const { data: leagues } = await supabase
        .from('leagues')
        .select('*')
        .limit(5);
      
      if (leagues) {
        console.log('✅ Tabela leagues encontrada:');
        console.log(JSON.stringify(leagues, null, 2));
      }
    } catch (leagueError) {
      console.log('❌ Tabela leagues não encontrada');
    }
    
    // Verificar todas as tabelas disponíveis
    console.log('\n📋 Verificando todas as tabelas disponíveis...');
    
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_names');
    
    if (!tablesError && tables) {
      console.log('✅ Tabelas disponíveis:');
      tables.forEach(table => {
        console.log(`   • ${table}`);
      });
    } else {
      // Método alternativo - tentar algumas tabelas comuns
      const commonTables = ['matches', 'pools', 'competitions', 'leagues', 'teams', 'seasons'];
      console.log('🔍 Verificando tabelas comuns:');
      
      for (const tableName of commonTables) {
        try {
          const { data } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (data !== null) {
            console.log(`   ✅ ${tableName} - existe`);
          }
        } catch (err) {
          console.log(`   ❌ ${tableName} - não existe`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMatchStructure();