require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChampionshipField() {
  try {
    console.log('🔍 Verificando se o campo championship existe...');
    
    // Tentar fazer uma consulta que inclua o campo championship
    const { data: pools, error: selectError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(1);
    
    if (selectError) {
      console.log('❌ Campo championship não existe:', selectError.message);
      
      if (selectError.message.includes("championship")) {
        console.log('\n📋 AÇÃO NECESSÁRIA:');
        console.log('O campo championship precisa ser adicionado manualmente.');
        console.log('');
        console.log('🔧 OPÇÕES:');
        console.log('1. Via Supabase Dashboard (Recomendado):');
        console.log('   - Acesse: https://supabase.com/dashboard');
        console.log('   - Vá para SQL Editor');
        console.log('   - Execute: ALTER TABLE public.pools ADD COLUMN championship text;');
        console.log('');
        console.log('2. Via interface do Supabase:');
        console.log('   - Acesse Table Editor > pools');
        console.log('   - Clique em "Add Column"');
        console.log('   - Nome: championship');
        console.log('   - Tipo: text');
        console.log('   - Nullable: true');
        console.log('');
        console.log('Após adicionar o campo, execute este script novamente.');
        return false;
      }
    } else {
      console.log('✅ Campo championship existe!');
      console.log(`📊 Encontrados ${pools.length} pools`);
      
      if (pools.length > 0) {
        console.log('📋 Exemplo de pool:');
        console.log(`  - ID: ${pools[0].id}`);
        console.log(`  - Nome: ${pools[0].name}`);
        console.log(`  - Championship: ${pools[0].championship || 'Não definido'}`);
      }
      
      // Verificar quantos pools não têm championship definido
      const { data: poolsWithoutChampionship, error: countError } = await supabase
        .from('pools')
        .select('id, name')
        .is('championship', null);
      
      if (!countError) {
        console.log(`\n📊 Pools sem championship: ${poolsWithoutChampionship.length}`);
        
        if (poolsWithoutChampionship.length > 0) {
          console.log('🔧 Pools que precisam ser atualizados:');
          poolsWithoutChampionship.slice(0, 5).forEach((pool, index) => {
            console.log(`  ${index + 1}. ${pool.name}`);
          });
          
          if (poolsWithoutChampionship.length > 5) {
            console.log(`  ... e mais ${poolsWithoutChampionship.length - 5} pools`);
          }
          
          console.log('\n🚀 Executando atualização automática...');
          return await updatePoolsChampionship(poolsWithoutChampionship);
        } else {
          console.log('✅ Todos os pools já têm championship definido!');
          return true;
        }
      } else {
        console.log('❌ Erro ao contar pools sem championship:', countError.message);
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

async function updatePoolsChampionship(pools) {
  try {
    let updatedCount = 0;
    
    for (const pool of pools) {
      let championship = 'Brasileirão Série A'; // Padrão
      
      const poolName = pool.name.toLowerCase();
      if (poolName.includes('brasileirão') || poolName.includes('série a') || poolName.includes('serie a')) {
        championship = 'Brasileirão Série A';
      } else if (poolName.includes('série b') || poolName.includes('serie b')) {
        championship = 'Brasileirão Série B';
      } else if (poolName.includes('copa do brasil') || poolName.includes('copa brasil')) {
        championship = 'Copa do Brasil';
      } else if (poolName.includes('libertadores')) {
        championship = 'Copa Libertadores';
      } else if (poolName.includes('sul-americana') || poolName.includes('sulamericana')) {
        championship = 'Copa Sul-Americana';
      } else if (poolName.includes('estadual')) {
        championship = 'Campeonato Estadual';
      } else if (poolName.includes('champions')) {
        championship = 'UEFA Champions League';
      } else if (poolName.includes('premier')) {
        championship = 'Premier League';
      } else if (poolName.includes('la liga') || poolName.includes('laliga')) {
        championship = 'La Liga';
      }
      
      const { error: updateError } = await supabase
        .from('pools')
        .update({ championship })
        .eq('id', pool.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar pool "${pool.name}":`, updateError.message);
      } else {
        console.log(`✅ "${pool.name}" → ${championship}`);
        updatedCount++;
      }
    }
    
    console.log(`\n🎉 Atualização concluída! ${updatedCount}/${pools.length} pools atualizados.`);
    
    // Verificar resultado final
    const { data: finalCheck, error: finalError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(10);
    
    if (!finalError) {
      console.log('\n📊 Estado final dos pools:');
      finalCheck.forEach((pool, index) => {
        console.log(`  ${index + 1}. ${pool.name} - ${pool.championship || 'Não definido'}`);
      });
    }
    
    return updatedCount === pools.length;
    
  } catch (error) {
    console.error('❌ Erro ao atualizar pools:', error);
    return false;
  }
}

checkChampionshipField();