import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev-only endpoint" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const poolCode: string | undefined = body.poolCode;
  const fromCanonical: boolean = body.fromCanonical !== false; // default true for better UX
  const competition: string = (body.competition || "BRA-1").trim();
  const season: number = Number(body.season || 2025);
  const countPast: number = Math.max(0, Math.min(20, Number(body.countPast ?? body.past ?? 6)));
  const countFuture: number = Math.max(0, Math.min(20, Number(body.countFuture ?? body.future ?? 6)));
  const truncateExisting: boolean = Boolean(body.truncateExisting ?? false);
  const fillRandomScoresForPast: boolean = body.fillRandomScoresForPast !== false; // default true
  const teamBase: string = body.teamBase || "Time"; // fallback if not canonical

  if (!poolCode) {
    return NextResponse.json({ error: "Informe poolCode" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Ambiente Supabase ausente (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Resolve pool by code
    const { data: pool, error: poolErr } = await sb
      .from("pools")
      .select("id, name")
      .eq("code", poolCode)
      .maybeSingle();
    if (poolErr || !pool) {
      return NextResponse.json({ error: poolErr?.message || "Bolão não encontrado" }, { status: 404 });
    }
    const poolId: string = pool.id as string;

    if (!fromCanonical) {
      // Backward compatible: seed synthetic matches
      const now = Date.now();
      const toInsert: any[] = [];
      for (let i = 0; i < countPast; i++) {
        const when = new Date(now - (i + 1) * 60 * 60 * 1000);
        const home_score = randInt(0, 4);
        const away_score = randInt(0, 4);
        toInsert.push({
          pool_id: poolId,
          home_team: `${teamBase} ${String.fromCharCode(65 + (i * 2) % 26)}`,
          away_team: `${teamBase} ${String.fromCharCode(66 + (i * 2) % 26)}`,
          start_time: when.toISOString(),
          home_score,
          away_score,
        });
      }
      for (let i = 0; i < countFuture; i++) {
        const when = new Date(now + (i + 1) * 45 * 60 * 1000);
        toInsert.push({
          pool_id: poolId,
          home_team: `${teamBase} ${String.fromCharCode(67 + (i * 2) % 26)}`,
          away_team: `${teamBase} ${String.fromCharCode(68 + (i * 2) % 26)}`,
          start_time: when.toISOString(),
        });
      }
      if (toInsert.length > 0) {
        const { error: insErr } = await sb.from("matches").insert(toInsert);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
      const { data: matches, error: selErr } = await sb
        .from("matches")
        .select("id, home_team, away_team, start_time, home_score, away_score")
        .eq("pool_id", poolId)
        .order("start_time", { ascending: true });
      if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, mode: "synthetic", pool: { id: poolId, code: poolCode, name: pool.name }, inserted: toInsert.length, matches });
    }

    // Canonical mode: copy from football_matches for chosen competition/season
    const { data: compRow, error: compErr } = await sb
      .from("football_competitions")
      .select("id")
      .eq("code", competition)
      .maybeSingle();
    if (compErr || !compRow) {
      return NextResponse.json({ error: compErr?.message || `Competição ${competition} não encontrada em football_competitions. Rode /api/football/seed antes.` }, { status: 404 });
    }
    const competitionId = compRow.id as string;

    const { data: seasonRow, error: seasonErr } = await sb
      .from("football_seasons")
      .select("id")
      .eq("competition_id", competitionId)
      .eq("year", season)
      .maybeSingle();
    if (seasonErr || !seasonRow) {
      return NextResponse.json({ error: seasonErr?.message || `Temporada ${season} não encontrada em football_seasons. Rode /api/football/seed antes.` }, { status: 404 });
    }
    const seasonId = seasonRow.id as string;

    const { data: fMatches, error: fErr } = await sb
      .from("football_matches")
      .select("id, matchday, start_time, home_score, away_score, home_team_id, away_team_id")
      .eq("competition_id", competitionId)
      .eq("season_id", seasonId)
      .order("start_time", { ascending: true });
    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const all = fMatches || [];
    const pastAll = all.filter((m) => new Date(m.start_time).toISOString() < nowIso);
    const futureAll = all.filter((m) => new Date(m.start_time).toISOString() >= nowIso);
    const pastSel = countPast > 0 ? pastAll.slice(-countPast) : [];
    const futureSel = countFuture > 0 ? futureAll.slice(0, countFuture) : [];

    // Load team names/acronyms
    const teamIds = Array.from(new Set([...pastSel, ...futureSel].flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean)));
    let teamMap: Record<string, { name: string; acronym: string | null }> = {};
    if (teamIds.length > 0) {
      const { data: teams, error: tErr } = await sb
        .from("football_teams")
        .select("id, name, acronym")
        .in("id", teamIds);
      if (tErr) {
        return NextResponse.json({ error: tErr.message }, { status: 400 });
      }
      teamMap = Object.fromEntries((teams || []).map((t: any) => [t.id, { name: t.name, acronym: t.acronym || null }]));
    }

    if (truncateExisting) {
      await sb.from("matches").delete().eq("pool_id", poolId);
    }

    const { data: existing, error: exErr } = await sb
      .from("matches")
      .select("id, home_team, away_team, start_time")
      .eq("pool_id", poolId);
    if (exErr) {
      return NextResponse.json({ error: exErr.message }, { status: 400 });
    }
    const existingKeys = new Set((existing || []).map((r: any) => `${r.home_team}__${r.away_team}__${new Date(r.start_time).toISOString()}`));

    const toInsert: any[] = [];

    function ensureScore(h: number | null, a: number | null): { h: number | null; a: number | null } {
      if (!fillRandomScoresForPast) return { h, a };
      if (h == null || a == null) {
        const hh = randInt(0, 4);
        const aa = randInt(0, 4);
        return { h: hh, a: aa };
      }
      return { h, a };
    }

    for (const m of [...pastSel, ...futureSel]) {
      const home = teamMap[m.home_team_id] || { name: `T#${m.home_team_id.slice(0, 6)}`, acronym: null };
      const away = teamMap[m.away_team_id] || { name: `T#${m.away_team_id.slice(0, 6)}`, acronym: null };
      const key = `${home.name}__${away.name}__${new Date(m.start_time).toISOString()}`;
      if (existingKeys.has(key)) continue;

      const isPast = new Date(m.start_time).toISOString() < nowIso;
      const scores = isPast ? ensureScore(m.home_score ?? null, m.away_score ?? null) : { h: null, a: null };

      toInsert.push({
        pool_id: poolId,
        home_team: home.name,
        away_team: away.name,
        start_time: m.start_time,
        home_score: scores.h,
        away_score: scores.a,
        // round: m.matchday ?? null,            // removed to match current DB schema (no column)
        // home_acr: home.acronym,               // removed to match current DB schema (no column)
        // away_acr: away.acronym,               // removed to match current DB schema (no column)
      });
    }

    let inserted = 0;
    let errorInsert: string | null = null;
    if (toInsert.length > 0) {
      const { data: ins, error: insErr } = await sb.from("matches").insert(toInsert).select("id");
      if (insErr) {
        errorInsert = insErr.message;
      } else {
        inserted = ins?.length || 0;
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "canonical",
      pool: { id: poolId, code: poolCode, name: pool.name },
      selection: { pastAvailable: pastAll.length, futureAvailable: futureAll.length, pastSelected: pastSel.length, futureSelected: futureSel.length },
      inserted,
      attempted: toInsert.length,
      truncateExisting,
      notes: fillRandomScoresForPast ? "Past matches without scores received random scores for UX." : undefined,
      errorInsert,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}