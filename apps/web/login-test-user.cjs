const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ1MTM3MCwiZXhwIjoyMDczMDI3MzcwfQ.fcm325Qayb6UQW600aZmdPCkDcOiFx34-vV4gwc4KQ4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function getTestUserInfo() {
  console.log('🔍 Buscando informações do usuário de teste...');
  
  try {
    // Buscar o usuário que é owner do pool de teste
    const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
    
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('owner_id, name, code')
      .eq('id', poolId)
      .single();
    
    if (poolError) {
      console.error('❌ Erro ao buscar pool:', poolError);
      return;
    }
    
    console.log('✅ Pool encontrado:');
    console.log(`   📋 Nome: ${pool.name}`);
    console.log(`   🔑 Código: ${pool.code}`);
    console.log(`   👤 Owner ID: ${pool.owner_id}`);
    
    // Buscar informações do usuário
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(pool.owner_id);
    
    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return;
    }
    
    console.log('\n👤 Informações do usuário:');
    console.log(`   📧 Email: ${user.user.email}`);
    console.log(`   🆔 ID: ${user.user.id}`);
    console.log(`   📅 Criado em: ${new Date(user.user.created_at).toLocaleString('pt-BR')}`);
    
    // Verificar se é membro do pool
    const { data: membership, error: memberError } = await supabase
      .from('pool_members')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', pool.owner_id)
      .single();
    
    if (memberError) {
      console.log('⚠️ Usuário não é membro do pool, adicionando...');
      
      const { error: addError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: poolId,
          user_id: pool.owner_id,
          role: 'owner'
        });
      
      if (addError) {
        console.error('❌ Erro ao adicionar usuário ao pool:', addError);
      } else {
        console.log('✅ Usuário adicionado como owner do pool');
      }
    } else {
      console.log(`✅ Usuário é ${membership.role} do pool`);
    }
    
    console.log('\n🎯 Para testar a interface:');
    console.log('1. Acesse: http://localhost:3002');
    console.log(`2. Faça login com: ${user.user.email}`);
    console.log('3. Use a senha que foi definida na criação');
    console.log(`4. Ou acesse diretamente: http://localhost:3002/palpites`);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

getTestUserInfo().catch(console.error);