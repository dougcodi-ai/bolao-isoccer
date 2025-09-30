"use client"

import { FormEvent, useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Route } from 'next'

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-20"><p>Carregando...</p></main>}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resentInfo, setResentInfo] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Pré-validação de código inválido na URL (feedback + redirecionamento)
  useEffect(() => {
    const code = searchParams?.get('code') || searchParams?.get('convite')
    if (!code) return
    ;(async () => {
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (poolError || !pool) {
        try { localStorage.setItem('pending_toast', JSON.stringify({ type: 'error', message: 'Código de convite inválido ou expirado.' })) } catch {}
        // Redireciona para a home
        window.location.href = '/'
      }
    })()
  }, [searchParams])

  // Persistir código de bolão caso o login seja acessado por link com ?code=...
  useEffect(() => {
    const code = searchParams?.get('code') || searchParams?.get('convite')
    if (code) {
      try { localStorage.setItem('pending_pool_code', code) } catch {}
    }
  }, [searchParams])

  const returnTo = (() => {
    const r = searchParams?.get('returnTo') || '/palpites'
    // Evita open redirect
    return r.startsWith('/') ? r : '/palpites'
  })()

  async function autoJoinIfPending() {
    const pending = typeof window !== 'undefined' ? localStorage.getItem('pending_pool_code') : null
    if (!pending) return
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return
    const { data: pool } = await supabase.from('pools').select('id').eq('code', pending).maybeSingle()
    if (!pool) return
    const { data: exists } = await supabase
      .from('pool_members')
      .select('pool_id, user_id')
      .eq('pool_id', pool.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!exists) {
      await supabase.from('pool_members').insert({ pool_id: pool.id, user_id: user.id })
    }
    try { localStorage.removeItem('pending_pool_code') } catch {}
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResentInfo(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Inicia auto-join em paralelo para não travar o redirecionamento
      void autoJoinIfPending()

      // Aguarda até a sessão estar disponível (evita redirecionar sem sessão e cair de volta no login)
      let hasSession = false
      for (let i = 0; i < 40; i++) { // ~4s máx
        const { data } = await supabase.auth.getSession()
        if (data?.session) { hasSession = true; break }
        await new Promise((r) => setTimeout(r, 100))
      }
      if (!hasSession) {
        // ainda assim segue o fluxo, mas informa possível atraso
        console.warn('Sessão ainda não confirmada após login; redirecionando mesmo assim.')
      }

      router.replace(returnTo as Route)
    } catch (err: any) {
      const msg = err?.message || err?.error_description || 'Não foi possível entrar agora. Verifique seus dados e sua conexão e tente novamente.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Elementos decorativos de futebol */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute top-20 left-10 w-32 h-20 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
          <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
          <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
        </svg>
        <svg className="absolute bottom-20 right-20 w-16 h-16 opacity-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
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
              <h1 className="text-3xl font-bold text-white mb-2">Entrar</h1>
              <p className="text-white/70">Acesse sua conta para continuar</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
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
              <div>
                <input
                  type="password"
                  required
                  placeholder="Sua senha"
                  className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-3 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}
              <button 
                disabled={loading} 
                aria-busy={loading} 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg" 
                type="submit"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Entrando...
                  </div>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link 
                href="/auth/forgot" 
                className="w-full bg-white/10 hover:bg-white/20 text-white text-center py-3 px-4 rounded-lg transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
              >
                Esqueci minha senha
              </Link>
              <Link 
                href="/auth/cadastro" 
                className="w-full bg-white/10 hover:bg-white/20 text-white text-center py-3 px-4 rounded-lg transition-all duration-200 text-sm font-medium border border-white/20 hover:border-white/30"
              >
                Criar conta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}