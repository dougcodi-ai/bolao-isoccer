"use client";

import { useEffect, useState, useCallback } from "react";
import Protected from "@/components/Protected";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useBoosterInventory } from "@/lib/hooks/useBoosterInventory";
import { AlarmClock, RefreshCw, Bot, ShoppingCart, Zap } from "lucide-react";

// Tipos
type PackageInfo = {
  qty: number;
  priceCents: number;
  priceId?: string | null;
  discountPercent: number;
};

type Product = {
  key: string;
  title: string;
  kind: "consumable" | "temporal" | "upgrade";
  description: string;
  unitPriceCents: number;
  currency: string;
  packages: PackageInfo[];
};

type CatalogResponse = {
  ok: boolean;
  env: "test" | "live";
  currency: string;
  products: Product[];
};

// Pools
type Pool = { id: string; name: string };

function priceKeyFromQty(qty: number): "p1" | "p3" | "p5" {
  if (qty === 3) return "p3";
  if (qty === 5) return "p5";
  return "p1";
}

// Normaliza as keys dos boosters para o padrão usado no backend
function canonicalBoosterKey(k: string): string {
  const v = (k || "").toLowerCase();
  if (v === "forgotten") return "o_esquecido";
  if (v === "second_chance" || v === "segunda chance" || v === "segunda_chance") return "segunda_chance";
  if (v === "auto_pick" || v === "autopick" || v === "palpite automatico" || v === "palpite_automatico") return "palpite_automatico";
  return v.replace(/\s+/g, "_");
}

// Ícones para cada tipo de booster
function getBoosterIcon(key: string) {
  const canonical = canonicalBoosterKey(key);
  switch (canonical) {
    case "o_esquecido":
      return <AlarmClock className="w-5 h-5" />;
    case "segunda_chance":
      return <RefreshCw className="w-5 h-5" />;
    case "palpite_automatico":
      return <Bot className="w-5 h-5" />;
    default:
      return <Zap className="w-5 h-5" />;
  }
}

// Nomes amigáveis para exibição
function getBoosterDisplayName(key: string): string {
  const canonical = canonicalBoosterKey(key);
  switch (canonical) {
    case "o_esquecido":
      return "O Esquecido";
    case "segunda_chance":
      return "Segunda Chance";
    case "palpite_automatico":
      return "Palpite Automático";
    default:
      return key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }
}

export default function BoostersPage() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { inventory: inv, loading: invLoading, refetch } = useBoosterInventory();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const countOf = useCallback((key: string) => {
    if (inv && key in inv) return inv[key] || 0;
    return 0;
  }, [inv]);

  // Pools do usuário (mantidos apenas para UX de navegação; compra NÃO depende de bolão)
  const [memberPools, setMemberPools] = useState<Pool[]>([]);

  // Estado de compra
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Carregar catálogo de produtos
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/store/products", { cache: "no-store" });
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json: CatalogResponse = await res.json();
        if (active) setData(json);
      } catch (e: any) {
        if (active) setError(e?.message || "Falha ao carregar catálogo");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Carregar dados do usuário e bolões
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const u = auth.user;
        if (!u) return;
        if (!mounted) return;
        setUserId(u.id);

        // Buscar nome de exibição do perfil
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", u.id)
            .maybeSingle();
          setDisplayName(prof?.display_name || null);
        } catch {}

        // Buscar bolões do usuário
        const { data: mems, error: memErr } = await supabase
          .from("pool_members")
          .select("pool_id")
          .eq("user_id", u.id)
          .order("joined_at", { ascending: false });
        if (memErr) throw memErr;
        const ids = (mems || []).map((m: any) => m.pool_id);
        let pools: Pool[] = [];
        if (ids.length > 0) {
          const { data: rows, error } = await supabase
            .from("pools")
            .select("id,name")
            .in("id", ids);
          if (error) throw error;
          // manter ordem por membership recente
          const order = new Map(ids.map((id: string, idx: number) => [id, idx]));
          pools = (rows || []).sort((a: any, b: any) => order.get(a.id)! - order.get(b.id)!);
        }
        if (!mounted) return;
        setMemberPools(pools);
      } catch (e) {
        console.warn(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Função de compra
  async function buy(boosterKey: string, qty: number) {
    const key = `${boosterKey}:${qty}`;
    setBuyingKey(key);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const priceKey = priceKeyFromQty(qty);
      const resp = await fetch("/api/stripe/checkout/booster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ boosterKey, priceKey, qty }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) throw new Error(json?.message || "Falha na criação da sessão de pagamento");
      if (json.url) {
        window.location.href = json.url as string;
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Não foi possível iniciar o checkout.");
    } finally {
      setBuyingKey(null);
    }
  }

  // Função para atualizar inventário manualmente
  const handleRefreshInventory = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <Protected>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero Section */}
        <header className="text-center mb-12">
          <h1 className="heading text-4xl md:text-5xl font-extrabold text-white mb-4">
            Boosters para você, {" "}
            <span className="text-primary">{displayName || "camisa 10"}</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto mb-6">
            Converta pequenos ajustes em grandes resultados. Use boosters para turbinar palpites decisivos, proteger rodadas e subir no ranking.
          </p>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <Link href="/palpites" className="btn-primary">
              <Zap className="w-4 h-4 mr-2" />
              Fazer Palpites
            </Link>
          </div>

          {/* Quick Navigation */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
            <a href="#booster-o_esquecido" className="btn-ghost text-sm">O Esquecido</a>
            <a href="#booster-segunda_chance" className="btn-ghost text-sm">Segunda Chance</a>
            <a href="#booster-palpite_automatico" className="btn-ghost text-sm">Palpite Automático</a>
          </div>

          {/* Environment Indicator */}
          {data && (
            <div className="text-xs text-slate-400">
              Ambiente: {data.env === "live" ? "Produção" : "Teste"}
            </div>
          )}
        </header>

        {/* Usage Info */}
        <section className="text-center text-sm text-slate-400 mb-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <p>💡 Compras são adicionadas ao seu inventário. Para usar, escolha o bolão na página de palpites.</p>
        </section>

        {/* Inventory Summary */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Seu Inventário</h2>
            <button
              onClick={handleRefreshInventory}
              className="btn-ghost text-sm"
              disabled={invLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${invLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {/* O Esquecido */}
            <div className="card p-6 flex items-center justify-between bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                  <AlarmClock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">O Esquecido</h3>
                  <p className="text-xs text-slate-400">Palpite tardio</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-orange-400">
                {invLoading ? "..." : countOf("o_esquecido")}
              </span>
            </div>

            {/* Segunda Chance */}
            <div className="card p-6 flex items-center justify-between bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Segunda Chance</h3>
                  <p className="text-xs text-slate-400">Proteção de rodada</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-blue-400">
                {invLoading ? "..." : countOf("segunda_chance")}
              </span>
            </div>

            {/* Palpite Automático */}
            <div className="card p-6 flex items-center justify-between bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Palpite Automático</h3>
                  <p className="text-xs text-slate-400">IA inteligente</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-green-400">
                {invLoading ? "..." : countOf("palpite_automatico")}
              </span>
            </div>
          </div>
        </section>

        {/* Loading and Error States */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
            <p className="text-slate-300">Carregando catálogo...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-400">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="btn-primary mt-4"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {data && (
          <section>
            <h2 className="text-2xl font-bold text-white text-center mb-8">Produtos Disponíveis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.products.map((product) => {
                const canonicalKey = canonicalBoosterKey(product.key);
                const displayName = getBoosterDisplayName(product.key);
                const icon = getBoosterIcon(product.key);
                const currentInventory = countOf(canonicalKey);

                return (
                  <article 
                    key={product.key} 
                    id={`booster-${canonicalKey}`} 
                    className="card p-6 flex flex-col h-full bg-gradient-to-br from-white/5 to-white/2 border-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    {/* Product Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-primary/20 rounded-lg text-primary">
                        {icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white">{displayName}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {invLoading ? (
                            <span className="flex items-center gap-1">
                              <div className="inline-block h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Atualizando...
                            </span>
                          ) : (
                            <span>
                              Você possui <span className="font-semibold text-primary">{currentInventory}</span> deste booster
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Product Description */}
                    <p className="text-slate-300 text-sm mb-6 flex-1">{product.description}</p>

                    {/* Package Options */}
                    <div className="space-y-3">
                      {product.packages.map((pkg) => {
                        const key = `${canonicalKey}:${pkg.qty}`;
                        const disabled = !!buyingKey;
                        const isCurrentlyBuying = buyingKey === key;

                        return (
                          <div 
                            key={pkg.qty} 
                            className="flex items-center justify-between rounded-lg bg-black/20 p-4 border border-white/5 hover:border-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-primary/20 text-primary text-sm font-bold">
                                x{pkg.qty}
                              </span>
                              {pkg.discountPercent > 0 && (
                                <span className="px-2 py-1 text-xs font-semibold bg-accent/20 text-accent rounded-full">
                                  -{pkg.discountPercent}%
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-semibold text-white">
                                  {(pkg.priceCents / 100).toLocaleString("pt-BR", { 
                                    style: "currency", 
                                    currency: product.currency 
                                  })}
                                </div>
                                {!pkg.priceId && (
                                  <div className="text-[10px] text-slate-400">preço local</div>
                                )}
                              </div>
                              
                              <button
                                className={`btn-primary min-w-[100px] ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                                disabled={disabled}
                                onClick={() => buy(canonicalKey, pkg.qty)}
                              >
                                {isCurrentlyBuying ? (
                                  <span className="flex items-center gap-2">
                                    <div className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Redirecionando...
                                  </span>
                                ) : (
                                  "Comprar"
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer Info */}
        <footer className="mt-16 text-center text-sm text-slate-400 border-t border-white/10 pt-8">
          <p>
            Os boosters são processados via Stripe e adicionados automaticamente ao seu inventário.
            <br />
            Em caso de problemas, entre em contato com o suporte.
          </p>
        </footer>
      </main>
    </Protected>
  );
}