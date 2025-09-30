import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SecurityLogger } from './logger';
import { validateInput, sanitizeInput } from './validation';
import { z } from 'zod';

// Schema para validação de parâmetros de query
const QueryParamsSchema = z.object({
  select: z.string().optional(),
  filter: z.record(z.any()).optional(),
  order: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

// Schema para validação de dados de inserção/atualização
const DataSchema = z.record(z.any());

// Lista de tabelas sensíveis que requerem auditoria especial
const SENSITIVE_TABLES = [
  'profiles',
  'payments',
  'booster_purchases',
  'security_logs',
  'lgpd_consents',
  'lgpd_data_processing',
  'lgpd_data_subject_requests',
  'idempotency_log'
];

// Lista de operações que requerem log de auditoria
const AUDITED_OPERATIONS = ['insert', 'update', 'delete', 'upsert'];

// Padrões suspeitos em queries
const SUSPICIOUS_PATTERNS = [
  /union\s+select/i,
  /;\s*drop\s+table/i,
  /;\s*delete\s+from/i,
  /;\s*update\s+.*\s+set/i,
  /;\s*insert\s+into/i,
  /exec\s*\(/i,
  /script\s*>/i,
  /<\s*script/i,
  /javascript:/i,
  /vbscript:/i,
  /onload\s*=/i,
  /onerror\s*=/i,
];

interface QueryAuditLog {
  table: string;
  operation: string;
  userId?: string;
  filters?: any;
  data?: any;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface DatabaseSecurityConfig {
  enableQueryAudit: boolean;
  enableSqlInjectionDetection: boolean;
  enableRateLimiting: boolean;
  maxQueriesPerMinute: number;
  logSensitiveOperations: boolean;
}

class DatabaseSecurity {
  private supabase: SupabaseClient;
  private logger: SecurityLogger;
  private config: DatabaseSecurityConfig;
  private queryCount: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(supabase: SupabaseClient, config: Partial<DatabaseSecurityConfig> = {}) {
    this.supabase = supabase;
    this.logger = new SecurityLogger(supabase);
    this.config = {
      enableQueryAudit: true,
      enableSqlInjectionDetection: true,
      enableRateLimiting: true,
      maxQueriesPerMinute: 100,
      logSensitiveOperations: true,
      ...config
    };
  }

  /**
   * Detecta padrões suspeitos em strings de query
   */
  private detectSuspiciousPatterns(input: string): boolean {
    return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Valida e sanitiza parâmetros de query
   */
  private validateQueryParams(params: any): any {
    try {
      const validated = QueryParamsSchema.parse(params);
      
      // Sanitizar strings em parâmetros
      if (validated.select) {
        validated.select = sanitizeInput(validated.select);
        if (this.detectSuspiciousPatterns(validated.select)) {
          throw new Error('Suspicious pattern detected in select clause');
        }
      }

      if (validated.order) {
        validated.order = sanitizeInput(validated.order);
        if (this.detectSuspiciousPatterns(validated.order)) {
          throw new Error('Suspicious pattern detected in order clause');
        }
      }

      return validated;
    } catch (error) {
      throw new Error(`Query validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Valida dados para inserção/atualização
   */
  private validateData(data: any): any {
    try {
      const validated = DataSchema.parse(data);
      
      // Sanitizar strings nos dados
      const sanitized: any = {};
      for (const [key, value] of Object.entries(validated)) {
        if (typeof value === 'string') {
          sanitized[key] = sanitizeInput(value);
          if (this.detectSuspiciousPatterns(sanitized[key])) {
            throw new Error(`Suspicious pattern detected in field: ${key}`);
          }
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    } catch (error) {
      throw new Error(`Data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifica rate limiting por usuário
   */
  private checkRateLimit(userId: string): boolean {
    if (!this.config.enableRateLimiting) return true;

    const now = Date.now();
    const userKey = `user:${userId}`;
    const userQueries = this.queryCount.get(userKey);

    if (!userQueries || now > userQueries.resetTime) {
      this.queryCount.set(userKey, {
        count: 1,
        resetTime: now + 60000 // 1 minuto
      });
      return true;
    }

    if (userQueries.count >= this.config.maxQueriesPerMinute) {
      return false;
    }

    userQueries.count++;
    return true;
  }

  /**
   * Registra operação de auditoria
   */
  private async logAuditOperation(audit: QueryAuditLog): Promise<void> {
    if (!this.config.enableQueryAudit) return;

    try {
      await this.supabase
        .from('database_audit_logs')
        .insert({
          table_name: audit.table,
          operation: audit.operation,
          user_id: audit.userId,
          filters: audit.filters,
          data: audit.data,
          ip_address: audit.ipAddress,
          user_agent: audit.userAgent,
          created_at: audit.timestamp.toISOString()
        });
    } catch (error) {
      console.error('Failed to log audit operation:', error);
    }
  }

  /**
   * Wrapper seguro para operações de SELECT
   */
  async secureSelect(
    table: string,
    params: any = {},
    context: { userId?: string; ipAddress?: string; userAgent?: string } = {}
  ) {
    try {
      // Rate limiting
      if (context.userId && !this.checkRateLimit(context.userId)) {
        await this.logger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          userId: context.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: { table, operation: 'select' }
        });
        throw new Error('Rate limit exceeded');
      }

      // Validar parâmetros
      const validatedParams = this.validateQueryParams(params);

      // Construir query
      let query = this.supabase.from(table);

      if (validatedParams.select) {
        query = query.select(validatedParams.select);
      } else {
        query = query.select('*');
      }

      // Aplicar filtros
      if (validatedParams.filter) {
        for (const [key, value] of Object.entries(validatedParams.filter)) {
          query = query.eq(key, value);
        }
      }

      // Aplicar ordenação
      if (validatedParams.order) {
        const [column, direction] = validatedParams.order.split(':');
        query = query.order(column, { ascending: direction !== 'desc' });
      }

      // Aplicar paginação
      if (validatedParams.limit) {
        query = query.limit(validatedParams.limit);
      }

      if (validatedParams.offset) {
        query = query.range(validatedParams.offset, validatedParams.offset + (validatedParams.limit || 10) - 1);
      }

      const result = await query;

      // Log para tabelas sensíveis
      if (SENSITIVE_TABLES.includes(table) && this.config.logSensitiveOperations) {
        await this.logAuditOperation({
          table,
          operation: 'select',
          userId: context.userId,
          filters: validatedParams.filter,
          timestamp: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      return result;
    } catch (error) {
      await this.logger.logSecurityEvent({
        type: 'database_error',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { table, operation: 'select', error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Wrapper seguro para operações de INSERT
   */
  async secureInsert(
    table: string,
    data: any,
    context: { userId?: string; ipAddress?: string; userAgent?: string } = {}
  ) {
    try {
      // Rate limiting
      if (context.userId && !this.checkRateLimit(context.userId)) {
        await this.logger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          userId: context.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: { table, operation: 'insert' }
        });
        throw new Error('Rate limit exceeded');
      }

      // Validar e sanitizar dados
      const validatedData = this.validateData(data);

      const result = await this.supabase
        .from(table)
        .insert(validatedData);

      // Log de auditoria
      if (AUDITED_OPERATIONS.includes('insert')) {
        await this.logAuditOperation({
          table,
          operation: 'insert',
          userId: context.userId,
          data: validatedData,
          timestamp: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      return result;
    } catch (error) {
      await this.logger.logSecurityEvent({
        type: 'database_error',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { table, operation: 'insert', error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Wrapper seguro para operações de UPDATE
   */
  async secureUpdate(
    table: string,
    data: any,
    filters: any,
    context: { userId?: string; ipAddress?: string; userAgent?: string } = {}
  ) {
    try {
      // Rate limiting
      if (context.userId && !this.checkRateLimit(context.userId)) {
        await this.logger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          userId: context.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: { table, operation: 'update' }
        });
        throw new Error('Rate limit exceeded');
      }

      // Validar e sanitizar dados
      const validatedData = this.validateData(data);
      const validatedFilters = this.validateData(filters);

      let query = this.supabase.from(table).update(validatedData);

      // Aplicar filtros
      for (const [key, value] of Object.entries(validatedFilters)) {
        query = query.eq(key, value);
      }

      const result = await query;

      // Log de auditoria
      if (AUDITED_OPERATIONS.includes('update')) {
        await this.logAuditOperation({
          table,
          operation: 'update',
          userId: context.userId,
          data: validatedData,
          filters: validatedFilters,
          timestamp: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      return result;
    } catch (error) {
      await this.logger.logSecurityEvent({
        type: 'database_error',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { table, operation: 'update', error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Wrapper seguro para operações de DELETE
   */
  async secureDelete(
    table: string,
    filters: any,
    context: { userId?: string; ipAddress?: string; userAgent?: string } = {}
  ) {
    try {
      // Rate limiting
      if (context.userId && !this.checkRateLimit(context.userId)) {
        await this.logger.logSecurityEvent({
          type: 'rate_limit_exceeded',
          userId: context.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          details: { table, operation: 'delete' }
        });
        throw new Error('Rate limit exceeded');
      }

      // Validar filtros
      const validatedFilters = this.validateData(filters);

      let query = this.supabase.from(table).delete();

      // Aplicar filtros
      for (const [key, value] of Object.entries(validatedFilters)) {
        query = query.eq(key, value);
      }

      const result = await query;

      // Log de auditoria
      if (AUDITED_OPERATIONS.includes('delete')) {
        await this.logAuditOperation({
          table,
          operation: 'delete',
          userId: context.userId,
          filters: validatedFilters,
          timestamp: new Date(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      return result;
    } catch (error) {
      await this.logger.logSecurityEvent({
        type: 'database_error',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { table, operation: 'delete', error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * Detecta tentativas de SQL Injection
   */
  async detectSqlInjection(input: string, context: { userId?: string; ipAddress?: string; userAgent?: string } = {}): Promise<boolean> {
    if (!this.config.enableSqlInjectionDetection) return false;

    const isSuspicious = this.detectSuspiciousPatterns(input);

    if (isSuspicious) {
      await this.logger.logSecurityEvent({
        type: 'sql_injection_attempt',
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: { input: input.substring(0, 200) } // Log apenas os primeiros 200 caracteres
      });
    }

    return isSuspicious;
  }

  /**
   * Gera relatório de segurança do banco de dados
   */
  async generateSecurityReport(days: number = 7): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    try {
      const [auditLogs, securityEvents] = await Promise.all([
        this.supabase
          .from('database_audit_logs')
          .select('*')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString()),
        this.supabase
          .from('security_logs')
          .select('*')
          .in('event_type', ['database_error', 'sql_injection_attempt', 'rate_limit_exceeded'])
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
      ]);

      return {
        period: { start: startDate, end: endDate },
        auditLogs: auditLogs.data || [],
        securityEvents: securityEvents.data || [],
        summary: {
          totalQueries: auditLogs.data?.length || 0,
          securityIncidents: securityEvents.data?.length || 0,
          mostAccessedTables: this.getMostAccessedTables(auditLogs.data || []),
          suspiciousActivity: securityEvents.data?.filter(e => e.event_type === 'sql_injection_attempt') || []
        }
      };
    } catch (error) {
      console.error('Failed to generate security report:', error);
      throw error;
    }
  }

  private getMostAccessedTables(logs: any[]): any[] {
    const tableCounts = logs.reduce((acc, log) => {
      acc[log.table_name] = (acc[log.table_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(tableCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([table, count]) => ({ table, count }));
  }
}

// Função para criar instância segura do Supabase
export function createSecureSupabaseClient(url: string, key: string, config?: Partial<DatabaseSecurityConfig>) {
  const supabase = createClient(url, key);
  return new DatabaseSecurity(supabase, config);
}

export { DatabaseSecurity, type DatabaseSecurityConfig, type QueryAuditLog };