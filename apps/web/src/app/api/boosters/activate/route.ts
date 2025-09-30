import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_DEV) as string | undefined;
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, message: "Configuração do Supabase ausente" }, { status: 500 });
    }

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ ok: false, message: "Token de autorização necessário" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const sbUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await sbUser.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ ok: false, message: "Usuário não autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { boosterId, poolId } = body;

    if (!boosterId) {
      return NextResponse.json({ ok: false, message: "ID do booster é obrigatório" }, { status: 400 });
    }

    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const userId = user.id;

    // Verificar se o usuário tem o booster no inventário
    const { data: purchases } = await sbAdmin
      .from("booster_purchases")
      .select("amount")
      .eq("user_id", userId)
      .eq("booster", boosterId);

    const { data: usages } = await sbAdmin
      .from("booster_usages")
      .select("id")
      .eq("user_id", userId)
      .eq("booster", boosterId);

    const totalPurchased = (purchases || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalUsed = (usages || []).length;
    const available = totalPurchased - totalUsed;

    if (available <= 0) {
      return NextResponse.json({ ok: false, message: "Você não possui este booster no inventário" }, { status: 400 });
    }

    // Verificar se já existe uma ativação ativa para este booster
    const { data: existingActivation } = await sbAdmin
      .from("booster_activations")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("booster_id", boosterId)
      .eq("status", "active")
      .is("match_id", null) // Ativações globais
      .maybeSingle();

    // Buscar duração padrão do booster no catálogo
    const { data: boosterCatalog } = await sbAdmin
      .from("boosters")
      .select("default_duration_days")
      .eq("id", boosterId)
      .maybeSingle();

    const durationDays = boosterCatalog?.default_duration_days || 7;
    const now = new Date();
    let expiresAt: Date;

    if (existingActivation) {
      // Se já existe uma ativação, adicionar tempo à expiração existente
      const currentExpiry = new Date(existingActivation.expires_at);
      expiresAt = new Date(currentExpiry.getTime() + (durationDays * 24 * 60 * 60 * 1000));
      
      // Atualizar a ativação existente
      const { error: updateError } = await sbAdmin
        .from("booster_activations")
        .update({ expires_at: expiresAt.toISOString() })
        .eq("id", existingActivation.id);

      if (updateError) {
        return NextResponse.json({ ok: false, message: "Erro ao estender ativação" }, { status: 500 });
      }
    } else {
      // Criar nova ativação
      expiresAt = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));
      
      const { error: activationError } = await sbAdmin
        .from("booster_activations")
        .insert({
          user_id: userId,
          pool_id: poolId || null,
          booster_id: boosterId,
          scope: "global",
          expires_at: expiresAt.toISOString(),
          status: "active"
        });

      if (activationError) {
        return NextResponse.json({ ok: false, message: "Erro ao criar ativação" }, { status: 500 });
      }
    }

    // Registrar o uso do booster
    const { error: usageError } = await sbAdmin
      .from("booster_usages")
      .insert({
        pool_id: poolId || null,
        user_id: userId,
        booster: boosterId,
        status: "active",
        expires_at: expiresAt.toISOString()
      });

    if (usageError) {
      return NextResponse.json({ ok: false, message: "Erro ao registrar uso do booster" }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Booster ativado com sucesso",
      expires_at: expiresAt.toISOString(),
      duration_days: durationDays
    });

  } catch (error: any) {
    console.error("Erro na ativação do booster:", error);
    return NextResponse.json({ ok: false, message: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    message: "Use POST para ativar um booster temporal",
    required_fields: ["boosterId"],
    optional_fields: ["poolId"]
  });
}