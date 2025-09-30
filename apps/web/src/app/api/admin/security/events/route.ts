import { NextRequest, NextResponse } from "next/server";
import { getSecureSupabase } from "@/lib/security/secure-supabase";

export const runtime = "nodejs";

/**
 * API para buscar eventos de segurança (apenas para administradores)
 */
export async function GET(req: NextRequest) {
  const secureSupabase = getSecureSupabase();

  try {
    // Verificar autenticação
    const user = await secureSupabase.getAuthenticatedUser();

    // Verificar se é administrador
    const profileResult = await secureSupabase.secureSelect(
      "profiles",
      {
        select: "role",
        filter: { id: user.id }
      },
      req
    );

    if (!profileResult.data?.[0] || profileResult.data[0].role !== 'admin') {
      return NextResponse.json({ 
        ok: false, 
        error: "Acesso negado. Apenas administradores podem acessar." 
      }, { status: 403 });
    }

    // Parâmetros de consulta
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');

    // Construir filtros
    let filters: any = {};
    if (severity) filters.severity = severity;
    if (type) filters.type = type;

    // Buscar eventos de segurança
    const eventsResult = await secureSupabase.secureSelect(
      "security_logs",
      {
        select: "id, type, user_id, ip_address, user_agent, severity, details, created_at",
        filter: filters,
        options: {
          range: [offset, offset + limit - 1],
          order: { created_at: { ascending: false } }
        }
      },
      req
    );

    if (eventsResult.error) {
      console.error("Erro ao buscar eventos de segurança:", eventsResult.error);
      return NextResponse.json({ 
        ok: false, 
        error: "Erro interno do servidor" 
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      events: eventsResult.data || [],
      pagination: {
        limit,
        offset,
        total: eventsResult.data?.length || 0
      }
    });

  } catch (error) {
    console.error("Erro na API de eventos de segurança:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Erro interno do servidor" 
    }, { status: 500 });
  }
}