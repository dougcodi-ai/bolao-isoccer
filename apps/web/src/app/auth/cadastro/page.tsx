"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poolCode, setPoolCode] = useState<string | null>(null);
  const [inviteText, setInviteText] = useState<string | null>(null);
  // Estado para controlar se o usuário alterou manualmente o nome
  const [nameTouched, setNameTouched] = useState(false);
  const autoNameRef = useRef<string>("");

  // Deriva um nome amigável do e-mail
  const guessNameFromEmail = (e: string) => {
    if (!e) return "";
    const local = e.split("@")[0] || "";
    if (!local) return "";
    const cleaned = local
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "";
    return cleaned
      .split(" ")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code") || url.searchParams.get("convite");
    const text = url.searchParams.get("text");
    const qEmail = url.searchParams.get("email");
    const qUsername = url.searchParams.get("username") || url.searchParams.get("name");
    if (code) setPoolCode(code);
    if (text) {
      // Normaliza '+' para espaço e tenta decodificar caracteres percent-encoded com segurança
      let normalized = text.replace(/\+/g, " ");
      try {
        normalized = decodeURIComponent(normalized);
      } catch {}
      setInviteText(normalized);
    }
    // Pré-popula e-mail e nome a partir da URL
    if (qEmail) setEmail(qEmail);
    if (qUsername) {
      let normalizedUser = qUsername.replace(/\+/g, " ");
      try { normalizedUser = decodeURIComponent(normalizedUser); } catch {}
      setName(normalizedUser);
      setNameTouched(true);
      autoNameRef.current = normalizedUser;
    } else if (qEmail) {
      const candidate = guessNameFromEmail(qEmail);
      if (candidate) {
        setName(candidate);
        autoNameRef.current = candidate;
        setNameTouched(false);
      }
    }
  }, []);

  // Pré-validação de código inválido na URL (feedback + redirecionamento)
  useEffect(() => {
    (async () => {
      if (!poolCode) return;
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id')
        .eq('code', poolCode)
        .maybeSingle();
      if (poolError || !pool) {
        try { localStorage.setItem('pending_toast', JSON.stringify({ type: 'error', message: 'Código de convite inválido ou expirado.' })) } catch {}
        // Redireciona para a home
        window.location.href = '/';
      }
    })();
  }, [poolCode]);

  // Se o usuário já estiver logado e houver código de convite na URL, entrar direto no bolão
  useEffect(() => {
    (async () => {
      if (!poolCode) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const joined = await tryAutoJoin(poolCode);
      if (joined) {
        try { localStorage.setItem('pending_toast', JSON.stringify({ type: 'success', message: 'Você entrou no bolão!' })) } catch {}
        window.location.href = '/palpites';
      }
    })();
  }, [poolCode]);
  useEffect(() => {
    if (!nameTouched && email) {
      const candidate = guessNameFromEmail(email);
      if (candidate && (name.trim() === "" || name === autoNameRef.current)) {
        setName(candidate);
        autoNameRef.current = candidate;
      }
    }
  }, [email, nameTouched]);

  async function tryAutoJoin(code: string) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return false;
    const { data: pool, error: poolError } = await supabase
      .from("pools")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (poolError || !pool) return false;
    const { data: exists } = await supabase
      .from("pool_members")
      .select("pool_id, user_id")
      .eq("pool_id", pool.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (exists) return true;
    const { error } = await supabase.from("pool_members").insert({ pool_id: pool.id, user_id: user.id });
    return !error;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validação: confirmar senha igual
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);

    // Guarda o nome em localStorage para conclusão pós-confirmação
    try { localStorage.setItem("pending_display_name", name.trim()); } catch {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Caso a sessão já esteja disponível (ex.: confirmação de email desativada), atualiza o profile imediatamente
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session && name.trim()) {
        const userId = sessionData.session.user.id;
        await supabase.from("profiles").upsert({ id: userId, display_name: name.trim() });
        try { localStorage.removeItem("pending_display_name"); } catch {}
      }
    } catch {}

    // Se já houver sessão (e.g., email desativado), tenta auto-join imediato
    const code = poolCode || "";
    if (code) {
      const joined = await tryAutoJoin(code);
      if (joined) {
        try { localStorage.setItem('pending_toast', JSON.stringify({ type: 'success', message: 'Bem-vindo! Você entrou no bolão.' })) } catch {}
        window.location.href = "/palpites";
        return;
      }
      // Caso não tenha sessão ainda, salva para pós-confirmação/login
      try { localStorage.setItem("pending_pool_code", code); } catch {}
    }

    try { localStorage.setItem('pending_toast', JSON.stringify({ type: 'success', message: 'Conta criada! Verifique seu e-mail para confirmar o cadastro.' })) } catch {}
  };

  // Ao carregar a página pós-redirecionamento com sessão (ex: após confirmar e voltar), tentar consumir pending_pool_code
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData.session;
      if (!hasSession) return;
      const pending = typeof window !== 'undefined' ? localStorage.getItem("pending_pool_code") : null;
      if (pending) {
        const ok = await tryAutoJoin(pending);
        if (ok) {
            try { localStorage.removeItem("pending_pool_code"); } catch {}
            window.location.href = "/palpites";
          }
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Elementos decorativos de futebol */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-20 right-10 w-32 h-20 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
          <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
          <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
        </svg>
        <svg className="absolute bottom-20 left-20 w-16 h-16 opacity-8 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1"/>
        </svg>
      </div>

      <div className="flex items-center justify-center min-h-screen px-6 py-20">
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
              <h1 className="text-3xl font-bold text-white mb-2">Criar conta</h1>
              <p className="text-white/70">
                Já tem conta? <Link href="/auth/login" className="inline-block bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-md transition-all duration-200 border border-white/20">Entrar</Link>
              </p>
            </div>

            {inviteText && (
              <div className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
                {inviteText}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm text-white/80 mb-2">Nome</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setName(v);
                    if (v !== autoNameRef.current) setNameTouched(true);
                    if (v.trim() === "") setNameTouched(false);
                  }}
                  placeholder="Seu nome"
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-2">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-2">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 pr-16"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-all duration-200"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-2">Confirmar senha</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="mt-2 text-sm text-red-300">As senhas devem ser idênticas.</p>
                )}
              </div>

              {poolCode && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                  <p className="text-xs text-green-200">Entraremos automaticamente no bolão com código: <span className="font-mono font-semibold">{poolCode}</span></p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button 
                disabled={loading} 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg" 
                type="submit"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Criando...
                  </div>
                ) : (
                  'Criar conta'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}