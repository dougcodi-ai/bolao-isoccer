"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { toPng } from "html-to-image";
import { Trophy, Medal, Crown, ChevronDown, Share2, Loader2, CheckCircle2, XCircle } from "lucide-react";

type RankRow = { user_id: string; points: number };

type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null };

type Period = "geral" | "semana" | "mes";

// Tipo para critérios de desempate
type TieBreakData = {
  exact_hits: number;
  result_hits: number;
  partial_hits: number;
  total_predictions: number;
};

export default function RankingPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolName, setPoolName] = useState<string | null>(null);
  const [userPools, setUserPools] = useState<Array<{ id: string; name: string }>>([]);
  const [period, setPeriod] = useState<Period>("geral");
  const [periodMode, setPeriodMode] = useState<"atual" | "periodo">("atual");
  const [ranking, setRanking] = useState<(RankRow & TieBreakData)[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [userPreds, setUserPreds] = useState<Record<string, any[]>>({});
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Guardar posições anteriores para calcular variação
  const prevPositionsRef = useRef<Record<string, number>>({});
  
  // Carregar perfis com fallback quando avatar_url não existir (evita erro de coluna ausente)
  const loadProfiles = useCallback(async (ids: string[]) => {
    if (!ids?.length) return {} as Record<string, ProfileRow>;
    try {
      const { data: pr, error: eP } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      if (eP) throw eP;
      const map: Record<string, ProfileRow> = {};
      (pr as ProfileRow[]).forEach((p) => { map[p.id] = p; });
      return map;
    } catch {
      const { data: pr2 } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const map: Record<string, ProfileRow> = {};
      (pr2 as any[])?.forEach((p) => { map[p.id] = { id: p.id, display_name: p.display_name ?? null, avatar_url: null }; });
      return map;
    }
  }, []);

  // Função para calcular critérios de desempate
  const calculateTieBreakData = async (userIds: string[], poolId: string) => {
    const { data: matches } = await supabase
      .from("matches")
      .select("id, home_score, away_score")
      .eq("pool_id", poolId)
      .not("home_score", "is", null)
      .not("away_score", "is", null);

    const matchIds = ((matches as any[]) || []).map((m: any) => m.id);
    if (matchIds.length === 0) {
      return userIds.reduce((acc, userId) => ({ 
        ...acc, 
        [userId]: { exact_hits: 0, result_hits: 0, partial_hits: 0, total_predictions: 0 }
      }), {} as Record<string, TieBreakData>);
    }

    const { data: predictions } = await supabase
      .from("predictions")
      .select("user_id, match_id, home_pred, away_pred")
      .in("user_id", userIds)
      .in("match_id", matchIds);

    const matchMap: Record<string, { home_score: number; away_score: number }> = ((matches as any[]) || []).reduce((acc: Record<string, { home_score: number; away_score: number }>, m: any) => ({ 
      ...acc, 
      [m.id]: { home_score: Number(m.home_score), away_score: Number(m.away_score) }
    }), {});

    const tieBreakData: Record<string, TieBreakData> = {};
    userIds.forEach(userId => {
      tieBreakData[userId] = { exact_hits: 0, result_hits: 0, partial_hits: 0, total_predictions: 0 };
    });

    ((predictions as any[]) || []).forEach((pred: any) => {
      const match = matchMap[pred.match_id];
      if (!match) return;

      const userData = tieBreakData[pred.user_id];
      userData.total_predictions++;

      const exact = pred.home_pred === match.home_score && pred.away_pred === match.away_score;
      if (exact) {
        userData.exact_hits++;
        return;
      }

      const predResult = pred.home_pred === pred.away_pred ? 0 : (pred.home_pred > pred.away_pred ? 1 : -1);
      const actualResult = match.home_score === match.away_score ? 0 : (match.home_score > match.away_score ? 1 : -1);
      
      if (predResult === actualResult) {
        userData.result_hits++;
        return;
      }

      // Pontuação parcial: acertar gols de uma equipe
      if (pred.home_pred === match.home_score || pred.away_pred === match.away_score) {
        userData.partial_hits++;
      }
    });

    return tieBreakData;
  };

  // Função de desempate conforme PRD
  const detHash = (s: string) => {
    // FNV-1a 32-bit hash for deterministic tie-breaker
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  };
  const applyTieBreakSort = (rk: (RankRow & TieBreakData)[]) => {
    return rk.sort((a, b) => {
      // 1. Pontos totais
      if (a.points !== b.points) return b.points - a.points;
      
      // 2. Maior número de acertos de placar exato
      if (a.exact_hits !== b.exact_hits) return b.exact_hits - a.exact_hits;
      
      // 3. Maior número de acertos de resultado (vitória/empate/derrota)
      if (a.result_hits !== b.result_hits) return b.result_hits - a.result_hits;
      
      // 4. Maior número de acertos de gols exatos (parciais)
      if (a.partial_hits !== b.partial_hits) return b.partial_hits - a.partial_hits;
      
      // 5. Maior número de palpites efetuados
      if (a.total_predictions !== b.total_predictions) return b.total_predictions - a.total_predictions;
      
      // 6. Sorteio determinístico estável (seed: pool + user)
      const sa = `${selectedPoolId || ""}:${a.user_id}`;
      const sb = `${selectedPoolId || ""}:${b.user_id}`;
      const ha = detHash(sa);
      const hb = detHash(sb);
      if (ha !== hb) return ha - hb; // ordem pseudo-aleatória determinística
      
      // 7. Fallback final: ordena por user_id para estabilidade
      if (a.user_id < b.user_id) return -1;
      if (a.user_id > b.user_id) return 1;
      return 0;
    });
  };

  // 1) Obter usuário e pool selecionado (localStorage ou 1º pool do usuário)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!mounted) return;
        const id = u.user?.id || null;
        setUserId(id);

        // Buscar pools do usuário
        if (id) {
          try {
            const { data: pm } = await supabase
              .from("pool_members")
              .select("pool_id")
              .eq("user_id", id);
            const ids = Array.from(new Set(((pm as any[]) || []).map((r: any) => r.pool_id)));
            if (ids.length) {
              const { data: poolsData } = await supabase
                .from("pools")
                .select("id, name")
                .in("id", ids);
              setUserPools(((poolsData as any[]) || []).map((p: any) => ({ id: p.id, name: p.name })));
            } else {
              setUserPools([]);
            }
          } catch { /* noop */ }
        }

        // Pool via localStorage
        let pool: string | null = null;
        try { pool = window.localStorage.getItem("last_pool_id"); } catch {}

        if (!pool && id) {
          // Buscar 1 pool_id em que o usuário é membro
          const { data: pm, error: ePm } = await supabase
            .from("pool_members")
            .select("pool_id")
            .eq("user_id", id)
            .limit(1)
            .maybeSingle();
          if (!ePm && pm?.pool_id) pool = pm.pool_id as string;
        }

        if (pool) {
          setSelectedPoolId(pool);
          try { window.localStorage.setItem("last_pool_id", pool); } catch {}
          // Nome do bolão (opcional)
          const { data: p, error: eP } = await supabase.from("pools").select("name").eq("id", pool).maybeSingle();
          if (!eP) setPoolName((p as any)?.name ?? null);
        } else {
          setSelectedPoolId(null);
        }
      } catch (e: any) {
        setError(e?.message || "Falha ao inicializar Ranking");
      }
    })();
    return () => { mounted = false };
  }, []);

  // 2) Carregar ranking geral do pool (paginado) + perfis + critérios de desempate
  const fetchRanking = async (poolId: string, pageIndex = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data: rows, error: eR, count } = await supabase
        .from("points")
        .select("user_id, points", { count: "exact" })
        .eq("pool_id", poolId)
        .order("points", { ascending: false })
        .range(from, to);
      if (eR) throw eR;
      const r = (rows as RankRow[]) || [];
      
      // Calcular critérios de desempate apenas para grupos empatados
      const byPts = new Map<number, string[]>();
      r.forEach(row => {
        const arr = byPts.get(row.points) || [];
        arr.push(row.user_id);
        byPts.set(row.points, arr);
      });
      const tiedIds = Array.from(byPts.values()).filter(ids => ids.length > 1).flatMap(ids => ids);
      let tieBreakData: Record<string, TieBreakData> = {};
      if (tiedIds.length > 0) {
        tieBreakData = await calculateTieBreakData(tiedIds, poolId);
      }
      
      const enrichedRows: (RankRow & TieBreakData)[] = r.map(row => ({
        ...row,
        ...(tieBreakData[row.user_id] || { exact_hits: 0, result_hits: 0, partial_hits: 0, total_predictions: 0 })
      }));

      // Aplicar desempate
      const sortedRows = applyTieBreakSort(enrichedRows);
      
      setRanking((prev) => (append ? [...prev, ...sortedRows] : sortedRows));
      setHasMore(count != null ? (to + 1) < (count as number) : r.length === PAGE_SIZE);

      // Carregar perfis
      const ids = (append ? [...new Set(r.map((x) => x.user_id))] : r.map((x) => x.user_id));
      const map = await loadProfiles(ids);
      setProfiles((prev) => (append ? { ...prev, ...map } : map));
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar ranking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPoolId) return;
    setPage(0); setHasMore(true); setDisplayCount(PAGE_SIZE);
    if (periodMode === "atual") fetchRanking(selectedPoolId, 0, false); else fetchRankingByPeriod(selectedPoolId, period);
  }, [selectedPoolId, periodMode]);

  // 3) Realtime: atualizar quando points do pool mudar
  useEffect(() => {
    if (!selectedPoolId) return;
    const ch = supabase
      .channel(`ranking:${selectedPoolId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "points", filter: `pool_id=eq.${selectedPoolId}` }, async () => periodMode === "atual" ? fetchRanking(selectedPoolId, 0, false) : undefined)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "points", filter: `pool_id=eq.${selectedPoolId}` }, async () => periodMode === "atual" ? fetchRanking(selectedPoolId, 0, false) : undefined)
      // Novo: quando uma partida do pool for atualizada e tiver placares definidos, recomputa pontos
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `pool_id=eq.${selectedPoolId}` },
        async (payload: any) => {
          try {
            const rec = payload?.new || payload?.record || {};
            const finished = rec?.home_score != null && rec?.away_score != null;
            if (finished) {
              await fetch(`/api/pools/${selectedPoolId}/recompute-points`, { method: "POST" }).catch(() => {});
              if (periodMode === "atual") await fetchRanking(selectedPoolId, 0, false);
            }
          } catch (e) { /* noop */ }
        }
      )
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [selectedPoolId, periodMode]);

  // 4) Variação de posição baseada no snapshot anterior
  const rankedWithMeta = useMemo(() => {
    const prev = prevPositionsRef.current;
    const withPos = ranking.map((r, idx) => {
      const pos = idx + 1;
      const prevPos = prev[r.user_id];
      const delta = typeof prevPos === "number" ? prevPos - pos : 0; // + sobe, - desce
      return { ...r, pos, delta } as (RankRow & TieBreakData) & { pos: number; delta: number };
    });
    // Atualiza referência para próxima comparação
    const next: Record<string, number> = {};
    (withPos as any[]).forEach((r: any) => { next[r.user_id] = r.pos; });
    prevPositionsRef.current = next;
    return withPos as any[];
  }, [ranking]);

  // Período usa semana/mês dinâmicos; não é necessário pré-carregar metadados
  useEffect(() => { /* noop */ }, [selectedPoolId]);

  // Função para buscar ranking por período com pontuação parcial
  const fetchRankingByPeriod = async (
    poolId: string,
    p: Period
  ) => {
    setLoading(true);
    setError(null);
    try {
      if (p === "geral") {
        await fetchRanking(poolId, 0, false);
        setPage(0); setDisplayCount(PAGE_SIZE);
      } else {
        // Semana/Mês: somar pontos no período (últimos 7 ou 30 dias)
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - (p === "semana" ? 7 : 30));
        const { data: ms, error: eM } = await supabase
          .from("matches")
          .select("id, home_score, away_score, start_time")
          .eq("pool_id", poolId)
          .not("home_score", "is", null)
          .not("away_score", "is", null)
          .gte("start_time", start.toISOString())
          .lte("start_time", now.toISOString());
        if (eM) throw eM;
        const matchIds = (ms as any[])?.map((m: any) => m.id) || [];
        if (matchIds.length === 0) {
          setRanking([]);
          setProfiles({});
          setLoading(false);
          return;
        }
        const mMap: Record<string, { home_score: number; away_score: number }> = {};
        (ms as any[]).forEach((m: any) => {
          mMap[m.id] = {
            home_score: Number(m.home_score),
            away_score: Number(m.away_score),
          };
        });
        const { data: preds, error: eP } = await supabase
          .from("predictions")
          .select("user_id, match_id, home_pred, away_pred")
          .in("match_id", matchIds);
        if (eP) throw eP;
        const outcome = (a: number, b: number) => (a === b ? 0 : a > b ? 1 : -1);
        const userPts: Record<string, number> = {};
        const userStats: Record<string, TieBreakData> = {};
        
        (preds as any[]).forEach((p: any) => {
          const m = mMap[p.match_id];
          if (!m) return;
          
          if (!userStats[p.user_id]) {
            userStats[p.user_id] = { exact_hits: 0, result_hits: 0, partial_hits: 0, total_predictions: 0 };
          }
          
          userStats[p.user_id].total_predictions++;
          
          const exact = p.home_pred === m.home_score && p.away_pred === m.away_score;
          const tend = !exact && outcome(p.home_pred, p.away_pred) === outcome(m.home_score, m.away_score);
          const partial = !exact && !tend && (p.home_pred === m.home_score || p.away_pred === m.away_score);
          
          let pts = 0;
          if (exact) {
            pts = 10;
            userStats[p.user_id].exact_hits++;
          } else if (tend) {
            pts = 5;
            userStats[p.user_id].result_hits++;
          } else if (partial) {
            pts = 3;
            userStats[p.user_id].partial_hits++;
          }
          
          userPts[p.user_id] = (userPts[p.user_id] || 0) + pts;
        });
        
        const rows: (RankRow & TieBreakData)[] = Object.entries(userPts)
          .map(([user_id, points]) => ({ 
            user_id, 
            points: Number(points),
            ...(userStats[user_id] || { exact_hits: 0, result_hits: 0, partial_hits: 0, total_predictions: 0 })
          }));
          
        const sortedRows = applyTieBreakSort(rows);
        setRanking(sortedRows);
        const ids = sortedRows.map((x) => x.user_id);
        const map = await loadProfiles(ids);
        setProfiles(map);
        setDisplayCount(PAGE_SIZE);
      }
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar ranking");
    } finally {
      setLoading(false);
    }
  };

  // Atualizar ranking quando filtros mudarem
  useEffect(() => {
    if (!selectedPoolId) return;
    if (periodMode === "atual") {
      setPage(0); setHasMore(true);
      fetchRanking(selectedPoolId, 0, false);
    } else {
      fetchRankingByPeriod(selectedPoolId, period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoolId, periodMode, period]);

  // Realtime: atualizar conforme período + fallback polling
  useEffect(() => {
    if (!selectedPoolId) return;
    const ch = supabase
      .channel(`ranking:${selectedPoolId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "points", filter: `pool_id=eq.${selectedPoolId}` },
        async () => { if (periodMode === "atual") await fetchRanking(selectedPoolId, 0, false); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `pool_id=eq.${selectedPoolId}` },
        async (payload: any) => {
          const rec = payload?.new || payload?.record || {};
          const finished = rec?.home_score != null && rec?.away_score != null;
          if (finished) {
            try { await fetch(`/api/pools/${selectedPoolId}/recompute-points`, { method: "POST" }); } catch {}
          }
          if (periodMode === "periodo") await fetchRankingByPeriod(selectedPoolId, period);
        }
      )
      .subscribe();
    const id = setInterval(() => {
      if (!selectedPoolId) return;
      if (periodMode === "atual") fetchRanking(selectedPoolId, 0, false); else fetchRankingByPeriod(selectedPoolId, period);
    }, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoolId, periodMode, period]);

  // Infinite scroll: carregar mais
  const loadMore = useCallback(async () => {
    if (!selectedPoolId) return;
    if (periodMode === "periodo") { setDisplayCount((c) => c + PAGE_SIZE); return; }
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    await fetchRanking(selectedPoolId, next, true);
    setPage(next);
    setLoadingMore(false);
  }, [selectedPoolId, periodMode, loadingMore, hasMore, page]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      const [e] = entries; if (e.isIntersecting) loadMore();
    });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMore]);

  // Expandir palpites do usuário
  const toggleExpand = async (uid: string) => {
    setExpanded((prev) => ({ ...prev, [uid]: !prev[uid] }));
    if (userPreds[uid]) return;
    if (!selectedPoolId) return;
    const now = new Date();
    let start: Date | null = null;
    if (periodMode === "periodo") { start = new Date(now); start.setDate(now.getDate() - (period === "semana" ? 7 : 30)); }
    let mq = supabase
      .from("matches")
      .select("id, home_team, away_team, home_score, away_score, start_time")
      .eq("pool_id", selectedPoolId)
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("start_time", { ascending: false });
    if (start) mq = mq.gte("start_time", start.toISOString()).lte("start_time", now.toISOString()); else mq = mq.limit(10);
    const { data: ms } = await mq;
    const ids = (ms as any[])?.map((m: any) => m.id) ?? [];
    if (ids.length === 0) { setUserPreds((prev) => ({ ...prev, [uid]: [] })); return; }
    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id, home_pred, away_pred")
      .eq("user_id", uid)
      .in("match_id", ids);
    const byId: Record<string, any> = {}; (ms as any[])?.forEach((m: any) => { byId[m.id] = m; });
    const rows = (preds as any[])?.map((p: any) => {
      const m = byId[p.match_id];
      const exact = m && p.home_pred === m.home_score && p.away_pred === m.away_score;
      const tend = m && !exact && Math.sign(p.home_pred - p.away_pred) === Math.sign(m.home_score - m.away_score);
      return { ...p, match: m, exact, tend };
    }) ?? [];
    setUserPreds((prev) => ({ ...prev, [uid]: rows }));
  };

  // Compartilhar ranking
  const handleShare = async () => {
    if (!shareRef.current) return;
    try {
      setSharing(true);
      const dataUrl = await toPng(shareRef.current, { backgroundColor: "#0f172a", pixelRatio: 2 });
      const res = await fetch(dataUrl); const blob = await res.blob();
      const file = new File([blob], `ranking-isoccer-${new Date().toISOString()}.png`, { type: "image/png" });
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: "Meu Ranking iSoccer" });
      } else if (navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([new (window as any).ClipboardItem({ "image/png": blob })]);
        alert("Imagem copiada para a área de transferência!");
      } else {
        const a = document.createElement("a"); a.href = dataUrl; a.download = file.name; a.click();
      }
    } catch (e) { console.warn(e); } finally { setSharing(false); }
  };

  const meRow = useMemo(() => {
    if (!userId) return null;
    return (rankedWithMeta as any[]).find((r: any) => r.user_id === userId) || null;
  }, [rankedWithMeta, userId]);

  // Estado

  // Hotfix: remove qualquer nó de texto estranho no topo (e.g., fragmentos "({\"" visíveis em dev)
  useEffect(() => {
    try {
      const root = document.body
      if (!root) return
      const shouldRemove = (n: ChildNode) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = (n.textContent || '').trim()
          if (t.startsWith('(\"') || t.startsWith('({"') || t.startsWith('({\\"') || t.startsWith('self.__next_f.push([')) {
            n.parentNode?.removeChild(n)
            return true
          }
        }
        return false
      }
      const firstNodes = Array.from(root.childNodes).slice(0, 5)
      firstNodes.forEach(shouldRemove)
    } catch {}
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
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
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Header da página */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Ranking</h1>
              <p className="text-white/70">Veja sua posição e dispute com os amigos</p>
            </div>
          </div>
        </div>
    {error && (
        <div className="mb-4 text-sm text-red-400" role="alert">{error}</div>
      )}

      {selectedPoolId && (
        <section className="rounded-lg border border-white/10 bg-gradient-to-r from-indigo-900/30 via-slate-900/30 to-purple-900/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2" role="tablist" aria-label="Modo de ranking">
            <button onClick={() => setPeriodMode("atual")} role="tab" aria-selected={periodMode === "atual"}
              className={`px-3 py-1.5 rounded-md text-sm ${periodMode === "atual" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"}`}>Ranking atual</button>
            <button onClick={() => setPeriodMode("periodo")} role="tab" aria-selected={periodMode === "periodo"}
              className={`px-3 py-1.5 rounded-md text-sm ${periodMode === "periodo" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"}`}>Por período</button>
          </div>
          {periodMode === "periodo" && (
            <div className="flex items-center gap-2" aria-label="Seleção de período">
              <button onClick={() => setPeriod("semana")} className={`px-3 py-1.5 rounded-md text-sm ${period === "semana" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"}`}>Última semana</button>
              <button onClick={() => setPeriod("mes")} className={`px-3 py-1.5 rounded-md text-sm ${period === "mes" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"}`}>Último mês</button>
            </div>
          )}
          <div className="flex items-center gap-3">
            {userPools.length > 1 ? (
              <div className="flex items-center gap-2">
                <label htmlFor="pool-select" className="text-xs text-white/80">Bolão:</label>
                <select
                  id="pool-select"
                  aria-label="Selecionar bolão"
                  className="bg-white/10 text-white text-xs rounded-md px-2 py-1 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                  value={selectedPoolId || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPoolId(id || null);
                    const p = userPools.find((x) => x.id === id);
                    setPoolName(p?.name || null);
                    try { window.localStorage.setItem("last_pool_id", id); } catch {}
                  }}
                >
                  {userPools.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              poolName && <span className="text-xs text-white/80">Bolão: <strong>{poolName}</strong></span>
            )}
            <button onClick={handleShare} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-600/80 hover:bg-red-600 text-white text-sm shadow">
              {sharing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Share2 className="w-4 h-4"/>}
              Compartilhar meu ranking
            </button>
          </div>
        </section>
      )}

      {!selectedPoolId ? (
        <section className="rounded-lg border border-white/10 bg-white/5 p-6">
          <p className="text-slate-300">Você ainda não selecionou um bolão. Entre em um bolão para ver o ranking.</p>
        </section>
      ) : (
        <section ref={shareRef} className="rounded-lg border border-white/10 bg-white/5">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {periodMode === "atual" && "Ranking geral"}
              {periodMode === "periodo" && (
                <>Ranking por período · {period === "semana" ? "Última semana" : "Último mês"}</>
              )}
              {poolName ? <span className="ml-2 text-sm font-normal text-white/70">— {poolName}</span> : null}
            </h2>
            {loading && <span className="text-xs text-gray-400">Atualizando…</span>}
          </div>

          <div className="divide-y divide-white/10">
            <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-300">
              <div className="col-span-1">Pos</div>
              <div className="col-span-7 sm:col-span-7">Usuário</div>
              <div className="col-span-2 text-right">Pontos</div>
              <div className="col-span-2 text-right">Variação</div>
            </div>
            {(periodMode === "periodo" ? (rankedWithMeta as any[]).slice(0, displayCount) : (rankedWithMeta as any[])).length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-300">Nenhum participante com pontos ainda.</div>
            ) : (
              (periodMode === "periodo" ? (rankedWithMeta as any[]).slice(0, displayCount) : (rankedWithMeta as any[])).map((r: any) => {
                const me = userId && r.user_id === userId;
                const prof = profiles[r.user_id];
                const name = prof?.display_name || (r.user_id ? r.user_id.slice(0, 6) + "…" : "—");
                const delta = r.delta || 0;
                const deltaStr = delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`;
                const topClass = r.pos === 1 ? "border-yellow-500/40 bg-gradient-to-r from-yellow-900/20 to-amber-900/10" : r.pos === 2 ? "border-gray-400/40 bg-gradient-to-r from-slate-700/20 to-slate-900/10" : r.pos === 3 ? "border-orange-500/40 bg-gradient-to-r from-amber-800/20 to-orange-900/10" : "";
                return (
                  <div data-user={r.user_id} key={r.user_id} className={`grid grid-cols-12 px-4 py-3 text-sm transition-colors ${me ? "bg-white/5" : ""} ${topClass} border-l-4 border-transparent`}>
                    <div className="col-span-1 font-mono">{r.pos}</div>
                    <div className="col-span-7 sm:col-span-7 flex items-center gap-2">
                      {r.pos === 1 && <Trophy className="w-4 h-4 text-yellow-400" aria-hidden/>}
                      {r.pos === 2 && <Medal className="w-4 h-4 text-gray-300" aria-hidden/>}
                      {r.pos === 3 && <Crown className="w-4 h-4 text-orange-400" aria-hidden/>}
                      {prof?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={prof.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full border border-white/20" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 text-[10px]" aria-hidden>
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <button onClick={() => toggleExpand(r.user_id)} className="truncate text-left hover:underline flex-1">
                        <span className={`${me ? "font-semibold" : ""}`}>{name}{me ? " (você)" : ""}</span>
                      </button>
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded[r.user_id] ? "rotate-180" : "rotate-0"}`} />
                    </div>
                    <div className="col-span-2 text-right font-semibold">{r.points}</div>
                    <div className={`col-span-2 text-right ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-gray-400"}`}>{deltaStr}</div>
                    {expanded[r.user_id] && (
                      <div className="col-span-12 mt-3 rounded-md bg-white/5 p-3 text-xs">
                        {(userPreds[r.user_id] ?? []).length === 0 ? (
                          <div className="text-white/70">Sem palpites no período selecionado.</div>
                        ) : (
                          <div className="space-y-2">
                            {(userPreds[r.user_id] ?? []).map((p: any) => (
                              <div key={p.match_id} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {p.exact ? <CheckCircle2 className="w-4 h-4 text-emerald-400"/> : p.tend ? <CheckCircle2 className="w-4 h-4 text-emerald-300/70"/> : <XCircle className="w-4 h-4 text-rose-400"/>}
                                  <span className="text-white/90">{p.match?.home_team} {p.match?.home_score ?? "-"} x {p.match?.away_score ?? "-"} {p.match?.away_team}</span>
                                </div>
                                <span className="text-white/70">Seu palpite: {p.home_pred} x {p.away_pred}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={sentinelRef} className="h-8" />
            {loadingMore && <div className="py-3 text-center text-xs text-white/70">Carregando…</div>}
          </div>
        </section>
      )}

      {meRow && (
        <div className="fixed inset-x-0 bottom-14 lg:bottom-4 z-40 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="rounded-lg border border-white/20 bg-black/70 backdrop-blur px-4 py-2 text-sm flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10">#{meRow.pos}</span>
                <span className="text-white/90">Sua posição</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-white/80">Pontos: <strong>{meRow.points}</strong></span>
                <span className={`${(meRow.delta||0)>0?"text-emerald-400":(meRow.delta||0)<0?"text-rose-400":"text-gray-400"}`}>Variação: {(meRow.delta||0)===0?"—":`${(meRow.delta||0)>0?"+":""}${meRow.delta}`}</span>
                <Link href="#" onClick={(e)=>{e.preventDefault(); const el=document.querySelector(`[data-user='${meRow.user_id}']`); if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });}} className="text-[var(--accent)] hover:underline">Ver na lista</Link>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}