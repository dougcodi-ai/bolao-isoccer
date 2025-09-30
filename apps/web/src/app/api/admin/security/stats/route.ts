import { NextRequest, NextResponse } from "next/server";
import { getSecureSupabase } from "@/lib/security/secure-supabase";

export const runtime = "nodejs";

/**
 * API para buscar estatísticas de segurança (apenas para administradores)
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

    // Buscar estatísticas usando função do banco
    const { data: statsData, error: statsError } = await secureSupabase.client
      .rpc('get_security_stats');

    if (statsError) {
      console.error("Erro ao buscar estatísticas:", statsError);
      
      // Fallback: calcular estatísticas manualmente
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Total de eventos
      const totalEventsResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "id",
          filter: {}
        },
        req
      );

      // Eventos das últimas 24h
      const recentEventsResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "id",
          filter: {
            created_at: { gte: yesterday.toISOString() }
          }
        },
        req
      );

      // IPs suspeitos
      const suspiciousIpsResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "ip_address",
          filter: {
            type: 'suspicious_activity'
          }
        },
        req
      );

      // Falhas de login
      const failedLoginsResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "id",
          filter: {
            type: 'authentication_failed'
          }
        },
        req
      );

      // SQL Injection
      const sqlInjectionResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "id",
          filter: {
            type: 'sql_injection_attempt'
          }
        },
        req
      );

      // XSS
      const xssResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "id",
          filter: {
            type: 'xss_attempt'
          }
        },
        req
      );

      // Rate limit
      const rateLimitResult = await secureSupabase.secureSelect(
        "security_logs",
        {
          select: "id",
          filter: {
            type: 'rate_limit_exceeded'
          }
        },
        req
      );

      const uniqueIps = new Set(
        suspiciousIpsResult.data?.map(log => log.ip_address) || []
      );

      const stats = {
        total_events: totalEventsResult.data?.length || 0,
        events_last_24h: recentEventsResult.data?.length || 0,
        suspicious_ips: uniqueIps.size,
        failed_logins: failedLoginsResult.data?.length || 0,
        sql_injection_attempts: sqlInjectionResult.data?.length || 0,
        xss_attempts: xssResult.data?.length || 0,
        rate_limit_violations: rateLimitResult.data?.length || 0
      };

      return NextResponse.json({
        ok: true,
        stats
      });
    }

    return NextResponse.json({
      ok: true,
      stats: statsData || {}
    });

  } catch (error) {
    console.error("Erro na API de estatísticas de segurança:", error);
    return NextResponse.json({ 
      ok: false, 
      error: "Erro interno do servidor" 
    }, { status: 500 });
  }
}