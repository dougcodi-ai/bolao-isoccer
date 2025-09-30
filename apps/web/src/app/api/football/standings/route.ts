import { NextRequest, NextResponse } from "next/server";
import { getFootballProvider } from "@/lib/football";
import { getMockDataForCompetition } from "@/lib/football/mock-data-selector";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const defaultCompetition = "BRA-1";
const defaultSeason = String(new Date().getFullYear());

    const competition = (url.searchParams.get("competition") || defaultCompetition).trim();
    const season = (url.searchParams.get("season") || defaultSeason).trim();

    const provider = getFootballProvider();

    const mockData = getMockDataForCompetition(competition);

    // 1) Buscar classificação do provider com fallback para MOCK
    let standings: any[] = [];
    try {
      standings = await provider.getStandings({ competitionId: competition, seasonId: season });
    } catch (_) {
      // fallback mock
      standings = mockData.standings as any[];
    }

    // 2) Buscar times para enriquecer os dados (nome/acrônimo/logo) com fallback
    let teamMap = new Map<string, any>();
    let teamsOk = false;
    try {
      const teams = await provider.getTeams({ competitionId: competition, seasonId: season });
      teams.forEach((t: any) => { teamMap.set(String(t.id), t); });
      teamsOk = teamMap.size > 0;
    } catch (_) {
      teamsOk = false;
    }
    if (!teamsOk) {
      // Se times do provider falharam, padroniza fonte para MOCK também na classificação
      mockData.teams.forEach((t: any) => { teamMap.set(String(t.id), t); });
      standings = mockData.standings as any[];
    }

    // 3) Ordenar por posição ascendente (1,2,3...)
    const sorted = [...standings].sort((a: any, b: any) => (Number(a.position) || 0) - (Number(b.position) || 0));

    // 4) Enriquecer com objeto do time
    const enriched = sorted.map((r: any) => ({
      ...r,
      team: teamMap.get(String(r.teamId)) || null,
    }));

    // 5) Paginação
    const limitRaw = url.searchParams.get("limit");
    const pageRaw = url.searchParams.get("page");
    const limit = Math.min(Math.max(parseInt(limitRaw || "20", 10) || 20, 1), 100);
    const page = Math.max(parseInt(pageRaw || "1", 10) || 1, 1);
    const total = enriched.length;
    const start = (page - 1) * limit;
    const paged = enriched.slice(start, start + limit);

    return NextResponse.json({ ok: true, total, page, pageSize: limit, count: paged.length, standings: paged });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}