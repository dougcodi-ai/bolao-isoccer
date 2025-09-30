require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyChampionshipMigration() {
  try {
    console.log('🚀 Aplicando migração do campo championship...');
    
    // Passo 1: Tentar adicionar a coluna usando uma query direta
    console.log('📝 Passo 1: Adicionando coluna championship...');
    
    // Como não podemos usar ALTER TABLE diretamente, vamos tentar um approach diferente
    // Primeiro, vamos verificar se conseguimos fazer um INSERT com o campo championship
    
    // Vamos criar um pool temporário para testar se o campo existe
    const testPoolData = {
      name: 'Test Championship Pool',
      code: 'TEST' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      owner_id: '07e9fde0-6ab3-487a-871e-b861206736b7', // ID do usuário existente
      championship: 'Brasileirão Série A'
    };
    
    console.log('🧪 Testando inserção com campo championship...');
    const { data: insertData, error: insertError } = await supabase
      .from('pools')
      .insert([testPoolData])
      .select();
    
    if (insertError) {
      if (insertError.message.includes('column "championship" does not exist')) {
        console.log('⚠️ Campo championship não existe. Precisa ser adicionado via Supabase Dashboard.');
        console.log('📋 Execute este SQL no Supabase Dashboard:');
        console.log('ALTER TABLE public.pools ADD COLUMN championship text;');
        console.log('CREATE INDEX IF NOT EXISTS idx_pools_championship ON public.pools(championship);');
        return false;
      } else {
        console.error('❌ Erro ao inserir pool de teste:', insertError);
        return false;
      }
    }
    
    console.log('✅ Campo championship existe! Pool de teste criado:', insertData[0].id);
    
    // Passo 2: Atualizar pools existentes
    console.log('\n📝 Passo 2: Atualizando pools existentes...');
    
    // Buscar todos os pools sem championship
    const { data: existingPools, error: fetchError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .is('championship', null);
    
    if (fetchError) {
      console.error('❌ Erro ao buscar pools existentes:', fetchError);
      return false;
    }
    
    console.log(`📊 Encontrados ${existingPools.length} pools sem championship definido`);
    
    // Atualizar cada pool baseado no nome
    for (const pool of existingPools) {
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
      }
      
      const { error: updateError } = await supabase
        .from('pools')
        .update({ championship })
        .eq('id', pool.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar pool ${pool.name}:`, updateError);
      } else {
        console.log(`✅ Pool "${pool.name}" atualizado para: ${championship}`);
      }
    }
    
    // Passo 3: Remover pool de teste
    console.log('\n🧹 Passo 3: Removendo pool de teste...');
    const { error: deleteError } = await supabase
      .from('pools')
      .delete()
      .eq('id', insertData[0].id);
    
    if (deleteError) {
      console.error('❌ Erro ao remover pool de teste:', deleteError);
    } else {
      console.log('✅ Pool de teste removido');
    }
    
    // Passo 4: Verificar resultado final
    console.log('\n🔍 Passo 4: Verificando resultado final...');
    const { data: finalPools, error: finalError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(10);
    
    if (finalError) {
      console.error('❌ Erro ao verificar resultado:', finalError);
      return false;
    }
    
    console.log('📊 Pools atualizados:');
    finalPools.forEach((pool, index) => {
      console.log(`  ${index + 1}. ${pool.name} - ${pool.championship || 'Não definido'}`);
    });
    
    console.log('\n🎉 Migração concluída com sucesso!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

applyChampionshipMigration();