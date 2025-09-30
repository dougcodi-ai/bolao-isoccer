const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPalpitesPage() {
  console.log('🔍 Investigando o estado atual das tabelas...');
  
  try {
    // Verificar quantos bolões existem
    console.log('📊 Verificando tabela pools...');
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, code')
      .limit(5);

    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
      return;
    }

    console.log(`✅ Encontrados ${pools?.length || 0} bolões na tabela pools`);
    if (pools && pools.length > 0) {
      pools.forEach((pool, index) => {
        console.log(`  ${index + 1}. ${pool.name} (${pool.code})`);
      });
    }

    // Verificar quantos membros existem
    console.log('\n📊 Verificando tabela pool_members...');
    const { data: members, error: membersError } = await supabase
      .from('pool_members')
      .select('user_id, pool_id, role')
      .limit(5);

    if (membersError) {
      console.error('❌ Erro ao buscar pool_members:', membersError);
      return;
    }

    console.log(`✅ Encontrados ${members?.length || 0} membros na tabela pool_members`);
    if (members && members.length > 0) {
      members.forEach((member, index) => {
        console.log(`  ${index + 1}. User: ${member.user_id} | Pool: ${member.pool_id} | Role: ${member.role}`);
      });

      // Se há membros, testar a query da página de palpites
      console.log('\n🔍 Testando query da página de palpites...');
      const testUserId = members[0].user_id;
      
      const { data: userPools, error: queryError } = await supabase
        .from('pool_members')
        .select(`
          pool_id,
          role,
          pools (
            id,
            name,
            code,
            owner_id,
            premium,
            max_members,
            created_at
          )
        `)
        .eq('user_id', testUserId);

      if (queryError) {
        console.error('❌ Erro na query de palpites:', queryError);
        return;
      }

      console.log(`✅ Query executada com sucesso! Encontrados ${userPools?.length || 0} bolões para o usuário`);
      
      if (userPools && userPools.length > 0) {
        console.log('\n📋 Bolões do usuário:');
        userPools.forEach((pool, index) => {
          console.log(`  ${index + 1}. ${pool.pools.name} (${pool.pools.code}) - Role: ${pool.role}`);
        });
        
        console.log('\n🎉 SUCESSO! A query da página de palpites está funcionando corretamente!');
      }
    } else {
      console.log('\n⚠️ Tabela pool_members está vazia!');
      console.log('💡 Isso explica por que a página de palpites não mostra bolões.');
      console.log('📝 Precisamos recriar os dados de teste na tabela pool_members.');
    }

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

testPalpitesPage();