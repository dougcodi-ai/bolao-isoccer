const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAvailableCompetitions() {
  console.log('🔍 Verificando competições disponíveis no banco...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Listar todas as competições
    console.log('1️⃣ Todas as competições no banco:');
    const { data: competitions, error: compError } = await supabase
      .from('football_competitions')
      .select('*')
      .order('name');

    if (compError) {
      console.error('❌ Erro ao buscar competições:', compError.message);
      return;
    }

    console.log(`✅ Encontradas ${competitions.length} competições:`);
    competitions.forEach((comp, index) => {
      console.log(`   ${index + 1}. ${comp.name} (${comp.code}) - ID: ${comp.id}`);
    });

    // 2. Verificar temporadas para cada competição
    console.log('\n2️⃣ Verificando temporadas disponíveis...');
    
    for (const comp of competitions) {
      const { data: seasons } = await supabase
        .from('football_seasons')
        .select('*')
        .eq('competition_id', comp.id)
        .order('year', { ascending: false });

      console.log(`\n🏆 ${comp.name} (${comp.code}):`);
      if (seasons && seasons.length > 0) {
        console.log(`   📅 Temporadas: ${seasons.map(s => s.year).join(', ')}`);
        
        // Verificar jogos para temporada mais recente
        const latestSeason = seasons[0];
        const { data: matches } = await supabase
          .from('football_matches')
          .select('id, start_time, status')
          .eq('competition_id', comp.id)
          .eq('season_id', latestSeason.id)
          .limit(5);

        if (matches && matches.length > 0) {
          console.log(`   ⚽ ${matches.length} jogos encontrados na temporada ${latestSeason.year}`);
          
          // Mostrar alguns jogos
          const { data: sampleMatches } = await supabase
            .from('football_matches')
            .select(`
              start_time,
              status,
              home_team:football_teams!home_team_id(name),
              away_team:football_teams!away_team_id(name)
            `)
            .eq('competition_id', comp.id)
            .eq('season_id', latestSeason.id)
            .order('start_time')
            .limit(3);

          if (sampleMatches) {
            console.log(`   📋 Exemplos de jogos:`);
            sampleMatches.forEach((match, index) => {
              const date = new Date(match.start_time).toLocaleDateString('pt-BR');
              console.log(`      ${index + 1}. ${match.home_team?.name || 'Time A'} vs ${match.away_team?.name || 'Time B'} - ${date}`);
            });
          }
        } else {
          console.log(`   ⚠️ Nenhum jogo encontrado na temporada ${latestSeason.year}`);
        }
      } else {
        console.log(`   ❌ Nenhuma temporada encontrada`);
      }
    }

    // 3. Criar mapeamento correto baseado nas competições existentes
    console.log('\n3️⃣ Criando mapeamento correto baseado nas competições existentes...');
    
    const championshipMapping = {};
    
    // Mapear baseado nos nomes/códigos encontrados
    competitions.forEach(comp => {
      const name = comp.name.toLowerCase();
      const code = comp.code.toLowerCase();
      
      if (name.includes('brasileirão') || name.includes('brasileiro') || code.includes('bra')) {
        if (name.includes('série a') || name.includes('serie a') || code.includes('1')) {
          championshipMapping['Brasileirão Série A'] = comp.code;
        } else if (name.includes('série b') || name.includes('serie b') || code.includes('2')) {
          championshipMapping['Brasileirão Série B'] = comp.code;
        }
      } else if (name.includes('copa do brasil') || code.includes('cup')) {
        championshipMapping['Copa do Brasil'] = comp.code;
      } else if (name.includes('libertadores')) {
        championshipMapping['Libertadores'] = comp.code;
      } else if (name.includes('sul-americana') || name.includes('sudamericana')) {
        championshipMapping['Sul-Americana'] = comp.code;
      }
    });

    console.log('🗺️ Mapeamento sugerido:');
    Object.entries(championshipMapping).forEach(([champ, code]) => {
      console.log(`   ${champ} → ${code}`);
    });

    if (Object.keys(championshipMapping).length === 0) {
      console.log('⚠️ Nenhum mapeamento automático encontrado. Competições disponíveis:');
      competitions.forEach(comp => {
        console.log(`   - ${comp.name} (${comp.code})`);
      });
    }

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante verificação:', error.message);
  }
}

checkAvailableCompetitions();