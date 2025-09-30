require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkFootballTables() {
  console.log("🔍 Verificando tabelas de futebol canônicas...\n");

  // Verificar tabela football_competitions
  try {
    const { data: competitions, error } = await supabase
      .from("football_competitions")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela football_competitions não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela football_competitions: ${competitions.length} registros`);
      if (competitions.length > 0) {
        console.log("   Exemplo:", competitions[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar football_competitions:", e.message);
  }

  // Verificar tabela football_seasons
  try {
    const { data: seasons, error } = await supabase
      .from("football_seasons")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela football_seasons não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela football_seasons: ${seasons.length} registros`);
      if (seasons.length > 0) {
        console.log("   Exemplo:", seasons[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar football_seasons:", e.message);
  }

  // Verificar tabela football_matches
  try {
    const { data: matches, error } = await supabase
      .from("football_matches")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela football_matches não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela football_matches: ${matches.length} registros`);
      if (matches.length > 0) {
        console.log("   Exemplo:", matches[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar football_matches:", e.message);
  }

  // Verificar tabela football_teams
  try {
    const { data: teams, error } = await supabase
      .from("football_teams")
      .select("*")
      .limit(5);
    
    if (error) {
      console.log("❌ Tabela football_teams não existe ou erro:", error.message);
    } else {
      console.log(`📊 Tabela football_teams: ${teams.length} registros`);
      if (teams.length > 0) {
        console.log("   Exemplo:", teams[0]);
      }
    }
  } catch (e) {
    console.log("❌ Erro ao verificar football_teams:", e.message);
  }

  console.log("\n✅ Verificação concluída!");
}

checkFootballTables().catch(console.error);