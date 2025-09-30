// Utility script to verify Libertadores and Sudamericana availability
// Checks both Highlightly native platform and RapidAPI proxy.

const fs = require('fs');

function readRapidApiKey() {
  // Try env first
  const fromEnv = process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY;
  if (fromEnv) return fromEnv.trim();
  // Fallback: read from apps/web/.env.local
  try {
    const envPath = 'apps/web/.env.local';
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^(?:X_)?RAPIDAPI_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim();
  } catch (_) {}
  return null;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function formatFound(leagues) {
  if (!Array.isArray(leagues)) return [];
  return leagues.map(l => ({ id: l.id, name: l.name, country: l.countryName, seasons: l.seasons?.length || 0 })).slice(0, 10);
}

async function main() {
  const key = readRapidApiKey();
  if (!key) {
    console.error('RAPIDAPI_KEY not found. Set env or apps/web/.env.local');
    process.exit(2);
  }

  const queries = [
    'Libertadores',
    'Copa Libertadores',
    'CONMEBOL Libertadores',
    'Sudamericana',
    'Copa Sudamericana',
    'CONMEBOL Sudamericana'
  ];

  const nativeBase = 'https://sports.highlightly.net/football/leagues';
  const rapidBase = 'https://sport-highlights-api.p.rapidapi.com/football/leagues';

  console.log('Checking Highlightly native platform for league availability...');
  for (const q of queries) {
    const url = `${nativeBase}?leagueName=${encodeURIComponent(q)}&limit=20`;
    const { status, json } = await fetchJson(url, { 'x-rapidapi-key': key });
    const found = formatFound(json?.data || json);
    console.log(JSON.stringify({ platform: 'highlightly', query: q, status, found }, null, 2));
  }

  console.log('\nChecking RapidAPI proxy for league availability...');
  for (const q of queries) {
    const url = `${rapidBase}?leagueName=${encodeURIComponent(q)}&limit=20`;
    const { status, json } = await fetchJson(url, { 'x-rapidapi-key': key, 'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com' });
    const found = formatFound(json?.data || json);
    console.log(JSON.stringify({ platform: 'rapidapi', query: q, status, found }, null, 2));
  }
}

main().catch(err => {
  console.error('check-leagues error:', err?.message || err);
  process.exit(1);
});