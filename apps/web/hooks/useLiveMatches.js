// Hook para dados ao vivo de partidas
import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import useHighlightly from './useHighlightly';
import usePolling from './usePolling';

const useLiveMatches = (league = null, options = {}) => {
  const {
    pollingInterval = 5 * 60 * 1000, // 5 minutos
    enabled = true,
    autoStart = true
  } = options;

  const user = useUser();
  const { fetchMatches, canMakeRequest } = useHighlightly();
  
  const [matches, setMatches] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  /**
   * Função para buscar partidas
   */
  const fetchMatchesData = useCallback(async () => {
    if (!league?.id || !canMakeRequest()) {
      return { success: false, error: 'rate_limit_interval' };
    }

    try {
      const result = await fetchMatches(league.id, 100);
      
      if (result && Array.isArray(result)) {
        setMatches(result);
        setLastUpdateTime(new Date());
        return { success: true, data: result };
      }
      
      return { success: false, error: 'no_data' };
    } catch (error) {
      console.error('Erro ao buscar partidas:', error);
      return { success: false, error: error.message };
    }
  }, [league?.id, fetchMatches, canMakeRequest]);

  /**
   * Configurar polling
   */
  const {
    isPolling,
    lastUpdate,
    error: pollingError,
    startPolling,
    stopPolling,
    forceUpdate,
    restart
  } = usePolling(
    fetchMatchesData,
    [league?.id],
    {
      interval: pollingInterval,
      enabled: enabled && !!league?.id,
      immediate: autoStart,
      respectRateLimit: true,
      maxRetries: 3,
      onSuccess: (data) => {
        console.log('Dados de partidas atualizados:', new Date().toLocaleTimeString());
      },
      onError: (error) => {
        console.error('Erro no polling de partidas:', error);
      }
    }
  );

  /**
   * Categorizar partidas por status
   */
  const categorizeMatches = useCallback(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const live = matches.filter(match => 
      match.status === 'live' || 
      match.status === 'in_progress' ||
      match.status === '1H' ||
      match.status === '2H' ||
      match.status === 'HT'
    );

    const upcoming = matches.filter(match => {
      const matchDate = new Date(match.date);
      return matchDate > now && 
             matchDate <= oneDayFromNow &&
             !['finished', 'completed', 'cancelled'].includes(match.status);
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const recent = matches.filter(match => {
      const matchDate = new Date(match.date);
      return matchDate >= oneHourAgo && 
             matchDate <= now &&
             ['finished', 'completed'].includes(match.status);
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    setLiveMatches(live);
    setUpcomingMatches(upcoming);
    setRecentMatches(recent);

    return { live, upcoming, recent };
  }, [matches]);

  /**
   * Obter estatísticas das partidas
   */
  const getMatchStats = useCallback(() => {
    const { live, upcoming, recent } = categorizeMatches();
    
    return {
      total: matches.length,
      live: live.length,
      upcoming: upcoming.length,
      recent: recent.length,
      hasLiveMatches: live.length > 0,
      nextMatch: upcoming[0] || null,
      lastMatch: recent[0] || null
    };
  }, [matches, categorizeMatches]);

  /**
   * Verificar se há partidas ao vivo
   */
  const hasLiveMatches = useCallback(() => {
    return liveMatches.length > 0;
  }, [liveMatches]);

  /**
   * Obter próxima partida
   */
  const getNextMatch = useCallback(() => {
    return upcomingMatches[0] || null;
  }, [upcomingMatches]);

  /**
   * Obter tempo até próxima atualização
   */
  const getTimeUntilNextUpdate = useCallback(() => {
    if (!lastUpdate) return pollingInterval;
    
    const timeSinceLastUpdate = Date.now() - lastUpdate.getTime();
    return Math.max(0, pollingInterval - timeSinceLastUpdate);
  }, [lastUpdate, pollingInterval]);

  /**
   * Formatar tempo restante
   */
  const formatTimeUntilNext = useCallback(() => {
    const timeLeft = getTimeUntilNextUpdate();
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [getTimeUntilNextUpdate]);

  // Efeito para categorizar partidas quando mudarem
  useEffect(() => {
    categorizeMatches();
  }, [matches, categorizeMatches]);

  // Efeito para ajustar intervalo de polling baseado em partidas ao vivo
  useEffect(() => {
    if (hasLiveMatches()) {
      // Se há partidas ao vivo, polling mais frequente (2 minutos)
      if (pollingInterval > 2 * 60 * 1000) {
        restart();
      }
    }
  }, [liveMatches, hasLiveMatches, restart, pollingInterval]);

  return {
    // Dados
    matches,
    liveMatches,
    upcomingMatches,
    recentMatches,
    lastUpdateTime,

    // Status
    isPolling,
    lastUpdate,
    error: pollingError,

    // Funções de controle
    startPolling,
    stopPolling,
    forceUpdate,
    restart,

    // Utilitários
    getMatchStats,
    hasLiveMatches,
    getNextMatch,
    getTimeUntilNextUpdate,
    formatTimeUntilNext,
    categorizeMatches,

    // Informações de timing
    timeUntilNext: getTimeUntilNextUpdate(),
    formattedTimeUntilNext: formatTimeUntilNext()
  };
};

export default useLiveMatches;