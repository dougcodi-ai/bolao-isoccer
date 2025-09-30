import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/boosters/cron-expire
// Optional header: X-Cron-Secret to restrict access
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

    // 1) Seleciona usages pendentes expirados
    const nowIso = new Date().toISOString();
    const { data: expired, error: expErr } = await sb
      .from("booster_usages")
      .select("id, user_id, booster, expires_at")
      .eq("status", "pending")
      .lt("expires_at", nowIso);
    if (expErr) {
      return NextResponse.json({ ok: false, error: expErr.message }, { status: 400 });
    }

    let refundCount = 0;

    for (const row of expired || []) {
      const usageId = (row as any).id as string;
      const userId = (row as any).user_id as string;
      const booster = (row as any).booster as string;

      // 2) Marca usage como expired ou refunded (vamos utilizar refunded pois há reembolso)
      const { error: updErr } = await sb
        .from("booster_usages")
        .update({ status: "refunded" })
        .eq("id", usageId)
        .eq("status", "pending");
      if (updErr) continue; // segue nos próximos

      // 3) Credita inventário via booster_purchases (source = 'refund')
      const { error: insErr } = await sb
        .from("booster_purchases")
        .insert({ user_id: userId, booster, amount: 1, source: "refund" });
      if (insErr) {
        // tenta reverter status para 'expired' caso não credite
        await sb.from("booster_usages").update({ status: "expired" }).eq("id", usageId);
        continue;
      }

      refundCount += 1;

      // 4) Cria notificação simples
      const { error: notifErr } = await sb.from("notifications").insert({
        user_id: userId,
        pool_id: null,
        type: "booster_refund",
        title: "Booster reembolsado",
        body: `Seu booster ${booster.replace(/_/g, " ")} expirou e foi reembolsado ao seu inventário.`,
        meta: { usage_id: usageId, booster },
      });
      // ignore notifErr
    }

    return NextResponse.json({ ok: true, processed: (expired || []).length, refunded: refundCount });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unexpected error" }, { status: 500 });
  }
}