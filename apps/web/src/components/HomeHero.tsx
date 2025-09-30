"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PlusCircle, Play, Trophy, Users, Zap, Shield, Crown, Flag, Target } from "lucide-react"
import { SignupModal } from './SignupModal'
import { analytics } from '@/lib/analytics'

export default function HomeHero() {
  const [email, setEmail] = useState<string | null>(null)
  const [showSignupModal, setShowSignupModal] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const handleCreateBolaoClick = () => {
    analytics.clickCTA('Criar meu bolão', 'hero')
    
    if (!email) {
      setShowSignupModal(true)
      analytics.createBolaoStart()
    }
  }

  const handleComoFuncionaClick = () => {
    analytics.clickCTA('Como funciona', 'hero')
    // Aqui poderia abrir um modal ou scroll para seção explicativa
  }

  const handleSignup = async (data: { name: string; email: string; password: string }) => {
    try {
      analytics.signupStart('email')
      
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name
          }
        }
      })

      if (error) throw error

      analytics.signupComplete('email')
      setShowSignupModal(false)
      
      // Redirecionar para criação de bolão
      window.location.href = '/bolao/criar'
    } catch (error) {
      console.error('Erro no cadastro:', error)
      analytics.error('signup_error', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return (
    <section className="relative min-h-[78vh] flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-900 to-black">
        {/* Accent overlays inspirados no Dashboard + futebol */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/8 via-transparent to-[var(--accent)]/8"></div>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-blue-600/15 via-transparent to-purple-600/15"></div>
        {/* Pitch/grass vibe */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_rgba(16,185,129,0.10)_0%,_transparent_60%)]"></div>
        {/* Goal net subtle pattern (top-right) */}
        <svg className="absolute -top-8 -right-6 w-[220px] h-[220px] opacity-[0.10]" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <pattern id="net" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M0,0 L20,20 M20,0 L0,20" stroke="white" strokeWidth="0.6" fill="none" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#net)" />
        </svg>
      </div>

      {/* Geometric + Football Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 border border-[var(--accent)]/20 rotate-45 rounded-lg"></div>
        <div className="absolute bottom-20 right-10 w-24 h-24 border border-white/10 rotate-12 rounded-lg"></div>
        <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white rounded-full animate-pulse delay-1000"></div>
        {/* Soccer ball silhouette (decorative) */}
        <svg className="absolute left-6 bottom-10 w-20 h-20 opacity-[0.12]" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="2" fill="none" />
          <polygon points="50,30 60,45 55,65 45,65 40,45" fill="white" opacity="0.08" />
          <path d="M50 5 A45 45 0 0 1 95 50" stroke="white" strokeWidth="1" opacity="0.06" />
          <path d="M5 50 A45 45 0 0 1 50 95" stroke="white" strokeWidth="1" opacity="0.06" />
        </svg>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        {/* Main Heading */}
        <h1 className="heading text-4xl md:text-6xl lg:text-7xl font-extrabold mb-4 leading-tight">
          <span className="bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">
            Bolão iSoccer
          </span>
          <br />
          <span className="text-2xl md:text-3xl lg:text-4xl font-medium text-white/70 mt-2 block">
            A maneira mais divertida de viver o futebol com os amigos
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-white/70 mb-6 max-w-3xl mx-auto leading-relaxed">
          Desafie sua galera, dispute rankings e turbinar seus palpites com boosters exclusivos.
        </p>

        {/* Micro-badges (prova social e features) */}
        <div className="mb-6 flex flex-wrap justify-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs border border-white/10">
            <Crown className="h-3.5 w-3.5" /> Modo Copa
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs border border-white/10">
            <Users className="h-3.5 w-3.5" /> 5k+ palpites
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-xs border border-white/10">
            <Shield className="h-3.5 w-3.5" /> Pontuação justa
          </span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          {email ? (
            <Link 
              href="/bolao/criar" 
              className="btn-primary-large inline-flex items-center gap-3 transition-transform hover:scale-[1.02]"
              aria-label="Criar meu bolão - Começar agora"
              onClick={() => analytics.clickCTA('Criar meu bolão', 'hero')}
            >
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              Criar meu bolão
            </Link>
          ) : (
            <button 
              onClick={handleCreateBolaoClick}
              className="btn-primary-large inline-flex items-center gap-3 transition-transform hover:scale-[1.02]"
              aria-label="Criar meu bolão - Começar agora"
            >
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              Criar meu bolão
            </button>
          )}
          <button 
            onClick={handleComoFuncionaClick}
            className="btn-ghost text-lg px-8 py-4 min-w-[200px] inline-flex items-center gap-3" 
            aria-label="Assistir vídeo explicativo sobre como funciona"
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            Como funciona
          </button>
        </div>

        {/* Microcopy */}
        <p className="text-sm text-gray-500 mb-10">
          <Link href="#planos" className="hover:text-[var(--accent)] transition-colors">
            Gratuito até 10 participantes
          </Link>
        </p>

        {/* Icon strip (futebol vibes) */}
        <div className="mb-10 flex justify-center items-center gap-5 text-white/70">
          {/* small soccer ball */}
          <svg className="w-6 h-6" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="6" fill="none" />
            <polygon points="50,28 62,44 56,66 44,66 38,44" fill="currentColor" opacity="0.8" />
          </svg>
          <Trophy className="h-6 w-6" />
          <Flag className="h-6 w-6" />
          <Target className="h-6 w-6" />
          <Zap className="h-6 w-6" />
        </div>

        {/* Hero Visual/Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="card flex flex-col items-center p-6 transition-all duration-200 hover:bg-white/5 hover:border-white/20">
            <div className="w-12 h-12 bg-[var(--accent)]/20 rounded-full flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Convide</h3>
            <p className="text-muted text-center">Gere um link exclusivo e junte a galera em segundos.</p>
          </div>

          <div className="card flex flex-col items-center p-6 transition-all duration-200 hover:bg-white/5 hover:border-white/20">
            <div className="w-12 h-12 bg-[var(--accent)]/20 rounded-full flex items-center justify-center mb-4">
              <Trophy className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Dispute Rankings</h3>
            <p className="text-muted text-center">Acompanhe sua posição em tempo real</p>
          </div>

          <div className="card flex flex-col items-center p-6 transition-all duration-200 hover:bg-white/5 hover:border-white/20">
            <div className="w-12 h-12 bg-[var(--accent)]/20 rounded-full flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Use Boosters</h3>
            <p className="text-muted text-center">Dobre pontos, corrija palpites e vire o jogo.</p>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>

      {/* Modal de Cadastro */}
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSignup={handleSignup}
        onSwitchToLogin={() => {
          setShowSignupModal(false)
          // Aqui poderia abrir modal de login
        }}
      />
    </section>
  )
}