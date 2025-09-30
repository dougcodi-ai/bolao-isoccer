import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFootballProvider } from "@/lib/football";
import type { Team as FTeam, Match as FMatch } from "@/lib/football/types";
import { getMockDataForCompetition } from "@/lib/football/mock-data-selector";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const competitionCode = (url.searchParams.get("competition") || "BRA-1").trim();
    const seasonYear = Number(url.searchParams.get("season") || 2025);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        error: "Missing Supabase envs",
        hint: "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local",
      }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Garantir bucket de logos
    const BUCKET = "team-logos";
    try {
      const { data: bucket, error: bucketErr } = await sb.storage.getBucket(BUCKET);
      if (bucketErr || !bucket) {
        await sb.storage.createBucket(BUCKET, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024, // 5MB
          allowedMimeTypes: ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"],
        });
      }
    } catch (_) {
      // continua mesmo se não conseguir criar; uploads irão falhar e cair no fallback
    }

    // Tenta obter provider real; se falhar, usa mock local
    let provider: ReturnType<typeof getFootballProvider> | null = null;
try {
      provider = getFootballProvider();
    } catch (_) {
      provider = null;
    }
    const extProvider = "mock";

    // 1) Upsert competition
    let competitionName = competitionCode;
    if (competitionCode === "BRA-1") competitionName = "Brasileirão Série A";
    else if (competitionCode === "BRA-2") competitionName = "Brasileirão Série B";
    else if (competitionCode === "BRA-CUP") competitionName = "Copa do Brasil";
    const { data: compRows, error: compErr } = await sb
      .from("football_competitions")
      .upsert(
        [{ code: competitionCode, name: competitionName, country: "Brasil", ext_provider: extProvider, ext_id: competitionCode }],
        { onConflict: "code" }
      )
      .select("id, code").limit(1);
    if (compErr || !compRows?.[0]) throw new Error(compErr?.message || "Failed to upsert competition");
    const competitionId = compRows[0].id as string;

    // 2) Upsert season
    const { data: seasonRows, error: seasonErr } = await sb
      .from("football_seasons")
      .upsert(
        [{ competition_id: competitionId, year: seasonYear, name: `${seasonYear}` }],
        { onConflict: "competition_id,year" }
      )
      .select("id, year").limit(1);
    if (seasonErr || !seasonRows?.[0]) throw new Error(seasonErr?.message || "Failed to upsert season");
    const seasonId = seasonRows[0].id as string;

    // 3) Ensure fallback logo exists once
    const fallbackPath = "fallbacks/generic.svg";
    const fallbackSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='120' height='120' rx='16' fill='#E5E7EB'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='28' fill='#4B5563'>FC</text></svg>`;
    try {
      await sb.storage.from("team-logos").upload(fallbackPath, new Blob([fallbackSvg], { type: "image/svg+xml" }), { upsert: true, contentType: "image/svg+xml" });
    } catch (_) {
      // ignore
    }

    const sanitize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

    async function ingestLogo(team: FTeam): Promise<string> {
      const fileBase = `logos/${competitionCode}/${seasonYear}/${sanitize(team.acronym || team.shortName || team.name || "team")}`;
      // Prefer provider-reported URL if available via getTeamLogoUrl
      let logoUrl: string | null = null;
      try {
        if (provider && typeof provider.getTeamLogoUrl === "function") {
          logoUrl = await provider.getTeamLogoUrl(team);
        }
        if (!logoUrl) logoUrl = team.logoUrl || null;
      } catch { /* ignore */ }
      if (!logoUrl) return fallbackPath;

      try {
        const res = await fetch(logoUrl);
        if (!res.ok) throw new Error(`fetch logo ${res.status}`);
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const ext = contentType.includes("svg") ? "svg" : contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : contentType.includes("jpg") ? "jpg" : "bin";
        const path = `${fileBase}.${ext}`;
        const buf = await res.arrayBuffer();
        await sb.storage.from("team-logos").upload(path, new Blob([buf], { type: contentType }), { upsert: true, contentType });
        return path;
      } catch {
        return fallbackPath;
      }
    }

    // 4) Fetch teams (provider -> fallback mock)
    let teams: FTeam[] | null = null;
    if (provider) {
      try {
        teams = await provider.getTeams({ competitionId: competitionCode, seasonId: String(seasonYear) });
      } catch (_) {
        teams = null;
      }
    }
    if (!teams) {
      const mockData = getMockDataForCompetition(competitionCode);
      teams = mockData.teams;
    }

    // Ingest logos and build upsert rows
    const teamRows = await Promise.all(teams.map(async (t) => ({
      name: t.name,
      short_name: t.shortName ?? null,
      acronym: t.acronym ?? null,
      country: t.country ?? "Brasil",
      logo_path: await ingestLogo(t),
      ext_provider: extProvider,
      ext_id: String(t.id),
    })));

    const { data: upsertedTeams, error: teamErr } = await sb
      .from("football_teams")
      .upsert(teamRows, { onConflict: "ext_provider,ext_id" })
      .select("id, ext_id");
    if (teamErr) throw new Error(teamErr.message);
    const idByExt: Record<string, string> = Object.fromEntries((upsertedTeams || []).map((r: any) => [String(r.ext_id), r.id]));

    // 5) Fetch matches (provider -> fallback mock) e upsert
    let matches: FMatch[] | null = null;
    if (provider) {
      try {
        matches = await provider.getMatches({ competitionId: competitionCode, seasonId: String(seasonYear) });
      } catch (_) {
        matches = null;
      }
    }
    if (!matches) {
      const mockData = getMockDataForCompetition(competitionCode);
      matches = mockData.matches;
    }

    const matchRows = matches.map((m) => ({
      competition_id: competitionId,
      season_id: seasonId,
      round: m.round ?? m.matchday ?? null,
      matchday: m.matchday ?? null,
      start_time: m.utcDate,
      status: m.status,
      home_team_id: idByExt[String(m.homeTeamId)] ?? null,
      away_team_id: idByExt[String(m.awayTeamId)] ?? null,
      home_score: m.score?.home ?? null,
      away_score: m.score?.away ?? null,
      venue: m.venue ?? null,
      referee: m.referee ?? null,
      ext_provider: extProvider,
      ext_id: String(m.id),
    })).filter(r => r.home_team_id && r.away_team_id);

    const { data: upsertedMatches, error: matchErr } = await sb
      .from("football_matches")
      .upsert(matchRows, { onConflict: "ext_provider,ext_id" })
      .select("id");
    if (matchErr) throw new Error(matchErr.message);

    return NextResponse.json({
      ok: true,
      competition: { id: competitionId, code: competitionCode },
      season: { id: seasonId, year: seasonYear },
      counts: {
        teams_input: teams.length,
        teams_upserted: upsertedTeams?.length || 0,
        matches_input: matches.length,
        matches_upserted: upsertedMatches?.length || 0,
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}