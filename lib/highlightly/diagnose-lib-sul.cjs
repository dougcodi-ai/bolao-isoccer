// Diagnostic script for Libertadores and Sudamericana match queries via RapidAPI
// Captures request params, status codes, and response headers/bodies.

const fs = require('fs');

function readRapidApiKey() {
  const fromEnv = process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY;
  if (fromEnv) return fromEnv.trim();
  try {
    const envPath = 'apps/web/.env.local';
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^(?:X_)?RAPIDAPI_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim();
  } catch (_) {}
  return null;
}

async function fetchWithHeaders(url, headers) {
  const res = await fetch(url, { headers });
  const bodyText = await res.text();
  const headersObj = {};
  for (const [k, v] of res.headers) headersObj[k] = v;
  let body;
  try { body = JSON.parse(bodyText); } catch { body = bodyText; }
  return { status: res.status, headers: headersObj, body };
}

async function testLeague(leagueId) {
  const base = 'https://sport-highlights-api.p.rapidapi.com/football/matches';
  const headers = {
    'x-rapidapi-key': readRapidApiKey(),
    'x-rapidapi-host': 'sport-highlights-api.p.rapidapi.com'
  };
  if (!headers['x-rapidapi-key']) {
    console.error('RAPIDAPI_KEY not found.');
    process.exit(2);
  }

  const tests = [
    { label: 'limit=40, offset=0', qs: `leagueId=${leagueId}&limit=40&offset=0` },
    { label: 'limit=99, offset=0', qs: `leagueId=${leagueId}&limit=99&offset=0` },
    { label: 'no limit/offset', qs: `leagueId=${leagueId}` },
  ];

  for (const t of tests) {
    const url = `${base}?${t.qs}`;
    const result = await fetchWithHeaders(url, headers);
    console.log(JSON.stringify({ leagueId, test: t.label, url, result }, null, 2));
  }
}

async function main() {
  const leagues = [
    { name: 'CONMEBOL Libertadores', id: 11847 },
    { name: 'CONMEBOL Sudamericana', id: 10145 }
  ];
  for (const l of leagues) {
    console.log(`\n--- Diagnosing ${l.name} (${l.id}) ---`);
    await testLeague(l.id);
  }
}

main().catch(err => {
  console.error('diagnostic error:', err?.message || err);
  process.exit(1);
});