import type { Competition, Season, Team, Match, StandingRow } from "./types";

export interface FootballProvider {
  getCompetitions?(): Promise<Competition[]>;
  getSeasons?(competitionId: string): Promise<Season[]>;
  getTeams(params: { competitionId: string; seasonId: string }): Promise<Team[]>;
  getMatches(params: {
    competitionId: string;
    seasonId: string;
    matchdayFrom?: number;
    matchdayTo?: number;
  }): Promise<Match[]>;
  getStandings?(params: { competitionId: string; seasonId: string }): Promise<StandingRow[]>;
  getTeamLogoUrl?(team: Team): Promise<string | null>;
}