const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkMatchesStructure() {
  console.log('🔍 Verificando estrutura da tabela matches...');
  
  try {
    // Verificar estrutura da tabela matches usando RPC
    const { data: columns, error: columnsError } = await supabase.rpc('exec', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'matches'
        ORDER BY ordinal_position;
      `
    });
    
    if (columnsError) {
      console.error('❌ Erro ao verificar estrutura:', columnsError);
      
      // Método alternativo: tentar buscar um jogo para ver a estrutura
      console.log('🔄 Tentando método alternativo...');
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .limit(1);
      
      if (matchesError) {
        console.error('❌ Erro ao buscar jogos:', matchesError);
        return;
      }
      
      if (matches && matches.length > 0) {
        console.log('📊 Estrutura da tabela matches (baseada em dados):');
        Object.keys(matches[0]).forEach(key => {
          console.log(`  - ${key}: ${typeof matches[0][key]}`);
        });
        
        // Verificar se championship já existe
        const hasChampionship = Object.keys(matches[0]).includes('championship');
        if (hasChampionship) {
          console.log('\n✅ Campo championship já existe na tabela matches!');
        } else {
          console.log('\n❌ Campo championship não existe na tabela matches.');
        }
      }
      return;
    }
    
    console.log('📊 Estrutura da tabela matches:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Verificar se championship já existe
    const hasChampionship = columns.some(col => col.column_name === 'championship');
    if (hasChampionship) {
      console.log('\n✅ Campo championship já existe na tabela matches!');
    } else {
      console.log('\n❌ Campo championship não existe na tabela matches.');
    }
    
    // Verificar alguns jogos existentes
    console.log('\n🎮 Verificando jogos existentes...');
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .limit(3);
    
    if (matchesError) {
      console.error('❌ Erro ao buscar jogos:', matchesError);
    } else {
      console.log(`📊 Encontrados ${matches.length} jogos`);
      if (matches.length > 0) {
        console.log('📋 Exemplo de jogo:');
        console.log(`  - ID: ${matches[0].id}`);
        console.log(`  - Pool ID: ${matches[0].pool_id}`);
        console.log(`  - Times: ${matches[0].home_team} vs ${matches[0].away_team}`);
        console.log(`  - Data: ${matches[0].start_time}`);
        console.log(`  - Championship: ${matches[0].championship || 'Não definido'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMatchesStructure();