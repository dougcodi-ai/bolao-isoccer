import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapChampionshipToCompetitionCode(championship?: string | null): { code: string; supported: boolean } {
  if (!championship) return { code: "BRA-1", supported: true };
  const norm = championship.toLowerCase();
  if (/(brasileir|série\s*a|serie\s*a)/i.test(championship)) return { code: "BRA-1", supported: true };
  if (/(brasileir|série\s*b|serie\s*b)/i.test(championship)) return { code: "BRA-2", supported: true };
  if (/copa do brasil/i.test(championship)) return { code: "BRA-CUP", supported: true };
  if (/libertadores/i.test(championship)) return { code: "LIBERTADORES", supported: true };
  if (/(sul-americana|sulamericana)/i.test(championship)) return { code: "SULAMERICANA", supported: true };
  if (/champions/i.test(championship)) return { code: "UEFA-CL", supported: false };
  // default fallback
  return { code: "BRA-1", supported: true };
}

// Helper para inferir o campeonato a partir do texto do bolão
function normalizeText(s?: string | null) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveChampionship(poolInfo?: { championship?: string | null; name?: string | null }): string {
  const base = poolInfo?.championship && poolInfo.championship.trim().length > 0
    ? poolInfo.championship
    : (poolInfo?.name || '');
  const n = normalizeText(base);
  const m = n.replace(/\s+/g, '');
  if (m === 'aaa') return 'Brasileirão Série A';
  if (m === 'bbb') return 'Brasileirão Série B';
  if (m === 'ccc') return 'Copa do Brasil';
  if (n.includes('serie a') || n.includes('brasileirao')) return 'Brasileirão Série A';
  if (n.includes('serie b') || n.includes('bezona')) return 'Brasileirão Série B';
  if (n.includes('copa do brasil') || n.includes('copa brasil')) return 'Copa do Brasil';
  return poolInfo?.championship || '';
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const poolIdOrCode = params.id;
    const url = new URL(req.url);
    const seasonYear = Number(url.searchParams.get("season") || 2025);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase envs" }, { status: 500 });
    }
    const sb = createClient(supabaseUrl, serviceKey);

    // 1) Load pool and its championship (accept both pool id or pool code in path param)
    let pool: any = null;
    let pErr: any = null;
    {
      const res = await sb
        .from("pools")
        .select("id, code, name, championship")
        .eq("id", poolIdOrCode)
        .maybeSingle();
      pool = res.data;
      pErr = res.error;
    }
    // Fallback: ambientes sem coluna 'championship'
    if ((pErr && /column .*championship.* does not exist/i.test(pErr.message)) || (!pool && pErr)) {
      const res2 = await sb
        .from("pools")
        .select("id, code, name")
        .eq("id", poolIdOrCode)
        .maybeSingle();
      if (res2.data) {
        pool = { ...res2.data, championship: null };
      } else if (res2.error) {
        // keep error for next branch
        pErr = res2.error;
      }
    }
    // If not found by id, try by code (with and without 'championship' column)
    if (!pool) {
      let byCodeErr: any = null;
      const byCode = await sb
        .from("pools")
        .select("id, code, name, championship")
        .eq("code", poolIdOrCode)
        .maybeSingle();
      if (byCode.data) {
        pool = byCode.data;
      } else {
        byCodeErr = byCode.error;
        if (byCodeErr && /column .*championship.* does not exist/i.test(byCodeErr.message)) {
          const byCode2 = await sb
            .from("pools")
            .select("id, code, name")
            .eq("code", poolIdOrCode)
            .maybeSingle();
          if (byCode2.data) {
            pool = { ...byCode2.data, championship: null };
          } else if (byCode2.error) {
            byCodeErr = byCode2.error;
          }
        }
      }
      if (!pool && (byCodeErr || pErr)) {
        return NextResponse.json({ error: byCodeErr?.message || pErr?.message || "Bolão não encontrado" }, { status: 404 });
      }
    }
    if (!pool) return NextResponse.json({ error: "Bolão não encontrado" }, { status: 404 });

    // Usa resolução robusta do campeonato, caindo para o nome quando championship estiver vazio
    const resolvedChamp = resolveChampionship({ championship: pool.championship as string | null, name: pool.name as string | null });
    const { code: competitionCode, supported } = mapChampionshipToCompetitionCode(resolvedChamp);
    const effectiveCode = supported ? competitionCode : "BRA-1";

    // 2) Ensure football base seeded (competitions/seasons/matches)
    async function ensureFootballBase(): Promise<{ competitionId: string; seasonId: string }> {
      // competition
      const { data: compRow } = await sb
        .from("football_competitions")
        .select("id")
        .eq("code", effectiveCode)
        .maybeSingle();

      let competitionId = compRow?.id as string | undefined;
      if (!competitionId) {
        // try seed endpoint (mock fallback)
        await fetch(`${url.origin}/api/football/seed?competition=${effectiveCode}&season=${seasonYear}`, { method: "POST" }).catch(() => {});
        const { data: comp2 } = await sb
          .from("football_competitions")
          .select("id")
          .eq("code", effectiveCode)
          .maybeSingle();
        competitionId = comp2?.id as string | undefined;
      }
      if (!competitionId) throw new Error(`Competição ${effectiveCode} ausente. Rode /api/football/seed.`);

      // season
      const { data: seasonRow } = await sb
        .from("football_seasons")
        .select("id")
        .eq("competition_id", competitionId)
        .eq("year", seasonYear)
        .maybeSingle();
      let seasonId = seasonRow?.id as string | undefined;
      if (!seasonId) {
        await fetch(`${url.origin}/api/football/seed?competition=${effectiveCode}&season=${seasonYear}`, { method: "POST" }).catch(() => {});
        const { data: season2 } = await sb
          .from("football_seasons")
          .select("id")
          .eq("competition_id", competitionId)
          .eq("year", seasonYear)
          .maybeSingle();
        seasonId = season2?.id as string | undefined;
      }
      if (!seasonId) throw new Error(`Temporada ${seasonYear} ausente. Rode /api/football/seed.`);

      return { competitionId, seasonId } as { competitionId: string; seasonId: string };
    }

    if (!supported) {
      // Por ora, popula com Brasileirão para evitar vazio visual
      // e retorna nota de fallback
      const { competitionId, seasonId } = await ensureFootballBase();
      const result = await copyMatches(sb, pool.id as string, competitionId, seasonId, seasonYear);
      return NextResponse.json({ ...result, note: `Campeonato ${pool.championship || "(indefinido)"} ainda não suportado; usando calendário de BRA-1 ${seasonYear} como fallback.` });
    }

    const { competitionId, seasonId } = await ensureFootballBase();
    const result = await copyMatches(sb, pool.id as string, competitionId, seasonId, seasonYear);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

async function copyMatches(sb: any, poolId: string, competitionId: string, seasonId: string, seasonYear: number) {
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
    const { data: teams, error: tErr } = await sb
      .from("football_teams")
      .select("id, name, acronym")
      .in("id", teamIds);
    if (tErr) throw new Error(tErr.message);
    teamMap = Object.fromEntries((teams || []).map((t: any) => [t.id, { name: t.name, acronym: t.acronym || null }]));
  }

  const { data: existing, error: exErr } = await sb
    .from("matches")
    .select("id, home_team, away_team, start_time")
    .eq("pool_id", poolId);
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

    toInsert.push({
      pool_id: poolId,
      home_team: home.name,
      away_team: away.name,
      start_time: m.start_time,
      home_score: h,
      away_score: a,
      round: m.matchday ?? null,
      home_acr: home.acronym ?? null,
      away_acr: away.acronym ?? null,
    });
  }

  let inserted = 0;
  let errorInsert: string | null = null;
  if (toInsert.length > 0) {
    const { data: ins, error: insErr } = await sb.from("matches").insert(toInsert).select("id");
    if (insErr) {
      errorInsert = insErr.message;
      // Fallback: ambientes sem colunas novas (round, home_acr, away_acr)
      if (/(home_acr|away_acr|round)/i.test(insErr.message) || /does not exist/i.test(insErr.message)) {
        const fallbackPayload = toInsert.map(({ round, home_acr, away_acr, ...rest }) => rest);
        const { data: ins2, error: insErr2 } = await sb.from("matches").insert(fallbackPayload).select("id");
        if (!insErr2) {
          inserted = ins2?.length || 0;
          errorInsert = null;
        } else {
          errorInsert = insErr2.message;
        }
      }
    } else {
      inserted = ins?.length || 0;
    }
  }

  return {
    ok: true,
    pool: { id: poolId },
    selection: { totalFootballMatches: (fMatches || []).length },
    inserted,
    attempted: toInsert.length,
    errorInsert,
    season: seasonYear,
  };
}