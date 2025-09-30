import type { Team, Match } from "@/lib/football/types";

export const COMPETITION_CODE = "BRA-CUP";
export const SEASON_ID = "2025";

export const teams: Team[] = [
  // Times da Série A
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
  
  // Times da Série B
  { id: "san", name: "Santos", shortName: "Santos", acronym: "SAN", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/qwrqpy1473538128.png" },
  { id: "spo", name: "Sport", shortName: "Sport", acronym: "SPO", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/sport.png" },
  { id: "cea", name: "Ceará", shortName: "Ceará", acronym: "CEA", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ceara.png" },
  { id: "goi", name: "Goiás", shortName: "Goiás", acronym: "GOI", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/goias.png" },
  
  // Times de divisões inferiores e estaduais
  { id: "abc", name: "ABC", shortName: "ABC", acronym: "ABC", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/abc.png" },
  { id: "csa", name: "CSA", shortName: "CSA", acronym: "CSA", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/csa.png" },
  { id: "fer", name: "Ferroviário", shortName: "Ferroviário", acronym: "FER", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ferroviario.png" },
  { id: "ric", name: "Rio Claro", shortName: "Rio Claro", acronym: "RIC", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/rio-claro.png" },
  { id: "tre", name: "Treze", shortName: "Treze", acronym: "TRE", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/treze.png" },
  { id: "cam-pb", name: "Campinense", shortName: "Campinense", acronym: "CAM", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/campinense.png" }
];

export const matches: Match[] = [
  // Primeira Fase
  {
    id: "1",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "1ª Fase",
    matchday: 1,
    utcDate: "2025-02-20T21:30:00.000Z",
    status: "scheduled",
    homeTeamId: "abc",
    awayTeamId: "csa",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Frasqueirão",
    referee: null,
  },
  {
    id: "2",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "1ª Fase",
    matchday: 1,
    utcDate: "2025-02-20T21:30:00.000Z",
    status: "scheduled",
    homeTeamId: "fer",
    awayTeamId: "ric",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Elzir Cabral",
    referee: null,
  },
  {
    id: "3",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "1ª Fase",
    matchday: 1,
    utcDate: "2025-02-21T21:30:00.000Z",
    status: "scheduled",
    homeTeamId: "tre",
    awayTeamId: "cam-pb",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Presidente Vargas",
    referee: null,
  },
  
  // Segunda Fase (com times grandes entrando)
  {
    id: "4",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "2ª Fase",
    matchday: 2,
    utcDate: "2025-03-05T21:30:00.000Z",
    status: "scheduled",
    homeTeamId: "fla",
    awayTeamId: "abc",
    score: { home: null, away: null, winner: null },
    venue: "Maracanã",
    referee: null,
  },
  {
    id: "5",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "2ª Fase",
    matchday: 2,
    utcDate: "2025-03-05T21:30:00.000Z",
    status: "scheduled",
    homeTeamId: "pal",
    awayTeamId: "fer",
    score: { home: null, away: null, winner: null },
    venue: "Allianz Parque",
    referee: null,
  }
];