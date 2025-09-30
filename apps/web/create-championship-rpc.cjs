const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createChampionshipRPC() {
  console.log('🔧 Criando função RPC para adicionar championship...\n');
  
  try {
    // Primeiro, vamos tentar criar uma função RPC simples
    console.log('1️⃣ Criando função RPC add_championship_to_matches...');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION add_championship_to_matches()
      RETURNS TEXT AS $$
      BEGIN
        -- Adicionar coluna se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'matches' AND column_name = 'championship'
        ) THEN
          ALTER TABLE matches ADD COLUMN championship TEXT;
        END IF;
        
        -- Atualizar jogos existentes
        UPDATE matches 
        SET championship = pools.championship 
        FROM pools 
        WHERE matches.pool_id = pools.id 
          AND (matches.championship IS NULL OR matches.championship != pools.championship);
        
        RETURN 'Championship field added and updated successfully';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Tentar executar via SQL direto (pode não funcionar)
    try {
      const { data, error } = await supabase.rpc('exec', {
        sql: createFunctionSQL
      });
      
      if (error) {
        console.log('⚠️ Não foi possível criar via RPC exec. Erro:', error.message);
        console.log('\n📝 Execute este SQL no Supabase Dashboard (SQL Editor):');
        console.log('```sql');
        console.log(createFunctionSQL);
        console.log('```');
        console.log('\nDepois execute:');
        console.log('```sql');
        console.log('SELECT add_championship_to_matches();');
        console.log('```');
        return;
      } else {
        console.log('✅ Função RPC criada com sucesso!');
      }
    } catch (createError) {
      console.log('⚠️ Erro ao criar função:', createError.message);
      console.log('\n📝 Execute este SQL no Supabase Dashboard (SQL Editor):');
      console.log('```sql');
      console.log(createFunctionSQL);
      console.log('```');
      console.log('\nDepois execute:');
      console.log('```sql');
      console.log('SELECT add_championship_to_matches();');
      console.log('```');
      return;
    }
    
    // 2. Executar a função RPC
    console.log('\n2️⃣ Executando função RPC...');
    const { data: result, error: execError } = await supabase.rpc('add_championship_to_matches');
    
    if (execError) {
      console.error('❌ Erro ao executar função:', execError);
      return;
    }
    
    console.log('✅ Resultado:', result);
    
    // 3. Verificar se funcionou
    console.log('\n3️⃣ Verificando resultado...');
    const { data: testData, error: testError } = await supabase
      .from('matches')
      .select('id, championship, pools!inner(championship)')
      .limit(3);
    
    if (testError) {
      console.error('❌ Erro ao verificar:', testError);
    } else {
      console.log('📊 Amostra de jogos:');
      testData?.forEach((match, index) => {
        console.log(`  ${index + 1}. Match: ${match.championship}, Pool: ${match.pools.championship}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createChampionshipRPC();