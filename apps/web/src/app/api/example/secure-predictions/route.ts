import { NextRequest, NextResponse } from "next/server";
import { getSecureSupabase } from "@/lib/security/secure-supabase";
import { validateInput, PredictionSchema } from "@/lib/security/validation";
import { SecurityLogger } from "@/lib/security/logger";
import { createHash } from "crypto";

export const runtime = "nodejs";

/**
 * API Segura para Criação de Palpites
 * Demonstra como usar o sistema de segurança implementado
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const secureSupabase = getSecureSupabase({
    enableDatabaseSecurity: true,
    enableDataProtection: true,
    enableSecurityLogging: true,
    maxQueriesPerMinute: 50, // Limite mais restritivo para palpites
    logSensitiveOperations: true
  });

  const logger = new SecurityLogger(secureSupabase.client);

  try {
    // 1. Validação inicial de parâmetros
    const poolIdOrCode = (params.id || "").trim();
    if (!poolIdOrCode) {
      await logger.logSecurityEvent({
        type: 'invalid_request',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { error: 'Missing pool id/code' }
      });
      return NextResponse.json({ ok: false, error: "Missing pool id/code" }, { status: 400 });
    }

    // 2. Validação de autenticação
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      await logger.logSecurityEvent({
        type: 'authentication_failed',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { error: 'Missing Authorization Bearer token' }
      });
      return NextResponse.json({ ok: false, error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    // 3. Obter usuário autenticado
    const user = await secureSupabase.getAuthenticatedUser();
    const userId = user.id;

    // 4. Validação e sanitização do corpo da requisição
    const body = await req.json().catch(() => ({}));
    
    // Detectar atividade suspeita no payload
    const bodyString = JSON.stringify(body);
    const isSuspicious = await secureSupabase.detectSuspiciousActivity(bodyString, req);
    if (isSuspicious) {
      return NextResponse.json({ ok: false, error: "Suspicious activity detected" }, { status: 400 });
    }

    // Validar schema do palpite
    const validationResult = validateInput(body, PredictionSchema);
    if (!validationResult.success) {
      await logger.logSecurityEvent({
        type: 'invalid_request',
        userId,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { error: 'Invalid payload', validation_errors: validationResult.errors }
      });
      return NextResponse.json({ 
        ok: false, 
        error: "Invalid payload", 
        details: validationResult.errors 
      }, { status: 400 });
    }

    const { matchId, home_pred, away_pred } = validationResult.data;

    // 5. Verificação de idempotência
    const idemKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    const bodyHash = createHash("sha256").update(JSON.stringify({ matchId, home_pred, away_pred })).digest("hex");
    
    if (idemKey) {
      const idempotencyResult = await secureSupabase.secureSelect(
        "idempotency_log",
        {
          select: "response, status_code, expires_at, request_hash",
          filter: { user_id: userId, key: idemKey }
        },
        req
      );

      if (idempotencyResult.data && idempotencyResult.data.length > 0) {
        const idem = idempotencyResult.data[0];
        const expiresAt = idem.expires_at ? new Date(idem.expires_at) : null;
        
        if (!expiresAt || expiresAt.getTime() > Date.now()) {
          if (idem.request_hash && idem.request_hash !== bodyHash) {
            return NextResponse.json({ 
              ok: false, 
              error: "Idempotency-Key reuse with different payload" 
            }, { status: 409 });
          }
          
          const resp = idem.response ?? { ok: true };
          const code = Number(idem.status_code) || 200;
          return NextResponse.json(resp, { status: code });
        }
      }
    }

    // 6. Resolver pool por ID ou código (com segurança)
    let pool: { id: string; code?: string | null } | null = null;
    
    // Tentar por ID primeiro
    const poolByIdResult = await secureSupabase.secureSelect(
      "pools",
      {
        select: "id, code",
        filter: { id: poolIdOrCode }
      },
      req
    );

    if (poolByIdResult.data && poolByIdResult.data.length > 0) {
      pool = poolByIdResult.data[0];
    } else {
      // Tentar por código
      const poolByCodeResult = await secureSupabase.secureSelect(
        "pools",
        {
          select: "id, code",
          filter: { code: poolIdOrCode }
        },
        req
      );

      if (poolByCodeResult.data && poolByCodeResult.data.length > 0) {
        pool = poolByCodeResult.data[0];
      }
    }

    if (!pool) {
      await logger.logSecurityEvent({
        type: 'unauthorized_access',
        userId,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { error: 'Pool not found or not allowed', poolIdOrCode }
      });
      return NextResponse.json({ ok: false, error: "Pool not found or not allowed" }, { status: 404 });
    }

    const poolId = pool.id;

    // 7. Verificar se a partida existe e pertence ao bolão
    const matchResult = await secureSupabase.secureSelect(
      "matches",
      {
        select: "id, pool_id, start_time",
        filter: { id: matchId, pool_id: poolId }
      },
      req
    );

    if (!matchResult.data || matchResult.data.length === 0) {
      return NextResponse.json({ ok: false, error: "Match not found in this pool" }, { status: 404 });
    }

    const match = matchResult.data[0];

    // 8. Verificar janela de edição
    const startTime = new Date(match.start_time);
    const now = new Date();
    if (now >= startTime) {
      return NextResponse.json({ ok: false, error: "Match has already started" }, { status: 400 });
    }

    // 9. Verificar se já existe palpite (para decidir entre insert/update)
    const existingPredictionResult = await secureSupabase.secureSelect(
      "predictions",
      {
        select: "match_id, user_id",
        filter: { match_id: matchId, user_id: userId, status: 'active' }
      },
      req
    );

    const hasExistingPrediction = existingPredictionResult.data && existingPredictionResult.data.length > 0;

    // 10. Criar ou atualizar palpite de forma segura
    const predictionData = {
      match_id: matchId,
      user_id: userId,
      home_pred,
      away_pred,
      status: 'active',
      market: '1x2',
      created_at: new Date().toISOString()
    };

    let result;
    if (hasExistingPrediction) {
      // Atualizar palpite existente
      result = await secureSupabase.secureUpdate(
        "predictions",
        {
          home_pred,
          away_pred,
          updated_at: new Date().toISOString()
        },
        { match_id: matchId, user_id: userId, status: 'active' },
        req
      );
    } else {
      // Inserir novo palpite
      result = await secureSupabase.secureInsert(
        "predictions",
        predictionData,
        req
      );
    }

    if (result.error) {
      await logger.logSecurityEvent({
        type: 'database_error',
        userId,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { error: result.error.message, operation: hasExistingPrediction ? 'update' : 'insert' }
      });
      return NextResponse.json({ ok: false, error: "Failed to save prediction" }, { status: 500 });
    }

    // 11. Registrar idempotência se fornecida
    if (idemKey) {
      const responseBody = { ok: true, prediction: { matchId, home_pred, away_pred } };
      await secureSupabase.secureInsert(
        "idempotency_log",
        {
          user_id: userId,
          key: idemKey,
          request_hash: bodyHash,
          response: responseBody,
          status_code: 200,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        },
        req
      );
    }

    // 12. Log de sucesso
    await logger.logSecurityEvent({
      type: 'successful_operation',
      userId,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: { 
        operation: hasExistingPrediction ? 'update_prediction' : 'create_prediction',
        poolId,
        matchId
      }
    });

    return NextResponse.json({ 
      ok: true, 
      prediction: { matchId, home_pred, away_pred },
      action: hasExistingPrediction ? 'updated' : 'created'
    });

  } catch (error) {
    // Log de erro de segurança
    await logger.logSecurityEvent({
      type: 'api_error',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: '/api/example/secure-predictions'
      }
    });

    console.error("Secure predictions API error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

/**
 * GET - Obter palpites do usuário de forma segura
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const secureSupabase = getSecureSupabase();
  const logger = new SecurityLogger(secureSupabase.client);

  try {
    const poolIdOrCode = (params.id || "").trim();
    if (!poolIdOrCode) {
      return NextResponse.json({ ok: false, error: "Missing pool id/code" }, { status: 400 });
    }

    // Obter usuário autenticado
    const user = await secureSupabase.getAuthenticatedUser();
    const userId = user.id;

    // Resolver pool
    let poolId: string | null = null;
    
    const poolByIdResult = await secureSupabase.secureSelect(
      "pools",
      {
        select: "id",
        filter: { id: poolIdOrCode }
      },
      req
    );

    if (poolByIdResult.data && poolByIdResult.data.length > 0) {
      poolId = poolByIdResult.data[0].id;
    } else {
      const poolByCodeResult = await secureSupabase.secureSelect(
        "pools",
        {
          select: "id",
          filter: { code: poolIdOrCode }
        },
        req
      );

      if (poolByCodeResult.data && poolByCodeResult.data.length > 0) {
        poolId = poolByCodeResult.data[0].id;
      }
    }

    if (!poolId) {
      return NextResponse.json({ ok: false, error: "Pool not found" }, { status: 404 });
    }

    // Obter palpites do usuário
    const predictionsResult = await secureSupabase.secureSelect(
      "predictions",
      {
        select: "match_id, home_pred, away_pred, created_at, updated_at",
        filter: { user_id: userId, status: 'active' }
      },
      req
    );

    // Filtrar apenas palpites de partidas do bolão
    const matchesResult = await secureSupabase.secureSelect(
      "matches",
      {
        select: "id",
        filter: { pool_id: poolId }
      },
      req
    );

    const matchIds = matchesResult.data?.map(m => m.id) || [];
    const userPredictions = predictionsResult.data?.filter(p => matchIds.includes(p.match_id)) || [];

    return NextResponse.json({ 
      ok: true, 
      predictions: userPredictions 
    });

  } catch (error) {
    await logger.logSecurityEvent({
      type: 'api_error',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: '/api/example/secure-predictions [GET]'
      }
    });

    console.error("Secure predictions GET API error:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
}