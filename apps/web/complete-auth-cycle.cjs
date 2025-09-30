const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

// Credenciais do usuário de teste
const testUser = {
  email: 'teste@bolao.com',
  password: '123456789'
};

async function completeAuthCycle() {
  try {
    console.log('🔄 Iniciando ciclo completo de autenticação...\n');

    // 1. Fazer logout primeiro (limpar sessão)
    console.log('🚪 Fazendo logout para limpar sessão...');
    await supabase.auth.signOut();
    console.log('✅ Logout realizado\n');

    // 2. Fazer login
    console.log('🔑 Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    console.log('📧 Email:', authData.user.email);
    console.log('🆔 User ID:', authData.user.id);
    console.log('');

    const userId = authData.user.id;

    // 3. Verificar/Criar perfil
    console.log('👤 Verificando perfil...');
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      console.log('📝 Perfil não encontrado, criando...');
      const { data: newProfile, error: createProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: 'Usuário Teste',
          avatar_url: null,
          preferences: {}
        })
        .select()
        .single();

      if (createProfileError) {
        console.error('❌ Erro ao criar perfil:', createProfileError.message);
        return;
      }
      profile = newProfile;
      console.log('✅ Perfil criado com sucesso');
    } else if (profileError) {
      console.error('❌ Erro ao verificar perfil:', profileError.message);
      return;
    } else {
      console.log('✅ Perfil já existe');
    }
    console.log('');

    // 4. Verificar bolões existentes
    console.log('🏆 Verificando bolões existentes...');
    const { data: existingPools, error: poolsError } = await supabase
      .from('pools')
      .select('*')
      .order('created_at', { ascending: false });

    if (poolsError) {
      console.error('❌ Erro ao buscar bolões:', poolsError.message);
      return;
    }

    let targetPool = null;

    if (existingPools && existingPools.length > 0) {
      console.log(`✅ Encontrados ${existingPools.length} bolão(ões):`);
      existingPools.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.name} (ID: ${pool.id})`);
      });
      targetPool = existingPools[0]; // Usar o primeiro bolão
    } else {
      console.log('❌ Nenhum bolão encontrado, criando um novo...');
      const { data: newPool, error: createPoolError } = await supabase
        .from('pools')
        .insert({
          name: 'Bolão Principal',
          description: 'Bolão principal para testes',
          owner_id: userId,
          is_active: true,
          max_members: 100
        })
        .select()
        .single();

      if (createPoolError) {
        console.error('❌ Erro ao criar bolão:', createPoolError.message);
        return;
      }
      targetPool = newPool;
      console.log('✅ Bolão criado com sucesso');
    }
    console.log('');

    // 5. Verificar/Adicionar usuário ao bolão
    console.log('👥 Verificando participação no bolão...');
    const { data: membership, error: membershipError } = await supabase
      .from('pool_members')
      .select('*')
      .eq('pool_id', targetPool.id)
      .eq('user_id', userId)
      .single();

    if (membershipError && membershipError.code === 'PGRST116') {
      console.log('📝 Usuário não é membro, adicionando...');
      const { data: newMembership, error: addMemberError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: targetPool.id,
          user_id: userId,
          role: targetPool.owner_id === userId ? 'owner' : 'member',
          joined_at: new Date().toISOString()
        })
        .select()
        .single();

      if (addMemberError) {
        console.error('❌ Erro ao adicionar usuário ao bolão:', addMemberError.message);
        return;
      }
      console.log('✅ Usuário adicionado ao bolão com sucesso');
    } else if (membershipError) {
      console.error('❌ Erro ao verificar participação:', membershipError.message);
      return;
    } else {
      console.log('✅ Usuário já é membro do bolão');
    }
    console.log('');

    // 6. Testar query da página de palpites
    console.log('🔍 Testando query da página de palpites...');
    const { data: userPools, error: queryError } = await supabase
      .from('pool_members')
      .select(`
        pools (
          id,
          name,
          code,
          created_at,
          owner_id,
          premium,
          max_members
        ),
        role,
        joined_at
      `)
      .eq('user_id', userId);

    if (queryError) {
      console.error('❌ Erro na query da página:', queryError.message);
      return;
    }

    console.log('✅ Query da página executada com sucesso!');
    console.log('📊 Resultado:');
    if (userPools && userPools.length > 0) {
      userPools.forEach((pool, index) => {
        console.log(`   ${index + 1}. Bolão: ${pool.pools.name}`);
        console.log(`      - ID: ${pool.pools.id}`);
        console.log(`      - Papel: ${pool.role}`);
        console.log(`      - Entrou em: ${new Date(pool.joined_at).toLocaleString()}`);
      });
    } else {
      console.log('   ❌ Nenhum bolão retornado pela query');
    }
    console.log('');

    // 7. Verificar sessão final
    console.log('🔍 Verificando sessão final...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Erro ao verificar sessão:', sessionError.message);
    } else if (session) {
      console.log('✅ Sessão ativa confirmada');
      console.log('📧 Email da sessão:', session.user.email);
    } else {
      console.log('❌ Nenhuma sessão ativa');
    }

    console.log('\n🎉 Ciclo completo de autenticação finalizado!');
    console.log('🔗 Agora você pode acessar: http://localhost:3002/palpites');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

completeAuthCycle();