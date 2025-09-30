"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type GlobalState = {
  selectedPoolId: string | null;
  selectedChampionship: string | null;
};

type GlobalStateContextValue = {
  globalState: GlobalState;
  setSelectedPoolId: (id: string | null) => void;
  setSelectedChampionship: (champ: string | null) => void;
};

const GlobalStateContext = createContext<GlobalStateContextValue | undefined>(undefined);

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
  const [selectedPoolId, setSelectedPoolIdState] = useState<string | null>(null);
  const [selectedChampionship, setSelectedChampionshipState] = useState<string | null>(null);

  // Inicializa do localStorage
  useEffect(() => {
    try {
      const p = localStorage.getItem("selectedPoolId");
      const c = localStorage.getItem("selectedChampionship");
      setSelectedPoolIdState(p || null);
      setSelectedChampionshipState(c || null);
    } catch {}
  }, []);

  const setSelectedPoolId = (id: string | null) => {
    setSelectedPoolIdState(id);
    try {
      if (id) localStorage.setItem("selectedPoolId", id);
      else localStorage.removeItem("selectedPoolId");
    } catch {}
  };

  const setSelectedChampionship = (champ: string | null) => {
    setSelectedChampionshipState(champ);
    try {
      if (champ) localStorage.setItem("selectedChampionship", champ);
      else localStorage.removeItem("selectedChampionship");
    } catch {}
  };

  const value = useMemo<GlobalStateContextValue>(() => ({
    globalState: { selectedPoolId, selectedChampionship },
    setSelectedPoolId,
    setSelectedChampionship,
  }), [selectedPoolId, selectedChampionship]);

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) throw new Error("useGlobalState deve ser usado dentro de GlobalStateProvider");
  return ctx;
}