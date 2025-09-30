import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFootballProvider } from "@/lib/football";
import { getMockDataForCompetition } from "@/lib/football/mock-data-selector";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        ok: false,
        error: "Missing Supabase envs",
        hint: "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em apps/web/.env.local",
      }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const [comp, seasons, teams, matches, bucket] = await Promise.all([
      sb.from("football_competitions").select("id, code, name", { count: "exact" }).limit(5),
      sb.from("football_seasons").select("id, year, competition_id", { count: "exact" }).limit(5),
      sb.from("football_teams").select("id, name, acronym, logo_path, ext_provider, ext_id", { count: "exact" }).limit(10),
      sb.from("football_matches").select("id, season_id, matchday, status", { count: "exact" }).limit(10),
      sb.storage.getBucket("team-logos"),
    ]);

    // Aggregate example: matches per matchday (for first season found)
    let matchesPerMatchday: Record<string, number> | null = null;
    if (seasons.data && seasons.data[0]) {
      const seasonId = seasons.data[0].id as string;
      const { data: mmData } = await sb
        .from("football_matches")
        .select("matchday")
        .eq("season_id", seasonId);
      matchesPerMatchday = (mmData || []).reduce((acc: Record<string, number>, r: any) => {
        const k = String(r.matchday ?? "-");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
    }

    // --- New: Provider teams validation for BRA-1 ---
    const providerKey = "mock";
    const defaultCompetition = "BRA-1";
    const defaultSeason = String(new Date().getFullYear());

    const provider = getFootballProvider();
    let providerTeams: any[] = [];
    try {
      providerTeams = await provider.getTeams({ competitionId: defaultCompetition, seasonId: defaultSeason });
    } catch {
      providerTeams = [];
    }

    const teamCount = providerTeams.length;
    const ids = providerTeams.map((t) => String(t.id));
    const uniqueIds = new Set(ids);
    const duplicatedIds = ids.filter((id, idx) => ids.indexOf(id) !== idx);

    const mockData = getMockDataForCompetition(defaultCompetition);
    const mockNames = new Set(mockData.teams.map((t) => String(t.name).toLowerCase()));
    const providerNames = new Set(providerTeams.map((t: any) => String(t.name).toLowerCase()));
    const onlyInProvider: string[] = Array.from(providerNames).filter((n) => !mockNames.has(n));
    const onlyInMock: string[] = Array.from(mockNames).filter((n) => !providerNames.has(n));

    const validation = {
      provider: providerKey,
      competition: defaultCompetition,
      season: defaultSeason,
      count: teamCount,
      expectedCount: 20,
      countOk: teamCount === 20,
      uniqueIds: uniqueIds.size === ids.length,
      duplicatedIds: Array.from(new Set(duplicatedIds)),
      onlyInProvider,
      onlyInMock,
      sample: providerTeams.slice(0, 5),
    };

    // --- New: Patch verification (boosters, activations, usages, matches.status) ---
    const trySelect = async <T>(p: any) => {
      try {
        const r = await p; // aceita PostgrestFilterBuilder ou Promise-like
        return { ok: !r.error, data: (r.data || []) as T[], count: r.count ?? null, error: r.error ? String(r.error?.message || r.error) : null };
      } catch (e: any) {
        return { ok: false, data: [] as T[], count: null, error: e?.message || String(e) };
      }
    };

    const boostersCheck = await trySelect(sb.from("boosters").select("id, name, kind", { count: "exact" }).limit(10));
    const activationsCheck = await trySelect(sb.from("booster_activations").select("id, booster_id, scope, status", { count: "exact" }).limit(5));
    const usagesCheck = await trySelect(sb.from("booster_usages").select("id, booster, status", { count: "exact" }).limit(5));
    const matchesStatusCheck = await trySelect(sb.from("matches").select("id, status", { count: "exact" }).limit(3));

    const patch_ok = Boolean((boostersCheck.count ?? 0) >= 1) && boostersCheck.ok && matchesStatusCheck.ok;

    return NextResponse.json({
      ok: true,
      tables: {
        competitions: { count: comp.count ?? null, sample: comp.data ?? [] },
        seasons: { count: seasons.count ?? null, sample: seasons.data ?? [] },
        teams: { count: teams.count ?? null, sample: teams.data ?? [] },
        matches: { count: matches.count ?? null, sample: matches.data ?? [] },
        boosters: { count: boostersCheck.count, sample: boostersCheck.data, error: boostersCheck.error },
        booster_activations: { count: activationsCheck.count, sample: activationsCheck.data, error: activationsCheck.error },
        booster_usages: { count: usagesCheck.count, sample: usagesCheck.data, error: usagesCheck.error },
        matches_status_column: { has: matchesStatusCheck.ok, error: matchesStatusCheck.error, sample: matchesStatusCheck.data },
      },
      storage: {
        bucket_exists: !!bucket.data,
        bucket: bucket.data ?? null,
      },
      analytics: {
        matches_per_matchday: matchesPerMatchday,
      },
      patch: {
        ok: patch_ok,
        details: {
          boosters_table_ok: boostersCheck.ok,
          booster_activations_table_ok: activationsCheck.ok,
          booster_usages_table_ok: usagesCheck.ok,
          matches_status_column_ok: matchesStatusCheck.ok,
        }
      },
      validation,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}