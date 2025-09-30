"use client";

import Protected from "@/components/Protected";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronRight, Plus, Minus, Save, Clock, Check, X, AlertTriangle, Trophy, Users, Calendar, Timer, CheckCircle } from "lucide-react";
import teamLogoMap from "@/../../src/data/teamLogoMap.json";

// Tipos
type Pool = { id: string; name: string; code: string; owner_id: string };
type Match = {
  id: string;
  pool_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  created_at: string;
};
type Prediction = {
  match_id: string;
  user_id: string;
  home_pred: number;
  away_pred: number;
  created_at: string;
};
type Profile = { id: string; display_name: string | null; avatar_url?: string | null };
type ParticipantData = { 
  user: Profile; 
  prediction: Prediction | null; 
  points: number;
  hasPredicted: boolean;
};
type ScoreCount = { score: string; count: number };
type RankingUser = {
  user: Profile;
  totalPoints: number;
  position: number;
  correctPredictions: number;
  totalPredictions: number;
};

// Função para buscar logo do time
const getTeamLogo = (teamName: string): string => {
  const normalizedName = teamName.toUpperCase().trim();
  const logoUrl = (teamLogoMap as Record<string, string>)[normalizedName];
  return logoUrl || `https://via.placeholder.com/60x60/1e293b/ffffff?text=${teamName.charAt(0)}`;
};

export default function PalpitesPage() {
  // Estados principais
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"futuros" | "passados">("futuros");
  
  // Estados de jogos e palpites
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [pastMatches, setPastMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [tempPredictions, setTempPredictions] = useState<Record<string, { home: number; away: number }>>({});
  const [savingPredictions, setSavingPredictions] = useState<Set<string>>(new Set());
  
  // Estados do modal
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [modalParticipants, setModalParticipants] = useState<Array<{ user: Profile; prediction: Prediction | null; points: number }>>([]);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Estados de UI
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; type: "success" | "error"; message: string }>>([]);
  
  // Estados para Palpite da Galera
  const [matchParticipants, setMatchParticipants] = useState<Record<string, ParticipantData[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState<Set<string>>(new Set());
  
  // Estados para Ranking do Bolão
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [userRanking, setUserRanking] = useState<RankingUser | null>(null);
  const [loadingRanking, setLoadingRanking] = useState(false);
  
  // Estados para Paginação
  const [futureMatchesPage, setFutureMatchesPage] = useState(1);
  const [pastMatchesPage, setPastMatchesPage] = useState(1);
  const [loadingMoreFuture, setLoadingMoreFuture] = useState(false);
  const [loadingMorePast, setLoadingMorePast] = useState(false);
  const [hasMoreFuture, setHasMoreFuture] = useState(true);
  const [hasMorePast, setHasMorePast] = useState(true);
  
  const MATCHES_PER_PAGE = 10;
  
  // Estados para Mensagens de Erro por Card
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // Função para mostrar toast
  const showToast = (type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Funções para gerenciar erros por card
  const setCardError = (matchId: string, message: string) => {
    setCardErrors(prev => ({ ...prev, [matchId]: message }));
    // Auto-remover erro após 5 segundos
    setTimeout(() => {
      setCardErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[matchId];
        return newErrors;
      });
    }, 5000);
  };

  const clearCardError = (matchId: string) => {
    setCardErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[matchId];
      return newErrors;
    });
  };

  // Carregar dados iniciais
  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        setUserId(user.id);
        
        // Carregar bolões do usuário
        const { data: poolsData } = await supabase
          .from('pool_members')
          .select(`
            pool_id,
            pools!inner(id, name, code, owner_id)
          `)
          .eq('user_id', user.id);
        
        if (poolsData) {
          const userPools = poolsData.map(pm => pm.pools).filter(Boolean);
          setPools(userPools);
          
          // Selecionar bolão do localStorage ou primeiro disponível
          const lastPoolId = localStorage.getItem('last_pool_id');
          const poolToSelect = lastPoolId && userPools.find(p => p.id === lastPoolId) 
            ? lastPoolId 
            : userPools[0]?.id || null;
          
          setSelectedPoolId(poolToSelect);
          if (poolToSelect) {
            localStorage.setItem('last_pool_id', poolToSelect);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        showToast("error", "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    
    loadInitialData();
  }, []);

  // Carregar jogos quando bolão é selecionado
  useEffect(() => {
    if (!selectedPoolId || !userId) return;
    
    // Reset pagination when pool changes
    setFutureMatchesPage(1);
    setPastMatchesPage(1);
    setFutureMatches([]);
    setPastMatches([]);
    setHasMoreFuture(true);
    setHasMorePast(true);
    
    loadInitialMatches();
  }, [selectedPoolId, userId]);

  // Função para carregar jogos iniciais
  const loadInitialMatches = async () => {
    try {
      const now = new Date().toISOString();
      
      // Carregar primeiros jogos futuros
      const { data: futureData } = await supabase
        .from('matches')
        .select('*')
        .eq('pool_id', selectedPoolId)
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(MATCHES_PER_PAGE);
      
      // Carregar primeiros jogos passados
      const { data: pastData } = await supabase
        .from('matches')
        .select('*')
        .eq('pool_id', selectedPoolId)
        .lt('start_time', now)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(MATCHES_PER_PAGE);
      
      setFutureMatches(futureData || []);
      setPastMatches(pastData || []);
      
      // Verificar se há mais jogos
      setHasMoreFuture((futureData || []).length === MATCHES_PER_PAGE);
      setHasMorePast((pastData || []).length === MATCHES_PER_PAGE);
      
      // Carregar palpites do usuário
      const allMatchIds = [...(futureData || []), ...(pastData || [])].map(m => m.id);
      if (allMatchIds.length > 0) {
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .in('match_id', allMatchIds);
        
        const predictionsMap: Record<string, Prediction> = {};
        (predictionsData || []).forEach(pred => {
          predictionsMap[pred.match_id] = pred;
        });
        setPredictions(predictionsMap);
      }
    } catch (error) {
      console.error("Erro ao carregar jogos:", error);
      showToast("error", "Erro ao carregar jogos");
    }
  };

  // Função para calcular tempo restante
  const getTimeRemaining = (startTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
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

  // Função para carregar mais jogos futuros
  const loadMoreFutureMatches = async () => {
    if (!selectedPoolId || !userId || loadingMoreFuture || !hasMoreFuture) return;
    
    setLoadingMoreFuture(true);
    
    try {
      const now = new Date().toISOString();
      const nextPage = futureMatchesPage + 1;
      const offset = (nextPage - 1) * MATCHES_PER_PAGE;
      
      const { data: moreData } = await supabase
        .from('matches')
        .select('*')
        .eq('pool_id', selectedPoolId)
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .range(offset, offset + MATCHES_PER_PAGE - 1);
      
      if (moreData && moreData.length > 0) {
        setFutureMatches(prev => [...prev, ...moreData]);
        setFutureMatchesPage(nextPage);
        setHasMoreFuture(moreData.length === MATCHES_PER_PAGE);
        
        // Carregar palpites dos novos jogos
        const newMatchIds = moreData.map(m => m.id);
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
      } else {
        setHasMoreFuture(false);
      }
    } catch (error) {
      console.error("Erro ao carregar mais jogos futuros:", error);
      showToast("error", "Erro ao carregar mais jogos");
    } finally {
      setLoadingMoreFuture(false);
    }
  };

  // Função para carregar mais jogos passados
  const loadMorePastMatches = async () => {
    if (!selectedPoolId || !userId || loadingMorePast || !hasMorePast) return;
    
    setLoadingMorePast(true);
    
    try {
      const now = new Date().toISOString();
      const nextPage = pastMatchesPage + 1;
      const offset = (nextPage - 1) * MATCHES_PER_PAGE;
      
      const { data: moreData } = await supabase
        .from('matches')
        .select('*')
        .eq('pool_id', selectedPoolId)
        .lt('start_time', now)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .order('start_time', { ascending: false })
        .range(offset, offset + MATCHES_PER_PAGE - 1);
      
      if (moreData && moreData.length > 0) {
        setPastMatches(prev => [...prev, ...moreData]);
        setPastMatchesPage(nextPage);
        setHasMorePast(moreData.length === MATCHES_PER_PAGE);
        
        // Carregar palpites dos novos jogos
        const newMatchIds = moreData.map(m => m.id);
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

  // Função para carregar participantes de um jogo específico
  const loadMatchParticipants = async (matchId: string) => {
    if (!selectedPoolId || loadingParticipants.has(matchId)) return;
    
    setLoadingParticipants(prev => new Set([...prev, matchId]));
    
    try {
      // Buscar todos os membros do bolão com perfis
      const { data: membersData } = await supabase
        .from('pool_members')
        .select(`
          user_id,
          profiles!inner(id, display_name, avatar_url)
        `)
        .eq('pool_id', selectedPoolId);
      
      // Buscar palpites de todos os membros para este jogo
      const { data: allPredictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', matchId);
      
      // Processar dados dos participantes
      const participants: ParticipantData[] = (membersData || []).map(member => {
        const prediction = (allPredictions || []).find(p => p.user_id === member.user_id);
        
        return {
          user: member.profiles,
          prediction,
          points: 0, // Será calculado se necessário
          hasPredicted: !!prediction
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

  // Função para carregar ranking do bolão
  const loadRanking = async () => {
    if (!selectedPoolId || !userId || loadingRanking) return;
    
    setLoadingRanking(true);
    
    try {
      // Buscar todos os membros do bolão
      const { data: membersData } = await supabase
        .from('pool_members')
        .select(`
          user_id,
          profiles!inner(id, display_name, avatar_url)
        `)
        .eq('pool_id', selectedPoolId);
      
      // Buscar todos os pontos do bolão
      const { data: pointsData } = await supabase
        .from('points')
        .select('user_id, points')
        .eq('pool_id', selectedPoolId);
      
      // Buscar estatísticas de palpites
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select(`
          user_id,
          home_pred,
          away_pred,
          matches!inner(home_score, away_score, pool_id)
        `)
        .eq('matches.pool_id', selectedPoolId)
        .not('matches.home_score', 'is', null)
        .not('matches.away_score', 'is', null);
      
      // Processar dados do ranking
      const rankingData: RankingUser[] = (membersData || []).map(member => {
        const userPoints = (pointsData || [])
          .filter(p => p.user_id === member.user_id)
          .reduce((sum, p) => sum + p.points, 0);
        
        const userPredictions = (predictionsData || []).filter(p => p.user_id === member.user_id);
        const correctPredictions = userPredictions.filter(pred => {
          const match = pred.matches;
          if (!match || match.home_score === null || match.away_score === null) return false;
          
          // Placar exato ou tendência correta
          return (pred.home_pred === match.home_score && pred.away_pred === match.away_score) ||
                 (Math.sign(pred.home_pred - pred.away_pred) === Math.sign(match.home_score - match.away_score));
        }).length;
        
        return {
          user: member.profiles,
          totalPoints: userPoints,
          position: 0, // Será calculado após ordenação
          correctPredictions,
          totalPredictions: userPredictions.length
        };
      });
      
      // Ordenar por pontos e atribuir posições
      rankingData.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.correctPredictions !== a.correctPredictions) return b.correctPredictions - a.correctPredictions;
        return b.totalPredictions - a.totalPredictions;
      });
      
      rankingData.forEach((user, index) => {
        user.position = index + 1;
      });
      
      // Separar usuário atual e top 10
      const currentUser = rankingData.find(u => u.user.id === userId);
      const top10 = rankingData.slice(0, 10);
      
      setRanking(top10);
      setUserRanking(currentUser || null);
    } catch (error) {
      console.error("Erro ao carregar ranking:", error);
      showToast("error", "Erro ao carregar ranking");
    } finally {
      setLoadingRanking(false);
    }
  };

  // Carregar ranking quando bolão é selecionado
  useEffect(() => {
    if (selectedPoolId && userId) {
      loadRanking();
    }
  }, [selectedPoolId, userId]);

  // Função para calcular palpites mais comuns
  const getMostCommonPredictions = (participants: ParticipantData[]): ScoreCount[] => {
    const scoreMap: Record<string, number> = {};
    
    participants.forEach(participant => {
      if (participant.prediction) {
        const score = `${participant.prediction.home_pred}-${participant.prediction.away_pred}`;
        scoreMap[score] = (scoreMap[score] || 0) + 1;
      }
    });
    
    return Object.entries(scoreMap)
      .map(([score, count]) => ({ score, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 palpites mais comuns
  };

  // Função para atualizar palpite temporário
  const updateTempPrediction = (matchId: string, team: "home" | "away", value: number) => {
    // Garantir que o valor seja um número válido
    const numericValue = isNaN(value) ? 0 : Math.max(0, Math.floor(value));
    
    setTempPredictions(prev => {
      const currentPrediction = prev[matchId] || { home: 0, away: 0 };
      return {
        ...prev,
        [matchId]: {
          ...currentPrediction,
          [team]: numericValue
        }
      };
    });
  };

  // Função para salvar palpite
  const savePrediction = async (matchId: string) => {
    if (!userId || !tempPredictions[matchId]) return;
    
    setSavingPredictions(prev => new Set([...prev, matchId]));
    
    try {
      const { home, away } = tempPredictions[matchId];
      
      const { error } = await supabase
        .from('predictions')
        .upsert({
          match_id: matchId,
          user_id: userId,
          home_pred: home,
          away_pred: away
        });
      
      if (error) throw error;
      
      // Atualizar estado local
      setPredictions(prev => ({
        ...prev,
        [matchId]: {
          match_id: matchId,
          user_id: userId,
          home_pred: home,
          away_pred: away,
          created_at: new Date().toISOString()
        }
      }));
      
      // Limpar palpite temporário
      setTempPredictions(prev => {
        const newTemp = { ...prev };
        delete newTemp[matchId];
        return newTemp;
      });
      
      showToast("success", "Palpite salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar palpite:", error);
      setCardError(matchId, "Erro ao salvar palpite. Tente novamente.");
    } finally {
      setSavingPredictions(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchId);
        return newSet;
      });
    }
  };

  // Função para abrir modal de conferência
  const openModal = async (match: Match) => {
    setModalMatch(match);
    setModalLoading(true);
    
    try {
      // Buscar todos os membros do bolão
      const { data: membersData } = await supabase
        .from('pool_members')
        .select(`
          user_id,
          profiles!inner(id, display_name)
        `)
        .eq('pool_id', selectedPoolId);
      
      // Buscar palpites de todos os membros para este jogo
      const { data: allPredictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', match.id);
      
      // Calcular pontos para cada palpite
      const participants = (membersData || []).map(member => {
        const prediction = (allPredictions || []).find(p => p.user_id === member.user_id);
        let points = 0;
        
        if (prediction && match.home_score !== null && match.away_score !== null) {
          // Placar exato
          if (prediction.home_pred === match.home_score && prediction.away_pred === match.away_score) {
            points = 5;
          }
          // Tendência correta
          else if (
            Math.sign(prediction.home_pred - prediction.away_pred) === 
            Math.sign(match.home_score - match.away_score)
          ) {
            points = 2;
          }
        }
        
        return {
          user: member.profiles,
          prediction,
          points
        };
      });
      
      // Ordenar por pontos (maior primeiro)
      participants.sort((a, b) => b.points - a.points);
      
      setModalParticipants(participants);
    } catch (error) {
      console.error("Erro ao carregar dados do modal:", error);
      showToast("error", "Erro ao carregar dados");
    } finally {
      setModalLoading(false);
    }
  };

  // Função para obter status do palpite
  const getPredictionStatus = (match: Match) => {
    const prediction = predictions[match.id];
    const timeRemaining = getTimeRemaining(match.start_time);
    
    if (timeRemaining.expired && !prediction) {
      return { icon: AlertTriangle, color: "text-red-500", text: "Esquecido" };
    } else if (prediction) {
      return { icon: Check, color: "text-green-500", text: "Palpitado" };
    } else {
      return { icon: X, color: "text-gray-400", text: "Pendente" };
    }
  };

  // Função para obter valores do palpite (salvo ou temporário)
  const getPredictionValues = (matchId: string) => {
    const temp = tempPredictions[matchId];
    const saved = predictions[matchId];
    
    if (temp) {
      return { 
        home: isNaN(temp.home) ? 0 : Math.max(0, Math.floor(temp.home)),
        away: isNaN(temp.away) ? 0 : Math.max(0, Math.floor(temp.away))
      };
    }
    if (saved) {
      return { 
        home: isNaN(saved.home_pred) ? 0 : Math.max(0, Math.floor(saved.home_pred)),
        away: isNaN(saved.away_pred) ? 0 : Math.max(0, Math.floor(saved.away_pred))
      };
    }
    return { home: 0, away: 0 };
  };

  // Função para determinar o estado visual do card
  const getCardVisualState = (match: Match) => {
    const timeRemaining = getTimeRemaining(match.start_time);
    const hasPrediction = !!predictions[match.id];
    const hasChanges = !!tempPredictions[match.id];
    const isSaving = savingPredictions.has(match.id);
    const hasError = !!cardErrors[match.id];

    if (hasError) {
      return {
        borderColor: 'border-red-500/50',
        bgGradient: 'from-red-500/10 to-red-500/5',
        glowEffect: 'shadow-red-500/20'
      };
    }

    if (isSaving) {
      return {
        borderColor: 'border-blue-500/50',
        bgGradient: 'from-blue-500/10 to-blue-500/5',
        glowEffect: 'shadow-blue-500/20'
      };
    }

    if (timeRemaining.expired) {
      if (hasPrediction) {
        return {
          borderColor: 'border-green-500/50',
          bgGradient: 'from-green-500/10 to-green-500/5',
          glowEffect: 'shadow-green-500/20'
        };
      } else {
        return {
          borderColor: 'border-red-500/50',
          bgGradient: 'from-red-500/10 to-red-500/5',
          glowEffect: 'shadow-red-500/20'
        };
      }
    }

    if (hasChanges) {
      return {
        borderColor: 'border-yellow-500/50',
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

  if (loading) {
    return (
      <Protected>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>Carregando palpites...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Elementos decorativos */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute top-24 right-12 w-32 h-20 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
            <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
            <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Header Principal */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-2xl mb-8">
            <div className="flex items-center justify-between">
              {/* Título */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Palpites</h1>
                  <p className="text-white/70">Faça seus palpites e dispute com os amigos</p>
                </div>
              </div>

              {/* Seletor de Bolões */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-lg border border-white/20 transition-colors min-w-[200px]"
                >
                  <div className="text-left flex-1">
                    <p className="text-sm text-white/70">Bolão Selecionado</p>
                    <p className="font-semibold text-white truncate">
                      {pools.find(p => p.id === selectedPoolId)?.name || "Selecione um bolão"}
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-white/70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-full bg-slate-800 rounded-lg border border-white/20 shadow-xl z-50">
                    {pools.map(pool => (
                      <button
                        key={pool.id}
                        onClick={() => {
                          setSelectedPoolId(pool.id);
                          localStorage.setItem('last_pool_id', pool.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          selectedPoolId === pool.id ? 'bg-blue-600/20 text-blue-300' : 'text-white'
                        }`}
                      >
                        <p className="font-medium">{pool.name}</p>
                        <p className="text-sm text-white/60">#{pool.code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Layout em 3 Colunas */}
          {selectedPoolId ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Seção de Jogos - 2 Colunas */}
              <div className="lg:col-span-2">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shadow-2xl">
              {/* Seletor de Abas */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setActiveTab("futuros")}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                    activeTab === "futuros"
                      ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Jogos Futuros ({futureMatches.length})
                </button>
                <button
                  onClick={() => setActiveTab("passados")}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                    activeTab === "passados"
                      ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/10"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  Jogos Passados ({pastMatches.length})
                </button>
              </div>

              {/* Conteúdo das Abas */}
              <div className="p-6">
                {activeTab === "futuros" ? (
                  <div className="space-y-4">
                    {futureMatches.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-16 h-16 text-white/30 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">Nenhum jogo futuro</h3>
                        <p className="text-white/70">Não há jogos disponíveis para palpite no momento.</p>
                      </div>
                    ) : (
                      futureMatches.map((match, index) => {
                         const timeRemaining = getTimeRemaining(match.start_time);
                         const status = getPredictionStatus(match);
                         const values = getPredictionValues(match.id);
                         const hasChanges = tempPredictions[match.id];
                         const isSaving = savingPredictions.has(match.id);
                         const visualState = getCardVisualState(match);

                         return (
                           <div 
                             key={match.id} 
                             className={`bg-gradient-to-br ${visualState.bgGradient} backdrop-blur-sm rounded-2xl p-6 border ${visualState.borderColor} ${visualState.glowEffect} hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-4`}
                             style={{ animationDelay: `${index * 100}ms` }}
                           >
                             {/* Header com Status e Tempo */}
                             <div className="flex items-center justify-between mb-6">
                               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${status.color === 'text-green-500' ? 'bg-green-500/20 text-green-400' : status.color === 'text-red-500' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                 <status.icon className="w-4 h-4" />
                                 <span>{status.text}</span>
                               </div>
                               
                               <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${timeRemaining.color === 'text-green-500' ? 'bg-green-500/20 text-green-400' : timeRemaining.color === 'text-yellow-500' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                 <Timer className="w-4 h-4" />
                                 <span>{timeRemaining.text}</span>
                               </div>
                             </div>

                             {/* Mensagem de Erro do Card */}
                             {cardErrors[match.id] && (
                               <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                 <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                 <span className="text-red-400 text-sm font-medium">{cardErrors[match.id]}</span>
                                 <button
                                   onClick={() => clearCardError(match.id)}
                                   className="ml-auto text-red-400 hover:text-red-300 transition-colors"
                                 >
                                   <X className="w-4 h-4" />
                                 </button>
                               </div>
                             )}

                             {/* Times com Logos */}
                             <div className="flex items-center justify-between mb-6">
                               {/* Time da Casa */}
                               <div className="flex flex-col items-center flex-1">
                                 <div className="w-16 h-16 mb-3 rounded-full bg-white/10 p-2 shadow-lg">
                                   <img 
                                     src={getTeamLogo(match.home_team)} 
                                     alt={match.home_team}
                                     className="w-full h-full object-contain rounded-full"
                                     onError={(e) => {
                                       const target = e.target as HTMLImageElement;
                                       target.src = `https://via.placeholder.com/60x60/1e293b/ffffff?text=${match.home_team.charAt(0)}`;
                                     }}
                                   />
                                 </div>
                                 <h3 className="text-lg font-bold text-white text-center leading-tight">{match.home_team}</h3>
                                 <p className="text-xs text-white/60 mt-1">Casa</p>
                               </div>

                               {/* Placar Central */}
                               <div className="flex flex-col items-center mx-6">
                                 {!timeRemaining.expired ? (
                                   <div className="flex items-center gap-4">
                                     {/* Placar Casa */}
                                     <div className="flex flex-col items-center">
                                       <div className="flex items-center gap-2 mb-2">
                                         <button
                                           onClick={() => updateTempPrediction(match.id, "home", values.home - 1)}
                                           className="w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                                         >
                                           <Minus className="w-4 h-4 text-white" />
                                         </button>
                                         <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                           <span className="text-xl font-bold text-white">{values.home}</span>
                                         </div>
                                         <button
                                           onClick={() => updateTempPrediction(match.id, "home", values.home + 1)}
                                           className="w-8 h-8 bg-green-500/80 hover:bg-green-500 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                                         >
                                           <Plus className="w-4 h-4 text-white" />
                                         </button>
                                       </div>
                                     </div>

                                     <div className="text-2xl font-bold text-white/30 mx-2">×</div>

                                     {/* Placar Fora */}
                                     <div className="flex flex-col items-center">
                                       <div className="flex items-center gap-2 mb-2">
                                         <button
                                           onClick={() => updateTempPrediction(match.id, "away", values.away - 1)}
                                           className="w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                                         >
                                           <Minus className="w-4 h-4 text-white" />
                                         </button>
                                         <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                           <span className="text-xl font-bold text-white">{values.away}</span>
                                         </div>
                                         <button
                                           onClick={() => updateTempPrediction(match.id, "away", values.away + 1)}
                                           className="w-8 h-8 bg-green-500/80 hover:bg-green-500 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                                         >
                                           <Plus className="w-4 h-4 text-white" />
                                         </button>
                                       </div>
                                     </div>
                                   </div>
                                 ) : (
                                   <div className="text-center">
                                     <div className="text-3xl font-bold text-red-400 mb-2">EXPIRADO</div>
                                     <p className="text-sm text-white/60">Tempo esgotado</p>
                                   </div>
                                 )}
                               </div>

                               {/* Time Visitante */}
                               <div className="flex flex-col items-center flex-1">
                                 <div className="w-16 h-16 mb-3 rounded-full bg-white/10 p-2 shadow-lg">
                                   <img 
                                     src={getTeamLogo(match.away_team)} 
                                     alt={match.away_team}
                                     className="w-full h-full object-contain rounded-full"
                                     onError={(e) => {
                                       const target = e.target as HTMLImageElement;
                                       target.src = `https://via.placeholder.com/60x60/1e293b/ffffff?text=${match.away_team.charAt(0)}`;
                                     }}
                                   />
                                 </div>
                                 <h3 className="text-lg font-bold text-white text-center leading-tight">{match.away_team}</h3>
                                 <p className="text-xs text-white/60 mt-1">Fora</p>
                               </div>
                             </div>

                             {/* Footer com Data e Botão */}
                             <div className="flex items-center justify-between pt-4 border-t border-white/10">
                               <div className="flex items-center gap-2 text-white/70">
                                 <Calendar className="w-4 h-4" />
                                 <span className="text-sm">
                                   {new Date(match.start_time).toLocaleDateString('pt-BR', { 
                                     day: '2-digit', 
                                     month: '2-digit',
                                     hour: '2-digit',
                                     minute: '2-digit'
                                   })}
                                 </span>
                               </div>

                               {hasChanges && !timeRemaining.expired && (
                                 <button
                                   onClick={() => savePrediction(match.id)}
                                   disabled={isSaving}
                                   className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-600/50 disabled:to-purple-600/50 px-6 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg font-medium"
                                 >
                                   {isSaving ? (
                                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                   ) : (
                                     <Save className="w-4 h-4" />
                                   )}
                                   <span>{isSaving ? "Salvando..." : "Salvar Palpite"}</span>
                                 </button>
                               )}
                             </div>

                             {/* Seção Palpite da Galera - só aparece se o usuário já palpitou */}
                             {predictions[match.id] && (
                               <div className="mt-6 pt-6 border-t border-white/10">
                                 <div className="flex items-center justify-between mb-4">
                                   <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                                     <Users className="w-5 h-5 text-blue-400" />
                                     Palpite da Galera
                                   </h4>
                                   <button
                                     onClick={() => {
                                       if (!matchParticipants[match.id]) {
                                         loadMatchParticipants(match.id);
                                       }
                                     }}
                                     className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                                   >
                                     {matchParticipants[match.id] ? "Atualizar" : "Ver Palpites"}
                                   </button>
                                 </div>

                                 {loadingParticipants.has(match.id) ? (
                                   <div className="flex items-center justify-center py-8">
                                     <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                   </div>
                                 ) : matchParticipants[match.id] ? (
                                   <div className="space-y-4">
                                     {/* Contador de Participantes */}
                                     <div className="bg-white/5 rounded-lg p-3">
                                       <p className="text-white/80 text-sm">
                                         <span className="font-semibold text-blue-400">
                                           {matchParticipants[match.id].filter(p => p.hasPredicted).length}
                                         </span>
                                         {" de "}
                                         <span className="font-semibold">
                                           {matchParticipants[match.id].length}
                                         </span>
                                         {" participantes já palpitaram"}
                                       </p>
                                     </div>

                                     {/* Gráfico de Palpites Mais Comuns */}
                                     {(() => {
                                       const commonPredictions = getMostCommonPredictions(matchParticipants[match.id]);
                                       const maxCount = Math.max(...commonPredictions.map(p => p.count), 1);
                                       
                                       return commonPredictions.length > 0 && (
                                         <div className="bg-white/5 rounded-lg p-4">
                                           <h5 className="text-white font-medium mb-3 text-sm">Palpites Mais Comuns</h5>
                                           <div className="space-y-2">
                                             {commonPredictions.map((pred, idx) => (
                                               <div key={pred.score} className="flex items-center gap-3">
                                                 <div className="w-12 text-white/80 text-sm font-mono">
                                                   {pred.score}
                                                 </div>
                                                 <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                                                   <div 
                                                     className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                                                     style={{ width: `${(pred.count / maxCount) * 100}%` }}
                                                   />
                                                 </div>
                                                 <div className="w-8 text-white/60 text-xs text-right">
                                                   {pred.count}
                                                 </div>
                                               </div>
                                             ))}
                                           </div>
                                         </div>
                                       );
                                     })()}

                                     {/* Lista de Participantes */}
                                     <div className="bg-white/5 rounded-lg p-4">
                                       <h5 className="text-white font-medium mb-3 text-sm">Participantes</h5>
                                       <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                                         {matchParticipants[match.id]
                                           .sort((a, b) => {
                                             if (a.hasPredicted && !b.hasPredicted) return -1;
                                             if (!a.hasPredicted && b.hasPredicted) return 1;
                                             return (a.user.display_name || "").localeCompare(b.user.display_name || "");
                                           })
                                           .map((participant) => (
                                             <div key={participant.user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                               <div className="relative">
                                                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
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
                                                 {participant.hasPredicted && (
                                                   <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                     <Check className="w-2.5 h-2.5 text-white" />
                                                   </div>
                                                 )}
                                               </div>
                                               
                                               <div className="flex-1 min-w-0">
                                                 <p className="text-white text-sm font-medium truncate">
                                                   {participant.user.display_name || "Usuário"}
                                                 </p>
                                               </div>
                                               
                                               {participant.prediction && (
                                                 <div className="text-white/80 text-sm font-mono bg-white/10 px-2 py-1 rounded">
                                                   {participant.prediction.home_pred}-{participant.prediction.away_pred}
                                                 </div>
                                               )}
                                             </div>
                                           ))}
                                       </div>
                                     </div>
                                   </div>
                                 ) : (
                                   <div className="text-center py-4">
                                     <p className="text-white/60 text-sm">Clique em "Ver Palpites" para carregar os dados</p>
                                   </div>
                                 )}
                               </div>
                             )}
                           </div>
                         );
                       })
                    )}
                    
                    {/* Botão Carregar Mais - Jogos Futuros */}
                    {futureMatches.length > 0 && hasMoreFuture && (
                      <div className="flex justify-center mt-8">
                        <button
                          onClick={loadMoreFutureMatches}
                          disabled={loadingMoreFuture}
                          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-600/50 disabled:to-purple-600/50 px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg font-medium text-white"
                        >
                          {loadingMoreFuture ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Carregando...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>Carregar mais jogos</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pastMatches.length === 0 ? (
                      <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-white/30 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">Nenhum jogo finalizado</h3>
                        <p className="text-white/70">Ainda não há jogos finalizados neste bolão.</p>
                      </div>
                    ) : (
                      pastMatches.map((match, index) => {
                        const prediction = predictions[match.id];
                        let points = 0;
                        
                        if (prediction && match.home_score !== null && match.away_score !== null) {
                          if (prediction.home_pred === match.home_score && prediction.away_pred === match.away_score) {
                            points = 5;
                          } else if (
                            Math.sign(prediction.home_pred - prediction.away_pred) === 
                            Math.sign(match.home_score - match.away_score)
                          ) {
                            points = 2;
                          }
                        }

                        const visualState = getCardVisualState(match);

                        return (
                          <div 
                            key={match.id} 
                            className={`bg-gradient-to-br ${visualState.bgGradient} backdrop-blur-sm rounded-2xl p-6 border ${visualState.borderColor} ${visualState.glowEffect} hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group animate-in fade-in slide-in-from-left-4`}
                            style={{ animationDelay: `${index * 50}ms` }}
                            onClick={() => openModal(match)}
                          >
                            {/* Header com Status e Pontuação */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                                <Check className="w-4 h-4" />
                                <span>Finalizado</span>
                              </div>
                              
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium">
                                <Trophy className="w-4 h-4" />
                                <span>{points} pontos</span>
                              </div>
                            </div>

                            {/* Times com Logos e Resultado */}
                            <div className="flex items-center justify-between mb-6">
                              {/* Time da Casa */}
                              <div className="flex flex-col items-center flex-1">
                                <div className="w-16 h-16 mb-3 rounded-full bg-white/10 p-2 shadow-lg">
                                  <img 
                                    src={getTeamLogo(match.home_team)} 
                                    alt={match.home_team}
                                    className="w-full h-full object-contain rounded-full"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = `https://via.placeholder.com/60x60/1e293b/ffffff?text=${match.home_team.charAt(0)}`;
                                    }}
                                  />
                                </div>
                                <h3 className="text-lg font-bold text-white text-center leading-tight">{match.home_team}</h3>
                                <p className="text-xs text-white/60 mt-1">Casa</p>
                              </div>

                              {/* Resultado Central */}
                              <div className="flex flex-col items-center mx-6">
                                <div className="flex items-center gap-4 mb-3">
                                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-xl font-bold text-white">{match.home_score}</span>
                                  </div>
                                  <div className="text-2xl font-bold text-white/50">×</div>
                                  <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-xl font-bold text-white">{match.away_score}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-white/60 font-medium">RESULTADO FINAL</p>
                              </div>

                              {/* Time Visitante */}
                              <div className="flex flex-col items-center flex-1">
                                <div className="w-16 h-16 mb-3 rounded-full bg-white/10 p-2 shadow-lg">
                                  <img 
                                    src={getTeamLogo(match.away_team)} 
                                    alt={match.away_team}
                                    className="w-full h-full object-contain rounded-full"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = `https://via.placeholder.com/60x60/1e293b/ffffff?text=${match.away_team.charAt(0)}`;
                                    }}
                                  />
                                </div>
                                <h3 className="text-lg font-bold text-white text-center leading-tight">{match.away_team}</h3>
                                <p className="text-xs text-white/60 mt-1">Fora</p>
                              </div>
                            </div>

                            {/* Seu Palpite */}
                            <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-white/70 font-medium">Seu palpite:</span>
                                {prediction ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-blue-400">{prediction.home_pred}</span>
                                    <span className="text-white/50">×</span>
                                    <span className="text-lg font-bold text-blue-400">{prediction.away_pred}</span>
                                  </div>
                                ) : (
                                  <span className="text-red-400 font-medium">Não palpitou</span>
                                )}
                              </div>
                            </div>

                            {/* Footer com Data e Indicador de Clique */}
                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                              <div className="flex items-center gap-2 text-white/70">
                                <Calendar className="w-4 h-4" />
                                <span className="text-sm">
                                  {new Date(match.start_time).toLocaleDateString('pt-BR', { 
                                    day: '2-digit', 
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-white/50 group-hover:text-white/70 transition-colors">
                                <span className="text-sm">Ver conferência</span>
                                <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    
                    {/* Botão Carregar Mais - Jogos Passados */}
                    {pastMatches.length > 0 && hasMorePast && (
                      <div className="flex justify-center mt-8">
                        <button
                          onClick={loadMorePastMatches}
                          disabled={loadingMorePast}
                          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-600/50 disabled:to-purple-600/50 px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg font-medium text-white"
                        >
                          {loadingMorePast ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Carregando...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>Carregar mais jogos</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-12 border border-white/10 shadow-2xl text-center">
              <Users className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Selecione um bolão</h3>
              <p className="text-white/70">Escolha um bolão no menu acima para ver os jogos disponíveis.</p>
            </div>
          )}
        </div>

        {/* Modal de Conferência */}
        {modalMatch && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/20 max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl">
              {/* Header do Modal */}
              <div className="p-6 border-b border-white/20 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">Conferência de Palpites</h3>
                  <button
                    onClick={() => setModalMatch(null)}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Resultado do Jogo com Logos */}
                <div className="flex items-center justify-center gap-8">
                  {/* Time da Casa */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 mb-3 rounded-full bg-white/10 p-2 shadow-lg">
                      <img 
                        src={getTeamLogo(modalMatch.home_team)} 
                        alt={modalMatch.home_team}
                        className="w-full h-full object-contain rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://via.placeholder.com/60x60/1e293b/ffffff?text=${modalMatch.home_team.charAt(0)}`;
                        }}
                      />
                    </div>
                    <h4 className="text-lg font-bold text-white text-center">{modalMatch.home_team}</h4>
                  </div>

                  {/* Resultado Central */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-2xl font-bold text-white">{modalMatch.home_score}</span>
                      </div>
                      <div className="text-3xl font-bold text-white/50">×</div>
                      <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-2xl font-bold text-white">{modalMatch.away_score}</span>
                      </div>
                    </div>
                    <p className="text-sm text-white/60 font-medium">RESULTADO FINAL</p>
                  </div>

                  {/* Time Visitante */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 mb-3 rounded-full bg-white/10 p-2 shadow-lg">
                      <img 
                        src={getTeamLogo(modalMatch.away_team)} 
                        alt={modalMatch.away_team}
                        className="w-full h-full object-contain rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://via.placeholder.com/60x60/1e293b/ffffff?text=${modalMatch.away_team.charAt(0)}`;
                        }}
                      />
                    </div>
                    <h4 className="text-lg font-bold text-white text-center">{modalMatch.away_team}</h4>
                  </div>
                </div>
              </div>

              {/* Lista de Participantes */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {modalLoading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/70 text-lg">Carregando palpites...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      Ranking de Palpites
                    </h4>
                    {modalParticipants.map((participant, index) => (
                      <div key={participant.user.id} className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Posição */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${
                              index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                              index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                              index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                              'bg-gradient-to-br from-slate-600 to-slate-700 text-white'
                            }`}>
                              {index + 1}°
                            </div>

                            {/* Informações do Usuário */}
                            <div>
                              <p className="font-bold text-white text-lg">
                                {participant.user.display_name || "Usuário"}
                              </p>
                              {participant.prediction ? (
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-sm text-white/60">Palpite:</span>
                                  <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1 rounded-full">
                                    <span className="text-blue-400 font-bold">{participant.prediction.home_pred}</span>
                                    <span className="text-white/50">×</span>
                                    <span className="text-blue-400 font-bold">{participant.prediction.away_pred}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mt-1">
                                  <X className="w-4 h-4 text-red-400" />
                                  <span className="text-red-400 font-medium">Não palpitou</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Pontuação */}
                          <div className="text-right">
                            <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
                              <Trophy className="w-5 h-5 text-yellow-400" />
                              <span className="text-xl font-bold text-yellow-400">{participant.points}</span>
                              <span className="text-sm text-yellow-400/70">pts</span>
                            </div>
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
        
        {/* Coluna Direita - Ranking e Seções */}
        <div className="lg:col-span-1 space-y-6">
          {/* Seção de Ranking do Bolão */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Trophy className="w-7 h-7 text-yellow-400" />
                  Ranking do Bolão
                </h2>
                <button
                  onClick={loadRanking}
                  disabled={loadingRanking}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-600/50 disabled:to-purple-600/50 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg text-sm font-medium"
                >
                  {loadingRanking ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4" />
                  )}
                  <span>{loadingRanking ? "Carregando..." : "Atualizar"}</span>
                </button>
              </div>

              {loadingRanking ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Card do Usuário */}
                  {userRanking && (
                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-400/30 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                              {userRanking.user.avatar_url ? (
                                <img 
                                  src={userRanking.user.avatar_url} 
                                  alt={userRanking.user.display_name || ""}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                (userRanking.user.display_name || "?").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-black text-sm font-bold shadow-lg">
                              #{userRanking.position}
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">
                              {userRanking.user.display_name || "Você"}
                            </h3>
                            <p className="text-blue-300 text-sm">
                              {userRanking.correctPredictions} acertos em {userRanking.totalPredictions} palpites
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-3xl font-bold text-yellow-400 mb-1">
                            {userRanking.totalPoints}
                          </div>
                          <p className="text-white/70 text-sm">pontos</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top 10 */}
                  <div className="bg-white/5 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-400" />
                      Top 10 Participantes
                    </h3>
                    
                    {ranking.length === 0 ? (
                      <div className="text-center py-8">
                        <Trophy className="w-12 h-12 text-white/30 mx-auto mb-3" />
                        <p className="text-white/60">Nenhum dado de ranking disponível</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ranking.map((user, index) => (
                          <div 
                            key={user.user.id} 
                            className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-200 hover:bg-white/5 ${
                              user.user.id === userId ? 'bg-blue-600/20 border border-blue-400/30' : 'bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Posição com medalha para top 3 */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0 ? 'bg-yellow-500 text-black' :
                                index === 1 ? 'bg-gray-400 text-black' :
                                index === 2 ? 'bg-amber-600 text-white' :
                                'bg-white/20 text-white'
                              }`}>
                                {index < 3 ? (
                                  <Trophy className="w-4 h-4" />
                                ) : (
                                  user.position
                                )}
                              </div>
                              
                              {/* Avatar */}
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                                {user.user.avatar_url ? (
                                  <img 
                                    src={user.user.avatar_url} 
                                    alt={user.user.display_name || ""}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  (user.user.display_name || "?").charAt(0).toUpperCase()
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-medium truncate">
                                {user.user.display_name || "Usuário"}
                                {user.user.id === userId && (
                                  <span className="text-blue-400 text-sm ml-2">(Você)</span>
                                )}
                              </h4>
                              <p className="text-white/60 text-sm">
                                {user.correctPredictions} acertos • {user.totalPredictions} palpites
                              </p>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-xl font-bold text-yellow-400">
                                {user.totalPoints}
                              </div>
                              <p className="text-white/60 text-xs">pts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Nenhum bolão selecionado</h3>
          <p className="text-white/70">Selecione um bolão para ver os jogos e fazer seus palpites.</p>
        </div>
      )}

        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg border ${
                toast.type === "success"
                  ? "bg-green-600 border-green-500 text-white"
                  : "bg-red-600 border-red-500 text-white"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </Protected>
  );
}
