import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function normalizeText(s?: string | null) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveChampionship(poolInfo?: { championship?: string | null; name?: string | null }): string {
  const base = poolInfo?.championship && poolInfo.championship.trim().length > 0
    ? poolInfo.championship
    : (poolInfo?.name || '');
  const n = normalizeText(base);
  const m = n.replace(/\s+/g, '');
  if (m === 'aaa') return 'Brasileirão Série A';
  if (m === 'bbb') return 'Brasileirão Série B';
  if (m === 'ccc') return 'Copa do Brasil';
  if (n.includes('serie a') || n.includes('brasileirao')) return 'Brasileirão Série A';
  if (n.includes('serie b') || n.includes('bezona')) return 'Brasileirão Série B';
  if (n.includes('copa do brasil') || n.includes('copa brasil')) return 'Copa do Brasil';
  return poolInfo?.championship || '';
}

function mapChampionshipToCompetitionCode(championship?: string | null): { code: string; supported: boolean } {
  const n = normalizeText(championship || '');
  if (n.includes('serie a') || n.includes('brasileirao')) return { code: 'BRA-1', supported: true };
  if (n.includes('serie b') || n.includes('bezona')) return { code: 'BRA-2', supported: true };
  if (n.includes('copa do brasil') || n.includes('copa brasil')) return { code: 'BRA-CUP', supported: true };
  if (n.includes('libertadores')) return { code: 'LIBERTADORES', supported: true };
  if (n.includes('sul-americana') || n.includes('sulamericana')) return { code: 'SULAMERICANA', supported: true };
  return { code: 'BRA-1', supported: false };
}

async function ensureFootballBase(sb: any, origin: string, competitionCode: string): Promise<{ competitionId: string; seasonId: string; seasonYear: number }> {
  const seasonYear = new Date().getFullYear();
  const { data: compRow, error: compErr } = await sb
    .from('football_competitions')
    .select('id')
    .eq('code', competitionCode)
    .maybeSingle();
  if (compErr) throw new Error(compErr.message);

  let competitionId = compRow?.id as string | undefined;
  if (!competitionId) {
    try {
      await fetch(`${origin}/api/football/seed?competition=${competitionCode}&season=${seasonYear}`, { method: 'POST' });
    } catch (_) { /* ignore */ }
    const { data: comp2, error: compErr2 } = await sb
      .from('football_competitions')
      .select('id')
      .eq('code', competitionCode)
      .maybeSingle();
    if (compErr2) throw new Error(compErr2.message);
    competitionId = comp2?.id as string | undefined;
  }
  if (!competitionId) throw new Error(`Competição ${competitionCode} não encontrada em football_competitions`);

  const { data: seasonRow, error: seasonErr } = await sb
    .from('football_seasons')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('year', seasonYear)
    .maybeSingle();
  if (seasonErr) throw new Error(seasonErr.message);

  let seasonId = seasonRow?.id as string | undefined;
  if (!seasonId) {
    try {
      await fetch(`${origin}/api/football/seed?competition=${competitionCode}&season=${seasonYear}`, { method: 'POST' });
    } catch (_) { /* ignore */ }
    const { data: season2, error: seasonErr2 } = await sb
      .from('football_seasons')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('year', seasonYear)
      .maybeSingle();
    if (seasonErr2) throw new Error(seasonErr2.message);
    seasonId = season2?.id as string | undefined;
  }
  if (!seasonId) throw new Error(`Temporada ${seasonYear} não encontrada em football_seasons para ${competitionCode}`);

  return { competitionId, seasonId, seasonYear };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bolaoId = searchParams.get('bolao_id');
    const url = new URL(request.url);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return NextResponse.json({ ok: false, error: 'Supabase env not configured' }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, (serviceKey || anonKey) as string);

    if (!bolaoId) {
      return NextResponse.json({ ok: false, error: 'Missing bolao_id parameter' }, { status: 400 });
    }

    // 1) Buscar dados do bolão
    const { data: poolInfo, error: poolErr } = await sb
      .from('pools')
      .select('id, name, championship')
      .eq('id', bolaoId)
      .maybeSingle();
    if (poolErr) return NextResponse.json({ ok: false, error: poolErr.message }, { status: 500 });
    if (!poolInfo) return NextResponse.json({ ok: false, error: 'Bolão não encontrado' }, { status: 404 });

    const championship = resolveChampionship(poolInfo || undefined);
    const { code: compCode } = mapChampionshipToCompetitionCode(championship);

    // 2) Garantir competição/temporada e buscar jogos canônicos
    // Garantir base de futebol para ter times/logos disponíveis
    let competitionId: string, seasonId: string, seasonYear: number;
    ({ competitionId, seasonId, seasonYear } = await ensureFootballBase(sb, url.origin, compCode));

    // Buscar jogos do bolão; se estiver vazio, acionar ensure-matches para copiar do calendário canônico
    let { data: fixturesData, error: fixturesErr } = await sb
      .from('matches')
      .select('*')
      .eq('pool_id', bolaoId)
      .order('start_time', { ascending: true });
    if (fixturesErr) return NextResponse.json({ ok: false, error: fixturesErr.message }, { status: 500 });

    if (!fixturesData || fixturesData.length === 0) {
      try {
        await fetch(`${url.origin}/api/pools/${bolaoId}/ensure-matches?season=${seasonYear}`, { method: 'POST' });
      } catch (_) { /* ignore */ }
      const again = await sb
        .from('matches')
        .select('*')
        .eq('pool_id', bolaoId)
        .order('start_time', { ascending: true });
      fixturesData = again.data || [];
    }

    // Enriquecer com logos a partir de football_teams por acrônimo/nome
    const acronyms = Array.from(new Set((fixturesData || []).flatMap((f: any) => [f.home_acr, f.away_acr]).filter(Boolean)));
    const names = Array.from(new Set((fixturesData || []).flatMap((f: any) => [f.home_team, f.away_team]).filter(Boolean)));

    const teamMapByAcr: Record<string, any> = {};
    const teamMapByName: Record<string, any> = {};

    // Consulta por acrônimo
    if (acronyms.length > 0) {
      const { data: teamsByAcr, error: acrErr } = await sb
        .from('football_teams')
        .select('id, name, acronym, logo_path')
        .in('acronym', acronyms);
      if (acrErr) return NextResponse.json({ ok: false, error: acrErr.message }, { status: 500 });
      (teamsByAcr || []).forEach((t: any) => { if (t.acronym) teamMapByAcr[String(t.acronym).toUpperCase()] = t; });
    }

    // Consulta por nome (para ambientes sem acrônimo)
    if (names.length > 0) {
      const { data: teamsByName, error: nameErr } = await sb
        .from('football_teams')
        .select('id, name, acronym, logo_path')
        .in('name', names);
      if (nameErr) return NextResponse.json({ ok: false, error: nameErr.message }, { status: 500 });
      (teamsByName || []).forEach((t: any) => { if (t.name) teamMapByName[String(t.name).trim().toLowerCase()] = t; });
    }

    const toPublicUrl = (path?: string | null) => {
      if (!path) return null;
      try {
        const { data } = sb.storage.from('team-logos').getPublicUrl(path);
        return data?.publicUrl || null;
      } catch {
        return null;
      }
    };

    const matches = (fixturesData || []).map((f: any) => {
      const ht = f.home_acr ? teamMapByAcr[String(f.home_acr).toUpperCase()] : teamMapByName[String(f.home_team).trim().toLowerCase()] || null;
      const at = f.away_acr ? teamMapByAcr[String(f.away_acr).toUpperCase()] : teamMapByName[String(f.away_team).trim().toLowerCase()] || null;
      return {
        id: f.id,
        league_id: competitionId,
        start_time: f.start_time,
        status: f.status || 'scheduled',
        round: f.round || null,
        home_team_id: f.home_team_id || null,
        away_team_id: f.away_team_id || null,
        home_team_name: f.home_team,
        away_team_name: f.away_team,
        home_team_logo: toPublicUrl(ht?.logo_path) || null,
        away_team_logo: toPublicUrl(at?.logo_path) || null,
        home_score: f.home_score,
        away_score: f.away_score,
      };
    });

    return NextResponse.json({ ok: true, source: 'pool_matches', matches, season: seasonYear });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}