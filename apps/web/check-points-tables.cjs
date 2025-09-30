require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPointsTable() {
  console.log("🔍 Verificando tabelas de pontuação...\n");

  // Verificar tabela pool_points ou similar
  const tables = ["pool_points", "user_points", "rankings", "scores"];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(3);
      
      if (error) {
        console.log(`❌ Tabela ${table} não existe:`, error.message);
      } else {
        console.log(`✅ Tabela ${table} existe com ${data.length} registros`);
        if (data.length > 0) {
          console.log("   Exemplo:", data[0]);
        }
      }
    } catch (e) {
      console.log(`❌ Erro ao verificar ${table}:`, e.message);
    }
  }

  // Verificar estrutura da tabela predictions para pontuação
  try {
    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .limit(1);
    
    if (!error && data && data.length > 0) {
      console.log("\n📊 Estrutura da tabela predictions:");
      console.log("   Colunas:", Object.keys(data[0]));
    }
  } catch (e) {
    console.log("❌ Erro ao verificar predictions:", e.message);
  }
}

checkPointsTable().catch(console.error);