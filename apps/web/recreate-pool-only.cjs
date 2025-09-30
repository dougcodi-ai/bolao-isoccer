const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function recreatePoolOnly() {
  try {
    console.log('🔄 Recriando apenas o bolão de teste...');

    // 1. Primeiro, fazer login com o usuário de teste
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test_1758850149045@example.com',
      password: 'test123456'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    const userId = authData.user.id;

    // 2. Verificar se já existe um bolão
    const { data: existingPools } = await supabase
      .from('pools')
      .select('*')
      .limit(1);

    if (existingPools && existingPools.length > 0) {
      console.log('ℹ️ Bolão já existe:', existingPools[0].name);
      
      // Verificar se o usuário já é membro
      const { data: membership } = await supabase
        .from('pool_members')
        .select('*')
        .eq('pool_id', existingPools[0].id)
        .eq('user_id', userId);

      if (membership && membership.length > 0) {
        console.log('✅ Usuário já é membro do bolão');
        return;
      } else {
        // Adicionar usuário como membro
        const { error: memberError } = await supabase
          .from('pool_members')
          .insert({
            pool_id: existingPools[0].id,
            user_id: userId,
            role: 'member'
          });

        if (memberError) {
          console.error('❌ Erro ao adicionar usuário como membro:', memberError.message);
        } else {
          console.log('✅ Usuário adicionado como membro do bolão existente');
        }
        return;
      }
    }

    // 3. Criar novo bolão se não existir
    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .insert({
        name: 'Bolão de Teste',
        description: 'Bolão criado para testes da aplicação',
        owner_id: userId,
        is_public: true,
        max_members: 50,
        entry_fee: 0,
        prize_distribution: { first: 70, second: 20, third: 10 }
      })
      .select()
      .single();

    if (poolError) {
      console.error('❌ Erro ao criar bolão:', poolError.message);
      return;
    }

    console.log('✅ Bolão criado:', poolData.name);

    // 4. Adicionar o criador como membro
    const { error: memberError } = await supabase
      .from('pool_members')
      .insert({
        pool_id: poolData.id,
        user_id: userId,
        role: 'owner'
      });

    if (memberError) {
      console.error('❌ Erro ao adicionar criador como membro:', memberError.message);
      return;
    }

    console.log('✅ Criador adicionado como membro do bolão');

    // 5. Verificar dados finais
    const { data: finalPools } = await supabase
      .from('pools')
      .select('*');

    const { data: finalMembers } = await supabase
      .from('pool_members')
      .select('*');

    console.log('\n📊 Dados finais:');
    console.log('Bolões:', finalPools?.length || 0);
    console.log('Membros:', finalMembers?.length || 0);

    console.log('\n🎉 Bolão de teste recriado com sucesso!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

recreatePoolOnly();