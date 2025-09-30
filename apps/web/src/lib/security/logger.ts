import { createClient } from '@supabase/supabase-js'

// Tipos de eventos de segurança
export type SecurityEventType = 
  | 'auth_failed'
  | 'auth_success'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'unauthorized_access'
  | 'data_access'
  | 'admin_action'
  | 'payment_fraud'
  | 'account_lockout'

export interface SecurityEvent {
  id?: string
  event_type: SecurityEventType
  user_id?: string
  ip_address: string
  user_agent: string
  details: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  resolved: boolean
}

class SecurityLogger {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Log de evento de segurança
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>) {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        timestamp: new Date().toISOString(),
        resolved: false
      }

      // Log no console para desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.warn('🔒 Security Event:', securityEvent)
      }

      // Salvar no banco de dados
      const { error } = await this.supabase
        .from('security_logs')
        .insert(securityEvent)

      if (error) {
        console.error('Failed to log security event:', error)
      }

      // Alertas críticos
      if (event.severity === 'critical') {
        await this.sendCriticalAlert(securityEvent)
      }

    } catch (error) {
      console.error('Security logging error:', error)
    }
  }

  // Tentativa de login falhada
  async logFailedLogin(ip: string, userAgent: string, email?: string, reason?: string) {
    await this.logSecurityEvent({
      event_type: 'auth_failed',
      ip_address: ip,
      user_agent: userAgent,
      details: { email, reason },
      severity: 'medium'
    })
  }

  // Login bem-sucedido
  async logSuccessfulLogin(userId: string, ip: string, userAgent: string) {
    await this.logSecurityEvent({
      event_type: 'auth_success',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: {},
      severity: 'low'
    })
  }

  // Rate limit excedido
  async logRateLimitExceeded(ip: string, userAgent: string, endpoint: string) {
    await this.logSecurityEvent({
      event_type: 'rate_limit_exceeded',
      ip_address: ip,
      user_agent: userAgent,
      details: { endpoint },
      severity: 'medium'
    })
  }

  // Tentativa de SQL injection
  async logSqlInjectionAttempt(ip: string, userAgent: string, input: string, endpoint: string) {
    await this.logSecurityEvent({
      event_type: 'sql_injection_attempt',
      ip_address: ip,
      user_agent: userAgent,
      details: { input: input.substring(0, 500), endpoint },
      severity: 'high'
    })
  }

  // Tentativa de XSS
  async logXssAttempt(ip: string, userAgent: string, input: string, endpoint: string) {
    await this.logSecurityEvent({
      event_type: 'xss_attempt',
      ip_address: ip,
      user_agent: userAgent,
      details: { input: input.substring(0, 500), endpoint },
      severity: 'high'
    })
  }

  // Acesso não autorizado
  async logUnauthorizedAccess(ip: string, userAgent: string, endpoint: string, userId?: string) {
    await this.logSecurityEvent({
      event_type: 'unauthorized_access',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: { endpoint },
      severity: 'high'
    })
  }

  // Acesso a dados sensíveis
  async logDataAccess(userId: string, ip: string, userAgent: string, resource: string, action: string) {
    await this.logSecurityEvent({
      event_type: 'data_access',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: { resource, action },
      severity: 'low'
    })
  }

  // Ação administrativa
  async logAdminAction(userId: string, ip: string, userAgent: string, action: string, target?: string) {
    await this.logSecurityEvent({
      event_type: 'admin_action',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: { action, target },
      severity: 'medium'
    })
  }

  // Atividade suspeita
  async logSuspiciousActivity(ip: string, userAgent: string, description: string, userId?: string) {
    await this.logSecurityEvent({
      event_type: 'suspicious_activity',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: { description },
      severity: 'medium'
    })
  }

  // Possível fraude em pagamento
  async logPaymentFraud(userId: string, ip: string, userAgent: string, details: Record<string, any>) {
    await this.logSecurityEvent({
      event_type: 'payment_fraud',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details,
      severity: 'critical'
    })
  }

  // Bloqueio de conta
  async logAccountLockout(userId: string, ip: string, userAgent: string, reason: string) {
    await this.logSecurityEvent({
      event_type: 'account_lockout',
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: { reason },
      severity: 'high'
    })
  }

  // Obter estatísticas de segurança
  async getSecurityStats(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day') {
    try {
      const now = new Date()
      let startDate: Date

      switch (timeframe) {
        case 'hour':
          startDate = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      const { data, error } = await this.supabase
        .from('security_logs')
        .select('event_type, severity, timestamp')
        .gte('timestamp', startDate.toISOString())

      if (error) {
        throw error
      }

      // Agrupar por tipo de evento
      const eventCounts = data.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Agrupar por severidade
      const severityCounts = data.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        total: data.length,
        eventCounts,
        severityCounts,
        timeframe
      }
    } catch (error) {
      console.error('Failed to get security stats:', error)
      return null
    }
  }

  // Obter eventos críticos não resolvidos
  async getCriticalEvents() {
    try {
      const { data, error } = await this.supabase
        .from('security_logs')
        .select('*')
        .eq('severity', 'critical')
        .eq('resolved', false)
        .order('timestamp', { ascending: false })
        .limit(50)

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Failed to get critical events:', error)
      return []
    }
  }

  // Marcar evento como resolvido
  async resolveEvent(eventId: string) {
    try {
      const { error } = await this.supabase
        .from('security_logs')
        .update({ resolved: true })
        .eq('id', eventId)

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Failed to resolve event:', error)
    }
  }

  // Enviar alerta crítico (placeholder para integração futura)
  private async sendCriticalAlert(event: SecurityEvent) {
    // Aqui você pode integrar com serviços como:
    // - Email (SendGrid, AWS SES)
    // - Slack
    // - Discord
    // - SMS (Twilio)
    // - PagerDuty
    
    console.error('🚨 CRITICAL SECURITY ALERT:', event)
    
    // Exemplo de integração com webhook
    if (process.env.SECURITY_WEBHOOK_URL) {
      try {
        await fetch(process.env.SECURITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Critical Security Event: ${event.event_type}`,
            event
          })
        })
      } catch (error) {
        console.error('Failed to send webhook alert:', error)
      }
    }
  }

  // Detectar padrões suspeitos
  async detectSuspiciousPatterns() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      // Múltiplas tentativas de login falhadas do mesmo IP
      const { data: failedLogins } = await this.supabase
        .from('security_logs')
        .select('ip_address')
        .eq('event_type', 'auth_failed')
        .gte('timestamp', oneHourAgo)

      if (failedLogins) {
        const ipCounts = failedLogins.reduce((acc, log) => {
          acc[log.ip_address] = (acc[log.ip_address] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        // IPs com mais de 10 tentativas falhadas na última hora
        const suspiciousIPs = Object.entries(ipCounts)
          .filter(([_, count]) => count > 10)
          .map(([ip]) => ip)

        return { suspiciousIPs }
      }

      return { suspiciousIPs: [] }
    } catch (error) {
      console.error('Failed to detect suspicious patterns:', error)
      return { suspiciousIPs: [] }
    }
  }
}

// Instância singleton
export const securityLogger = new SecurityLogger()

// Helper para extrair informações da requisição
export function getRequestInfo(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  return { ip, userAgent }
}