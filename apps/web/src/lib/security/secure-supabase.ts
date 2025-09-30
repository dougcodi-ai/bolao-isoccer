import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseSecurity } from './database-security';
import { SecurityLogger } from './logger';
import { validateInput } from './validation';
import { DataProtection } from './data-protection';

interface SecureSupabaseConfig {
  enableDatabaseSecurity: boolean;
  enableDataProtection: boolean;
  enableSecurityLogging: boolean;
  maxQueriesPerMinute: number;
  logSensitiveOperations: boolean;
}

class SecureSupabase {
  private supabase: SupabaseClient;
  private dbSecurity: DatabaseSecurity;
  private logger: SecurityLogger;
  private dataProtection: DataProtection;
  private config: SecureSupabaseConfig;

  constructor(url: string, key: string, config: Partial<SecureSupabaseConfig> = {}) {
    this.config = {
      enableDatabaseSecurity: true,
      enableDataProtection: true,
      enableSecurityLogging: true,
      maxQueriesPerMinute: 100,
      logSensitiveOperations: true,
      ...config
    };

    this.supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-client-info': 'isoccer-web-secure',
        },
      },
    });

    this.dbSecurity = new DatabaseSecurity(this.supabase, {
      enableQueryAudit: this.config.enableDatabaseSecurity,
      enableSqlInjectionDetection: this.config.enableDatabaseSecurity,
      enableRateLimiting: this.config.enableDatabaseSecurity,
      maxQueriesPerMinute: this.config.maxQueriesPerMinute,
      logSensitiveOperations: this.config.logSensitiveOperations,
    });

    this.logger = new SecurityLogger(this.supabase);
    this.dataProtection = new DataProtection();
  }

  /**
   * Obtém contexto de segurança da requisição
   */
  private getSecurityContext(request?: Request): { userId?: string; ipAddress?: string; userAgent?: string } {
    if (!request) return {};

    return {
      ipAddress: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };
  }

  /**
   * Obtém usuário autenticado
   */
  async getAuthenticatedUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error || !user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  /**
   * Wrapper seguro para operações de SELECT
   */
  async secureSelect(
    table: string,
    params: any = {},
    request?: Request
  ) {
    const context = this.getSecurityContext(request);
    
    try {
      const user = await this.getAuthenticatedUser();
      context.userId = user.id;
    } catch {
      // Usuário não autenticado - algumas operações podem ser permitidas
    }

    if (this.config.enableDatabaseSecurity) {
      return await this.dbSecurity.secureSelect(table, params, context);
    } else {
      // Fallback para operação normal do Supabase
      let query = this.supabase.from(table);
      
      if (params.select) {
        query = query.select(params.select);
      } else {
        query = query.select('*');
      }

      if (params.filter) {
        for (const [key, value] of Object.entries(params.filter)) {
          query = query.eq(key, value);
        }
      }

      return await query;
    }
  }

  /**
   * Wrapper seguro para operações de INSERT
   */
  async secureInsert(
    table: string,
    data: any,
    request?: Request
  ) {
    const context = this.getSecurityContext(request);
    
    try {
      const user = await this.getAuthenticatedUser();
      context.userId = user.id;
    } catch (error) {
      throw new Error('Authentication required for insert operations');
    }

    // Proteger dados sensíveis
    if (this.config.enableDataProtection) {
      data = this.dataProtection.sanitizeForStorage(data);
    }

    if (this.config.enableDatabaseSecurity) {
      return await this.dbSecurity.secureInsert(table, data, context);
    } else {
      return await this.supabase.from(table).insert(data);
    }
  }

  /**
   * Wrapper seguro para operações de UPDATE
   */
  async secureUpdate(
    table: string,
    data: any,
    filters: any,
    request?: Request
  ) {
    const context = this.getSecurityContext(request);
    
    try {
      const user = await this.getAuthenticatedUser();
      context.userId = user.id;
    } catch (error) {
      throw new Error('Authentication required for update operations');
    }

    // Proteger dados sensíveis
    if (this.config.enableDataProtection) {
      data = this.dataProtection.sanitizeForStorage(data);
    }

    if (this.config.enableDatabaseSecurity) {
      return await this.dbSecurity.secureUpdate(table, data, filters, context);
    } else {
      let query = this.supabase.from(table).update(data);
      
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      
      return await query;
    }
  }

  /**
   * Wrapper seguro para operações de DELETE
   */
  async secureDelete(
    table: string,
    filters: any,
    request?: Request
  ) {
    const context = this.getSecurityContext(request);
    
    try {
      const user = await this.getAuthenticatedUser();
      context.userId = user.id;
    } catch (error) {
      throw new Error('Authentication required for delete operations');
    }

    if (this.config.enableDatabaseSecurity) {
      return await this.dbSecurity.secureDelete(table, filters, context);
    } else {
      let query = this.supabase.from(table).delete();
      
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
      
      return await query;
    }
  }

  /**
   * Wrapper seguro para operações de UPSERT
   */
  async secureUpsert(
    table: string,
    data: any,
    options: any = {},
    request?: Request
  ) {
    const context = this.getSecurityContext(request);
    
    try {
      const user = await this.getAuthenticatedUser();
      context.userId = user.id;
    } catch (error) {
      throw new Error('Authentication required for upsert operations');
    }

    // Proteger dados sensíveis
    if (this.config.enableDataProtection) {
      data = this.dataProtection.sanitizeForStorage(data);
    }

    // Para upsert, usamos o cliente normal do Supabase mas com validação
    if (this.config.enableDatabaseSecurity) {
      // Validar dados antes do upsert
      await this.dbSecurity.detectSqlInjection(JSON.stringify(data), context);
    }

    return await this.supabase.from(table).upsert(data, options);
  }

  /**
   * Acesso direto ao cliente Supabase para operações especiais
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Acesso ao sistema de autenticação
   */
  get auth() {
    return this.supabase.auth;
  }

  /**
   * Acesso ao storage
   */
  get storage() {
    return this.supabase.storage;
  }

  /**
   * Middleware para APIs Next.js
   */
  static middleware(config?: Partial<SecureSupabaseConfig>) {
    return (handler: Function) => {
      return async (request: Request, context: any) => {
        const secureSupabase = new SecureSupabase(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          config
        );

        // Adicionar instância segura ao contexto
        context.secureSupabase = secureSupabase;

        return await handler(request, context);
      };
    };
  }

  /**
   * Gera relatório de segurança
   */
  async generateSecurityReport(days: number = 7) {
    if (!this.config.enableDatabaseSecurity) {
      throw new Error('Database security is disabled');
    }

    return await this.dbSecurity.generateSecurityReport(days);
  }

  /**
   * Verifica se uma string contém padrões suspeitos
   */
  async detectSuspiciousActivity(input: string, request?: Request) {
    const context = this.getSecurityContext(request);
    
    try {
      const user = await this.getAuthenticatedUser();
      context.userId = user.id;
    } catch {
      // Usuário não autenticado
    }

    if (this.config.enableDatabaseSecurity) {
      return await this.dbSecurity.detectSqlInjection(input, context);
    }

    return false;
  }
}

// Instância global segura
let globalSecureSupabase: SecureSupabase | null = null;

export function getSecureSupabase(config?: Partial<SecureSupabaseConfig>): SecureSupabase {
  if (!globalSecureSupabase) {
    globalSecureSupabase = new SecureSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      config
    );
  }
  return globalSecureSupabase;
}

// Para uso em APIs administrativas
export function getSecureSupabaseAdmin(config?: Partial<SecureSupabaseConfig>): SecureSupabase {
  return new SecureSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    config
  );
}

export { SecureSupabase, type SecureSupabaseConfig };