const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function analyzeRealMatches() {
  console.log('🔍 Analisando jogos REAIS no banco de dados...\n');
  
  try {
    // Buscar estrutura da tabela matches
    console.log('1️⃣ Verificando estrutura da tabela matches...');
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .limit(5);
    
    if (matchesError) {
      console.error('❌ Erro ao buscar matches:', matchesError);
      return;
    }
    
    if (matches && matches.length > 0) {
      console.log('✅ Estrutura da tabela matches:');
      console.log('Colunas:', Object.keys(matches[0]));
      console.log('\n📊 Exemplo de jogo:');
      console.log(JSON.stringify(matches[0], null, 2));
    }
    
    // Buscar total de jogos
    const { count: totalMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 Total de jogos no banco: ${totalMatches}`);
    
    // Analisar pools existentes
    console.log('\n2️⃣ Analisando pools existentes...');
    const { data: pools, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .order('created_at', { ascending: false });
    
    if (poolsError) {
      console.error('❌ Erro ao buscar pools:', poolsError);
      return;
    }
    
    console.log(`✅ Total de pools: ${pools.length}`);
    
    // Agrupar pools por campeonato
    const poolsByChampionship = {};
    pools.forEach(pool => {
      if (!poolsByChampionship[pool.championship]) {
        poolsByChampionship[pool.championship] = [];
      }
      poolsByChampionship[pool.championship].push(pool);
    });
    
    console.log('\n🏆 Pools por campeonato:');
    for (const [championship, championshipPools] of Object.entries(poolsByChampionship)) {
      console.log(`   ${championship}: ${championshipPools.length} pools`);
      championshipPools.forEach(pool => {
        console.log(`     • ${pool.name} (ID: ${pool.id})`);
      });
    }
    
    // Analisar jogos por pool
    console.log('\n3️⃣ Analisando jogos por pool...');
    for (const [championship, championshipPools] of Object.entries(poolsByChampionship)) {
      console.log(`\n🏆 Campeonato: ${championship}`);
      
      for (const pool of championshipPools) {
        const { data: poolMatches, count: poolMatchCount } = await supabase
          .from('matches')
          .select('*', { count: 'exact' })
          .eq('pool_id', pool.id);
        
        console.log(`   Pool: ${pool.name} - ${poolMatchCount} jogos`);
        
        if (poolMatches && poolMatches.length > 0) {
          // Mostrar alguns exemplos
          const examples = poolMatches.slice(0, 3);
          examples.forEach(match => {
            console.log(`     • ${match.home_team} vs ${match.away_team} (${new Date(match.start_time).toLocaleDateString()})`);
          });
          
          // Verificar se há campos que indicam campeonato
          const sampleMatch = poolMatches[0];
          const possibleChampionshipFields = ['competition', 'league', 'tournament', 'championship', 'round'];
          console.log(`     Campos possíveis para campeonato:`, 
            possibleChampionshipFields.filter(field => sampleMatch[field] !== undefined && sampleMatch[field] !== null)
              .map(field => `${field}: ${sampleMatch[field]}`)
          );
        }
      }
    }
    
    // Verificar se há jogos sem pool_id (jogos da API não associados)
    console.log('\n4️⃣ Verificando jogos sem pool_id...');
    const { data: orphanMatches, count: orphanCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact' })
      .is('pool_id', null)
      .limit(10);
    
    console.log(`📊 Jogos sem pool_id: ${orphanCount}`);
    
    if (orphanMatches && orphanMatches.length > 0) {
      console.log('Exemplos de jogos sem pool:');
      orphanMatches.slice(0, 5).forEach(match => {
        console.log(`   • ${match.home_team} vs ${match.away_team}`);
        // Verificar campos que podem indicar campeonato
        const fields = ['competition', 'league', 'tournament', 'championship', 'round'];
        const championshipInfo = fields.filter(field => match[field]).map(field => `${field}: ${match[field]}`);
        if (championshipInfo.length > 0) {
          console.log(`     ${championshipInfo.join(', ')}`);
        }
      });
    }
    
    // Buscar jogos únicos por campeonato/competição
    console.log('\n5️⃣ Analisando competições nos jogos...');
    
    // Verificar se existe campo competition
    const { data: competitionSample } = await supabase
      .from('matches')
      .select('competition')
      .not('competition', 'is', null)
      .limit(1);
    
    if (competitionSample && competitionSample.length > 0) {
      const { data: competitions } = await supabase
        .from('matches')
        .select('competition')
        .not('competition', 'is', null);
      
      const uniqueCompetitions = [...new Set(competitions.map(m => m.competition))];
      console.log('✅ Competições encontradas nos jogos:');
      uniqueCompetitions.forEach(comp => {
        console.log(`   • ${comp}`);
      });
    }
    
    // Verificar campo league
    const { data: leagueSample } = await supabase
      .from('matches')
      .select('league')
      .not('league', 'is', null)
      .limit(1);
    
    if (leagueSample && leagueSample.length > 0) {
      const { data: leagues } = await supabase
        .from('matches')
        .select('league')
        .not('league', 'is', null);
      
      const uniqueLeagues = [...new Set(leagues.map(m => m.league))];
      console.log('✅ Ligas encontradas nos jogos:');
      uniqueLeagues.forEach(league => {
        console.log(`   • ${league}`);
      });
    }
    
    console.log('\n✅ Análise concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante análise:', error);
  }
}

analyzeRealMatches();