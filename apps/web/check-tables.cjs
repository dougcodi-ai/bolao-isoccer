require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  try {
    console.log('🔍 Verificando estado das tabelas...');
    
    // Verificar tabela pools
    console.log('\n📊 Tabela pools:');
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, code, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
    } else {
      console.log(`✅ Encontrados ${pools?.length || 0} bolões`);
      if (pools && pools.length > 0) {
        pools.forEach((pool, index) => {
          console.log(`  ${index + 1}. ${pool.name} (${pool.code}) - Owner: ${pool.owner_id}`);
        });
      }
    }
    
    // Verificar tabela pool_members
    console.log('\n👥 Tabela pool_members:');
    const { data: members, error: membersError } = await supabase
      .from('pool_members')
      .select('pool_id, user_id, role')
      .limit(10);
    
    if (membersError) {
      console.error('❌ Erro ao buscar pool_members:', membersError);
    } else {
      console.log(`✅ Encontrados ${members?.length || 0} membros`);
      if (members && members.length > 0) {
        members.forEach((member, index) => {
          console.log(`  ${index + 1}. Pool: ${member.pool_id} - User: ${member.user_id} - Role: ${member.role}`);
        });
      }
    }
    
    // Se há bolões mas não há membros, isso é o problema
    if (pools && pools.length > 0 && (!members || members.length === 0)) {
      console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
      console.log('   - Há bolões na tabela pools');
      console.log('   - Mas não há registros na tabela pool_members');
      console.log('   - Isso impede a página de palpites de funcionar');
      console.log('\n💡 SOLUÇÃO: Adicionar os owners dos bolões à tabela pool_members');
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkTables();