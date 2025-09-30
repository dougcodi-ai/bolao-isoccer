export type Competition = {
  id: string;
  name: string;
  code?: string;
  country?: string;
};

export type Season = {
  id: string;
  name: string;
  year?: number;
  startDate?: string; // ISO
  endDate?: string;   // ISO
};

export type Team = {
  id: string; // provider-agnostic id (we will map to internal UUID later)
  name: string;
  shortName?: string;
  acronym?: string;
  country?: string;
  logoUrl?: string | null;
  externalIds?: Record<string, string | number>;
};

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "canceled"
  | "suspended";

export type Match = {
  id: string; // provider id for traceability; internal mapping handled elsewhere
  externalId?: string | number;
  competitionId?: string;
  seasonId?: string;
  round?: string;
  matchday?: number;
  utcDate: string; // ISO
  status: MatchStatus;
  homeTeamId: string;
  awayTeamId: string;
  score?: {
    home?: number | null;
    away?: number | null;
    winner?: "HOME" | "AWAY" | "DRAW" | null;
  };
  venue?: string | null;
  referee?: string | null;
};

export type StandingRow = {
  teamId: string;
  position: number;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};