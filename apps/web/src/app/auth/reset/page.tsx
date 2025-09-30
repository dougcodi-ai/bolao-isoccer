"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16"><p>Carregando...</p></main>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Mensagens derivadas
  const isSuccess = useMemo(() => (status ? /sucesso/i.test(status) : false), [status]);

  // Escuta mudanças de sessão para habilitar o formulário assim que o link for validado
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setEmail(session.user.email || "");
        setReady(true);
        setStatus(null);
      }
    });
    return () => {
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const processResetToken = async () => {
      setStatus("Validando link de redefinição...");

      // 1) Supabase verifyOtp com token_hash e type=recovery
      const type = searchParams?.get("type");
      const tokenHash = searchParams?.get("token_hash") || searchParams?.get("token");
      if (tokenHash && (!type || type === "recovery")) {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (error) {
            setStatus("Link inválido ou expirado. Solicite um novo link e abra-o neste navegador.");
            setReady(false);
          } else if (data?.user) {
            setEmail(data.user.email || "");
            setReady(true);
            setStatus(null);
            // Limpa a URL para evitar reprocessar o token ao recarregar
            try { router.replace("/auth/reset"); } catch {}
            return;
          }
        } catch {
          setStatus("Erro ao validar o link. Solicite um novo.");
          setReady(false);
        }
      }

      // 2) Fluxo com code (PKCE) -> exchangeCodeForSession
      const code = searchParams?.get('code');
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus("Link inválido ou expirado. Solicite um novo link e abra-o neste navegador.");
            setReady(false);
            return;
          }
          if (data.session?.user) {
            setEmail(data.session.user.email || "");
            setReady(true);
            setStatus(null);
            try { router.replace("/auth/reset"); } catch {}
            return;
          }
        } catch (err) {
          setStatus("Erro ao processar o link. Solicite um novo link.");
          setReady(false);
          return;
        }
      }

      // 3) Alternativa: tokens no hash (#access_token & #refresh_token)
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.replace(/^#/, "");
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          try {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error && data.session?.user) {
              setEmail(data.session.user.email || "");
              setReady(true);
              setStatus(null);
              try { router.replace("/auth/reset"); } catch {}
              return;
            }
          } catch {}
        }
      }

      // 4) Fallback: sessão ou usuário existente
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);
      const user = sessionData?.session?.user || userData?.user || null;
      if (user) {
        setEmail(user.email || "");
        setReady(true);
        setStatus(null);
      } else {
        setReady(false);
        setStatus("Link inválido ou expirado. Solicite um novo link e abra-o neste navegador.");
      }
    };

    processResetToken();
  }, [searchParams, router]);

  // Redireciona ao login após sucesso
  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch {}
        router.replace("/auth/login");
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [isSuccess, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    // Validações client-side
    if (password.length < 8) {
      setStatus("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setStatus("Use letras e números para maior segurança.");
      return;
    }
    if (password !== confirm) {
      setStatus("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = String(error.message || "Erro ao alterar senha.");
        if (/expire|expired|invalid/i.test(msg)) {
          setStatus(
            "Link inválido ou expirado (validade de até 2 horas). Solicite um novo em 'Esqueci minha senha'."
          );
        } else {
          setStatus(msg);
        }
      } else {
        setStatus("Senha alterada com sucesso! Redirecionando para o login...");
        // Faz logout imediatamente para evitar sessão inválida
        void supabase.auth.signOut()
      }
    } catch (e: any) {
      const msg = e?.message || "Não foi possível alterar a senha.";
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  };

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
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 shadow-2xl">
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

            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Redefinir senha</h1>
              <p className="text-white/70">Defina sua nova senha abaixo</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6" aria-describedby="status-message">
              {/* E-mail do solicitante (somente leitura) */}
              <div>
                <label htmlFor="email" className="block text-sm text-white/80 mb-2">
                  E-mail do solicitante
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  readOnly
                  className="w-full bg-white/5 text-white/60 px-4 py-3 border border-white/10 rounded-lg cursor-not-allowed"
                  aria-readonly="true"
                />
              </div>

              {/* Nova senha */}
              <div>
                <label htmlFor="new-password" className="block text-sm text-white/80 mb-2">
                  Insira nova senha
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Confirmar senha */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm text-white/80 mb-2">
                  Confirme nova senha
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {/* Status */}
              {status && (
                <div className={`${isSuccess ? "bg-green-500/20 border-green-500/30" : "bg-red-500/20 border-red-500/30"} border rounded-lg p-3`}>
                  <p
                    id="status-message"
                    className={`${isSuccess ? "text-green-200" : "text-red-300"} text-sm`}
                    role="alert"
                    aria-live="polite"
                  >
                    {status}
                  </p>
                </div>
              )}
              {!ready && !isSuccess && (
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-200 text-xs">Valide o link recebido por e-mail para habilitar a redefinição.</p>
                </div>
              )}

              <button 
                disabled={!ready || loading} 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg" 
                type="submit"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </div>
                ) : (
                  'Salvar nova senha'
                )}
              </button>
            </form>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link 
                href="/auth/forgot" 
                className="flex-1 bg-white/10 hover:bg-white/20 text-white text-center py-3 px-4 rounded-lg transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
              >
                Solicitar novo link
              </Link>
              <Link 
                href="/auth/login" 
                className="flex-1 bg-white/10 hover:bg-white/20 text-white text-center py-3 px-4 rounded-lg transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
              >
                Voltar ao login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}