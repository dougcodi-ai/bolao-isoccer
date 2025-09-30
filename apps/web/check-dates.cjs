const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkDates() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Buscar algumas partidas para verificar as datas
    const { data: matches, error: matchesError } = await supabase
      .from('football_matches')
      .select(`
        id,
        start_time,
        home_team:football_teams!football_matches_home_team_id_fkey(name),
        away_team:football_teams!football_matches_away_team_id_fkey(name)
      `)
      .limit(5);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return;
    }

    console.log('=== VERIFICAÇÃO DE DATAS ===');
    matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.home_team?.name} vs ${match.away_team?.name}`);
      console.log(`   start_time (raw): ${match.start_time}`);
      console.log(`   start_time (Date): ${new Date(match.start_time)}`);
      console.log(`   start_time (ISO): ${new Date(match.start_time).toISOString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkDates();