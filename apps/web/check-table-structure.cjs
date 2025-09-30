require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableStructure() {
  console.log('🔍 Verificando estrutura da tabela booster_usages...\n');

  try {
    // Verificar se a tabela existe e sua estrutura
    const { data, error } = await supabaseAdmin
      .from('booster_usages')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Erro ao acessar booster_usages:', error.message);
      return;
    }

    console.log('✅ Tabela booster_usages acessível');
    
    if (data && data.length > 0) {
      console.log('📋 Colunas disponíveis:', Object.keys(data[0]));
    } else {
      console.log('📭 Tabela vazia, verificando estrutura via SQL...');
      
      // Usar SQL direto para verificar estrutura
      const { data: columns, error: sqlError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'booster_usages'
          ORDER BY ordinal_position;
        `
      });

      if (sqlError) {
        console.log('❌ Erro ao verificar estrutura via SQL:', sqlError.message);
      } else {
        console.log('📋 Estrutura da tabela:');
        columns.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
        });
      }
    }

    // Verificar registros existentes
    const { data: allUsages, error: usagesError } = await supabaseAdmin
      .from('booster_usages')
      .select('*');

    if (usagesError) {
      console.log('❌ Erro ao buscar registros:', usagesError.message);
    } else {
      console.log(`\n📊 Total de registros na tabela: ${allUsages.length}`);
      if (allUsages.length > 0) {
        console.log('📋 Exemplo de registro:', allUsages[0]);
      }
    }

  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

checkTableStructure();