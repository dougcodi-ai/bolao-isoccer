require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUserPools() {
  try {
    console.log('Testando carregamento de bolões...');
    
    // Buscar todos os usuários
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Erro ao buscar usuários:', usersError);
      return;
    }
    
    console.log(`Encontrados ${users.users.length} usuários`);
    
    // Pegar o último usuário criado (provavelmente o de teste)
    const testUser = users.users[users.users.length - 1];
    console.log('Usuário de teste:', testUser.id, testUser.email);
    
    // Buscar bolões onde este usuário é membro
    const { data: memberPools, error: memberError } = await supabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner(
          id,
          name,
          code,
          owner_id,
          premium,
          max_members,
          created_at
        )
      `)
      .eq('user_id', testUser.id);

    console.log('Bolões como membro:', memberPools);
    console.log('Erro:', memberError);
    
    if (memberPools && memberPools.length > 0) {
      console.log(`✅ Usuário ${testUser.email} tem ${memberPools.length} bolão(ões)`);
      memberPools.forEach(pool => {
        console.log(`  - ${pool.pools.name} (${pool.role})`);
      });
    } else {
      console.log(`❌ Usuário ${testUser.email} não tem bolões`);
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

testUserPools();