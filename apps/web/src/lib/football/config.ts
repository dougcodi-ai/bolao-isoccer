import type { FootballProvider } from "./provider";
import { getMockDataForCompetition } from "./mock-data-selector";
import type { Competition, Season, Team, Match, StandingRow } from "./types";
import { RapidAPIProvider } from "./adapters/rapidapi";

class MockFootballProvider implements FootballProvider {
  async getCompetitions(): Promise<Competition[]> {
    return [
      { id: "BRA-1", code: "BRA-1", name: "Brasileirão Série A", country: "Brasil" } as any,
      { id: "BRA-2", code: "BRA-2", name: "Brasileirão Série B", country: "Brasil" } as any,
      { id: "BRA-CUP", code: "BRA-CUP", name: "Copa do Brasil", country: "Brasil" } as any,
    ];
  }
  async getSeasons(competitionId: string): Promise<Season[]> {
    const year = new Date().getFullYear();
    return [{ id: String(year), year, name: String(year), competitionId } as any];
  }
  async getTeams(params: { competitionId: string; seasonId: string }): Promise<Team[]> {
    const mock = getMockDataForCompetition(params.competitionId);
    return mock.teams as Team[];
  }
  async getMatches(params: { competitionId: string; seasonId: string; matchdayFrom?: number; matchdayTo?: number; }): Promise<Match[]> {
    const mock = getMockDataForCompetition(params.competitionId);
    let list = mock.matches as Match[];
    if (typeof params.matchdayFrom === "number" || typeof params.matchdayTo === "number") {
      list = list.filter((m: any) => {
        const md = (m.matchday ?? m.round ?? 0) as number;
        if (typeof params.matchdayFrom === "number" && md < params.matchdayFrom) return false;
        if (typeof params.matchdayTo === "number" && md > params.matchdayTo) return false;
        return true;
      });
    }
    return list;
  }
  async getStandings(params: { competitionId: string; seasonId: string }): Promise<StandingRow[]> {
    const mock = getMockDataForCompetition(params.competitionId);
    return mock.standings as StandingRow[];
  }
  async getTeamLogoUrl(team: Team): Promise<string | null> {
    return team.logoUrl || null;
  }
}

export function getFootballProvider(): FootballProvider {
  const apiKey = process.env.RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
  if (apiKey) {
    return new RapidAPIProvider(apiKey);
  }
  return new MockFootballProvider();
}