const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ1MTM3MCwiZXhwIjoyMDczMDI3MzcwfQ.fcm325Qayb6UQW600aZmdPCkDcOiFx34-vV4gwc4KQ4';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabaseAdmin = createClient(supabaseUrl, serviceKey);
const supabaseClient = createClient(supabaseUrl, anonKey);

async function createTestUserAndDebug() {
  try {
    console.log('=== Criando usuário de teste ===');
    
    // 1. Criar usuário de teste
    const testEmail = 'teste@bolao.com';
    const testPassword = '123456789';
    
    const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });
    
    if (createUserError && !createUserError.message.includes('already registered')) {
      console.error('Erro ao criar usuário:', createUserError);
      return;
    }
    
    console.log('✅ Usuário criado/já existe');
    
    // 2. Fazer login com o usuário
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (authError) {
      console.error('Erro no login:', authError);
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    console.log('User ID:', authData.user.id);
    
    // 3. Criar perfil se não existir
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
      
    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          display_name: 'Usuário Teste'
        });
        
      if (profileError) {
        console.error('Erro ao criar perfil:', profileError);
      } else {
        console.log('✅ Perfil criado');
      }
    }
    
    // 4. Verificar se existe um pool e adicionar o usuário
    const { data: existingPools } = await supabaseAdmin
      .from('pools')
      .select('*')
      .limit(1);
      
    let poolId;
    if (existingPools && existingPools.length > 0) {
      poolId = existingPools[0].id;
      console.log('✅ Pool existente encontrado:', poolId);
    } else {
      // Criar um pool de teste
      const { data: newPool, error: poolError } = await supabaseAdmin
        .from('pools')
        .insert({
          name: 'Pool de Teste',
          code: 'TEST123',
          owner_id: authData.user.id,
          premium: false,
          max_members: 100
        })
        .select()
        .single();
        
      if (poolError) {
        console.error('Erro ao criar pool:', poolError);
        return;
      }
      
      poolId = newPool.id;
      console.log('✅ Pool criado:', poolId);
    }
    
    // 5. Adicionar usuário ao pool
    const { data: existingMember } = await supabaseAdmin
      .from('pool_members')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('pool_id', poolId)
      .single();
      
    if (!existingMember) {
      const { error: memberError } = await supabaseAdmin
        .from('pool_members')
        .insert({
          user_id: authData.user.id,
          pool_id: poolId,
          role: 'owner'
        });
        
      if (memberError) {
        console.error('Erro ao adicionar membro:', memberError);
      } else {
        console.log('✅ Usuário adicionado ao pool');
      }
    }
    
    // 6. Testar a query da página de palpites
    console.log('\n=== Testando query da página ===');
    
    const { data: poolsData, error: poolsError } = await supabaseClient
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner(id, name, code, owner_id, premium, max_members, created_at)
      `)
      .eq('user_id', authData.user.id);
      
    console.log('Query error:', poolsError);
    console.log('Dados da query:', JSON.stringify(poolsData, null, 2));
    
    if (poolsData && poolsData.length > 0) {
      console.log('✅ SUCESSO! Query retornou dados');
      
      const userPools = poolsData.map(pm => ({
        ...pm.pools,
        created_by: pm.pools.owner_id,
        championship_id: 'default',
        is_active: true,
        user_role: pm.role
      }));
      
      console.log('Pools processados:', JSON.stringify(userPools, null, 2));
    } else {
      console.log('❌ Query não retornou dados');
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

createTestUserAndDebug();