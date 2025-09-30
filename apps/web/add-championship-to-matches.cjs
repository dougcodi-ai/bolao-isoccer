const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addChampionshipToMatches() {
  console.log('🏆 Adicionando campo championship à tabela matches...\n');
  
  try {
    // 1. Adicionar coluna championship à tabela matches
    console.log('1️⃣ Adicionando coluna championship...');
    const { data: addColumnData, error: addColumnError } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE matches 
        ADD COLUMN IF NOT EXISTS championship TEXT;
      `
    });
    
    if (addColumnError) {
      console.error('❌ Erro ao adicionar coluna:', addColumnError);
      
      // Tentar método alternativo usando SQL direto
      console.log('🔄 Tentando método alternativo...');
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('championship')
          .limit(1);
        
        if (error && error.message.includes('column "championship" does not exist')) {
          console.log('⚠️ Coluna championship não existe. Será necessário adicionar via SQL.');
          console.log('📝 Execute este SQL no Supabase Dashboard:');
          console.log('ALTER TABLE matches ADD COLUMN championship TEXT;');
          return;
        } else if (!error) {
          console.log('✅ Coluna championship já existe!');
        }
      } catch (testError) {
        console.error('❌ Erro ao testar coluna:', testError);
        return;
      }
    } else {
      console.log('✅ Coluna championship adicionada com sucesso!');
    }
    
    // 2. Atualizar jogos existentes com championship baseado no pool
    console.log('\n2️⃣ Atualizando jogos existentes com championship...');
    
    // Buscar todos os jogos com informação do pool
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        pool_id,
        championship,
        pools!inner(championship)
      `);
    
    if (matchesError) {
      console.error('❌ Erro ao buscar jogos:', matchesError);
      return;
    }
    
    console.log(`📊 Encontrados ${matches?.length || 0} jogos para atualizar`);
    
    if (matches && matches.length > 0) {
      let updatedCount = 0;
      
      for (const match of matches) {
        // Se o jogo não tem championship ou é diferente do pool
        if (!match.championship || match.championship !== match.pools.championship) {
          const { error: updateError } = await supabase
            .from('matches')
            .update({ championship: match.pools.championship })
            .eq('id', match.id);
          
          if (updateError) {
            console.error(`❌ Erro ao atualizar jogo ${match.id}:`, updateError);
          } else {
            updatedCount++;
          }
        }
      }
      
      console.log(`✅ ${updatedCount} jogos atualizados com championship`);
    }
    
    // 3. Verificar resultado final
    console.log('\n3️⃣ Verificando resultado final...');
    
    const { data: finalCheck, error: finalError } = await supabase
      .from('matches')
      .select(`
        championship,
        pools!inner(championship)
      `)
      .limit(5);
    
    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError);
    } else {
      console.log('📊 Amostra de jogos atualizados:');
      finalCheck?.forEach((match, index) => {
        console.log(`  ${index + 1}. Match championship: ${match.championship}, Pool championship: ${match.pools.championship}`);
      });
    }
    
    console.log('\n🎉 Campo championship adicionado à tabela matches com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

addChampionshipToMatches();