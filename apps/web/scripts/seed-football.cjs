require('dotenv').config({ path: './apps/web/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = global.fetch || require('node-fetch');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
// Toggle para usar a plataforma nativa da Highlightly
const RAPIDAPI_USE_NATIVE = String(process.env.RAPIDAPI_USE_NATIVE).toLowerCase() === 'true';
// Bases de URL
const RAPIDAPI_HOST = 'sport-highlights-api.p.rapidapi.com';
const BASE = RAPIDAPI_USE_NATIVE
  ? 'https://sports.highlightly.net/football'
  : 'https://sport-highlights-api.p.rapidapi.com/football';

const COMPETITIONS = [
  { code: 'BRA-1', name: 'Brasileirão Série A' },
  { code: 'BRA-2', name: 'Brasileirão Série B' },
  { code: 'BRA-CUP', name: 'Copa do Brasil' },
  { code: 'LIBERTADORES', name: 'Libertadores' },
  { code: 'SULAMERICANA', name: 'Sul-Americana' },
];

const STATIC_LEAGUE = {
  'BRA-1': 61205,
  'BRA-2': 62056,
  'BRA-CUP': 62907,
  // Overrides para competições continentais com IDs confirmados via RapidAPI
  'LIBERTADORES': 11847, // CONMEBOL Libertadores
  'SULAMERICANA': 10145, // CONMEBOL Sudamericana
};

async function req(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  // Tentativas com backoff para lidar com 429/5xx
  let attempt = 0;
  const maxAttempts = 5;
  const baseDelay = 800; // ms
  while (true) {
    const headers = RAPIDAPI_USE_NATIVE
      ? { 'x-rapidapi-key': RAPIDAPI_KEY || '' }
      : { 'x-rapidapi-key': RAPIDAPI_KEY || '', 'x-rapidapi-host': RAPIDAPI_HOST };
    const res = await fetch(url.toString(), { headers });
    if (res.ok) return res.json();
    attempt++;
    const status = res.status;
    const body = await res.text();
    if (attempt >= maxAttempts || (status !== 429 && status < 500)) {
      throw new Error(`HTTP ${status}: ${body}`);
    }
    const wait = baseDelay * Math.pow(2, attempt - 1);
    await new Promise((r) => setTimeout(r, wait));
  }
}

// Paginação para coletar todas as partidas respeitando limite=100
async function fetchAllMatches(leagueId, seasonYear) {
  const all = [];
  let offset = 0;
  const limit = 40; // limite mais conservador para todas as ligas
  while (true) {
    const data = await req('/matches', { leagueId, season: seasonYear, offset, limit });
    const batch = data.matches || data.data || [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < limit || all.length > 3000) break;
    offset += limit;
  }
  return all;
}

async function resolveLeagueId(code) {
  if (STATIC_LEAGUE[code]) return STATIC_LEAGUE[code];
  const nameParam = code === 'LIBERTADORES' ? 'libertadores' : code === 'SULAMERICANA' ? 'sul-americana' : '';
  if (nameParam) {
    const byName = await req('/leagues', { leagueName: nameParam, limit: 5 });
    const list = byName.leagues || byName.data || [];
    const pickByName = list.find(l => (l.name || '').toLowerCase().includes(nameParam.replace('-', ' ')));
    if (pickByName) return pickByName.id;
  }
  const leagues = (await req('/leagues', { limit: 500 })).leagues || [];
  const pick = leagues.find(l => {
    const n = (l.name || '').toLowerCase();
    if (code === 'LIBERTADORES') return n.includes('libertadores');
    if (code === 'SULAMERICANA') return n.includes('sul') && n.includes('america');
    return false;
  });
  return pick ? pick.id : null;
}

async function seedCompetition(sb, comp, seasonYear) {
  console.log(`\n=== Seeding ${comp.name} (${comp.code}) - ${seasonYear} ===`);

  const { data: compRows, error: compErr } = await sb
    .from('football_competitions')
    .upsert([{ code: comp.code, name: comp.name, country: 'Brasil', ext_provider: 'mock', ext_id: comp.code }], { onConflict: 'code' })
    .select('id')
    .limit(1);
  if (compErr || !compRows?.[0]) throw new Error(compErr?.message || 'Failed competition upsert');
  const competitionId = compRows[0].id;

  const { data: seasonRows, error: seasonErr } = await sb
    .from('football_seasons')
    .upsert([{ competition_id: competitionId, year: seasonYear, name: String(seasonYear) }], { onConflict: 'competition_id,year' })
    .select('id')
    .limit(1);
  if (seasonErr || !seasonRows?.[0]) throw new Error(seasonErr?.message || 'Failed season upsert');
  const seasonId = seasonRows[0].id;

  let matches = [];
  try {
    const leagueId = await resolveLeagueId(comp.code);
    if (leagueId) {
      matches = await fetchAllMatches(leagueId, seasonYear);
      console.log(`Highlightly: ${matches.length} matches`);
    } else {
      // fallback por nome da liga
      const leagueName = comp.code === 'LIBERTADORES' ? 'libertadores' : comp.code === 'SULAMERICANA' ? 'sul-americana' : null;
      if (leagueName) {
        const collected = [];
        let offset = 0;
        const limit = 40;
        while (true) {
          const data = await req('/matches', { leagueName, season: seasonYear, offset, limit });
          const batch = data.matches || data.data || [];
          if (batch.length === 0) break;
          collected.push(...batch);
          if (batch.length < limit || collected.length > 3000) break;
          offset += limit;
        }
        matches = collected;
        console.log(`Highlightly (by name): ${matches.length} matches`);
      }
    }
  } catch (e) {
    console.warn(`Highlightly error for ${comp.code}:`, e.message);
  }

  // Fallback to mock if no real matches
  if (!matches || matches.length === 0) {
    console.log('Using mock data fallback');
    const mock = generateMockData(comp.code);
    matches = mock.matches || [];
  }

  // Derive teams
  const teamMap = new Map();
  for (const m of matches) {
    const h = m.homeTeam || m.home_team || m.home;
    const a = m.awayTeam || m.away_team || m.away;
    if (h && h.id) teamMap.set(String(h.id), { id: String(h.id), name: h.name || h.shortName || `Team ${h.id}`, acronym: h.shortName || null, logo_path: null });
    if (a && a.id) teamMap.set(String(a.id), { id: String(a.id), name: a.name || a.shortName || `Team ${a.id}`, acronym: a.shortName || null, logo_path: null });
  }

  const teamRows = Array.from(teamMap.values()).map(t => ({
    name: t.name,
    short_name: t.acronym,
    acronym: t.acronym,
    country: 'Brasil',
    logo_path: t.logo_path,
    ext_provider: 'mock',
    ext_id: t.id,
  }));
  const { data: upsertedTeams, error: teamErr } = await sb
    .from('football_teams')
    .upsert(teamRows, { onConflict: 'ext_provider,ext_id' })
    .select('id, ext_id');
  if (teamErr) throw new Error(teamErr.message);
  const idByExt = Object.fromEntries((upsertedTeams || []).map(r => [String(r.ext_id), r.id]));

  const matchRows = matches.map(m => {
    const md = m.matchday || m.round || null;
    const date = m.date || m.utcDate || m.start_time;
    const h = m.homeTeam || m.home_team || m.home;
    const a = m.awayTeam || m.away_team || m.away;
    const score = m.score || {}; 
    return {
      competition_id: competitionId,
      season_id: seasonId,
      round: md,
      matchday: typeof md === 'number' ? md : null,
      start_time: date,
      status: (m.status || 'scheduled').toLowerCase(),
      home_team_id: idByExt[String(h?.id)] || null,
      away_team_id: idByExt[String(a?.id)] || null,
      home_score: score.home ?? null,
      away_score: score.away ?? null,
      venue: m.venue || null,
      referee: m.referee || null,
      ext_provider: 'mock',
      ext_id: String(m.id || m.ext_id || `${comp.code}-${date}`),
    };
  }).filter(r => r.home_team_id && r.away_team_id && r.start_time);

  const { data: upsertedMatches, error: matchErr } = await sb
    .from('football_matches')
    .upsert(matchRows, { onConflict: 'ext_provider,ext_id' })
    .select('id');
  if (matchErr) throw new Error(matchErr.message);

  console.log(`Teams upserted: ${upsertedTeams?.length || 0}, Matches upserted: ${upsertedMatches?.length || 0}`);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase envs');
    process.exit(1);
  }
  console.log(`[Highlightly] Base: ${BASE} | Native: ${RAPIDAPI_USE_NATIVE ? 'true' : 'false'}`);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const seasonYear = 2025;
  for (const comp of COMPETITIONS) {
    try {
      await seedCompetition(sb, comp, seasonYear);
    } catch (e) {
      console.error(`Error seeding ${comp.code}:`, e.message);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });

// Simple local mock generator for teams and matches when provider is unavailable
function generateMockData(code) {
  const teamCount = code === 'BRA-1' ? 20 : code === 'BRA-2' ? 20 : 16;
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    id: `${code}-T${i + 1}`,
    name: `${code} Clube ${i + 1}`,
    shortName: `C${i + 1}`,
  }));
  const rounds = 30;
  const matches = [];
  let idCounter = 1;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < teamCount; i += 2) {
      const home = teams[i % teamCount];
      const away = teams[(i + 1) % teamCount];
      const d = new Date(start);
      d.setDate(start.getDate() + r);
      matches.push({
        id: `${code}-M${idCounter++}`,
        date: d.toISOString(),
        status: d > new Date() ? 'scheduled' : 'finished',
        homeTeam: { id: home.id, name: home.name, shortName: home.shortName },
        awayTeam: { id: away.id, name: away.name, shortName: away.shortName },
        round: `R${r}`,
        matchday: r,
        score: d > new Date() ? { home: null, away: null } : { home: Math.floor(Math.random() * 4), away: Math.floor(Math.random() * 4) },
        venue: null,
        referee: null,
      });
    }
  }
  return { teams, matches };
}