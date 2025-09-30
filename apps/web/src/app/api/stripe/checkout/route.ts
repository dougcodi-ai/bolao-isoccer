import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Expected env vars
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string | undefined;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002") as string;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ ok: false, message: "Stripe não configurado (STRIPE_SECRET_KEY ausente)." }, { status: 500 });
    }

    // Guard de ambiente: impedir uso de chave LIVE em dev
    const isLiveKey = STRIPE_SECRET_KEY?.startsWith("sk_live");
    if (isLiveKey && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, message: "Uso de STRIPE LIVE key bloqueado em ambiente de desenvolvimento." }, { status: 400 });
    }

    if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, message: "Supabase env ausente (NEXT_PUBLIC_SUPABASE_URL ou SERVICE_ROLE_KEY)." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ ok: false, message: "Token do usuário ausente." }, { status: 401 });
    }
    const userToken = authHeader.slice(7).trim();

    const body = await req.json().catch(() => ({}));
    const name: string = (body?.name || "").trim();
    const planKey: "craque"|"lenda"|"fenomeno"|"galera" = body?.planKey;
    const championship: string | null = body?.championship || null;
    // Ignoramos qualquer priceId enviado pelo cliente; usamos whitelist do servidor
    // const priceId: string | undefined = body?.priceId;

    if (!name || !planKey) {
      return NextResponse.json({ ok: false, message: "Dados inválidos." }, { status: 400 });
    }

    // Preços em centavos conforme planos definidos
    const centsByPlan: Record<string, number> = {
      craque: 1490,
      lenda: 1990,
      fenomeno: 2490,
      galera: 2990,
    };

    const titleByPlan: Record<string, string> = {
      craque: "Craque",
      lenda: "Lenda",
      fenomeno: "Fenômeno",
      galera: "Galera",
    };

    const amount = centsByPlan[planKey];
    const planTitle = titleByPlan[planKey];

    // Resolve current user from token
    const sbUser = createClient(NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, message: userErr?.message || "Usuário inválido" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Admin client to insert pending pool regardless of RLS
    const sbAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pre-cria registro do pool em pending, com code provisório (geramos no webhook ou mantemos aqui)
    const genCode = (len = 6) => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = ""; for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    };

    // Helper para detectar violação de unicidade do código
    const isUniqueViolation = (m: string) => /duplicate key value|unique constraint/i.test(m) && /code/i.test(m);

    // Gera code que não colida (melhorar: loop de verificação). Para dev, arriscamos e tratamos conflito no insert.
    const code = `P-${genCode(6)}`;

    // Tenta inserir o pool; caso o PostgREST ainda não tenha atualizado o cache do schema
    // (mensagem "could not find the '<col>' column of 'pools' in the schema cache"),
    // aplicamos um fallback removendo colunas opcionais e repetindo o insert.
    const basePayload: any = {
      name,
      owner_id: userId,
      code,
      premium: true,
      max_members: planKey === "craque" ? 20 : planKey === "lenda" ? 30 : planKey === "fenomeno" ? 40 : 50,
      plan_key: planKey,
      price_cents: amount,
      payment_status: "pending",
      championship,
    };

    const knownCols = ["championship", "payment_status", "plan_key", "price_cents", "stripe_session_id"] as const;
    const extractMissing = (m: string) => {
      const re1 = /could not find the '([^']+)' column of 'pools' in the schema cache/i;
      const re2 = /column\s+\"?([a-z_]+)\"?\s+does not exist/i;
      const re3 = /column\s+([a-z_]+)\s+of\s+relation\s+\"?pools\"?\s+does not exist/i;
      const m1 = m.match(re1); if (m1) return m1[1];
      const m2 = m.match(re2); if (m2) return m2[1];
      const m3 = m.match(re3); if (m3) return m3[1];
      const hit = knownCols.find(c => new RegExp(c, 'i').test(m));
      return hit || null;
    };

    let payload: any = { ...basePayload };
    let ins: { id?: string; code?: string } | null = null;
    let lastErrMsg: string | null = null;

    // Primeira tentativa com payload completo
    {
      const first = await sbAdmin
        .from("pools")
        .insert(payload)
        .select("id, code")
        .single();

      if (!first.error && first.data) {
        ins = first.data as any;
      } else if (first.error) {
        lastErrMsg = first.error.message || null;
      }
    }

    // Se deu erro relacionado a coluna, tenta remover progressivamente
    let attempts = 0;
    while (!ins && attempts < 5 && lastErrMsg) {
      const missing = extractMissing(lastErrMsg);
      if (missing && (missing in payload)) {
        delete payload[missing];
      } else {
        // remove próxima coluna conhecida presente
        const nextCol = knownCols.find(c => c in payload);
        if (!nextCol) break;
        delete payload[nextCol];
      }

      const retry = await sbAdmin
        .from("pools")
        .insert(payload)
        .select("id, code")
        .single();

      if (!retry.error && retry.data) {
        ins = retry.data as any;
        break;
      }
      attempts++;
      lastErrMsg = retry.error?.message || lastErrMsg;
    }

    // NOVO: se falhou por código duplicado, regegera e tenta novamente até 3 vezes
    let uniqueRetries = 0;
    while (!ins?.id && lastErrMsg && isUniqueViolation(lastErrMsg) && uniqueRetries < 2) {
      // regegera código e reseta payload/controle
      payload.code = `P-${genCode(6)}`;
      lastErrMsg = null;

      // primeira tentativa com payload atualizado
      const firstAgain = await sbAdmin
        .from("pools")
        .insert(payload)
        .select("id, code")
        .single();

      if (!firstAgain.error && firstAgain.data) {
        ins = firstAgain.data as any;
        break;
      } else if (firstAgain.error) {
        lastErrMsg = firstAgain.error.message || null;
      }

      // fallback de colunas novamente
      attempts = 0;
      while (!ins && attempts < 5 && lastErrMsg) {
        const missing = extractMissing(lastErrMsg);
        if (missing && (missing in payload)) {
          delete payload[missing];
        } else {
          const nextCol = knownCols.find(c => c in payload);
          if (!nextCol) break;
          delete payload[nextCol];
        }

        const retryAgain = await sbAdmin
          .from("pools")
          .insert(payload)
          .select("id, code")
          .single();

        if (!retryAgain.error && retryAgain.data) {
          ins = retryAgain.data as any;
          break;
        }
        attempts++;
        lastErrMsg = retryAgain.error?.message || lastErrMsg;
      }

      uniqueRetries++;
    }

    if (!ins?.id) {
      return NextResponse.json({ ok: false, message: `Falha ao criar pedido: ${lastErrMsg || "erro"}` }, { status: 400 });
    }

    const poolId = ins.id as string;

    // Whitelist de priceId por plano (definido no servidor por env JSON)
    // Ex.: STRIPE_PLAN_PRICE_IDS_TEST='{"craque":"price_123","lenda":"price_456"}'
    //      STRIPE_PLAN_PRICE_IDS_LIVE='{"craque":"price_live_abc"}'
    const rawMap = isLiveKey ? (process.env.STRIPE_PLAN_PRICE_IDS_LIVE as string | undefined)
                              : (process.env.STRIPE_PLAN_PRICE_IDS_TEST as string | undefined);
    let planPriceIds: Record<string, string> = {};
    try { if (rawMap) planPriceIds = JSON.parse(rawMap); } catch {}
    const mappedPriceId = planPriceIds?.[planKey];

    // Cria sessão do checkout
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = mappedPriceId
      ? { price: mappedPriceId, quantity: 1 }
      : {
          price_data: {
            currency: "brl",
            unit_amount: amount,
            product_data: { name: `Plano ${planTitle} - Bolão` },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [lineItem],
      success_url: `${SITE_URL}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pagamento/cancelado?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        pool_id: poolId,
        plan_key: planKey,
        user_id: userId,
      },
    });

    // Atualiza pools com stripe_session_id para vincular (ignorar caso coluna não exista)
    const upd = await sbAdmin
      .from("pools")
      .update({ stripe_session_id: session.id })
      .eq("id", poolId);
    if (upd.error) {
      const msg = upd.error.message || "";
      const missingStripeId = /could not find|does not exist/i.test(msg) && /stripe_session_id/i.test(msg);
      if (!missingStripeId) {
        // não bloquear o fluxo por este update
        // opcional: logar em console
      }
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Erro inesperado" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Endpoint de Checkout ativo. Use POST." });
}