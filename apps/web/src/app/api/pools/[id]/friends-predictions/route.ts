import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// GET /api/pools/[id]/friends-predictions?matchId=<uuid>
// Requires Authorization: Bearer <supabase access token>
// Returns predictions from other members of the pool for the given match,
// excluding members with the booster "o_escudo" active (not expired).
// Also returns whether the requesting user has already saved their own prediction
// for the match (ownSaved). If not, the client UI should hide the section.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const poolIdOrCode = (params.id || "").trim();
    const url = new URL(req.url);
    const matchId = (url.searchParams.get("matchId") || "").trim();
    if (!poolIdOrCode || !matchId) {
      return NextResponse.json({ ok: false, error: "Missing pool id/code or matchId" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ ok: false, error: "Missing Authorization Bearer token" }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Missing Supabase envs" }, { status: 500 });
    }

    const sbUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const sbAdmin = createClient(supabaseUrl, serviceKey);

    // Resolve current user
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: userErr?.message || "Invalid user token" }, { status: 401 });
    }
    const userId = userData.user.id as string;

    // Resolve pool by id or code (admin client)
    let pool: { id: string; code?: string | null } | null = null;
    {
      const byId = await sbAdmin.from("pools").select("id, code").eq("id", poolIdOrCode).maybeSingle();
      if (byId.data) pool = { id: byId.data.id as string, code: (byId.data as any).code };
      else {
        const byCode = await sbAdmin.from("pools").select("id, code").eq("code", poolIdOrCode).maybeSingle();
        if (byCode.data) pool = { id: byCode.data.id as string, code: (byCode.data as any).code };
      }
    }
    if (!pool) {
      return NextResponse.json({ ok: false, error: "Pool not found" }, { status: 404 });
    }
    const poolId = pool.id;

    // Verify membership of requesting user (user client respects RLS)
    {
      const { data: membership } = await sbUser
        .from("pool_members")
        .select("pool_id, user_id, role")
        .eq("pool_id", poolId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ ok: false, error: "User is not a member of this pool" }, { status: 403 });
      }
    }

    // Ensure match belongs to the pool (admin; some environments store matches with pool_id)
    {
      const { data: match } = await sbAdmin
        .from("matches")
        .select("id, pool_id")
        .eq("id", matchId)
        .maybeSingle();
      if (!match || (match as any).pool_id !== poolId) {
        return NextResponse.json({ ok: false, error: "Match not found in the given pool" }, { status: 404 });
      }
    }

    // Check if requester has own saved prediction
    let ownSaved = false;
    {
      const { data: ownPred } = await sbUser
        .from("predictions")
        .select("match_id, home_pred, away_pred")
        .eq("user_id", userId)
        .eq("match_id", matchId)
        .eq("status", "active")
        .maybeSingle();
      ownSaved = Boolean(ownPred);
    }

    // Fetch all members of the pool (admin)
    const { data: members } = await sbAdmin
      .from("pool_members")
      .select("user_id")
      .eq("pool_id", poolId);
    const memberIds: string[] = (members || []).map((m: any) => String(m.user_id)).filter(Boolean);

    // Early exit: if no members
    if (memberIds.length === 0) {
      return NextResponse.json({ ok: true, ownSaved, predictions: [], hidden_count: 0, total_members_count: 0 });
    }

    // Find users with active Shield (o_escudo) in this pool, not expired
    const nowIso = new Date().toISOString();
    const { data: shields } = await sbAdmin
      .from("booster_usages")
      .select("user_id, booster, status, expires_at")
      .eq("pool_id", poolId)
      .in("user_id", memberIds)
      .eq("booster", "o_escudo");
    const shielded = new Set<string>();
    (shields || []).forEach((r: any) => {
      const status = String(r.status || "consumed");
      const exp = r.expires_at ? String(r.expires_at) : null;
      const active = status === "active" && (!exp || exp > nowIso);
      if (active) shielded.add(String(r.user_id));
    });

    // Fetch predictions for the given match from all pool members (admin)
    const { data: preds } = await sbAdmin
      .from("predictions")
      .select("user_id, match_id, home_pred, away_pred, status")
      .eq("match_id", matchId)
      .in("user_id", memberIds)
      .eq("status", "active");

    // Join with profiles to get display_name
    const userIdsWithPreds = Array.from(new Set((preds || []).map((p: any) => String(p.user_id))));
    const { data: profiles } = userIdsWithPreds.length > 0
      ? await sbAdmin.from("profiles").select("id, display_name").in("id", userIdsWithPreds)
      : { data: [] as any };
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((pr: any) => { nameMap[String(pr.id)] = (pr.display_name || "Usuário"); });

    // Exclude requester himself and shielded users
    const result = (preds || [])
      .filter((p: any) => String(p.user_id) !== userId)
      .filter((p: any) => !shielded.has(String(p.user_id)))
      .map((p: any) => ({
        user_id: String(p.user_id),
        display_name: nameMap[String(p.user_id)] || "Usuário",
        home_pred: Number(p.home_pred),
        away_pred: Number(p.away_pred),
      }));

    const hiddenCount = (preds || []).filter((p: any) => shielded.has(String(p.user_id))).length;

    return NextResponse.json({
      ok: true,
      pool: { id: poolId },
      match_id: matchId,
      ownSaved,
      predictions: result,
      hidden_count: hiddenCount,
      total_members_count: memberIds.length,
      visible_count: result.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}