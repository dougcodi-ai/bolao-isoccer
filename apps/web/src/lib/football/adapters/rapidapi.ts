import type { Competition, Season, Team, Match, StandingRow } from "../types";
import type { FootballProvider } from "../provider";

type HLLeague = {
  id: number;
  name: string;
  country?: { code?: string; name?: string };
  seasons?: { season: number }[];
};

type HLMatch = {
  id: number;
  date: string; // ISO
  status: string;
  homeTeam: { id: number; name: string; shortName?: string; logo?: string };
  awayTeam: { id: number; name: string; shortName?: string; logo?: string };
  score?: { home?: number | null; away?: number | null; winner?: string | null };
  round?: string;
  matchday?: number;
  venue?: string | null;
  referee?: string | null;
};

const COMP_TO_STATIC_LEAGUE: Record<string, number> = {
  "BRA-1": 61205,
  "BRA-2": 62056,
  "BRA-CUP": 62907,
};

export class RapidAPIProvider implements FootballProvider {
  private apiKey: string;
  private baseUrl = "https://sport-highlights-api.p.rapidapi.com/football";
  private leagueCache: Map<string, number> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    Object.entries(COMP_TO_STATIC_LEAGUE).forEach(([code, id]) => this.leagueCache.set(code, id));
  }

  private async request<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": "sport-highlights-api.p.rapidapi.com",
      },
    });
    if (!res.ok) {
      throw new Error(`RapidAPI request failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  private async resolveLeagueId(competitionId: string): Promise<number | null> {
    if (this.leagueCache.has(competitionId)) return this.leagueCache.get(competitionId)!;

    const wanted = competitionId.toLowerCase();
    const nameMatch = wanted.includes("libertadores")
      ? "libertadores"
      : wanted.includes("sulam") || wanted.includes("sul-americana")
      ? "sul"
      : competitionId;

    try {
      const data = await this.request<{ leagues: HLLeague[] }>("/leagues", { limit: 200 });
      const league = (data.leagues || []).find((l) => {
        const lname = (l.name || "").toLowerCase();
        if (competitionId === "LIBERTADORES") return lname.includes("libertadores");
        if (competitionId === "SULAMERICANA") return lname.includes("sul") && lname.includes("america");
        return false;
      });
      if (league) {
        this.leagueCache.set(competitionId, league.id);
        return league.id;
      }
    } catch (e) {
      // ignore, fallback later
    }
    return null;
  }

  async getCompetitions(): Promise<Competition[]> {
    const data = await this.request<{ leagues: HLLeague[] }>("/football/leagues", { limit: 200 });
    const comps: Competition[] = [];
    for (const l of data.leagues || []) {
      const lname = (l.name || "").toLowerCase();
      if (
        lname.includes("serie a") ||
        lname.includes("serie b") ||
        lname.includes("copa do brasil") ||
        lname.includes("libertadores") ||
        lname.includes("sul")
      ) {
        comps.push({ id: String(l.id), name: l.name, code: undefined, country: l.country?.name } as any);
      }
    }
    return comps;
  }

  async getSeasons(competitionId: string): Promise<Season[]> {
    const leagueId = await this.resolveLeagueId(competitionId);
    if (!leagueId) return [];
    const data = await this.request<{ leagues: HLLeague[] }>("/football/leagues", { limit: 200 });
    const league = (data.leagues || []).find((l) => l.id === leagueId);
    const seasons = league?.seasons || [];
    return seasons.map((s) => ({ id: String(s.season), year: s.season, name: String(s.season), competitionId } as any));
  }

  async getTeams(params: { competitionId: string; seasonId: string }): Promise<Team[]> {
    const leagueId = await this.resolveLeagueId(params.competitionId);
    if (!leagueId) return [];
    const limit = 400;
    const data = await this.request<{ matches: HLMatch[] }>("/football/matches", { leagueId, limit });
    const map = new Map<string, Team>();
    for (const m of data.matches || []) {
      const h = m.homeTeam;
      const a = m.awayTeam;
      if (h) {
        map.set(String(h.id), {
          id: String(h.id),
          name: h.name,
          shortName: h.shortName || undefined,
          acronym: h.shortName || undefined,
          country: undefined,
          logoUrl: (h as any).logo || null,
          externalIds: { highlightly: h.id },
        });
      }
      if (a) {
        map.set(String(a.id), {
          id: String(a.id),
          name: a.name,
          shortName: a.shortName || undefined,
          acronym: a.shortName || undefined,
          country: undefined,
          logoUrl: (a as any).logo || null,
          externalIds: { highlightly: a.id },
        });
      }
    }
    return Array.from(map.values());
  }

  async getMatches(params: { competitionId: string; seasonId: string; matchdayFrom?: number; matchdayTo?: number }): Promise<Match[]> {
    const leagueId = await this.resolveLeagueId(params.competitionId);
    if (!leagueId) return [];
    const limit = 400;
    const data = await this.request<{ matches: HLMatch[] }>("/football/matches", { leagueId, limit });
    let list = (data.matches || []).filter((m) => {
      const md = typeof m.matchday === "number" ? m.matchday : undefined;
      if (typeof params.matchdayFrom === "number" && typeof md === "number" && md < params.matchdayFrom) return false;
      if (typeof params.matchdayTo === "number" && typeof md === "number" && md > params.matchdayTo) return false;
      return true;
    });
    const toStatus = (s: string): Match["status"] => {
      const x = (s || "").toLowerCase();
      if (x.includes("live") || x.includes("playing")) return "live";
      if (x.includes("finished") || x.includes("ft") || x.includes("ended")) return "finished";
      if (x.includes("postponed")) return "postponed";
      if (x.includes("canceled")) return "canceled";
      if (x.includes("suspended")) return "suspended";
      return "scheduled";
    };
    return list.map((m) => ({
      id: String(m.id),
      externalId: m.id,
      competitionId: String(leagueId),
      seasonId: params.seasonId,
      round: m.round,
      matchday: m.matchday,
      utcDate: m.date,
      status: toStatus(m.status),
      homeTeamId: String(m.homeTeam.id),
      awayTeamId: String(m.awayTeam.id),
      score: {
        home: m.score?.home ?? null,
        away: m.score?.away ?? null,
        winner: (m.score?.winner as any) ?? null,
      },
      venue: m.venue ?? null,
      referee: m.referee ?? null,
    }));
  }

  async getStandings(params: { competitionId: string; seasonId: string }): Promise<StandingRow[]> {
    const leagueId = await this.resolveLeagueId(params.competitionId);
    if (!leagueId) return [];
    try {
      const data = await this.request<{ standings: any[] }>("/football/standings", { leagueId, season: params.seasonId });
      return (data.standings || []).map((row: any) => ({
        teamId: String(row.team?.id ?? ""),
        position: Number(row.position ?? 0),
        points: Number(row.points ?? 0),
        played: Number(row.played ?? 0),
        won: Number(row.won ?? 0),
        draw: Number(row.draw ?? 0),
        lost: Number(row.lost ?? 0),
        goalsFor: Number(row.goalsFor ?? 0),
        goalsAgainst: Number(row.goalsAgainst ?? 0),
        goalDifference: Number(row.goalDifference ?? 0),
      }));
    } catch (e) {
      return [];
    }
  }
  async getTeamLogoUrl(team: Team): Promise<string | null> {
    return team.logoUrl || null;
  }
}