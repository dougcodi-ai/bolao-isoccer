require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserMembership() {
  try {
    // Buscar o usuário de teste através do auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Erro ao buscar usuários auth:', authError);
      return;
    }
    
    const testUser = authUsers.users.find(u => u.email === 'dougcodi@gmail.com');

    if (!testUser) {
      console.log('Usuário dougcodi@gmail.com não encontrado');
      return;
    }

    console.log('Usuário encontrado:', testUser.id, testUser.email);

    // Verificar se o usuário está em pool_members
    const { data: memberships, error: membershipError } = await supabase
      .from('pool_members')
      .select('*')
      .eq('user_id', testUser.id);

    if (membershipError) {
      console.error('Erro ao buscar memberships:', membershipError);
      return;
    }

    console.log('Memberships encontradas:', memberships?.length || 0);
    if (memberships && memberships.length > 0) {
      console.log('Memberships:', memberships);
    }

    // Verificar se o usuário é owner de algum pool
    const { data: ownedPools, error: ownedError } = await supabase
      .from('pools')
      .select('*')
      .eq('owner_id', testUser.id);

    if (ownedError) {
      console.error('Erro ao buscar pools próprios:', ownedError);
      return;
    }

    console.log('Pools próprios encontrados:', ownedPools?.length || 0);
    if (ownedPools && ownedPools.length > 0) {
      console.log('Pools próprios:', ownedPools);
      
      // Para cada pool próprio, adicionar o usuário como membro se não estiver
      for (const pool of ownedPools) {
        const existingMembership = memberships?.find(m => m.pool_id === pool.id);
        if (!existingMembership) {
          console.log(`Adicionando usuário como membro do pool ${pool.id}...`);
          const { error: insertError } = await supabase
            .from('pool_members')
            .insert({
              pool_id: pool.id,
              user_id: testUser.id,
              role: 'owner'
            });
          
          if (insertError) {
            console.error('Erro ao adicionar membership:', insertError);
          } else {
            console.log('✅ Membership adicionada com sucesso');
          }
        }
      }
    }

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkUserMembership();