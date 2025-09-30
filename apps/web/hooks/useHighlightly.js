// Hook React para integração com API Highlightly
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import HighlightlyClient from '../lib/highlightly/client';

const useHighlightly = () => {
  const user = useUser();
  const [client] = useState(() => new HighlightlyClient());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para dados
  const [countries, setCountries] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);

  // Estados para rate limiting
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  /**
   * Função genérica para fazer requisições
   */
  const makeRequest = useCallback(async (requestFn, setDataFn, errorMessage) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await requestFn(user.id);
      
      if (result.success) {
        if (setDataFn) {
          setDataFn(result.data);
        }
        return result.data;
      } else {
        // Tratar diferentes tipos de erro
        if (result.error === 'rate_limit_hour' || result.error === 'rate_limit_interval') {
          setRateLimitInfo({
            blocked: true,
            reason: result.error,
            message: result.message,
            nextAllowedAt: result.nextAllowedAt
          });
          setError(result.message);
        } else {
          setError(result.message || errorMessage);
        }
        return null;
      }
    } catch (err) {
      console.error(errorMessage, err);
      setError(err.message || errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Buscar países disponíveis
   */
  const fetchCountries = useCallback(async () => {
    return makeRequest(
      (userId) => client.getCountries(userId),
      setCountries,
      'Erro ao buscar países'
    );
  }, [client, makeRequest]);

  /**
   * Buscar ligas de um país
   */
  const fetchLeagues = useCallback(async (countryCode = null, countryName = null) => {
    return makeRequest(
      (userId) => client.getLeagues(userId, countryCode, countryName),
      setLeagues,
      'Erro ao buscar ligas'
    );
  }, [client, makeRequest]);

  /**
   * Buscar ligas brasileiras
   */
  const fetchBrazilianLeagues = useCallback(async () => {
    return makeRequest(
      (userId) => client.getBrazilianLeagues(userId),
      setLeagues,
      'Erro ao buscar ligas brasileiras'
    );
  }, [client, makeRequest]);

  /**
   * Buscar partidas de uma liga
   */
  const fetchMatches = useCallback(async (leagueId, limit = 50) => {
    return makeRequest(
      (userId) => client.getMatches(userId, leagueId, limit),
      setMatches,
      'Erro ao buscar partidas'
    );
  }, [client, makeRequest]);

  /**
   * Buscar classificação de uma liga
   */
  const fetchStandings = useCallback(async (leagueId, season = null) => {
    return makeRequest(
      (userId) => client.getStandings(userId, leagueId, season),
      setStandings,
      'Erro ao buscar classificação'
    );
  }, [client, makeRequest]);

  /**
   * Verificar status do rate limit
   */
  const checkRateLimit = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const result = await client.checkRateLimit(user.id);
      setRateLimitInfo(result);
      return result;
    } catch (err) {
      console.error('Erro ao verificar rate limit:', err);
      return null;
    }
  }, [client, user?.id]);

  /**
   * Limpar dados
   */
  const clearData = useCallback(() => {
    setCountries([]);
    setLeagues([]);
    setMatches([]);
    setStandings([]);
    setError(null);
    setRateLimitInfo(null);
  }, []);

  /**
   * Verificar se pode fazer requisição
   */
  const canMakeRequest = useCallback(() => {
    if (!rateLimitInfo) return true;
    if (rateLimitInfo.blocked) {
      const now = Date.now();
      return now >= rateLimitInfo.nextAllowedAt;
    }
    return rateLimitInfo.allowed !== false;
  }, [rateLimitInfo]);

  /**
   * Tempo restante até próxima requisição permitida
   */
  const getTimeUntilNextRequest = useCallback(() => {
    if (!rateLimitInfo?.nextAllowedAt) return 0;
    const now = Date.now();
    const timeLeft = rateLimitInfo.nextAllowedAt - now;
    return Math.max(0, timeLeft);
  }, [rateLimitInfo]);

  /**
   * Formatar tempo restante em string legível
   */
  const formatTimeUntilNext = useCallback(() => {
    const timeLeft = getTimeUntilNextRequest();
    if (timeLeft === 0) return null;

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [getTimeUntilNextRequest]);

  // Efeito para atualizar rate limit info periodicamente
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      if (rateLimitInfo?.blocked) {
        const timeLeft = getTimeUntilNextRequest();
        if (timeLeft === 0) {
          setRateLimitInfo(prev => ({ ...prev, blocked: false }));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.id, rateLimitInfo, getTimeUntilNextRequest]);

  return {
    // Estados
    loading,
    error,
    countries,
    leagues,
    matches,
    standings,
    rateLimitInfo,

    // Funções de busca
    fetchCountries,
    fetchLeagues,
    fetchBrazilianLeagues,
    fetchMatches,
    fetchStandings,

    // Funções de rate limiting
    checkRateLimit,
    canMakeRequest,
    getTimeUntilNextRequest,
    formatTimeUntilNext,

    // Utilitários
    clearData,

    // Cliente direto (para casos especiais)
    client
  };
};

export default useHighlightly;