require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPoolsStructure() {
  try {
    console.log('Verificando estrutura da tabela pools...');
    
    // Buscar um pool para ver as colunas disponíveis
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('*')
      .limit(1);

    if (poolsError) {
      console.error('Erro ao buscar pools:', poolsError);
      return;
    }
    
    if (pools && pools.length > 0) {
      console.log('Estrutura da tabela pools:');
      console.log(Object.keys(pools[0]));
      console.log('Exemplo de pool:', pools[0]);
    } else {
      console.log('Nenhum pool encontrado');
    }
    
    // Verificar também pool_members
    console.log('\nVerificando estrutura da tabela pool_members...');
    const { data: members, error: membersError } = await supabase
      .from('pool_members')
      .select('*')
      .limit(1);

    if (membersError) {
      console.error('Erro ao buscar pool_members:', membersError);
      return;
    }
    
    if (members && members.length > 0) {
      console.log('Estrutura da tabela pool_members:');
      console.log(Object.keys(members[0]));
      console.log('Exemplo de member:', members[0]);
    } else {
      console.log('Nenhum member encontrado');
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

checkPoolsStructure();