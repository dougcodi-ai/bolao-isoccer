require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testChampionshipField() {
  try {
    console.log('🧪 Testando funcionalidade do campo championship...');
    
    // 1. Verificar pools existentes
    console.log('\n📊 Verificando pools existentes...');
    const { data: existingPools, error: poolsError } = await supabase
      .from('pools')
      .select('*')
      .limit(5);

    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
      return;
    }

    console.log(`✅ Encontrados ${existingPools?.length || 0} pools`);
    if (existingPools && existingPools.length > 0) {
      existingPools.forEach((pool, index) => {
        console.log(`  ${index + 1}. ${pool.name} (${pool.code}) - Championship: ${pool.championship || 'Não definido'}`);
      });
    }

    // 2. Tentar atualizar um pool com championship (se o campo existir)
    if (existingPools && existingPools.length > 0) {
      const testPool = existingPools[0];
      console.log(`\n🔄 Tentando atualizar pool "${testPool.name}" com championship...`);
      
      const { data: updateData, error: updateError } = await supabase
        .from('pools')
        .update({ championship: 'Brasileirão Série A' })
        .eq('id', testPool.id)
        .select();

      if (updateError) {
        console.error('❌ Erro ao atualizar pool (campo championship provavelmente não existe):', updateError.message);
        
        // Verificar se é erro de coluna inexistente
        if (updateError.message.includes('column "championship" does not exist')) {
          console.log('\n📋 AÇÃO NECESSÁRIA:');
          console.log('1. Acesse o Supabase Dashboard');
          console.log('2. Vá para SQL Editor');
          console.log('3. Execute: ALTER TABLE public.pools ADD COLUMN championship text;');
          console.log('4. Execute novamente este script');
        }
      } else {
        console.log('✅ Pool atualizado com sucesso!');
        console.log('Dados atualizados:', updateData);
      }
    }

    // 3. Testar consulta com championship
    console.log('\n🔍 Testando consulta com campo championship...');
    const { data: poolsWithChampionship, error: queryError } = await supabase
      .from('pools')
      .select('id, name, code, owner_id, championship')
      .limit(3);

    if (queryError) {
      console.error('❌ Erro na consulta com championship:', queryError.message);
      
      if (queryError.message.includes('column "championship" does not exist')) {
        console.log('\n⚠️ Campo championship não existe no banco de dados');
        console.log('📋 Execute o SQL patch para adicionar o campo');
      }
    } else {
      console.log('✅ Consulta com championship funcionando!');
      console.log('Pools com championship:');
      poolsWithChampionship?.forEach((pool, index) => {
        console.log(`  ${index + 1}. ${pool.name} - ${pool.championship || 'Não definido'}`);
      });
    }

    // 4. Simular dados para teste local
    console.log('\n🎭 Simulando dados para teste local...');
    const mockPoolsWithChampionship = [
      {
        id: 'pool-1',
        name: 'Bolão dos Amigos',
        code: 'AMIGOS123',
        owner_id: 'user-1',
        championship: 'Brasileirão Série A'
      },
      {
        id: 'pool-2',
        name: 'Liga Familiar',
        code: 'FAMILIA456',
        owner_id: 'user-2',
        championship: 'Copa do Brasil'
      },
      {
        id: 'pool-3',
        name: 'Bolão da Empresa',
        code: 'EMPRESA789',
        owner_id: 'user-3',
        championship: 'Copa Libertadores'
      }
    ];

    console.log('✅ Dados simulados criados:');
    mockPoolsWithChampionship.forEach((pool, index) => {
      console.log(`  ${index + 1}. ${pool.name} - ${pool.championship}`);
    });

    console.log('\n🎯 Próximos passos:');
    console.log('1. ✅ Interface Pool atualizada com campo championship');
    console.log('2. ✅ Consulta de pools atualizada para incluir championship');
    console.log('3. ⏳ Adicionar campo championship no banco (via Supabase Dashboard)');
    console.log('4. ⏳ Implementar sistema dinâmico de troca de jogos por campeonato');
    console.log('5. ⏳ Verificar logos dos times via API Highlightly');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testChampionshipField();