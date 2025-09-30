"use client"

import Protected from "@/components/Protected";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Route } from 'next'
import { useBoosterInventory } from "@/lib/hooks/useBoosterInventory";
import { useBoosterActivations } from "@/lib/hooks/useBoosterActivations";
import { useBoosterUsages } from "@/lib/hooks/useBoosterUsages";

// Tipos básicos
type Pool = { id: string; name: string; code: string; owner_id: string; premium?: boolean; max_members?: number; created_at: string };
type Profile = { id: string; display_name: string | null; avatar_url: string | null; preferences?: any | null; created_at?: string | null };
type PointsRow = { pool_id: string; user_id: string; points: number };
type BoosterInv = Record<string, number>;
type BoosterUsage = { id: string; pool_id: string; user_id: string; match_id: string | null; booster: string; used_at: string; expires_at: string | null };
type Payment = { id: string; amount_cents: number | null; status: string; created_at: string; pool_id: string | null; stripe_session_id: string | null };
type MemberRow = { pool_id: string; user_id: string; role: string; joined_at: string };

export default function PerfilPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [rankingPos, setRankingPos] = useState<number | null>(null);
  const [stats, setStats] = useState<{ exact: number; tend: number; total: number } | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [memberships, setMemberships] = useState<MemberRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  type Toast = { id: number; type: "success" | "error" | "info"; message: string };
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const pushToast = (type: Toast["type"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Campos do perfil
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
  
  // Estados de salvamento
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Hooks de boosters
  const { inventory: inv, loading: boostersLoading } = useBoosterInventory();
  const { usages, loading: usagesLoading } = useBoosterUsages(5);
  const { 
    activateBooster, 
    isBoosterActive, 
    getTimeRemaining,
    loading: activationsLoading 
  } = useBoosterActivations();
  
  // Estado para ativação do Escudo
  const [activatingShield, setActivatingShield] = useState(false);

  const EMOJI_SEEDS = ["⚽", "🏆", "🥅", "🎯", "🔥", "⭐", "💎", "🚀", "🎮", "🎲"];

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  // Função única para salvar todas as informações do perfil
  const saveProfile = async () => {
    if (!userId) return;
    
    setSavingProfile(true);
    
    try {
      // Buscar preferências atuais
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single();
      
      const currentPreferences = currentProfile?.preferences || {};
      
      // Atualizar todas as informações
      const updates: any = {
        preferences: {
          ...currentPreferences,
          phone: phone,
          instagram: instagram,
          avatar_seed: avatarSeed
        }
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      
      if (error) throw error;
      
      pushToast("success", "Perfil atualizado com sucesso!");
      
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      pushToast("error", "Erro ao salvar perfil. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  // useEffect principal para carregar dados do usuário
  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        setUserId(user.id);
        
        // Carregar perfil
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
          setName(profileData.display_name || "");
          
          // Carregar dados das preferências
          const prefs = profileData.preferences || {};
          setEmail(prefs.email || user.email || "");
          setPhone(prefs.phone || "");
          setInstagram(prefs.instagram || "");
          setAvatarSeed(prefs.avatar_seed || "");
        }
        
        // Carregar bolões do usuário
        const { data: poolsData } = await supabase
          .from('pool_members')
          .select(`
            pool_id,
            pools!inner(id, name, code, owner_id, premium, max_members, created_at)
          `)
          .eq('user_id', user.id);
        
        if (poolsData) {
          const userPools = poolsData.map(pm => pm.pools).filter(Boolean);
          setPools(userPools);
          
          // Selecionar primeiro bolão por padrão
          if (userPools.length > 0) {
            setSelectedPoolId(userPools[0].id);
          }
        }
        
        // Carregar memberships
        const { data: membershipsData } = await supabase
          .from('pool_members')
          .select('*')
          .eq('user_id', user.id);
        
        if (membershipsData) {
          setMemberships(membershipsData);
        }
        
        // Carregar todos os membros dos bolões do usuário
        if (poolsData && poolsData.length > 0) {
          const poolIds = poolsData.map(pm => pm.pool_id);
          const { data: membersData } = await supabase
            .from('pool_members')
            .select('*')
            .in('pool_id', poolIds);
          
          if (membersData) {
            setMembers(membersData);
          }
        }
        
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadUserData();
  }, []);

  // useEffect para carregar pontos quando um bolão é selecionado
  useEffect(() => {
    if (!userId || !selectedPoolId) return;
    
    async function loadPoolData() {
      try {
        // Carregar pontos do usuário no bolão selecionado
        const { data: pointsData } = await supabase
          .from('points')
          .select('points')
          .eq('user_id', userId)
          .eq('pool_id', selectedPoolId)
          .single();
        
        setPoints(pointsData?.points || 0);
        
        // Carregar posição no ranking
        const { data: rankingData } = await supabase
          .from('points')
          .select('user_id, points')
          .eq('pool_id', selectedPoolId)
          .order('points', { ascending: false });
        
        if (rankingData) {
          const userRank = rankingData.findIndex(r => r.user_id === userId) + 1;
          setRankingPos(userRank > 0 ? userRank : null);
        }
        
        // Carregar estatísticas de palpites
        const { data: statsData } = await supabase
          .from('predictions')
          .select('exact_score, correct_tendency')
          .eq('user_id', userId)
          .eq('pool_id', selectedPoolId);
        
        if (statsData) {
          const exact = statsData.filter(s => s.exact_score).length;
          const tend = statsData.filter(s => s.correct_tendency && !s.exact_score).length;
          setStats({ exact, tend, total: statsData.length });
        }
        
      } catch (error) {
        console.error("Erro ao carregar dados do bolão:", error);
      }
    }
    
    loadPoolData();
  }, [userId, selectedPoolId]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass || newPass !== confirmPass) return;
    
    setChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      
      pushToast("success", "Senha alterada com sucesso!");
      setNewPass("");
      setConfirmPass("");
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      pushToast("error", "Erro ao alterar senha. Tente novamente.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleLeavePool = async (poolId: string, isOwner: boolean) => {
    if (!userId) return;
    
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return;
    
    const confirmMessage = isOwner 
      ? `Tem certeza que deseja sair do bolão "${pool.name}"?\n\nComo você é o criador, a propriedade será transferida para outro membro aleatório.`
      : `Tem certeza que deseja sair do bolão "${pool.name}"?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      if (isOwner) {
        // Transferir propriedade para outro membro
        const otherMembers = members.filter(m => m.pool_id === poolId && m.user_id !== userId);
        if (otherMembers.length > 0) {
          const newOwner = otherMembers[0];
          await supabase
            .from('pools')
            .update({ owner_id: newOwner.user_id })
            .eq('id', poolId);
        }
      }
      
      // Remover o usuário do bolão
      const { error } = await supabase
        .from('pool_members')
        .delete()
        .eq('pool_id', poolId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      pushToast("success", `Você saiu do bolão "${pool.name}".`);
      
      // Atualizar listas
      setPools(pools.filter(p => p.id !== poolId));
      setMemberships(memberships.filter(m => m.pool_id !== poolId));
      setMembers(members.filter(m => !(m.pool_id === poolId && m.user_id === userId)));
      
      if (selectedPoolId === poolId) {
        setSelectedPoolId(null);
      }
      
    } catch (error) {
      console.error("Erro ao sair do bolão:", error);
      pushToast("error", "Erro ao sair do bolão. Tente novamente.");
    }
  };

  const handleDeletePool = async (poolId: string) => {
    if (!userId) return;
    
    const pool = pools.find(p => p.id === poolId);
    if (!pool || pool.owner_id !== userId) return;
    
    const poolMemberCount = members.filter(m => m.pool_id === poolId).length;
    
    const confirmMessage = `⚠️ ATENÇÃO: EXCLUSÃO PERMANENTE ⚠️

Você está prestes a EXCLUIR PERMANENTEMENTE o bolão:
"${pool.name}"

Esta ação irá:
• Remover todos os ${poolMemberCount} membros do bolão
• Excluir todos os palpites e pontuações
• Remover histórico de boosters e compras
• Esta ação NÃO PODE SER DESFEITA

Os dados pessoais dos usuários (perfis, cadastros) permanecerão intactos.

Tem certeza que deseja continuar?`;
    
    if (!confirm(confirmMessage)) return;
    
    const doubleConfirm = prompt(`⚠️ CONFIRMAÇÃO FINAL ⚠️

Para confirmar a exclusão PERMANENTE, digite EXATAMENTE o nome do bolão:

"${pool.name}"`);
    
    if (doubleConfirm !== pool.name) {
      pushToast("error", "Nome do bolão não confere. Exclusão cancelada por segurança.");
      return;
    }
    
    try {
      const { data: poolCheck } = await supabase
        .from('pools')
        .select('owner_id')
        .eq('id', poolId)
        .single();
      
      if (!poolCheck || poolCheck.owner_id !== userId) {
        pushToast("error", "Você não tem permissão para excluir este bolão.");
        return;
      }
      
      const { error } = await supabase
        .from('pools')
        .delete()
        .eq('id', poolId)
        .eq('owner_id', userId);
      
      if (error) throw error;
      
      pushToast("success", `Bolão "${pool.name}" foi excluído permanentemente.`);
      
      setPools(pools.filter(p => p.id !== poolId));
      setMemberships(memberships.filter(m => m.pool_id !== poolId));
      setMembers(members.filter(m => m.pool_id !== poolId));
      
      if (selectedPoolId === poolId) {
        setSelectedPoolId(null);
      }
      
    } catch (error) {
      console.error("Erro ao excluir bolão:", error);
      pushToast("error", "Erro interno. Não foi possível excluir o bolão.");
    }
  };

  const handleActivateShield = async () => {
    if (!selectedPoolId) {
      pushToast("error", "Selecione um bolão primeiro");
      return;
    }

    if (activatingShield) return;

    setActivatingShield(true);
    try {
      const result = await activateBooster("o_escudo", selectedPoolId);
      
      if (result.success) {
        pushToast("success", "Escudo ativado com sucesso! Proteção por 7 dias.");
      } else {
        pushToast("error", result.message);
      }
    } catch (error: any) {
      console.error("Erro ao ativar Escudo:", error);
      pushToast("error", "Erro ao ativar Escudo");
    } finally {
      setActivatingShield(false);
    }
  };

  if (loading) return (
    <Protected>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10" />
            <div className="h-6 bg-white/10 rounded w-48" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="h-20 bg-white/10 rounded-xl" />
            <div className="h-20 bg-white/10 rounded-xl" />
            <div className="h-20 bg-white/10 rounded-xl" />
            <div className="h-20 bg-white/10 rounded-xl" />
          </div>
        </div>
      </div>
    </Protected>
  );

  return (
    <Protected>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Elementos decorativos de futebol */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute top-24 right-12 w-32 h-20 opacity-5 text-green-500" viewBox="0 0 100 60" fill="currentColor">
            <rect x="0" y="0" width="100" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
            <circle cx="50" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1="50" y1="0" x2="50" y2="60" stroke="currentColor" strokeWidth="1"/>
          </svg>
          <svg className="absolute bottom-32 left-16 w-16 h-16 opacity-8 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1"/>
          </svg>
          <svg className="absolute top-1/2 right-1/4 w-12 h-12 opacity-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z"/>
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Header da página */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Perfil</h1>
                <p className="text-white/70">Gerencie suas informações pessoais</p>
              </div>
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div className="space-y-8">
            {/* Card de Perfil */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Informações do Perfil</h2>
              
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-white/20">
                    {avatarSeed ? (
                      <span className="text-4xl flex items-center justify-center h-full" aria-label="Avatar por emoji">{avatarSeed}</span>
                    ) : profile?.avatar_url ? (
                      <Image src={profile.avatar_url} alt="Avatar" fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/80 text-xl font-bold" aria-hidden>
                        {(profile?.display_name || '').charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  
                  {/* Seletor de Emoji */}
                  <div className="flex flex-wrap gap-2 max-w-xs">
                    {EMOJI_SEEDS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setAvatarSeed(e)}
                        className={`w-8 h-8 rounded-lg border transition-all duration-200 ${
                          avatarSeed === e 
                            ? 'border-blue-400 bg-blue-400/20' 
                            : 'border-white/20 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Informações */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{profile?.display_name || 'Seu Perfil'}</h3>
                    <p className="text-sm text-white/70">ID: {userId}</p>
                    <p className="text-sm text-white/70">
                      Conta criada em: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>

                  {/* Campo Nome - Não editável */}
                  <div>
                    <label htmlFor="display_name" className="text-sm font-semibold mb-1 block text-white">
                      Nome <span className="text-green-400" title="Preenchido automaticamente">✓</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="display_name"
                        type="text"
                        value={name}
                        readOnly
                        placeholder="Preenchido automaticamente"
                        className="flex-1 bg-white/5 text-white/70 placeholder-white/40 px-4 py-2 border border-white/10 rounded-lg cursor-not-allowed"
                      />
                      <div className="text-xs text-white/50 px-4 py-2">
                        Auto
                      </div>
                    </div>
                  </div>

                  {/* Campo Email - Não editável */}
                  <div>
                    <label htmlFor="email" className="text-sm font-semibold mb-1 block text-white">
                      Email <span className="text-green-400" title="Preenchido automaticamente">✓</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="email"
                        type="email"
                        value={email}
                        readOnly
                        placeholder="Preenchido automaticamente"
                        className="flex-1 bg-white/5 text-white/70 placeholder-white/40 px-4 py-2 border border-white/10 rounded-lg cursor-not-allowed"
                      />
                      <div className="text-xs text-white/50 px-4 py-2">
                        Auto
                      </div>
                    </div>
                  </div>

                  {/* Campo Telefone */}
                  <div>
                    <label htmlFor="phone" className="text-sm font-semibold mb-1 block text-white">
                      Telefone
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                        className="flex-1 bg-white/10 text-white placeholder-white/50 px-4 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Campo Instagram */}
                  <div>
                    <label htmlFor="instagram" className="text-sm font-semibold mb-1 block text-white">
                      Instagram
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center bg-white/10 border border-white/20 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                        <span className="text-white/70 px-4 py-2">@</span>
                        <input
                          id="instagram"
                          type="text"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          placeholder="insira aqui seu insta"
                          className="flex-1 bg-transparent text-white placeholder-white/50 px-0 py-2 pr-4 border-0 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Botão único para salvar perfil */}
                  <div className="pt-4 border-t border-white/10">
                    <button
                      onClick={saveProfile}
                      disabled={savingProfile}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-white/10 disabled:to-white/10 text-white px-6 py-3 rounded-lg transition-all duration-200 disabled:cursor-not-allowed font-semibold"
                    >
                      {savingProfile ? "Salvando Perfil..." : "Salvar Perfil"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Card de Estatísticas */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Estatísticas</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{pools.length}</p>
                  <p className="text-sm text-white/70">Bolões</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{points}</p>
                  <p className="text-sm text-white/70">Pontos</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{rankingPos || '-'}</p>
                  <p className="text-sm text-white/70">Posição</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                  <p className="text-sm text-white/70">Palpites</p>
                </div>
              </div>
            </div>

            {/* Card de Segurança */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Segurança</h2>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-white">Nova Senha</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-white">Confirmar Senha</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-white/10 text-white placeholder-white/50 px-4 py-2 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={changingPass || !newPass || newPass !== confirmPass}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-white/10 text-white px-6 py-2 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {changingPass ? "Alterando..." : "Alterar Senha"}
                </button>
              </form>
            </div>

            {/* Seção Boosters */}
             <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-2xl">
               <h2 className="text-xl font-bold text-white mb-6">Meus Boosters</h2>
               
               {selectedPoolId ? (
                 <div className="space-y-6">
                   {/* Status do Escudo */}
                   <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg p-4 border border-blue-400/30">
                     <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3">
                         <span className="text-2xl">🛡️</span>
                         <div>
                           <h3 className="text-lg font-semibold text-white">Escudo</h3>
                           <p className="text-white/70 text-sm">Protege seus palpites por 7 dias</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-white font-semibold">
                           Disponível: {inv.o_escudo || 0}
                         </p>
                       </div>
                     </div>

                     {isBoosterActive("o_escudo") ? (
                       <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <span className="text-green-400">✓</span>
                             <span className="text-white font-medium">Escudo Ativo</span>
                           </div>
                           <div className="text-right">
                             {(() => {
                               const timeRemaining = getTimeRemaining("o_escudo");
                               if (!timeRemaining) return <span className="text-white/70">Calculando...</span>;
                               
                               return (
                                 <div className="text-white">
                                   <p className="font-mono text-sm">
                                     {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
                                   </p>
                                   <p className="text-white/70 text-xs">restantes</p>
                                 </div>
                               );
                             })()}
                           </div>
                         </div>
                         <p className="text-white/70 text-sm mt-2">
                           Seus palpites estão protegidos e ocultos dos outros jogadores até o início das partidas.
                         </p>
                       </div>
                     ) : (
                       <div>
                         {(inv.o_escudo || 0) > 0 ? (
                           <button
                             onClick={handleActivateShield}
                             disabled={activatingShield}
                             className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed"
                           >
                             {activatingShield ? "Ativando..." : "Ativar Escudo"}
                           </button>
                         ) : (
                           <div className="text-center py-3">
                             <p className="text-white/70 text-sm mb-2">Você não possui este booster</p>
                             <a 
                               href="/boosters" 
                               className="text-blue-400 hover:text-blue-300 text-sm underline"
                             >
                               Comprar Escudo
                             </a>
                           </div>
                         )}
                       </div>
                     )}
                   </div>

                   {/* Inventário de Outros Boosters */}
                   <div>
                     <h3 className="text-lg font-semibold text-white mb-4">Outros Boosters</h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       {Object.entries(inv).filter(([booster]) => booster !== 'o_escudo').map(([booster, count]) => (
                         <div key={booster} className="bg-white/10 rounded-lg p-4 text-center border border-white/20">
                           <div className="text-2xl mb-2">
                             {booster === 'double_points' && '⚡'}
                             {booster === 'segunda_chance' && '🔄'}
                             {booster === 'o_esquecido' && '💭'}
                             {booster === 'palpite_automatico' && '🤖'}
                             {booster === 'vision' && '👁️'}
                             {booster === 'luck' && '🍀'}
                           </div>
                           <p className="text-white font-semibold">{count}</p>
                           <p className="text-white/70 text-sm capitalize">
                             {booster.replace(/_/g, ' ').replace('o ', 'O ')}
                           </p>
                         </div>
                       ))}
                     </div>
                   </div>
 
                   {/* Histórico de Usos Recentes */}
                   {usages.length > 0 && (
                     <div>
                       <h3 className="text-lg font-semibold text-white mb-4">Usos Recentes</h3>
                       <div className="space-y-2 max-h-48 overflow-y-auto">
                         {usages.map((usage) => (
                           <div key={usage.id} className="bg-white/10 rounded-lg p-3 border border-white/20">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <span className="text-lg">
                                   {usage.booster === 'o_escudo' && '🛡️'}
                                   {usage.booster === 'segunda_chance' && '🔄'}
                                   {usage.booster === 'o_esquecido' && '⏰'}
                                   {usage.booster === 'palpite_automatico' && '🤖'}
                                 </span>
                                 <div>
                                   <p className="text-white font-medium">
                                     {usage.booster.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                   </p>
                                   <p className="text-white/70 text-xs">
                                     {new Date(usage.created_at).toLocaleDateString('pt-BR', {
                                       day: '2-digit',
                                       month: '2-digit',
                                       hour: '2-digit',
                                       minute: '2-digit'
                                     })}
                                   </p>
                                 </div>
                               </div>
                               <span className={`text-xs font-medium px-2 py-1 rounded ${
                                 usage.status === 'consumed' ? 'bg-red-500/20 text-red-400' :
                                 usage.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                 usage.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                 'bg-gray-500/20 text-gray-400'
                               }`}>
                                 {usage.status === 'consumed' ? 'Usado' :
                                  usage.status === 'pending' ? 'Pendente' :
                                  usage.status === 'active' ? 'Ativo' :
                                  usage.status}
                               </span>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               ) : (
                 <div className="text-center py-8">
                   <div className="text-white/50 mb-4">🛡️</div>
                   <p className="text-white/70">Selecione um bolão para gerenciar seus boosters.</p>
                 </div>
               )}
             </section>

            {/* Seção Meus Bolões */}
            <section className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Meus Bolões</h2>
              
              {pools.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-white/50 mb-4">🎯</div>
                  <p className="text-white/70">Você ainda não participa de nenhum bolão.</p>
                  <div className="mt-4 space-x-3">
                    <a href="/bolao/criar" className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-all duration-200">
                      Criar Bolão
                    </a>
                    <a href="/bolao/entrar" className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-all duration-200">
                      Entrar em Bolão
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pools.map((pool) => {
                    const isOwner = pool.owner_id === userId;
                    const memberCount = members.filter(m => m.pool_id === pool.id).length;
                    
                    return (
                      <div key={pool.id} className="bg-white/10 rounded-lg p-4 border border-white/20">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-white text-lg">{pool.name}</h3>
                              {isOwner && (
                                <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-xs font-medium">
                                  Criador
                                </span>
                              )}
                              {pool.premium && (
                                <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                                  Premium
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-white/70">
                              <span>Código: <span className="font-mono text-white">{pool.code}</span></span>
                              <span>Membros: {memberCount}/{pool.max_members || 50}</span>
                              <span>Criado em: {new Date(pool.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isOwner ? (
                              <>
                                <button
                                  onClick={() => handleLeavePool(pool.id, true)}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm transition-all duration-200"
                                  title="Sair do bolão (transfere propriedade)"
                                >
                                  Sair
                                </button>
                                <button
                                  onClick={() => handleDeletePool(pool.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm transition-all duration-200"
                                  title="Excluir bolão permanentemente"
                                >
                                  Excluir
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleLeavePool(pool.id, false)}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm transition-all duration-200"
                                title="Sair do bolão"
                              >
                                Sair
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Toasts */}
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg px-3 py-2 shadow-lg border ${
                t.type === "success" ? "bg-green-500/90 border-green-400 text-white" :
                t.type === "error" ? "bg-red-500/90 border-red-400 text-white" :
                "bg-slate-700/90 border-slate-600 text-white"
              }`}
            >
              <p className="text-sm">{t.message}</p>
            </div>
          ))}
        </div>
      </div>
    </Protected>
  );
}