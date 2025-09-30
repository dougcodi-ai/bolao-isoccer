"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Protected from "@/components/Protected";
import { 
  Calendar, 
  Clock, 
  Trophy, 
  Users, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Plus, 
  Minus, 
  Save, 
  Check, 
  CheckCircle, 
  AlertTriangle, 
  Timer, 
  X,
  Star,
  Target,
  TrendingUp,
  Award,
  Zap
} from "lucide-react";

// Tipos
interface Pool {
  id: string;
  name: string;
  code: string;
  owner_id: string;
}

interface Match {
  id: string;
  pool_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
}

interface Prediction {
  match_id: string;
  user_id: string;
  home_pred: number;
  away_pred: number;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string;
}

interface RankingParticipant {
  user: Profile;
  totalPoints: number;
  position: number;
  correctPredictions: number;
  totalPredictions: number;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

// Constantes
const GAMES_PER_PAGE = 10;

// Função para obter logo do time
function getTeamLogo(teamName: string): string {
  const teamLogos: Record<string, string> = {
    "Flamengo": "https://logoeps.com/wp-content/uploads/2013/03/flamengo-vector-logo.png",
    "Palmeiras": "https://logoeps.com/wp-content/uploads/2013/03/palmeiras-vector-logo.png",
    "Corinthians": "https://logoeps.com/wp-content/uploads/2013/03/corinthians-vector-logo.png",
    "São Paulo": "https://logoeps.com/wp-content/uploads/2013/03/sao-paulo-vector-logo.png",
    "Santos": "https://logoeps.com/wp-content/uploads/2013/03/santos-vector-logo.png",
    "Vasco": "https://logoeps.com/wp-content/uploads/2013/03/vasco-da-gama-vector-logo.png",
    "Botafogo": "https://logoeps.com/wp-content/uploads/2013/03/botafogo-vector-logo.png",
    "Fluminense": "https://logoeps.com/wp-content/uploads/2013/03/fluminense-vector-logo.png",
    "Grêmio": "https://logoeps.com/wp-content/uploads/2013/03/gremio-vector-logo.png",
    "Internacional": "https://logoeps.com/wp-content/uploads/2013/03/internacional-vector-logo.png",
    "Atlético-MG": "https://logoeps.com/wp-content/uploads/2013/03/atletico-mineiro-vector-logo.png",
    "Cruzeiro": "https://logoeps.com/wp-content/uploads/2013/03/cruzeiro-vector-logo.png",
    "Bahia": "https://logoeps.com/wp-content/uploads/2013/03/bahia-vector-logo.png",
    "Vitória": "https://logoeps.com/wp-content/uploads/2013/03/vitoria-vector-logo.png",
    "Sport": "https://logoeps.com/wp-content/uploads/2013/03/sport-recife-vector-logo.png",
    "Ceará": "https://logoeps.com/wp-content/uploads/2013/03/ceara-vector-logo.png",
    "Fortaleza": "https://logoeps.com/wp-content/uploads/2013/03/fortaleza-vector-logo.png",
    "Athletico-PR": "https://logoeps.com/wp-content/uploads/2013/03/atletico-paranaense-vector-logo.png",
    "Coritiba": "https://logoeps.com/wp-content/uploads/2013/03/coritiba-vector-logo.png",
    "Goiás": "https://logoeps.com/wp-content/uploads/2013/03/goias-vector-logo.png"
  };
  
  return teamLogos[teamName] || `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName)}&background=1f2937&color=ffffff&size=128`;
}

export default function PalpitesPage() {
  // Estados principais
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Estados de navegação
  const [activeTab, setActiveTab] = useState<"futuros" | "passados">("futuros");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);

  // Estados de dados
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [pastMatches, setPastMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [tempPredictions, setTempPredictions] = useState<Record<string, { home: number; away: number }>>({});

  // Estados de UI
  const [savingPredictions, setSavingPredictions] = useState<Set<string>>(new Set());
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Estados de ranking
  const [ranking, setRanking] = useState<RankingParticipant[]>([]);
  const [userRanking, setUserRanking] = useState<RankingParticipant | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);

  // Função para mostrar toast
  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  // Função para limpar erro de card específico
  const clearCardError = (matchId: string) => {
    setCardErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[matchId];
      return newErrors;
    });
  };

  // Carregar dados do usuário
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);

        // Buscar perfil do usuário
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUser(profile);
        }

        // Buscar bolões do usuário
        const { data: poolsData } = await supabase
          .from("pool_members")
          .select(`
            pool_id,
            pools!inner(id, name, code, owner_id)
          `)
          .eq("user_id", user.id);

        if (poolsData) {
          const userPools = poolsData.map(pm => pm.pools).filter(Boolean);
          setPools(userPools);
          
          if (userPools.length > 0) {
            setSelectedPoolId(userPools[0].id);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados do usuário:", error);
        showToast("error", "Erro ao carregar dados do usuário");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Carregar jogos com paginação
  const loadMatches = async (poolId: string, tab: "futuros" | "passados", page: number = 1) => {
    if (!poolId) return;

    setLoadingPage(true);
    
    try {
      const now = new Date().toISOString();
      const offset = (page - 1) * GAMES_PER_PAGE;
      
      let query = supabase
        .from("matches")
        .select("*", { count: "exact" })
        .eq("pool_id", poolId)
        .order("start_time", { ascending: tab === "futuros" })
        .range(offset, offset + GAMES_PER_PAGE - 1);

      if (tab === "futuros") {
        query = query.gte("start_time", now);
      } else {
        query = query.lt("start_time", now);
      }

      const { data: matches, count, error } = await query;

      if (error) throw error;

      if (tab === "futuros") {
        setFutureMatches(matches || []);
      } else {
        setPastMatches(matches || []);
      }

      setTotalMatches(count || 0);
      setTotalPages(Math.ceil((count || 0) / GAMES_PER_PAGE));

      // Carregar palpites para os jogos
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        const { data: predictionsData } = await supabase
          .from("predictions")
          .select("*")
          .eq("user_id", userId)
          .in("match_id", matchIds);

        if (predictionsData) {
          const predictionsMap = predictionsData.reduce((acc, pred) => {
            acc[pred.match_id] = pred;
            return acc;
          }, {} as Record<string, Prediction>);
          
          setPredictions(prev => ({ ...prev, ...predictionsMap }));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar jogos:", error);
      showToast("error", "Erro ao carregar jogos");
    } finally {
      setLoadingPage(false);
    }
  };

  // Carregar ranking do bolão
  const loadRanking = async (poolId: string) => {
    if (!poolId) return;

    setLoadingRanking(true);
    try {
      const { data: rankingData } = await supabase
        .from("pool_members")
        .select(`
          user_id,
          profiles!inner(id, display_name, avatar_url),
          total_points
        `)
        .eq("pool_id", poolId)
        .order("total_points", { ascending: false })
        .limit(10);

      if (rankingData) {
        const ranking = rankingData.map((member, index) => ({
          user: member.profiles,
          totalPoints: member.total_points || 0,
          position: index + 1,
          correctPredictions: 0,
          totalPredictions: 0
        }));

        setRanking(ranking);

        // Encontrar posição do usuário atual
        const userPosition = ranking.find(r => r.user.id === userId);
        setUserRanking(userPosition || null);
      }
    } catch (error) {
      console.error("Erro ao carregar ranking:", error);
    } finally {
      setLoadingRanking(false);
    }
  };

  // Efeito para carregar jogos quando bolão ou aba mudam
  useEffect(() => {
    if (selectedPoolId) {
      setCurrentPage(1);
      loadMatches(selectedPoolId, activeTab, 1);
      loadRanking(selectedPoolId);
    }
  }, [selectedPoolId, activeTab, userId]);

  // Efeito para carregar jogos quando página muda
  useEffect(() => {
    if (selectedPoolId && currentPage > 1) {
      loadMatches(selectedPoolId, activeTab, currentPage);
    }
  }, [currentPage]);

  // Função para navegar entre páginas
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  // Função para salvar palpite
  const savePrediction = async (matchId: string, homePred: number, awayPred: number) => {
    if (!userId) return;

    setSavingPredictions(prev => new Set([...prev, matchId]));
    clearCardError(matchId);

    try {
      const { error } = await supabase
        .from("predictions")
        .upsert({
          match_id: matchId,
          user_id: userId,
          home_pred: homePred,
          away_pred: awayPred
        });

      if (error) throw error;

      setPredictions(prev => ({
        ...prev,
        [matchId]: {
          match_id: matchId,
          user_id: userId,
          home_pred: homePred,
          away_pred: awayPred,
          created_at: new Date().toISOString()
        }
      }));

      setTempPredictions(prev => {
        const newTemp = { ...prev };
        delete newTemp[matchId];
        return newTemp;
      });

      showToast("success", "Palpite salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar palpite:", error);
      setCardErrors(prev => ({ ...prev, [matchId]: "Erro ao salvar palpite" }));
      showToast("error", "Erro ao salvar palpite");
    } finally {
      setSavingPredictions(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    }
  };

  // Função para atualizar palpite temporário
  const updateTempPrediction = (matchId: string, type: "home" | "away", value: number) => {
    setTempPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [type]: Math.max(0, value)
      }
    }));
  };

  // Função para obter palpite atual (temporário ou salvo)
  const getCurrentPrediction = (matchId: string) => {
    const temp = tempPredictions[matchId];
    const saved = predictions[matchId];
    
    return {
      home: temp?.home ?? saved?.home_pred ?? 0,
      away: temp?.away ?? saved?.away_pred ?? 0
    };
  };

  // Função para verificar se palpite foi modificado
  const isPredictionModified = (matchId: string) => {
    const temp = tempPredictions[matchId];
    const saved = predictions[matchId];
    
    if (!temp) return false;
    if (!saved) return temp.home !== 0 || temp.away !== 0;
    
    return temp.home !== saved.home_pred || temp.away !== saved.away_pred;
  };

  // Função para obter status visual do card
  const getCardVisualState = (match: Match) => {
    const now = new Date();
    const matchTime = new Date(match.start_time);
    const timeDiff = matchTime.getTime() - now.getTime();
    const hoursUntilMatch = timeDiff / (1000 * 60 * 60);
    const hasPrediction = predictions[match.id];

    if (match.home_score !== null && match.away_score !== null) {
      return {
        borderColor: 'border-blue-500/40',
        bgGradient: 'from-blue-500/10 to-blue-500/5',
        glowEffect: 'shadow-blue-500/20'
      };
    }

    if (hoursUntilMatch <= 1 && hoursUntilMatch > 0) {
      return {
        borderColor: 'border-yellow-500/40',
        bgGradient: 'from-yellow-500/10 to-yellow-500/5',
        glowEffect: 'shadow-yellow-500/20'
      };
    }

    if (hasPrediction) {
      return {
        borderColor: 'border-green-500/30',
        bgGradient: 'from-green-500/5 to-green-500/2',
        glowEffect: 'shadow-green-500/10'
      };
    }

    return {
      borderColor: 'border-white/20',
      bgGradient: 'from-white/10 to-white/5',
      glowEffect: 'shadow-xl'
    };
  };

  // Função para obter status do jogo
  const getMatchStatus = (match: Match) => {
    const now = new Date();
    const matchTime = new Date(match.start_time);
    
    if (match.home_score !== null && match.away_score !== null) {
      return {
        text: "Finalizado",
        color: "text-blue-500",
        icon: CheckCircle
      };
    }
    
    if (matchTime <= now) {
      return {
        text: "Em Andamento",
        color: "text-yellow-500",
        icon: Clock
      };
    }
    
    return {
      text: "Agendado",
      color: "text-green-500",
      icon: Clock
    };
  };

  // Função para obter tempo restante
  const getTimeRemaining = (match: Match) => {
    const now = new Date();
    const matchTime = new Date(match.start_time);
    const timeDiff = matchTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      return {
        text: "Iniciado",
        color: "text-red-500"
      };
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return {
        text: `${days}d ${hours}h`,
        color: "text-green-500"
      };
    } else if (hours > 1) {
      return {
        text: `${hours}h ${minutes}m`,
        color: "text-yellow-500"
      };
    } else {
      return {
        text: `${hours}h ${minutes}m`,
        color: "text-red-500"
      };
    }
  };

  if (loading) {
    return (
      <Protected>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-lg font-medium">Carregando palpites...</p>
            <p className="text-sm text-white/60 mt-2">Preparando sua experiência</p>
          </div>
        </div>
      </Protected>
    );
  }

  const currentMatches = activeTab === "futuros" ? futureMatches : pastMatches;

  return (
    <Protected>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Elementos decorativos modernos */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Campo de futebol estilizado */}
          <svg className="absolute top-24 right-12 w-40 h-24 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
            <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
            <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
          </svg>
          
          {/* Bola de futebol */}
          <svg className="absolute bottom-32 left-16 w-16 h-16 opacity-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1"/>
            <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill="currentColor" opacity="0.3"/>
          </svg>
          
          {/* Troféu */}
          <svg className="absolute top-1/3 left-8 w-12 h-12 opacity-6 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          
          {/* Partículas flutuantes */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/10 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        </div>

        {/* Header moderno */}
        <div className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Informações do usuário */}
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.display_name || ""} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {user?.display_name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    Meus Palpites
                  </h1>
                  <p className="text-white/60 text-sm">
                    Olá, {user?.display_name || "Usuário"}! Faça seus palpites
                  </p>
                </div>
              </div>

              {/* Seletor de bolão moderno */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 hover:bg-white/15 transition-all duration-200 min-w-[200px]"
                >
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">
                    {pools.find(p => p.id === selectedPoolId)?.name || "Selecionar Bolão"}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full mt-2 right-0 bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl z-50 min-w-[250px] animate-in fade-in slide-in-from-top-2">
                    {pools.map((pool) => (
                      <button
                        key={pool.id}
                        onClick={() => {
                          setSelectedPoolId(pool.id);
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center gap-3"
                      >
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="font-medium">{pool.name}</div>
                          <div className="text-xs text-white/60">Código: {pool.code}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Área principal dos jogos */}
            <div className="lg:col-span-3 space-y-6">
              {/* Abas modernas */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-2">
                <div className="flex">
                  <button
                    onClick={() => {
                      setActiveTab("futuros");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-300 rounded-xl ${
                      activeTab === "futuros"
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-[1.02]"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>Jogos Futuros</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        activeTab === "futuros" 
                          ? "bg-white/20 text-white" 
                          : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {activeTab === "futuros" ? futureMatches.length : totalMatches}
                      </span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setActiveTab("passados");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-300 rounded-xl ${
                      activeTab === "passados"
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-[1.02]"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle className="h-5 w-5" />
                      <span>Jogos Passados</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        activeTab === "passados" 
                          ? "bg-white/20 text-white" 
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {activeTab === "passados" ? pastMatches.length : totalMatches}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Navegação de páginas */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Target className="w-4 h-4" />
                    <span>Página {currentPage} de {totalPages}</span>
                    <span className="text-white/40">•</span>
                    <span>{totalMatches} jogos total</span>
                    <span className="text-white/40">•</span>
                    <span>{GAMES_PER_PAGE} por página</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1 || loadingPage}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            disabled={loadingPage}
                            className={`w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                              pageNum === currentPage
                                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                                : "bg-white/10 hover:bg-white/20 text-white/80"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || loadingPage}
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200"
                    >
                      <span className="hidden sm:inline">Próximo</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Loading de página */}
              {loadingPage && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Carregando jogos...</span>
                  </div>
                </div>
              )}

              {/* Lista de jogos */}
              {!loadingPage && (
                <div className="space-y-4">
                  {currentMatches.length === 0 ? (
                    <div className="text-center py-16 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Nenhum jogo encontrado</h3>
                      <p className="text-white/60">
                        {activeTab === "futuros" 
                          ? "Não há jogos futuros agendados no momento."
                          : "Não há jogos passados para exibir."
                        }
                      </p>
                    </div>
                  ) : (
                    currentMatches.map((match, index) => {
                      const visualState = getCardVisualState(match);
                      const status = getMatchStatus(match);
                      const timeRemaining = getTimeRemaining(match);
                      const currentPred = getCurrentPrediction(match.id);
                      const isModified = isPredictionModified(match.id);
                      const isSaving = savingPredictions.has(match.id);
                      const cardError = cardErrors[match.id];

                      return (
                        <div
                          key={match.id}
                          className={`bg-gradient-to-br ${visualState.bgGradient} backdrop-blur-sm rounded-2xl p-6 border ${visualState.borderColor} ${visualState.glowEffect} hover:shadow-2xl transition-all duration-500 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-4 group`}
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {/* Header com Status e Tempo */}
                          <div className="flex items-center justify-between mb-6">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                              status.color === 'text-green-500' ? 'bg-green-500/20 text-green-400' : 
                              status.color === 'text-red-500' ? 'bg-red-500/20 text-red-400' : 
                              status.color === 'text-blue-500' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              <status.icon className="w-4 h-4" />
                              <span>{status.text}</span>
                            </div>
                            
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                              timeRemaining.color === 'text-green-500' ? 'bg-green-500/20 text-green-400' : 
                              timeRemaining.color === 'text-yellow-500' ? 'bg-yellow-500/20 text-yellow-400' : 
                              'bg-red-500/20 text-red-400'
                            }`}>
                              <Timer className="w-4 h-4" />
                              <span>{timeRemaining.text}</span>
                            </div>
                          </div>

                          {/* Times e Placar */}
                          <div className="flex items-center justify-between mb-6">
                            {/* Time da Casa */}
                            <div className="flex items-center gap-4 flex-1">
                              <div className="relative group-hover:scale-110 transition-transform duration-300">
                                <img
                                  src={getTeamLogo(match.home_team)}
                                  alt={match.home_team}
                                  className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                                />
                                <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-white">{match.home_team}</h3>
                                <p className="text-white/60 text-sm">Casa</p>
                              </div>
                            </div>

                            {/* Placar ou VS */}
                            <div className="flex items-center justify-center px-6">
                              {match.home_score !== null && match.away_score !== null ? (
                                <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-xl px-6 py-3 border border-white/20">
                                  <div className="flex items-center gap-4 text-2xl font-bold">
                                    <span className="text-white">{match.home_score}</span>
                                    <span className="text-white/40">×</span>
                                    <span className="text-white">{match.away_score}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-white/10 rounded-xl px-4 py-2 border border-white/20">
                                  <span className="text-white/60 font-medium">VS</span>
                                </div>
                              )}
                            </div>

                            {/* Time Visitante */}
                            <div className="flex items-center gap-4 flex-1 justify-end">
                              <div className="text-right">
                                <h3 className="font-bold text-lg text-white">{match.away_team}</h3>
                                <p className="text-white/60 text-sm">Visitante</p>
                              </div>
                              <div className="relative group-hover:scale-110 transition-transform duration-300">
                                <img
                                  src={getTeamLogo(match.away_team)}
                                  alt={match.away_team}
                                  className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-lg"
                                />
                                <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                            </div>
                          </div>

                          {/* Data e Hora */}
                          <div className="text-center mb-6">
                            <p className="text-white/80 font-medium">
                              {new Date(match.start_time).toLocaleDateString('pt-BR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-white/60 text-sm">
                              {new Date(match.start_time).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>

                          {/* Área de Palpites */}
                          {activeTab === "futuros" && new Date(match.start_time) > new Date() && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-400" />
                                Seu Palpite
                              </h4>
                              
                              <div className="flex items-center justify-center gap-6">
                                {/* Palpite Casa */}
                                <div className="flex items-center gap-3">
                                  <span className="text-white/60 text-sm font-medium min-w-[60px] text-right">
                                    {match.home_team}
                                  </span>
                                  <div className="flex items-center gap-2 bg-white/10 rounded-lg border border-white/20">
                                    <button
                                      onClick={() => updateTempPrediction(match.id, "home", currentPred.home - 1)}
                                      className="p-2 hover:bg-white/10 transition-colors rounded-l-lg"
                                    >
                                      <Minus className="w-4 h-4 text-white/60" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={currentPred.home}
                                      onChange={(e) => updateTempPrediction(match.id, "home", parseInt(e.target.value) || 0)}
                                      className="w-16 text-center bg-transparent text-white font-bold text-lg border-none outline-none"
                                    />
                                    <button
                                      onClick={() => updateTempPrediction(match.id, "home", currentPred.home + 1)}
                                      className="p-2 hover:bg-white/10 transition-colors rounded-r-lg"
                                    >
                                      <Plus className="w-4 h-4 text-white/60" />
                                    </button>
                                  </div>
                                </div>

                                <span className="text-white/40 font-bold text-xl">×</span>

                                {/* Palpite Visitante */}
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 bg-white/10 rounded-lg border border-white/20">
                                    <button
                                      onClick={() => updateTempPrediction(match.id, "away", currentPred.away - 1)}
                                      className="p-2 hover:bg-white/10 transition-colors rounded-l-lg"
                                    >
                                      <Minus className="w-4 h-4 text-white/60" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={currentPred.away}
                                      onChange={(e) => updateTempPrediction(match.id, "away", parseInt(e.target.value) || 0)}
                                      className="w-16 text-center bg-transparent text-white font-bold text-lg border-none outline-none"
                                    />
                                    <button
                                      onClick={() => updateTempPrediction(match.id, "away", currentPred.away + 1)}
                                      className="p-2 hover:bg-white/10 transition-colors rounded-r-lg"
                                    >
                                      <Plus className="w-4 h-4 text-white/60" />
                                    </button>
                                  </div>
                                  <span className="text-white/60 text-sm font-medium min-w-[60px]">
                                    {match.away_team}
                                  </span>
                                </div>
                              </div>

                              {/* Botão Salvar */}
                              {isModified && (
                                <div className="mt-4 flex justify-center">
                                  <button
                                    onClick={() => savePrediction(match.id, currentPred.home, currentPred.away)}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-green-500/25 animate-in fade-in slide-in-from-bottom-2"
                                  >
                                    {isSaving ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save className="w-4 h-4" />
                                        <span>Salvar Palpite</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Erro do card */}
                              {cardError && (
                                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                                  <AlertTriangle className="w-4 h-4 text-red-400" />
                                  <span className="text-red-400 text-sm">{cardError}</span>
                                  <button
                                    onClick={() => clearCardError(match.id)}
                                    className="ml-auto text-red-400 hover:text-red-300"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Palpite Salvo (para jogos passados ou com palpite) */}
                          {predictions[match.id] && (
                            <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                              <div className="flex items-center justify-center gap-4">
                                <div className="flex items-center gap-2 text-green-400">
                                  <Check className="w-4 h-4" />
                                  <span className="font-medium">Palpite Salvo:</span>
                                </div>
                                <div className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-lg">
                                  <span className="text-green-400 font-bold text-lg">{predictions[match.id].home_pred}</span>
                                  <span className="text-white/50">×</span>
                                  <span className="text-green-400 font-bold text-lg">{predictions[match.id].away_pred}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Sidebar com Ranking */}
            <div className="lg:col-span-1">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 sticky top-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Ranking</h2>
                    <p className="text-white/60 text-sm">Top 10 do bolão</p>
                  </div>
                </div>

                {loadingRanking ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white/10 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-white/10 rounded w-3/4 mb-1"></div>
                            <div className="h-3 bg-white/10 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : ranking.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/60 text-sm">Nenhum participante encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ranking.map((participant, index) => (
                      <div
                        key={participant.user.id}
                        className={`bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all duration-200 ${
                          participant.user.id === userId ? 'ring-2 ring-blue-500/50 bg-blue-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Posição */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                              index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                              index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                              'bg-gradient-to-br from-slate-600 to-slate-700 text-white'
                            }`}>
                              {index + 1}°
                            </div>

                            {/* Avatar e Nome */}
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                {participant.user.avatar_url ? (
                                  <img 
                                    src={participant.user.avatar_url} 
                                    alt={participant.user.display_name || ""}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  (participant.user.display_name || "?").charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-white text-sm">
                                  {participant.user.display_name || "Usuário"}
                                </p>
                                {participant.user.id === userId && (
                                  <p className="text-blue-400 text-xs">Você</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Pontos */}
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span className="font-bold text-white">{participant.totalPoints}</span>
                            </div>
                            <p className="text-white/60 text-xs">pontos</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-sm border animate-in fade-in slide-in-from-right-4 ${
                toast.type === "success"
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : "bg-red-500/20 border-red-500/30 text-red-400"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
              <span className="font-medium">{toast.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-current hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Protected>
  );
}
