const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPageLogic() {
  try {
    console.log('🔍 Simulando a lógica da página de palpites...\n');

    // 1. Fazer login (simular o que a página faz)
    console.log('🔐 1. Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test_1758850149045@example.com',
      password: 'test123456'
    });

    if (authError || !authData.user) {
      console.error('❌ Erro no login:', authError?.message);
      return;
    }

    console.log('✅ Login realizado com sucesso!');
    const user = authData.user;
    console.log(`👤 Usuário: ${user.email} (ID: ${user.id})\n`);

    // 2. Carregar campeonatos (como a página faz)
    console.log('🏆 2. Carregando campeonatos...');
    const { data: championshipsData, error: champError } = await supabase
      .from('championships')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (champError) {
      console.log('⚠️ Erro ao carregar campeonatos:', champError.message);
      console.log('📝 A página usará dados de exemplo');
    } else {
      console.log('✅ Campeonatos carregados:', championshipsData?.length || 0);
    }

    // 3. Carregar bolões (exatamente como a página faz)
    console.log('\n📊 3. Carregando bolões do usuário...');
    console.log(`🔍 Buscando bolões para usuário: ${user.id}`);

    const { data: poolsData, error: poolsError } = await supabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner(id, name, code, owner_id, premium, max_members, created_at)
      `)
      .eq('user_id', user.id);

    console.log('📋 Query executada:');
    console.log('  - Tabela: pool_members');
    console.log('  - Filtro: user_id =', user.id);
    console.log('  - Select: pool_id, role, pools(...)');

    if (poolsError) {
      console.error('❌ Erro na query de bolões:', poolsError.message);
      console.error('📄 Detalhes:', poolsError);
      return;
    }

    console.log('📊 Resultado da query:', poolsData?.length || 0, 'registros');

    if (poolsData && poolsData.length > 0) {
      console.log('\n✅ Bolões encontrados:');
      poolsData.forEach((pm, index) => {
        console.log(`  ${index + 1}. ${pm.pools.name}`);
        console.log(`     - ID: ${pm.pools.id}`);
        console.log(`     - Papel: ${pm.role}`);
        console.log(`     - Owner: ${pm.pools.owner_id}`);
      });

      // Mapear como a página faz
      const userPools = poolsData.map(pm => ({
        ...pm.pools,
        created_by: pm.pools.owner_id,
        championship_id: 'default',
        is_active: true,
        user_role: pm.role
      })).filter(Boolean);

      console.log('\n🔄 Após mapeamento:', userPools.length, 'bolões');
      console.log('🎯 Primeiro bolão seria selecionado:', userPools[0]?.name);

    } else {
      console.log('❌ Nenhum bolão encontrado');
      
      // Vamos verificar se o usuário existe na tabela pool_members
      console.log('\n🔍 Verificando se usuário existe na tabela pool_members...');
      const { data: allMembers } = await supabase
        .from('pool_members')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('👥 Registros do usuário em pool_members:', allMembers?.length || 0);
      
      if (allMembers && allMembers.length > 0) {
        console.log('📋 Detalhes dos registros:');
        allMembers.forEach((member, index) => {
          console.log(`  ${index + 1}. Pool ID: ${member.pool_id}, Role: ${member.role}`);
        });
      }

      // Verificar se existem bolões na tabela pools
      console.log('\n🔍 Verificando bolões na tabela pools...');
      const { data: allPools } = await supabase
        .from('pools')
        .select('*');
      
      console.log('🏆 Total de bolões na tabela pools:', allPools?.length || 0);
      
      if (allPools && allPools.length > 0) {
        console.log('📋 Bolões existentes:');
        allPools.forEach((pool, index) => {
          console.log(`  ${index + 1}. ${pool.name} (ID: ${pool.id})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('📄 Stack:', error.stack);
  }
}

debugPageLogic();