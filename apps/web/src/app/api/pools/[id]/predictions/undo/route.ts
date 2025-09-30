import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/pools/[id]/predictions/undo
// Body: { matchId: string }
// Auth: Authorization: Bearer <supabase access token>
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const poolIdOrCode = (params.id || "").trim();
    if (!poolIdOrCode) {
      return NextResponse.json({ ok: false, error: "Missing pool id/code" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ ok: false, error: "Missing Authorization Bearer token" }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();

    const body = await req.json().catch(() => ({} as any));
    const matchId: string = (body.matchId || "").trim();
    if (!matchId) {
      return NextResponse.json({ ok: false, error: "Invalid payload (matchId)" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ ok: false, error: "Supabase env not configured" }, { status: 500 });
    }

    // Client autenticado do usuário (RLS aplicado)
    const sbUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Resolve usuário
    const { data: userInfo, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ ok: false, error: userErr?.message || "Invalid user token" }, { status: 401 });
    }
    const userId = userInfo.user.id as string;

    // Resolve pool por id OU code (RLS deve permitir se usuário é membro)
    let pool: { id: string } | null = null;
    {
      const byId = await sbUser.from("pools").select("id").eq("id", poolIdOrCode).maybeSingle();
      if (byId.data) pool = { id: byId.data.id as string };
      else {
        const byCode = await sbUser.from("pools").select("id").eq("code", poolIdOrCode).maybeSingle();
        if (byCode.data) pool = { id: byCode.data.id as string };
      }
    }
    if (!pool) {
      return NextResponse.json({ ok: false, error: "Pool not found or not allowed" }, { status: 404 });
    }

    // Garante que a partida pertence ao bolão
    const { data: match, error: matchErr } = await sbUser
      .from("matches")
      .select("id, pool_id")
      .eq("id", matchId)
      .eq("pool_id", pool.id)
      .maybeSingle();
    if (matchErr || !match) {
      return NextResponse.json({ ok: false, error: "Match not found in this pool or not allowed" }, { status: 404 });
    }

    // Marca palpite como reverted_by_undo (sem apagar)
    const { data: updData, error: updErr } = await sbUser
      .from("predictions")
      .update({ status: "reverted_by_undo" })
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .select("match_id")
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    if (!updData) {
      return NextResponse.json({ ok: false, error: "Prediction not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unexpected error" }, { status: 500 });
  }
}