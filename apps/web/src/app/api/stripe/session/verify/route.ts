import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string | undefined;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const poolIdFromQuery = searchParams.get("pool_id");
    const apply = String(searchParams.get("apply") || "").toLowerCase();
    const shouldApply = apply === "1" || apply === "true" || apply === "yes";

    // Modo DEV/Debug: permitir fluxo sem Stripe real
    if (process.env.NODE_ENV !== "production") {
      if (!sessionId) {
        return NextResponse.json({ ok: false, message: "session_id ausente" }, { status: 400 });
      }
      if (sessionId === "debug" || sessionId === "test_paid") {
        return NextResponse.json({
          ok: true,
          status: "paid",
          pool_id: poolIdFromQuery || null,
          plan_key: "debug",
          kind: "debug",
          booster_key: null,
          amount_total: 0,
          currency: "BRL",
          _mocked: true,
        });
      }
      // Mocks para testes de Boosters em dev
      if (sessionId === "test_booster_paid") {
        const resp: any = {
          ok: true,
          status: "paid",
          pool_id: poolIdFromQuery || null,
          plan_key: null,
          kind: "booster",
          booster_key: "segunda_chance",
          amount_total: 500,
          currency: "BRL",
          _mocked: true,
        };
        // REMOVIDO: Inserção direta de compras sem validação de pagamento
        // Todas as compras devem passar pelo webhook do Stripe para garantir idempotência
        return NextResponse.json(resp);
      }
      if (sessionId === "test_booster_pending") {
        return NextResponse.json({
          ok: true,
          status: "pending",
          pool_id: poolIdFromQuery || null,
          plan_key: null,
          kind: "booster",
          booster_key: "segunda_chance",
          amount_total: 500,
          currency: "BRL",
          _mocked: true,
        });
      }
      if (!STRIPE_SECRET_KEY) {
        // Sem chave em dev e não é id de debug: retornar pendente para não quebrar UX
        return NextResponse.json({
          ok: true,
          status: "pending",
          pool_id: poolIdFromQuery || null,
          plan_key: null,
          kind: null,
          booster_key: null,
          amount_total: null,
          currency: "BRL",
          _mocked: true,
        });
      }
    }

    if (!sessionId) {
      return NextResponse.json({ ok: false, message: "session_id ausente" }, { status: 400 });
    }

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, message: "Stripe não configurado." }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: any) {
      const msg = err?.message || "Erro ao recuperar sessão";
      const isNotFound = /No such checkout\.session/i.test(msg);
      return NextResponse.json({ ok: false, message: isNotFound ? "Sessão não encontrada" : msg }, { status: isNotFound ? 404 : 400 });
    }

    // Mapear status para nosso domínio
    const s = session.status; // 'open' | 'complete' | 'expired'
    const pay = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'
    let status: "paid" | "pending" | "canceled" | "unknown" = "unknown";
    if (s === "complete" && pay === "paid") status = "paid";
    else if (s === "open") status = "pending";
    else if (s === "expired") status = "canceled";
    else status = "unknown";

    const pool_id = (session.metadata?.pool_id as string) || null;
    const plan_key = (session.metadata?.plan_key as string) || null;
    const kind = (session.metadata?.kind as string) || null;
    const booster_key = (session.metadata?.booster_key as string) || null;
    const qty = parseInt((session.metadata?.qty as string) || "1", 10) || 1;
    const user_id = (session.metadata?.user_id as string) || null;

    // REMOVIDO: Fallback que permitia inserção direta de compras
    // Todas as compras devem ser processadas exclusivamente pelo webhook do Stripe
    // para garantir idempotência e validação adequada de pagamento
    let applied = false;

    return NextResponse.json({
      ok: true,
      status,
      pool_id,
      plan_key,
      kind,
      booster_key,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
      applied: applied || undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Erro inesperado" }, { status: 500 });
  }
}