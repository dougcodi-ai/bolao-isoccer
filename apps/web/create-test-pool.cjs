require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function genCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function generateUniqueCode(maxTries = 5) {
  for (let i = 0; i < maxTries; i++) {
    const code = genCode(6);
    const { data, error } = await supabase.from("pools").select("id").eq("code", code).maybeSingle();
    if (!error && !data) return code;
  }
  return `IS-${Date.now().toString(36).toUpperCase()}`;
}

async function createTestPool() {
  try {
    console.log('Criando bolão de teste...');
    
    const code = await generateUniqueCode();
    
    // Criar um usuário de teste primeiro
    const testEmail = `test_${Date.now()}@example.com`;
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'test123456',
      email_confirm: true,
      user_metadata: { display_name: 'Usuário Teste' }
    });
    
    if (userError) {
      console.error('Erro ao criar usuário:', userError);
      return;
    }
    
    const userId = userData.user.id;
    console.log('Usuário criado:', userId);
    
    // Criar o bolão
    const insertPayload = {
      name: 'Bolão Teste - Brasileirão 2025',
      owner_id: userId,
      code,
      premium: false,
      max_members: 10
    };

    const { data: poolData, error: poolError } = await supabase
      .from("pools")
      .insert(insertPayload)
      .select("id, code")
      .single();

    if (poolError) {
      console.error('Erro ao criar bolão:', poolError);
      return;
    }

    console.log('Bolão criado:', poolData);

    // Adicionar o usuário como owner do bolão
    const { error: memberError } = await supabase
      .from("pool_members")
      .insert({ pool_id: poolData.id, user_id: userId, role: "owner" });

    if (memberError) {
      console.error('Erro ao adicionar membro:', memberError);
      return;
    }

    console.log('Usuário adicionado como owner do bolão');
    console.log('Código do bolão:', poolData.code);
    console.log('ID do bolão:', poolData.id);
    
    return { poolId: poolData.id, poolCode: poolData.code };
    
  } catch (error) {
    console.error('Erro geral:', error);
  }
}

createTestPool().then((result) => {
  if (result) {
    console.log('\n=== BOLÃO CRIADO COM SUCESSO ===');
    console.log('Pool ID:', result.poolId);
    console.log('Pool Code:', result.poolCode);
    console.log('\nAgora você pode executar o ensure-matches com este ID/código');
  }
  process.exit(0);
});