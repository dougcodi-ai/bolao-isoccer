import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/cron/auto-pick
// Efeito do booster temporal "palpite_automatico":
// - Para partidas cujo fechamento base (T-60) já passou e ainda não iniciaram (T0),
// - Criar palpite padrão 2x0 mandante (ou valores do catálogo) para membros que:
//   a) Sejam membros do bolão da partida
//   b) Tenham booster_activations ativo de "palpite_automatico" (global ou específico do pool)
//   c) Não tenham palpite ativo prévio para este jogo
// - Registrar booster_usages (consumed), sem expirar a activation (é temporal, cobre período inteiro)
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Supabase env not configured" }, { status: 500 });
    }

    const cronSecret = process.env.CRON_SECRET as string | undefined;
    const headerSecret = req.headers.get("X-Cron-Secret") || req.headers.get("x-cron-secret");
    if (cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Pega defaults do catálogo (fallback 2x0)
    let defHome = 2;
    let defAway = 0;
    try {
      const { data: cat } = await sb.from("boosters").select("metadata").eq("id", "palpite_automatico").maybeSingle();
      const md = (cat as any)?.metadata || {};
      if (typeof md.default_home_goals === "number") defHome = md.default_home_goals;
      if (typeof md.default_away_goals === "number") defAway = md.default_away_goals;
    } catch (_) {}

    const now = new Date();
    const nowIso = now.toISOString();

    // Janela de interesse: partidas que ainda não iniciaram, mas cujo T-60 já ocorreu
    // start_time in (now, now + 60min] => T-60 <= now
    const upper = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    const { data: matches, error: mErr } = await sb
      .from("matches")
      .select("id, pool_id, home_team, away_team, start_time, status")
      .gt("start_time", nowIso)
      .lte("start_time", upper)
      .eq("status", "scheduled");
    if (mErr) {
      return NextResponse.json({ ok: false, error: mErr.message }, { status: 400 });
    }

    const processed: Array<{ match_id: string; pool_id: string; created: number }> = [];

    for (const match of matches || []) {
      const matchId = (match as any).id as string;
      const poolId = (match as any).pool_id as string;
      const startMs = new Date((match as any).start_time).getTime();
      const baseLockMs = startMs - 60 * 60 * 1000;
      if (now.getTime() < baseLockMs) continue; // ainda não atingiu T-60 (safety)

      // Membros do bolão
      const { data: members, error: memErr } = await sb
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", poolId);
      if (memErr) continue;
      const memberIds = (members || []).map((r: any) => r.user_id).filter(Boolean);
      if (memberIds.length === 0) { processed.push({ match_id: matchId, pool_id: poolId, created: 0 }); continue; }

      // Ativações válidas do booster (global ou específicas do pool)
      const { data: acts, error: actErr } = await sb
        .from("booster_activations")
        .select("user_id, pool_id, expires_at, status, booster_id")
        .eq("booster_id", "palpite_automatico")
        .eq("status", "active")
        .in("user_id", memberIds);
      if (actErr) continue;

      const activeUsers = new Set<string>();
      for (const a of acts || []) {
        const exp = (a as any).expires_at ? new Date((a as any).expires_at).getTime() : null;
        if (exp && exp <= now.getTime()) continue; // expirado
        const actPool: string | null = (a as any).pool_id || null;
        if (actPool && actPool !== poolId) continue; // activation restrita a outro pool
        activeUsers.add((a as any).user_id as string);
      }

      if (activeUsers.size === 0) { processed.push({ match_id: matchId, pool_id: poolId, created: 0 }); continue; }

      // Usuários já com palpite ativo para este jogo
      const { data: exists } = await sb
        .from("predictions")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("status", "active");
      const already = new Set<string>((exists || []).map((r: any) => r.user_id));

      // Monta inserts apenas para quem não tem palpite
      const toCreate: any[] = [];
      const usages: any[] = [];
      for (const uid of activeUsers) {
        if (already.has(uid)) continue;
        const outcome = defHome === defAway ? 0 : (defHome > defAway ? 1 : -1);
        toCreate.push({ match_id: matchId, user_id: uid, home_pred: defHome, away_pred: defAway, status: "active", market: "1x2", outcome });
        usages.push({ pool_id: poolId, user_id: uid, match_id: matchId, booster: "palpite_automatico", status: "consumed" });
      }

      let created = 0;
      if (toCreate.length > 0) {
        const { error: insErr } = await sb.from("predictions").insert(toCreate);
        if (!insErr) {
          created = toCreate.length;
          // registrar usos (best effort)
          const { error: usageErr } = await sb.from("booster_usages").insert(usages);
          // ignore usageErr
        }
      }

      processed.push({ match_id: matchId, pool_id: poolId, created });
    }

    const total = processed.reduce((acc, r) => acc + r.created, 0);
    return NextResponse.json({ ok: true, matches: (matches || []).length, created: total, detail: processed });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unexpected error" }, { status: 500 });
  }
}