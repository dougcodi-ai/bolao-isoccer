"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function SidebarChrome() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const isAuthLogin = pathname === '/auth/login'
  const isAuthCadastro = pathname === '/auth/cadastro'
  const isAuthConfirm = pathname === '/auth/confirm'
  const isAuthReset = pathname === '/auth/reset'
  const hideSidebar = isHome || isAuthLogin || isAuthCadastro || isAuthConfirm || isAuthReset

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setIsLoggedIn(!!data.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])



  if (hideSidebar) return null
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 border-r border-neutral-800 bg-[#0D0D0D]" aria-label="Barra lateral de navegação">
      <div className="h-16 flex items-center px-6 border-b border-neutral-800">
        <Link href="/palpites" className="text-xl font-extrabold text-white heading" aria-label="Ir para o Dashboard ISoccer">ISoccer</Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-2 text-sm" role="navigation" aria-label="Navegação principal na barra lateral">
        {/* Seção Principal */}
        <div className="space-y-1">
          <Link 
            href={isLoggedIn ? '/dashboard' : '/'} 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/dashboard' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Página inicial"
            aria-current={(pathname === '/dashboard') ? 'page' : undefined}
          >
            <span className="text-lg">🏠</span>
            <span className="font-medium">Dashboard</span>
          </Link>
          
          <Link 
            href="/palpites" 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/palpites' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Fazer Palpites"
          >
            <span className="text-lg">⚽</span>
            <span className="font-medium">Palpites</span>
          </Link>

          <Link 
            href="/bolao/criar" 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/bolao/criar' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Criar Bolão"
          >
            <span className="text-lg">➕</span>
            <span className="font-medium">Criar Bolão</span>
          </Link>

          <Link 
            href="/bolao/meus" 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/bolao/meus' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Meus Bolões"
          >
            <span className="text-lg">🎉</span>
            <span className="font-medium">Meus Bolões</span>
          </Link>

          <Link 
            href="/ranking" 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/ranking' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Ver Ranking"
          >
            <span className="text-lg">🏆</span>
            <span className="font-medium">Ranking</span>
          </Link>


        </div>

        {/* Divisor */}
        <div className="border-t border-white/10 my-4"></div>

        {/* Seção Secundária */}
        <div className="space-y-1">
          {/* Resultados removidos */}

          {isLoggedIn && (
            <Link 
              href="/regras" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                pathname === '/regras' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
              }`}
              aria-label="Regras e Pontuação"
            >
              <span className="text-lg">📖</span>
              <span className="font-medium">Regras</span>
            </Link>
          )}

          <Link 
            href="/boosters" 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/boosters' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Comprar Boosters"
          >
            <span className="text-lg">⚡</span>
            <span className="font-medium">Comprar Boosters</span>
          </Link>
        </div>

        {/* Divisor */}
        <div className="border-t border-white/10 my-4"></div>

        {/* Seção do Usuário */}
        <div className="space-y-1">
          <Link 
            href="/perfil" 
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              pathname === '/perfil' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'hover:bg-[#1C1C1C] text-white/80 hover:text-white'
            }`}
            aria-label="Meu Perfil"
          >
            <span className="text-lg">👤</span>
            <span className="font-medium">Perfil</span>
          </Link>

          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-red-600/20 text-red-400 hover:text-red-300 mt-6"
            aria-label="Sair do sistema"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </nav>


    </aside>
  )
}

// ---------------- Top/Bottom Chrome ----------------

export function TopFooterChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const isAuthLogin = pathname === '/auth/login'
  const isAuthCadastro = pathname === '/auth/cadastro'
  const isAuthConfirm = pathname === '/auth/confirm'
  const isAuthReset = pathname === '/auth/reset'
  const hideChrome = isHome || isAuthLogin || isAuthCadastro || isAuthConfirm || isAuthReset

  // user display name + avatar (já existente no arquivo original)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      const user = data.user
      if (user) {
        const nick = user.user_metadata?.username || user.user_metadata?.display_name || user.email?.split('@')[0]
        setDisplayName(nick || null)
        setAvatarUrl(user.user_metadata?.avatar_url || null)
        setAvatarSeed(user.user_metadata?.emoji || null)
      } else {
        setDisplayName(null); setAvatarUrl(null); setAvatarSeed(null)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user
      if (user) {
        const nick = user.user_metadata?.username || user.user_metadata?.display_name || user.email?.split('@')[0]
        setDisplayName(nick || null)
        setAvatarUrl(user.user_metadata?.avatar_url || null)
        setAvatarSeed(user.user_metadata?.emoji || null)
      } else {
        setDisplayName(null); setAvatarUrl(null); setAvatarSeed(null)
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  // Espaçamento do container dependendo da visibilidade da sidebar
  const containerOffset = hideChrome ? '' : 'lg:ml-64'
  const compensateAuth = isAuthLogin || isAuthCadastro || isAuthConfirm || isAuthReset





  return (
    <div className={`flex-1 flex flex-col min-h-screen ${containerOffset}`}>
      {/* Topbar desktop (esconder na Home e Auth) */}
      {!hideChrome && (
        <header className="hidden lg:block sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/palpites" className="text-lg font-extrabold heading text-white" aria-label="Voltar aos Palpites">ISoccer</Link>
              {displayName && (
                <span className="text-sm text-gray-300">Olá, <strong>@{displayName}</strong></span>
              )}
            </div>
            <nav className="flex items-center gap-3" role="navigation" aria-label="Ações rápidas do topo">
              <Link href="/palpites" className="btn-primary" aria-label="Abrir tela de Palpites agora">Palpitar agora</Link>
              {avatarSeed ? (
                <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-lg text-white" aria-label="Avatar emoji">{avatarSeed}</div>
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar do usuário" className="w-8 h-8 rounded-full border border-white/20" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-sm font-bold" aria-hidden>
                  {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <Link href="/perfil" className="text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Abrir Perfil">Perfil</Link>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} className="text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Sair">Sair</button>
            </nav>
          </div>
        </header>
      )}

      {/* Topbar mobile (esconder na Home e Auth) */}
      {!hideChrome && (
        <header className="lg:hidden sticky top-0 z-40 border-b border-neutral-800 bg-[#0D0D0D]/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
            <Link href="/palpites" className="text-lg font-extrabold heading text-white" aria-label="Voltar aos Palpites">ISoccer</Link>
            <nav className="flex items-center gap-3 text-sm" role="navigation" aria-label="Ações rápidas no topo (mobile)">
              <Link href="/palpites" className="btn-primary" aria-label="Abrir Palpites">Palpitar</Link>
               {displayName && <span className="hidden sm:inline text-white/80">Olá, @{displayName}</span>}
               <Link href="/perfil" className="text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Abrir Perfil">Perfil</Link>
               <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} className="text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Sair">Sair</button>
            </nav>
          </div>
        </header>
      )}

      {/* Conteúdo */}
      <main className={`${compensateAuth ? 'flex min-h-screen items-center justify-center' : 'pb-16 min-h-screen'} bg-gradient-to-br from-black via-gray-900 to-black text-white`}>
        {children}
      </main>



      {/* Footer mobile (esconder na Home e Auth) */}
      {!hideChrome && (
        <footer className="lg:hidden fixed bottom-0 inset-x-0 border-t border-neutral-800 bg-[#0D0D0D]" role="contentinfo" aria-label="Barra de navegação inferior">
          <div className="max-w-6xl mx-auto px-2 py-2 grid grid-cols-6 text-[11px]" role="navigation" aria-label="Navegação principal (mobile)">
            <Link href={isHome ? '/' : '/dashboard'} className="flex flex-col items-center py-2 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Ir para Home">
              <span aria-hidden>🏠</span>
              <span className="mt-1">Home</span>
            </Link>
            <Link href="/palpites" className="flex flex-col items-center py-2 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Abrir Palpites">
              <span aria-hidden>📅</span>
              <span className="mt-1">Palpites</span>
            </Link>
            <Link href="/bolao/meus" className="flex flex-col items-center py-2 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Abrir Meus Bolões">
              <span aria-hidden>🎉</span>
              <span className="mt-1">Bolões</span>
            </Link>

            <Link href="/ranking" className="flex flex-col items-center py-2 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Abrir Ranking">
              <span aria-hidden>🏆</span>
              <span className="mt-1">Ranking</span>
            </Link>
            <Link href="/boosters" className="flex flex-col items-center py-2 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-[#0D0D0D]" aria-label="Comprar Boosters">
              <span aria-hidden>⚡</span>
              <span className="mt-1">Boosters</span>
            </Link>
          </div>
        </footer>
      )}
    </div>
  )
}