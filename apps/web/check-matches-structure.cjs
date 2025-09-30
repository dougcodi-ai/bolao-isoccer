const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatchesStructure() {
  console.log('🔍 Verificando estrutura da tabela matches...');
  
  try {
    // Tentar inserir um jogo simples para ver quais campos são aceitos
    const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const testMatch = {
      pool_id: poolId,
      home_team: 'Teste Casa',
      away_team: 'Teste Visitante',
      start_time: futureDate.toISOString()
    };
    
    console.log('🎯 Tentando inserir jogo de teste...');
    const { data, error } = await supabase
      .from('matches')
      .insert([testMatch])
      .select();
    
    if (error) {
      console.error('❌ Erro ao inserir:', error);
    } else {
      console.log('✅ Jogo inserido com sucesso!');
      console.log('📋 Dados inseridos:', data[0]);
      
      // Agora deletar o jogo de teste
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('id', data[0].id);
      
      if (deleteError) {
        console.log('⚠️ Erro ao deletar jogo de teste:', deleteError);
      } else {
        console.log('🗑️ Jogo de teste removido');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMatchesStructure().catch(console.error);