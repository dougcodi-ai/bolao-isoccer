const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function ensureMatches() {
  const poolId = 'ce5de79a-d126-4f47-b040-3609ad30bad0';
  const season = '2025';
  
  console.log(`🎯 Adicionando jogos ao pool ${poolId} para a temporada ${season}...`);
  
  try {
    const response = await fetch(`http://localhost:3002/api/pools/${poolId}/ensure-matches?season=${season}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.text();
    console.log('📊 Status:', response.status);
    console.log('📋 Resposta:', result);
    
    if (response.ok) {
      console.log('✅ Jogos adicionados com sucesso!');
    } else {
      console.log('❌ Erro ao adicionar jogos');
    }
    
  } catch (error) {
    console.error('❌ Erro na requisição:', error);
  }
}

ensureMatches().catch(console.error);