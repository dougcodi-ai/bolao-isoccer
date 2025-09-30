import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Dev-only seeder: cria ~N usuários fake, adiciona no bolão (por código),
// gera palpites para jogos passados/futuros e atualiza pontos.
// Requer SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL configurados.
// Uso:
//   POST /api/dev/seed-pool { poolCode: string, count?: number, predictPast?: boolean, predictFuture?: boolean }

export const dynamic = "force-dynamic";

function outcome(h: number, a: number): number {
  if (h > a) return 1;
  if (h < a) return -1;
  return 0;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeDisplayName(i: number): string {
  const animals = [
    "Lobo", "Tigre", "Falcao", "Raposa", "Leao", "Pantera", "Gavião", "Onça",
    "Águia", "Tubarão", "Urso", "Cobra", "Garça", "Jacaré", "Carcará",
  ];
  const adjs = [
    "Veloz", "Astuto", "Brabo", "Sereno", "Cabuloso", "Letal", "Sagaz", "Implacável",
    "Craque", "Invocado", "Monstro", "Maluco", "Frio", "Seguro", "Atrevido",
  ];
  const name = `${adjs[i % adjs.length]} ${animals[i % animals.length]}`;
  return name;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev-only endpoint" }, { status: 403 });
  }

  const { poolCode, count = 10, predictPast = true, predictFuture = true, includeExistingMembers = false } = await req.json().catch(() => ({}));
  if (!poolCode || typeof poolCode !== "string") {
    return NextResponse.json({ error: "Informe poolCode no body (string)" }, { status: 400 });
  }
  const qty = Math.max(1, Math.min(50, Number(count) || 10));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Ambiente Supabase ausente (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // Resolve pool by code
    const { data: pool, error: poolErr } = await sb
      .from("pools")
      .select("id, name")
      .eq("code", poolCode)
      .maybeSingle();
    if (poolErr || !pool) {
      return NextResponse.json({ error: poolErr?.message || "Bolão não encontrado" }, { status: 404 });
    }
    const poolId: string = pool.id as string;

    // Fetch matches for this pool
    const nowIso = new Date().toISOString();
    const { data: matchesAll, error: mErr } = await sb
      .from("matches")
      .select("id, home_team, away_team, start_time, home_score, away_score")
      .eq("pool_id", poolId)
      .order("start_time", { ascending: true });
    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 400 });
    }
    const pastMatches = (matchesAll || []).filter((m) => m.home_score != null && m.away_score != null && new Date(m.start_time).toISOString() < nowIso);
    const futureMatches = (matchesAll || []).filter((m) => new Date(m.start_time).toISOString() >= nowIso);

    const created: Array<{ id: string; email: string; display_name: string; points: number }> = [];
    const summary = {
      pool: { id: poolId, code: poolCode, name: pool.name },
      requestedUsers: qty,
      createdUsers: 0,
      pastMatches: pastMatches.length,
      futureMatches: futureMatches.length,
      totalMatches: matchesAll?.length || 0,
    };

    for (let i = 0; i < qty; i++) {
      // Create auth user (confirmed)
      const displayName = makeDisplayName(i);
      const email = `seed_${poolCode.toLowerCase()}_${Date.now()}_${i}@example.com`;
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

      const { data: newUser, error: userErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (userErr || !newUser?.user?.id) {
        // Skip on error but continue others
        continue;
      }
      const userId = newUser.user.id;

      // Insert profile (bypass RLS via service role)
      await sb.from("profiles").upsert({ id: userId, display_name: displayName });

      // Join pool as member
      await sb.from("pool_members").upsert({ pool_id: poolId, user_id: userId, role: "member" }, { onConflict: "pool_id,user_id" });

      // Create predictions
      let pointsSum = 0;

      if (predictPast && pastMatches.length > 0) {
        for (const m of pastMatches) {
          const realH = Number(m.home_score);
          const realA = Number(m.away_score);
          const realOut = outcome(realH, realA);

          // Decide strategy: exact (30%), tendency (40%), wrong (30%)
          const r = Math.random();
          let home_pred = 0;
          let away_pred = 0;

          if (r < 0.3) {
            // exact
            home_pred = realH;
            away_pred = realA;
          } else if (r < 0.7) {
            // same outcome but not exact
            if (realOut === 1) {
              // home win
              const diff = Math.max(1, realH - realA);
              const adj = randInt(0, 2);
              home_pred = realA + diff + adj; // ensure > away
              away_pred = realA + randInt(0, Math.max(0, diff + adj - 1));
              if (home_pred === realH && away_pred === realA) home_pred += 1; // avoid exact
            } else if (realOut === -1) {
              // away win
              const diff = Math.max(1, realA - realH);
              const adj = randInt(0, 2);
              away_pred = realH + diff + adj; // ensure > home
              home_pred = realH + randInt(0, Math.max(0, diff + adj - 1));
              if (home_pred === realH && away_pred === realA) away_pred += 1;
            } else {
              // draw
              const base = randInt(0, Math.max(0, Math.max(realH, realA) + 1));
              home_pred = base;
              away_pred = base;
              if (home_pred === realH && away_pred === realA) home_pred += 1; // avoid exact
            }
          } else {
            // wrong outcome
            if (realOut === 1) {
              // predict away win or draw
              if (Math.random() < 0.5) {
                away_pred = realH + randInt(1, 3);
                home_pred = Math.max(0, realH - randInt(0, 1));
              } else {
                const base = randInt(0, Math.max(0, Math.max(realH, realA)));
                home_pred = base;
                away_pred = base;
              }
            } else if (realOut === -1) {
              // predict home win or draw
              if (Math.random() < 0.5) {
                home_pred = realA + randInt(1, 3);
                away_pred = Math.max(0, realA - randInt(0, 1));
              } else {
                const base = randInt(0, Math.max(0, Math.max(realH, realA)));
                home_pred = base;
                away_pred = base;
              }
            } else {
              // real draw -> predict some win
              if (Math.random() < 0.5) {
                home_pred = randInt(1, 3);
                away_pred = 0;
              } else {
                home_pred = 0;
                away_pred = randInt(1, 3);
              }
            }
            // Ensure wrong is not accidentally exact
            if (home_pred === realH && away_pred === realA) {
              home_pred += 1;
            }
          }

          await sb.from("predictions").upsert(
            { user_id: userId, match_id: m.id, home_pred, away_pred },
            { onConflict: "user_id,match_id" }
          );

          // Points calc
          const exact = home_pred === realH && away_pred === realA;
          const tend = !exact && outcome(home_pred, away_pred) === realOut;
          pointsSum += exact ? 10 : tend ? 5 : 0;
        }
      }

      if (predictFuture && futureMatches.length > 0) {
        for (const m of futureMatches) {
          const home_pred = randInt(0, 3);
          const away_pred = randInt(0, 3);
          await sb.from("predictions").upsert(
            { user_id: userId, match_id: m.id, home_pred, away_pred },
            { onConflict: "user_id,match_id" }
          );
        }
      }

      // Upsert points
      await sb.from("points").upsert({ pool_id: poolId, user_id: userId, points: pointsSum }, { onConflict: "pool_id,user_id" });

      created.push({ id: userId, email, display_name: displayName, points: pointsSum });
    }

    summary.createdUsers = created.length;

    // Opcional: também processar membros existentes do bolão (inclui recém-criados)
    if (includeExistingMembers) {
      const { data: members, error: memErr } = await sb
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", poolId);
      if (memErr) {
        return NextResponse.json({ error: memErr.message }, { status: 400 });
      }

      for (const mem of members || []) {
        const userId: string = mem.user_id;
        let pointsSum = 0;

        // PAST: gerar/atualizar palpites e somar pontos
        if (predictPast && pastMatches.length > 0) {
          for (const m of pastMatches) {
            const realH = Number(m.home_score);
            const realA = Number(m.away_score);
            const realOut = outcome(realH, realA);

            // Estratégia semelhante à usada para novos usuários
            const r = Math.random();
            let home_pred = 0;
            let away_pred = 0;

            if (r < 0.3) {
              // exato
              home_pred = realH;
              away_pred = realA;
            } else if (r < 0.7) {
              // mesma tendência
              if (realOut === 1) {
                const diff = Math.max(1, realH - realA);
                const adj = randInt(0, 2);
                home_pred = realA + diff + adj; // garantir >
                away_pred = realA + randInt(0, Math.max(0, diff + adj - 1));
                if (home_pred === realH && away_pred === realA) home_pred += 1;
              } else if (realOut === -1) {
                const diff = Math.max(1, realA - realH);
                const adj = randInt(0, 2);
                away_pred = realH + diff + adj; // garantir >
                home_pred = realH + randInt(0, Math.max(0, diff + adj - 1));
                if (home_pred === realH && away_pred === realA) away_pred += 1;
              } else {
                const base = randInt(0, Math.max(0, Math.max(realH, realA) + 1));
                home_pred = base;
                away_pred = base;
                if (home_pred === realH && away_pred === realA) home_pred += 1;
              }
            } else {
              // tendência errada
              if (realOut === 1) {
                if (Math.random() < 0.5) {
                  away_pred = realH + randInt(1, 3);
                  home_pred = Math.max(0, realH - randInt(0, 1));
                } else {
                  const base = randInt(0, Math.max(0, Math.max(realH, realA)));
                  home_pred = base;
                  away_pred = base;
                }
              } else if (realOut === -1) {
                if (Math.random() < 0.5) {
                  home_pred = realA + randInt(1, 3);
                  away_pred = Math.max(0, realA - randInt(0, 1));
                } else {
                  const base = randInt(0, Math.max(0, Math.max(realH, realA)));
                  home_pred = base;
                  away_pred = base;
                }
              } else {
                if (Math.random() < 0.5) {
                  home_pred = randInt(1, 3);
                  away_pred = 0;
                } else {
                  home_pred = 0;
                  away_pred = randInt(1, 3);
                }
              }
              if (home_pred === realH && away_pred === realA) {
                home_pred += 1;
              }
            }

            await sb.from("predictions").upsert(
              { user_id: userId, match_id: m.id, home_pred, away_pred },
              { onConflict: "user_id,match_id" }
            );

            const exact = home_pred === realH && away_pred === realA;
            const tend = !exact && outcome(home_pred, away_pred) === realOut;
            pointsSum += exact ? 10 : tend ? 5 : 0;
          }
        }

        // FUTURE: gerar/atualizar palpites
        if (predictFuture && futureMatches.length > 0) {
          for (const m of futureMatches) {
            const home_pred = randInt(0, 3);
            const away_pred = randInt(0, 3);
            await sb.from("predictions").upsert(
              { user_id: userId, match_id: m.id, home_pred, away_pred },
              { onConflict: "user_id,match_id" }
            );
          }
        }

        await sb.from("points").upsert(
          { pool_id: poolId, user_id: userId, points: pointsSum },
          { onConflict: "pool_id,user_id" }
        );
      }
    }

    return NextResponse.json({ ok: true, summary, users: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}