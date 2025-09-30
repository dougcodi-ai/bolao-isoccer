"use client";

import { useState } from "react";
import Protected from "@/components/Protected";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useGlobalState } from "@/context/GlobalStateContext";
import { Trophy, Users, Star, Crown, Zap } from "lucide-react";

export default function CreatePoolPage() {
  const router = useRouter();
  const { setSelectedPoolId, setSelectedChampionship } = useGlobalState();
  const [name, setName] = useState("");
  const [planKey, setPlanKey] = useState<"free"|"craque"|"lenda"|"fenomeno"|"galera">("free");
  const [championship, setChampionship] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Planos disponíveis replicados da página original
  const PLANS = [
    { 
      key: "free" as const, 
      title: "Gratuito", 
      range: "01 a 10 participantes", 
      price: "R$ 0,00", 
      cents: 0, 
      max: 10, 
      premium: false,
      icon: Users,
      popular: true,
      description: "Perfeito para começar"
    },
    { 
      key: "craque" as const, 
      title: "Craque", 
      range: "11 a 20 participantes", 
      price: "R$ 14,90", 
      cents: 1490, 
      max: 20, 
      premium: true,
      icon: Star,
      popular: false,
      description: "Para grupos maiores"
    },
    { 
      key: "lenda" as const, 
      title: "Lenda", 
      range: "21 a 30 participantes", 
      price: "R$ 19,90", 
      cents: 1990, 
      max: 30, 
      premium: true,
      icon: Trophy,
      popular: false,
      description: "Ideal para turmas grandes"
    },
    { 
      key: "fenomeno" as const, 
      title: "Fenômeno", 
      range: "31 a 40 participantes", 
      price: "R$ 24,90", 
      cents: 2490, 
      max: 40, 
      premium: true,
      icon: Crown,
      popular: false,
      description: "Para comunidades"
    },
    { 
      key: "galera" as const, 
      title: "Galera", 
      range: "41 a 50 participantes", 
      price: "R$ 29,90", 
      cents: 2990, 
      max: 50, 
      premium: true,
      icon: Zap,
      popular: false,
      description: "Máxima capacidade"
    },
  ];

  // Campeonatos disponíveis
  const CHAMPIONSHIPS = [
    "Brasileirão Série A",
    "Copa do Brasil", 
    "Brasileirão Série B",
    "Copa Libertadores",
    "Copa Sul-Americana"
  ];

  // Função para gerar código único
  function generateCode(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I/O/1/0 para evitar confusão
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  // Função para garantir código único no banco
  async function generateUniqueCode(maxAttempts = 10): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = generateCode(6);
      
      // Verifica se o código já existe
      const { data, error } = await supabase
        .from("pools")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      
      if (!error && !data) {
        return code; // Código único encontrado
      }
    }
    
    // Fallback: usa timestamp para garantir unicidade
    return `IS-${Date.now().toString(36).toUpperCase()}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setInviteCode(null);
    setLoading(true);

    try {
      // Verificar autenticação
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      
      if (!user) {
        setMessage("Você precisa estar autenticado para criar um bolão.");
        setLoading(false);
        return;
      }

      // Para planos pagos, redirecionar para checkout (implementação futura)
      if (planKey !== "free") {
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          
          const response = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name, planKey, championship }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.url) {
              window.location.href = data.url;
              return;
            }
          }
          
          const errorData = await response.json().catch(() => ({}));
          setMessage(errorData?.message || "Checkout não disponível neste momento. Tente novamente mais tarde.");
        } catch (error: any) {
          setMessage(error?.message || "Erro ao iniciar processo de pagamento.");
        } finally {
          setLoading(false);
        }
        return;
      }

      // Para plano gratuito, criar bolão imediatamente
      const code = await generateUniqueCode();
      const selectedPlan = PLANS.find(p => p.key === planKey)!;

      // Dados do bolão
      const poolData = {
        name: name.trim(),
        owner_id: user.id,
        code,
        premium: selectedPlan.premium,
        max_members: selectedPlan.max,
        created_at: new Date().toISOString(),
      };

      // Inserir bolão na tabela pools
      const { data: poolResult, error: poolError } = await supabase
        .from("pools")
        .insert(poolData)
        .select("id, code")
        .single();

      if (poolError) {
        throw new Error(`Erro ao criar bolão: ${poolError.message}`);
      }

      if (!poolResult) {
        throw new Error("Falha ao criar bolão - dados não retornados.");
      }

      // Adicionar criador como owner na tabela pool_members
      const { error: memberError } = await supabase
        .from("pool_members")
        .insert({
          pool_id: poolResult.id,
          user_id: user.id,
          role: "owner",
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        // Bolão foi criado mas falhou ao adicionar como membro
        setMessage(`Bolão criado com sucesso, mas houve um problema ao adicionar você como membro: ${memberError.message}`);
        setInviteCode(poolResult.code);
        setLoading(false);
        return;
      }

      // Tentar garantir calendário de partidas (opcional)
      try {
        await fetch(`/api/pools/${poolResult.id}/ensure-matches`, { 
          method: "POST" 
        });
      } catch (error) {
        // Silencioso - a página de palpites fará fallback se necessário
        console.warn("Falha ao garantir calendário de partidas:", error);
      }

      // Sucesso! Atualizar estado global e redirecionar
      setSelectedPoolId(poolResult.id);
      setSelectedChampionship(championship || null);
      
      setMessage("Bolão criado com sucesso! Redirecionando...");
      setInviteCode(poolResult.code);
      
      // Redirecionar após breve delay para mostrar o código
      setTimeout(() => {
        router.push("/palpites");
      }, 2000);

    } catch (error: any) {
      setMessage(error?.message || "Erro inesperado ao criar bolão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Protected>
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="mx-auto max-w-4xl px-6 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
              Criar Bolão
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Configure seu bolão personalizado e comece a se divertir com seus amigos. 
              Escolha o campeonato, defina o nome e selecione o plano ideal para seu grupo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Nome do Bolão */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl">
              <label className="block text-sm font-semibold text-white mb-3">
                Nome do Bolão
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bolão dos Amigos 2025"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                maxLength={50}
              />
              <p className="text-xs text-white/60 mt-2">
                Escolha um nome único e fácil de lembrar para seu bolão
              </p>
            </div>

            {/* Campeonato */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl">
              <label className="block text-sm font-semibold text-white mb-3">
                Campeonato
              </label>
              <select
                required
                value={championship}
                onChange={(e) => setChampionship(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="" disabled className="bg-gray-800">
                  Selecione o campeonato...
                </option>
                {CHAMPIONSHIPS.map(champ => (
                  <option key={champ} value={champ} className="bg-gray-800">
                    {champ}
                  </option>
                ))}
              </select>
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-200">
                  💡 <strong>Dica:</strong> Cada bolão é dedicado a um campeonato específico. 
                  Você pode criar múltiplos bolões para diferentes competições.
                </p>
              </div>
            </div>

            {/* Planos */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl">
              <label className="block text-sm font-semibold text-white mb-6">
                Escolha seu Plano
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PLANS.map(plan => {
                  const IconComponent = plan.icon;
                  return (
                    <label 
                      key={plan.key} 
                      className={`relative rounded-2xl border p-6 cursor-pointer transition-all duration-300 hover:scale-105 ${
                        planKey === plan.key 
                          ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/30" 
                          : "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex flex-col h-full">
                        {/* Header do plano */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              planKey === plan.key ? 'bg-blue-500/20' : 'bg-white/10'
                            }`}>
                              <IconComponent className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-white">{plan.title}</h3>
                                {plan.popular && (
                                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{plan.description}</p>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name="plan"
                            value={plan.key}
                            checked={planKey === plan.key}
                            onChange={() => setPlanKey(plan.key)}
                            className="w-5 h-5 text-blue-500 bg-transparent border-2 border-white/30 focus:ring-blue-500 focus:ring-2"
                          />
                        </div>

                        {/* Detalhes do plano */}
                        <div className="flex-1">
                          <p className="text-sm text-slate-300 mb-2">{plan.range}</p>
                          <p className="text-xs text-slate-400 mb-4">
                            {plan.premium ? "Pagamento único • Sem mensalidades" : "Totalmente gratuito"}
                          </p>
                        </div>

                        {/* Preço */}
                        <div className="text-center pt-4 border-t border-white/10">
                          <p className="text-2xl font-extrabold text-white">{plan.price}</p>
                          {plan.premium && (
                            <p className="text-xs text-slate-400">pagamento único</p>
                          )}
                        </div>
                      </div>

                      {/* Overlay de seleção */}
                      {planKey === plan.key && (
                        <div className="absolute inset-0 rounded-2xl bg-blue-500/5 pointer-events-none border-2 border-blue-500/30"></div>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Mensagens */}
            {message && (
              <div className={`rounded-xl p-4 border ${
                message.includes("sucesso") 
                  ? "bg-green-500/10 border-green-500/30 text-green-300" 
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}>
                <p className="text-sm font-medium">{message}</p>
              </div>
            )}

            {/* Código de convite */}
            {inviteCode && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-green-300 mb-2">
                  🎉 Bolão criado com sucesso!
                </h3>
                <p className="text-sm text-green-200 mb-3">
                  Compartilhe este código com seus amigos para eles entrarem no bolão:
                </p>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <p className="text-xs text-white/70 mb-1">Código do Bolão:</p>
                  <p className="text-2xl font-mono font-bold tracking-widest text-white">
                    {inviteCode}
                  </p>
                </div>
              </div>
            )}

            {/* Botão de Submit */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading || !name.trim() || !championship}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 font-bold text-white text-lg shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all duration-300"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {planKey === "free" ? "Criando bolão..." : "Iniciando pagamento..."}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="w-5 h-5" />
                    {planKey === "free" ? "Criar Bolão Gratuito" : "Continuar para Pagamento"}
                  </div>
                )}
              </button>
              
              <p className="text-center text-xs text-slate-400 mt-4">
                Ao criar o bolão, você concorda com nossos termos de uso e política de privacidade.
              </p>
            </div>
          </form>
        </div>
      </main>
    </Protected>
  );
}