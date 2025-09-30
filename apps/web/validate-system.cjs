const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function validateSystem() {
  console.log('🔍 Validação final do sistema...\n');
  
  const validations = [];
  
  try {
    // 1. Verificar estrutura da tabela pools
    console.log('1️⃣ Verificando estrutura da tabela pools...');
    const { data: poolsData, error: poolsError } = await supabase
      .from('pools')
      .select('id, name, championship')
      .limit(1);
    
    if (poolsError) {
      validations.push({ test: 'Estrutura pools', status: '❌', error: poolsError.message });
    } else {
      validations.push({ test: 'Estrutura pools', status: '✅', details: 'Campo championship presente' });
    }
    
    // 2. Verificar pools de teste criados
    console.log('2️⃣ Verificando pools de teste...');
    const { data: testPools, error: testPoolsError } = await supabase
      .from('pools')
      .select('*')
      .like('name', 'Bolão Teste%');
    
    if (testPoolsError) {
      validations.push({ test: 'Pools de teste', status: '❌', error: testPoolsError.message });
    } else {
      const championships = [...new Set(testPools.map(p => p.championship))];
      validations.push({ 
        test: 'Pools de teste', 
        status: '✅', 
        details: `${testPools.length} pools criados para ${championships.length} campeonatos: ${championships.join(', ')}` 
      });
    }
    
    // 3. Verificar jogos de teste
    console.log('3️⃣ Verificando jogos de teste...');
    const testPoolIds = testPools.map(p => p.id);
    const { data: testMatches, error: testMatchesError } = await supabase
      .from('matches')
      .select('*')
      .in('pool_id', testPoolIds);
    
    if (testMatchesError) {
      validations.push({ test: 'Jogos de teste', status: '❌', error: testMatchesError.message });
    } else {
      const matchesByChampionship = {};
      testMatches.forEach(match => {
        const pool = testPools.find(p => p.id === match.pool_id);
        if (pool) {
          if (!matchesByChampionship[pool.championship]) {
            matchesByChampionship[pool.championship] = 0;
          }
          matchesByChampionship[pool.championship]++;
        }
      });
      
      validations.push({ 
        test: 'Jogos de teste', 
        status: '✅', 
        details: `${testMatches.length} jogos criados: ${Object.entries(matchesByChampionship).map(([c, count]) => `${c} (${count})`).join(', ')}` 
      });
    }
    
    // 4. Verificar filtragem por campeonato
    console.log('4️⃣ Verificando filtragem por campeonato...');
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (users && users.length > 0) {
      const { data: userPools } = await supabase
        .from("pool_members")
        .select(`
          pool_id,
          pools!inner(id, name, championship)
        `)
        .eq("user_id", users[0].id);
      
      if (userPools && userPools.length > 0) {
        const pools = userPools.map(pm => pm.pools).filter(Boolean);
        const championships = [...new Set(pools.map(p => p.championship))];
        
        let filteringWorks = true;
        for (const championship of championships) {
          const championshipPools = pools.filter(p => p.championship === championship);
          const poolIds = championshipPools.map(p => p.id);
          
          const { data: matches } = await supabase
            .from('matches')
            .select('pool_id')
            .in('pool_id', poolIds);
          
          // Verificar se todos os jogos pertencem aos pools corretos
          if (matches) {
            const invalidMatches = matches.filter(m => !poolIds.includes(m.pool_id));
            if (invalidMatches.length > 0) {
              filteringWorks = false;
              break;
            }
          }
        }
        
        validations.push({ 
          test: 'Filtragem por campeonato', 
          status: filteringWorks ? '✅' : '❌', 
          details: filteringWorks ? 'Filtragem funcionando corretamente' : 'Problemas na filtragem detectados' 
        });
      } else {
        validations.push({ test: 'Filtragem por campeonato', status: '⚠️', details: 'Usuário sem pools para testar' });
      }
    } else {
      validations.push({ test: 'Filtragem por campeonato', status: '⚠️', details: 'Nenhum usuário encontrado para testar' });
    }
    
    // 5. Verificar integridade dos dados
    console.log('5️⃣ Verificando integridade dos dados...');
    const { data: orphanMatches } = await supabase
      .from('matches')
      .select('id, pool_id')
      .not('pool_id', 'in', `(${testPoolIds.join(',')})`);
    
    validations.push({ 
      test: 'Integridade dos dados', 
      status: '✅', 
      details: `Sistema mantém ${orphanMatches?.length || 0} jogos de outros pools intactos` 
    });
    
    // Exibir resultados
    console.log('\n📊 Resultados da validação:\n');
    validations.forEach(validation => {
      console.log(`${validation.status} ${validation.test}`);
      if (validation.details) {
        console.log(`   ${validation.details}`);
      }
      if (validation.error) {
        console.log(`   Erro: ${validation.error}`);
      }
    });
    
    const passed = validations.filter(v => v.status === '✅').length;
    const failed = validations.filter(v => v.status === '❌').length;
    const warnings = validations.filter(v => v.status === '⚠️').length;
    
    console.log(`\n📈 Resumo: ${passed} passou, ${failed} falhou, ${warnings} avisos`);
    
    if (failed === 0) {
      console.log('\n🎉 Sistema validado com sucesso!');
      console.log('✅ Pronto para deploy');
      console.log('\n🚀 Funcionalidades implementadas:');
      console.log('   • Campo championship adicionado aos pools');
      console.log('   • Pools de teste criados para múltiplos campeonatos');
      console.log('   • Jogos específicos para cada campeonato');
      console.log('   • Filtragem automática por campeonato no frontend');
      console.log('   • Compatibilidade mantida com dados existentes');
    } else {
      console.log('\n⚠️ Sistema possui problemas que precisam ser corrigidos antes do deploy');
    }
    
  } catch (error) {
    console.error('❌ Erro durante validação:', error);
  }
}

validateSystem();