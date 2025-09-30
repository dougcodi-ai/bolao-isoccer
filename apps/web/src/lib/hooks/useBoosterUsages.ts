"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface BoosterUsage {
  id: string;
  user_id: string;
  booster: string;
  status: string;
  pool_id?: string;
  match_id?: string;
  used_at: string;
  created_at: string;
}

export function useBoosterUsages(limit: number = 10) {
  const [userId, setUserId] = useState<string | null>(null);
  const [usages, setUsages] = useState<BoosterUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega sessão uma única vez e mantém userId atualizado
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const uid = data.session?.user?.id ?? null;
        setUserId(uid);
        if (!uid) {
          setUsages([]);
          setLoading(false);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Falha ao obter sessão");
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) setUsages([]);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchUsages = useCallback(async (uid?: string | null) => {
    const target = uid ?? userId;
    if (!target) {
      setUsages([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("booster_usages")
        .select("*")
        .eq("user_id", target)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      
      setUsages(data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar histórico de usos");
      setUsages([]);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  // Busca inicial/quando userId muda
  useEffect(() => {
    if (!userId) return;
    void fetchUsages(userId);
  }, [userId, fetchUsages]);

  // Realtime para novos usos
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`usages_${userId}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "booster_usages", 
          filter: `user_id=eq.${userId}` 
        },
        (payload: any) => {
          const newUsage = payload?.new || payload?.record;
          if (newUsage) {
            setUsages(prev => [newUsage, ...prev.slice(0, limit - 1)]);
          }
        }
      )
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "booster_usages", 
          filter: `user_id=eq.${userId}` 
        },
        (payload: any) => {
          const updatedUsage = payload?.new || payload?.record;
          if (updatedUsage) {
            setUsages(prev => 
              prev.map(usage => 
                usage.id === updatedUsage.id ? updatedUsage : usage
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      try { 
        supabase.removeChannel(channel); 
      } catch {}
    };
  }, [userId, limit]);

  return { 
    usages, 
    loading, 
    error, 
    refetch: fetchUsages 
  } as const;
}