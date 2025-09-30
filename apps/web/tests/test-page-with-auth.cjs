require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPageWithAuth() {
  try {
    console.log('Testando carregamento da página de palpites...');
    
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

    console.log('✅ Usuário encontrado:', testUser.id);

    // Simular a mesma query que a página faz
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

    if (memberError) {
      console.error('❌ Erro ao buscar bolões:', memberError);
      return;
    }

    console.log(`✅ Query executada com sucesso! Encontrados ${memberPools?.length || 0} bolões`);
    
    if (memberPools && memberPools.length > 0) {
      console.log('Primeiros 3 bolões:');
      memberPools.slice(0, 3).forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.pools.name} (${member.role}) - Código: ${member.pools.code}`);
      });
    }

    // Verificar se existe perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('❌ Erro ao buscar perfil:', profileError);
    } else if (profile) {
      console.log('✅ Perfil encontrado:', profile.display_name || 'Sem nome');
    } else {
      console.log('⚠️ Perfil não encontrado, criando...');
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          id: testUser.id,
          display_name: testUser.email.split('@')[0]
        });
      
      if (createError) {
        console.error('❌ Erro ao criar perfil:', createError);
      } else {
        console.log('✅ Perfil criado com sucesso');
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testPageWithAuth();