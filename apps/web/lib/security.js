import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  Variáveis de ambiente do Supabase não configuradas para sistema de segurança');
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Sistema de Segurança Simplificado
 * Funciona com as tabelas existentes no Supabase
 */
export class SecuritySystem {
    constructor() {
        this.isEnabled = !!supabaseAdmin;
        if (!this.isEnabled) {
            console.warn('⚠️  Sistema de segurança desabilitado - configuração incompleta');
        }
    }

    /**
     * Registra um evento de segurança
     */
    async logSecurityEvent(eventData) {
        if (!this.isEnabled) return null;

        try {
            const logEntry = {
                event_type: eventData.type || 'unknown',
                user_id: eventData.userId || null,
                ip_address: eventData.ipAddress || null,
                user_agent: eventData.userAgent || null,
                endpoint: eventData.endpoint || null,
                method: eventData.method || null,
                status_code: eventData.statusCode || null,
                message: eventData.message || '',
                severity: eventData.severity || 'info',
                metadata: eventData.metadata || {},
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabaseAdmin
                .from('security_logs')
                .insert(logEntry)
                .select();

            if (error) {
                console.error('❌ Erro ao registrar log de segurança:', error.message);
                return null;
            }

            return data[0];
        } catch (error) {
            console.error('❌ Erro no sistema de segurança:', error.message);
            return null;
        }
    }

    /**
     * Registra um log de auditoria de banco de dados
     */
    async logDatabaseAudit(auditData) {
        if (!this.isEnabled) return null;

        try {
            const auditEntry = {
                table_name: auditData.tableName,
                operation: auditData.operation,
                user_id: auditData.userId || null,
                old_values: auditData.oldValues || null,
                new_values: auditData.newValues || null,
                changed_fields: auditData.changedFields || [],
                ip_address: auditData.ipAddress || null,
                user_agent: auditData.userAgent || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabaseAdmin
                .from('database_audit_logs')
                .insert(auditEntry)
                .select();

            if (error) {
                console.error('❌ Erro ao registrar auditoria:', error.message);
                return null;
            }

            return data[0];
        } catch (error) {
            console.error('❌ Erro na auditoria:', error.message);
            return null;
        }
    }

    /**
     * Registra um log de conformidade LGPD
     */
    async logLGPDCompliance(lgpdData) {
        if (!this.isEnabled) return null;

        try {
            const lgpdEntry = {
                user_id: lgpdData.userId,
                action_type: lgpdData.actionType,
                legal_basis: lgpdData.legalBasis || null,
                data_categories: lgpdData.dataCategories || [],
                purpose: lgpdData.purpose || null,
                retention_period: lgpdData.retentionPeriod || null,
                third_parties: lgpdData.thirdParties || [],
                user_consent: lgpdData.userConsent || false,
                ip_address: lgpdData.ipAddress || null,
                user_agent: lgpdData.userAgent || null,
                metadata: lgpdData.metadata || {},
                expires_at: lgpdData.expiresAt || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabaseAdmin
                .from('lgpd_compliance_logs')
                .insert(lgpdEntry)
                .select();

            if (error) {
                console.error('❌ Erro ao registrar conformidade LGPD:', error.message);
                return null;
            }

            return data[0];
        } catch (error) {
            console.error('❌ Erro na conformidade LGPD:', error.message);
            return null;
        }
    }

    /**
     * Obtém estatísticas de segurança
     */
    async getSecurityStats() {
        if (!this.isEnabled) return null;

        try {
            // Obter estatísticas usando queries diretas
            const [
                totalEvents,
                events24h,
                suspiciousIps,
                failedLogins,
                sqlInjection,
                xssAttempts,
                rateLimitViolations
            ] = await Promise.all([
                supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true }),
                supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true })
                    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
                supabaseAdmin.from('security_logs').select('ip_address', { count: 'exact' })
                    .in('severity', ['high', 'critical']),
                supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true })
                    .eq('event_type', 'auth_failed'),
                supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true })
                    .eq('event_type', 'sql_injection_attempt'),
                supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true })
                    .eq('event_type', 'xss_attempt'),
                supabaseAdmin.from('security_logs').select('*', { count: 'exact', head: true })
                    .eq('event_type', 'rate_limit_exceeded')
            ]);

            return {
                total_events: totalEvents.count || 0,
                events_last_24h: events24h.count || 0,
                suspicious_ips: suspiciousIps.count || 0,
                failed_logins: failedLogins.count || 0,
                sql_injection_attempts: sqlInjection.count || 0,
                xss_attempts: xssAttempts.count || 0,
                rate_limit_violations: rateLimitViolations.count || 0
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error.message);
            return null;
        }
    }

    /**
     * Detecta atividade suspeita
     */
    async detectSuspiciousActivity() {
        if (!this.isEnabled) return [];

        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            
            const { data: recentEvents, error } = await supabaseAdmin
                .from('security_logs')
                .select('user_id, ip_address')
                .gte('created_at', oneHourAgo);

            if (error) {
                console.error('❌ Erro ao detectar atividade suspeita:', error.message);
                return [];
            }

            // Agrupar por IP e contar eventos
            const ipCounts = {};
            recentEvents.forEach(event => {
                const key = `${event.user_id || 'anonymous'}_${event.ip_address}`;
                ipCounts[key] = (ipCounts[key] || 0) + 1;
            });

            // Filtrar IPs com mais de 10 eventos
            const suspicious = Object.entries(ipCounts)
                .filter(([key, count]) => count > 10)
                .map(([key, count]) => {
                    const [user_id, ip_address] = key.split('_');
                    return {
                        user_id: user_id === 'anonymous' ? null : user_id,
                        ip_address,
                        event_count: count,
                        severity_level: count > 100 ? 'critical' : count > 50 ? 'high' : count > 20 ? 'medium' : 'low'
                    };
                })
                .sort((a, b) => b.event_count - a.event_count);

            return suspicious;
        } catch (error) {
            console.error('❌ Erro ao detectar atividade suspeita:', error.message);
            return [];
        }
    }

    /**
     * Middleware para Express/Next.js
     */
    middleware() {
        return async (req, res, next) => {
            const startTime = Date.now();

            // Capturar informações da requisição
            const requestInfo = {
                type: 'api_request',
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                endpoint: req.path || req.url,
                method: req.method,
                userId: req.user?.id || null
            };

            // Log da requisição
            await this.logSecurityEvent({
                ...requestInfo,
                message: `${req.method} ${req.path || req.url}`,
                severity: 'info',
                metadata: {
                    headers: req.headers,
                    query: req.query,
                    timestamp: new Date().toISOString()
                }
            });

            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const responseTime = Date.now() - startTime;
                
                // Log da resposta
                securitySystem.logSecurityEvent({
                    ...requestInfo,
                    type: 'api_response',
                    statusCode: res.statusCode,
                    message: `${req.method} ${req.path || req.url} - ${res.statusCode}`,
                    severity: res.statusCode >= 400 ? 'warning' : 'info',
                    metadata: {
                        responseTime,
                        statusCode: res.statusCode,
                        timestamp: new Date().toISOString()
                    }
                });

                originalSend.call(this, data);
            };

            if (next) next();
        };
    }
}

// Instância global do sistema de segurança
export const securitySystem = new SecuritySystem();

// Funções de conveniência
export const logSecurity = (eventData) => securitySystem.logSecurityEvent(eventData);
export const logAudit = (auditData) => securitySystem.logDatabaseAudit(auditData);
export const logLGPD = (lgpdData) => securitySystem.logLGPDCompliance(lgpdData);
export const getStats = () => securitySystem.getSecurityStats();
export const detectSuspicious = () => securitySystem.detectSuspiciousActivity();

// Tipos de eventos de segurança
export const SecurityEventTypes = {
    AUTH_SUCCESS: 'auth_success',
    AUTH_FAILED: 'auth_failed',
    AUTH_LOGOUT: 'auth_logout',
    API_REQUEST: 'api_request',
    API_RESPONSE: 'api_response',
    SQL_INJECTION: 'sql_injection_attempt',
    XSS_ATTEMPT: 'xss_attempt',
    RATE_LIMIT: 'rate_limit_exceeded',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',
    DATA_ACCESS: 'data_access',
    DATA_MODIFICATION: 'data_modification',
    SYSTEM_ERROR: 'system_error'
};

// Níveis de severidade
export const SeverityLevels = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

export default securitySystem;