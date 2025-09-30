const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugPoolsQuery() {
  try {
    console.log('=== DEBUG: Query de Bolões ===');
    
    // 1. Login com usuário de teste
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'douglascpd@gmail.com',
      password: '123456'
    });
    
    if (authError) {
      console.error('Erro no login:', authError);
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    console.log('User ID:', authData.user.id);
    
    // 2. Verificar se o usuário existe na tabela pool_members
    const { data: memberData, error: memberError } = await supabase
      .from('pool_members')
      .select('*')
      .eq('user_id', authData.user.id);
      
    console.log('\n=== Membros do usuário ===');
    console.log('Query error:', memberError);
    console.log('Dados encontrados:', memberData);
    
    // 3. Executar a query exata da página
    const { data: poolsData, error: poolsError } = await supabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner(id, name, code, owner_id, premium, max_members, created_at)
      `)
      .eq('user_id', authData.user.id);
      
    console.log('\n=== Query da página ===');
    console.log('Query error:', poolsError);
    console.log('Dados da query:', JSON.stringify(poolsData, null, 2));
    
    // 4. Verificar estrutura da tabela pools
    const { data: allPools, error: allPoolsError } = await supabase
      .from('pools')
      .select('*')
      .limit(5);
      
    console.log('\n=== Estrutura da tabela pools ===');
    console.log('Error:', allPoolsError);
    console.log('Sample pools:', JSON.stringify(allPools, null, 2));
    
    // 5. Verificar se há problema com a relação
    const { data: simpleQuery, error: simpleError } = await supabase
      .from('pool_members')
      .select('pool_id, role')
      .eq('user_id', authData.user.id);
      
    console.log('\n=== Query simples ===');
    console.log('Error:', simpleError);
    console.log('Dados:', simpleQuery);
    
    if (simpleQuery && simpleQuery.length > 0) {
      // Buscar pools separadamente
      const poolIds = simpleQuery.map(pm => pm.pool_id);
      const { data: poolsDirectQuery, error: poolsDirectError } = await supabase
        .from('pools')
        .select('*')
        .in('id', poolIds);
        
      console.log('\n=== Query direta de pools ===');
      console.log('Error:', poolsDirectError);
      console.log('Dados:', JSON.stringify(poolsDirectQuery, null, 2));
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

debugPoolsQuery();