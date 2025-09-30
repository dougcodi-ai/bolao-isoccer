import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// GET /api/pools/[id]/match-performance?matchId=<uuid>
// Returns aggregated performance for a past match within the given pool
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const poolIdOrCode = (params.id || "").trim();
    const url = new URL(req.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();
    if (!poolIdOrCode || !matchId) {
      return NextResponse.json({ ok: false, error: "Missing pool id/code or matchId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Missing Supabase envs" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Resolve pool by id or code
    let pool: { id: string; code?: string | null } | null = null;
    {
      const byId = await sb.from("pools").select("id, code").eq("id", poolIdOrCode).maybeSingle();
      if (byId.data) pool = { id: byId.data.id as string, code: (byId.data as any).code };
      else {
        const byCode = await sb.from("pools").select("id, code").eq("code", poolIdOrCode).maybeSingle();
        if (byCode.data) pool = { id: byCode.data.id as string, code: (byCode.data as any).code };
      }
    }
    if (!pool) return NextResponse.json({ ok: false, error: "Bolão não encontrado" }, { status: 404 });

    // Ensure the match belongs to the pool and has final scores
    const { data: matchRow, error: mErr } = await sb
      .from("matches")
      .select("id, pool_id, home_score, away_score, home_team, away_team, start_time")
      .eq("id", matchId)
      .eq("pool_id", pool.id)
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .maybeSingle();
    if (mErr || !matchRow) {
      return NextResponse.json({ ok: false, error: "Partida inválida para este bolão ou sem placar final" }, { status: 404 });
    }

    const hs = Number(matchRow.home_score);
    const as = Number(matchRow.away_score);
    const actualRes = hs === as ? 0 : hs > as ? 1 : -1;

    // List predictions for the match within the pool
    // Restrict to pool members
    const { data: members } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", pool.id);
    const memberIds = (members || []).map((m: any) => m.user_id);

    let preds: Array<{ user_id: string; home_pred: number; away_pred: number }> = [];
    if (memberIds.length > 0) {
      const { data: rows } = await sb
        .from("predictions")
        .select("user_id, home_pred, away_pred")
        .eq("match_id", matchId)
        .in("user_id", memberIds);
      preds = (rows as any[]) || [];
    }

    // Aggregate distribution
    let exact = 0, tendency = 0, partial = 0, wrong = 0, withPred = 0;
    const outcome = (a: number, b: number) => (a === b ? 0 : a > b ? 1 : -1);
    const items = preds.map((p) => {
      withPred += 1;
      const pr = outcome(p.home_pred, p.away_pred);
      const isExact = p.home_pred === hs && p.away_pred === as;
      const isTend = !isExact && pr === actualRes;
      const isPartial = !isExact && !isTend && (p.home_pred === hs || p.away_pred === as);
      if (isExact) exact += 1; else if (isTend) tendency += 1; else if (isPartial) partial += 1; else wrong += 1;
      const points = isExact ? 10 : isTend ? 5 : isPartial ? 3 : 0;
      return { user_id: p.user_id, home_pred: p.home_pred, away_pred: p.away_pred, points };
    });

    // Fetch display names for top list
    const top = items
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    let profiles: Record<string, string> = {};
    if (top.length > 0) {
      const ids = top.map((t) => t.user_id);
      const { data: profs } = await sb.from("profiles").select("id, display_name").in("id", ids);
      for (const r of (profs as any[]) || []) {
        profiles[r.id] = (r.display_name || "").toString();
      }
    }

    const decoratedTop = top.map((t) => ({
      user_id: t.user_id,
      display_name: profiles[t.user_id] || t.user_id,
      points: t.points,
      pred: { home_pred: t.home_pred, away_pred: t.away_pred },
    }));

    return NextResponse.json({
      ok: true,
      match: {
        id: matchRow.id,
        home_team: matchRow.home_team,
        away_team: matchRow.away_team,
        start_time: matchRow.start_time,
        home_score: hs,
        away_score: as,
      },
      totals: {
        totalMembers: memberIds.length,
        withPred,
        noPred: Math.max(0, memberIds.length - withPred),
      },
      distribution: { exact, tendency, partial, wrong },
      top: decoratedTop,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}