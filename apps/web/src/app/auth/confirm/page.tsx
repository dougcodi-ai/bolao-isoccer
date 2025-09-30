"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ConfirmPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16"><p>Carregando...</p></main>}>
      <ConfirmPageInner />
    </Suspense>
  );
}

function ConfirmPageInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("Confirmando seu e-mail...");

  useEffect(() => {
    (async () => {
      try {
        const tokenHash = searchParams?.get("token_hash") || searchParams?.get("token");
        const typeParam = searchParams?.get("type") || "email"; // fallback seguro
        const returnToParam = searchParams?.get("returnTo");

        // Se recebemos token_hash (PKCE / link customizado), fazemos a troca por sessão
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: typeParam as any,
          });
          if (error) {
            setStatus(error.message || "Não foi possível confirmar seu e-mail.");
            return;
          }
          if (!data?.session) {
            // Em alguns fluxos, a sessão pode já estar ativa via redirecionamento implícito
            const { data: s } = await supabase.auth.getSession();
            if (!s.session) {
              setStatus("Confirmação realizada, mas não foi possível iniciar sessão automaticamente. Faça login.");
              return;
            }
          }
        } else {
          // Sem token_hash: fluxo implícito. Apenas valida a sessão.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setStatus("Link inválido ou expirado. Abra o link recebido por e-mail neste navegador.");
            return;
          }
        }

        // Se chegou aqui, há sessão. Completa o profile se houver nome pendente
        try {
          const { data: s } = await supabase.auth.getSession();
          const pendingName = typeof window !== 'undefined' ? localStorage.getItem('pending_display_name') : null;
          if (s.session && pendingName && pendingName.trim()) {
            await supabase.from('profiles').upsert({ id: s.session.user.id, display_name: pendingName.trim() });
            try { localStorage.removeItem('pending_display_name'); } catch {}
          }
        } catch {}

        // Se chegou até aqui, há sessão. Tenta auto-join de bolão pendente.
        const pending = typeof window !== "undefined" ? localStorage.getItem("pending_pool_code") : null;
        if (pending) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            const user = userData.user;
            if (user) {
              const { data: pool } = await supabase.from("pools").select("id").eq("code", pending).maybeSingle();
              if (pool?.id) {
                const { data: exists } = await supabase
                  .from("pool_members")
                  .select("pool_id, user_id")
                  .eq("pool_id", pool.id)
                  .eq("user_id", user.id)
                  .maybeSingle();
                if (!exists) {
                  await supabase.from("pool_members").insert({ pool_id: pool.id, user_id: user.id });
                }
                try { localStorage.removeItem("pending_pool_code"); } catch {}
              }
            }
          } catch {}
        }

        // Redireciona para destino final
        const dest = (returnToParam && returnToParam.startsWith("/")) ? returnToParam : "/palpites";
        window.location.replace(dest);
      } catch (err: any) {
        setStatus(err?.message || "Ocorreu um erro ao confirmar seu e-mail.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Elementos decorativos de futebol */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-24 right-12 w-28 h-18 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
          <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
          <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
        </svg>
        <svg className="absolute bottom-24 left-12 w-14 h-14 opacity-8 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1"/>
        </svg>
      </div>

      <div className="flex items-center justify-center min-h-screen px-6 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 shadow-2xl text-center">
            {/* Logo e Nome do Sistema */}
            <div className="w-full flex flex-col items-center justify-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" fill="currentColor"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Bolão ISoccer</h2>
              <p className="text-white/70 text-sm">A melhor forma de disputar palpites</p>
            </div>

            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">Confirmando cadastro</h1>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white/80">{status}</p>
              </div>
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-200 text-sm">
                  Aguarde enquanto processamos sua confirmação...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}