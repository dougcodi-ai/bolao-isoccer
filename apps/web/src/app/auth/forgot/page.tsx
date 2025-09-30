"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setInfo("Enviamos um link de redefinição para o seu e-mail. Verifique sua caixa de entrada e spam.");
    } catch (e: any) {
      setError(e?.message || "Não foi possível enviar o e-mail de redefinição.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Elementos decorativos de futebol */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-32 left-16 w-24 h-16 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
          <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
          <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
        </svg>
        <svg className="absolute bottom-32 right-16 w-12 h-12 opacity-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
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
              <h1 className="text-3xl font-bold text-white mb-2">Recuperar senha</h1>
              <p className="text-white/70">Informe seu e-mail para receber o link de redefinição</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input
                  type="email"
                  required
                  placeholder="Seu e-mail"
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}
              {info && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-200 text-sm">{info}</p>
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
                    Enviando...
                  </div>
                ) : (
                  'Enviar link'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link 
                href="/auth/login" 
                className="bg-white/10 hover:bg-white/20 text-white py-3 px-6 rounded-lg transition-all duration-200 inline-block border border-white/20 hover:border-white/30"
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