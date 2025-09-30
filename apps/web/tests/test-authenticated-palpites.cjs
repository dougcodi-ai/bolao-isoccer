require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthenticatedPalpites() {
  try {
    console.log('🔐 Testando página de palpites com usuário autenticado...');
    
    // Primeiro, vamos buscar um usuário existente que tenha bolões
    // Vamos usar o service key para isso
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;
    const adminSupabase = createClient(supabaseUrl, serviceKey);
    
    // Usar o usuário de teste criado recentemente que sabemos a senha
    const testUserId = '1c4d8839-6d48-4287-bd60-11a37ddbd04e'; // usuário criado pelo create-test-pool.cjs
    console.log(`👤 Usando usuário: ${testUserId}`);
    
    // Buscar o email do usuário
    const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(testUserId);
    
    if (userError || !userData.user) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return;
    }
    
    const userEmail = userData.user.email;
    console.log(`📧 Email do usuário: ${userEmail}`);
    
    // Tentar fazer login (assumindo que a senha é conhecida ou padrão)
    // Para usuários de teste, vamos tentar algumas senhas comuns
    const possiblePasswords = ['test123456', '123456', 'password', 'test123'];
    let loginSuccess = false;
    
    for (const password of possiblePasswords) {
      console.log(`🔑 Tentando login com senha: ${password}`);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password
      });
      
      if (!authError && authData.user) {
        console.log('✅ Login realizado com sucesso!');
        loginSuccess = true;
        break;
      } else {
        console.log(`❌ Falha no login: ${authError?.message || 'Erro desconhecido'}`);
      }
    }
    
    if (!loginSuccess) {
      console.log('❌ Não foi possível fazer login com nenhuma senha testada');
      console.log('💡 Sugestão: Use a interface web para fazer login manualmente');
      return;
    }
    
    // Agora testar a query da página de palpites com o usuário autenticado
    console.log('\n🧪 Testando query da página de palpites...');
    
    const { data: userPools, error: queryError } = await supabase
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
      .eq('user_id', testUserId);
    
    if (queryError) {
      console.error('❌ Erro na query:', queryError);
    } else {
      console.log(`✅ Query executada com sucesso!`);
      console.log(`📊 Encontrados ${userPools?.length || 0} bolões`);
      
      if (userPools && userPools.length > 0) {
        console.log('\n📋 Primeiros 5 bolões:');
        userPools.slice(0, 5).forEach((member, index) => {
          console.log(`  ${index + 1}. ${member.pools.name} (${member.pools.code}) - Role: ${member.role}`);
        });
        
        if (userPools.length > 5) {
          console.log(`  ... e mais ${userPools.length - 5} bolões`);
        }
      }
    }
    
    // Fazer logout
    await supabase.auth.signOut();
    console.log('\n🚪 Logout realizado');
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

testAuthenticatedPalpites();