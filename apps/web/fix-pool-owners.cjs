require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixPoolOwners() {
  try {
    console.log('🔧 Corrigindo owners dos bolões...');
    
    // Buscar todos os bolões
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, code, owner_id');
    
    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
      return;
    }
    
    console.log(`📊 Encontrados ${pools?.length || 0} bolões`);
    
    if (!pools || pools.length === 0) {
      console.log('❌ Nenhum bolão encontrado');
      return;
    }
    
    let fixed = 0;
    
    for (const pool of pools) {
      console.log(`\n🔍 Verificando bolão: ${pool.name} (${pool.code})`);
      
      // Verificar se o owner já é membro
      const { data: existingMember, error: memberError } = await supabase
        .from('pool_members')
        .select('id')
        .eq('pool_id', pool.id)
        .eq('user_id', pool.owner_id)
        .maybeSingle();
      
      if (memberError) {
        console.error(`❌ Erro ao verificar membro: ${memberError.message}`);
        continue;
      }
      
      if (existingMember) {
        console.log(`✅ Owner já é membro do bolão`);
        continue;
      }
      
      // Adicionar o owner como membro
      console.log(`➕ Adicionando owner como membro...`);
      const { error: insertError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: pool.owner_id,
          role: 'owner'
        });
      
      if (insertError) {
        console.error(`❌ Erro ao adicionar membro: ${insertError.message}`);
        continue;
      }
      
      console.log(`✅ Owner adicionado com sucesso`);
      fixed++;
    }
    
    console.log(`\n🎉 Correção concluída! ${fixed} bolões corrigidos.`);
    
    // Testar a query da página de palpites com um dos usuários
    console.log('\n🧪 Testando query da página de palpites...');
    const testUserId = pools[0].owner_id; // Usar o owner do primeiro bolão
    
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
      console.error('❌ Erro na query de teste:', queryError);
    } else {
      console.log(`✅ Query executada com sucesso!`);
      console.log(`📊 Encontrados ${userPools?.length || 0} bolões para o usuário ${testUserId}`);
      
      if (userPools && userPools.length > 0) {
        userPools.forEach((member, index) => {
          console.log(`  ${index + 1}. ${member.pools.name} (${member.pools.code}) - Role: ${member.role}`);
        });
      }
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

fixPoolOwners();