const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWebLogin() {
  try {
    console.log('🔐 Fazendo login na interface web...');

    // Fazer login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test_1758850149045@example.com',
      password: 'test123456'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso!');
    console.log('👤 Usuário:', authData.user.email);
    console.log('🔑 Token:', authData.session?.access_token ? 'Presente' : 'Ausente');

    // Verificar sessão
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('📱 Sessão ativa:', sessionData.session ? 'Sim' : 'Não');

    // Testar busca de bolões
    console.log('\n📊 Testando busca de bolões...');
    const { data: userPools, error: poolsError } = await supabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner (
          id,
          name,
          code,
          premium,
          max_members,
          owner_id
        )
      `)
      .eq('user_id', authData.user.id);

    if (poolsError) {
      console.error('❌ Erro ao buscar bolões:', poolsError.message);
      return;
    }

    console.log('✅ Bolões encontrados:', userPools?.length || 0);
    if (userPools && userPools.length > 0) {
      userPools.forEach((pool, index) => {
        console.log(`  ${index + 1}. ${pool.pools.name} (${pool.role})`);
      });
    }

    console.log('\n🎯 Agora você pode acessar http://localhost:3002/palpites');
    console.log('💡 A sessão deve estar ativa na interface web.');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testWebLogin();