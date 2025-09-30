import { NextRequest, NextResponse } from "next/server";
import { getSecureSupabase } from "@/lib/security/secure-supabase";

export const runtime = "nodejs";

/**
 * API para buscar logs de auditoria do banco de dados (apenas para administradores)
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
    const operation = searchParams.get('operation');
    const table_name = searchParams.get('table');

    // Construir filtros
    let filters: any = {};
    if (operation) filters.operation = operation;
    if (table_name) filters.table_name = table_name;

    // Buscar logs de auditoria
    const auditResult = await secureSupabase.secureSelect(
      "database_audit_logs",
      {
        select: "id, user_id, operation, table_name, ip_address, user_agent, created_at",
        filter: filters,
        options: {
          range: [offset, offset + limit - 1],
          order: { created_at: { ascending: false } }
        }
      },
      req
    );

    if (auditResult.error) {
      console.error("Erro ao buscar logs de auditoria:", auditResult.error);
      return NextResponse.json({ 
        ok: false, 
        error: "Erro interno do servidor" 
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      logs: auditResult.data || [],
      pagination: {
        limit,
        offset,
        total: auditResult.data?.length || 0
      }
    });

  } catch (error) {
    console.error("Erro na API de logs de auditoria:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Erro interno do servidor" 
    }, { status: 500 });
  }
}