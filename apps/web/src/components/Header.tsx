"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Home, LogIn, UserPlus, LayoutDashboard, PlusCircle, Users, Zap, LogOut, Menu, X } from "lucide-react"
import { ThemeToggle } from './ThemeToggle'

export default function Header() {
  const [email, setEmail] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <header className="header-chrome transition-all duration-300">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-extrabold flex items-center gap-2">
          <Zap className="h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
          <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Bolão iSoccer
          </span>
        </Link>

        {/* Menu Desktop */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
          <Link href="#planos" className="nav-link">Planos</Link>
          <Link href="#proximos-jogos" className="nav-link">Próximos Jogos</Link>
          <Link href="#boosters" className="nav-link">Boosters</Link>
          <Link href="/regras" className="nav-link">Regras</Link>
        </nav>

        {/* CTAs Desktop */}
        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle />
          {!email ? (
            <>
              <Link href="/auth/cadastro" className="btn-primary inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Criar meu bolão
              </Link>
              <Link href="/auth/login" className="btn-ghost inline-flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Entrar
              </Link>
            </>
          ) : (
            <>
              <Link href="/bolao/criar" className="btn-primary inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Criar bolão
              </Link>
              <Link href="/palpites" className="btn-ghost inline-flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Minha conta
              </Link>
            </>
          )}
        </div>

        {/* Menu Mobile Toggle */}
        <div className="lg:hidden flex items-center gap-2">
          <ThemeToggle />
          <button 
            onClick={toggleMenu} 
            className="btn-menu"
            aria-label="Menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {isMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-black/95 backdrop-blur-md">
          <nav className="flex flex-col px-6 py-4 space-y-2">
            <Link href="#planos" className="nav-link">Planos</Link>
            <Link href="#proximos-jogos" className="nav-link">Próximos Jogos</Link>
            <Link href="#boosters" className="nav-link">Boosters</Link>
            <Link href="/regras" className="nav-link">Regras</Link>
            
            <div className="pt-4 border-t border-white/10 space-y-3">
              {!email ? (
                <>
                  <Link href="/auth/cadastro" className="btn-primary w-full justify-center inline-flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Criar meu bolão
                  </Link>
                  <Link href="/auth/login" className="btn-ghost w-full justify-center inline-flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/bolao/criar" className="btn-primary w-full justify-center inline-flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Criar bolão
                  </Link>
                  <Link href="/palpites" className="btn-ghost w-full justify-center inline-flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Minha conta
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}