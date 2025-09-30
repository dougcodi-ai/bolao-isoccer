const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTeams() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Buscar a competição BRA-1
    const { data: competitions, error: compError } = await supabase
      .from('football_competitions')
      .select('*')
      .eq('code', 'BRA-1');

    if (compError) {
      console.error('Error fetching competitions:', compError);
      return;
    }

    console.log('=== COMPETIÇÕES ===');
    console.log(competitions);

    if (competitions.length === 0) {
      console.log('Nenhuma competição BRA-1 encontrada');
      return;
    }

    const competitionId = competitions[0].id;

    // Buscar a temporada 2025
    const { data: seasons, error: seasonError } = await supabase
      .from('football_seasons')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('year', 2025);

    if (seasonError) {
      console.error('Error fetching seasons:', seasonError);
      return;
    }

    console.log('\n=== TEMPORADAS ===');
    console.log(seasons);

    if (seasons.length === 0) {
      console.log('Nenhuma temporada 2025 encontrada');
      return;
    }

    const seasonId = seasons[0].id;

    // Buscar todos os times da temporada através das partidas
    const { data: matchTeams, error: teamsError } = await supabase
      .from('football_matches')
      .select(`
        home_team:football_teams!football_matches_home_team_id_fkey(id, name, short_name, acronym),
        away_team:football_teams!football_matches_away_team_id_fkey(id, name, short_name, acronym)
      `)
      .eq('season_id', seasonId);

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return;
    }

    // Extrair times únicos
    const teamsMap = new Map();
    matchTeams.forEach(match => {
      if (match.home_team) {
        teamsMap.set(match.home_team.id, match.home_team);
      }
      if (match.away_team) {
        teamsMap.set(match.away_team.id, match.away_team);
      }
    });

    const teams = Array.from(teamsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    console.log('\n=== TIMES (Total: ' + teams.length + ') ===');
    teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name} (${team.short_name || team.acronym || 'N/A'}) - ID: ${team.id}`);
    });

    // Buscar algumas partidas para verificar
    const { data: matches, error: matchesError } = await supabase
      .from('football_matches')
      .select(`
        *,
        home_team:football_teams!football_matches_home_team_id_fkey(name),
        away_team:football_teams!football_matches_away_team_id_fkey(name)
      `)
      .eq('season_id', seasonId)
      .limit(5);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return;
    }

    console.log('\n=== PARTIDAS (Primeiras 5) ===');
    matches.forEach((match, index) => {
      console.log(`${index + 1}. ${match.home_team?.name} vs ${match.away_team?.name} - ${new Date(match.start_time).toLocaleDateString()}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkTeams();