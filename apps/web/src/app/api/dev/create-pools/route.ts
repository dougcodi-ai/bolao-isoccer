import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function genCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I/O/1/0
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function generateUniqueCode(sb: any, maxTries = 8): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const code = genCode(6);
    const { data, error } = await sb.from("pools").select("id").eq("code", code).maybeSingle();
    if (!error && !data) return code;
  }
  // fallback: timestamp base36
  return `IS-${Date.now().toString(36).toUpperCase()}`;
}

async function findUserIdByEmail(sb: any, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  // Supabase Admin listUsers não possui filtro direto por email, iteramos páginas
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage } as any);
    if (error) break;
    const users: any[] = (data as any)?.users || (data as any) || [];
    const hit = users.find((u: any) => String(u?.email || "").toLowerCase() === target);
    if (hit?.id) return String(hit.id);
    if (!users.length || users.length < perPage) break; // última página
  }
  return null;
}

async function ensurePool(sb: any, spec: { name: string; championship: string; ownerId: string }): Promise<{ id: string; code: string; name: string }> {
  // Primeiro tenta achar por nome
  const { data: byName } = await sb
    .from("pools")
    .select("id, code, name, championship, owner_id")
    .eq("name", spec.name)
    .maybeSingle();
  if (byName?.id) {
    // Se já existe, garantir que o campeonato esteja configurado corretamente
    try {
      const needUpdate = !byName.championship || byName.championship !== spec.championship;
      if (needUpdate) {
        const { error: updErr } = await sb
          .from("pools")
          .update({ championship: spec.championship })
          .eq("id", byName.id);
        // Em ambientes sem coluna championship, ignorar
        if (updErr && /column .*championship.* does not exist/i.test(updErr.message)) {
          // noop
        }
      }
    } catch {}
    // Retorna registro existente (após tentar corrigir championship)
    return { id: String(byName.id), code: String(byName.code), name: String(byName.name) };
  }

  // Cria novo com código único
  const code = await generateUniqueCode(sb);
  const insertPayload: any = {
    name: spec.name,
    owner_id: spec.ownerId,
    code,
    championship: spec.championship,
    payment_status: "paid",
    plan_key: "free",
  };

  // Inserção com tolerância a colunas ausentes, preservando championship sempre que possível
  const first = await sb
    .from("pools")
    .insert(insertPayload)
    .select("id, code")
    .single();

  if (first.error) {
    const knownCols = ["championship", "payment_status", "plan_key", "price_cents", "stripe_session_id", "premium", "max_members"];
    let payload = { ...insertPayload } as any;
    let attempts = 0;
    let insertedRes: any = null;
    let lastMsg: string | null = first.error.message || null;

    while (!insertedRes && attempts < 6) {
      const msg = (lastMsg || "").toLowerCase();
      // Remover apenas colunas citadas no erro
      const toCheck = ["payment_status", "plan_key", "price_cents", "stripe_session_id", "premium", "max_members", "championship"]; // manter championship por último
      let removed = false;
      for (const col of toCheck) {
        if (msg.includes(col.toLowerCase()) && col in payload) {
          delete payload[col];
          removed = true;
        }
      }
      // Primeira tentativa: remover campos de pagamento/plan caso o erro seja genérico
      if (!removed && attempts === 0) {
        for (const col of ["payment_status", "plan_key", "price_cents", "stripe_session_id", "premium", "max_members"]) {
          if (col in payload) { delete payload[col]; removed = true; }
        }
      }
      // Último recurso: remover championship somente após outras tentativas
      if (!removed && attempts >= 4 && ("championship" in payload)) {
        delete payload["championship"];
        removed = true;
      }

      const retry = await sb
        .from("pools")
        .insert(payload)
        .select("id, code")
        .single();
      if (retry.error) {
        attempts++;
        lastMsg = retry.error.message || lastMsg;
      } else {
        insertedRes = retry.data;
      }
    }

    if (!insertedRes) {
      throw new Error(lastMsg || "Falha ao criar bolão");
    }
    return { id: String(insertedRes.id), code: String(insertedRes.code), name: spec.name };
  } else {
    return { id: String(first.data.id), code: String(first.data.code), name: spec.name };
  }
}

async function ensureMembershipOwner(sb: any, poolId: string, userId: string): Promise<void> {
  await sb.from("pool_members").upsert({ pool_id: poolId, user_id: userId, role: "owner" }, { onConflict: "pool_id,user_id" });
}

async function ensureMatches(urlOrigin: string, poolId: string, season: number = new Date().getFullYear()): Promise<any> {
  try {
    const res = await fetch(`${urlOrigin}/api/pools/${poolId}/ensure-matches?season=${season}&reset=1`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, result: json };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function POST(req: NextRequest) {
  // Dev-only por segurança
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev-only endpoint" }, { status: 403 });
  }

  const url = new URL(req.url);
  const { email = "dougcodi@gmail.com", season = String(new Date().getFullYear()) } = await req.json().catch(() => ({ email: url.searchParams.get("email") || "dougcodi@gmail.com", season: url.searchParams.get("season") || String(new Date().getFullYear()) }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Ambiente Supabase ausente (NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // 1) Resolve usuário por email
  const userId = await findUserIdByEmail(sb, email);
  if (!userId) {
    return NextResponse.json({ error: `Usuário com email ${email} não encontrado. Crie o usuário e tente novamente.` }, { status: 404 });
  }

  // 2) Especificações dos bolões
  const specs = [
    { name: "AAA", championship: "Brasileirão Série A", ownerId: userId },
    { name: "BBB", championship: "Brasileirão Série B", ownerId: userId },
    { name: "CCC", championship: "Copa do Brasil", ownerId: userId },
  ];

  const created: Array<{ id: string; code: string; name: string; ensuredMatches?: any }> = [];

  // 3) Cria/garante cada bolão e vincula ao usuário
  for (const spec of specs) {
    const pool = await ensurePool(sb, spec);
    await ensureMembershipOwner(sb, pool.id, userId);

    // 4) Garante calendário de partidas baseado no championship do bolão
    const seasonNum = Number(season);
    const ensured = await ensureMatches(url.origin, pool.id, seasonNum);

    created.push({ ...pool, ensuredMatches: ensured });
  }

  return NextResponse.json({ ok: true, ownerEmail: email, season, pools: created });
}