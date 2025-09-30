const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProfilesStructure() {
  console.log('🔍 Verificando estrutura da tabela profiles...\n');
  
  try {
    // Buscar alguns profiles para ver a estrutura
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(3);
    
    if (profilesError) {
      console.error('❌ Erro ao buscar profiles:', profilesError);
      return;
    }
    
    if (profiles && profiles.length > 0) {
      console.log('📊 Estrutura da tabela profiles:');
      Object.keys(profiles[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof profiles[0][key]}`);
      });
      
      console.log('\n📋 Exemplo de profile:');
      console.log(profiles[0]);
      
      // Buscar o usuário de teste pelo ID que já conhecemos
      const testUserId = 'a86c9747-ec76-44dd-8044-4f7e7d94be25';
      console.log(`\n🔍 Buscando usuário de teste pelo ID: ${testUserId}`);
      
      const { data: testUser, error: testUserError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();
      
      if (testUserError) {
        console.error('❌ Erro ao buscar usuário de teste:', testUserError);
      } else {
        console.log('✅ Usuário de teste encontrado:');
        console.log(testUser);
      }
    } else {
      console.log('⚠️ Nenhum profile encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkProfilesStructure();