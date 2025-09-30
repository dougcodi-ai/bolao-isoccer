require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCreatePool() {
  console.log('🧪 Testando criação de bolão...\n');

  try {
    // 1. Login com usuário de teste
    console.log('1. Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'teste@bolao.com',
      password: '123456789'
    });

    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    console.log('   - Usuário:', authData.user.email);
    console.log('   - ID:', authData.user.id);

    // 2. Gerar código único
    console.log('\n2. Gerando código único...');
    
    function generateCode(length = 6) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }

    async function generateUniqueCode(maxAttempts = 10) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generateCode(6);
        
        const { data, error } = await supabase
          .from("pools")
          .select("id")
          .eq("code", code)
          .maybeSingle();
        
        if (!error && !data) {
          return code;
        }
      }
      
      return `IS-${Date.now().toString(36).toUpperCase()}`;
    }

    const uniqueCode = await generateUniqueCode();
    console.log('✅ Código único gerado:', uniqueCode);

    // 3. Criar bolão de teste
    console.log('\n3. Criando bolão de teste...');
    
    const poolData = {
      name: `Teste Bolão ${Date.now()}`,
      owner_id: authData.user.id,
      code: uniqueCode,
      premium: false,
      max_members: 10,
      created_at: new Date().toISOString(),
    };

    console.log('   - Dados do bolão:', poolData);

    const { data: poolResult, error: poolError } = await supabase
      .from("pools")
      .insert(poolData)
      .select("id, code, name")
      .single();

    if (poolError) {
      console.error('❌ Erro ao criar bolão:', poolError.message);
      return;
    }

    console.log('✅ Bolão criado com sucesso!');
    console.log('   - ID:', poolResult.id);
    console.log('   - Nome:', poolResult.name);
    console.log('   - Código:', poolResult.code);

    // 4. Adicionar criador como owner
    console.log('\n4. Adicionando criador como owner...');
    
    const { error: memberError } = await supabase
      .from("pool_members")
      .insert({
        pool_id: poolResult.id,
        user_id: authData.user.id,
        role: "owner",
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('❌ Erro ao adicionar como membro:', memberError.message);
      return;
    }

    console.log('✅ Usuário adicionado como owner do bolão');

    // 5. Verificar se bolão aparece na lista do usuário
    console.log('\n5. Verificando se bolão aparece na lista do usuário...');
    
    const { data: userPools, error: poolsError } = await supabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        pools!inner(id, name, code, owner_id, premium, max_members, created_at)
      `)
      .eq('user_id', authData.user.id);

    if (poolsError) {
      console.error('❌ Erro ao buscar bolões do usuário:', poolsError.message);
      return;
    }

    console.log('✅ Bolões do usuário encontrados:', userPools.length);
    
    const createdPool = userPools.find(p => p.pools.id === poolResult.id);
    if (createdPool) {
      console.log('✅ Bolão criado encontrado na lista do usuário!');
      console.log('   - Nome:', createdPool.pools.name);
      console.log('   - Papel:', createdPool.role);
      console.log('   - Código:', createdPool.pools.code);
    } else {
      console.log('❌ Bolão criado NÃO encontrado na lista do usuário');
    }

    // 6. Testar geração de calendário de partidas (opcional)
    console.log('\n6. Testando geração de calendário de partidas...');
    
    try {
      const response = await fetch(`http://localhost:3002/api/pools/${poolResult.id}/ensure-matches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Calendário de partidas gerado com sucesso');
      } else {
        console.log('⚠️ Falha ao gerar calendário de partidas (não crítico)');
      }
    } catch (error) {
      console.log('⚠️ Erro ao gerar calendário de partidas (não crítico):', error.message);
    }

    console.log('\n🎉 Teste de criação de bolão concluído com sucesso!');
    console.log('📋 Resumo:');
    console.log(`   - Bolão criado: ${poolResult.name}`);
    console.log(`   - Código de convite: ${poolResult.code}`);
    console.log(`   - ID do bolão: ${poolResult.id}`);
    console.log(`   - Campeonato: ${poolData.championship}`);
    console.log(`   - Máximo de membros: ${poolData.max_members}`);

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
  }
}

testCreatePool();