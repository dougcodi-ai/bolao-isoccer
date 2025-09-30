import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This endpoint is for local/dev testing of Realtime updates.
// It requires the caller to include the Supabase access token via Authorization: Bearer <token>.
// Usage example (from a client page using supabase.auth.getSession):
//   fetch(`/api/test/realtime?poolCode=2W9DR3&pointsDelta=5&doPrediction=true`, {
//     headers: { Authorization: `Bearer ${session.access_token}` }
//   })

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const poolCode = (url.searchParams.get("poolCode") || "").trim();
  const pointsDeltaStr = url.searchParams.get("pointsDelta") || "5";
  const doPrediction = (url.searchParams.get("doPrediction") || "true").toLowerCase() === "true";

  if (!poolCode) {
    return NextResponse.json({ error: "Missing poolCode query param" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "Missing Authorization Bearer token. Call this endpoint from the app with your Supabase session token." },
      { status: 401 }
    );
  }
  const token = authHeader.slice(7).trim();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }

  // Client autenticado pelo usuário para leituras e operações permitidas por RLS
  const sbUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Client com Service Role (se disponível) para bypass de RLS nas escritas de 'points'
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_KEY_DEV ||
    undefined;
  const sbAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  try {
    // Resolve current user from token
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: userErr?.message || "Invalid user token" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Get pool id by code
    const { data: poolRow, error: poolErr } = await sbUser
      .from("pools")
      .select("id, name")
      .eq("code", poolCode)
      .maybeSingle();
    if (poolErr || !poolRow) {
      return NextResponse.json({ error: poolErr?.message || "Pool not found for given code" }, { status: 404 });
    }
    const poolId = poolRow.id as string;

    // GARANTE associação do usuário ao bolão para satisfazer RLS nas tabelas points/predictions
    let membershipRole: string | null = null;
    {
      const { data: membership, error: memErr } = await sbUser
        .from("pool_members")
        .select("pool_id, role")
        .eq("pool_id", poolId)
        .eq("user_id", userId)
        .maybeSingle();
      if (membership) {
        membershipRole = membership.role as string | null;
      } else {
        // tenta criar via user
        const { error: joinErr } = await sbUser
          .from("pool_members")
          .upsert({ pool_id: poolId, user_id: userId, role: "member" }, { onConflict: "pool_id,user_id" });
        if (joinErr && sbAdmin) {
          // fallback via service role
          const { error: joinAdminErr } = await sbAdmin
            .from("pool_members")
            .upsert({ pool_id: poolId, user_id: userId, role: "member" }, { onConflict: "pool_id,user_id" });
          if (joinAdminErr) {
            return NextResponse.json({ error: `Failed to ensure membership: ${joinAdminErr.message}` }, { status: 400 });
          }
        } else if (joinErr && !sbAdmin) {
          return NextResponse.json({ error: `Failed to ensure membership (RLS). Consider configuring SUPABASE_SERVICE_ROLE_KEY.` }, { status: 400 });
        }
      }
    }

    const pointsDelta = Number(pointsDeltaStr);
    if (!Number.isFinite(pointsDelta)) {
      return NextResponse.json({ error: "Invalid pointsDelta" }, { status: 400 });
    }

    // Fetch existing points (leitura pode ser com token do usuário)
    const { data: existingPts, error: ptsSelErr } = await sbUser
      .from("points")
      .select("points")
      .eq("pool_id", poolId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ptsSelErr) {
      return NextResponse.json({ error: ptsSelErr.message }, { status: 400 });
    }

    // Seleciona client de escrita: Service Role se disponível, senão o do usuário
    const sbWrite = sbAdmin ?? sbUser;

    let newPoints = pointsDelta;
    if (existingPts?.points != null) {
      newPoints = Number(existingPts.points) + pointsDelta;
      const { error: updErr } = await sbWrite
        .from("points")
        .update({ points: newPoints })
        .eq("pool_id", poolId)
        .eq("user_id", userId);
      if (updErr) {
        if (!sbAdmin && /row-level security/i.test(updErr.message)) {
          return NextResponse.json({ error: `RLS blocked points update. Configure SUPABASE_SERVICE_ROLE_KEY in server env to bypass for dev tests.` }, { status: 403 });
        }
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }
    } else {
      const { error: insErr } = await sbWrite
        .from("points")
        .insert({ pool_id: poolId, user_id: userId, points: newPoints });
      if (insErr) {
        if (!sbAdmin && /row-level security/i.test(insErr.message)) {
          return NextResponse.json({ error: `RLS blocked points insert. Configure SUPABASE_SERVICE_ROLE_KEY in server env to bypass for dev tests.` }, { status: 403 });
        }
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    let predictionResult: any = null;
    if (doPrediction) {
      // Find an upcoming match for this pool
      const nowIso = new Date().toISOString();
      const { data: nextMatch, error: matchErr } = await sbUser
        .from("matches")
        .select("id")
        .eq("pool_id", poolId)
        .gte("start_time", nowIso)
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();
    
      if (!matchErr && nextMatch?.id) {
        const matchId = nextMatch.id as string;
        // Toggle-ish values to help spot on UI
        const home = 2;
        const away = 1;
        const { error: predErr } = await sbUser
          .from("predictions")
          .upsert(
            { user_id: userId, match_id: matchId, home_pred: home, away_pred: away },
            { onConflict: "user_id,match_id" }
          );
        if (predErr) {
          predictionResult = { error: predErr.message };
        } else {
          predictionResult = { matchId, home_pred: home, away_pred: away };
        }
      } else {
        // Se não houver jogo, criar um (se permitido) para tornar o teste qualificado
        const allowSeed = (url.searchParams.get("seedIfNone") || "true").toLowerCase() === "true";
        if (allowSeed && (sbAdmin || membershipRole === "owner" || membershipRole === "admin")) {
          const startAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min à frente
          const seedPayload = {
            pool_id: poolId,
            home_team: "Time A",
            away_team: "Time B",
            start_time: startAt.toISOString(),
          } as const;
          const writer = sbAdmin ?? sbUser; // admin ignora RLS; usuário só se owner/admin
          const { data: newMatch, error: insMatchErr } = await writer
            .from("matches")
            .insert(seedPayload)
            .select("id")
            .single();
          if (insMatchErr || !newMatch?.id) {
            predictionResult = { warning: "No upcoming match found and could not seed one.", details: insMatchErr?.message };
          } else {
            const matchId = newMatch.id as string;
            const home = 1;
            const away = 0;
            const { error: predErr } = await sbUser
              .from("predictions")
              .upsert(
                { user_id: userId, match_id: matchId, home_pred: home, away_pred: away },
                { onConflict: "user_id,match_id" }
              );
            if (predErr) {
              predictionResult = { seededMatch: matchId, error: predErr.message };
            } else {
              predictionResult = { seededMatch: matchId, home_pred: home, away_pred: away };
            }
          }
        } else {
          predictionResult = { warning: "No upcoming match found for this pool" };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      pool: { id: poolId, code: poolCode, name: poolRow.name },
      user: { id: userId },
      points: { newPoints },
      prediction: predictionResult,
      usedServiceRole: Boolean(sbAdmin),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}