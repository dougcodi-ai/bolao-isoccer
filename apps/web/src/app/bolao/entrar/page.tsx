"use client";

import { useState } from "react";
import Protected from "@/components/Protected";
import { supabase } from "@/lib/supabaseClient";

export default function JoinPoolPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setLoading(false);
      setMessage("Você precisa estar autenticado.");
      return;
    }
    const { data: pool, error: poolError } = await supabase
      .from("pools")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (poolError || !pool) {
      setLoading(false);
      setMessage("Código inválido.");
      return;
    }

    // evita duplicidade
    const { data: exists } = await supabase
      .from("pool_members")
      .select("pool_id, user_id")
      .eq("pool_id", pool.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (exists) {
      setLoading(false);
      setMessage("Você já é membro deste bolão.");
      return;
    }

    const { error } = await supabase.from("pool_members").insert({ pool_id: pool.id, user_id: user.id });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    // Após entrar, garantir o calendário de partidas deste bolão
    try {
      await fetch(`/api/pools/${pool.id}/ensure-matches`, { method: "POST" });
    } catch (_) {
      // silencioso
    }
    setCode("");
    setMessage("Você entrou no bolão!");
  };

  return (
    <Protected>
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-extrabold">Entrar em um bolão</h1>
        <p className="text-slate-300 mt-2">Cole o código do bolão abaixo.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm">Código do bolão</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 focus:ring-2 focus:ring-primary"
            />
          </div>

          {message && <p className="mt-2">{message}</p>}

          <button disabled={loading} className="btn-primary w-full" type="submit">{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </main>
    </Protected>
  );
}