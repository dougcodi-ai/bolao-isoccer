"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ConsumeBoosterParams {
  booster: string;
  poolId?: string | null;
  matchId?: string | null;
  status?: string;
}

export interface ConsumeBoosterResult {
  ok: boolean;
  usage_id?: string;
  message?: string;
  reason?: string;
}

export function useBoosterConsumption() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consumeBooster = async (params: ConsumeBoosterParams): Promise<ConsumeBoosterResult> => {
    setLoading(true);
    setError(null);

    try {
      // Obter token de autenticação
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error("Usuário não autenticado");
      }

      const response = await fetch("/api/boosters/use", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          booster: params.booster,
          poolId: params.poolId,
          matchId: params.matchId,
          status: params.status || "consumed",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao consumir booster");
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || "Erro inesperado ao consumir booster";
      setError(errorMessage);
      return {
        ok: false,
        message: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    consumeBooster,
    loading,
    error,
  };
}