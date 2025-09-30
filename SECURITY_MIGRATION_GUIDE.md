# Guia de Migração de Segurança

Este guia explica como migrar as APIs existentes para usar o novo sistema de segurança implementado.

## 📋 Checklist de Migração

### 1. Substituir Cliente Supabase
```typescript
// ❌ ANTES
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);

// ✅ DEPOIS
import { getSecureSupabase } from '@/lib/security/secure-supabase';
const secureSupabase = getSecureSupabase({
  enableDatabaseSecurity: true,
  enableDataProtection: true,
  enableSecurityLogging: true,
  maxQueriesPerMinute: 100
});
```

### 2. Validar Inputs
```typescript
// ❌ ANTES
const { matchId, home_pred, away_pred } = await req.json();

// ✅ DEPOIS
import { validateInput, PredictionSchema } from '@/lib/security/validation';
const body = await req.json().catch(() => ({}));
const validationResult = validateInput(body, PredictionSchema);
if (!validationResult.success) {
  return NextResponse.json({ 
    ok: false, 
    error: "Invalid payload", 
    details: validationResult.errors 
  }, { status: 400 });
}
const { matchId, home_pred, away_pred } = validationResult.data;
```

### 3. Usar Operações Seguras
```typescript
// ❌ ANTES
const { data, error } = await supabase
  .from('predictions')
  .select('*')
  .eq('user_id', userId);

// ✅ DEPOIS
const result = await secureSupabase.secureSelect(
  'predictions',
  {
    select: 'match_id, home_pred, away_pred, created_at',
    filter: { user_id: userId }
  },
  req
);
```

### 4. Implementar Logs de Segurança
```typescript
// ✅ ADICIONAR
import { SecurityLogger } from '@/lib/security/logger';
const logger = new SecurityLogger(secureSupabase.client);

// Log eventos importantes
await logger.logSecurityEvent({
  type: 'authentication_failed',
  userId,
  ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
  userAgent: req.headers.get('user-agent') || 'unknown',
  details: { error: 'Invalid credentials' }
});
```

### 5. Detectar Atividade Suspeita
```typescript
// ✅ ADICIONAR
const bodyString = JSON.stringify(body);
const isSuspicious = await secureSupabase.detectSuspiciousActivity(bodyString, req);
if (isSuspicious) {
  return NextResponse.json({ ok: false, error: "Suspicious activity detected" }, { status: 400 });
}
```

## 🔄 Padrões de Migração por Tipo de API

### APIs de Autenticação
```typescript
export async function POST(req: NextRequest) {
  const secureSupabase = getSecureSupabase({
    enableDatabaseSecurity: true,
    enableSecurityLogging: true,
    maxQueriesPerMinute: 10 // Mais restritivo para auth
  });
  
  const logger = new SecurityLogger(secureSupabase.client);
  
  try {
    // Validar input
    const body = await req.json().catch(() => ({}));
    const validationResult = validateInput(body, LoginSchema);
    
    if (!validationResult.success) {
      await logger.logSecurityEvent({
        type: 'authentication_failed',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { error: 'Invalid login payload' }
      });
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    
    // Detectar atividade suspeita
    const isSuspicious = await secureSupabase.detectSuspiciousActivity(
      JSON.stringify(body), 
      req
    );
    
    if (isSuspicious) {
      await logger.logSecurityEvent({
        type: 'suspicious_activity',
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: { reason: 'Suspicious login attempt' }
      });
      return NextResponse.json({ ok: false, error: "Suspicious activity" }, { status: 400 });
    }
    
    // Continuar com lógica de autenticação...
    
  } catch (error) {
    await logger.logSecurityEvent({
      type: 'api_error',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
```

### APIs CRUD
```typescript
export async function POST(req: NextRequest) {
  const secureSupabase = getSecureSupabase({
    enableDatabaseSecurity: true,
    enableDataProtection: true,
    enableSecurityLogging: true
  });
  
  try {
    // 1. Autenticação
    const user = await secureSupabase.getAuthenticatedUser();
    
    // 2. Validação de input
    const body = await req.json().catch(() => ({}));
    const validationResult = validateInput(body, YourSchema);
    
    if (!validationResult.success) {
      return NextResponse.json({ 
        ok: false, 
        error: "Invalid payload",
        details: validationResult.errors 
      }, { status: 400 });
    }
    
    // 3. Operação segura
    const result = await secureSupabase.secureInsert(
      'your_table',
      {
        ...validationResult.data,
        user_id: user.id,
        created_at: new Date().toISOString()
      },
      req
    );
    
    if (result.error) {
      return NextResponse.json({ ok: false, error: "Failed to create" }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, data: result.data });
    
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
```

### APIs de Consulta
```typescript
export async function GET(req: NextRequest) {
  const secureSupabase = getSecureSupabase({
    enableDatabaseSecurity: true,
    enableDataProtection: true
  });
  
  try {
    // 1. Autenticação (se necessário)
    const user = await secureSupabase.getAuthenticatedUser();
    
    // 2. Validar parâmetros de query
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // Máximo 100
    
    // 3. Consulta segura
    const result = await secureSupabase.secureSelect(
      'your_table',
      {
        select: 'id, name, created_at', // Apenas campos necessários
        filter: { user_id: user.id },
        options: {
          range: [(page - 1) * limit, page * limit - 1]
        }
      },
      req
    );
    
    return NextResponse.json({ 
      ok: true, 
      data: result.data,
      pagination: { page, limit }
    });
    
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
```

## 🛡️ Schemas de Validação Comuns

Crie schemas no arquivo `apps/web/src/lib/security/validation.ts`:

```typescript
// Adicionar ao arquivo de validação existente
export const PredictionSchema = z.object({
  matchId: z.string().uuid(),
  home_pred: z.number().int().min(0).max(20),
  away_pred: z.number().int().min(0).max(20)
});

export const PoolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  is_private: z.boolean().default(false)
});

export const ProfileUpdateSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().optional()
});
```

## 📊 Monitoramento e Relatórios

### Gerar Relatórios de Segurança
```typescript
// Em uma API administrativa
export async function GET(req: NextRequest) {
  const secureSupabase = getSecureSupabase();
  
  try {
    const user = await secureSupabase.getAuthenticatedUser();
    
    // Verificar se é admin
    const profile = await secureSupabase.secureSelect(
      'profiles',
      {
        select: 'role',
        filter: { id: user.id }
      },
      req
    );
    
    if (profile.data?.[0]?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }
    
    // Gerar relatório
    const report = await secureSupabase.generateSecurityReport();
    
    return NextResponse.json({ ok: true, report });
    
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
```

## 🚀 Próximos Passos

1. **Migrar APIs críticas primeiro**: Autenticação, pagamentos, dados sensíveis
2. **Testar cada API migrada**: Verificar funcionalidade e logs de segurança
3. **Monitorar logs**: Acompanhar eventos de segurança no dashboard
4. **Ajustar rate limits**: Baseado no uso real da aplicação
5. **Treinar equipe**: Garantir que todos entendam os novos padrões

## 📝 Exemplo de Migração Completa

Veja o arquivo `apps/web/src/app/api/example/secure-predictions/route.ts` para um exemplo completo de API migrada com todas as medidas de segurança implementadas.

## ⚠️ Pontos de Atenção

- **Performance**: O sistema de segurança adiciona overhead. Monitore a performance
- **Rate Limiting**: Ajuste os limites conforme necessário para cada endpoint
- **Logs**: Os logs de segurança podem crescer rapidamente. Configure limpeza automática
- **Validação**: Seja específico nos schemas para evitar falsos positivos
- **Backward Compatibility**: Teste cuidadosamente para não quebrar funcionalidades existentes