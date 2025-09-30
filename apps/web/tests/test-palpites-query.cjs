const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPalpitesQuery() {
  try {
    console.log('🔍 Testando query da página de palpites...');
    
    // Usar o ID do novo usuário criado
    const userId = '1c4d8839-6d48-4287-bd60-11a37ddbd04e'; // usuário de teste criado
    console.log(`👤 Testando com usuário: ${userId}`);
    
    // Primeiro, verificar se há registros na tabela pool_members para este usuário
    console.log('\n🔍 Verificando tabela pool_members...');
    const { data: memberCheck, error: memberCheckError } = await supabase
      .from('pool_members')
      .select('pool_id, user_id, role')
      .eq('user_id', userId);
    
    if (memberCheckError) {
      console.error('❌ Erro ao verificar pool_members:', memberCheckError);
      return;
    }
    
    console.log(`📊 Registros em pool_members: ${memberCheck?.length || 0}`);
    
    // Verificar se há bolões onde este usuário é owner
    console.log('\n🔍 Verificando bolões como owner...');
    const { data: ownedPools, error: ownedError } = await supabase
      .from('pools')
      .select('id, name, code, owner_id')
      .eq('owner_id', userId);
    
    if (ownedError) {
      console.error('❌ Erro ao verificar pools:', ownedError);
      return;
    }
    
    console.log(`📊 Bolões como owner: ${ownedPools?.length || 0}`);
    
    if (ownedPools && ownedPools.length > 0) {
      console.log('📋 Primeiros 3 bolões como owner:');
      ownedPools.slice(0, 3).forEach((pool, index) => {
        console.log(`  ${index + 1}. ${pool.name} (${pool.code})`);
      });
    }
    
    // Esta é a mesma query usada na página de palpites
    const { data: poolsData, error: poolsError } = await supabase
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
      .eq('user_id', userId);

    if (poolsError) {
      console.error('❌ Erro na query:', poolsError);
      return;
    }

    console.log(`✅ Query executada com sucesso!`);
    console.log(`📊 Encontrados ${poolsData?.length || 0} bolões`);

    if (poolsData && poolsData.length > 0) {
      console.log('\n📋 Primeiros 5 bolões:');
      poolsData.slice(0, 5).forEach((pm, index) => {
        console.log(`  ${index + 1}. ${pm.pools.name} (${pm.pools.code}) - ${pm.role}`);
      });

      // Mapear os dados como faz a página de palpites
      const userPools = poolsData.map(pm => ({
        ...pm.pools,
        created_by: pm.pools.owner_id,
        championship_id: 'default',
        is_active: true,
        user_role: pm.role
      })).filter(Boolean);

      console.log(`\n🔄 Após mapeamento: ${userPools.length} bolões`);
      console.log('✅ A query da página de palpites está funcionando corretamente!');
      
      if (userPools.length > 0) {
        console.log(`🎯 Primeiro bolão selecionado seria: ${userPools[0].name}`);
      }
    } else {
      console.log('❌ Nenhum bolão encontrado para este usuário');
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

testPalpitesQuery();