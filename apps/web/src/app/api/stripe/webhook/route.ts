import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string | undefined;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string | undefined;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;

export const runtime = "nodejs"; // ensure Node runtime to access raw body

export async function POST(req: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, message: "Stripe webhook não configurado." }, { status: 500 });
    }

    // Guard de ambiente: impedir uso de chave LIVE em dev
    const isLiveKey = STRIPE_SECRET_KEY?.startsWith("sk_live");
    if (isLiveKey && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, message: "Uso de STRIPE LIVE key bloqueado em ambiente de desenvolvimento." }, { status: 400 });
    }

    if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, message: "Supabase env ausente." }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Get raw body for signature verification
    const buf = await req.arrayBuffer();
    const rawBody = Buffer.from(buf);
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, message: "Assinatura ausente" }, { status: 400 });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      return NextResponse.json({ ok: false, message: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
    }

    const sbAdmin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const safeUpdatePaymentStatus = async (poolId: string, status: "paid" | "canceled") => {
      const { error } = await sbAdmin.from("pools").update({ payment_status: status }).eq("id", poolId);
      if (error) {
        const msg = error.message || "";
        const isSchemaCacheIssue = /could not find|does not exist/i.test(msg) && /payment_status/i.test(msg);
        if (!isSchemaCacheIssue) {
          console.warn("Falha ao atualizar payment_status:", msg);
        }
      }
    };

    const ensureOwnerMembership = async (poolId: string, userId: string) => {
      const { error } = await sbAdmin.from("pool_members").insert({ pool_id: poolId, user_id: userId, role: "owner" });
      if (error) {
        const msg = error.message || "";
        const isDuplicate = /duplicate key value|unique constraint/i.test(msg);
        if (!isDuplicate) {
          console.warn("Falha ao garantir membership do owner:", msg);
        }
      }
    };

    const safeUpsertPayment = async (payload: { stripe_session_id: string; user_id: string | null; pool_id: string | null; amount_cents: number | null; status: string }) => {
      const { error } = await sbAdmin.from("payments").upsert(payload, { onConflict: "stripe_session_id" });
      if (error) {
        const msg = error.message || "";
        const isSchemaCacheIssue = /could not find|does not exist|undefined table/i.test(msg) && /payments/i.test(msg);
        if (!isSchemaCacheIssue) {
          console.warn("Falha ao registrar payment:", msg);
        }
      }
    };

    const recordBoosterPurchase = async (userId: string, booster: string, amount: number, poolId?: string | null) => {
      const payload: any = { user_id: userId, booster, amount };
      if (poolId) payload.pool_id = poolId; // opcional
      const { error } = await sbAdmin.from("booster_purchases").insert(payload);
      if (error) {
        console.warn("Falha ao inserir booster_purchases:", error.message || error);
      }
    };

    const incrementPoolMaxMembers = async (poolId: string, add: number) => {
      // Buscar valor atual e aplicar incremento com segurança
      const { data: row, error: selErr } = await sbAdmin
        .from("pools")
        .select("max_members")
        .eq("id", poolId)
        .limit(1)
        .single();
      if (selErr) {
        console.warn("Falha ao ler max_members:", selErr.message || selErr);
        return false;
      }
      const current = typeof (row as any)?.max_members === "number" ? (row as any).max_members : 50;
      const next = Math.max(1, current + add);
      const { error: updErr } = await sbAdmin
        .from("pools")
        .update({ max_members: next })
        .eq("id", poolId);
      if (updErr) {
        console.warn("Falha ao incrementar max_members:", updErr.message || updErr);
        return false;
      }
      return true;
    };

    // Utilitário de idempotência por evento Stripe (por usuário)
    const processOnce = async (
      userId: string | null,
      key: string,
      work: () => Promise<void>
    ): Promise<{ alreadyProcessed: boolean }> => {
      // tenta inserir registro de idempotência (unique user_id+key)
      const { error: insErr } = await sbAdmin
        .from("idempotency_log")
        .insert({ user_id: userId, key })
        .select("id")
        .single();

      if (insErr) {
        const isDuplicate = /duplicate key value|unique constraint/i.test(insErr.message || "");
        if (isDuplicate) {
          return { alreadyProcessed: true };
        }
        // outros erros: loga e segue (não arriscar múltiplas aplicações)
        console.warn("Idempotency insert falhou:", insErr.message || insErr);
        return { alreadyProcessed: false };
      }

      await work();
      // atualização opcional de response/status_code omitida para não bloquear processamento
      return { alreadyProcessed: false };
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const kind = session.metadata?.kind;
        const poolId = (session.metadata?.pool_id as string) || null;
        const userId = (session.metadata?.user_id as string) || null;

        if (kind === "booster" && userId) {
          const boosterKey = String((session.metadata as any)?.booster_key || (session.metadata as any)?.booster || (session.metadata as any)?.booster_key_raw || "").trim();
          const qty = Number((session.metadata as any)?.qty || 1) || 1;

          const idem = await processOnce(userId, `stripe_event:${event.id}`, async () => {
            await recordBoosterPurchase(userId, boosterKey, qty, poolId);
            try {
              await sbAdmin.from("notifications").insert({
                user_id: userId,
                pool_id: poolId || null,
                type: "booster_purchase",
                title: "Booster adquirido",
                body: `Você comprou ${qty}x ${boosterKey.replace(/_/g, " ")}.`,
                meta: { booster: boosterKey, qty },
              });
            } catch (_) {}
          });
          // Não alterar payment_status para boosters
        } else if (kind === "upgrade" && poolId) {
          let alreadyProcessed = false;
          try {
            const { data: prev } = await sbAdmin
              .from("payments")
              .select("status")
              .eq("stripe_session_id", session.id)
              .limit(1);
            if (prev && (prev as any[]).length && (prev as any[])[0]?.status === "paid") alreadyProcessed = true;
          } catch (_) {}

          const add = parseInt((session.metadata?.add as string) || "0", 10) || 0;
          if (!alreadyProcessed && add > 0) {
            await incrementPoolMaxMembers(poolId, add);
          }
          await safeUpdatePaymentStatus(poolId, "paid");
          if (userId) {
            await ensureOwnerMembership(poolId, userId);
          }
        } else {
          if (poolId) {
            await safeUpdatePaymentStatus(poolId, "paid");
            if (userId) {
              await ensureOwnerMembership(poolId, userId);
            }
          }
        }

        await safeUpsertPayment({
          stripe_session_id: session.id,
          user_id: userId,
          pool_id: poolId,
          amount_cents: typeof session.amount_total === "number" ? session.amount_total : null,
          status: session.payment_status || "paid",
        });
        break;
      }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;
      const poolId = (session.metadata?.pool_id as string) || null;
      const userId = (session.metadata?.user_id as string) || null;

      if (kind !== "booster" && poolId) {
        await safeUpdatePaymentStatus(poolId, "canceled");
      }

      await safeUpsertPayment({
        stripe_session_id: session.id,
        user_id: userId,
        pool_id: poolId,
        amount_cents: typeof session.amount_total === "number" ? session.amount_total : null,
        status: "canceled",
      });
      break;
    }
    case "payment_intent.payment_failed": {
      const d = event.data.object as any;
      const kind = d?.metadata?.kind;
      const poolId = d?.metadata?.pool_id || null;
      if (kind !== "booster" && poolId) {
        await safeUpdatePaymentStatus(poolId, "canceled");
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}