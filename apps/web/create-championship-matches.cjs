const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createChampionshipMatches() {
  console.log('⚽ Criando jogos específicos para cada campeonato...\n');
  
  try {
    // Buscar os pools criados para cada campeonato
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .like('name', 'Bolão Teste%');
    
    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
      return;
    }
    
    console.log(`✅ Encontrados ${pools.length} pools de teste`);
    
    // Definir jogos para cada campeonato
    const matchesByChampionship = {
      'Brasileirão Série B': [
        { home: 'Sport', away: 'Ceará', date: '2025-01-25T16:00:00Z' },
        { home: 'Santos', away: 'Novorizontino', date: '2025-01-25T18:30:00Z' },
        { home: 'Goiás', away: 'Vila Nova', date: '2025-01-26T16:00:00Z' },
        { home: 'Operário-PR', away: 'Coritiba', date: '2025-01-26T18:30:00Z' },
        { home: 'Ponte Preta', away: 'Guarani', date: '2025-01-27T20:00:00Z' }
      ],
      'Copa do Brasil': [
        { home: 'Flamengo', away: 'Vasco', date: '2025-02-05T21:30:00Z' },
        { home: 'Palmeiras', away: 'São Paulo', date: '2025-02-06T21:30:00Z' },
        { home: 'Grêmio', away: 'Internacional', date: '2025-02-07T21:30:00Z' },
        { home: 'Atlético-MG', away: 'Cruzeiro', date: '2025-02-08T21:30:00Z' },
        { home: 'Corinthians', away: 'Santos', date: '2025-02-09T16:00:00Z' }
      ],
      'Libertadores': [
        { home: 'Flamengo', away: 'River Plate', date: '2025-03-05T21:30:00Z' },
        { home: 'Palmeiras', away: 'Boca Juniors', date: '2025-03-06T21:30:00Z' },
        { home: 'São Paulo', away: 'Nacional', date: '2025-03-07T19:15:00Z' },
        { home: 'Atlético-MG', away: 'Estudiantes', date: '2025-03-08T21:30:00Z' },
        { home: 'Grêmio', away: 'Peñarol', date: '2025-03-09T19:15:00Z' }
      ],
      'Sul-Americana': [
        { home: 'Corinthians', away: 'Racing', date: '2025-03-12T21:30:00Z' },
        { home: 'Santos', away: 'Independiente', date: '2025-03-13T21:30:00Z' },
        { home: 'Bahia', away: 'Lanús', date: '2025-03-14T19:15:00Z' },
        { home: 'Cruzeiro', away: 'Defensa y Justicia', date: '2025-03-15T21:30:00Z' },
        { home: 'Botafogo', away: 'Argentinos Juniors', date: '2025-03-16T19:15:00Z' }
      ]
    };
    
    let totalMatches = 0;
    
    // Criar jogos para cada pool
    for (const pool of pools) {
      console.log(`\n🎯 Criando jogos para: ${pool.name} (${pool.championship})`);
      
      const matches = matchesByChampionship[pool.championship];
      if (!matches) {
        console.log(`⚠️ Nenhum jogo definido para o campeonato: ${pool.championship}`);
        continue;
      }
      
      for (const match of matches) {
        const { data: createdMatch, error: matchError } = await supabase
          .from('matches')
          .insert({
            pool_id: pool.id,
            home_team: match.home,
            away_team: match.away,
            start_time: match.date
          })
          .select()
          .single();
        
        if (matchError) {
          console.error(`❌ Erro ao criar jogo ${match.home} vs ${match.away}:`, matchError);
        } else {
          console.log(`✅ Jogo criado: ${match.home} vs ${match.away}`);
          totalMatches++;
        }
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`🎉 Total de jogos criados: ${totalMatches}`);
    console.log(`📅 Jogos distribuídos entre ${pools.length} campeonatos diferentes`);
    
    console.log(`\n📝 Próximos passos:`);
    console.log(`1. Modificar lógica de carregamento para filtrar por campeonato`);
    console.log(`2. Testar funcionamento completo`);
    console.log(`3. Validar sistema pronto para deploy`);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createChampionshipMatches();