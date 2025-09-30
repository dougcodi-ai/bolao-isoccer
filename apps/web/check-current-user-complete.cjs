const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ywvjqtqtqtqtqtqtqtqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dmpxdHF0cXRxdHF0cXRxdHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2NzI4NzQsImV4cCI6MjA0MjI0ODg3NH0.VQqJhYhOJZOLqOqOqOqOqOqOqOqOqOqOqOqOqOqOqOqO';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentUserComplete() {
  try {
    console.log('🔍 Verificando usuário atual...\n');

    // 1. Verificar sessão atual
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Erro ao obter sessão:', sessionError);
      return;
    }

    if (!session) {
      console.log('❌ Nenhuma sessão ativa encontrada');
      return;
    }

    console.log('✅ Sessão ativa encontrada');
    console.log('📧 Email:', session.user.email);
    console.log('🆔 User ID:', session.user.id);
    console.log('⏰ Criado em:', new Date(session.user.created_at).toLocaleString());
    console.log('');

    // 2. Verificar perfil do usuário
    console.log('🔍 Verificando perfil do usuário...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.log('❌ Erro ao buscar perfil:', profileError.message);
    } else if (profile) {
      console.log('✅ Perfil encontrado:');
      console.log('   - Display Name:', profile.display_name);
      console.log('   - Avatar URL:', profile.avatar_url);
      console.log('   - Criado em:', new Date(profile.created_at).toLocaleString());
    } else {
      console.log('❌ Perfil não encontrado');
    }
    console.log('');

    // 3. Verificar participação em bolões
    console.log('🔍 Verificando participação em bolões...');
    const { data: poolMemberships, error: membershipError } = await supabase
      .from('pool_members')
      .select(`
        *,
        pools (
          id,
          name,
          description,
          created_at,
          owner_id
        )
      `)
      .eq('user_id', session.user.id);

    if (membershipError) {
      console.log('❌ Erro ao buscar participação em bolões:', membershipError.message);
    } else if (poolMemberships && poolMemberships.length > 0) {
      console.log(`✅ Usuário participa de ${poolMemberships.length} bolão(ões):`);
      poolMemberships.forEach((membership, index) => {
        console.log(`   ${index + 1}. Bolão: ${membership.pools.name}`);
        console.log(`      - ID: ${membership.pools.id}`);
        console.log(`      - Papel: ${membership.role}`);
        console.log(`      - Entrou em: ${new Date(membership.joined_at).toLocaleString()}`);
        console.log(`      - É owner: ${membership.pools.owner_id === session.user.id ? 'Sim' : 'Não'}`);
      });
    } else {
      console.log('❌ Usuário não participa de nenhum bolão');
    }
    console.log('');

    // 4. Verificar todos os bolões existentes
    console.log('🔍 Verificando todos os bolões existentes...');
    const { data: allPools, error: poolsError } = await supabase
      .from('pools')
      .select('*')
      .order('created_at', { ascending: false });

    if (poolsError) {
      console.log('❌ Erro ao buscar bolões:', poolsError.message);
    } else if (allPools && allPools.length > 0) {
      console.log(`✅ Total de ${allPools.length} bolão(ões) no sistema:`);
      allPools.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.name} (ID: ${pool.id})`);
        console.log(`      - Owner ID: ${pool.owner_id}`);
        console.log(`      - Criado em: ${new Date(pool.created_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ Nenhum bolão encontrado no sistema');
    }
    console.log('');

    // 5. Verificar query específica da página de palpites
    console.log('🔍 Testando query específica da página de palpites...');
    const { data: userPools, error: queryError } = await supabase
      .from('pool_members')
      .select(`
        pools (
          id,
          name,
          description,
          created_at,
          owner_id
        ),
        role,
        joined_at
      `)
      .eq('user_id', session.user.id);

    if (queryError) {
      console.log('❌ Erro na query da página:', queryError.message);
    } else {
      console.log('✅ Query da página executada com sucesso');
      console.log('📊 Resultado:', JSON.stringify(userPools, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkCurrentUserComplete();