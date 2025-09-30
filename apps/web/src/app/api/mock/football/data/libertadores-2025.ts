import type { Team, Match } from "@/lib/football/types";

export const COMPETITION_CODE = "LIBERTADORES";
export const SEASON_ID = "2025";

export const teams: Team[] = [
  // Times brasileiros
  { id: "fla", name: "Flamengo", shortName: "Flamengo", acronym: "FLA", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/syptwx1473538074.png" },
  { id: "pal", name: "Palmeiras", shortName: "Palmeiras", acronym: "PAL", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/vsqwqp1473538105.png" },
  { id: "bot", name: "Botafogo", shortName: "Botafogo", acronym: "BOT", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/bs5mbw1733004596.png" },
  { id: "flu", name: "Fluminense", shortName: "Fluminense", acronym: "FLU", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/stvvwp1473538082.png" },
  { id: "sao", name: "São Paulo", shortName: "São Paulo", acronym: "SAO", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png" },
  { id: "gre", name: "Grêmio", shortName: "Grêmio", acronym: "GRE", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/uvpwyt1473538089.png" },
  { id: "cam", name: "Atlético Mineiro", shortName: "Atlético-MG", acronym: "CAM", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/x5lixs1743742872.png" },
  { id: "for", name: "Fortaleza", shortName: "Fortaleza", acronym: "FOR", country: "Brasil", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/fortaleza.png" },
  
  // Times argentinos
  { id: "riv", name: "River Plate", shortName: "River Plate", acronym: "RIV", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/river-plate.png" },
  { id: "boc", name: "Boca Juniors", shortName: "Boca Juniors", acronym: "BOC", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/boca-juniors.png" },
  { id: "rac", name: "Racing Club", shortName: "Racing", acronym: "RAC", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/racing.png" },
  { id: "est", name: "Estudiantes", shortName: "Estudiantes", acronym: "EST", country: "Argentina", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/estudiantes.png" },
  
  // Times uruguaios
  { id: "pen", name: "Peñarol", shortName: "Peñarol", acronym: "PEN", country: "Uruguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/penarol.png" },
  { id: "nac", name: "Nacional", shortName: "Nacional", acronym: "NAC", country: "Uruguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/nacional.png" },
  
  // Times chilenos
  { id: "col", name: "Colo-Colo", shortName: "Colo-Colo", acronym: "COL", country: "Chile", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/colo-colo.png" },
  { id: "uch", name: "Universidad de Chile", shortName: "U. de Chile", acronym: "UCH", country: "Chile", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/u-chile.png" },
  
  // Times colombianos
  { id: "mil", name: "Millonarios", shortName: "Millonarios", acronym: "MIL", country: "Colômbia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/millonarios.png" },
  { id: "jun", name: "Junior", shortName: "Junior", acronym: "JUN", country: "Colômbia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/junior.png" },
  
  // Times equatorianos
  { id: "ind", name: "Independiente del Valle", shortName: "Ind. del Valle", acronym: "IND", country: "Equador", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/ind-valle.png" },
  { id: "bar", name: "Barcelona SC", shortName: "Barcelona SC", acronym: "BAR", country: "Equador", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/barcelona-sc.png" },
  
  // Times paraguaios
  { id: "lib", name: "Libertad", shortName: "Libertad", acronym: "LIB", country: "Paraguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/libertad.png" },
  { id: "cer", name: "Cerro Porteño", shortName: "Cerro Porteño", acronym: "CER", country: "Paraguai", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/cerro.png" },
  
  // Times bolivianos
  { id: "bol", name: "Bolívar", shortName: "Bolívar", acronym: "BOL", country: "Bolívia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/bolivar.png" },
  { id: "str", name: "The Strongest", shortName: "The Strongest", acronym: "STR", country: "Bolívia", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/strongest.png" },
  
  // Times peruanos
  { id: "ali", name: "Alianza Lima", shortName: "Alianza Lima", acronym: "ALI", country: "Peru", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/alianza.png" },
  { id: "uni", name: "Universitario", shortName: "Universitario", acronym: "UNI", country: "Peru", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/universitario.png" },
  
  // Times venezuelanos
  { id: "car", name: "Caracas FC", shortName: "Caracas", acronym: "CAR", country: "Venezuela", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/caracas.png" },
  { id: "dep", name: "Deportivo Táchira", shortName: "Dep. Táchira", acronym: "DEP", country: "Venezuela", logoUrl: "https://r2.thesportsdb.com/images/media/team/badge/tachira.png" }
];

export const matches: Match[] = [
  // Fase de Grupos - Grupo A
  {
    id: "1",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-04T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "fla",
    awayTeamId: "riv",
    score: { home: null, away: null, winner: null },
    venue: "Maracanã",
    referee: null,
  },
  {
    id: "2",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-04T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "pen",
    awayTeamId: "col",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Centenário",
    referee: null,
  },
  
  // Fase de Grupos - Grupo B
  {
    id: "3",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-05T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "pal",
    awayTeamId: "boc",
    score: { home: null, away: null, winner: null },
    venue: "Allianz Parque",
    referee: null,
  },
  {
    id: "4",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-05T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "mil",
    awayTeamId: "lib",
    score: { home: null, away: null, winner: null },
    venue: "Estádio El Campín",
    referee: null,
  },
  
  // Fase de Grupos - Grupo C
  {
    id: "5",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-06T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "bot",
    awayTeamId: "rac",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Nilton Santos",
    referee: null,
  },
  {
    id: "6",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-06T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "ind",
    awayTeamId: "bol",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Banco Guayaquil",
    referee: null,
  },
  
  // Fase de Grupos - Grupo D
  {
    id: "7",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-11T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "flu",
    awayTeamId: "est",
    score: { home: null, away: null, winner: null },
    venue: "Maracanã",
    referee: null,
  },
  {
    id: "8",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Fase de Grupos",
    matchday: 1,
    utcDate: "2025-02-11T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "ali",
    awayTeamId: "car",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Alejandro Villanueva",
    referee: null,
  },
  
  // Oitavas de Final
  {
    id: "9",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Oitavas de Final",
    matchday: 2,
    utcDate: "2025-05-13T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "fla",
    awayTeamId: "pal",
    score: { home: null, away: null, winner: null },
    venue: "Maracanã",
    referee: null,
  },
  {
    id: "10",
    competitionId: COMPETITION_CODE,
    seasonId: SEASON_ID,
    round: "Oitavas de Final",
    matchday: 2,
    utcDate: "2025-05-14T21:00:00.000Z",
    status: "scheduled",
    homeTeamId: "bot",
    awayTeamId: "riv",
    score: { home: null, away: null, winner: null },
    venue: "Estádio Nilton Santos",
    referee: null,
  }
];