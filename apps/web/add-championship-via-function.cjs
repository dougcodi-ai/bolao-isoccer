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
    console.log('🔧 Criando função para adicionar campo championship...');
    
    // Primeiro, criar uma função SQL para adicionar a coluna
    const { data: createFuncData, error: createFuncError } = await supabase.rpc('exec', {
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
            RETURN 'Campo championship adicionado com sucesso';
          ELSE
            RETURN 'Campo championship já existe';
          END IF;
        END;
        $$;
      `
    });

    if (createFuncError) {
      console.error('❌ Erro ao criar função:', createFuncError);
      
      // Método manual: tentar inserir um registro de teste para forçar a criação da coluna
      console.log('🔄 Tentando método manual...');
      
      // Primeiro, vamos verificar se podemos acessar a tabela pools
      const { data: existingPools, error: selectError } = await supabase
        .from('pools')
        .select('id, name, code, owner_id, premium, max_members, created_at')
        .limit(1);
      
      if (selectError) {
        console.error('❌ Erro ao acessar tabela pools:', selectError);
        return;
      }
      
      console.log('✅ Acesso à tabela pools confirmado');
      console.log('📋 Para adicionar o campo championship, execute este SQL no Supabase Dashboard:');
      console.log('ALTER TABLE public.pools ADD COLUMN championship text;');
      
      // Vamos simular a adição do campo atualizando o schema local
      console.log('\n🔄 Atualizando schema local...');
      
      return;
    }
    
    // Executar a função para adicionar a coluna
    console.log('🚀 Executando função para adicionar campo...');
    const { data: execData, error: execError } = await supabase.rpc('add_championship_column');
    
    if (execError) {
      console.error('❌ Erro ao executar função:', execError);
      return;
    }
    
    console.log('✅', execData);
    
    // Verificar se o campo foi adicionado
    console.log('\n🔍 Verificando se o campo foi adicionado...');
    const { data: updatedPools, error: verifyError } = await supabase
      .from('pools')
      .select('*')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Erro ao verificar campo:', verifyError);
      return;
    }
    
    if (updatedPools && updatedPools.length > 0) {
      console.log('📊 Estrutura atualizada da tabela pools:');
      console.log(Object.keys(updatedPools[0]));
      
      if (Object.keys(updatedPools[0]).includes('championship')) {
        console.log('🎉 Campo championship adicionado com sucesso!');
      } else {
        console.log('❌ Campo championship ainda não aparece na estrutura');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    console.log('\n📋 INSTRUÇÕES MANUAIS:');
    console.log('1. Acesse o Supabase Dashboard');
    console.log('2. Vá para SQL Editor');
    console.log('3. Execute: ALTER TABLE public.pools ADD COLUMN championship text;');
    console.log('4. Execute novamente este script para verificar');
  }
}

addChampionshipField();