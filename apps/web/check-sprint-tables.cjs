require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente do Supabase não encontradas");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log("🔍 Verificando tabelas do sistema de palpites...\n");

  // Verificar tabela championships
  try {
    const { data: championships, error } = await supabase
      .from("championships")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela championships não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela championships: ${championships.length} registros`);
      if (championships.length > 0) {
        console.log("   Exemplo:", championships[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar championships:", e.message);
  }

  // Verificar tabela teams
  try {
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela teams não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela teams: ${teams.length} registros`);
      if (teams.length > 0) {
        console.log("   Exemplo:", teams[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar teams:", e.message);
  }

  // Verificar tabela matches
  try {
    const { data: matches, error } = await supabase
      .from("matches")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela matches não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela matches: ${matches.length} registros`);
      if (matches.length > 0) {
        console.log("   Exemplo:", matches[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar matches:", e.message);
  }

  // Verificar tabela predictions
  try {
    const { data: predictions, error } = await supabase
      .from("predictions")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela predictions não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela predictions: ${predictions.length} registros`);
      if (predictions.length > 0) {
        console.log("   Exemplo:", predictions[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar predictions:", e.message);
  }
}

checkTables().catch(console.error);