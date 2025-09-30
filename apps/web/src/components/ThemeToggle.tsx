'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  // Evita hidration mismatch
  useEffect(() => {
    setMounted(true)
    try {
      const attrTheme = (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null) as 'light' | 'dark' | null
      const savedTheme = (typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null) as 'light' | 'dark' | null
      const systemTheme = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      const initialTheme = attrTheme || savedTheme || systemTheme
      setTheme(initialTheme)
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', initialTheme)
    } catch {}
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    try {
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', newTheme)
      if (typeof window !== 'undefined') window.localStorage.setItem('theme', newTheme)
    } catch {}

    // Analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      ;(window as any).gtag('event', 'theme_toggle', {
        event_category: 'UI',
        event_label: newTheme,
        value: 1,
      })
    }
  }

  if (!mounted) {
    return <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" />
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
      aria-label={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
      title={`Tema: ${theme === 'dark' ? 'Escuro' : 'Claro'}`}
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-yellow-400 group-hover:rotate-12 transition-transform duration-200" aria-hidden="true" />
      ) : (
        <Moon size={18} className="text-blue-400 group-hover:-rotate-12 transition-transform duration-200" aria-hidden="true" />
      )}
    </button>
  )
}

// Tipos para analytics
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      parameters?: {
        event_category?: string
        event_label?: string
        value?: number
      }
    ) => void
  }
}