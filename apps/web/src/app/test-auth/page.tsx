"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TestAuthPage() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const testAuth = async () => {
      try {
        console.log("🔍 Testando autenticação na interface web...");

        // 1. Verificar sessão
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("📱 Sessão:", sessionData.session ? "Ativa" : "Inativa");
        setSession(sessionData.session);

        // 2. Verificar usuário
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error("❌ Erro ao obter usuário:", userError.message);
          setError(`Erro ao obter usuário: ${userError.message}`);
          return;
        }

        if (!userData.user) {
          console.log("❌ Usuário não encontrado");
          setError("Usuário não encontrado");
          return;
        }

        console.log("✅ Usuário obtido:", userData.user.email);
        setUser(userData.user);

        // 3. Testar query de bolões
        const { data: poolsData, error: poolsError } = await supabase
          .from('pool_members')
          .select(`
            pool_id,
            role,
            pools!inner(id, name, code, owner_id, premium, max_members, created_at)
          `)
          .eq('user_id', userData.user.id);

        if (poolsError) {
          console.error("❌ Erro na query de bolões:", poolsError.message);
          setError(`Erro na query de bolões: ${poolsError.message}`);
          return;
        }

        console.log("✅ Bolões encontrados:", poolsData?.length || 0);
        setPools(poolsData || []);

      } catch (err) {
        console.error("❌ Erro geral:", err);
        setError(`Erro geral: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    testAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Teste de Autenticação</h1>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Teste de Autenticação</h1>
      
      {error && (
        <div className="bg-red-600 p-4 rounded mb-6">
          <h2 className="font-bold">Erro:</h2>
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Sessão</h2>
          <p>Status: {session ? "✅ Ativa" : "❌ Inativa"}</p>
          {session && (
            <p>Token: {session.access_token ? "✅ Presente" : "❌ Ausente"}</p>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Usuário</h2>
          {user ? (
            <div>
              <p>✅ Email: {user.email}</p>
              <p>✅ ID: {user.id}</p>
            </div>
          ) : (
            <p>❌ Usuário não encontrado</p>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Bolões</h2>
          {pools.length > 0 ? (
            <div>
              <p>✅ {pools.length} bolão(ões) encontrado(s):</p>
              <ul className="mt-2 space-y-1">
                {pools.map((pool, index) => (
                  <li key={index} className="ml-4">
                    • {pool.pools.name} ({pool.role})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>❌ Nenhum bolão encontrado</p>
          )}
        </div>

        <div className="bg-blue-600 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Ações</h2>
          <a 
            href="/palpites" 
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded inline-block"
          >
            Ir para Palpites
          </a>
        </div>
      </div>
    </div>
  );
}