import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

// POST /api/pools/[id]/predictions
// Body: { matchId: string, home_pred: number, away_pred: number }
// Auth: Authorization: Bearer <supabase access token>
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const poolIdOrCode = (params.id || "").trim();
    if (!poolIdOrCode) {
      return NextResponse.json({ ok: false, error: "Missing pool id/code" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const idemKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ ok: false, error: "Missing Authorization Bearer token" }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();

    const body = await req.json().catch(() => ({} as any));
    const matchId: string = (body.matchId || "").trim();
    const home_pred = Number(body.home_pred);
    const away_pred = Number(body.away_pred);

    if (!matchId || Number.isNaN(home_pred) || Number.isNaN(away_pred)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ ok: false, error: "Supabase env not configured" }, { status: 500 });
    }

    // Client autenticado do usuário (RLS aplicado)
    const sbUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    // Admin client (para idempotency_log)
    const sbAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

    // Resolve usuário
    const { data: userInfo, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userInfo?.user) {
      return NextResponse.json({ ok: false, error: userErr?.message || "Invalid user token" }, { status: 401 });
    }
    const userId = userInfo.user.id as string;

    // Pré-checagem de idempotência (se disponível)
    const bodyHash = createHash("sha256").update(JSON.stringify({ matchId, home_pred, away_pred })).digest("hex");
    if (idemKey && sbAdmin) {
      const { data: idem, error: idemErr } = await sbAdmin
        .from("idempotency_log")
        .select("response, status_code, expires_at, request_hash")
        .eq("user_id", userId)
        .eq("key", idemKey)
        .maybeSingle();
      if (!idemErr && idem) {
        const exp = idem as any;
        const expiresAt = exp.expires_at ? new Date(exp.expires_at) : null;
        if (!expiresAt || expiresAt.getTime() > Date.now()) {
          if (exp.request_hash && exp.request_hash !== bodyHash) {
            return NextResponse.json({ ok: false, error: "Idempotency-Key reuse with different payload" }, { status: 409 });
          }
          const resp = (exp.response as any) ?? { ok: true };
          const code = Number(exp.status_code) || 200;
          return NextResponse.json(resp, { status: code });
        }
      }
    }

    // Resolve pool por id OU code (RLS deve permitir se usuário é membro)
    let pool: { id: string; code?: string | null } | null = null;
    {
      const byId = await sbUser.from("pools").select("id, code").eq("id", poolIdOrCode).maybeSingle();
      if (byId.data) pool = { id: byId.data.id as string, code: (byId.data as any).code };
      else {
        const byCode = await sbUser.from("pools").select("id, code").eq("code", poolIdOrCode).maybeSingle();
        if (byCode.data) pool = { id: byCode.data.id as string, code: (byCode.data as any).code };
      }
    }
    if (!pool) {
      return NextResponse.json({ ok: false, error: "Pool not found or not allowed" }, { status: 404 });
    }

    const poolId = pool.id;

    // Carrega a partida garantindo pertinência ao bolão e janela de edição
    const { data: match, error: matchErr } = await sbUser
      .from("matches")
      .select("id, pool_id, start_time")
      .eq("id", matchId)
      .eq("pool_id", poolId)
      .maybeSingle();
    if (matchErr || !match) {
      return NextResponse.json({ ok: false, error: "Match not found in this pool or not allowed" }, { status: 404 });
    }

    // Timming boundaries
    const startsAt = match.start_time ? new Date(match.start_time as any) : null;
    if (!startsAt) {
      return NextResponse.json({ ok: false, error: "Match start_time invalid" }, { status: 400 });
    }
    const nowMs = Date.now();
    const startMs = startsAt.getTime();
    const baseLockMs = startMs - 60 * 60 * 1000; // T-60
    const extendedLockMs = startMs - 15 * 60 * 1000; // T-15 (limite O Esquecido)

    // Busca palpite existente
    const { data: existingPred } = await sbUser
      .from("predictions")
      .select("match_id, user_id")
      .eq("match_id", matchId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    // Helper para buscar ativação de booster
    async function findActivation(boosterId: string) {
      // Preferência: por partida no bolão; fallback: global ativo e não expirado
      const common = sbUser
        .from("booster_activations")
        .select("id, booster_id, scope, match_id, expires_at, status")
        .eq("user_id", userId)
        .in("pool_id", [poolId, null as any]);

      const byMatch = await common
        .eq("booster_id", boosterId)
        .eq("status", "active")
        .eq("match_id", matchId)
        .maybeSingle();
      if (byMatch.data) return byMatch.data as any;

      const { data: globals } = await sbUser
        .from("booster_activations")
        .select("id, booster_id, scope, match_id, expires_at, status")
        .eq("user_id", userId)
        .is("match_id", null)
        .in("pool_id", [poolId, null as any])
        .eq("booster_id", boosterId)
        .eq("status", "active");
      const validGlobal = (globals || []).find((g: any) => !g.expires_at || new Date(g.expires_at).getTime() > nowMs);
      return validGlobal || null;
    }

    // Verificação de janelas
    let boosterUsed: null | { id: string; activationId: string } = null;
    const beforeBaseLock = nowMs < baseLockMs;
    const betweenBaseAndExtended = nowMs >= baseLockMs && nowMs < extendedLockMs;
    const beforeStart = nowMs < startMs;

    if (beforeBaseLock) {
      // Livre para inserir/atualizar
    } else if (betweenBaseAndExtended) {
      if (existingPred) {
        // Requer segunda_chance para ALTERAR
        const sc = await findActivation("segunda_chance");
        if (!sc) {
          return NextResponse.json({ ok: false, error: "Prediction locked (need Segunda Chance to update)" }, { status: 400 });
        }
        boosterUsed = { id: "segunda_chance", activationId: (sc as any).id };
      } else {
        // Requer o_esquecido para INSERIR
        const oe = await findActivation("o_esquecido");
        if (!oe) {
          return NextResponse.json({ ok: false, error: "Prediction locked (need O Esquecido to insert)" }, { status: 400 });
        }
        boosterUsed = { id: "o_esquecido", activationId: (oe as any).id };
      }
    } else if (beforeStart) {
      // Entre T-15 e T0: somente Segunda Chance para ALTERAR um palpite já existente
      if (!existingPred) {
        return NextResponse.json({ ok: false, error: "Prediction locked (window closed for new predictions)" }, { status: 400 });
      }
      const sc = await findActivation("segunda_chance");
      if (!sc) {
        return NextResponse.json({ ok: false, error: "Prediction locked (need Segunda Chance to update)" }, { status: 400 });
      }
      boosterUsed = { id: "segunda_chance", activationId: (sc as any).id };
    } else {
      // T0+ sempre fechado
      return NextResponse.json({ ok: false, error: "Prediction window closed for this match" }, { status: 400 });
    }

    // Upsert do palpite (com status/market/outcome para 1x2)
    const outcome = home_pred === away_pred ? 0 : (home_pred > away_pred ? 1 : -1);
    const { error: upErr } = await sbUser
      .from("predictions")
      .upsert(
        { match_id: matchId, user_id: userId, home_pred, away_pred, status: 'active', market: '1x2', outcome },
        { onConflict: "match_id,user_id" }
      );
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
    }

    // Registra consumo do booster se aplicável
    if (boosterUsed) {
      // Inserir uso
      await sbUser.from("booster_usages").insert({
        pool_id: pool.id,
        user_id: userId,
        match_id: matchId,
        booster: boosterUsed.id,
        status: 'consumed'
      } as any);
      // Expira ativação por partida para evitar reuso
      await sbUser
        .from("booster_activations")
        .update({ status: 'expired' })
        .eq("id", boosterUsed.activationId)
        .eq("match_id", matchId)
        .eq("status", "active");
    }

    const respBody = { ok: true } as const;

    // Persistir idempotência
    if (idemKey && sbAdmin) {
      await sbAdmin
        .from("idempotency_log")
        .upsert({ user_id: userId, key: idemKey, request_hash: bodyHash, response: respBody as any, status_code: 200 }, { onConflict: "user_id,key" });
    }

    return NextResponse.json(respBody);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unexpected error" }, { status: 500 });
  }
}