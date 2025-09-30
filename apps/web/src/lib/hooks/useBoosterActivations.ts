import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface BoosterActivation {
  id: string;
  user_id: string;
  pool_id: string | null;
  booster_id: string;
  scope: 'global' | 'match';
  match_id: string | null;
  activated_at: string;
  expires_at: string | null;
  status: 'active' | 'expired' | 'revoked';
  notes: string | null;
}

export interface UseBoosterActivationsReturn {
  activations: BoosterActivation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  activateBooster: (boosterId: string, poolId?: string) => Promise<{ success: boolean; message: string; expires_at?: string }>;
  getActiveBooster: (boosterId: string) => BoosterActivation | null;
  isBoosterActive: (boosterId: string) => boolean;
  getTimeRemaining: (boosterId: string) => { days: number; hours: number; minutes: number; seconds: number } | null;
}

export function useBoosterActivations(): UseBoosterActivationsReturn {
  const [activations, setActivations] = useState<BoosterActivation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setActivations([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('booster_activations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('activated_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Filtrar ativações expiradas
      const now = new Date();
      const activeActivations = (data || []).filter((activation: BoosterActivation) => {
        if (!activation.expires_at) return true;
        return new Date(activation.expires_at) > now;
      });

      setActivations(activeActivations);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar ativações:', err);
      setError(err.message || 'Erro ao carregar ativações');
    } finally {
      setLoading(false);
    }
  }, []);

  const activateBooster = useCallback(async (boosterId: string, poolId?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, message: 'Usuário não autenticado' };
      }

      const response = await fetch('/api/boosters/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          boosterId,
          poolId
        })
      });

      const result = await response.json();

      if (result.ok) {
        // Atualizar lista de ativações
        await fetchActivations();
        return { 
          success: true, 
          message: result.message,
          expires_at: result.expires_at
        };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error: any) {
      console.error('Erro ao ativar booster:', error);
      return { success: false, message: 'Erro ao ativar booster' };
    }
  }, [fetchActivations]);

  const getActiveBooster = useCallback((boosterId: string): BoosterActivation | null => {
    const now = new Date();
    return activations.find(activation => 
      activation.booster_id === boosterId && 
      activation.status === 'active' &&
      (!activation.expires_at || new Date(activation.expires_at) > now)
    ) || null;
  }, [activations]);

  const isBoosterActive = useCallback((boosterId: string): boolean => {
    return getActiveBooster(boosterId) !== null;
  }, [getActiveBooster]);

  const getTimeRemaining = useCallback((boosterId: string) => {
    const activation = getActiveBooster(boosterId);
    if (!activation || !activation.expires_at) return null;

    const now = new Date();
    const expiry = new Date(activation.expires_at);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  }, [getActiveBooster]);

  useEffect(() => {
    fetchActivations();

    // Configurar listener para mudanças em tempo real
    const channel = supabase
      .channel('booster_activations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booster_activations'
        },
        () => {
          fetchActivations();
        }
      )
      .subscribe();

    // Atualizar a cada minuto para recalcular tempos
    const interval = setInterval(() => {
      setActivations(prev => [...prev]); // Força re-render para atualizar contadores
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchActivations]);

  return {
    activations,
    loading,
    error,
    refetch: fetchActivations,
    activateBooster,
    getActiveBooster,
    isBoosterActive,
    getTimeRemaining
  };
}