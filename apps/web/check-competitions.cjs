const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkCompetitions() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Buscar todas as competições
    const { data: competitions, error: compError } = await supabase
      .from('football_competitions')
      .select('*')
      .order('code');

    if (compError) {
      console.error('Error fetching competitions:', compError);
      return;
    }

    console.log('=== COMPETIÇÕES DISPONÍVEIS ===');
    console.log(`Total: ${competitions.length}`);
    console.log('');

    competitions.forEach((comp, index) => {
      console.log(`${index + 1}. ${comp.name} (${comp.code})`);
      console.log(`   ID: ${comp.id}`);
      console.log(`   Provider: ${comp.ext_provider || 'N/A'}`);
      console.log(`   Ext ID: ${comp.ext_id || 'N/A'}`);
      console.log('');
    });

    // Para cada competição, verificar se há temporadas e times
    for (const comp of competitions) {
      console.log(`=== VERIFICANDO ${comp.code} ===`);
      
      // Buscar temporadas
      const { data: seasons, error: seasonError } = await supabase
        .from('football_seasons')
        .select('*')
        .eq('competition_id', comp.id)
        .order('year', { ascending: false });

      if (seasonError) {
        console.error(`Error fetching seasons for ${comp.code}:`, seasonError);
        continue;
      }

      console.log(`Temporadas: ${seasons.length}`);
      seasons.forEach(season => {
        console.log(`  - ${season.year} (${season.name})`);
      });

      if (seasons.length > 0) {
        // Verificar times da temporada mais recente
        const latestSeason = seasons[0];
        const { data: matchTeams, error: teamsError } = await supabase
          .from('football_matches')
          .select(`
            home_team:football_teams!football_matches_home_team_id_fkey(id, name),
            away_team:football_teams!football_matches_away_team_id_fkey(id, name)
          `)
          .eq('season_id', latestSeason.id)
          .limit(10);

        if (teamsError) {
          console.error(`Error fetching teams for ${comp.code}:`, teamsError);
        } else {
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

          const teams = Array.from(teamsMap.values());
          console.log(`Times na temporada ${latestSeason.year}: ${teams.length}`);
          if (teams.length > 0) {
            console.log(`  Exemplos: ${teams.slice(0, 3).map(t => t.name).join(', ')}`);
          }
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkCompetitions();