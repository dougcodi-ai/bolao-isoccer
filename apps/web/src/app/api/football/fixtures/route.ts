import { NextRequest, NextResponse } from 'next/server';
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

function mapChampionshipToCompetitionCode(championship?: string | null): string {
  const n = normalizeText(championship || '');
  if (n.includes('serie a') || n.includes('brasileirao')) return 'BRA-1';
  if (n.includes('serie b') || n.includes('bezona')) return 'BRA-2';
  if (n.includes('copa do brasil') || n.includes('copa brasil')) return 'BRA-CUP';
  if (n.includes('libertadores')) return 'LIBERTADORES';
  if (n.includes('sul-americana') || n.includes('sulamericana')) return 'SULAMERICANA';
  return 'BRA-1';
}

async function getSeasonId(sb: any, competitionCode: string): Promise<{ competitionId: string; seasonId: string; seasonYear: number }> {
  const { data: compRow, error: compErr } = await sb
    .from('football_competitions')
    .select('id')
    .eq('code', competitionCode)
    .maybeSingle();
  if (compErr) throw new Error(compErr.message);
  if (!compRow) throw new Error(`Competição ${competitionCode} não encontrada`);
  const competitionId = compRow.id as string;

  const currentYear = new Date().getFullYear();
  let { data: seasonRow, error: seasonErr } = await sb
    .from('football_seasons')
    .select('id, year')
    .eq('competition_id', competitionId)
    .eq('year', currentYear)
    .maybeSingle();
  if (seasonErr) throw new Error(seasonErr.message);

  if (!seasonRow) {
    const { data: seasons, error: seasonsErr } = await sb
      .from('football_seasons')
      .select('id, year')
      .eq('competition_id', competitionId)
      .order('year', { ascending: false })
      .limit(1);
    if (seasonsErr) throw new Error(seasonsErr.message);
    const s = (seasons || [])[0];
    if (!s) throw new Error(`Temporada não encontrada para ${competitionCode}`);
    seasonRow = s;
  }

  return { competitionId, seasonId: seasonRow.id as string, seasonYear: seasonRow.year as number };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const direction = (searchParams.get('direction') || 'future').toLowerCase(); // 'past' | 'future'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;
    const championships = searchParams.getAll('championship'); // nomes dos campeonatos
    const codesInQuery = searchParams.getAll('code'); // códigos opcionais

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return NextResponse.json({ ok: false, error: 'Supabase env not configured' }, { status: 500 });
    }
    const sb = createClient(supabaseUrl, (serviceKey || anonKey) as string);

    // Resolver códigos alvo (5 campeonatos padrão)
    const defaultCodes = ['BRA-1', 'BRA-2', 'BRA-CUP', 'LIBERTADORES', 'SULAMERICANA'];
    const targetCodes = codesInQuery.length > 0
      ? codesInQuery
      : (championships.length > 0 ? championships.map((c) => mapChampionshipToCompetitionCode(c)) : defaultCodes);

    const nowIso = new Date().toISOString();
    const out: Record<string, any> = {};

    for (const code of targetCodes) {
      try {
        const { competitionId, seasonId } = await getSeasonId(sb, code);
        let q = sb
          .from('football_matches')
          .select('id, start_time, status, round, matchday, home_team_id, away_team_id, home_score, away_score')
          .eq('competition_id', competitionId)
          .eq('season_id', seasonId);

        // Direção: passados vs futuros
        if (direction === 'past') {
          q = q.lt('start_time', nowIso).order('start_time', { ascending: false });
        } else {
          q = q.gte('start_time', nowIso).order('start_time', { ascending: true });
        }

        const { data: matchesData, error: mErr } = await q.range(offset, offset + limit - 1);
        if (mErr) throw new Error(mErr.message);
        const matches = matchesData || [];

        // Carregar logos dos times
        const teamIds = Array.from(new Set(matches.flatMap((m: any) => [m.home_team_id, m.away_team_id]).filter(Boolean)));
        let teamMap: Record<string, { name: string; acronym: string | null; logo_path: string | null }> = {};
        if (teamIds.length > 0) {
          const { data: teams, error: tErr } = await sb
            .from('football_teams')
            .select('id, name, acronym, logo_path')
            .in('id', teamIds);
          if (tErr) throw new Error(tErr.message);
          teamMap = Object.fromEntries((teams || []).map((t: any) => [t.id, { name: t.name, acronym: t.acronym || null, logo_path: t.logo_path || null }]));
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

        out[code] = {
          code,
          matches: matches.map((m: any) => {
            const ht = teamMap[m.home_team_id] || null;
            const at = teamMap[m.away_team_id] || null;
            return {
              id: m.id,
              start_time: m.start_time,
              status: m.status,
              round: m.round || null,
              matchday: m.matchday || null,
              home_team_id: m.home_team_id,
              away_team_id: m.away_team_id,
              home_team_name: ht?.name || null,
              away_team_name: at?.name || null,
              home_team_logo: toPublicUrl(ht?.logo_path) || null,
              away_team_logo: toPublicUrl(at?.logo_path) || null,
              home_score: m.home_score,
              away_score: m.away_score,
            };
          }),
          page: { limit, offset, direction },
        };
      } catch (e: any) {
        out[code] = { code, error: e?.message || 'Erro ao carregar partidas', matches: [], page: { limit, offset, direction } };
      }
    }

    return NextResponse.json({ ok: true, data: out });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}