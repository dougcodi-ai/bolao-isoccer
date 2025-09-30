const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createChampionshipPools() {
  console.log('🏆 Criando pools de teste para diferentes campeonatos...\n');
  
  try {
    // Buscar um usuário existente para usar como owner
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .limit(1);
    
    if (userError || !users || users.length === 0) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return;
    }
    
    const user = users[0];
    console.log(`✅ Usuário encontrado: ${user.id} (${user.display_name})`);
    
    // Definir campeonatos para criar
    const championships = [
      {
        name: 'Bolão Teste - Brasileirão Série B 2025',
        code: 'SERIEB25',
        championship: 'Brasileirão Série B'
      },
      {
        name: 'Bolão Teste - Copa do Brasil 2025',
        code: 'COPABR25',
        championship: 'Copa do Brasil'
      },
      {
        name: 'Bolão Teste - Libertadores 2025',
        code: 'LIBERT25',
        championship: 'Libertadores'
      },
      {
        name: 'Bolão Teste - Sul-Americana 2025',
        code: 'SULAME25',
        championship: 'Sul-Americana'
      }
    ];
    
    const createdPools = [];
    
    for (const champ of championships) {
      console.log(`\n🎯 Criando pool: ${champ.name}`);
      
      // Gerar código único
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Criar pool
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: champ.name,
          code: code,
          owner_id: user.id,
          championship: champ.championship,
          premium: false,
          max_members: 50
        })
        .select()
        .single();
      
      if (poolError) {
        console.error(`❌ Erro ao criar pool ${champ.name}:`, poolError);
        continue;
      }
      
      console.log(`✅ Pool criado: ${pool.name} (${pool.code})`);
      
      // Adicionar o criador como membro
      const { error: memberError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: user.id,
          role: 'owner'
        });
      
      if (memberError) {
        console.error(`❌ Erro ao adicionar membro ao pool ${pool.code}:`, memberError);
      } else {
        console.log(`✅ Usuário adicionado como owner do pool ${pool.code}`);
      }
      
      createdPools.push({
        ...pool,
        championship: champ.championship
      });
    }
    
    console.log('\n📊 Resumo dos pools criados:');
    createdPools.forEach((pool, index) => {
      console.log(`  ${index + 1}. ${pool.name}`);
      console.log(`     Código: ${pool.code}`);
      console.log(`     Campeonato: ${pool.championship}`);
      console.log(`     ID: ${pool.id}`);
      console.log('');
    });
    
    console.log('🎉 Pools de teste criados com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('1. Adicionar jogos específicos para cada campeonato');
    console.log('2. Modificar lógica de carregamento para filtrar por campeonato');
    console.log('3. Testar funcionamento completo');
    
    return createdPools;
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createChampionshipPools();