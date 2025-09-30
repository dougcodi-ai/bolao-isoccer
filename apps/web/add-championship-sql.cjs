require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addChampionshipField() {
  try {
    console.log('🔧 Tentando adicionar campo championship via SQL...');
    
    // Método 1: Tentar usar a função sql() do Supabase
    try {
      console.log('📝 Método 1: Usando supabase.sql()...');
      
      const result = await supabase.sql`
        ALTER TABLE public.pools 
        ADD COLUMN IF NOT EXISTS championship text;
      `;
      
      console.log('✅ Campo championship adicionado via sql()!', result);
      
      // Adicionar índice
      await supabase.sql`
        CREATE INDEX IF NOT EXISTS idx_pools_championship ON public.pools(championship);
      `;
      
      console.log('✅ Índice criado!');
      
    } catch (sqlError) {
      console.log('❌ Método sql() falhou:', sqlError.message);
      
      // Método 2: Tentar usar rpc com uma função personalizada
      console.log('📝 Método 2: Criando função personalizada...');
      
      try {
        // Primeiro, criar a função
        const { data: createFunc, error: createFuncError } = await supabase.rpc('exec', {
          sql: `
            CREATE OR REPLACE FUNCTION add_championship_column()
            RETURNS text
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
              -- Verificar se a coluna já existe
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND table_name = 'pools' 
                  AND column_name = 'championship'
              ) THEN
                -- Adicionar a coluna
                ALTER TABLE public.pools ADD COLUMN championship text;
                -- Criar índice
                CREATE INDEX IF NOT EXISTS idx_pools_championship ON public.pools(championship);
                RETURN 'Campo championship adicionado com sucesso';
              ELSE
                RETURN 'Campo championship já existe';
              END IF;
            END;
            $$;
          `
        });
        
        if (createFuncError) {
          console.log('❌ Erro ao criar função:', createFuncError.message);
          throw createFuncError;
        }
        
        // Executar a função
        const { data: execResult, error: execError } = await supabase.rpc('add_championship_column');
        
        if (execError) {
          console.log('❌ Erro ao executar função:', execError.message);
          throw execError;
        }
        
        console.log('✅ Resultado:', execResult);
        
      } catch (rpcError) {
        console.log('❌ Método RPC falhou:', rpcError.message);
        
        // Método 3: Instruções manuais
        console.log('\n📋 INSTRUÇÕES MANUAIS:');
        console.log('O campo championship precisa ser adicionado manualmente via Supabase Dashboard.');
        console.log('Acesse: https://supabase.com/dashboard/project/[seu-projeto]/editor');
        console.log('Execute este SQL:');
        console.log('');
        console.log('ALTER TABLE public.pools ADD COLUMN championship text;');
        console.log('CREATE INDEX IF NOT EXISTS idx_pools_championship ON public.pools(championship);');
        console.log('');
        console.log('Depois execute este script novamente para atualizar os pools existentes.');
        return false;
      }
    }
    
    // Se chegou até aqui, o campo foi adicionado. Vamos atualizar os pools existentes
    console.log('\n📝 Atualizando pools existentes...');
    
    // Verificar se o campo foi realmente adicionado
    const { data: testPools, error: testError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erro ao verificar campo:', testError);
      return false;
    }
    
    console.log('✅ Campo championship confirmado na estrutura!');
    
    // Buscar pools sem championship
    const { data: poolsToUpdate, error: fetchError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .is('championship', null);
    
    if (fetchError) {
      console.error('❌ Erro ao buscar pools:', fetchError);
      return false;
    }
    
    console.log(`📊 Encontrados ${poolsToUpdate.length} pools para atualizar`);
    
    // Atualizar cada pool
    for (const pool of poolsToUpdate) {
      let championship = 'Brasileirão Série A'; // Padrão
      
      const poolName = pool.name.toLowerCase();
      if (poolName.includes('brasileirão') || poolName.includes('série a') || poolName.includes('serie a')) {
        championship = 'Brasileirão Série A';
      } else if (poolName.includes('série b') || poolName.includes('serie b')) {
        championship = 'Brasileirão Série B';
      } else if (poolName.includes('copa do brasil') || poolName.includes('copa brasil')) {
        championship = 'Copa do Brasil';
      } else if (poolName.includes('libertadores')) {
        championship = 'Copa Libertadores';
      } else if (poolName.includes('sul-americana') || poolName.includes('sulamericana')) {
        championship = 'Copa Sul-Americana';
      }
      
      const { error: updateError } = await supabase
        .from('pools')
        .update({ championship })
        .eq('id', pool.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar pool ${pool.name}:`, updateError);
      } else {
        console.log(`✅ Pool "${pool.name}" → ${championship}`);
      }
    }
    
    // Verificar resultado final
    console.log('\n🔍 Verificando resultado final...');
    const { data: finalPools, error: finalError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(10);
    
    if (finalError) {
      console.error('❌ Erro ao verificar resultado:', finalError);
      return false;
    }
    
    console.log('📊 Pools atualizados:');
    finalPools.forEach((pool, index) => {
      console.log(`  ${index + 1}. ${pool.name} - ${pool.championship || 'Não definido'}`);
    });
    
    console.log('\n🎉 Migração concluída com sucesso!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return false;
  }
}

addChampionshipField();