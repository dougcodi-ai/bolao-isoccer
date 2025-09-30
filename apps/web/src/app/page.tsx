"use client";

import HomeHero from '@/components/HomeHero'
import Header from '@/components/Header'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Users, Trophy, Zap, Star, Shield, Clock, Target, ArrowRight, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()
  // Estado minimal para conectar o widget "Próximos palpites" à mesma fonte de dados da página Palpites/Dashboard
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [pools, setPools] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)
  const [upcomingMatches, setUpcomingMatches] = useState<Array<{ id: string; home_team: string; away_team: string; start_time: string }>>([])
  const [predictionsMap, setPredictionsMap] = useState<Record<string, { home_pred: number; away_pred: number }>>({})
  // Estados para seção pública de Próximos Jogos (tabelas canônicas)
  const [publicMatches, setPublicMatches] = useState<Array<{ id: string; start_time: string; status: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null }>>([])
  const [teamsById, setTeamsById] = useState<Record<string, string>>({})
  const [loadingPublic, setLoadingPublic] = useState(true)
  
  // Sistema de toasts para feedback após redirecionamentos
  type Toast = { id: number; type: "success" | "error" | "info"; message: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (type: Toast["type"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };

  // Leitura de toast pendente no localStorage (aplicado após redirecionamentos)
  useEffect(() => {
    try {
      const pending = localStorage.getItem('pending_toast');
      if (pending) {
        const toast = JSON.parse(pending);
        pushToast(toast.type, toast.message);
        localStorage.removeItem('pending_toast');
      }
    } catch {}
  }, []);

  // Redirect para /dashboard quando logado (mantém landing para anônimos)
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) {
        router.replace('/dashboard')
      }
    })
    return () => { mounted = false }
  }, [router])

  // 1) Carregar usuário + memberships e determinar pool selecionado
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      // auth
      const { data: auth } = await supabase.auth.getUser()
      const u = auth.user
      if (!u) {
        if (mounted) {
          setUserId(null)
          setPools([])
          setSelectedPoolId(null)
          setLoading(false)
        }
        return
      }
      if (mounted) setUserId(u.id)

      // pools do usuário
      const { data: mems, error: memErr } = await supabase
        .from('pool_members')
        .select('pool_id')
        .eq('user_id', u.id)
        .order('joined_at', { ascending: false })
      if (memErr) {
        if (mounted) {
          setPools([])
          setSelectedPoolId(null)
          setLoading(false)
        }
        return
      }
      const ids = (mems || []).map((m: any) => m.pool_id)
      let rows: Array<{ id: string; name: string; code: string }> = []
      if (ids.length > 0) {
        const { data: poolRows } = await supabase
          .from('pools')
          .select('id, name, code')
          .in('id', ids)
        const orderMap = new Map(ids.map((id: string, i: number) => [id, i]))
        rows = (poolRows || []).sort((a, b) => (orderMap.get(a.id)! - orderMap.get(b.id)!))
      }
      if (!mounted) return
      setPools(rows)
      const last = typeof window !== 'undefined' ? window.localStorage.getItem('last_pool_id') : null
      const exists = last && rows.some((p) => p.id === last)
      setSelectedPoolId(exists ? (last as string) : (rows[0]?.id || null))
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  // 2) Buscar próximos jogos (limit 3) e palpites do usuário para esses jogos
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setUpcomingMatches([])
      setPredictionsMap({})
      if (!selectedPoolId || !userId) return
      try {
        const nowIso = new Date().toISOString()
        const { data: matches } = await supabase
          .from('matches')
          .select('id, home_team, away_team, start_time')
          .eq('pool_id', selectedPoolId)
          .gte('start_time', nowIso)
          .order('start_time', { ascending: true })
          .limit(3)
        if (!mounted) return
        setUpcomingMatches(matches || [])
        const ids = (matches || []).map((m) => m.id)
        if (ids.length > 0) {
          const { data: preds } = await supabase
            .from('predictions')
            .select('match_id, home_pred, away_pred')
            .in('match_id', ids)
            .eq('user_id', userId)
          const map: Record<string, { home_pred: number; away_pred: number }> = {}
          ;(preds || []).forEach((p) => {
            map[p.match_id] = { home_pred: p.home_pred, away_pred: p.away_pred }
          })
          if (mounted) setPredictionsMap(map)
        }
      } catch (e) {
        // silencioso na home
        console.warn('[home] erro ao carregar próximos palpites', e)
      }
    })()
    return () => { mounted = false }
  }, [selectedPoolId, userId])

  // Carregar Próximos Jogos públicos (hoje e amanhã) das tabelas canônicas
  useEffect(() => {
    let mounted = true
    let timer: any
    const load = async () => {
      try {
        setLoadingPublic(true)
        // Início de hoje e fim de amanhã
        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setDate(end.getDate() + 1)
        end.setHours(23, 59, 59, 999)
        const { data: matches } = await supabase
          .from('football_matches')
          .select('id, start_time, status, home_team_id, away_team_id, home_score, away_score')
          .gte('start_time', start.toISOString())
          .lte('start_time', end.toISOString())
          .order('start_time', { ascending: true })
          .limit(12)
        const ms = matches || []
        const teamIds = Array.from(new Set(ms.flatMap(m => [m.home_team_id, m.away_team_id])))
        let names: Record<string, string> = {}
        if (teamIds.length) {
          const { data: teams } = await supabase
            .from('football_teams')
            .select('id, name')
            .in('id', teamIds)
          ;(teams || []).forEach(t => { names[t.id] = t.name })
        }
        if (!mounted) return
        setPublicMatches(ms)
        setTeamsById(names)
      } catch (e) {
        if (mounted) { setPublicMatches([]); setTeamsById({}) }
      } finally {
        if (mounted) setLoadingPublic(false)
      }
    }
    load()
    // polling leve para placares ao vivo
    timer = setInterval(load, 30000)
    return () => { mounted = false; if (timer) clearInterval(timer) }
  }, [])

  const hasPools = pools.length > 0

  const formattedMatches = useMemo(() => {
    return upcomingMatches.map((m) => {
      const when = new Date(m.start_time).toLocaleString('pt-BR', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
      return { ...m, when }
    })
  }, [upcomingMatches])

  const createHref = userId ? '/bolao/criar' : '/auth/cadastro'

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-900 to-black text-white relative overflow-hidden">
      {/* Elementos decorativos de futebol */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Campo de futebol no fundo */}
        <svg className="absolute top-20 left-10 w-32 h-20 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
          <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
          <rect x="0" y="20" width="15" height="20" fill="none" stroke="currentColor" strokeWidth="1"/>
          <rect x="85" y="20" width="15" height="20" fill="none" stroke="currentColor" strokeWidth="1"/>
          <rect x="0" y="25" width="5" height="10" fill="none" stroke="currentColor" strokeWidth="1"/>
          <rect x="95" y="25" width="5" height="10" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
          <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
        </svg>
        
        {/* Bola de futebol */}
        <svg className="absolute top-40 right-20 w-16 h-16 opacity-10 text-white" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1"/>
          <path d="M12 2L14.5 8.5L21 8.5L16 13L18 20L12 16L6 20L8 13L3 8.5L9.5 8.5L12 2Z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        </svg>
        
        {/* Mais campos decorativos */}
        <svg className="absolute bottom-40 right-10 w-24 h-16 opacity-5 text-green-400" viewBox="0 0 100 60" fill="currentColor">
          <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
          <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
        </svg>
        
        <svg className="absolute bottom-20 left-20 w-20 h-20 opacity-8 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z"/>
        </svg>
      </div>
      
      <Header />
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-2 rounded-lg shadow-lg text-sm ${t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
      
      <HomeHero />

      {/* Container principal ocupando toda a largura */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        
        {/* Cards explicativos - Como funciona */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Como funciona
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Três passos simples para começar a se divertir com seus amigos
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "1. Convide",
                description: "Crie um link exclusivo e monte sua liga em segundos",
                href: "/auth/cadastro",
                color: "from-blue-500/20 to-cyan-500/10",
                iconColor: "text-blue-400",
                borderColor: "border-blue-500/20",
                emoji: "⚽"
              },
              {
                icon: Trophy,
                title: "2. Dispute Rankings",
                description: "Acompanhe sua posição rodada a rodada, em tempo real",
                href: "#planos",
                color: "from-yellow-500/20 to-orange-500/10",
                iconColor: "text-yellow-400",
                borderColor: "border-yellow-500/20",
                emoji: "🏆"
              },
              {
                icon: Zap,
                title: "3. Use Boosters",
                description: "Multiplique pontos e surpreenda seus amigos com poderes extras",
                href: "#boosters",
                color: "from-purple-500/20 to-pink-500/10",
                iconColor: "text-purple-400",
                borderColor: "border-purple-500/20",
                emoji: "⚡"
              }
            ].map((item, index) => (
              <div key={index} className={`bg-gradient-to-br ${item.color} backdrop-blur-sm border ${item.borderColor} rounded-xl p-6 text-center transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/10 relative`}>
                <div className="absolute top-2 right-2 text-2xl opacity-20">{item.emoji}</div>
                <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                  <item.icon className={`h-8 w-8 ${item.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                <p className="text-gray-300 mb-6">{item.description}</p>
                <Link href={item.href} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors duration-200 text-white">
                  Começar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Crie agora mesmo o seu bolão e chame a galera!
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Escolha o plano que cabe no seu grupo. Do gratuito até opções para 50 participantes.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {[
              {key:'free', title:'Gratuito', range:'01 a 10 participantes', price:'R$ 0,00', premium:false, popular:true, icon: Users, gradient: 'from-green-500/20 to-emerald-500/10', border: 'border-green-500/30', emoji: '🥅'},
              {key:'craque', title:'Craque', range:'11 a 20 participantes', price:'R$ 14,90', premium:true, icon: Trophy, gradient: 'from-yellow-500/20 to-amber-500/10', border: 'border-yellow-500/30', emoji: '🏆'},
              {key:'lenda', title:'Lenda', range:'21 a 30 participantes', price:'R$ 19,90', premium:true, icon: Star, gradient: 'from-blue-500/20 to-cyan-500/10', border: 'border-blue-500/30', emoji: '⭐'},
              {key:'fenomeno', title:'Fenômeno', range:'31 a 40 participantes', price:'R$ 24,90', premium:true, icon: Target, gradient: 'from-purple-500/20 to-pink-500/10', border: 'border-purple-500/30', emoji: '🔥'},
              {key:'galera', title:'Galera', range:'41 a 50 participantes', price:'R$ 29,90', premium:true, icon: Zap, gradient: 'from-orange-500/20 to-red-500/10', border: 'border-orange-500/30', emoji: '⚽'},
            ].map((plan) => (
              <div key={plan.key} className={`bg-gradient-to-br ${plan.gradient} backdrop-blur-sm border ${plan.border} rounded-xl p-6 flex flex-col relative min-h-[320px] transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/10 ${plan.popular ? 'ring-2 ring-green-400/50 scale-105' : ''}`}>
                
                <div className="absolute top-2 right-2 text-2xl opacity-30">{plan.emoji}</div>
                
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-green-400 to-emerald-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="w-12 h-12 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                  <plan.icon className="h-6 w-6 text-white" />
                </div>

                <div className="flex-1 text-center flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">{plan.title}</h3>
                    <p className="text-sm text-gray-300 mb-4">{plan.range}</p>
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold mb-2 text-white">{plan.price}</p>
                    <p className="text-xs text-gray-400 mb-6">{plan.premium ? 'Pagamento único • 1 campeonato' : 'Sem custo • 1 campeonato'}</p>
                  </div>
                </div>
                
                <Link href={plan.key === 'free' ? '/auth/cadastro' : '#planos'} className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
                  <span>Começar</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Boosters */}
        <section id="boosters" className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Boosters
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Ative poderes especiais para virar o jogo nas rodadas decisivas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "O Escudo",
                description: "Protege seu placar de resultados improváveis",
                gradient: "from-blue-500/20 to-cyan-500/10",
                border: "border-blue-500/30",
                iconColor: "text-blue-400",
                badge: "DEFESA"
              },
              {
                icon: Clock,
                title: "Relógio Extra",
                description: "Ganhe tempo extra para palpitar em um jogo",
                gradient: "from-orange-500/20 to-yellow-500/10",
                border: "border-orange-500/30",
                iconColor: "text-orange-400",
                badge: "TEMPO"
              },
              {
                icon: Target,
                title: "Mira Certa",
                description: "Dobre os pontos se acertar o placar exato",
                gradient: "from-purple-500/20 to-pink-500/10",
                border: "border-purple-500/30",
                iconColor: "text-purple-400",
                badge: "PRECISÃO"
              }
            ].map((booster, index) => (
              <div key={index} className={`bg-gradient-to-br ${booster.gradient} backdrop-blur-sm border ${booster.border} rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-white/10 relative`}>
                <div className="absolute top-3 right-3 bg-white/10 backdrop-blur-sm rounded-full px-2 py-1">
                  <span className="text-xs font-bold text-white">{booster.badge}</span>
                </div>
                
                <div className="w-12 h-12 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                  <booster.icon className={`h-6 w-6 ${booster.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold mb-2 text-center text-white">{booster.title}</h3>
                <p className="text-gray-300 text-center">{booster.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Regras/Pontuação */}
        <section id="regras" className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Regras e pontuação
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Entenda como os pontos são calculados e os critérios de desempate no ranking
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Pontuação",
                items: [
                  "Placar exato: +10 pontos",
                  "Acerto de resultado (vitória/empate/derrota): +5 pontos",
                  "Acerto parcial (gols exatos de um dos times): +3 pontos",
                  "Errou: 0 pontos"
                ]
              },
              {
                title: "Exemplos rápidos",
                items: [
                  "Você palpita 2x1 e o jogo termina 2x1: +10",
                  "Você palpita 1x0 e termina 3x1 (mesmo vencedor): +5",
                  "Você palpita 0x0 e termina 1x1 (empate): +5",
                  "Você palpita 2x1 e termina 2x0 (acertou gols do mandante): +3"
                ]
              },
              {
                title: "Desempate no Ranking",
                items: [
                  "1º: Pontos totais",
                  "2º: Número de placares exatos",
                  "3º: Número de acertos de resultado",
                  "4º: Número de acertos parciais",
                  "5º: Número de palpites efetuados"
                ]
              }
            ].map((section, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-white">{section.title}</h3>
                <ul className="text-gray-300 space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/ranking" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors duration-200 text-white">
              Ver ranking completo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Partiu palpitar?
          </h2>
          <p className="text-gray-400 text-lg mb-8">Crie seu bolão agora e desafie seus amigos nas rodadas</p>
          <Link href={createHref} className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition-all duration-200 text-white font-semibold text-lg">
            Começar agora
            <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>
    </div>
  )
}