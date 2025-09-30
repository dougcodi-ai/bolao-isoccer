"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-6 py-16 text-center"><p>Carregando...</p></main>}>
      <PaymentSuccessPageInner />
    </Suspense>
  );
}

function PaymentSuccessPageInner() {
  const search = useSearchParams();
  const sessionId = search.get("session_id");
  const [status, setStatus] = useState<"confirming"|"paid"|"pending"|"canceled"|"unknown">("confirming");
  const [message, setMessage] = useState<string>("Confirmando pagamento...");
  const [poolId, setPoolId] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [boosterKey, setBoosterKey] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!sessionId) {
        setStatus("unknown");
        setMessage("Sessão não informada.");
        return;
      }
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const url = `/api/stripe/session/verify?session_id=${encodeURIComponent(sessionId)}&apply=1`;
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        const json = await res.json();
        if (!mounted) return;
        if (!json.ok) {
          setStatus("unknown");
          setMessage(json.message || "Não foi possível confirmar a sessão.");
          return;
        }
        setPoolId(json.pool_id || null);
        setKind(json.kind || null);
        setBoosterKey(json.booster_key || null);
        switch (json.status) {
          case "paid": {
            if (json.kind === "booster") {
              const name = (json.booster_key || "").replace(/_/g, " ").trim();
              setStatus("paid");
              setMessage(`Pagamento confirmado! Booster${name ? ` "${name}"` : ""} adicionado ao seu inventário. Redirecionando…`);
            } else if (json.kind === "upgrade") {
              setStatus("paid");
              setMessage("Pagamento confirmado! Seu plano foi atualizado. Redirecionando…");
            } else {
              setStatus("paid");
              setMessage("Pagamento confirmado! Seu bolão foi liberado. Redirecionando…");
            }
            break;
          }
          case "pending": {
            setStatus("pending");
            if (json.kind === "booster") {
              setMessage("Pagamento pendente. Seus boosters serão adicionados após a confirmação.");
            } else {
              setMessage("Pagamento pendente ou sessão ainda aberta. Se necessário, retorne ao checkout.");
            }
            break;
          }
          case "canceled": {
            setStatus("canceled");
            if (json.kind === "booster") {
              setMessage("Compra de booster cancelada ou sessão expirada.");
            } else {
              setMessage("Pagamento cancelado ou sessão expirada.");
            }
            break;
          }
          default:
            setStatus("unknown");
            setMessage("Status desconhecido. Tente novamente em instantes.");
        }
      } catch (e: any) {
        if (!mounted) return;
        setStatus("unknown");
        setMessage(e?.message || "Erro ao verificar sessão");
      }
    })();
    return () => { mounted = false };
  }, [sessionId]);

  useEffect(() => {
    // Quando houver poolId e status pago, persistir seleção para o Dashboard abrir no bolão certo
    if (status === "paid" && poolId && typeof window !== "undefined") {
      try { window.localStorage.setItem("last_pool_id", poolId); } catch {}
    }
  }, [status, poolId]);

  useEffect(() => {
    // Redireciona automaticamente após confirmar pagamento
    if (status === "paid") {
      const to = kind === "booster" ? "/boosters" : "/palpites";
      const t = setTimeout(() => { router.replace(to); }, 1500);
      return () => clearTimeout(t);
    }
  }, [status, kind, router]);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-extrabold mb-4">Pagamento</h1>
      <p className="text-slate-300 mb-8">{message}</p>
      <div className="space-x-3">
        {kind === "booster" ? (
          <>
            <Link href="/palpites" className="btn-primary">Ir para Palpites</Link>
            <Link href="/boosters" className="btn-ghost">Ver inventário</Link>
          </>
        ) : (
          <>
            <Link href="/palpites" className="btn-primary">Ir para Palpites</Link>
            <Link href="/" className="btn-ghost">Voltar ao início</Link>
          </>
        )}
      </div>
    </main>
  );
}