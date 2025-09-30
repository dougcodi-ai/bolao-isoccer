import '../styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import Link from 'next/link'
import { SidebarChrome, TopFooterChrome } from '@/components/LayoutChrome'
import Script from 'next/script'
import { GlobalStateProvider } from "@/context/GlobalStateContext";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const poppins = Poppins({ subsets: ['latin'], weight: ['400','600','700','800'], variable: '--font-poppins' })

export const metadata: Metadata = {
  title: 'Bolão iSoccer - A melhor forma de disputar palpites com a galera',
  description: 'Crie seu bolão em segundos, convide amigos e turbine palpites com boosters exclusivos. A plataforma mais completa para você e seus amigos viverem o futebol.',
  keywords: 'bolão, futebol, palpites, amigos, boosters, campeonato, brasileirão',
  authors: [{ name: 'Bolão iSoccer' }],
  creator: 'Bolão iSoccer',
  publisher: 'Bolão iSoccer',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://bolao-isoccer.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bolão iSoccer - A melhor forma de disputar palpites com a galera',
    description: 'Crie seu bolão em segundos, convide amigos e turbine palpites com boosters exclusivos.',
    url: 'https://bolao-isoccer.com',
    siteName: 'Bolão iSoccer',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Bolão iSoccer - Crie seu bolão de futebol',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bolão iSoccer - A melhor forma de disputar palpites com a galera',
    description: 'Crie seu bolão em segundos, convide amigos e turbine palpites com boosters exclusivos.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

// Garante escala correta em dispositivos móveis
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${poppins.variable}`}>
      <head>
        {/* Script de pré-paint para aplicar o tema antes da renderização e evitar flash */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => { try { const saved = localStorage.getItem('theme'); const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; const theme = saved || system; document.documentElement.setAttribute('data-theme', theme); } catch (e) {} })();`}
        </Script>
      </head>
      <body className={`font-inter bg-[var(--bg)] text-[var(--text)]`}>
        <GlobalStateProvider>
          <div className="min-h-screen flex">
            {/* Sidebar client-aware: esconde na Home */}
            <SidebarChrome />

            {/* Área principal */}
            {/* Removido lg:pl-64 para evitar coluna vazia quando a sidebar estiver oculta; o espaçamento será aplicado condicionalmente no LayoutChrome */}
            <div className="flex-1 flex flex-col min-h-screen">
              {/* Topbar/Footer client-aware: esconde na Home */}
              <TopFooterChrome>
                {children}
              </TopFooterChrome>
            </div>
          </div>
        </GlobalStateProvider>
      </body>
    </html>
  )
}