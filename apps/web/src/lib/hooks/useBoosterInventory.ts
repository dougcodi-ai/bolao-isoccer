"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type BoosterInventoryMap = Record<string, number>;

export function useBoosterInventory() {
  const [userId, setUserId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<BoosterInventoryMap>({});
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
          setInventory({});
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
      if (!uid) setInventory({});
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchInventory = useCallback(async (uid?: string | null) => {
    const target = uid ?? userId;
    if (!target) {
      setInventory({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: purchases, error: errP }, { data: usages, error: errU }] = await Promise.all([
        supabase.from("booster_purchases").select("booster, amount").eq("user_id", target),
        supabase.from("booster_usages").select("booster, status").eq("user_id", target),
      ]);
      if (errP) throw errP;
      if (errU) throw errU;
      const inv: BoosterInventoryMap = {};
      for (const row of (purchases as any[]) || []) {
        const key = String((row as any).booster);
        inv[key] = (inv[key] || 0) + (Number((row as any).amount) || 0);
      }
      for (const u of (usages as any[]) || []) {
        const key = String((u as any).booster);
        const status = String((u as any).status || "consumed");
        // Subtrai usos "consumed" e reservas "pending" para refletir disponibilidade real
        if (status === "consumed" || status === "pending") inv[key] = Math.max(0, (inv[key] || 0) - 1);
      }
      setInventory(inv);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar inventário");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Busca inicial/quando userId muda
  useEffect(() => {
    if (!userId) return; // Protected nas páginas deve garantir auth
    void fetchInventory(userId);
  }, [userId, fetchInventory]);

  // Realtime do usuário
  useEffect(() => {
    if (!userId) return;

    const chPurch = supabase
      .channel(`inv_purchases_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booster_purchases", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const nr: any = payload?.new || payload?.record || {};
          const booster: string = nr?.booster;
          const amount: number = typeof nr?.amount === "number" ? nr.amount : 1;
          if (!booster) return;
          setInventory((prev) => ({ ...prev, [booster]: (prev[booster] || 0) + amount }));
        },
      )
      .subscribe();

    const handleUsage = (nrow?: any, orow?: any) => {
      const newStatus = String(nrow?.status || "");
      const oldStatus = String(orow?.status || "");
      const booster: string | undefined = nrow?.booster || orow?.booster;
      if (!booster) return;
      const reduces = (s: string) => s === "consumed" || s === "pending";
      const wasReducing = reduces(oldStatus);
      const nowReducing = reduces(newStatus);
      if (!wasReducing && nowReducing) {
        // Passou a reduzir: subtrai 1
        setInventory((prev) => ({ ...prev, [booster]: Math.max(0, (prev[booster] || 0) - 1) }));
      } else if (wasReducing && !nowReducing) {
        // Deixou de reduzir (ex.: refunded/expired/reverted): adiciona 1 de volta
        setInventory((prev) => ({ ...prev, [booster]: (prev[booster] || 0) + 1 }));
      }
    };

    const chUsage = supabase
      .channel(`inv_usages_${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booster_usages", filter: `user_id=eq.${userId}` },
        (payload: any) => handleUsage(payload?.new || payload?.record)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "booster_usages", filter: `user_id=eq.${userId}` },
        (payload: any) => handleUsage(payload?.new, payload?.old)
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(chPurch); } catch {}
      try { supabase.removeChannel(chUsage); } catch {}
    };
  }, [userId]);

  // Refetch extra em foco/visibilidade
  useEffect(() => {
    if (!userId) return;
    const onFocus = () => { void fetchInventory(userId); };
    const onVis = () => { if (document.visibilityState === "visible") void fetchInventory(userId); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, fetchInventory]);

  const total = useMemo(() => Object.values(inventory).reduce((a, b) => a + b, 0), [inventory]);

  return { userId, inventory, total, loading, error, refetch: fetchInventory } as const;
}