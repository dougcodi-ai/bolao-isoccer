import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapChampionshipToCompetitionCode(championship?: string | null): { code: string; supported: boolean } {
  if (!championship) return { code: "BRA-1", supported: true };
  if (/(brasileir|série\s*a|serie\s*a)/i.test(championship)) return { code: "BRA-1", supported: true };
  if (/(brasileir|série\s*b|serie\s*b)/i.test(championship)) return { code: "BRA-2", supported: true };
  if (/copa do brasil/i.test(championship)) return { code: "BRA-CUP", supported: true };
  if (/libertadores/i.test(championship)) return { code: "LIBERTADORES", supported: true };
  if /(sul-americana|sulamericana)/i.test(championship)) return { code: "SULAMERICANA", supported: true };
  if (/champions/i.test(championship)) return { code: "UEFA-CL", supported: false };
  return { code: "BRA-1", supported: true };
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const seasonYear = Number(url.searchParams.get("season") || 2025);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 });
    const sb = createClient(supabaseUrl, serviceKey);

    // Carrega todos os bolões (tolerante a ambientes sem coluna 'championship')
    let pools: any[] = [];
    let withChamp = true;
    {
      const r = await sb.from("pools").select("id, code, name, championship");
      if (r.data) pools = r.data as any[];
      if (r.error) {
        const msg = r.error.message || "";
        if (/column .*championship.* does not exist/i.test(msg)) {
          withChamp = false;
          const r2 = await sb.from("pools").select("id, code, name");
          if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 500 });
          pools = (r2.data || []).map((p: any) => ({ ...p, championship: null }));
        } else {
          return NextResponse.json({ error: r.error.message }, { status: 500 });
        }
      }
    }

    if (!pools || pools.length === 0) return NextResponse.json({ ok: true, poolsProcessed: 0, season: seasonYear, details: [] });

    // Assegura base de futebol por competição apenas uma vez por código
    async function ensureFootballBase(competitionCode: string): Promise<{ competitionId: string; seasonId: string }> {
      const { data: compRow } = await sb.from("football_competitions").select("id").eq("code", competitionCode).maybeSingle();
      let competitionId = compRow?.id as string | undefined;
      if (!competitionId) {
        await fetch(`${url.origin}/api/football/seed?competition=${competitionCode}&season=${seasonYear}`, { method: "POST" }).catch(() => {});
        const { data: c2 } = await sb.from("football_competitions").select("id").eq("code", competitionCode).maybeSingle();
        competitionId = c2?.id as string | undefined;
      }
      if (!competitionId) throw new Error(`Competição ${competitionCode} ausente. Rode /api/football/seed.`);
      const { data: seasonRow } = await sb.from("football_seasons").select("id").eq("competition_id", competitionId).eq("year", seasonYear).maybeSingle();
      let seasonId = seasonRow?.id as string | undefined;
      if (!seasonId) {
        await fetch(`${url.origin}/api/football/seed?competition=${competitionCode}&season=${seasonYear}`, { method: "POST" }).catch(() => {});
        const { data: s2 } = await sb.from("football_seasons").select("id").eq("competition_id", competitionId).eq("year", seasonYear).maybeSingle();
        seasonId = s2?.id as string | undefined;
      }
      if (!seasonId) throw new Error(`Temporada ${seasonYear} ausente. Rode /api/football/seed.`);
      return { competitionId, seasonId };
    }

    async function copyMatches(poolId: string, competitionId: string, seasonId: string) {
      const nowIso = new Date().toISOString();
      const { data: fMatches, error: fErr } = await sb
        .from("football_matches")
        .select("id, matchday, start_time, home_score, away_score, home_team_id, away_team_id")
        .eq("competition_id", competitionId)
        .eq("season_id", seasonId)
        .order("start_time", { ascending: true });
      if (fErr) throw new Error(fErr.message);
      const all = fMatches || [];
      const teamIds = Array.from(new Set(all.flatMap((m: any) => [m.home_team_id, m.away_team_id]).filter(Boolean)));
      let teamMap: Record<string, { name: string; acronym: string | null }> = {};
      if (teamIds.length > 0) {
        const { data: teams, error: tErr } = await sb.from("football_teams").select("id, name, acronym").in("id", teamIds);
        if (tErr) throw new Error(tErr.message);
        teamMap = Object.fromEntries((teams || []).map((t: any) => [t.id, { name: t.name, acronym: t.acronym || null }]));
      }
      const { data: existing, error: exErr } = await sb.from("matches").select("id, home_team, away_team, start_time").eq("pool_id", poolId);
      if (exErr) throw new Error(exErr.message);
      const existingKeys = new Set((existing || []).map((r: any) => `${r.home_team}__${r.away_team}__${new Date(r.start_time).toISOString()}`));
      const toInsert: any[] = [];
      for (const m of all) {
        const home = teamMap[m.home_team_id] || { name: `T#${String(m.home_team_id).slice(0, 6)}`, acronym: null };
        const away = teamMap[m.away_team_id] || { name: `T#${String(m.away_team_id).slice(0, 6)}`, acronym: null };
        const key = `${home.name}__${away.name}__${new Date(m.start_time).toISOString()}`;
        if (existingKeys.has(key)) continue;
        const isPast = new Date(m.start_time).toISOString() < nowIso;
        const h = isPast ? (m.home_score != null ? m.home_score : null) : null;
        const a = isPast ? (m.away_score != null ? m.away_score : null) : null;
        toInsert.push({ pool_id: poolId, home_team: home.name, away_team: away.name, start_time: m.start_time, home_score: h, away_score: a, round: m.matchday ?? null, home_acr: home.acronym ?? null, away_acr: away.acronym ?? null });
      }
      let inserted = 0; let errorInsert: string | null = null;
      if (toInsert.length > 0) {
        const { data: ins, error: insErr } = await sb.from("matches").insert(toInsert).select("id");
        if (insErr) {
          errorInsert = insErr.message;
          if (/\b(home_acr|away_acr|round)\b/i.test(insErr.message) || /does not exist/i.test(insErr.message)) {
            const fallbackPayload = toInsert.map(({ round, home_acr, away_acr, ...rest }) => rest);
            const { data: ins2, error: insErr2 } = await sb.from("matches").insert(fallbackPayload).select("id");
            if (!insErr2) { inserted = ins2?.length || 0; errorInsert = null; } else { errorInsert = insErr2.message; }
          }
        } else {
          inserted = ins?.length || 0;
        }
      }
      return { inserted, attempted: toInsert.length, errorInsert };
    }

    const perPool: any[] = [];
    const cache: Record<string, { competitionId: string; seasonId: string }> = {};
    let totalInserted = 0; let totalAttempted = 0; let unsupportedCount = 0;

    for (const p of pools) {
      const { code: compCode, supported } = mapChampionshipToCompetitionCode(p.championship as string | null);
      const effectiveCode = supported ? compCode : "BRA-1";
      if (!supported) unsupportedCount++;
      if (!cache[effectiveCode]) cache[effectiveCode] = await ensureFootballBase(effectiveCode);
      const { competitionId, seasonId } = cache[effectiveCode];
      const r = await copyMatches(p.id as string, competitionId, seasonId);
      totalInserted += r.inserted; totalAttempted += r.attempted;
      perPool.push({ pool: { id: p.id, code: p.code, name: p.name, championship: withChamp ? p.championship : null }, competition: effectiveCode, inserted: r.inserted, attempted: r.attempted, errorInsert: r.errorInsert, note: supported ? undefined : `Campeonato ${p.championship || "(indefinido)"} não suportado; usado ${effectiveCode} ${seasonYear} como fallback.` });
    }

    return NextResponse.json({ ok: true, season: seasonYear, poolsProcessed: pools.length, totals: { inserted: totalInserted, attempted: totalAttempted }, unsupportedPools: unsupportedCount, details: perPool });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}