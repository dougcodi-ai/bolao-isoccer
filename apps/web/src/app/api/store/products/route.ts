import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Configuração de catálogo local (fallback) — valores em centavos (BRL)
const BASE_PRODUCTS = [
  {
    key: "forgotten",
    title: "O Esquecido",
    kind: "consumable" as const,
    description: "Abrir possibilidade de palpite quando o prazo de 1 hora ou menos do jogo estiver esgotado. Recupere um palpite esquecido antes do início do jogo.",
    unitPriceCents: 390,
  },
  {
    key: "shield",
    title: "Escudo",
    kind: "temporal" as const,
    description: "Não exibir o palpite a outros integrantes do grupo, até o início do jogo. Seu palpite secreto até a hora do jogo!",
    unitPriceCents: 490,
  },
  {
    key: "second_chance",
    title: "Segunda Chance",
    kind: "consumable" as const,
    description: "Refazer um palpite já enviado. Permitido o uso até 10 min antes do horário do jogo começar.",
    unitPriceCents: 490,
  },
  {
    key: "auto_pick",
    title: "Palpite Automático",
    kind: "temporal" as const,
    description: "Inserção automática do sistema do placar 2 x 0, sempre para o time da casa. 7 dias de palpites automáticos quando você esquecer.",
    unitPriceCents: 990,
  },
];

function floorCents(n: number) {
  return Math.floor(n);
}

function makePackages(unit: number) {
  // Política de pacotes: 1, 3 (-5%), 5 (-10%), arredondando para baixo
  const p1 = unit;
  const p3 = floorCents(unit * 3 * 0.95);
  const p5 = floorCents(unit * 5 * 0.9);
  return [
    { qty: 1, priceCents: p1, priceKey: "p1" },
    { qty: 3, priceCents: p3, priceKey: "p3" },
    { qty: 5, priceCents: p5, priceKey: "p5" },
  ] as const;
}

function parsePriceMap(raw?: string | null) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as any;
    return null;
  } catch {
    return null;
  }
}

function resolveEnv(): "test" | "live" {
  // Preferimos produção como "live"; demais ambientes são "test"
  return process.env.NODE_ENV === "production" ? "live" : "test";
}

// Suporta dois formatos de mapping por produto:
// 1) { forgotten: "price_..." }  // único (p1)
// 2) { forgotten: { p1: "price_...", p3: "price_...", p5: "price_..." } }
function resolvePriceId(priceMap: any, productKey: string, priceKey: string) {
  if (!priceMap) return null;
  const entry = priceMap[productKey];
  if (!entry) return null;
  if (typeof entry === "string") {
    // Mapa simples — assume p1
    return priceKey === "p1" ? entry : null;
  }
  if (entry && typeof entry === "object") {
    return entry[priceKey] || null;
  }
  return null;
}

export async function GET(_req: NextRequest) {
  const env = resolveEnv();
  const currency = "BRL";

  const priceMapTest = parsePriceMap(process.env.STRIPE_PRICE_MAP_TEST || process.env.NEXT_PUBLIC_STRIPE_PRICE_MAP_TEST || null);
  const priceMapLive = parsePriceMap(process.env.STRIPE_PRICE_MAP_LIVE || process.env.NEXT_PUBLIC_STRIPE_PRICE_MAP_LIVE || null);
  const priceMap = env === "live" ? priceMapLive : priceMapTest;

  const products = BASE_PRODUCTS.map((p) => {
    const packages = makePackages(p.unitPriceCents).map((pkg) => ({
      qty: pkg.qty,
      priceCents: pkg.priceCents,
      priceId: resolvePriceId(priceMap, p.key, pkg.priceKey),
      discountPercent: pkg.qty === 3 ? 5 : pkg.qty === 5 ? 10 : 0,
    }));
    return {
      key: p.key,
      title: p.title,
      kind: p.kind,
      description: p.description,
      unitPriceCents: p.unitPriceCents,
      currency,
      packages,
    };
  });

  return NextResponse.json({ ok: true, env, currency, products });
}