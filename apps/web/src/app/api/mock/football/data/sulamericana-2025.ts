import type { Team, Match } from "@/lib/football/types";

export const COMPETITION_CODE = "SULAMERICANA";
export const SEASON_ID = "2025";

export const teams: Team[] = [
  // Times brasileiros
  { id: "cor", name: "Corinthians", shortName: "Corinthians", acronym: "COR", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png" },
  { id: "san", name: "Santos", shortName: "Santos", acronym: "SAN", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/santos.png" },
  { id: "vas", name: "Vasco da Gama", shortName: "Vasco", acronym: "VAS", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/vasco.png" },
  { id: "int", name: "Internacional", shortName: "Internacional", acronym: "INT", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/internacional.png" },
  { id: "cru", name: "Cruzeiro", shortName: "Cruzeiro", acronym: "CRU", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/cruzeiro.png" },
  { id: "bah", name: "Bahia", shortName: "Bahia", acronym: "BAH", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/bahia.png" },
  { id: "rec", name: "Sport Recife", shortName: "Sport", acronym: "REC", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/sport.png" },
  { id: "cfc", name: "Coritiba", shortName: "Coritiba", acronym: "CFC", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/coritiba.png" },
  
  // Times argentinos
  { id: "ind", name: "Independiente", shortName: "Independiente", acronym: "IND", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/independiente.png" },
  { id: "lan", name: "Lanús", shortName: "Lanús", acronym: "LAN", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/lanus.png" },
  { id: "arg", name: "Argentinos Juniors", shortName: "Argentinos Jr", acronym: "ARG", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/argentinos.png" },
  { id: "def", name: "Defensa y Justicia", shortName: "Defensa", acronym: "DEF", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/defensa.png" },
  
  // Times uruguaios
  { id: "dan", name: "Danubio", shortName: "Danubio", acronym: "DAN", country: "Uruguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/danubio.png" },
  { id: "fen", name: "Fénix", shortName: "Fénix", acronym: "FEN", country: "Uruguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/fenix.png" },
  
  // Times chilenos
  { id: "cat", name: "Universidad Católica", shortName: "U. Católica", acronym: "CAT", country: "Chile", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/catolica.png" },
  { id: "con", name: "Universidad de Concepción", shortName: "U. Concepción", acronym: "CON", country: "Chile", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/concepcion.png" },
  
  // Times colombianos
  { id: "med", name: "Independiente Medellín", shortName: "Medellín", acronym: "MED", country: "Colômbia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/medellin.png" },
  { id: "cal", name: "Deportivo Cali", shortName: "Dep. Cali", acronym: "CAL", country: "Colômbia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/cali.png" },
  { id: "ame", name: "América de Cali", shortName: "América", acronym: "AME", country: "Colômbia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/america-cali.png" },
  { id: "tol", name: "Deportes Tolima", shortName: "Tolima", acronym: "TOL", country: "Colômbia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/tolima.png" },
  
  // Times equatorianos
  { id: "equ", name: "Emelec", shortName: "Emelec", acronym: "EQU", country: "Equador", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/emelec.png" },
  { id: "qui", name: "LDU Quito", shortName: "LDU Quito", acronym: "QUI", country: "Equador", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ldu.png" },
  
  // Times paraguaios
  { id: "gua", name: "Club Guaraní", shortName: "Guaraní", acronym: "GUA", country: "Paraguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/guarani.png" },
  { id: "sol", name: "Sol de América", shortName: "Sol de América", acronym: "SOL", country: "Paraguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/sol.png" },
  
  // Times bolivianos
  { id: "ori", name: "Oriente Petrolero", shortName: "Oriente", acronym: "ORI", country: "Bolívia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/oriente.png" },
  { id: "wil", name: "Jorge Wilstermann", shortName: "Wilstermann", acronym: "WIL", country: "Bolívia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/wilstermann.png" },
  
  // Times peruanos
  { id: "cri", name: "Sporting Cristal", shortName: "Sp. Cristal", acronym: "CRI", country: "Peru", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/cristal.png" },
  { id: "mel", name: "FBC Melgar", shortName: "Melgar", acronym: "MEL", country: "Peru", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/melgar.png" },
  
  // Times venezuelanos
  { id: "zul", name: "Zulia FC", shortName: "Zulia", acronym: "ZUL", country: "Venezuela", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/zulia.png" },
  { id: "est", name: "Estudiantes de Mérida", shortName: "Est. Mérida", acronym: "EST", country: "Venezuela", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/estudiantes-merida.png" }
];

export const matches: Match[] = [
  // Primeira Fase
  {
    id: "1",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-04T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "cor",
    awayTeamId: "ind",
    score: { home: null, away: null, winner: null },
    venue: "Neo Química Arena",
    referee: null,
  },
  {
    id: "2",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-04T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "san",
    awayTeamId: "lan",
    score: { home: null, away: null, winner: null },
    venue: "Vila Belmiro",
    referee: null,
  },
  {
    id: "3",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-05T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "vas",
    awayTeamId: "arg",
    score: { home: null, away: null, winner: null },
    venue: "São Januário",
    referee: null,
  },
  {
    id: "4",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-05T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "int",
    awayTeamId: "def",
    score: { home: null, away: null, winner: null },
    venue: "Beira-Rio",
    referee: null,
  },
  {
    id: "5",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-06T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "cru",
    awayTeamId: "dan",
    score: { home: null, away: null, winner: null },
    venue: "Mineirão",
    referee: null,
  },
  {
    id: "6",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-06T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "bah",
    awayTeamId: "fen",
    score: { home: null, away: null, winner: null },
    venue: "Arena Fonte Nova",
    referee: null,
  },
  {
    id: "7",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-11T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "rec",
    awayTeamId: "cat",
    score: { home: null, away: null, winner: null },
    venue: "Ilha do Retiro",
    referee: null,
  },
  {
    id: "8",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Primeira Fase",
    matchday: 1,
    utcDate: "2025-03-11T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "cfc",
    awayTeamId: "con",
    score: { home: null, away: null, winner: null },
    venue: "Couto Pereira",
    referee: null,
  },
  
  // Segunda Fase
  {
    id: "9",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Segunda Fase",
    matchday: 2,
    utcDate: "2025-04-15T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "cor",
    awayTeamId: "san",
    score: { home: null, away: null, winner: null },
    venue: "Neo Química Arena",
    referee: null,
  },
  {
    id: "10",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Segunda Fase",
    matchday: 2,
    utcDate: "2025-04-16T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "vas",
    awayTeamId: "int",
    score: { home: null, away: null, winner: null },
    venue: "São Januário",
    referee: null,
  }
];