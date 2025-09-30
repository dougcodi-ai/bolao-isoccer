"use client";

import Protected from "@/components/Protected";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import teamLogoMapData from "../../../../../src/data/teamLogoMap.json";
import { getTeamLogoSync } from "@/utils/logoCache";

// Tipos básicos
type Pool = { id: string; name: string; code: string, role?: string };
type Profile = { id: string; display_name: string | null; avatar_url: string | null };
type Team = { id: string; name?: string; shortName?: string; acronym?: string; logoUrl?: string | null };

type Match = {
  id: string;
  utcDate: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  score?: { home?: number | null; away?: number | null } | null;
  round?: number;
};

type Prediction = {
  id: string;
  match_id: string;
  user_id: string;
  home_pred: number;
  away_pred: number;
  created_at: string;
};

const teamLogoMap: Record<string, string> = teamLogoMapData;

export default function DashboardPage() {
  // Estados
  const [user, setUser] = useState<Profile | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [credits, setCredits] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  // Toasts simples (não bloqueantes)
  type Toast = { id: number; type: "success" | "error" | "info"; message: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (type: Toast["type"], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [kpis, setKpis] = useState({
    totalPools: 0,
    totalPredictions: 0,
    totalPoints: 0
  });
  
  // Estados para novos componentes
  const [selectedPoolIndex, setSelectedPoolIndex] = useState(0);
  const [urgentMatch, setUrgentMatch] = useState<Match | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Dados de teste para o carrossel de bolões
  const testPools = [
    {
      id: 1,
      name: "Teste AI",
      description: "Bolão exemplo",
      participants: 8,
      userPosition: 1,
      userPoints: 150,
      code: "AI1234",
    },
    {
      id: 2,
      name: "Doug Teste 1",
      description: "Bolão exemplo",
      participants: 12,
      userPosition: 3,
      userPoints: 120,
      code: "DOUG01",
    },
    {
      id: 3,
      name: "Amigos FC",
      description: "Bolão exemplo",
      participants: 6,
      userPosition: 2,
      userPoints: 135,
      code: "AMIGOS",
    }
  ];

  // Dados de teste para o card de urgência
  const testUrgentMatch = {
    id: 1,
    homeTeam: {
      id: 1,
      name: "Flamengo",
      shortName: "FLA"
    },
    awayTeam: {
      id: 2,
      name: "Palmeiras",
      shortName: "PAL"
    },
    utcDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 horas a partir de agora
  };

  // Mapeamento de logos dos times
  const teamLogos: Record<string, string> = {
    "FLA": "https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png",
    "FLAMENGO": "https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png",
    "PAL": "https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png",
    "PALMEIRAS": "https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png"
  };

  // Dados de teste para garantir exibição
  const finalTestPools = pools.length > 0 ? pools : testPools;
  const [logos, setLogos] = useState<Record<string, string>>({});

  // Função para buscar dados ao vivo
  const fetchLive = async () => {
    try {
      const response = await fetch('/api/football/live');
      if (response.ok) {
        const data = await response.json();
        if (data.ok && Array.isArray(data.matches)) {
          setLiveMatches(data.matches);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar partidas ao vivo:', error);
    }
  };

  // Função para encontrar a partida mais urgente
  const findUrgentMatch = (matches: Match[]) => {
    const now = new Date();
    const upcomingMatches = matches.filter(match => {
      const matchDate = new Date(match.utcDate);
      return matchDate > now;
    });

    if (upcomingMatches.length === 0) return null;

    return upcomingMatches.reduce((closest, current) => {
      const closestTime = new Date(closest.utcDate).getTime() - now.getTime();
      const currentTime = new Date(current.utcDate).getTime() - now.getTime();
      return currentTime < closestTime ? current : closest;
    });
  };

  // Função para calcular tempo restante
  const calculateTimeRemaining = (matchDate: string) => {
    const now = new Date();
    const match = new Date(matchDate);
    const diff = match.getTime() - now.getTime();

    if (diff <= 0) return 'Expirado';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // useEffect para buscar dados ao vivo
  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const response = await fetch('/api/football/live');
        if (response.ok) {
          const data = await response.json();
          if (data.ok && Array.isArray(data.matches)) {
            setLiveMatches(data.matches);
            
            // Encontrar partida mais urgente
            const urgent = findUrgentMatch(data.matches);
            setUrgentMatch(urgent);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar partidas ao vivo:', error);
      }
    };

    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000); // Atualiza a cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  // useEffect para atualizar contador regressivo
  useEffect(() => {
    if (!urgentMatch) return;

    const updateTimer = () => {
      const remaining = calculateTimeRemaining(urgentMatch.utcDate);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 60000); // Atualiza a cada minuto

    return () => clearInterval(timer);
  }, [urgentMatch]);

  // useEffect para autenticação e carregamento de dados
  useEffect(() => {
    let mounted = true;

    const loadUserData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!mounted || !userData.user) return;

        // Buscar perfil do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single();

        if (mounted && profile) {
          setUser(profile);
        }

        // Buscar bolões do usuário
        const { data: poolsData } = await supabase
          .from('pool_members')
          .select(`
            pool_id,
            role,
            pools!inner(id, name, code)
          `)
          .eq('user_id', userData.user.id);

        if (mounted && poolsData) {
          const userPools = poolsData.map((pm: any) => ({ ...pm.pools, role: pm.role })).filter(Boolean);
          setPools(userPools);
        }

        // Buscar palpites do usuário
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (mounted && predictionsData) {
          setPredictions(predictionsData);
        }

        // Buscar KPIs
        const { data: kpiData } = await supabase
          .from('user_kpis')
          .select('*')
          .eq('user_id', userData.user.id)
          .single();

        if (mounted && kpiData) {
          setKpis({
            totalPools: kpiData.total_pools || 0,
            totalPredictions: kpiData.total_predictions || 0,
            totalPoints: kpiData.total_points || 0
          });
        }

      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    };

    loadUserData();

    return () => {
      mounted = false;
    };
  }, []);

  // Função para obter logo do time com cache
  const getLogo = (team?: Team | null): string => {
    if (!team) return "";
    
    // Usar o nome mais específico disponível
    const teamName = team.name || team.shortName || team.acronym || "";
    return getTeamLogoSync(teamName);
  };

  return (
    <Protected>
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Elementos decorativos de futebol */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute top-20 right-8 w-40 h-24 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
            <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
            <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
          </svg>
          <svg className="absolute bottom-40 left-12 w-20 h-20 opacity-8 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1"/>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <svg className="absolute top-1/2 right-4 w-16 h-16 opacity-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        {/* Header do Dashboard */}
        <div className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt="Avatar" 
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm sm:text-lg font-bold">
                      {user?.display_name?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">
                    Olá, {user?.display_name || 'Usuário'}!
                  </h1>
                  <p className="text-xs sm:text-sm text-white/70">
                    Bem-vindo ao seu dashboard
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs sm:text-sm text-white/70">Créditos</p>
                  <p className="text-sm sm:text-lg font-bold">{credits}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs sm:text-sm text-white/70">Pontos</p>
                  <p className="text-sm sm:text-lg font-bold">{kpis.totalPoints}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            
            {/* Coluna Principal */}
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                  <h3 className="text-xs sm:text-sm font-medium text-white/70 mb-2">Total de Bolões</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-400">{kpis.totalPools}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                  <h3 className="text-xs sm:text-sm font-medium text-white/70 mb-2">Palpites Feitos</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-green-400">{kpis.totalPredictions}</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                  <h3 className="text-xs sm:text-sm font-medium text-white/70 mb-2">Pontos Totais</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-400">{kpis.totalPoints}</p>
                </div>
              </div>

              {/* Atalhos Rápidos */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Ações Rápidas
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Link
                    href="/bolao/meus"
                    className="group bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 rounded-xl p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-lg">🎉</span>
                      </div>
                      <p className="text-sm font-medium text-white group-hover:text-blue-200 transition-colors">Meus Bolões</p>
                    </div>
                  </Link>
                  
                  <Link
                    href="/bolao/criar"
                    className="group bg-gradient-to-br from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 rounded-xl p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-lg">➕</span>
                      </div>
                      <p className="text-sm font-medium text-white group-hover:text-green-200 transition-colors">Criar Bolão</p>
                    </div>
                  </Link>
                  
                  <Link
                    href="/palpites"
                    className="group bg-gradient-to-br from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-orange-500/30 rounded-xl p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/20"
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-lg">⚽</span>
                      </div>
                      <p className="text-sm font-medium text-white group-hover:text-orange-200 transition-colors">Palpites</p>
                    </div>
                  </Link>
                  
                  <Link
                    href="/ranking"
                    className="group bg-gradient-to-br from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30 border border-yellow-500/30 rounded-xl p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/20"
                  >
                    <div className="text-center">
                      <div className="w-10 h-10 mx-auto mb-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-lg">🏆</span>
                      </div>
                      <p className="text-sm font-medium text-white group-hover:text-yellow-200 transition-colors">Ranking</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Carrossel de Bolões */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-bold">Meus Bolões</h2>
                  {finalTestPools.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPoolIndex(Math.max(0, selectedPoolIndex - 1))}
                        disabled={selectedPoolIndex === 0}
                        aria-label="Bolão anterior"
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-sm text-white/70">
                        {selectedPoolIndex + 1} de {finalTestPools.length}
                      </span>
                      <button
                        onClick={() => setSelectedPoolIndex(Math.min(finalTestPools.length - 1, selectedPoolIndex + 1))}
                        disabled={selectedPoolIndex === finalTestPools.length - 1}
                        aria-label="Próximo bolão"
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <Link 
                    href="/bolao/criar"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Criar Novo
                  </Link>
                </div>
                
                {finalTestPools.length > 0 ? (
                  <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg p-4 border border-blue-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-blue-300 flex items-center gap-2">
                        {finalTestPools[selectedPoolIndex]?.name}
                        {finalTestPools[selectedPoolIndex]?.role && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 border border-white/20">
                            {finalTestPools[selectedPoolIndex]?.role}
                          </span>
                        )}
                      </h3>
                      <span className="px-3 py-1 bg-blue-500/20 rounded-full text-sm text-blue-300">
                        {finalTestPools[selectedPoolIndex]?.participants?.length || 0} participantes
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-white/70">Minha Posição</p>
                        <p className="text-xl font-bold text-yellow-400">#1</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/70">Pontuação</p>
                        <p className="text-xl font-bold text-green-400">150 pts</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/pools/${finalTestPools[selectedPoolIndex]?.id}`}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
                      >
                        Ver Detalhes
                      </Link>
                      <Link
                        href={`/pools/${finalTestPools[selectedPoolIndex]?.id}/predictions`}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
                      >
                        Fazer Palpites
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <p className="text-sm sm:text-base text-white/70 mb-4">Você ainda não participa de nenhum bolão</p>
                    <Link 
                      href="/bolao/criar"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm"
                    >
                      Criar Meu Primeiro Bolão
                    </Link>
                  </div>
                )}
              </div>

              {/* Seção de Convite */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <h2 className="text-lg sm:text-xl font-bold mb-4">Convide Seus Amigos</h2>
                {/* Dropdown opcional para listas grandes */}
                {finalTestPools.length > 5 && (
                  <div className="mb-3">
                    <label className="block text-xs text-white/60 mb-1">Selecionar Bolão</label>
                    <select
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
                      value={selectedPoolIndex}
                      onChange={(e) => setSelectedPoolIndex(Number(e.target.value))}
                      aria-label="Selecionar bolão para convite"
                    >
                      {finalTestPools.map((p, idx) => (
                        <option key={p.id} value={idx}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {finalTestPools.length > 0 && finalTestPools[selectedPoolIndex]?.code ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base sm:text-lg font-bold text-blue-300">{finalTestPools[selectedPoolIndex]?.name}</h3>
                      {finalTestPools.length > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedPoolIndex(Math.max(0, selectedPoolIndex - 1))}
                            disabled={selectedPoolIndex === 0}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <span className="text-sm text-white/70">
                            {selectedPoolIndex + 1} de {finalTestPools.length}
                          </span>
                          <button
                            onClick={() => setSelectedPoolIndex(Math.min(finalTestPools.length - 1, selectedPoolIndex + 1))}
                            disabled={selectedPoolIndex === finalTestPools.length - 1}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-white/70 mb-2">Compartilhe o código do seu bolão ou envie o link direto:</p>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1">
                        <label className="block text-xs text-white/60 mb-1">Código do Grupo</label>
                        <div className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 font-mono tracking-widest">
                          {finalTestPools[selectedPoolIndex]?.code}
                        </div>
                      </div>
                      <button
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
                        aria-label={`Copiar link de convite do bolão ${finalTestPools[selectedPoolIndex]?.name}`}
                        onClick={() => {
                          const code = finalTestPools[selectedPoolIndex]?.code;
                          if (!code) return;
                          const link = `${window.location.origin}/auth/cadastro?convite=${encodeURIComponent(code)}`;
                          navigator.clipboard.writeText(link).then(() => {
                            pushToast('success', 'Link de convite copiado!');
                          }).catch(() => {
                            pushToast('error', 'Não foi possível copiar. Copie manualmente: ' + link);
                          });
                        }}
                      >
                        Copiar Link
                      </button>
                      <button
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium"
                        aria-label={`Compartilhar convite do bolão ${finalTestPools[selectedPoolIndex]?.name}`}
                        onClick={() => {
                          const code = finalTestPools[selectedPoolIndex]?.code;
                          if (!code) return;
                          const link = `${window.location.origin}/auth/cadastro?convite=${encodeURIComponent(code)}`;
                          const shareData = {
                            title: 'Junte-se ao meu Bolão no iSoccer',
                            text: 'Use este link para entrar no nosso bolão:',
                            url: link,
                          } as ShareData;
                          if (navigator.share) {
                            navigator.share(shareData).catch(() => {
                              navigator.clipboard.writeText(link);
                              pushToast('success', 'Link copiado para compartilhar!');
                            });
                          } else {
                            navigator.clipboard.writeText(link);
                            pushToast('success', 'Link copiado para compartilhar!');
                          }
                        }}
                      >
                        Compartilhar
                      </button>
                    </div>
                    <p className="text-xs text-white/50">Estrutura do link: {`{URL}`}/auth/cadastro?convite={`{CODIGO}`}</p>
                  </div>
                ) : (
                  <p className="text-sm text-white/70">Selecione um bolão com código válido para compartilhar convites.</p>
                )}
              </div>

              {/* Card de Urgência */}
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-red-500/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 animate-pulse"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-red-300">⚡ Palpite Urgente!</h3>
                      <p className="text-sm text-white/70">Prazo se encerrando em breve</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm text-white/70">Tempo restante</p>
                      <p className="text-lg font-bold text-orange-400">
                        {timeRemaining || calculateTimeRemaining(testUrgentMatch.utcDate)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-black/20 rounded-lg p-4 mb-4">
                     <div className="flex items-center justify-center">
                       <div className="flex items-center gap-6">
                         <div className="text-center">
                           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 p-1">
                             <img 
                               src={teamLogos[testUrgentMatch.homeTeam?.shortName || ''] || teamLogos[testUrgentMatch.homeTeam?.name || '']}
                               alt={testUrgentMatch.homeTeam?.name}
                               className="w-full h-full object-contain"
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement;
                                 target.style.display = 'none';
                                 const fallback = target.parentElement?.querySelector('.fallback-logo') as HTMLElement;
                                 if (fallback) fallback.style.display = 'flex';
                               }}
                             />
                             <div className="fallback-logo w-full h-full bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{display: 'none'}}>
                               {testUrgentMatch.homeTeam?.shortName?.charAt(0) || 'F'}
                             </div>
                           </div>
                           <p className="text-sm text-white/70 font-medium">{testUrgentMatch.homeTeam?.shortName}</p>
                         </div>
                         <div className="text-center px-4">
                           <p className="text-lg text-white/70 font-bold">VS</p>
                           <p className="text-xs text-white/50 mt-1">
                             {new Date(testUrgentMatch.utcDate).toLocaleDateString('pt-BR', {
                               day: '2-digit',
                               month: '2-digit',
                               hour: '2-digit',
                               minute: '2-digit'
                             })}
                           </p>
                         </div>
                         <div className="text-center">
                           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 p-1">
                             <img 
                               src={teamLogos[testUrgentMatch.awayTeam?.shortName || ''] || teamLogos[testUrgentMatch.awayTeam?.name || '']}
                               alt={testUrgentMatch.awayTeam?.name}
                               className="w-full h-full object-contain"
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement;
                                 target.style.display = 'none';
                                 const fallback = target.parentElement?.querySelector('.fallback-logo') as HTMLElement;
                                 if (fallback) fallback.style.display = 'flex';
                               }}
                             />
                             <div className="fallback-logo w-full h-full bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{display: 'none'}}>
                               {testUrgentMatch.awayTeam?.shortName?.charAt(0) || 'P'}
                             </div>
                           </div>
                           <p className="text-sm text-white/70 font-medium">{testUrgentMatch.awayTeam?.shortName}</p>
                         </div>
                       </div>
                     </div>
                   </div>
                  
                  <Link
                     href="/palpites"
                     className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-6 py-3 rounded-lg text-center font-bold transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                     </svg>
                     Palpitar Agora!
                   </Link>
                </div>
              </div>

              {/* Feed de Atividade Social */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Atividade dos Amigos
                  </h2>
                  <Link 
                    href="/social" 
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Ver tudo
                  </Link>
                </div>
                
                <div className="space-y-3">
                  {/* Atividade 1 */}
                  <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">M</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90">
                        <span className="font-semibold text-green-400">Marcelo</span> acabou de palpitar em{' '}
                        <Link href="/palpites" className="text-blue-400 hover:text-blue-300 transition-colors">
                          Flamengo vs Palmeiras
                        </Link>
                      </p>
                      <p className="text-xs text-white/50 mt-1">há 5 minutos</p>
                    </div>
                  </div>

                  {/* Atividade 2 */}
                  <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90">
                        <span className="font-semibold text-yellow-400">Ana</span> subiu para a{' '}
                        <span className="font-bold text-orange-400">2ª posição</span> no ranking
                      </p>
                      <p className="text-xs text-white/50 mt-1">há 15 minutos</p>
                    </div>
                  </div>

                  {/* Atividade 3 */}
                  <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">C</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90">
                        <span className="font-semibold text-purple-400">Carlos</span> acertou o placar de{' '}
                        <span className="font-bold text-green-400">São Paulo 2x1 Corinthians</span>
                      </p>
                      <p className="text-xs text-white/50 mt-1">há 1 hora</p>
                    </div>
                  </div>

                  {/* Atividade 4 */}
                  <div className="flex items-start gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">L</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90">
                        <span className="font-semibold text-blue-400">Lucas</span> entrou no bolão{' '}
                        <span className="font-bold text-cyan-400">Amigos FC</span>
                      </p>
                      <p className="text-xs text-white/50 mt-1">há 2 horas</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partidas Ao Vivo */}
              {liveMatches.length > 0 && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
                    Partidas Ao Vivo
                  </h2>
                  <div className="space-y-4">
                    {liveMatches.slice(0, 3).map((match) => (
                      <div key={match.id} className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getLogo(match.homeTeam)} 
                              alt={match.homeTeam?.name || 'Home'} 
                              className="h-8 w-8 object-contain"
                            />
                            <span className="font-medium">
                              {match.homeTeam?.shortName || match.homeTeam?.name || 'Home'}
                            </span>
                          </div>
                          <span className="text-2xl font-bold mx-4">
                            {match.score?.home || 0} - {match.score?.away || 0}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {match.awayTeam?.shortName || match.awayTeam?.name || 'Away'}
                            </span>
                            <img 
                              src={getLogo(match.awayTeam)} 
                              alt={match.awayTeam?.name || 'Away'} 
                              className="h-8 w-8 object-contain"
                            />
                          </div>
                        </div>
                        <span className="text-sm text-red-400 font-medium">AO VIVO</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {/* Palpites Recentes */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <h2 className="text-lg sm:text-xl font-bold">Palpites Recentes</h2>
                  <Link 
                    href="/palpites"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors text-center sm:text-left"
                  >
                    Ver Todos
                  </Link>
                </div>
                {predictions.length > 0 ? (
                  <div className="space-y-3">
                    {predictions.slice(0, 5).map((prediction) => (
                      <div key={prediction.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-black/20 rounded-lg gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <span className="text-xs sm:text-sm text-white/70">
                            {new Date(prediction.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg">
                            {prediction.home_pred} - {prediction.away_pred}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/70 mb-4">Você ainda não fez nenhum palpite</p>
                    <Link 
                      href="/palpites"
                      className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Fazer Meu Primeiro Palpite
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6">
              
              {/* Notificações */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Notificações</h3>
                {notifications.length > 0 ? (
                  <div className="space-y-3">
                    {notifications.slice(0, 3).map((notification, index) => (
                      <div key={index} className="p-3 bg-black/20 rounded-lg">
                        <p className="text-xs sm:text-sm">{notification.message}</p>
                        <p className="text-xs text-white/50 mt-1">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/70 text-xs sm:text-sm">Nenhuma notificação nova</p>
                )}
              </div>

              {/* Links Rápidos */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">Acesso Rápido</h3>
                <div className="space-y-2 sm:space-y-3">
                  <Link
                    href="/palpites"
                    className="block p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                  >
                    <span className="font-medium text-sm sm:text-base">Fazer Palpites</span>
                    <p className="text-xs sm:text-sm text-white/70">Aposte nos próximos jogos</p>
                  </Link>
                  <Link 
                    href="/ranking"
                    className="block p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                  >
                    <span className="font-medium text-sm sm:text-base">Ver Ranking</span>
                    <p className="text-xs sm:text-sm text-white/70">Confira sua posição</p>
                  </Link>
                  {/* Link para Resultados removido */}
                </div>
              </div>

              {/* Menu Hambúrguer - Ações Especiais */}
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Menu
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <Link 
                    href="/loja"
                    className="block p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <div>
                        <span className="font-medium text-sm sm:text-base">Loja</span>
                        <p className="text-xs sm:text-sm text-white/70">Compre itens e upgrades</p>
                      </div>
                    </div>
                  </Link>
                  <Link 
                    href="/regras"
                    className="block p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <span className="font-medium text-sm sm:text-base">Regras do Bolão</span>
                        <p className="text-xs sm:text-sm text-white/70">Como funciona o jogo</p>
                      </div>
                    </div>
                  </Link>
                  <button 
                    className="w-full text-left p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'iSoccer - Bolão de Futebol',
                          text: 'Venha jogar comigo no melhor bolão de futebol!',
                          url: window.location.origin
                        });
                      } else {
                        navigator.clipboard.writeText(window.location.origin);
                        pushToast('success', 'Link copiado para a área de transferência!');
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <div>
                        <span className="font-medium text-sm sm:text-base">Convidar Amigos</span>
                        <p className="text-xs sm:text-sm text-white/70">Compartilhe o bolão</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Barra de Navegação Inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 z-50">
        <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
          {/* Home */}
          <Link 
            href="/dashboard" 
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors hover:bg-white/10 text-blue-400"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span className="text-xs font-medium">Home</span>
          </Link>

          {/* Palpites */}
          <Link 
            href="/palpites" 
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors hover:bg-white/10 text-white/70"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-medium">Palpites</span>
          </Link>

          {/* Ranking */}
          <Link 
            href="/ranking" 
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors hover:bg-white/10 text-white/70"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium">Ranking</span>
          </Link>

          {/* Perfil */}
          <Link 
            href="/profile" 
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors hover:bg-white/10 text-white/70"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium">Perfil</span>
          </Link>
        </div>
      </nav>

      {/* Espaçamento para a barra de navegação inferior */}
      <div className="h-20"></div>
    </Protected>
  );
}