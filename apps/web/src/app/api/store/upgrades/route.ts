import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Preços fallback (centavos BRL)
const UPGRADE_BASE = [
  { add: 20, priceCents: 1990 },
  { add: 40, priceCents: 2990 },
  { add: 50, priceCents: 3790 },
  { add: 60, priceCents: 4490 },
] as const;

function parsePriceMap(raw?: string | null) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as any;
  } catch {}
  return null;
}

export async function GET(_req: NextRequest) {
  const env = process.env.NODE_ENV === "production" ? "live" : "test";
  const currency = "BRL";

  const priceMapTest = parsePriceMap(process.env.STRIPE_UPGRADE_PRICE_MAP_TEST || process.env.NEXT_PUBLIC_STRIPE_UPGRADE_PRICE_MAP_TEST || null);
  const priceMapLive = parsePriceMap(process.env.STRIPE_UPGRADE_PRICE_MAP_LIVE || process.env.NEXT_PUBLIC_STRIPE_UPGRADE_PRICE_MAP_LIVE || null);
  const priceMap = env === "live" ? priceMapLive : priceMapTest;

  const options = UPGRADE_BASE.map((u) => {
    // suportar formatos: { "20": "price_..." } ou { "20": { p1: "price_..." } } ou { "add_20": "price_..." }
    const k1 = String(u.add);
    const k2 = `add_${u.add}`;
    const entry = priceMap ? (priceMap[k1] ?? priceMap[k2]) : null;
    const priceId = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry.p1 || null) : null;
    return { add: u.add, priceCents: u.priceCents, priceId };
  });

  return NextResponse.json({ ok: true, env, currency, options });
}