import { NextRequest, NextResponse } from "next/server";
import { getSecureSupabase } from "@/lib/security/secure-supabase";

export const runtime = "nodejs";

/**
 * API para exportar relatórios de segurança em CSV (apenas para administradores)
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
    const type = searchParams.get('type') || 'security'; // 'security' ou 'audit'
    const days = parseInt(searchParams.get('days') || '30'); // Últimos N dias

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let csvContent = '';
    let filename = '';

    if (type === 'security') {
      // Exportar eventos de segurança
      const eventsResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "type, user_id, ip_address, user_agent, severity, details, created_at",
          filter: {
            created_at: { gte: startDate.toISOString() }
          },
          options: {
            order: { created_at: { ascending: false } }
          }
        },
        req
      );

      if (eventsResult.error) {
        throw new Error("Erro ao buscar eventos de segurança");
      }

      // Cabeçalho CSV
      csvContent = 'Tipo,Usuario ID,IP,User Agent,Severidade,Detalhes,Data/Hora\n';
      
      // Dados
      eventsResult.data?.forEach(event => {
        const details = event.details ? JSON.stringify(event.details).replace(/"/g, '""') : '';
        const userAgent = (event.user_agent || '').replace(/"/g, '""');
        
        csvContent += `"${event.type}","${event.user_id || ''}","${event.ip_address}","${userAgent}","${event.severity}","${details}","${new Date(event.created_at).toLocaleString('pt-BR')}"\n`;
      });

      filename = `security-events-${days}days-${new Date().toISOString().split('T')[0]}.csv`;

    } else if (type === 'audit') {
      // Exportar logs de auditoria
      const auditResult = await secureSupabase.secureSelect(
        "database_audit_logs",
        {
          select: "user_id, operation, table_name, ip_address, user_agent, filters, data, created_at",
          filter: {
            created_at: { gte: startDate.toISOString() }
          },
          options: {
            order: { created_at: { ascending: false } }
          }
        },
        req
      );

      if (auditResult.error) {
        throw new Error("Erro ao buscar logs de auditoria");
      }

      // Cabeçalho CSV
      csvContent = 'Usuario ID,Operacao,Tabela,IP,User Agent,Filtros,Dados,Data/Hora\n';
      
      // Dados
      auditResult.data?.forEach(log => {
        const filters = log.filters ? JSON.stringify(log.filters).replace(/"/g, '""') : '';
        const data = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : '';
        const userAgent = (log.user_agent || '').replace(/"/g, '""');
        
        csvContent += `"${log.user_id}","${log.operation}","${log.table_name}","${log.ip_address}","${userAgent}","${filters}","${data}","${new Date(log.created_at).toLocaleString('pt-BR')}"\n`;
      });

      filename = `audit-logs-${days}days-${new Date().toISOString().split('T')[0]}.csv`;

    } else {
      return NextResponse.json({ 
        ok: false, 
        error: "Tipo de relatório inválido. Use 'security' ou 'audit'." 
      }, { status: 400 });
    }

    // Retornar CSV
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error("Erro na API de exportação:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Erro interno do servidor" 
    }, { status: 500 });
  }
}