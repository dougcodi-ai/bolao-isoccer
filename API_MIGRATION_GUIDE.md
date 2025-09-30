# Guia de Migração de APIs - Sistema de Segurança

Este guia mostra como migrar suas APIs existentes para usar o novo sistema de segurança com logs, auditoria e conformidade LGPD.

## 📋 Visão Geral

O sistema de segurança oferece:
- **Logs de Segurança**: Rastreamento de eventos críticos
- **Auditoria de Banco**: Monitoramento de operações no banco
- **Conformidade LGPD**: Gestão de consentimentos e direitos dos usuários

## 🔧 Configuração Inicial

### 1. Instalar Dependências

Se ainda não instaladas:

```bash
npm install @supabase/supabase-js
```

### 2. Configurar Cliente Supabase

Crie um arquivo `lib/security.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Função para registrar eventos de segurança
export async function logSecurityEvent({
    eventType,
    userId = null,
    ipAddress,
    userAgent,
    message,
    metadata = {},
    severity = 'info'
}) {
    try {
        const { error } = await supabaseAdmin
            .from('security_logs')
            .insert({
                event_type: eventType,
                user_id: userId,
                ip_address: ipAddress,
                user_agent: userAgent,
                message,
                metadata,
                severity
            });

        if (error) {
            console.error('Erro ao registrar evento de segurança:', error);
        }
    } catch (error) {
        console.error('Erro ao registrar evento de segurança:', error);
    }
}

// Função para registrar auditoria de banco
export async function logDatabaseAudit({
    operation,
    tableName,
    userId = null,
    filters = {},
    data = {},
    ipAddress,
    userAgent
}) {
    try {
        const { error } = await supabaseAdmin
            .from('database_audit_logs')
            .insert({
                operation,
                table_name: tableName,
                user_id: userId,
                filters,
                data,
                ip_address: ipAddress,
                user_agent: userAgent
            });

        if (error) {
            console.error('Erro ao registrar auditoria:', error);
        }
    } catch (error) {
        console.error('Erro ao registrar auditoria:', error);
    }
}

// Função para registrar conformidade LGPD
export async function logLGPDCompliance({
    userId,
    actionType,
    legalBasis,
    dataCategories,
    processingPurposes,
    ipAddress,
    userAgent,
    details = {},
    retentionPeriod = null,
    thirdPartySharing = false,
    automatedDecisionMaking = false
}) {
    try {
        const { error } = await supabaseAdmin
            .from('lgpd_compliance_logs')
            .insert({
                user_id: userId,
                action_type: actionType,
                legal_basis: legalBasis,
                data_categories: dataCategories,
                processing_purposes: processingPurposes,
                retention_period: retentionPeriod,
                third_party_sharing: thirdPartySharing,
                automated_decision_making: automatedDecisionMaking,
                ip_address: ipAddress,
                user_agent: userAgent,
                details,
                status: 'completed'
            });

        if (error) {
            console.error('Erro ao registrar conformidade LGPD:', error);
        }
    } catch (error) {
        console.error('Erro ao registrar conformidade LGPD:', error);
    }
}

// Função para obter IP e User-Agent da requisição
export function getRequestInfo(req) {
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     req.socket?.remoteAddress || 
                     '127.0.0.1';
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    return { ipAddress, userAgent };
}
```

## 🔐 Migração de APIs de Autenticação

### Antes (sem logs):

```javascript
// pages/api/auth/login.js
export default async function handler(req, res) {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        return res.status(401).json({ error: error.message });
    }
    
    res.json({ user: data.user });
}
```

### Depois (com logs de segurança):

```javascript
// pages/api/auth/login.js
import { logSecurityEvent, getRequestInfo } from '../../../lib/security';

export default async function handler(req, res) {
    const { email, password } = req.body;
    const { ipAddress, userAgent } = getRequestInfo(req);
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        // Log falha de autenticação
        await logSecurityEvent({
            eventType: 'auth_failed',
            ipAddress,
            userAgent,
            message: `Falha de login para email: ${email}`,
            metadata: { email, error: error.message },
            severity: 'medium'
        });
        
        return res.status(401).json({ error: error.message });
    }
    
    // Log sucesso de autenticação
    await logSecurityEvent({
        eventType: 'auth_success',
        userId: data.user.id,
        ipAddress,
        userAgent,
        message: `Login bem-sucedido para usuário: ${data.user.email}`,
        metadata: { email: data.user.email },
        severity: 'info'
    });
    
    res.json({ user: data.user });
}
```

## 📊 Migração de APIs de Dados

### Antes (sem auditoria):

```javascript
// pages/api/pools/create.js
export default async function handler(req, res) {
    const { name, description } = req.body;
    
    const { data, error } = await supabase
        .from('pools')
        .insert({ name, description })
        .select();
    
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    
    res.json(data[0]);
}
```

### Depois (com auditoria):

```javascript
// pages/api/pools/create.js
import { logDatabaseAudit, getRequestInfo } from '../../../lib/security';

export default async function handler(req, res) {
    const { name, description } = req.body;
    const { ipAddress, userAgent } = getRequestInfo(req);
    
    // Obter usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
        .from('pools')
        .insert({ name, description })
        .select();
    
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    
    // Log auditoria da criação
    await logDatabaseAudit({
        operation: 'insert',
        tableName: 'pools',
        userId: user?.id,
        data: { name, description },
        ipAddress,
        userAgent
    });
    
    res.json(data[0]);
}
```

## 🛡️ Implementação de Rate Limiting

```javascript
// lib/rateLimit.js
import { logSecurityEvent } from './security';

const rateLimitMap = new Map();

export function rateLimit(identifier, maxRequests = 100, windowMs = 60000) {
    return async (req, res, next) => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!rateLimitMap.has(identifier)) {
            rateLimitMap.set(identifier, []);
        }
        
        const requests = rateLimitMap.get(identifier);
        
        // Remove requisições antigas
        const validRequests = requests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
            const { ipAddress, userAgent } = getRequestInfo(req);
            
            // Log violação de rate limit
            await logSecurityEvent({
                eventType: 'rate_limit_exceeded',
                ipAddress,
                userAgent,
                message: `Rate limit excedido para ${identifier}`,
                metadata: { 
                    identifier, 
                    requests: validRequests.length, 
                    maxRequests 
                },
                severity: 'high'
            });
            
            return res.status(429).json({ 
                error: 'Muitas requisições. Tente novamente mais tarde.' 
            });
        }
        
        validRequests.push(now);
        rateLimitMap.set(identifier, validRequests);
        
        next();
    };
}

// Uso em API
// pages/api/protected-endpoint.js
import { rateLimit } from '../../lib/rateLimit';

export default async function handler(req, res) {
    const { ipAddress } = getRequestInfo(req);
    
    // Aplicar rate limiting por IP
    await rateLimit(ipAddress, 50, 60000)(req, res, () => {
        // Sua lógica da API aqui
        res.json({ message: 'Sucesso' });
    });
}
```

## 📋 Conformidade LGPD

### API para Consentimento

```javascript
// pages/api/lgpd/consent.js
import { logLGPDCompliance, getRequestInfo } from '../../../lib/security';

export default async function handler(req, res) {
    const { userId, consentGiven, dataCategories, purposes } = req.body;
    const { ipAddress, userAgent } = getRequestInfo(req);
    
    // Atualizar consentimento no banco
    const { error } = await supabase
        .from('user_consents')
        .upsert({
            user_id: userId,
            consent_given: consentGiven,
            data_categories: dataCategories,
            processing_purposes: purposes,
            updated_at: new Date().toISOString()
        });
    
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    
    // Log conformidade LGPD
    await logLGPDCompliance({
        userId,
        actionType: consentGiven ? 'consent_given' : 'consent_withdrawn',
        legalBasis: 'consent',
        dataCategories,
        processingPurposes: purposes,
        ipAddress,
        userAgent,
        details: { consentGiven }
    });
    
    res.json({ success: true });
}
```

### API para Solicitação de Dados

```javascript
// pages/api/lgpd/data-request.js
import { logLGPDCompliance, getRequestInfo } from '../../../lib/security';

export default async function handler(req, res) {
    const { userId, requestType } = req.body; // 'access', 'deletion', 'portability'
    const { ipAddress, userAgent } = getRequestInfo(req);
    
    // Processar solicitação
    let actionType;
    switch (requestType) {
        case 'access':
            actionType = 'data_access_request';
            break;
        case 'deletion':
            actionType = 'data_deletion_request';
            break;
        case 'portability':
            actionType = 'data_portability_request';
            break;
        default:
            return res.status(400).json({ error: 'Tipo de solicitação inválido' });
    }
    
    // Log da solicitação
    await logLGPDCompliance({
        userId,
        actionType,
        legalBasis: 'consent',
        dataCategories: ['personal_data', 'usage_data'],
        processingPurposes: ['data_subject_rights'],
        ipAddress,
        userAgent,
        details: { requestType }
    });
    
    res.json({ 
        message: 'Solicitação registrada com sucesso',
        requestId: `REQ-${Date.now()}`
    });
}
```

## 🔍 Detecção de Atividades Suspeitas

```javascript
// lib/securityMiddleware.js
import { logSecurityEvent, getRequestInfo } from './security';

export function detectSuspiciousActivity() {
    return async (req, res, next) => {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const body = JSON.stringify(req.body);
        
        // Detectar tentativas de SQL Injection
        const sqlInjectionPatterns = [
            /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b)/i,
            /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
            /['"]\s*;\s*--/,
            /\/\*.*\*\//
        ];
        
        for (const pattern of sqlInjectionPatterns) {
            if (pattern.test(body) || pattern.test(req.url)) {
                await logSecurityEvent({
                    eventType: 'sql_injection_attempt',
                    ipAddress,
                    userAgent,
                    message: 'Tentativa de SQL Injection detectada',
                    metadata: { 
                        url: req.url, 
                        body: body.substring(0, 500),
                        pattern: pattern.toString()
                    },
                    severity: 'critical'
                });
                
                return res.status(403).json({ 
                    error: 'Atividade suspeita detectada' 
                });
            }
        }
        
        // Detectar tentativas de XSS
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi
        ];
        
        for (const pattern of xssPatterns) {
            if (pattern.test(body)) {
                await logSecurityEvent({
                    eventType: 'xss_attempt',
                    ipAddress,
                    userAgent,
                    message: 'Tentativa de XSS detectada',
                    metadata: { 
                        url: req.url, 
                        body: body.substring(0, 500),
                        pattern: pattern.toString()
                    },
                    severity: 'high'
                });
                
                return res.status(403).json({ 
                    error: 'Conteúdo malicioso detectado' 
                });
            }
        }
        
        next();
    };
}
```

## 📊 Dashboard de Monitoramento

```javascript
// pages/api/admin/security-stats.js
export default async function handler(req, res) {
    // Verificar se é admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    try {
        // Obter estatísticas usando a função criada
        const { data: stats, error } = await supabase.rpc('get_security_stats');
        
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        // Obter atividades suspeitas
        const { data: suspicious, error: suspiciousError } = await supabase
            .rpc('detect_suspicious_activity');
        
        res.json({
            stats,
            suspicious_activities: suspicious || [],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
```

## ✅ Checklist de Migração

### APIs de Autenticação
- [ ] Login/Logout com logs de segurança
- [ ] Registro com conformidade LGPD
- [ ] Reset de senha com auditoria
- [ ] Rate limiting implementado

### APIs de Dados
- [ ] CRUD operations com auditoria
- [ ] Validação de entrada
- [ ] Detecção de atividades suspeitas
- [ ] Logs de acesso a dados sensíveis

### Conformidade LGPD
- [ ] Gestão de consentimentos
- [ ] Solicitações de dados
- [ ] Direito ao esquecimento
- [ ] Portabilidade de dados

### Monitoramento
- [ ] Dashboard de segurança
- [ ] Alertas automáticos
- [ ] Relatórios de conformidade
- [ ] Limpeza automática de logs

## 🚀 Próximos Passos

1. **Teste em Desenvolvimento**: Aplique as migrações em algumas APIs primeiro
2. **Monitoramento**: Configure alertas para eventos críticos
3. **Performance**: Monitore o impacto nos tempos de resposta
4. **Documentação**: Documente os novos fluxos para a equipe
5. **Produção**: Migre gradualmente para produção

## 📞 Suporte

Para dúvidas sobre a migração:
1. Consulte os logs de erro no Supabase Dashboard
2. Verifique se as tabelas e funções foram criadas corretamente
3. Teste cada API migrada individualmente
4. Use o script `test-after-manual-migration.js` para validar o sistema