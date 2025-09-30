"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Protected from "@/components/Protected";
import { useBoosterInventory } from "@/lib/hooks/useBoosterInventory";
import { useBoosterActivations } from "@/lib/hooks/useBoosterActivations";
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
  Eye, 
  X,
  Star,
  Target,
  TrendingUp,
  Award,
  Zap,
  Shield,
  Lock
} from "lucide-react";
import teamLogoMap from "@/../../src/data/teamLogoMap.json";
import { getTeamLogoSync } from "@/utils/logoCache";


// Tipos
interface Pool {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  championship?: string; // Campeonato associado ao bolão
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

interface Championship {
  id: string;
  name: string;
  poolCount: number;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

type ParticipantData = {
  user: Profile;
  hasPredicted: boolean;
  prediction?: {
    home_pred: number;
    away_pred: number;
  };
  hasShield?: boolean;
};

type ScoreCount = {
  home_score: number;
  away_score: number;
  count: number;
};

// Constantes
const GAMES_PER_PAGE = 15;

// Cache de logos provenientes do Supabase Storage (team-logos)
let runtimeTeamLogoMap: Record<string, string> = {};

// Atualiza o cache de logos a partir da tabela football_teams
async function refreshTeamLogosFromStorage() {
  try {
    const { data } = await supabase
      .from("football_teams")
      .select("name, logo_path")
      .not("logo_path", "is", null);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const map: Record<string, string> = {};
    (data || []).forEach((t: any) => {
      const key = (t.name || "").toUpperCase().trim();
      if (key && t.logo_path) {
        map[key] = `${baseUrl}/storage/v1/object/public/team-logos/${t.logo_path}`;
      }
    });
    runtimeTeamLogoMap = map;
  } catch (e) {
    // Em caso de falha, mantemos o cache atual e seguimos com fallback local
  }
}

// Função para buscar logo do time com cache priorizando logos armazenadas
const getTeamLogo = (teamName: string): string => {
  const key = teamName.toUpperCase().trim();
  const stored = runtimeTeamLogoMap[key];
  return stored || getTeamLogoSync(teamName);
};

export default function PalpitesPage() {
  // Router
  const router = useRouter();
  
  // Estados principais
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [pools, setPools] = useState<Pool[]>([]);

  // Estados de navegação
  const [activeTab, setActiveTab] = useState<"futuros" | "passados">("futuros");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);

  // Estados de paginação "Carregar Mais"
  const [futureMatchesPage, setFutureMatchesPage] = useState(1);
  const [pastMatchesPage, setPastMatchesPage] = useState(1);
  const [loadingMoreFuture, setLoadingMoreFuture] = useState(false);
  const [loadingMorePast, setLoadingMorePast] = useState(false);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [hasMorePast, setHasMorePast] = useState(true);

  // Estados de dados
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [pastMatches, setPastMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [tempPredictions, setTempPredictions] = useState<Record<string, { home: number; away: number }>>({});
  const [automaticPredictions, setAutomaticPredictions] = useState<Set<string>>(new Set());

  // Estados de UI
  const [savingPredictions, setSavingPredictions] = useState<Set<string>>(new Set());
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Estados de ranking
  const [ranking, setRanking] = useState<RankingParticipant[]>([]);
  const [userRanking, setUserRanking] = useState<RankingParticipant | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);

  // Estados para "Palpite da Galera"
  const [matchParticipants, setMatchParticipants] = useState<Record<string, ParticipantData[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState<Set<string>>(new Set());

  // Estados para Segunda Chance
  const [showSecondChanceModal, setShowSecondChanceModal] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editingPrediction, setEditingPrediction] = useState<{ home: number; away: number } | null>(null);
  const [savingSecondChance, setSavingSecondChance] = useState(false);

  // Hook para inventário de boosters
  const { inventory: boosterInventory, loading: loadingBoosters } = useBoosterInventory();
  
  // Hook para ativações de boosters
  const { 
    activateBooster, 
    isBoosterActive,
    getTimeRemaining
  } = useBoosterActivations();
  
  // Estados para Estatísticas
  const [statistics, setStatistics] = useState<any>({});
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  
  // Estados para modal do Escudo
  const [showShieldModal, setShowShieldModal] = useState(false);
  const [activatingShield, setActivatingShield] = useState(false);

  // Estados para "O Esquecido" booster
  const [forgottenMatches, setForgottenMatches] = useState<Set<string>>(new Set());
  const [activatingBooster, setActivatingBooster] = useState<Set<string>>(new Set());

  // Estados para modal do Palpite Automático
  const [showAutoBetModal, setShowAutoBetModal] = useState(false);
  const [activatingAutoBet, setActivatingAutoBet] = useState(false);

  // Estado para forçar re-render do contador de tempo
  const [timeUpdate, setTimeUpdate] = useState(0);

  // Estado do bolão selecionado
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);


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

  // Função para definir erro de card específico
  const setCardError = (matchId: string, message: string) => {
    setCardErrors(prev => ({
      ...prev,
      [matchId]: message
    }));
  };



  // Função para verificar se uma partida está no estado "esquecido"
  const isForgottenMatch = (match: Match): boolean => {
    const now = new Date();
    const matchTime = new Date(match.start_time);
    const timeDiff = matchTime.getTime() - now.getTime();
    const hoursUntilMatch = timeDiff / (1000 * 60 * 60);
    
    // Condições para "esquecido":
    // 1. Prazo expirado (0 < T ≤ 1h)
    // 2. Usuário não possui palpite
    // 3. Partida ainda não iniciou
    const isPastDeadline = hoursUntilMatch <= 1 && hoursUntilMatch > 0;
    const hasNoPrediction = !predictions[match.id];
    const hasNotStarted = matchTime > now;
    
    return isPastDeadline && hasNoPrediction && hasNotStarted;
  };

  // Função para verificar se usuário pode usar "O Esquecido"
  const canUseForgottenBooster = (match: Match): boolean => {
    const hasForgottenBooster = (boosterInventory['o_esquecido'] || 0) > 0;
    const isForgotten = isForgottenMatch(match);
    const isNotActivating = !activatingBooster.has(match.id);
    
    return hasForgottenBooster && isForgotten && isNotActivating;
  };

  // Função para verificar se um palpite foi criado automaticamente
  const isAutomaticPrediction = async (matchId: string, userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('booster_usages')
        .select('id')
        .eq('match_id', matchId)
        .eq('user_id', userId)
        .eq('booster', 'palpite_automatico')
        .eq('status', 'consumed')
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar palpite automático:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Erro ao verificar palpite automático:', error);
      return false;
    }
  };

  // Função para verificar se o usuário pode ver o botão Segunda Chance
  const canUseSecondChance = (match: any): boolean => {
    if (!userId) return false;
    
    // Verifica se já existe um palpite para esta partida
    const hasPrediction = !!predictions[match.id];
    if (!hasPrediction) return false;
    
    // Verifica se a partida não começou em menos de 10 minutos
    const now = new Date();
    const matchStart = new Date(match.start_time);
    const timeDiff = matchStart.getTime() - now.getTime();
    const minutesUntilStart = Math.floor(timeDiff / (1000 * 60));
    
    return minutesUntilStart > 10;
  };

  // Função para verificar se o usuário tem o booster Segunda Chance
  const hasSegundaChanceBooster = (): boolean => {
    return (boosterInventory['segunda_chance'] || 0) > 0;
  };

  // Função para verificar se o card deve estar travado
  const isCardLocked = (match: Match): boolean => {
    const now = new Date();
    const matchTime = new Date(match.start_time);
    
    // 1. Travar se a partida já iniciou
    if (matchTime <= now) {
      return true;
    }
    
    // 2. Travar se já tem palpite salvo (exceto se pode usar Segunda Chance)
    if (predictions[match.id] && !canUseSecondChance(match)) {
      return true;
    }
    
    // 3. Travar se é uma partida esquecida e não pode usar o booster
    if (isForgottenMatch(match) && !canUseForgottenBooster(match)) {
      return true;
    }
    
    return false;
  };

  // Função para verificar se o usuário tem Escudo ativo para uma partida
  const hasUserShieldActive = (matchId: string): boolean => {
    if (!userId) return false;
    
    const participants = matchParticipants[matchId];
    if (!participants) return false;
    
    const userParticipant = participants.find(p => p.user.id === userId);
    return userParticipant?.hasShield || false;
  };

  // Função para verificar se o Palpite Automático está ativo
  const isAutoBetActive = (): boolean => {
    return isBoosterActive('palpite_automatico');
  };

  // Função para obter tempo restante do Palpite Automático formatado
  const getAutoBetTimeRemaining = (): string => {
    const timeRemaining = getTimeRemaining('palpite_automatico');
    if (!timeRemaining) return '';
    
    const { days, hours, minutes } = timeRemaining;
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Função para calcular tempo restante até o início da partida
  const getMatchTimeRemaining = (match: Match) => {
    const now = new Date();
    const start = new Date(match.start_time);
    const diff = start.getTime() - now.getTime();
    
    if (diff <= 0) return { expired: true, text: "Expirado", color: "text-red-500" };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return { 
        expired: false, 
        text: `${days}d ${hours % 24}h`, 
        color: "text-green-500" 
      };
    } else if (hours >= 1) {
      return { 
        expired: false, 
        text: `${hours}h ${minutes}m`, 
        color: hours >= 24 ? "text-green-500" : "text-yellow-500" 
      };
    } else {
      return { 
        expired: false, 
        text: `${minutes}m`, 
        color: "text-red-500" 
      };
    }
  };

  // Função para ativar o booster "O Esquecido" - TEMPORARIAMENTE DESABILITADA
  const activateForgottenBooster = async (matchId: string) => {
    // TODO: Implementar lógica para múltiplos campeonatos
    console.log('Booster O Esquecido temporariamente desabilitado');
    return;
    // if (!userId) return;
    
    setActivatingBooster(prev => new Set([...prev, matchId]));
    
    try {
      // Consumir o booster atomicamente
      const response = await fetch('/api/boosters/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          booster: 'o_esquecido',
          poolId: selectedPoolId,
          matchId: matchId,
          status: 'consumed'
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        // Adicionar à lista de partidas "esquecidas" ativadas
        setForgottenMatches(prev => new Set([...prev, matchId]));
        
        // Atualizar inventário
        // O hook useBoosterInventory deve atualizar automaticamente via realtime
        
        showToast("success", "Booster 'O Esquecido' ativado! Você pode fazer seu palpite agora.");
      } else {
        showToast("error", result.message || "Erro ao ativar booster");
      }
    } catch (error) {
      console.error('Erro ao ativar booster:', error);
      showToast("error", "Erro ao ativar booster. Tente novamente.");
    } finally {
      setActivatingBooster(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    }
  };

  // Função para ativar o booster "Escudo" - TEMPORARIAMENTE DESABILITADA
  const handleActivateShield = async () => {
    if (!selectedPoolId) {
      showToast("error", "Selecione um bolão primeiro");
      return;
    }

    if (activatingShield) return;

    setActivatingShield(true);
    try {
      const result = await activateBooster("o_escudo", selectedPoolId);
      
      if (result.success) {
        showToast("success", "Escudo ativado com sucesso! Proteção por 7 dias.");
        setShowShieldModal(false);
      } else {
        showToast("error", result.message);
      }
    } catch (error: any) {
      console.error("Erro ao ativar Escudo:", error);
      showToast("error", "Erro ao ativar Escudo");
    } finally {
      setActivatingShield(false);
    }
  };

  // Função para ativar o booster "Palpite Automático"
  const handleActivateAutoBet = async () => {
    if (!selectedPoolId) {
      showToast("error", "Selecione um bolão primeiro");
      return;
    }

    if (activatingAutoBet) return;

    setActivatingAutoBet(true);
    try {
      const result = await activateBooster("palpite_automatico", selectedPoolId);
      
      if (result.success) {
        showToast("success", "Palpite Automático ativado! Proteção por 7 dias.");
        setShowAutoBetModal(false);
      } else {
        showToast("error", result.message);
      }
    } catch (error: any) {
      console.error("Erro ao ativar Palpite Automático:", error);
      showToast("error", "Erro ao ativar Palpite Automático");
    } finally {
      setActivatingAutoBet(false);
    }
  };

  // Função para verificar se campos de palpite devem estar habilitados
  const isPredictionFieldsEnabled = (match: Match): boolean => {
    const now = new Date();
    const matchTime = new Date(match.start_time);
    const timeDiff = matchTime.getTime() - now.getTime();
    const hoursUntilMatch = timeDiff / (1000 * 60 * 60);
    
    // Partida já iniciou - sempre bloqueado
    if (matchTime <= now) {
      return false;
    }
    
    // Dentro do prazo normal (T > 1h) - sempre habilitado
    if (hoursUntilMatch > 1) {
      return true;
    }
    
    // Prazo expirado (0 < T ≤ 1h) - só habilitado se booster foi ativado
    if (hoursUntilMatch <= 1 && hoursUntilMatch > 0) {
      return forgottenMatches.has(match.id);
    }
    
    return false;
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
        const { data: poolsData, error: poolsError } = await supabase
          .from("pool_members")
          .select(`
            pool_id,
            pools!inner(id, name, code, owner_id, championship)
          `)
          .eq("user_id", user.id);

        if (poolsData && poolsData.length > 0) {
          const userPools = poolsData.map(pm => pm.pools).filter(Boolean);
          setPools(userPools);
          
          // Selecionar automaticamente o primeiro pool se nenhum estiver selecionado
          if (userPools.length > 0 && !selectedPoolId) {
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
    // Pré-carregar logos de times do Storage
    refreshTeamLogosFromStorage();
  }, []);

  // Carregar jogos com paginação (15 por página) filtrando pelo campeonato do pool selecionado
  const loadMatches = async (poolId: string, tab: "futuros" | "passados", page: number = 1) => {
    if (!poolId) return;

    setLoadingPage(true);
    
    try {
      const now = new Date().toISOString();
      const offset = (page - 1) * GAMES_PER_PAGE;
      
      // Buscar o pool selecionado para obter o campeonato
      const selectedPool = pools.find(pool => pool.id === poolId);
      if (!selectedPool) return;

      // Buscar todos os pools do mesmo campeonato que o usuário participa
      const championshipPools = pools.filter(pool => pool.championship === selectedPool.championship);
      const championshipPoolIds = championshipPools.map(pool => pool.id);
      
      let query = supabase
        .from("matches")
        .select("*", { count: "exact" })
        .in("pool_id", championshipPoolIds)
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

          // Carregar informações sobre palpites automáticos
          const { data: automaticData } = await supabase
            .from("booster_usages")
            .select("match_id")
            .eq("user_id", userId)
            .eq("booster", "palpite_automatico")
            .eq("status", "consumed")
            .in("match_id", matchIds);

          if (automaticData) {
            const automaticMatchIds = new Set(automaticData.map(usage => usage.match_id));
            setAutomaticPredictions(prev => new Set([...prev, ...automaticMatchIds]));
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar jogos:", error);
      showToast("error", "Erro ao carregar jogos");
    } finally {
      setLoadingPage(false);
    }
  };

  // Mapeamento de campeonatos para códigos de competição
  const championshipToCompetition: Record<string, string> = {
    'Brasileirão Série A': 'BRA-1',
    'Brasileirão Série B': 'BRA-2', 
    'Copa do Brasil': 'BRA-CUP',
    'Libertadores': 'LIBERTADORES',
    'Sul-Americana': 'SULAMERICANA'
  };

  // Função para buscar jogos reais por campeonato
  const getRealMatchesByChampionship = async (championship: string, limit = 20, offset = 0, futureOnly = false) => {
    const competitionCode = championshipToCompetition[championship];
    try {
      // 1) Resolver competição por código mapeado ou por nome (fallback)
      let { data: compByCode } = await supabase
        .from('football_competitions')
        .select('id, code, name')
        .eq('code', competitionCode || '')
        .maybeSingle();

      let competition = compByCode || null;
      if (!competition) {
        const { data: compByName } = await supabase
          .from('football_competitions')
          .select('id, code, name')
          .ilike('name', `%${championship}%`)
          .maybeSingle();
        competition = compByName || null;
      }

      if (!competition) {
        console.log(`⚠️ Competição não encontrada para campeonato: ${championship}`);
        return [];
      }

      // 2) Selecionar última temporada disponível para a competição (evitar ano fixo)
      const { data: seasonRow } = await supabase
        .from('football_seasons')
        .select('id, year')
        .eq('competition_id', competition.id)
        .order('year', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!seasonRow) {
        console.log(`⚠️ Nenhuma temporada encontrada para competição ${competition.code || competitionCode}`);
        return [];
      }

      // 3) Construir query de jogos da temporada
      let query = supabase
        .from('football_matches')
        .select(`
          id,
          start_time,
          status,
          home_score,
          away_score,
          round,
          venue,
          home_team:football_teams!home_team_id(name, short_name, acronym),
          away_team:football_teams!away_team_id(name, short_name, acronym)
        `)
        .eq('season_id', seasonRow.id);

      if (futureOnly) {
        query = query.gte('start_time', new Date().toISOString());
      }

      const { data: matches } = await query
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      return matches || [];
    } catch (error) {
      console.error(`Erro ao buscar jogos para ${championship}:`, error);
      return [];
    }
  };

  // Função para carregar jogos iniciais REAIS da API
  const loadInitialMatches = async () => {
    if (!userId || !selectedPoolId) {
      console.log("loadInitialMatches: userId ou selectedPoolId não definidos", { userId, selectedPoolId });
      return;
    }
    
    console.log("loadInitialMatches: Iniciando carregamento de jogos REAIS", { userId, selectedPoolId });
    setLoadingPage(true);
    
    try {
      const now = new Date().toISOString();
      console.log("loadInitialMatches: Data atual", now);

      // Buscar o pool selecionado para obter o campeonato
      const selectedPool = pools.find(pool => pool.id === selectedPoolId);
      if (!selectedPool) {
        console.log("loadInitialMatches: Pool selecionado não encontrado");
        return;
      }

      console.log("loadInitialMatches: Pool selecionado", { pool: selectedPool.name, championship: selectedPool.championship });

      // Carregar jogos REAIS futuros do campeonato
      const futureRealMatches = await getRealMatchesByChampionship(selectedPool.championship, GAMES_PER_PAGE, 0, true);
      console.log("loadInitialMatches: Jogos REAIS futuros carregados", { count: futureRealMatches.length });
      
      // Carregar jogos REAIS passados do campeonato
      const allRealMatches = await getRealMatchesByChampionship(selectedPool.championship, GAMES_PER_PAGE * 2, 0, false);
      const pastRealMatches = allRealMatches
        .filter(match => new Date(match.start_time) < new Date())
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(0, GAMES_PER_PAGE);
      
      console.log("loadInitialMatches: Jogos REAIS passados carregados", { count: pastRealMatches.length });
      
      // Transformar jogos reais para o formato esperado pela interface
      const transformRealMatch = (realMatch: any) => ({
        id: realMatch.id,
        home_team: realMatch.home_team?.name || realMatch.home_team?.short_name || 'Time A',
        away_team: realMatch.away_team?.name || realMatch.away_team?.short_name || 'Time B',
        start_time: realMatch.start_time,
        status: realMatch.status,
        home_score: realMatch.home_score,
        away_score: realMatch.away_score,
        round: realMatch.round,
        venue: realMatch.venue,
        pool_id: selectedPoolId, // Associar ao pool atual para compatibilidade
        is_real_match: true // Flag para identificar jogos reais
      });

      const transformedFutureMatches = futureRealMatches.map(transformRealMatch);
      const transformedPastMatches = pastRealMatches.map(transformRealMatch);
      
      setFutureMatches(transformedFutureMatches);
      setPastMatches(transformedPastMatches);
      
      // Verificar se há mais jogos (sempre assumir que sim para jogos reais)
      setHasMoreFuture(futureRealMatches.length === GAMES_PER_PAGE);
      setHasMorePast(pastRealMatches.length === GAMES_PER_PAGE);
      
      // Carregar palpites do usuário para os jogos reais
      const allMatchIds = [...transformedFutureMatches, ...transformedPastMatches].map(m => m.id);
      if (allMatchIds.length > 0) {
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .in('match_id', allMatchIds);

        if (predictionsData) {
          const predictionsMap = predictionsData.reduce((acc, pred) => {
            acc[pred.match_id] = pred;
            return acc;
          }, {} as Record<string, Prediction>);
          
          setPredictions(predictionsMap);

          // Carregar informações sobre palpites automáticos
          const { data: automaticData } = await supabase
            .from("booster_usages")
            .select("match_id")
            .eq("user_id", userId)
            .eq("booster", "palpite_automatico")
            .eq("status", "consumed")
            .in("match_id", allMatchIds);

          if (automaticData) {
            const automaticMatchIds = new Set(automaticData.map(usage => usage.match_id));
            setAutomaticPredictions(automaticMatchIds);
          }
        }
      }

      console.log("✅ Jogos REAIS carregados com sucesso!", {
        championship: selectedPool.championship,
        futureCount: transformedFutureMatches.length,
        pastCount: transformedPastMatches.length
      });

    } catch (error) {
      console.error("Erro ao carregar jogos REAIS:", error);
      showToast("error", "Erro ao carregar jogos reais");
    } finally {
      setLoadingPage(false);
    }
  };

  // Função para carregar mais jogos futuros REAIS
  const loadMoreFutureMatches = async () => {
    if (!userId || loadingMoreFuture || !hasMoreFuture || !selectedPoolId) return;
    
    setLoadingMoreFuture(true);
    
    try {
      const nextPage = futureMatchesPage + 1;
      const offset = (nextPage - 1) * GAMES_PER_PAGE;
      
      // Buscar o pool selecionado para obter o campeonato
      const selectedPool = pools.find(pool => pool.id === selectedPoolId);
      if (!selectedPool) return;

      // Carregar mais jogos REAIS futuros do campeonato
      const moreRealMatches = await getRealMatchesByChampionship(selectedPool.championship, GAMES_PER_PAGE, offset, true);
      
      if (moreRealMatches && moreRealMatches.length > 0) {
        // Transformar jogos reais para o formato esperado
        const transformRealMatch = (realMatch: any) => ({
          id: realMatch.id,
          home_team: realMatch.home_team?.name || realMatch.home_team?.short_name || 'Time A',
          away_team: realMatch.away_team?.name || realMatch.away_team?.short_name || 'Time B',
          start_time: realMatch.start_time,
          status: realMatch.status,
          home_score: realMatch.home_score,
          away_score: realMatch.away_score,
          round: realMatch.round,
          venue: realMatch.venue,
          pool_id: selectedPoolId,
          is_real_match: true
        });

        const transformedMatches = moreRealMatches.map(transformRealMatch);
        
        setFutureMatches(prev => [...prev, ...transformedMatches]);
        setFutureMatchesPage(nextPage);
        setHasMoreFuture(moreRealMatches.length === GAMES_PER_PAGE);
        
        // Carregar palpites dos novos jogos
        const newMatchIds = transformedMatches.map(m => m.id);
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .in('match_id', newMatchIds);
        
        const newPredictions: Record<string, Prediction> = {};
        (predictionsData || []).forEach(pred => {
          newPredictions[pred.match_id] = pred;
        });
        setPredictions(prev => ({ ...prev, ...newPredictions }));

        // Carregar informações sobre palpites automáticos
        const { data: automaticData } = await supabase
          .from("booster_usages")
          .select("match_id")
          .eq("user_id", userId)
          .eq("booster", "palpite_automatico")
          .eq("status", "consumed")
          .in("match_id", newMatchIds);

        if (automaticData) {
          const automaticMatchIds = new Set(automaticData.map(usage => usage.match_id));
          setAutomaticPredictions(prev => new Set([...prev, ...automaticMatchIds]));
        }
      } else {
        setHasMoreFuture(false);
      }
    } catch (error) {
      console.error("Erro ao carregar mais jogos REAIS futuros:", error);
      showToast("error", "Erro ao carregar mais jogos reais");
    } finally {
      setLoadingMoreFuture(false);
    }
  };

  // Função para carregar mais jogos passados REAIS
  const loadMorePastMatches = async () => {
    if (!userId || loadingMorePast || !hasMorePast || !selectedPoolId) return;
    
    setLoadingMorePast(true);
    
    try {
      const nextPage = pastMatchesPage + 1;
      const offset = (nextPage - 1) * GAMES_PER_PAGE;
      
      // Buscar o pool selecionado para obter o campeonato
      const selectedPool = pools.find(pool => pool.id === selectedPoolId);
      if (!selectedPool) return;

      // Carregar mais jogos REAIS passados do campeonato
      const allRealMatches = await getRealMatchesByChampionship(selectedPool.championship, GAMES_PER_PAGE * (nextPage + 1), 0, false);
      const pastRealMatches = allRealMatches
        .filter(match => new Date(match.start_time) < new Date())
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        .slice(offset, offset + GAMES_PER_PAGE);
      
      if (pastRealMatches && pastRealMatches.length > 0) {
        // Transformar jogos reais para o formato esperado
        const transformRealMatch = (realMatch: any) => ({
          id: realMatch.id,
          home_team: realMatch.home_team?.name || realMatch.home_team?.short_name || 'Time A',
          away_team: realMatch.away_team?.name || realMatch.away_team?.short_name || 'Time B',
          start_time: realMatch.start_time,
          status: realMatch.status,
          home_score: realMatch.home_score,
          away_score: realMatch.away_score,
          round: realMatch.round,
          venue: realMatch.venue,
          pool_id: selectedPoolId,
          is_real_match: true
        });

        const transformedMatches = pastRealMatches.map(transformRealMatch);
        
        setPastMatches(prev => [...prev, ...transformedMatches]);
        setPastMatchesPage(nextPage);
        setHasMorePast(pastRealMatches.length === GAMES_PER_PAGE);
        
        // Carregar palpites dos novos jogos
        const newMatchIds = transformedMatches.map(m => m.id);
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .in('match_id', newMatchIds);
        
        const newPredictions: Record<string, Prediction> = {};
        (predictionsData || []).forEach(pred => {
          newPredictions[pred.match_id] = pred;
        });
        setPredictions(prev => ({ ...prev, ...newPredictions }));

        // Carregar informações sobre palpites automáticos
        const { data: automaticData } = await supabase
          .from("booster_usages")
          .select("match_id")
          .eq("user_id", userId)
          .eq("booster", "palpite_automatico")
          .eq("status", "consumed")
          .in("match_id", newMatchIds);

        if (automaticData) {
          const automaticMatchIds = new Set(automaticData.map(usage => usage.match_id));
          setAutomaticPredictions(prev => new Set([...prev, ...automaticMatchIds]));
        }
      } else {
        setHasMorePast(false);
      }
    } catch (error) {
      console.error("Erro ao carregar mais jogos passados:", error);
      showToast("error", "Erro ao carregar mais jogos");
    } finally {
      setLoadingMorePast(false);
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

  // Efeito para selecionar primeiro bolão quando pools carregam
  useEffect(() => {
    if (pools.length > 0 && !selectedPoolId) {
      setSelectedPoolId(pools[0].id);
    }
  }, [pools, selectedPoolId]);

  // Efeito para carregar jogos quando bolão selecionado muda
  useEffect(() => {
    if (userId && selectedPoolId) {
      // Reset pagination when pool changes
      setFutureMatchesPage(1);
      setPastMatchesPage(1);
      setFutureMatches([]);
      setPastMatches([]);
      setHasMoreFuture(true);
      setHasMorePast(true);
      
      loadInitialMatches();
    }
  }, [selectedPoolId, userId]);

  // Efeito para verificar partidas iniciadas e revelar palpites automaticamente
  useEffect(() => {
    const allMatches = activeTab === "futuros" ? futureMatches : pastMatches;
    if (!allMatches.length) return;

    const checkMatchesStarted = () => {
      const now = new Date();
      let shouldUpdateParticipants = false;

      allMatches.forEach(match => {
        const matchStarted = new Date(match.start_time) <= now;
        const hasParticipants = matchParticipants[match.id];
        
        // Se a partida começou e temos participantes carregados, verificar se precisa atualizar
        if (matchStarted && hasParticipants) {
          const hasProtectedParticipants = hasParticipants.some(p => p.hasShield);
          if (hasProtectedParticipants) {
            shouldUpdateParticipants = true;
          }
        }
      });

      // Se encontrou partidas que começaram com participantes protegidos, recarregar
      if (shouldUpdateParticipants) {
        allMatches.forEach(match => {
          const matchStarted = new Date(match.start_time) <= now;
          if (matchStarted && matchParticipants[match.id]) {
            loadMatchParticipants(match.id, match.pool_id);
          }
        });
      }
    };

    // Verificar imediatamente
    checkMatchesStarted();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkMatchesStarted, 30000);

    return () => clearInterval(interval);
  }, [futureMatches, pastMatches, activeTab, matchParticipants]);

  // Timer para atualizar contador de tempo a cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUpdate(prev => prev + 1);
    }, 60000); // Atualiza a cada minuto

    return () => clearInterval(timer);
  }, []);

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
    } catch (error: any) {
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

  // Função para abrir modal de Segunda Chance
  const openSecondChanceModal = (match: Match) => {
    const currentPrediction = predictions[match.id];
    if (!currentPrediction) return;

    // Se o usuário não tem o booster, redireciona para a página de boosters
    if (!hasSegundaChanceBooster()) {
      window.location.href = '/boosters';
      return;
    }

    setEditingMatch(match);
    setEditingPrediction({
      home: currentPrediction.home_pred,
      away: currentPrediction.away_pred
    });
    setShowSecondChanceModal(true);
  };

  // Função para salvar palpite editado com Segunda Chance
  const saveSecondChancePrediction = async () => {
    if (!editingMatch || !editingPrediction || !userId) return;

    setSavingSecondChance(true);

    try {
      const response = await fetch(`/api/pools/${editingMatch.pool_id}/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id: editingMatch.id,
          home_pred: editingPrediction.home,
          away_pred: editingPrediction.away,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Erro ao atualizar palpite');
      }

      // Atualizar estado local
      setPredictions(prev => ({
        ...prev,
        [editingMatch.id]: {
          match_id: editingMatch.id,
          user_id: userId,
          home_pred: editingPrediction.home,
          away_pred: editingPrediction.away,
          created_at: new Date().toISOString(),
        }
      }));

      // Fechar modal
      setShowSecondChanceModal(false);
      setEditingMatch(null);
      setEditingPrediction(null);

      showToast("success", "Palpite atualizado com sucesso! Foi consumida uma unidade do seu booster 'Segunda Chance'.");
    } catch (error: any) {
      console.error("Erro ao usar Segunda Chance:", error);
      showToast("error", error.message || "Erro ao atualizar palpite");
    } finally {
      setSavingSecondChance(false);
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

  // Função para carregar participantes de um jogo específico
  const loadMatchParticipants = async (matchId: string, poolId: string) => {
    if (!poolId || loadingParticipants.has(matchId)) return;
    
    setLoadingParticipants(prev => new Set([...prev, matchId]));
    
    try {
      // Buscar todos os membros do bolão com perfis
      const { data: membersData } = await supabase
        .from('pool_members')
        .select(`
          user_id,
          profiles!inner(id, display_name, avatar_url)
        `)
        .eq('pool_id', poolId);
      
      // Buscar palpites de todos os membros para este jogo
      const { data: allPredictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId);

      // Buscar ativações do Escudo para este bolão
      const { data: shieldActivations } = await supabase
        .from('booster_activations')
        .select('user_id, expires_at')
        .eq('pool_id', poolId)
        .eq('booster_id', 'o_escudo')
        .gte('expires_at', new Date().toISOString());

      // Buscar informações da partida REAL para verificar se já começou
      const allMatches = [...futureMatches, ...pastMatches];
      const matchData = allMatches.find(match => match.id === matchId);

      const matchStarted = matchData ? new Date(matchData.start_time) <= new Date() : false;
      
      // Processar dados dos participantes
      const participants: ParticipantData[] = (membersData || []).map(member => {
        const prediction = (allPredictions || []).find(p => p.user_id === member.user_id);
        const hasActiveShield = (shieldActivations || []).some(activation => 
          activation.user_id === member.user_id && new Date(activation.expires_at) > new Date()
        );
        
        // Se o usuário tem Escudo ativo e a partida não começou, ocultar o palpite
        const shouldHidePrediction = hasActiveShield && !matchStarted && member.user_id !== userId;
        
        return {
          user: member.profiles,
          prediction: (prediction && !shouldHidePrediction) ? {
            home_pred: prediction.home_pred,
            away_pred: prediction.away_pred
          } : undefined,
          hasPredicted: !!prediction,
          hasShield: hasActiveShield
        };
      });
      
      setMatchParticipants(prev => ({
        ...prev,
        [matchId]: participants
      }));
    } catch (error) {
      console.error("Erro ao carregar participantes:", error);
      setCardError(matchId, "Erro ao carregar palpites da galera. Tente novamente.");
    } finally {
      setLoadingParticipants(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    }
  };

  // Definição completa dos boosters disponíveis no sistema
  const availableBoosters = [
    { 
      id: 'o_esquecido', 
      name: "O Esquecido", 
      type: "automatic", 
      description: "Permite inserir palpite até T-15 (janela estendida após T-60)",
      quantity: boosterInventory['o_esquecido'] || 0, 
      icon: "⏰" 
    },
    { 
      id: 'segunda_chance', 
      name: "Segunda Chance", 
      type: "retry", 
      description: "Permite alterar um palpite já feito até o início (T0)",
      quantity: boosterInventory['segunda_chance'] || 0, 
      icon: "🔄" 
    },
    { 
      id: 'palpite_automatico', 
      name: "Palpite Automático", 
      type: "auto", 
      description: "Rede de segurança por 7 dias - insere palpite 2x0 automaticamente se esquecer",
      quantity: boosterInventory['palpite_automatico'] || 0, 
      icon: "🤖" 
    },
    { 
      id: 'o_escudo', 
      name: "Escudo", 
      type: "protection", 
      description: "Protege palpites por 7 dias corridos a partir da ativação",
      quantity: boosterInventory['o_escudo'] || 0, 
      icon: "🛡️" 
    }
  ];

  // Função para carregar estatísticas do usuário
  const loadStatistics = async (poolId: string) => {
    if (!poolId || !userId) return;
    
    setLoadingStatistics(true);
    try {
      // Buscar estatísticas reais do usuário no bolão
      const { data: userStats } = await supabase
        .from('pool_members')
        .select('points, position')
        .eq('pool_id', poolId)
        .eq('user_id', userId)
        .single();

      // Buscar total de palpites do usuário
      const { count: totalPredictions } = await supabase
        .from('predictions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('pool_id', poolId);

      // Buscar palpites corretos
      const { count: correctPredictions } = await supabase
        .from('predictions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('pool_id', poolId)
        .not('points', 'is', null)
        .gt('points', 0);

      const stats = {
        points: userStats?.points || 0,
        position: userStats?.position || 0,
        totalPredictions: totalPredictions || 0,
        correctPredictions: correctPredictions || 0,
        accuracy: totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0
      };

      setStatistics(stats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      showToast("error", "Erro ao carregar estatísticas");
    } finally {
      setLoadingStatistics(false);
    }
  };

  // Função para calcular palpites mais comuns
  const getMostCommonPredictions = (participants: ParticipantData[], matchStarted: boolean = false): ScoreCount[] => {
    const scoreMap: Record<string, number> = {};
    
    participants.forEach(participant => {
      // Se a partida não começou e o usuário tem Escudo ativo, não incluir o palpite
      if (!matchStarted && participant.hasShield) {
        return;
      }
      
      if (participant.prediction) {
        const score = `${participant.prediction.home_pred}-${participant.prediction.away_pred}`;
        scoreMap[score] = (scoreMap[score] || 0) + 1;
      }
    });
    
    return Object.entries(scoreMap)
      .map(([score, count]) => {
        const [home_score, away_score] = score.split('-').map(Number);
        return { home_score, away_score, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 palpites mais comuns
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

    // Partida finalizada
    if (match.home_score !== null && match.away_score !== null) {
      return {
        borderColor: 'border-blue-500/40',
        bgGradient: 'from-blue-500/10 to-blue-500/5',
        glowEffect: 'shadow-blue-500/20'
      };
    }

    // Partida já iniciada
    if (hoursUntilMatch <= 0) {
      return {
        borderColor: 'border-red-500/40',
        bgGradient: 'from-red-500/10 to-red-500/5',
        glowEffect: 'shadow-red-500/20'
      };
    }

    // Booster "O Esquecido" ativado para esta partida
    if (forgottenMatches.has(match.id)) {
      return {
        borderColor: 'border-purple-500/60',
        bgGradient: 'from-purple-500/20 to-purple-500/10',
        glowEffect: 'shadow-purple-500/30'
      };
    }

    // Partida "esquecida" - pode usar "O Esquecido"
    if (isForgottenMatch(match) && canUseForgottenBooster(match)) {
      return {
        borderColor: 'border-orange-500/60',
        bgGradient: 'from-orange-500/20 to-orange-500/10',
        glowEffect: 'shadow-orange-500/30'
      };
    }

    // Prazo expirado (1 hora antes) sem booster disponível
    if (hoursUntilMatch <= 1 && !hasPrediction) {
      return {
        borderColor: 'border-red-500/40',
        bgGradient: 'from-red-500/10 to-red-500/5',
        glowEffect: 'shadow-red-500/20'
      };
    }

    // Prazo próximo do vencimento (1 hora antes)
    if (hoursUntilMatch <= 1) {
      return {
        borderColor: 'border-yellow-500/40',
        bgGradient: 'from-yellow-500/10 to-yellow-500/5',
        glowEffect: 'shadow-yellow-500/20'
      };
    }

    // Palpite já realizado
    if (hasPrediction) {
      return {
        borderColor: 'border-green-500/30',
        bgGradient: 'from-green-500/5 to-green-500/2',
        glowEffect: 'shadow-green-500/10'
      };
    }

    // Estado padrão
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
  const hasMore = activeTab === "futuros" ? hasMoreFuture : hasMorePast;
  const loadingMore = activeTab === "futuros" ? loadingMoreFuture : loadingMorePast;
  const loadMoreFunction = activeTab === "futuros" ? loadMoreFutureMatches : loadMorePastMatches;

  // Log para debug
  console.log("Renderização - Estado atual:", {
    activeTab,
    futureMatchesCount: futureMatches.length,
    pastMatchesCount: pastMatches.length,
    currentMatchesCount: currentMatches.length,
    loadingPage,
    hasMore,
    loadingMore
  });

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

              {/* Seletor de Bolões - Baseado no padrão funcional da página ranking */}
              <div className="flex flex-col sm:flex-row gap-4">
                {pools.length > 1 ? (
                  <div className="flex items-center gap-3">
                    <label htmlFor="pool-select" className="text-sm text-white/80 font-medium">Bolão:</label>
                    <select
                      id="pool-select"
                      aria-label="Selecionar bolão"
                      className="bg-white/10 backdrop-blur-sm text-white text-sm rounded-xl px-4 py-3 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:bg-white/20 transition-all duration-200 min-w-[280px]"
                      value={selectedPoolId || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedPoolId(id || null);
                        try { 
                          window.localStorage.setItem("last_pool_id", id); 
                        } catch {}
                      }}
                    >
                      <option value="" disabled>Selecione um bolão</option>
                      {pools.map((pool) => (
                        <option key={pool.id} value={pool.id} className="bg-slate-800 text-white">
                          {pool.name} - {pool.championship}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : pools.length === 1 ? (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <div>
                      <span className="text-white font-medium">{pools[0].name}</span>
                      <span className="text-white/60 text-sm ml-2">- {pools[0].championship}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-white/60 text-sm">
                    Carregando bolões...
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
              {/* Abas modernas com separação visual clara */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActiveTab("futuros");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-300 rounded-xl relative overflow-hidden ${
                      activeTab === "futuros"
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg transform scale-[1.02] shadow-blue-500/25"
                        : "text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
                    }`}
                  >
                    {activeTab === "futuros" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 animate-pulse"></div>
                    )}
                    <div className="relative flex items-center justify-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>Jogos Futuros</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        activeTab === "futuros" 
                          ? "bg-white/20 text-white" 
                          : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {futureMatches.length}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${
                      activeTab === "futuros" ? "text-white/80" : "text-white/40"
                    }`}>
                      Faça seus palpites
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setActiveTab("passados");
                      setCurrentPage(1);
                    }}
                    className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-300 rounded-xl relative overflow-hidden ${
                      activeTab === "passados"
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg transform scale-[1.02] shadow-green-500/25"
                        : "text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
                    }`}
                  >
                    {activeTab === "passados" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 animate-pulse"></div>
                    )}
                    <div className="relative flex items-center justify-center space-x-2">
                      <Trophy className="h-5 w-5" />
                      <span>Jogos Passados</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        activeTab === "passados" 
                          ? "bg-white/20 text-white" 
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {pastMatches.length}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${
                      activeTab === "passados" ? "text-white/80" : "text-white/40"
                    }`}>
                      Veja seus pontos
                    </div>
                  </button>
                </div>
              </div>

              {/* Botão Carregar Mais */}
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMoreFunction}
                    disabled={loadingMore}
                    className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
                  >
                    {/* Efeito shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    
                    <div className="relative flex items-center gap-3">
                      {loadingMore ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Carregando...</span>
                        </>
                      ) : (
                        <>
                          <span>Carregar mais jogos</span>
                          <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform duration-200" />
                        </>
                      )}
                    </div>
                  </button>
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
                      const timeRemaining = getMatchTimeRemaining(match);
                      const currentPred = getCurrentPrediction(match.id);
                      const isModified = isPredictionModified(match.id);
                      const isSaving = savingPredictions.has(match.id);
                      const cardError = cardErrors[match.id];

                      return (
                        <div
                          key={match.id}
                          className={`bg-gradient-to-br ${visualState.bgGradient} backdrop-blur-sm rounded-xl p-4 border ${visualState.borderColor} ${visualState.glowEffect} hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-4 group`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {/* Header com Status e Tempo */}
                          <div className="flex items-center justify-between mb-4">
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
                          <div className="flex items-center justify-between mb-4">
                            {/* Time da Casa */}
                            <div className="flex items-center gap-2 sm:gap-3 flex-1">
                              <div className="relative group-hover:scale-110 transition-transform duration-300">
                                <img
                                  src={getTeamLogo(match.home_team)}
                                  alt={match.home_team}
                                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                                />
                              </div>
                              <div>
                                <h3 className="font-bold text-sm sm:text-lg text-white">{match.home_team}</h3>
                                <p className="text-white/60 text-xs sm:text-sm">Casa</p>
                              </div>
                            </div>

                            {/* Placar ou VS */}
                            <div className="flex items-center justify-center px-3 sm:px-6">
                              {match.home_score !== null && match.away_score !== null ? (
                                <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg px-3 sm:px-6 py-2 sm:py-3 border border-white/20">
                                  <div className="flex items-center gap-2 sm:gap-4 text-lg sm:text-2xl font-bold">
                                    <span className="text-white">{match.home_score}</span>
                                    <span className="text-white/40">×</span>
                                    <span className="text-white">{match.away_score}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-white/10 rounded-lg px-3 py-1.5 border border-white/20">
                                  <span className="text-white/60 font-medium text-sm">VS</span>
                                </div>
                              )}
                            </div>

                            {/* Time Visitante */}
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                              <div className="text-right">
                                <h3 className="font-bold text-sm sm:text-lg text-white">{match.away_team}</h3>
                                <p className="text-white/60 text-xs sm:text-sm">Visitante</p>
                              </div>
                              <div className="relative group-hover:scale-110 transition-transform duration-300">
                                <img
                                  src={getTeamLogo(match.away_team)}
                                  alt={match.away_team}
                                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Data e Hora */}
                          <div className="text-center mb-4">
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
                          {activeTab === "futuros" && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              {/* Alerta do Booster "O Esquecido" */}
                              {isForgottenMatch(match) && canUseForgottenBooster(match) && (
                                <div className="mb-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 rounded-xl p-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <AlertTriangle className="w-6 h-6 text-orange-400" />
                                    <div>
                                      <h5 className="text-orange-400 font-bold text-lg">⚠️ Palpite Esquecido!</h5>
                                      <p className="text-orange-300 text-sm">O prazo expirou, mas você ainda pode palpitar!</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-orange-300 text-sm">
                                      <p>Tempo restante para usar "O Esquecido":</p>
                                      <p className="font-bold text-orange-400">{getMatchTimeRemaining(match).text}</p>
                                    </div>
                                    <div className="text-right text-orange-300 text-sm">
                                      <p>Boosters disponíveis:</p>
                                      <p className="font-bold text-orange-400">{boosterInventory?.forgotten || 0}</p>
                                    </div>
                                  </div>
                                  
                                  <button
                                    onClick={() => activateForgottenBooster(match.id)}
                                    disabled={activatingBooster}
                                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold text-white transition-all duration-200 shadow-lg hover:shadow-orange-500/25 flex items-center justify-center gap-2"
                                  >
                                    {activatingBooster ? (
                                      <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Ativando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-5 h-5" />
                                        <span>Realizar Palpite!</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}

                              <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-400" />
                                Seu Palpite
                                {isCardLocked(match) && (
                                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs font-bold border border-red-500/40 flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Travado
                                  </span>
                                )}
                                {forgottenMatches.has(match.id) && (
                                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full text-xs font-bold border border-purple-500/40">
                                    "O Esquecido" Ativo
                                  </span>
                                )}
                                {hasUserShieldActive(match.id) && (
                                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-bold border border-blue-500/40 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Protegido pelo Escudo
                                  </span>
                                )}
                              </h4>
                              
                              {!isCardLocked(match) && isPredictionFieldsEnabled(match) ? (
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
                              ) : (
                                <div className="text-center py-4">
                                  <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                      <Lock className="w-4 h-4 text-red-400" />
                                      <span className="text-red-400 font-medium text-sm">Card Travado</span>
                                    </div>
                                    <p className="text-red-300 text-xs mb-3">
                                      {new Date(match.start_time) <= new Date() 
                                        ? "A partida já começou" 
                                        : predictions[match.id] && !canUseSecondChance(match)
                                        ? "Palpite já salvo"
                                        : isForgottenMatch(match) && !canUseForgottenBooster(match)
                                        ? "Partida esquecida"
                                        : "Prazo expirado"
                                      }
                                    </p>
                                    
                                    {/* Botão de Reabertura Automática */}
                                    {predictions[match.id] && new Date(match.start_time) > new Date() && (
                                      <button
                                        onClick={() => openSecondChanceModal(match)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-xs font-medium mx-auto ${
                                          hasSegundaChanceBooster() 
                                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600" 
                                            : "bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 border border-orange-500/30"
                                        }`}
                                      >
                                        <span className="text-sm">{hasSegundaChanceBooster() ? "🔄" : "🛒"}</span>
                                        {hasSegundaChanceBooster() ? "Reabrir Palpite" : "Comprar Segunda Chance"}
                                      </button>
                                    )}
                                    
                                    {isForgottenMatch(match) && (
                                      <button
                                        onClick={() => {
                                          if (canUseForgottenBooster(match)) {
                                            activateForgottenBooster(match.id);
                                          } else {
                                            router.push('/boosters');
                                          }
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-xs font-medium mx-auto ${
                                          canUseForgottenBooster(match)
                                            ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700"
                                            : "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800"
                                        }`}
                                      >
                                        <span className="text-sm">{canUseForgottenBooster(match) ? "⏰" : "🛒"}</span>
                                        {canUseForgottenBooster(match) ? "Usar 'O Esquecido'" : "Comprar 'O Esquecido'"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

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
                                  <span className="font-medium">
                                    {automaticPredictions.has(match.id) ? "Palpite Automático:" : "Palpite Salvo:"}
                                  </span>
                                  {automaticPredictions.has(match.id) && (
                                    <div className="bg-blue-500/20 px-2 py-1 rounded-md flex items-center gap-1">
                                      <span className="text-blue-400 text-xs font-bold">A</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-lg">
                                  <span className="text-green-400 font-bold text-lg">{predictions[match.id].home_pred}</span>
                                  <span className="text-white/50">×</span>
                                  <span className="text-green-400 font-bold text-lg">{predictions[match.id].away_pred}</span>
                                </div>
                              </div>

                              {/* Exibição de Pontos para Jogos Passados */}
                              {activeTab === "passados" && match.home_score !== null && match.away_score !== null && (
                                <div className="mt-4 pt-4 border-t border-green-500/20">
                                  {(() => {
                                    const prediction = predictions[match.id];
                                    let points = 0;
                                    let resultType = "";
                                    let resultColor = "";
                                    let resultIcon = null;
                                    
                                    if (prediction) {
                                      // Acerto exato
                                      if (prediction.home_pred === match.home_score && prediction.away_pred === match.away_score) {
                                        points = 10;
                                        resultType = "Placar Exato!";
                                        resultColor = "text-yellow-400";
                                        resultIcon = <Trophy className="w-5 h-5 text-yellow-400" />;
                                      }
                                      // Acerto do resultado (vitória/empate/derrota)
                                      else if (
                                        Math.sign(prediction.home_pred - prediction.away_pred) === 
                                        Math.sign(match.home_score - match.away_score)
                                      ) {
                                        points = 5;
                                        resultType = "Resultado Correto";
                                        resultColor = "text-blue-400";
                                        resultIcon = <CheckCircle className="w-5 h-5 text-blue-400" />;
                                      }
                                      // Acerto parcial (gols de um dos times)
                                      else if (
                                        prediction.home_pred === match.home_score || 
                                        prediction.away_pred === match.away_score
                                      ) {
                                        points = 3;
                                        resultType = "Acerto Parcial";
                                        resultColor = "text-orange-400";
                                        resultIcon = <Target className="w-5 h-5 text-orange-400" />;
                                      }
                                      // Errou
                                      else {
                                        points = 0;
                                        resultType = "Não pontuou";
                                        resultColor = "text-gray-400";
                                        resultIcon = <X className="w-5 h-5 text-gray-400" />;
                                      }
                                    }

                                    return (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          {resultIcon}
                                          <div>
                                            <p className={`font-bold ${resultColor}`}>{resultType}</p>
                                            <p className="text-white/60 text-sm">
                                              {points > 0 ? `Você ganhou ${points} pontos` : "Nenhum ponto ganho"}
                                            </p>
                                          </div>
                                        </div>
                                        <div className={`text-right ${
                                          points >= 10 ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40" :
                                          points >= 5 ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/40" :
                                          points >= 3 ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40" :
                                          "bg-gray-500/20 border border-gray-500/40"
                                        } px-4 py-2 rounded-lg`}>
                                          <div className={`text-2xl font-bold ${resultColor}`}>
                                            +{points}
                                          </div>
                                          <div className="text-white/60 text-xs">pontos</div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              
                              {/* Botão Segunda Chance */}
                              {canUseSecondChance(match) && (
                                <div className="mt-3 flex justify-center">
                                  <button
                                    onClick={() => openSecondChanceModal(match)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                                      hasSegundaChanceBooster() 
                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600" 
                                        : "bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 border border-orange-500/30"
                                    }`}
                                  >
                                    <span className="text-lg">{hasSegundaChanceBooster() ? "🔄" : "🛒"}</span>
                                    {hasSegundaChanceBooster() ? "Segunda Chance" : "Comprar Segunda Chance"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Palpite da Galera */}
                          {predictions[match.id] && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 mt-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-white font-medium flex items-center gap-2">
                                  <Users className="w-4 h-4 text-purple-400" />
                                  Palpite da Galera
                                </h4>
                                <button
                                  onClick={() => {
                                    if (!matchParticipants[match.id]) {
                                      loadMatchParticipants(match.id, match.pool_id);
                                    }
                                  }}
                                  disabled={loadingParticipants.has(match.id)}
                                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600/50 disabled:to-gray-700/50 text-white font-medium px-4 py-2.5 rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:transform-none disabled:opacity-60 shadow-lg hover:shadow-blue-500/25 min-w-[120px] flex items-center justify-center gap-2"
                                >
                                  {/* Shimmer effect */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                  
                                  {loadingParticipants.has(match.id) ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      <span className="text-sm">Carregando...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-4 h-4 transition-transform group-hover:scale-110" />
                                      <span className="text-sm font-semibold">Ver Palpites</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {loadingParticipants.has(match.id) ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : matchParticipants[match.id] ? (
                                <div className="space-y-4">
                                  {/* Estatísticas */}
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-white/60">
                                      {matchParticipants[match.id].filter(p => p.hasPredicted).length} de{" "}
                                      {matchParticipants[match.id].length} participantes palpitaram
                                    </span>
                                  </div>

                                  {/* Palpites mais comuns */}
                                  {(() => {
                                    const now = new Date();
                                    const matchStarted = new Date(match.start_time) <= now;
                                    const commonPredictions = getMostCommonPredictions(matchParticipants[match.id], matchStarted);
                                    return commonPredictions.length > 0 ? (
                                      <div>
                                        <h5 className="text-white/80 text-sm font-medium mb-2">Palpites mais comuns:</h5>
                                        <div className="space-y-2">
                                          {commonPredictions.map((pred, index) => (
                                            <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-white font-medium">
                                                  {pred.home_score} × {pred.away_score}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-purple-400 text-sm">{pred.count} pessoa{pred.count > 1 ? 's' : ''}</span>
                                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-white/60 text-sm text-center py-2">
                                        Nenhum palpite disponível ainda
                                      </p>
                                    );
                                  })()}

                                  {/* Lista de participantes */}
                                  <div>
                                    <h5 className="text-white/80 text-sm font-medium mb-2">Participantes:</h5>
                                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                      {matchParticipants[match.id]
                                        .sort((a, b) => (b.hasPredicted ? 1 : 0) - (a.hasPredicted ? 1 : 0))
                                        .map((participant, index) => (
                                          <div key={index} className="flex items-center gap-2 text-sm">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
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
                                            <span className={`truncate ${participant.hasPredicted ? 'text-white' : 'text-white/50'}`}>
                                              {participant.user.display_name || "Usuário"}
                                            </span>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              {participant.hasShield && (
                                                <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center" title="Protegido pelo Escudo">
                                                  <Shield className="w-2 h-2 text-white" />
                                                </div>
                                              )}
                                              {participant.hasPredicted && (
                                                <Check className="w-3 h-3 text-green-400" />
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Sidebar com Inventário, Estatísticas e Ranking */}
            <div className="lg:col-span-1 space-y-6">
              {/* Seção Inventário de Boosters */}
              <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-lg">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Inventário de Boosters</h2>
                    <p className="text-white/60 text-sm">Seus poderes especiais</p>
                  </div>
                </div>

                {/* Contador do Palpite Automático */}
                {isAutoBetActive() && (
                  <div className="mb-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-sm">
                        🤖
                      </div>
                      <div>
                        <h3 className="text-green-400 font-medium text-sm">Palpite Automático Ativo</h3>
                        <p className="text-green-300/80 text-xs">Tempo restante: {getAutoBetTimeRemaining()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {loadingBoosters ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/10 rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-white/10 rounded w-3/4 mb-1"></div>
                            <div className="h-3 bg-white/10 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableBoosters.map((booster) => (
                      <div
                        key={booster.id}
                        className={`bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all duration-200 ${
                          booster.quantity === 0 ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center text-lg border border-purple-500/30">
                              {booster.icon}
                            </div>
                            <div>
                              <h3 className="text-white font-medium text-sm">{booster.name}</h3>
                              <p className="text-white/60 text-xs">
                                {booster.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                              booster.quantity > 0 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {booster.quantity}
                            </div>
                            {booster.id === 'o_escudo' && booster.quantity > 0 && (
                              <button
                                onClick={() => setShowShieldModal(true)}
                                className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                              >
                                Ativar
                              </button>
                            )}
                            {booster.id === 'palpite_automatico' && booster.quantity > 0 && (
                              <button
                                onClick={() => setShowAutoBetModal(true)}
                                className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200"
                              >
                                Ativar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Seção Estatísticas */}
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Estatísticas</h2>
                    <p className="text-white/60 text-sm">Seu desempenho no bolão</p>
                  </div>
                </div>

                {loadingStatistics ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex justify-between items-center">
                          <div className="h-4 bg-white/10 rounded w-1/2"></div>
                          <div className="h-6 bg-white/10 rounded w-1/4"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Pontos</span>
                      <span className="text-white font-bold text-lg">{statistics.points || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Posição</span>
                      <span className="text-white font-bold text-lg">#{statistics.position || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Palpites</span>
                      <span className="text-white font-bold text-lg">{statistics.totalPredictions || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Acertos</span>
                      <span className="text-white font-bold text-lg">{statistics.correctPredictions || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Precisão</span>
                      <span className="text-white font-bold text-lg">{statistics.accuracy || 0}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ranking */}
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



        {/* Modal de Ativação do Escudo */}
        {showShieldModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xl">
                  🛡️
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Ativar Escudo</h3>
                  <p className="text-white/60 text-sm">Proteja seus palpites por 7 dias</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-white font-medium mb-2">O que o Escudo faz:</h4>
                  <ul className="text-white/70 text-sm space-y-1">
                    <li>• Oculta seus palpites dos outros jogadores</li>
                    <li>• Proteção ativa por 7 dias</li>
                    <li>• Palpites são revelados automaticamente no início das partidas</li>
                  </ul>
                </div>

                <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                  <p className="text-blue-400 text-sm">
                    <strong>Bolão:</strong> {selectedPoolId ? pools.find(p => p.id === selectedPoolId)?.name || 'Bolão não encontrado' : 'Nenhum bolão selecionado'}
                  </p>
                  {selectedPoolId && activeBoosterActivations.o_escudo && (
                    <p className="text-green-400 text-sm mt-2">
                      ✅ Escudo ativo - Tempo restante: {Math.max(0, Math.ceil((new Date(activeBoosterActivations.o_escudo.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dias
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowShieldModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleActivateShield}
                  disabled={!selectedPoolId || activatingShield}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {activatingShield ? 'Ativando...' : 'Ativar Escudo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Ativação do Palpite Automático */}
        {showAutoBetModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Ativar Palpite Automático</h3>
                  <p className="text-white/60 text-sm">Rede de segurança por 7 dias</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-white font-medium mb-2">O que o Palpite Automático faz:</h4>
                  <ul className="text-white/70 text-sm space-y-1">
                    <li>• Insere automaticamente palpite 2x0 se você esquecer</li>
                    <li>• Proteção ativa por 7 dias contínuos</li>
                    <li>• Evita perda de pontos por omissão</li>
                    <li>• Não sobrescreve palpites manuais</li>
                  </ul>
                </div>

                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <p className="text-green-400 text-sm">
                    <strong>Bolão:</strong> {selectedPoolId ? pools.find(p => p.id === selectedPoolId)?.name || 'Bolão não encontrado' : 'Nenhum bolão selecionado'}
                  </p>
                </div>

                {isAutoBetActive() && (
                  <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                    <p className="text-green-400 text-sm">
                      <strong>Palpite Automático já ativo!</strong> Tempo restante: {getAutoBetTimeRemaining()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAutoBetModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleActivateAutoBet}
                  disabled={!selectedPoolId || activatingAutoBet}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {activatingAutoBet ? 'Ativando...' : 'Ativar Palpite Automático'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Segunda Chance */}
        {showSecondChanceModal && editingMatch && editingPrediction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-xl">
                  🔄
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Segunda Chance</h3>
                  <p className="text-white/60 text-sm">Editar palpite salvo</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h4 className="text-white font-medium mb-3">
                    {editingMatch.home_team} vs {editingMatch.away_team}
                  </h4>
                  
                  <div className="flex items-center justify-center gap-4">
                    {/* Time da Casa */}
                    <div className="flex flex-col items-center">
                      <span className="text-white/70 text-sm mb-2">{editingMatch.home_team}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPrediction(prev => prev ? {...prev, home: Math.max(0, prev.home - 1)} : null)}
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
                        >
                          -
                        </button>
                        <span className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {editingPrediction.home}
                        </span>
                        <button
                          onClick={() => setEditingPrediction(prev => prev ? {...prev, home: Math.min(20, prev.home + 1)} : null)}
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <span className="text-white/50 text-2xl font-bold">×</span>

                    {/* Time Visitante */}
                    <div className="flex flex-col items-center">
                      <span className="text-white/70 text-sm mb-2">{editingMatch.away_team}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingPrediction(prev => prev ? {...prev, away: Math.max(0, prev.away - 1)} : null)}
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
                        >
                          -
                        </button>
                        <span className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                          {editingPrediction.away}
                        </span>
                        <button
                          onClick={() => setEditingPrediction(prev => prev ? {...prev, away: Math.min(20, prev.away + 1)} : null)}
                          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                  <p className="text-orange-400 text-sm">
                    ⚠️ Usar Segunda Chance consumirá uma unidade do booster do seu inventário.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSecondChanceModal(false);
                    setEditingMatch(null);
                    setEditingPrediction(null);
                  }}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveSecondChancePrediction}
                  disabled={savingSecondChance}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {savingSecondChance ? 'Salvando...' : 'Salvar Novo Palpite'}
                </button>
              </div>
            </div>
          </div>
        )}

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
