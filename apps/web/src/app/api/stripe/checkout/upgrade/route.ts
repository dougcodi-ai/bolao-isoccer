import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string | undefined;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002") as string;

// Fallback de preços locais (BRL, em centavos)
const UPGRADE_UNIT_CENTS: Record<number, number> = {
  20: 1990,
  40: 2990,
  50: 3790,
  60: 4490,
};

function parsePriceMap(raw?: string | null) {
  if (!raw) return null;
  try { const obj = JSON.parse(raw); if (obj && typeof obj === "object") return obj as any; } catch {}
  return null;
}

function resolveUpgradePriceId(priceMap: any, add: number) {
  if (!priceMap) return null;
  const k1 = String(add);
  const k2 = `add_${add}`;
  const entry = priceMap[k1] ?? priceMap[k2];
  if (!entry) return null;
  if (typeof entry === "string") return entry; // único price
  if (entry && typeof entry === "object") return entry.p1 || null; // suporta formato { p1: "price_..." }
  return null;
}

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, message: "Stripe não configurado." }, { status: 500 });
    }
    const isLiveKey = STRIPE_SECRET_KEY?.startsWith("sk_live");
    if (isLiveKey && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, message: "Uso de STRIPE LIVE key bloqueado em desenvolvimento." }, { status: 400 });
    }
    if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ ok: false, message: "Supabase env ausente." }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ ok: false, message: "Token do usuário ausente." }, { status: 401 });
    }
    const userToken = authHeader.slice(7).trim();

    const body = await req.json().catch(() => ({}));
    const poolId: string = (body?.poolId || "").trim();
    const add: number = Number(body?.add || 0);

    if (!poolId || !add || ![20,40,50,60].includes(add)) {
      return NextResponse.json({ ok: false, message: "Dados inválidos (poolId/add)." }, { status: 400 });
    }

    // Resolve usuário a partir do token
    const sbUser = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, message: userErr?.message || "Usuário inválido" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Verifica se usuário é owner do pool
    const { data: pool, error: poolErr } = await sbUser
      .from("pools")
      .select("id, owner_id")
      .eq("id", poolId)
      .single();
    if (poolErr || !pool) {
      return NextResponse.json({ ok: false, message: "Bolão não encontrado." }, { status: 404 });
    }
    if (pool.owner_id !== userId) {
      return NextResponse.json({ ok: false, message: "Apenas o proprietário do bolão pode comprar upgrades." }, { status: 403 });
    }

    const priceMapTest = parsePriceMap(process.env.STRIPE_UPGRADE_PRICE_MAP_TEST || process.env.NEXT_PUBLIC_STRIPE_UPGRADE_PRICE_MAP_TEST || null);
    const priceMapLive = parsePriceMap(process.env.STRIPE_UPGRADE_PRICE_MAP_LIVE || process.env.NEXT_PUBLIC_STRIPE_UPGRADE_PRICE_MAP_LIVE || null);
    const mappedPriceId = resolveUpgradePriceId(isLiveKey ? priceMapLive : priceMapTest, add);

    const unit = UPGRADE_UNIT_CENTS[add];
    if (!mappedPriceId && typeof unit !== "number") {
      return NextResponse.json({ ok: false, message: `Upgrade desconhecido: +${add}` }, { status: 400 });
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = mappedPriceId
      ? { price: mappedPriceId, quantity: 1 }
      : {
          price_data: {
            currency: "brl",
            unit_amount: unit!,
            product_data: { name: `Upgrade de Bolão: +${add} vagas` },
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
        kind: "upgrade",
        pool_id: poolId,
        add: String(add),
        user_id: userId,
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Erro inesperado" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Endpoint de Checkout Upgrade ativo. Use POST." });
}