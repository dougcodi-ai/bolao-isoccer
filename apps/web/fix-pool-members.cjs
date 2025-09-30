const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPoolMembers() {
  try {
    console.log('🔧 Corrigindo registros de pool_members...');
    
    // Buscar todos os bolões
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, owner_id');
    
    if (poolsError) {
      console.error('❌ Erro ao buscar bolões:', poolsError);
      return;
    }
    
    console.log(`📊 Encontrados ${pools?.length || 0} bolões`);
    
    if (!pools || pools.length === 0) {
      console.log('❌ Nenhum bolão encontrado');
      return;
    }
    
    // Para cada bolão, verificar se o owner está na tabela pool_members
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const pool of pools) {
      // Verificar se já existe registro
      const { data: existingMember } = await supabase
        .from('pool_members')
        .select('pool_id')
        .eq('pool_id', pool.id)
        .eq('user_id', pool.owner_id)
        .single();
      
      if (existingMember) {
        skippedCount++;
        continue;
      }
      
      // Adicionar o owner como membro
      const { error: insertError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: pool.owner_id,
          role: 'owner'
        });
      
      if (insertError) {
        console.error(`❌ Erro ao adicionar owner do bolão ${pool.name}:`, insertError);
      } else {
        addedCount++;
        console.log(`✅ Adicionado owner ao bolão: ${pool.name}`);
      }
    }
    
    console.log('\n🎉 Correção concluída!');
    console.log(`📊 Resumo:`);
    console.log(`   - ${addedCount} owners adicionados`);
    console.log(`   - ${skippedCount} já existiam`);
    console.log(`   - ${pools.length} bolões processados`);
    
    // Verificar se agora a query da página de palpites funciona
    console.log('\n🔍 Testando query da página de palpites...');
    const userId = '07e9fde0-6ab3-487a-871e-b861206736b7';
    
    const { data: poolsData, error: poolsError2 } = await supabase
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

    if (poolsError2) {
      console.error('❌ Erro na query de teste:', poolsError2);
    } else {
      console.log(`✅ Query de teste executada com sucesso!`);
      console.log(`📊 Bolões encontrados: ${poolsData?.length || 0}`);
      
      if (poolsData && poolsData.length > 0) {
        console.log('📋 Primeiros 3 bolões:');
        poolsData.slice(0, 3).forEach((pm, index) => {
          console.log(`  ${index + 1}. ${pm.pools.name} (${pm.pools.code}) - ${pm.role}`);
        });
        console.log('\n🎯 A página de palpites agora deve funcionar!');
      }
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

fixPoolMembers();