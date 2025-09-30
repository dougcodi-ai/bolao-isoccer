import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Env vars
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string | undefined;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002") as string;

// Fallback de preços locais (BRL, em centavos) — deve espelhar /api/store/products
const UNIT_CENTS: Record<string, number> = {
  forgotten: 390,
  shield: 490,
  second_chance: 490,
  auto_pick: 990,
  // chaves canônicas PT (para compatibilidade)
  o_esquecido: 390,
  o_escudo: 490,
  segunda_chance: 490,
  palpite_automatico: 990,
};

function canonicalBoosterKey(k: string): string {
  switch ((k || "").toLowerCase()) {
    case "second_chance":
      return "segunda_chance";
    case "shield":
      return "o_escudo";
    case "forgotten":
      return "o_esquecido";
    case "auto_pick":
      return "palpite_automatico";
    case "o_esquecido":
    case "o_escudo":
    case "segunda_chance":
    case "palpite_automatico":
      return k;
    default:
      return k; // desconhecido mantém original
  }
}

function getOriginalBoosterKey(k: string): string {
  switch ((k || "").toLowerCase()) {
    case "segunda_chance":
      return "second_chance";
    case "o_escudo":
      return "shield";
    case "o_esquecido":
      return "forgotten";
    case "palpite_automatico":
      return "auto_pick";
    case "second_chance":
    case "shield":
    case "forgotten":
    case "auto_pick":
      return k;
    default:
      return k; // desconhecido mantém original
  }
}
function floorCents(n: number) { return Math.floor(n); }
function priceFor(pkgKey: "p1"|"p3"|"p5", unit: number) {
  if (pkgKey === "p3") return floorCents(unit * 3 * 0.95);
  if (pkgKey === "p5") return floorCents(unit * 5 * 0.9);
  return unit;
}

function parsePriceMap(raw?: string | null) {
  if (!raw) return null;
  try { const obj = JSON.parse(raw); if (obj && typeof obj === "object") return obj as any; } catch {}
  return null;
}

function resolvePriceId(priceMap: any, productKey: string, priceKey: string) {
  if (!priceMap) return null;
  const entry = priceMap[productKey];
  if (!entry) return null;
  if (typeof entry === "string") {
    return priceKey === "p1" ? entry : null;
  }
  if (entry && typeof entry === "object") {
    return entry[priceKey] || null;
  }
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
    const boosterKey: string = body?.boosterKey;
    const priceKey: "p1"|"p3"|"p5" = body?.priceKey || "p1";
    const qty: number = typeof body?.qty === "number" ? body.qty : (priceKey === "p3" ? 3 : priceKey === "p5" ? 5 : 1);

    if (!boosterKey) {
      return NextResponse.json({ ok: false, message: "Dados inválidos (boosterKey)." }, { status: 400 });
    }

    const canonicalKey = canonicalBoosterKey(boosterKey);
    // Resolve usuário a partir do token
    const sbUser = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, message: userErr?.message || "Usuário inválido" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Price map por ambiente
    const priceMapTest = parsePriceMap(process.env.STRIPE_PRICE_MAP_TEST || process.env.NEXT_PUBLIC_STRIPE_PRICE_MAP_TEST || null);
    const priceMapLive = parsePriceMap(process.env.STRIPE_PRICE_MAP_LIVE || process.env.NEXT_PUBLIC_STRIPE_PRICE_MAP_LIVE || null);
    const priceMap = isLiveKey ? priceMapLive : priceMapTest;

    // Para o mapeamento de preços, usar a chave original (inglês) se disponível
    const originalKey = getOriginalBoosterKey(boosterKey);
    const mappedPriceId = resolvePriceId(priceMap, originalKey, priceKey);

    // Fallback de valor local, quando não houver priceId
    const unit = UNIT_CENTS[boosterKey] ?? UNIT_CENTS[canonicalKey];
    if (!mappedPriceId && typeof unit !== "number") {
      return NextResponse.json({ ok: false, message: `Produto desconhecido: ${boosterKey}` }, { status: 400 });
    }

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = mappedPriceId
      ? { price: mappedPriceId, quantity: 1 }
      : {
          price_data: {
            currency: "brl",
            unit_amount: priceFor(priceKey, unit!),
            product_data: { name: `Booster ${canonicalKey} (${priceKey.toUpperCase()})` },
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
        kind: "booster",
        booster_key: canonicalKey,
        booster_key_raw: boosterKey,
        price_key: priceKey,
        qty: String(qty),
        user_id: userId,
      },
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Erro inesperado" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Endpoint de Checkout Booster ativo. Use POST." });
}