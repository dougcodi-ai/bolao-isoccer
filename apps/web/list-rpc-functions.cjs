require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRPCFunctions() {
  try {
    console.log('🔍 Verificando funções RPC disponíveis...');
    
    // Tentar algumas funções comuns
    const commonFunctions = [
      'exec_sql',
      'exec',
      'execute_sql',
      'run_sql',
      'sql_exec',
      'admin_exec',
      'execute'
    ];
    
    for (const funcName of commonFunctions) {
      try {
        const { data, error } = await supabase.rpc(funcName, { sql: 'SELECT 1' });
        if (!error) {
          console.log(`✅ Função ${funcName} está disponível!`);
        } else {
          console.log(`❌ Função ${funcName}: ${error.message}`);
        }
      } catch (err) {
        console.log(`❌ Função ${funcName}: ${err.message}`);
      }
    }
    
    // Verificar se podemos acessar informações do schema
    console.log('\n🔍 Verificando acesso ao schema...');
    
    try {
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(5);
      
      if (!tablesError) {
        console.log('✅ Acesso ao information_schema disponível!');
        console.log('📊 Algumas tabelas:', tables.map(t => t.table_name));
      } else {
        console.log('❌ Sem acesso ao information_schema:', tablesError.message);
      }
    } catch (err) {
      console.log('❌ Erro ao acessar information_schema:', err.message);
    }
    
    // Verificar estrutura atual da tabela pools
    console.log('\n🔍 Verificando estrutura atual da tabela pools...');
    
    try {
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'pools')
        .order('ordinal_position');
      
      if (!columnsError) {
        console.log('✅ Estrutura da tabela pools:');
        columns.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Verificar se championship já existe
        const hasChampionship = columns.some(col => col.column_name === 'championship');
        if (hasChampionship) {
          console.log('\n🎉 Campo championship já existe na tabela!');
        } else {
          console.log('\n❌ Campo championship não existe na tabela.');
        }
      } else {
        console.log('❌ Erro ao verificar estrutura:', columnsError.message);
      }
    } catch (err) {
      console.log('❌ Erro ao verificar estrutura:', err.message);
    }
    
    // Tentar uma abordagem alternativa: verificar se podemos usar uma view ou trigger
    console.log('\n🔍 Verificando alternativas...');
    
    try {
      // Tentar criar uma função simples primeiro
      const { data: createResult, error: createError } = await supabase.rpc('create_championship_field');
      
      if (!createError) {
        console.log('✅ Função create_championship_field executada!', createResult);
      } else {
        console.log('❌ Função create_championship_field não existe:', createError.message);
      }
    } catch (err) {
      console.log('❌ Erro ao tentar função personalizada:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

listRPCFunctions();