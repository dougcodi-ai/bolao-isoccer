"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const BOOSTERS = [
  { id: "o_esquecido", label: "O Esquecido" },
  { id: "o_escudo", label: "O Escudo" },
  { id: "segunda_chance", label: "Segunda Chance" },
  { id: "palpite_automatico", label: "Palpite Automático" },
  { id: "visao_grupo", label: "Visão de Grupo" },
  { id: "estatisticas_elite", label: "Estatísticas Elite" },
] as const;

export default function TestBoosterPage() {
  const [status, setStatus] = useState<string>("");
  const [booster, setBooster] = useState<string>(BOOSTERS[2].id);
  const [loading, setLoading] = useState(false);
  const [useStatus, setUseStatus] = useState<string>("");
  const [useLoading, setUseLoading] = useState(false);
  const [poolId, setPoolId] = useState<string>("");
  const [matchId, setMatchId] = useState<string>("");

  const run = async () => {
    try {
      setLoading(true);
      setStatus("Obtendo sessão...");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setStatus("Você não está logado. Faça login e volte aqui.");
        setLoading(false);
        return;
      }
      setStatus("Enviando requisição ao endpoint de teste...");
      const payload: any = { booster, amount: 1 };
      if (poolId.trim()) payload.poolId = poolId.trim();
      const resp = await fetch("/api/test/booster/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus(`Falhou: ${json?.message || resp.statusText}`);
      } else {
        setStatus(`OK: ${JSON.stringify(json)}`);
      }
    } catch (e: any) {
      setStatus(`Erro: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const runUse = async () => {
    try {
      setUseLoading(true);
      setUseStatus("Obtendo sessão...");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setUseStatus("Você não está logado. Faça login e volte aqui.");
        setUseLoading(false);
        return;
      }
      setUseStatus("Consumindo booster...");
      const body: any = { booster };
      if (poolId.trim()) body.poolId = poolId.trim();
      if (matchId.trim()) body.matchId = matchId.trim();

      const resp = await fetch("/api/boosters/use", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setUseStatus(`Falhou: ${json?.message || resp.statusText}`);
      } else {
        setUseStatus(`OK: ${JSON.stringify(json)}`);
      }
    } catch (e: any) {
      setUseStatus(`Erro: ${e?.message || String(e)}`);
    } finally {
      setUseLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-14 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Teste: Booster Realtime</h1>
          <nav className="flex items-center gap-3 text-sm">
            <Link className="btn-ghost" href="/palpites">Palpites</Link>
            <Link className="btn-ghost" href="/boosters">Comprar Boosters</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        <p className="text-sm text-gray-600">Esta página insere uma compra em booster_purchases para o usuário autenticado usando Service Role (server-side). Deve disparar o listener realtime aberto na página de Palpites.</p>

        <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Booster</label>
            <select className="rounded-md border border-gray-300 px-3 py-2" value={booster} onChange={(e) => setBooster(e.target.value)}>
              {BOOSTERS.map((b) => (
                <option key={b.id} value={b.id}>{b.label} ({b.id})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Pool ID (opcional)</label>
            <input className="rounded-md border border-gray-300 px-3 py-2" value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="uuid do bolão" />
          </div>
          <button className={`btn-primary ${loading ? "opacity-60" : ""}`} disabled={loading} onClick={run}>
            {loading ? "Inserindo…" : "Inserir compra de teste"}
          </button>
        </div>

        {status && (
          <pre className="whitespace-pre-wrap text-xs bg-gray-50 border border-gray-200 rounded-md p-3">{status}</pre>
        )}

        {/* Nova seção: testar consumo via /api/boosters/use */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="font-bold">Consumir Booster (POST /api/boosters/use)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-700">Booster</label>
              <select className="rounded-md border border-gray-300 px-3 py-2" value={booster} onChange={(e) => setBooster(e.target.value)}>
                {BOOSTERS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label} ({b.id})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-700">Pool ID (opcional)</label>
              <input className="rounded-md border border-gray-300 px-3 py-2" value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="uuid do bolão" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-700">Match ID (opcional)</label>
              <input className="rounded-md border border-gray-300 px-3 py-2" value={matchId} onChange={(e) => setMatchId(e.target.value)} placeholder="uuid da partida" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className={`btn-primary ${useLoading ? "opacity-60" : ""}`} disabled={useLoading} onClick={runUse}>
              {useLoading ? "Usando…" : "Usar Booster agora"}
            </button>
            <button className="btn-ghost text-sm" onClick={() => { setUseStatus(""); setPoolId(""); setMatchId(""); }}>
              Limpar
            </button>
          </div>
          {useStatus && (
            <pre className="whitespace-pre-wrap text-xs bg-gray-50 border border-gray-200 rounded-md p-3">{useStatus}</pre>
          )}
        </div>
      </main>
    </div>
  );
}