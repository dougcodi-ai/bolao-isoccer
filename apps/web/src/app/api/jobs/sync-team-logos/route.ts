import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { RapidAPIProvider } from "@/lib/football/adapters/rapidapi";

// Campeonatos canônicos
const CANONICAL_CODES = ["BRA-1", "BRA-2", "BRCUP", "LIB", "SULA"] as const;

export async function GET() {
  try {
    // Buscar times distintos presentes nos jogos dos campeonatos canônicos
    const { data: teamsQuery, error: teamsError } = await supabaseAdmin
      .from("football_matches")
      .select(
        `
        home_team:home_team_id(id,name,logo_path),
        away_team:away_team_id(id,name,logo_path),
        competition:competition_id(code)
        `
      )
      .in("competition_id.code", CANONICAL_CODES);

    if (teamsError) throw teamsError;

    // Consolidar times únicos
    const uniqueTeams: Record<string, { id: string; name: string; logo_path: string | null }> = {};
    (teamsQuery || []).forEach((row: any) => {
      const h = row.home_team;
      const a = row.away_team;
      if (h && h.id) uniqueTeams[h.id] = { id: h.id, name: h.name, logo_path: h.logo_path || null };
      if (a && a.id) uniqueTeams[a.id] = { id: a.id, name: a.name, logo_path: a.logo_path || null };
    });

    const provider = new RapidAPIProvider();
    const updated: string[] = [];
    const skipped: string[] = [];

    // Para cada time, se não tiver logo_path, tentar obter e subir
    for (const teamId of Object.keys(uniqueTeams)) {
      const team = uniqueTeams[teamId];
      if (team.logo_path) {
        skipped.push(team.name);
        continue;
      }

      // Tentar obter logo pela API externa
      let logoUrl: string | null = null;
      try {
        const teamInfo = await provider.getTeamInfoByName(team.name);
        logoUrl = teamInfo?.logo || null;
      } catch (e) {
        // Ignorar falhas pontuais
      }

      if (!logoUrl) {
        skipped.push(team.name);
        continue;
      }

      // Baixar bytes do logo
      const res = await fetch(logoUrl);
      if (!res.ok) {
        skipped.push(team.name);
        continue;
      }
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const path = `logos/${team.id}.png`;
      const { error: uploadError } = await supabaseAdmin.storage.from("team-logos").upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });
      if (uploadError) {
        skipped.push(team.name);
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from("football_teams")
        .update({ logo_path: path })
        .eq("id", team.id);
      if (updateError) {
        skipped.push(team.name);
        continue;
      }
      updated.push(team.name);
    }

    return NextResponse.json({ updatedCount: updated.length, skippedCount: skipped.length, updated, skipped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}