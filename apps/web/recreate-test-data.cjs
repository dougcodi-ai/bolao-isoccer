const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const supabaseUrl = 'https://rltqilyhdtwyriovfetx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsdHFpbHloZHR3eXJpb3ZmZXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTEzNzAsImV4cCI6MjA3MzAyNzM3MH0.1ASjcmXPJoaBE3MCr1FeMtPxn2r9MRFZtOSVMUNs49U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateUniqueCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const { data } = await supabase
      .from('pools')
      .select('id')
      .eq('code', code)
      .single();
    
    if (!data) break;
    attempts++;
  } while (attempts < maxAttempts);

  return code;
}

async function recreateTestData() {
  try {
    console.log('🔄 Recriando dados de teste...');
    
    // Primeiro, limpar dados existentes
    console.log('🧹 Limpando dados existentes...');
    await supabase.from('pool_members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('pools').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Criar um usuário de teste primeiro
    console.log('👤 Criando usuário de teste...');
    const testEmail = `test_${Date.now()}@example.com`;
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'test123456',
      email_confirm: true,
      user_metadata: { display_name: 'Usuário Teste' }
    });

    if (userError) {
      console.error('❌ Erro ao criar usuário:', userError);
      return;
    }

    const testUserId = userData.user.id;
    console.log(`✅ Usuário criado: ${testUserId} (${testEmail})`);
    
    // Criar bolões de teste
    console.log('📊 Criando bolões de teste...');
    
    const createdPools = [];
    
    for (let i = 1; i <= 45; i++) {
      const code = await generateUniqueCode();
      const insertPayload = {
        name: `Bolão Teste ${i}`,
        owner_id: testUserId,
        code,
        premium: i % 5 === 0, // Cada 5º bolão é premium
        max_members: 50
      };

      const { data: poolData, error: poolError } = await supabase
        .from("pools")
        .insert(insertPayload)
        .select("id, code, name")
        .single();

      if (poolError) {
        console.error(`❌ Erro ao criar bolão ${i}:`, poolError);
        continue;
      }

      createdPools.push(poolData);

      // Adicionar o usuário como owner do bolão
      const { error: memberError } = await supabase
        .from("pool_members")
        .insert({ pool_id: poolData.id, user_id: testUserId, role: "owner" });

      if (memberError) {
        console.error(`❌ Erro ao adicionar membro ao bolão ${i}:`, memberError);
      }
    }

    console.log(`✅ ${createdPools.length} bolões criados com sucesso!`);
    console.log('🎉 Dados de teste recriados com sucesso!');
    console.log(`📋 Resumo:`);
    console.log(`   - ${createdPools.length} bolões criados`);
    console.log(`   - Usuário de teste: ${testEmail} (${testUserId})`);
    console.log(`   - Códigos dos bolões: ${createdPools.slice(0, 5).map(p => p.code).join(', ')}...`);

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

recreateTestData();