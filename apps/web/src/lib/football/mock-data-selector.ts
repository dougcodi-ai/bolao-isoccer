import type { Team, Match, StandingRow } from "./types";

// Import all mock data
import { 
  TEAMS as BRA_1_TEAMS, 
  MATCHES as BRA_1_MATCHES, 
  STANDINGS as BRA_1_STANDINGS 
} from "@/app/api/mock/football/data/br-2025";

import { 
  teams as BRA_2_TEAMS, 
  matches as BRA_2_MATCHES 
} from "@/app/api/mock/football/data/bra-b-2025";

import { 
  teams as BRA_CUP_TEAMS, 
  matches as BRA_CUP_MATCHES 
} from "@/app/api/mock/football/data/bra-cup-2025";

import { 
  teams as LIBERTADORES_TEAMS, 
  matches as LIBERTADORES_MATCHES 
} from "@/app/api/mock/football/data/libertadores-2025";

import { 
  teams as SULAMERICANA_TEAMS, 
  matches as SULAMERICANA_MATCHES 
} from "@/app/api/mock/football/data/sulamericana-2025";

// Generate mock standings for Serie B
const BRA_2_STANDINGS: StandingRow[] = BRA_2_TEAMS.map((team, index) => ({
  teamId: team.id,
  position: index + 1,
  points: Math.max(0, 30 - index * 2),
  played: 10,
  won: Math.max(0, 8 - index),
  draw: 2,
  lost: Math.max(0, index),
  goalsFor: Math.max(5, 20 - index),
  goalsAgainst: Math.max(3, 8 + index),
  goalDifference: Math.max(-10, 12 - index * 2)
}));

// Generate mock standings for Copa do Brasil (not applicable, but keeping for consistency)
const BRA_CUP_STANDINGS: StandingRow[] = [];

// Generate mock standings for Libertadores (group stage format)
const LIBERTADORES_STANDINGS: StandingRow[] = LIBERTADORES_TEAMS.slice(0, 8).map((team, index) => ({
  teamId: team.id,
  position: index + 1,
  points: Math.max(0, 15 - index * 2),
  played: 6,
  won: Math.max(0, 5 - index),
  draw: 1,
  lost: Math.max(0, index),
  goalsFor: Math.max(3, 12 - index),
  goalsAgainst: Math.max(2, 5 + index),
  goalDifference: Math.max(-5, 7 - index * 2)
}));

// Generate mock standings for Sul-americana (group stage format)
const SULAMERICANA_STANDINGS: StandingRow[] = SULAMERICANA_TEAMS.slice(0, 8).map((team, index) => ({
  teamId: team.id,
  position: index + 1,
  points: Math.max(0, 12 - index * 2),
  played: 6,
  won: Math.max(0, 4 - index),
  draw: 1,
  lost: Math.max(0, index + 1),
  goalsFor: Math.max(2, 10 - index),
  goalsAgainst: Math.max(2, 4 + index),
  goalDifference: Math.max(-4, 6 - index * 2)
}));

export interface MockData {
  teams: Team[];
  matches: Match[];
  standings: StandingRow[];
}

export function getMockDataForCompetition(competitionId: string): MockData {
  switch (competitionId) {
    case "BRA-1":
      return {
        teams: BRA_1_TEAMS as Team[],
        matches: BRA_1_MATCHES as Match[],
        standings: BRA_1_STANDINGS as StandingRow[]
      };
    
    case "BRA-2":
      return {
        teams: BRA_2_TEAMS,
        matches: BRA_2_MATCHES,
        standings: BRA_2_STANDINGS
      };
    
    case "BRA-CUP":
      return {
        teams: BRA_CUP_TEAMS,
        matches: BRA_CUP_MATCHES,
        standings: BRA_CUP_STANDINGS
      };
    
    case "LIBERTADORES":
      return {
        teams: LIBERTADORES_TEAMS,
        matches: LIBERTADORES_MATCHES,
        standings: LIBERTADORES_STANDINGS
      };
    
    case "SULAMERICANA":
      return {
        teams: SULAMERICANA_TEAMS,
        matches: SULAMERICANA_MATCHES,
        standings: SULAMERICANA_STANDINGS
      };
    
    default:
      // Fallback to Serie A
      return {
        teams: BRA_1_TEAMS as Team[],
        matches: BRA_1_MATCHES as Match[],
        standings: BRA_1_STANDINGS as StandingRow[]
      };
  }
}