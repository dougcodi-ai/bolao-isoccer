// Hook para sistema de polling de dados ao vivo
import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';

const usePolling = (
  fetchFunction,
  dependencies = [],
  options = {}
) => {
  const {
    interval = 5 * 60 * 1000, // 5 minutos por padrão
    enabled = true,
    immediate = true,
    onError = null,
    onSuccess = null,
    maxRetries = 3,
    retryDelay = 30000, // 30 segundos
    respectRateLimit = true
  } = options;

  const user = useUser();
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const intervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isActiveRef = useRef(true);

  /**
   * Executar fetch com tratamento de erro
   */
  const executeFetch = useCallback(async () => {
    if (!user?.id || !enabled || !isActiveRef.current) return;

    try {
      setError(null);
      const result = await fetchFunction();
      
      if (result?.success !== false) {
        setLastUpdate(new Date());
        setRetryCount(0);
        onSuccess?.(result);
      } else {
        // Tratar erros específicos da API
        if (respectRateLimit && (
          result.error === 'rate_limit_hour' || 
          result.error === 'rate_limit_interval'
        )) {
          console.log('Polling pausado devido ao rate limit:', result.message);
          setError(`Rate limit: ${result.message}`);
          // Pausar polling até o próximo período permitido
          const waitTime = result.nextAllowedAt ? 
            Math.max(result.nextAllowedAt - Date.now(), interval) : 
            interval * 2;
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = setTimeout(() => {
              if (isActiveRef.current) {
                startPolling();
              }
            }, waitTime);
          }
          return;
        } else {
          throw new Error(result.message || 'Erro na requisição');
        }
      }
    } catch (err) {
      console.error('Erro no polling:', err);
      setError(err.message);
      onError?.(err);
      
      // Implementar retry com backoff exponencial
      if (retryCount < maxRetries) {
        const delay = retryDelay * Math.pow(2, retryCount);
        setRetryCount(prev => prev + 1);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            executeFetch();
          }
        }, delay);
      } else {
        console.log('Máximo de tentativas atingido, pausando polling');
        stopPolling();
      }
    }
  }, [
    fetchFunction, 
    user?.id, 
    enabled, 
    onSuccess, 
    onError, 
    retryCount, 
    maxRetries, 
    retryDelay,
    respectRateLimit,
    interval
  ]);

  /**
   * Iniciar polling
   */
  const startPolling = useCallback(() => {
    if (!enabled || !user?.id) return;

    stopPolling(); // Limpar qualquer polling anterior
    setIsPolling(true);
    setRetryCount(0);

    // Executar imediatamente se solicitado
    if (immediate) {
      executeFetch();
    }

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        executeFetch();
      }
    }, interval);
  }, [enabled, user?.id, immediate, executeFetch, interval]);

  /**
   * Parar polling
   */
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Forçar atualização manual
   */
  const forceUpdate = useCallback(async () => {
    if (!enabled || !user?.id) return;
    
    setRetryCount(0);
    return await executeFetch();
  }, [enabled, user?.id, executeFetch]);

  /**
   * Reiniciar polling
   */
  const restart = useCallback(() => {
    stopPolling();
    setTimeout(() => {
      if (isActiveRef.current) {
        startPolling();
      }
    }, 1000);
  }, [stopPolling, startPolling]);

  // Efeito para iniciar/parar polling baseado nas dependências
  useEffect(() => {
    if (enabled && user?.id && dependencies.every(dep => dep != null)) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, user?.id, ...dependencies, startPolling, stopPolling]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Pausar polling quando a aba não está ativa
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (enabled && user?.id) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, user?.id, startPolling, stopPolling]);

  return {
    isPolling,
    lastUpdate,
    error,
    retryCount,
    startPolling,
    stopPolling,
    forceUpdate,
    restart,
    timeUntilNext: isPolling && lastUpdate ? 
      Math.max(0, interval - (Date.now() - lastUpdate.getTime())) : 0
  };
};

export default usePolling;