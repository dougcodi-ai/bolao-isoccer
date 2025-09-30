"use client";

import { useState, useEffect } from "react";
import Protected from "@/components/Protected";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Trophy, 
  Users, 
  Star, 
  Crown, 
  TrendingUp, 
  Calendar,
  Award,
  Target,
  BarChart3,
  Plus,
  ExternalLink,
  Medal,
  Zap,
  AlertTriangle,
  Clock,
  ShoppingCart,
  Filter,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Eye,
  Flame,
  Shield
} from "lucide-react";

interface Pool {
  id: string;
  name: string;
  championship: string;
  plan_key: string;
  invite_code: string;
  created_at: string;
  creator_id: string;
  is_creator: boolean;
  participant_count: number;
  user_score: number;
  user_position: number;
  total_participants: number;
  recent_matches: number;
  correct_predictions: number;
  accuracy_percentage: number;
  rival_above?: { name: string; points_ahead: number };
  rival_below?: { name: string; points_behind: number };
  progress: { completed: number; total: number };
}

interface BoosterInventory {
  segunda_chance: number;
  o_esquecido: number;
}

interface UrgentMatch {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  type: 'pending_prediction' | 'booster_available';
  alert_message: string;
  pool_name: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  score: number;
  position: number;
  avatar?: string;
}

interface JourneyData {
  round: number;
  score: number;
  position: number;
  points_gained: number;
}

export default function MeusBoloes() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [journeyData, setJourneyData] = useState<JourneyData[]>([]);
  const [boosterInventory, setBoosterInventory] = useState<BoosterInventory>({ segunda_chance: 0, o_esquecido: 0 });
  const [urgentMatches, setUrgentMatches] = useState<UrgentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'leading' | 'ending'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [userBoosters, setUserBoosters] = useState<any>({});
  const [groupEvolution, setGroupEvolution] = useState<any[]>([]);

  // Configuração de paginação
  const poolsPerPage = 2;

  useEffect(() => {
    loadUserData();
  }, []);

  // Todos os tipos de boosters disponíveis
  const allBoosters = {
    segunda_chance: {
      name: 'Segunda Chance',
      description: 'Refaça um palpite após o resultado',
      icon: '🔄',
      quantity: boosterInventory.segunda_chance || 0,
      color: 'from-blue-500 to-blue-600'
    },
    multiplicador: {
      name: 'Multiplicador 2x',
      description: 'Dobre os pontos de um palpite',
      icon: '⚡',
      quantity: 0,
      color: 'from-yellow-500 to-orange-500'
    },
    insight: {
      name: 'Insight Premium',
      description: 'Veja estatísticas avançadas',
      icon: '🔍',
      quantity: 0,
      color: 'from-purple-500 to-purple-600'
    },
    protecao: {
      name: 'Proteção',
      description: 'Proteja-se de pontos negativos',
      icon: '🛡️',
      quantity: 0,
      color: 'from-green-500 to-green-600'
    }
  };

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar inventário de boosters
      await loadBoosterInventory(user.id);
      
      // Carregar partidas urgentes
      await loadUrgentMatches(user.id);
      
      // Carregar bolões
      await loadUserPools(user.id);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBoosterInventory = async (userId: string) => {
    // Simulação de dados - substituir pela consulta real
    setBoosterInventory({
      segunda_chance: 3,
      o_esquecido: 1
    });
  };

  const loadUrgentMatches = async (userId: string) => {
    // Simulação de partidas urgentes - substituir pela consulta real
    const mockUrgentMatches: UrgentMatch[] = [
      {
        id: '1',
        home_team: 'Flamengo',
        away_team: 'Palmeiras',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h no futuro
        type: 'pending_prediction',
        alert_message: 'ALERTA: Palpite Pendente!',
        pool_name: 'Bolão dos Amigos'
      },
      {
        id: '2',
        home_team: 'Corinthians',
        away_team: 'São Paulo',
        start_time: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25min no futuro
        type: 'booster_available',
        alert_message: 'Última Chance para Refazer!',
        pool_name: 'Liga Familiar'
      }
    ];
    setUrgentMatches(mockUrgentMatches);
  };

  const loadUserPools = async (userId: string) => {
    // Simulação de dados com rival direto - substituir pela consulta real
    const mockPools: Pool[] = [
      {
        id: '1',
        name: 'Bolão dos Amigos',
        championship: 'Brasileirão 2024',
        plan_key: 'premium',
        invite_code: 'AMIGOS123',
        created_at: '2024-01-01',
        creator_id: userId,
        is_creator: true,
        participant_count: 25,
        user_score: 145,
        user_position: 3,
        total_participants: 25,
        recent_matches: 8,
        correct_predictions: 6,
        accuracy_percentage: 75,
        rival_above: { name: 'João Silva', points_ahead: 8 },
        rival_below: { name: 'Maria Santos', points_behind: 3 },
        progress: { completed: 18, total: 30 }
      },
      {
        id: '2',
        name: 'Liga Familiar',
        championship: 'Copa do Brasil 2024',
        plan_key: 'free',
        invite_code: 'FAMILIA456',
        created_at: '2024-02-01',
        creator_id: 'other-user',
        is_creator: false,
        participant_count: 8,
        user_score: 89,
        user_position: 1,
        total_participants: 8,
        recent_matches: 5,
        correct_predictions: 4,
        accuracy_percentage: 80,
        rival_below: { name: 'Pedro Costa', points_behind: 12 },
        progress: { completed: 12, total: 16 }
      }
    ];
    setPools(mockPools);
  };

  const loadPoolDetails = async (pool: Pool) => {
    setLoadingDetails(true);
    setSelectedPool(pool);
    setShowDetails(true);
    
    // Simular carregamento de participantes e dados de jornada
    setTimeout(() => {
      const mockParticipants: Participant[] = [
        { id: '1', name: 'Você', email: 'user@email.com', score: pool.user_score, position: pool.user_position },
        { id: '2', name: pool.rival_above?.name || 'Rival Acima', email: 'rival1@email.com', score: pool.user_score + (pool.rival_above?.points_ahead || 0), position: pool.user_position - 1 },
        { id: '3', name: pool.rival_below?.name || 'Rival Abaixo', email: 'rival2@email.com', score: pool.user_score - (pool.rival_below?.points_behind || 0), position: pool.user_position + 1 }
      ].sort((a, b) => b.score - a.score);

      const mockJourney: JourneyData[] = Array.from({ length: 10 }, (_, i) => ({
        round: i + 1,
        score: 20 + i * 15 + Math.random() * 10,
        position: Math.max(1, pool.user_position + Math.floor(Math.random() * 3) - 1),
        points_gained: Math.floor(Math.random() * 20)
      }));

      // Simular evolução de todos os participantes do grupo
      const mockGroupEvolution = [
        {
          id: 'user',
          name: 'Você',
          color: '#10B981',
          isUser: true,
          trajectory: mockJourney.map(data => ({
            round: data.round,
            position: data.position,
            score: data.score
          }))
        },
        {
          id: 'rival1',
          name: pool.rival_above?.name || 'João Silva',
          color: '#EF4444',
          isUser: false,
          trajectory: mockJourney.map((data, index) => ({
            round: data.round,
            position: Math.max(1, data.position - 1 + Math.floor(Math.random() * 3)),
            score: data.score + Math.floor(Math.random() * 50) - 25
          }))
        },
        {
          id: 'rival2',
          name: pool.rival_below?.name || 'Maria Santos',
          color: '#F59E0B',
          isUser: false,
          trajectory: mockJourney.map((data, index) => ({
            round: data.round,
            position: Math.max(1, Math.min(pool.total_participants, data.position + Math.floor(Math.random() * 4) - 2)),
            score: data.score + Math.floor(Math.random() * 60) - 30
          }))
        },
        {
          id: 'rival3',
          name: 'Pedro Costa',
          color: '#8B5CF6',
          isUser: false,
          trajectory: mockJourney.map((data, index) => ({
            round: data.round,
            position: Math.max(1, Math.min(pool.total_participants, data.position + Math.floor(Math.random() * 5) - 1)),
            score: data.score + Math.floor(Math.random() * 40) - 20
          }))
        },
        {
          id: 'average',
          name: 'Média do Grupo',
          color: '#6B7280',
          isUser: false,
          isDashed: true,
          trajectory: mockJourney.map((data, index) => ({
            round: data.round,
            position: Math.ceil(pool.total_participants / 2),
            score: data.score * 0.8
          }))
        }
      ];

      setParticipants(mockParticipants);
      setJourneyData(mockJourney);
      setGroupEvolution(mockGroupEvolution);
      setLoadingDetails(false);
    }, 1000);
  };

  const getPlanIcon = (planKey: string) => {
    switch (planKey) {
      case 'premium': return Crown;
      case 'pro': return Star;
      default: return Trophy;
    }
  };

  const getPlanColor = (planKey: string) => {
    switch (planKey) {
      case 'premium': return 'from-yellow-500 to-orange-500';
      case 'pro': return 'from-purple-500 to-pink-500';
      default: return 'from-blue-500 to-cyan-500';
    }
  };

  const filteredPools = pools.filter(pool => {
    switch (activeFilter) {
      case 'pending': return urgentMatches.some(match => match.pool_name === pool.name);
      case 'leading': return pool.user_position === 1;
      case 'ending': return pool.progress.completed / pool.progress.total > 0.8;
      default: return true;
    }
  });

  const formatTimeRemaining = (startTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start.getTime() - now.getTime();
    
    if (diff <= 0) return 'Iniciado';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Protected>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/70">Carregando seu Centro de Comando...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-8">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
              Centro de Comando
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Sua central de controle para dominar todos os bolões. Acompanhe rivais, gerencie boosters e nunca perca um palpite importante.
            </p>
          </div>

          {/* 1. ARSENAL DE BOOSTERS - Prioridade ALTA */}
          <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/30 shadow-xl mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Meu Arsenal</h2>
                  <p className="text-emerald-200 text-sm">Boosters disponíveis para uso estratégico</p>
                </div>
              </div>
              <Link
                href="/boosters"
                className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 flex items-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Comprar Mais
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(allBoosters).map(([key, booster]) => (
                <div key={key} className="bg-white/10 rounded-xl p-4 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${booster.color} rounded-lg flex items-center justify-center`}>
                        <span className="text-lg">{booster.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{booster.name}</h3>
                        <p className="text-sm text-white/70">{booster.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-400">{booster.quantity}</p>
                      <p className="text-xs text-white/60">disponíveis</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. FOCO: PARTIDAS COM AÇÃO IMEDIATA - Prioridade CRÍTICA */}
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-6 border border-red-500/30 shadow-xl mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">🚨 Ação Imediata Necessária</h2>
                <p className="text-red-200 text-sm">Partidas que precisam da sua atenção agora</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {urgentMatches.length === 0 ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Shield className="w-6 h-6 text-green-400" />
                    <h3 className="font-bold text-green-400">Tudo em Dia!</h3>
                  </div>
                  <p className="text-white/70">Não há ações urgentes no momento</p>
                </div>
              ) : (
                urgentMatches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-black/30 rounded-xl p-4 border border-red-500/40 hover:bg-black/40 transition-all duration-200 cursor-pointer"
                    onClick={() => router.push('/palpites')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                          match.type === 'pending_prediction' ? 'bg-red-500' : 'bg-orange-500'
                        }`}></div>
                        <div>
                          <p className="font-bold text-white text-lg">{match.alert_message}</p>
                          <p className="text-white/70">{match.home_team} vs {match.away_team}</p>
                          <p className="text-sm text-white/50">{match.pool_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-400">
                          {formatTimeRemaining(match.start_time)}
                        </p>
                        <p className="text-xs text-white/60">restantes</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. FILTROS RÁPIDOS */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-white/70" />
              <span className="text-white/70 font-medium">Filtros:</span>
            </div>
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'Todos', icon: Trophy },
                { key: 'pending', label: 'Pendentes', icon: AlertTriangle },
                { key: 'leading', label: 'Liderando', icon: Crown },
                { key: 'ending', label: 'Encerrando', icon: Calendar }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeFilter === key
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. VISÃO GERAL DOS BOLÕES ATIVOS - Lista Principal */}
          {filteredPools.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-white/50" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Nenhum bolão encontrado</h3>
              <p className="text-white/70 mb-8">Crie seu primeiro bolão ou entre em um existente para começar!</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/bolao/criar')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Criar Bolão
                </button>
                <button
                  onClick={() => router.push('/bolao/entrar')}
                  className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-medium transition-all duration-200 border border-white/20 flex items-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  Entrar em Bolão
                </button>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                // Paginação
                const totalPages = Math.ceil(filteredPools.length / poolsPerPage);
                const startIndex = currentPage * poolsPerPage;
                const currentPools = filteredPools.slice(startIndex, startIndex + poolsPerPage);
                
                return (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                      {currentPools.map((pool) => {
                        const PlanIcon = getPlanIcon(pool.plan_key);
                        const planColor = getPlanColor(pool.plan_key);
                        
                        return (
                          <div
                            key={pool.id}
                            className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl hover:bg-white/10 transition-all duration-200"
                          >
                            {/* Header do Card */}
                            <div className="flex items-start justify-between mb-6">
                              <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 bg-gradient-to-br ${planColor} rounded-xl flex items-center justify-center shadow-lg`}>
                                  <PlanIcon className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-white mb-1">{pool.name}</h3>
                                  <p className="text-white/60 text-sm">{pool.championship}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Users className="w-4 h-4 text-white/50" />
                                    <span className="text-white/50 text-sm">{pool.total_participants} participantes</span>
                                  </div>
                                </div>
                              </div>
                              {pool.is_creator && (
                                <div className="bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
                                  <span className="text-yellow-300 text-xs font-medium">Criador</span>
                                </div>
                              )}
                            </div>

                            {/* Sua Posição - Métrica Primária */}
                            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-4 mb-4 border border-blue-500/30">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-white/70 text-sm mb-1">Sua Posição</p>
                                  <p className="text-3xl font-bold text-white">
                                    {pool.user_position}º <span className="text-lg text-white/60">de {pool.total_participants}</span>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-white/70 text-sm mb-1">Pontos</p>
                                  <p className="text-2xl font-bold text-blue-400">{pool.user_score}</p>
                                </div>
                              </div>
                            </div>

                            {/* Rivais Diretos - MANDATÓRIO */}
                            <div className="space-y-3 mb-4">
                              {pool.rival_above && (
                                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <TrendingUp className="w-5 h-5 text-red-400" />
                                      <div>
                                        <p className="text-white font-medium">{pool.rival_above.name}</p>
                                        <p className="text-red-300 text-sm">Rival acima</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-red-400 font-bold">+{pool.rival_above.points_ahead}</p>
                                      <p className="text-red-300 text-xs">pts à frente</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {pool.rival_below && (
                                <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <TrendingDown className="w-5 h-5 text-green-400" />
                                      <div>
                                        <p className="text-white font-medium">{pool.rival_below.name}</p>
                                        <p className="text-green-300 text-sm">Rival abaixo</p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-green-400 font-bold">-{pool.rival_below.points_behind}</p>
                                      <p className="text-green-300 text-xs">pts atrás</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Progresso */}
                            <div className="mb-6">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-white/70 text-sm">Progresso dos Palpites</p>
                                <p className="text-white/70 text-sm">{pool.progress.completed}/{pool.progress.total}</p>
                              </div>
                              <div className="w-full bg-white/10 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${(pool.progress.completed / pool.progress.total) * 100}%` }}
                                ></div>
                              </div>
                              <p className="text-white/50 text-xs mt-1">
                                {Math.round((pool.progress.completed / pool.progress.total) * 100)}% completo
                              </p>
                            </div>

                            {/* CTA Principal */}
                            <button
                              onClick={() => loadPoolDetails(pool)}
                              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                            >
                              <Eye className="w-5 h-5" />
                              Acessar Bolão
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Controles de Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mb-8">
                        <div className="text-sm text-white/60">
                          Mostrando {startIndex + 1}-{Math.min(startIndex + poolsPerPage, filteredPools.length)} de {filteredPools.length} bolões
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm transition-colors flex items-center gap-2"
                          >
                            <ChevronDown className="w-4 h-4 rotate-90" />
                            Anterior
                          </button>
                          <span className="px-4 py-2 bg-blue-500 rounded-lg text-white text-sm font-medium">
                            {currentPage + 1} de {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage === totalPages - 1}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm transition-colors flex items-center gap-2"
                          >
                            Próxima
                            <ChevronDown className="w-4 h-4 -rotate-90" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {/* 5. SEÇÕES ADICIONAIS */}
          <div className="space-y-6">
            {/* Bolões Encerrados */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Medal className="w-6 h-6 text-white/70" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Bolões Encerrados</h3>
                    <p className="text-white/60 text-sm">Histórico de campeonatos anteriores</p>
                  </div>
                </div>
                {showHistory ? <ChevronUp className="w-5 h-5 text-white/70" /> : <ChevronDown className="w-5 h-5 text-white/70" />}
              </button>
              
              {showHistory && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-white/50 text-center py-8">Nenhum bolão encerrado ainda.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Detalhes do Bolão */}
        {showDetails && selectedPool && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
              {/* Header do Modal com Dropdown */}
              <div className="sticky top-0 bg-slate-900 border-b border-white/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <select
                      value={selectedPool.id}
                      onChange={(e) => {
                        const pool = pools.find(p => p.id === e.target.value);
                        if (pool) loadPoolDetails(pool);
                      }}
                      className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white font-bold text-xl"
                    >
                      {pools.map(pool => (
                        <option key={pool.id} value={pool.id} className="bg-slate-800">
                          {pool.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white/70">Carregando detalhes...</p>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Gráfico de Trajetória - MANDATÓRIO */}
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-400" />
                        Evolução no Ranking vs Grupo
                      </h3>
                      <div className="h-80 bg-white/5 rounded-lg p-4 relative">
                        {/* Eixo Y - Posições */}
                        <div className="absolute left-2 top-4 bottom-8 flex flex-col justify-between text-xs text-white/60">
                          {Array.from({ length: Math.min(selectedPool.total_participants, 10) }, (_, i) => (
                            <span key={i}>{i + 1}º</span>
                          ))}
                        </div>
                        
                        {/* Área do Gráfico */}
                        <div className="ml-8 mr-4 h-full relative">
                          {/* Grid de fundo */}
                          <div className="absolute inset-0 grid grid-cols-10 gap-0">
                            {Array.from({ length: 10 }, (_, i) => (
                              <div key={i} className="border-r border-white/5 last:border-r-0"></div>
                            ))}
                          </div>
                          <div className="absolute inset-0 grid grid-rows-10 gap-0">
                            {Array.from({ length: 10 }, (_, i) => (
                              <div key={i} className="border-b border-white/5 last:border-b-0"></div>
                            ))}
                          </div>
                          
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                             <defs>
                               {/* Gradientes dinâmicos para cada participante */}
                               {groupEvolution.map((participant) => (
                                 <linearGradient key={participant.id} id={`gradient-${participant.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                   <stop offset="0%" stopColor={participant.color} />
                                   <stop offset="100%" stopColor={participant.color} stopOpacity="0.8" />
                                 </linearGradient>
                               ))}
                               
                               {/* Filtros para efeitos */}
                               <filter id="glow">
                                 <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                 <feMerge> 
                                   <feMergeNode in="coloredBlur"/>
                                   <feMergeNode in="SourceGraphic"/>
                                 </feMerge>
                               </filter>
                               <filter id="userGlow">
                                 <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                 <feMerge> 
                                   <feMergeNode in="coloredBlur"/>
                                   <feMergeNode in="SourceGraphic"/>
                                 </feMerge>
                               </filter>
                             </defs>
                             
                             {/* Renderizar todas as trajetórias dos participantes */}
                             {groupEvolution.map((participant, participantIndex) => {
                               if (!participant.trajectory || participant.trajectory.length === 0) return null;
                               
                               const isUser = participant.isUser;
                               const isDashed = participant.isDashed;
                               
                               return (
                                 <polyline
                                   key={participant.id}
                                   fill="none"
                                   stroke={`url(#gradient-${participant.id})`}
                                   strokeWidth={isUser ? "5" : isDashed ? "2" : "2.5"}
                                   strokeDasharray={isDashed ? "8,4" : "none"}
                                   opacity={isUser ? "1" : isDashed ? "0.6" : "0.75"}
                                   filter={isUser ? "url(#userGlow)" : isDashed ? "none" : "url(#glow)"}
                                   style={{
                                     zIndex: isUser ? 10 : isDashed ? 1 : 5
                                   }}
                                   points={participant.trajectory.map((data, index) => {
                                     const x = (index / (participant.trajectory.length - 1)) * 100;
                                     const y = ((data.position - 1) / (selectedPool.total_participants - 1)) * 100;
                                     return `${x},${100 - y}`;
                                   }).join(' ')}
                                 />
                               );
                             })}
                           </svg>
                          
                          {/* Pontos Interativos do Usuário */}
                          {journeyData.map((data, index) => {
                            const x = (index / (journeyData.length - 1)) * 100;
                            const y = ((data.position - 1) / (selectedPool.total_participants - 1)) * 100;
                            const isImprovement = index > 0 && data.position < journeyData[index - 1].position;
                            const isDecline = index > 0 && data.position > journeyData[index - 1].position;
                            
                            return (
                              <div
                                key={index}
                                className={`absolute w-4 h-4 rounded-full border-3 border-white cursor-pointer hover:scale-150 transition-all duration-200 group shadow-lg ${
                                  isImprovement ? 'bg-green-500 animate-pulse' : 
                                  isDecline ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{
                                  left: `${x}%`,
                                  top: `${100 - y}%`,
                                  transform: 'translate(-50%, -50%)',
                                  zIndex: 10
                                }}
                              >
                                {/* Tooltip Melhorado */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-black/95 text-white text-xs rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-20 shadow-2xl border border-white/20">
                                  <div className="font-bold text-blue-300 mb-1">Rodada {data.round}</div>
                                  <div className="space-y-1">
                                    <div>Posição: <span className="font-bold text-white">{data.position}º</span></div>
                                    <div>Pontuação: <span className="font-bold text-green-400">{Math.round(data.score)} pts</span></div>
                                    <div>Ganhos: <span className="font-bold text-yellow-400">+{data.points_gained} pts</span></div>
                                    {index > 0 && (
                                      <div className={`font-bold ${isImprovement ? 'text-green-400' : isDecline ? 'text-red-400' : 'text-gray-400'}`}>
                                        {isImprovement ? '↗️ Subiu' : isDecline ? '↘️ Desceu' : '➡️ Manteve'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/95"></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Eixo X - Rodadas */}
                        <div className="absolute bottom-0 left-8 right-4 flex justify-between text-xs text-white/60">
                          {journeyData.map((data, index) => (
                            <span key={index} className="text-center font-medium">R{data.round}</span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Legenda Dinâmica dos Participantes */}
                       <div className="mt-6 space-y-4">
                         <h4 className="text-sm font-medium text-white/80 mb-3">Participantes do Grupo:</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {groupEvolution.map((participant) => (
                             <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                               <div className="flex items-center gap-2">
                                 {participant.isDashed ? (
                                   <div 
                                     className="w-6 h-1 rounded-full"
                                     style={{
                                       backgroundColor: participant.color,
                                       backgroundImage: `repeating-linear-gradient(90deg, ${participant.color} 0px, ${participant.color} 4px, transparent 4px, transparent 8px)`
                                     }}
                                   ></div>
                                 ) : (
                                   <div 
                                     className={`w-4 h-4 rounded-full ${participant.isUser ? 'ring-2 ring-white shadow-lg animate-pulse' : ''}`}
                                     style={{ backgroundColor: participant.color }}
                                   ></div>
                                 )}
                                 <span className={`text-sm ${participant.isUser ? 'text-white font-bold' : 'text-white/70'}`}>
                                   {participant.name}
                                 </span>
                               </div>
                               {participant.isUser && (
                                 <div className="ml-auto">
                                   <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                     Você
                                   </span>
                                 </div>
                               )}
                             </div>
                           ))}
                         </div>
                         
                         {/* Indicadores de Performance */}
                         <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/10">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                             <span className="text-green-400 text-xs">Melhoria de posição</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                             <span className="text-red-400 text-xs">Queda de posição</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                             <span className="text-blue-400 text-xs">Posição mantida</span>
                           </div>
                         </div>
                       </div>
                    </div>

                  {/* Ranking de Participantes */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="text-xl font-bold text-white mb-4">Ranking Atual</h3>
                    <div className="space-y-3">
                      {participants.map((participant, index) => (
                        <div
                          key={participant.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            participant.name === 'Você' 
                              ? 'bg-blue-500/20 border border-blue-500/30' 
                              : 'bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-yellow-500 text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                              index === 2 ? 'bg-orange-600 text-white' :
                              'bg-white/20 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-white">{participant.name}</p>
                              <p className="text-white/60 text-sm">{participant.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-white">{participant.score} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </Protected>
  );
}