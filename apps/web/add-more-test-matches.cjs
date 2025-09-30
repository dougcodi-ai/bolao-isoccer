const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ1MTM3MCwiZXhwIjoyMDczMDI3MzcwfQ.fcm325Qayb6UQW600aZmdPCkDcOiFx34-vV4gwc4KQ4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addMoreTestMatches() {
  console.log('🎯 Adicionando mais jogos para testar paginação...');
  
  try {
    const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
    const now = new Date();
    
    const teams = [
      'Atlético-MG', 'Botafogo', 'Cruzeiro', 'Bahia', 'Fortaleza',
      'Bragantino', 'Athletico-PR', 'Juventude', 'Criciúma', 'Vitória',
      'Atlético-GO', 'Cuiabá', 'Fluminense', 'Chapecoense', 'Sport'
    ];
    
    const matches = [];
    
    // Adicionar 15 jogos futuros (para testar paginação)
    for (let i = 0; i < 15; i++) {
      const homeTeam = teams[i % teams.length];
      const awayTeam = teams[(i + 1) % teams.length];
      const daysOffset = i + 3; // Começar em +3 dias
      
      matches.push({
        pool_id: poolId,
        home_team: homeTeam,
        away_team: awayTeam,
        start_time: new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    // Adicionar 15 jogos passados (para testar paginação)
    for (let i = 0; i < 15; i++) {
      const homeTeam = teams[(i + 2) % teams.length];
      const awayTeam = teams[(i + 3) % teams.length];
      const daysOffset = i + 3; // Começar em -3 dias
      const homeScore = Math.floor(Math.random() * 4);
      const awayScore = Math.floor(Math.random() * 4);
      
      matches.push({
        pool_id: poolId,
        home_team: homeTeam,
        away_team: awayTeam,
        start_time: new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000).toISOString(),
        home_score: homeScore,
        away_score: awayScore
      });
    }
    
    console.log(`📝 Inserindo ${matches.length} jogos adicionais...`);
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
    
    // Contar total de jogos no pool
    const { count, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);
    
    if (!countError) {
      console.log(`🎯 Total de jogos no pool: ${count}`);
      console.log('📄 Isso deve ser suficiente para testar a paginação (GAMES_PER_PAGE = 10)');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

addMoreTestMatches().catch(console.error);