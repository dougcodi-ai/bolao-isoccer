// Mock dataset for Brasileirão Série A 2025
// This is a lightweight synthetic dataset for local development.
import type { Team, Match, StandingRow } from "@/lib/football/types";

export const COMPETITION_CODE = "BRA-1";
export const SEASON_YEAR = 2025;

export const TEAMS: Team[] = [
  { id: "fla", name: "Flamengo", shortName: "Flamengo", acronym: "FLA", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png" },
  { id: "pal", name: "Palmeiras", shortName: "Palmeiras", acronym: "PAL", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png" },
  { id: "sao", name: "São Paulo", shortName: "São Paulo", acronym: "SAO", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png" },
  { id: "cor", name: "Corinthians", shortName: "Corinthians", acronym: "COR", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png" },
  { id: "flu", name: "Fluminense", shortName: "Fluminense", acronym: "FLU", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png" },
  { id: "bot", name: "Botafogo", shortName: "Botafogo", acronym: "BOT", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png" },
  { id: "vas", name: "Vasco da Gama", shortName: "Vasco", acronym: "VAS", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ynqlxo1630521109.png" },
  { id: "gre", name: "Grêmio", shortName: "Grêmio", acronym: "GRE", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png" },
  { id: "int", name: "Internacional", shortName: "Internacional", acronym: "INT", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/yprvxx1473538097.png" },
  { id: "cam", name: "Atlético Mineiro", shortName: "Atlético-MG", acronym: "CAM", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png" },
  { id: "cru", name: "Cruzeiro", shortName: "Cruzeiro", acronym: "CRU", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/upsvvu1473538059.png" },
  { id: "bah", name: "Bahia", shortName: "Bahia", acronym: "BAH", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/xuvtsv1473539308.png" },
  { id: "for", name: "Fortaleza", shortName: "Fortaleza", acronym: "FOR", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/tosmdr1532853458.png" },
  { id: "rbb", name: "RB Bragantino", shortName: "Bragantino", acronym: "RBB", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/2p7tl41701423595.png" },
  { id: "vit", name: "Vitória", shortName: "Vitória", acronym: "VIT", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/tysrrx1473538156.png" },
  { id: "juv", name: "Juventude", shortName: "Juventude", acronym: "JUV", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ims5r81595004684.png" },
  // Times promovidos da Série B 2024
  { id: "san", name: "Santos", shortName: "Santos", acronym: "SAN", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/qwrqpy1473538128.png" },
  { id: "mir", name: "Mirassol", shortName: "Mirassol", acronym: "MIR", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/mirassol.png" },
  { id: "spo", name: "Sport", shortName: "Sport", acronym: "SPO", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/qwrqpy1473538128.png" },
  { id: "cea", name: "Ceará", shortName: "Ceará", acronym: "CEA", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ceara.png" }
];

function iso(date: string) { return new Date(date).toISOString(); }

export const MATCHES: Match[] = [
  // Dev: finished samples (past)
  { id: "p1-01", externalId: "p1-01", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-01T19:00:00-03:00"), status: "finished", homeTeamId: "fla", awayTeamId: "pal", score: { home: 2, away: 1, winner: "HOME" } },
  { id: "p1-02", externalId: "p1-02", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-02T21:00:00-03:00"), status: "finished", homeTeamId: "sao", awayTeamId: "cor", score: { home: 1, away: 1, winner: null } },
  { id: "p1-03", externalId: "p1-03", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-03T16:00:00-03:00"), status: "finished", homeTeamId: "flu", awayTeamId: "bot", score: { home: 0, away: 3, winner: "AWAY" } },
  { id: "p1-04", externalId: "p1-04", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-04T18:30:00-03:00"), status: "finished", homeTeamId: "vas", awayTeamId: "gre", score: { home: 2, away: 2, winner: null } },
  { id: "p1-05", externalId: "p1-05", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-05T20:00:00-03:00"), status: "finished", homeTeamId: "int", awayTeamId: "cam", score: { home: 1, away: 2, winner: "AWAY" } },
  { id: "p1-06", externalId: "p1-06", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-06T19:00:00-03:00"), status: "finished", homeTeamId: "san", awayTeamId: "cru", score: { home: 3, away: 2, winner: "HOME" } },
  { id: "p1-07", externalId: "p1-07", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-07T20:00:00-03:00"), status: "finished", homeTeamId: "bah", awayTeamId: "for", score: { home: 0, away: 0, winner: null } },
  { id: "p1-08", externalId: "p1-08", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 0, utcDate: iso("2025-07-08T21:00:00-03:00"), status: "finished", homeTeamId: "rbb", awayTeamId: "mir", score: { home: 4, away: 1, winner: "HOME" } },
  // Matchday 1
  { id: "m1-01", externalId: "m1-01", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-06T19:00:00-03:00"), status: "scheduled", homeTeamId: "fla", awayTeamId: "pal", score: { home: null, away: null, winner: null } },
  { id: "m1-02", externalId: "m1-02", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-06T21:00:00-03:00"), status: "scheduled", homeTeamId: "sao", awayTeamId: "cor", score: { home: null, away: null, winner: null } },
  { id: "m1-03", externalId: "m1-03", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-07T16:00:00-03:00"), status: "scheduled", homeTeamId: "flu", awayTeamId: "bot", score: { home: null, away: null, winner: null } },
  { id: "m1-04", externalId: "m1-04", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-07T18:30:00-03:00"), status: "scheduled", homeTeamId: "vas", awayTeamId: "gre", score: { home: null, away: null, winner: null } },
  { id: "m1-05", externalId: "m1-05", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-07T20:00:00-03:00"), status: "scheduled", homeTeamId: "int", awayTeamId: "cam", score: { home: null, away: null, winner: null } },
  { id: "m1-06", externalId: "m1-06", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-08T19:00:00-03:00"), status: "scheduled", homeTeamId: "san", awayTeamId: "cru", score: { home: null, away: null, winner: null } },
  { id: "m1-07", externalId: "m1-07", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-08T20:00:00-03:00"), status: "scheduled", homeTeamId: "bah", awayTeamId: "for", score: { home: null, away: null, winner: null } },
  { id: "m1-08", externalId: "m1-08", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-08T21:00:00-03:00"), status: "scheduled", homeTeamId: "rbb", awayTeamId: "mir", score: { home: null, away: null, winner: null } },
  { id: "m1-09", externalId: "m1-09", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-09T19:00:00-03:00"), status: "scheduled", homeTeamId: "spo", awayTeamId: "vit", score: { home: null, away: null, winner: null } },
  { id: "m1-10", externalId: "m1-10", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 1, utcDate: iso("2025-12-09T20:00:00-03:00"), status: "scheduled", homeTeamId: "juv", awayTeamId: "cea", score: { home: null, away: null, winner: null } },
  // Matchday 2
  { id: "m2-01", externalId: "m2-01", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-13T19:00:00-03:00"), status: "scheduled", homeTeamId: "pal", awayTeamId: "sao", score: { home: null, away: null, winner: null } },
  { id: "m2-02", externalId: "m2-02", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-13T21:00:00-03:00"), status: "scheduled", homeTeamId: "cor", awayTeamId: "flu", score: { home: null, away: null, winner: null } },
  { id: "m2-03", externalId: "m2-03", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-14T16:00:00-03:00"), status: "scheduled", homeTeamId: "bot", awayTeamId: "vas", score: { home: null, away: null, winner: null } },
  { id: "m2-04", externalId: "m2-04", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-14T18:30:00-03:00"), status: "scheduled", homeTeamId: "gre", awayTeamId: "int", score: { home: null, away: null, winner: null } },
  { id: "m2-05", externalId: "m2-05", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-14T20:00:00-03:00"), status: "scheduled", homeTeamId: "cam", awayTeamId: "san", score: { home: null, away: null, winner: null } },
  { id: "m2-06", externalId: "m2-06", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-15T19:00:00-03:00"), status: "scheduled", homeTeamId: "cru", awayTeamId: "bah", score: { home: null, away: null, winner: null } },
  { id: "m2-07", externalId: "m2-07", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-15T20:00:00-03:00"), status: "scheduled", homeTeamId: "for", awayTeamId: "rbb", score: { home: null, away: null, winner: null } },
  { id: "m2-08", externalId: "m2-08", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-15T21:00:00-03:00"), status: "scheduled", homeTeamId: "mir", awayTeamId: "spo", score: { home: null, away: null, winner: null } },
  { id: "m2-09", externalId: "m2-09", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-16T19:00:00-03:00"), status: "scheduled", homeTeamId: "vit", awayTeamId: "juv", score: { home: null, away: null, winner: null } },
  { id: "m2-10", externalId: "m2-10", competitionId: COMPETITION_CODE, seasonId: String(SEASON_YEAR), matchday: 2, utcDate: iso("2025-12-16T20:00:00-03:00"), status: "scheduled", homeTeamId: "cea", awayTeamId: "fla", score: { home: null, away: null, winner: null } }
];

export const STANDINGS: StandingRow[] = TEAMS.map((t, i) => ({
  teamId: t.id,
  position: i + 1,
  points: 0,
  played: 0,
  won: 0,
  draw: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
}));