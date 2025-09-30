const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ1MTM3MCwiZXhwIjoyMDczMDI3MzcwfQ.fcm325Qayb6UQW600aZmdPCkDcOiFx34-vV4gwc4KQ4';

// Usar service role para contornar RLS
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addTestMatches() {
  console.log('🎯 Adicionando jogos de teste ao pool...');
  
  try {
    const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
    const now = new Date();
    
    // Criar jogos de teste
    const matches = [
      // Jogos futuros
      {
        pool_id: poolId,
        home_team: 'Flamengo',
        away_team: 'Palmeiras',
        start_time: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // +1 dia
      },
      {
        pool_id: poolId,
        home_team: 'São Paulo',
        away_team: 'Corinthians',
        start_time: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString() // +2 dias
      },
      // Jogos passados com placares
      {
        pool_id: poolId,
        home_team: 'Santos',
        away_team: 'Vasco',
        start_time: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // -1 dia
        home_score: 2,
        away_score: 1
      },
      {
        pool_id: poolId,
        home_team: 'Grêmio',
        away_team: 'Internacional',
        start_time: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(), // -2 dias
        home_score: 0,
        away_score: 3
      }
    ];
    
    console.log('📝 Inserindo jogos...');
    const { data, error } = await supabase
      .from('matches')
      .insert(matches)
      .select();
    
    if (error) {
      console.error('❌ Erro ao inserir jogos:', error);
      return;
    }
    
    console.log('✅ Jogos inseridos com sucesso!');
    console.log(`📊 Total de jogos criados: ${data.length}`);
    
    // Mostrar os jogos criados
    data.forEach((match, index) => {
      console.log(`${index + 1}. ${match.home_team} vs ${match.away_team}`);
      console.log(`   📅 ${new Date(match.start_time).toLocaleString('pt-BR')}`);
      if (match.home_score !== null && match.away_score !== null) {
        console.log(`   ⚽ Placar: ${match.home_score} x ${match.away_score}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

addTestMatches().catch(console.error);