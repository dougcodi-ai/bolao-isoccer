require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addChampionshipField() {
  try {
    console.log('🔧 Adicionando campo championship à tabela pools...');
    
    // Executar SQL para adicionar a coluna
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Adicionar campo championship à tabela pools
        ALTER TABLE public.pools 
        ADD COLUMN IF NOT EXISTS championship text;
        
        -- Adicionar comentário para documentação
        COMMENT ON COLUMN public.pools.championship IS 'Campeonato associado ao bolão (ex: Brasileirão Série A, Copa do Brasil, etc.)';
      `
    });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      
      // Tentar método alternativo usando SQL direto
      console.log('🔄 Tentando método alternativo...');
      
      const { error: altError } = await supabase
        .from('pools')
        .select('championship')
        .limit(1);
      
      if (altError && altError.message.includes('column "championship" does not exist')) {
        console.log('⚠️ Campo championship não existe. Será necessário adicionar via Supabase Dashboard.');
        console.log('📋 Execute este SQL no Supabase Dashboard:');
        console.log('ALTER TABLE public.pools ADD COLUMN championship text;');
        return;
      } else if (!altError) {
        console.log('✅ Campo championship já existe!');
      }
    } else {
      console.log('✅ Campo championship adicionado com sucesso!');
    }
    
    // Verificar a estrutura atualizada
    console.log('\n🔍 Verificando estrutura atualizada...');
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('*')
      .limit(1);

    if (poolsError) {
      console.error('❌ Erro ao verificar estrutura:', poolsError);
      return;
    }
    
    if (pools && pools.length > 0) {
      console.log('📊 Estrutura da tabela pools:');
      console.log(Object.keys(pools[0]));
      
      if (Object.keys(pools[0]).includes('championship')) {
        console.log('✅ Campo championship confirmado na estrutura!');
      } else {
        console.log('❌ Campo championship não encontrado na estrutura');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

addChampionshipField();