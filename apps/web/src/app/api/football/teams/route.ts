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
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();

    const provider = getFootballProvider();

    // 1) Buscar times do provider com fallback para MOCK
    let teams: any[] = [];
    try {
      const got = await provider.getTeams({ competitionId: competition, seasonId: season });
      teams = Array.isArray(got) ? got : [];
    } catch (_) {
      teams = [];
    }
    if (!teams.length) {
      const mockData = getMockDataForCompetition(competition);
      teams = mockData.teams as any[];
    }

    // 2) Filtro por busca opcional (name/shortName/acronym)
    if (search) {
      const q = search;
      teams = teams.filter((t: any) => {
        const a = String(t.acronym || "").toLowerCase();
        const n = String(t.name || "").toLowerCase();
        const s = String(t.shortName || "").toLowerCase();
        return a.includes(q) || n.includes(q) || s.includes(q);
      });
    }

    // 3) Ordenar alfabeticamente por nome
    teams.sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));

    // 4) Paginação (default 20, máx 100)
    const limitRaw = url.searchParams.get("limit");
    const pageRaw = url.searchParams.get("page");
    const limit = Math.min(Math.max(parseInt(limitRaw || "20", 10) || 20, 1), 100);
    const page = Math.max(parseInt(pageRaw || "1", 10) || 1, 1);
    const total = teams.length;
    const start = (page - 1) * limit;
    const paged = teams.slice(start, start + limit);

    return NextResponse.json({ ok: true, total, page, pageSize: limit, count: paged.length, teams: paged });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}