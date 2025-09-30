import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function canonicalBoosterKey(k: string): string {
  switch ((k || "").toLowerCase()) {
    case "second_chance":
      return "segunda_chance";
    case "shield":
      return "o_escudo";
    case "forgotten":
      return "o_esquecido";
    case "o_esquecido":
    case "o_escudo":
    case "segunda_chance":
      return k;
    default:
      return k;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json({ ok: false, message: "Ambiente Supabase ausente (URL/ANON/SERVICE)." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ ok: false, message: "Token do usuário ausente (Authorization: Bearer)." }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();

    const sbUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const boosterRaw = String(body?.booster || body?.boosterKey || body?.key || "").trim();
    const booster = canonicalBoosterKey(boosterRaw);
    const poolId = (body?.poolId || body?.pool_id || null) as string | null;
    const matchId = (body?.matchId || body?.match_id || null) as string | null;
    const status = (body?.status || "consumed") as string;

    if (!booster) {
      return NextResponse.json({ ok: false, message: "Dados inválidos (booster)." }, { status: 400 });
    }

    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, message: userErr?.message || "Usuário inválido" }, { status: 401 });
    }
    const userId = userData.user.id;

    const rpc = await sbAdmin
      .rpc("consume_booster", {
        p_user_id: userId,
        p_booster: booster,
        p_pool_id: poolId,
        p_match_id: matchId,
        p_status: status,
      });

    if (rpc.error) {
      return NextResponse.json({ ok: false, message: rpc.error.message || String(rpc.error) }, { status: 400 });
    }

    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    if (!row || row.ok !== true) {
      return NextResponse.json({ ok: false, message: "Sem saldo disponível para este booster.", reason: "no_balance" }, { status: 409 });
    }

    try {
      await sbAdmin.from("notifications").insert({
        user_id: userId,
        pool_id: poolId,
        type: "booster_used",
        title: "Booster utilizado",
        body: `Você ativou 1x ${booster.replace(/_/g, " ")}.`,
        meta: { booster, match_id: matchId },
      });
    } catch (_) {}

    return NextResponse.json({ ok: true, usage_id: row.usage_id, booster, pool_id: poolId, match_id: matchId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Erro inesperado" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST com Authorization: Bearer <token> e JSON { booster, poolId?, matchId?, status? }" });
}