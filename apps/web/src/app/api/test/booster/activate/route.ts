import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, message: "Dev/Test-only endpoint" }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, message: "Ambiente Supabase ausente (URL/SERVICE)." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const poolCode: string | undefined = body.poolCode;
    const boosterId: string = (body.boosterId || body.booster || "palpite_automatico").toString();
    const scope: "global" | "match" | "pool" = (body.scope || "pool").toString();
    const expiresInDays: number = Math.max(1, Math.min(365, Number(body.expiresInDays ?? 7)));
    const userId: string | undefined = body.userId;
    const forAllMembers: boolean = Boolean(body.forAllMembers || (!userId));

    const sb = createClient(supabaseUrl, serviceKey);

    // Resolve pool by code
    let poolId: string | null = null;
    if (poolCode) {
      const { data: pool, error: poolErr } = await sb
        .from("pools")
        .select("id")
        .eq("code", poolCode)
        .maybeSingle();
      if (poolErr || !pool) {
        return NextResponse.json({ ok: false, message: poolErr?.message || "Bolão não encontrado" }, { status: 404 });
      }
      poolId = pool.id as string;
    }

    // Load default duration from catalog if available
    let expiresAt: string | null = null;
    try {
      const { data: cat } = await sb.from("boosters").select("default_duration_days").eq("id", boosterId).maybeSingle();
      const days = Number((cat as any)?.default_duration_days ?? expiresInDays) || expiresInDays;
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      expiresAt = until.toISOString();
    } catch {
      const until = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      expiresAt = until.toISOString();
    }

    // Determine target users
    let targetUsers: string[] = [];
    if (forAllMembers && poolId) {
      const { data: members, error: memErr } = await sb
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", poolId);
      if (memErr) return NextResponse.json({ ok: false, message: memErr.message }, { status: 400 });
      targetUsers = (members || []).map((m: any) => m.user_id).filter(Boolean);
    } else if (userId) {
      targetUsers = [userId];
    } else {
      return NextResponse.json({ ok: false, message: "Informe userId ou forAllMembers + poolCode" }, { status: 400 });
    }

    // Filter out users that already have an active activation for this booster within same pool scope
    let filteredUsers = targetUsers;
    if (targetUsers.length > 0) {
      const { data: existing } = await sb
        .from("booster_activations")
        .select("user_id, pool_id, booster_id, status")
        .eq("booster_id", boosterId)
        .eq("status", "active")
        .in("user_id", targetUsers);
      const existsMap = new Map<string, boolean>();
      for (const r of existing || []) {
        const uid = (r as any).user_id as string;
        const p = ((r as any).pool_id as string | null) || null;
        const key = `${uid}__${p ?? "GLOBAL"}`;
        existsMap.set(key, true);
      }
      filteredUsers = targetUsers.filter((uid) => {
        const key = `${uid}__${scope === "pool" ? (poolId ?? "NULL") : null}`;
        return !existsMap.get(key);
      });
    }

    if (filteredUsers.length === 0) {
      return NextResponse.json({ ok: true, message: "Nenhum usuário elegível (tudo já ativo)", inserted: 0 });
    }

    const rows = filteredUsers.map((uid) => ({
      user_id: uid,
      pool_id: scope === "pool" ? poolId : null,
      booster_id: boosterId,
      scope: scope === "pool" ? "global" : (scope === "match" ? "match" : "global"),
      // if 'pool' requested we still keep scope 'global' but bind pool_id; this keeps semantics compatible with table constraint
      expires_at: expiresAt,
      status: "active" as const,
    }));

    const { data: inserted, error: insErr } = await sb.from("booster_activations").insert(rows).select("id, user_id, pool_id, booster_id, status, expires_at");
    if (insErr) return NextResponse.json({ ok: false, message: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, inserted: inserted || [], count: inserted?.length || 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Erro inesperado" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST com { poolCode, boosterId='palpite_automatico', scope='pool'|'global', expiresInDays, userId? ou forAllMembers:true }" });
}