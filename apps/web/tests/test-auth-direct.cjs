// Teste direto da autenticação usando a mesma configuração da aplicação
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Configuração do Supabase:');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? 'Presente' : 'Ausente');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-client-info': 'isoccer-web',
    },
  },
});

async function testAuthDirect() {
  try {
    console.log('\n🔐 Testando autenticação direta...');

    // 1. Verificar sessão atual
    console.log('📱 1. Verificando sessão atual...');
    const { data: currentSession } = await supabase.auth.getSession();
    console.log('Sessão atual:', currentSession.session ? 'Ativa' : 'Inativa');

    // 2. Fazer login
    console.log('\n🔑 2. Fazendo login...');
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
    console.log('🔑 Access Token:', authData.session?.access_token ? 'Presente' : 'Ausente');

    // 3. Verificar sessão após login
    console.log('\n📱 3. Verificando sessão após login...');
    const { data: newSession } = await supabase.auth.getSession();
    console.log('Nova sessão:', newSession.session ? 'Ativa' : 'Inativa');

    // 4. Testar getUser (como a página faz)
    console.log('\n👤 4. Testando getUser...');
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Erro ao obter usuário:', userError.message);
    } else {
      console.log('✅ Usuário obtido:', userData.user?.email);
    }

    // 5. Testar query de bolões
    console.log('\n📊 5. Testando query de bolões...');
    const { data: poolsData, error: poolsError } = await supabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner(id, name, code, owner_id, premium, max_members, created_at)
      `)
      .eq('user_id', authData.user.id);

    if (poolsError) {
      console.error('❌ Erro na query de bolões:', poolsError.message);
    } else {
      console.log('✅ Bolões encontrados:', poolsData?.length || 0);
    }

    console.log('\n🎯 Teste concluído!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testAuthDirect();