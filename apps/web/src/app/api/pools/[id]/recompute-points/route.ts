import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function outcome(h: number, a: number): number {
  if (h > a) return 1;
  if (h < a) return -1;
  return 0;
}

function pointsForPrediction(realH: number, realA: number, predH: number, predA: number): number {
  const exact = predH === realH && predA === realA;
  if (exact) return 10;
  const tend = outcome(predH, predA) === outcome(realH, realA);
  if (tend) return 5;
  const partial = predH === realH || predA === realA;
  if (partial) return 3;
  return 0;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const poolId = params?.id;
  if (!poolId) {
    return NextResponse.json({ error: "Pool id inválido" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Ambiente Supabase ausente (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Verifica se o bolão existe
    const { data: pool, error: poolErr } = await sb.from("pools").select("id").eq("id", poolId).maybeSingle();
    if (poolErr || !pool) {
      return NextResponse.json({ error: poolErr?.message || "Bolão não encontrado" }, { status: 404 });
    }

    // Carrega membros do bolão
    const { data: members, error: memErr } = await sb
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", poolId);
    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 400 });
    }
    const memberIds = (members || []).map((m) => m.user_id as string);

    // Carrega partidas finalizadas do bolão
    const { data: matches, error: mErr } = await sb
      .from("matches")
      .select("id, home_score, away_score")
      .eq("pool_id", poolId)
      .not("home_score", "is", null)
      .not("away_score", "is", null);
    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 400 });
    }

    const matchResults = new Map<string, { h: number; a: number }>();
    for (const m of matches || []) {
      const id = String((m as any).id);
      const h = Number((m as any).home_score);
      const a = Number((m as any).away_score);
      if (Number.isFinite(h) && Number.isFinite(a)) matchResults.set(id, { h, a });
    }

    // Se não houver membros, apenas finalize com ok
    if (memberIds.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, members: 0, matches: matchResults.size });
    }

    // Se não houver partidas finalizadas, zere os pontos de todos membros
    if (matchResults.size === 0) {
      const zeroPayload = memberIds.map((uid) => ({ pool_id: poolId, user_id: uid, points: 0 }));
      if (zeroPayload.length > 0) {
        const { error: upErr } = await sb.from("points").upsert(zeroPayload, { onConflict: "pool_id,user_id" });
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, updated: zeroPayload.length, members: memberIds.length, matches: 0 });
    }

    const matchIds = Array.from(matchResults.keys());

    // Carrega palpites dos membros para as partidas finalizadas
    const { data: preds, error: pErr } = await sb
      .from("predictions")
      .select("user_id, match_id, home_pred, away_pred")
      .in("match_id", matchIds)
      .in("user_id", memberIds)
      .eq("status", "active");
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 400 });
    }

    // Índice por usuário -> (match_id -> prediction)
    const predsByUser = new Map<string, Map<string, { h: number; a: number }>>();
    for (const r of preds || []) {
      const uid = String((r as any).user_id);
      const mid = String((r as any).match_id);
      const h = Number((r as any).home_pred);
      const a = Number((r as any).away_pred);
      let inner = predsByUser.get(uid);
      if (!inner) {
        inner = new Map();
        predsByUser.set(uid, inner);
      }
      inner.set(mid, { h, a });
    }

    const payload: Array<{ pool_id: string; user_id: string; points: number }> = [];

    for (const uid of memberIds) {
      let sum = 0;
      const userPreds = predsByUser.get(uid);
      for (const [mid, res] of matchResults.entries()) {
        const pred = userPreds?.get(mid);
        if (pred) {
          sum += pointsForPrediction(res.h, res.a, pred.h, pred.a);
        } else {
          // sem palpite -> 0 ponto
          sum += 0;
        }
      }
      payload.push({ pool_id: poolId, user_id: uid, points: sum });
    }

    if (payload.length > 0) {
      const { error: upErr } = await sb.from("points").upsert(payload, { onConflict: "pool_id,user_id" });
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, updated: payload.length, members: memberIds.length, matches: matchResults.size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}