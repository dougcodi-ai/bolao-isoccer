import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'

// Schemas de validação
export const schemas = {
  // Autenticação
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(128),
  
  // Bolões
  poolName: z.string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome contém caracteres inválidos'),
  
  poolCode: z.string()
    .length(6, 'Código deve ter exatamente 6 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Código deve conter apenas letras maiúsculas e números'),
  
  // Palpites
  score: z.number().int().min(0).max(20, 'Placar deve estar entre 0 e 20'),
  
  // IDs
  uuid: z.string().uuid('ID inválido'),
  
  // Texto geral
  displayName: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(30, 'Nome deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome contém caracteres inválidos'),
  
  // Boosters
  boosterType: z.enum(['segunda_chance', 'o_esquecido', 'auto_pick', 'o_escudo']),
  boosterQuantity: z.number().int().min(1).max(10),
  
  // Stripe
  priceKey: z.enum(['p1', 'p3', 'p5']),
  planKey: z.enum(['craque', 'lenda', 'fenomeno', 'galera']),
  
  // Paginação
  page: z.number().int().min(1).max(1000),
  limit: z.number().int().min(1).max(100),
  
  // Filtros
  status: z.enum(['active', 'finished', 'pending']).optional(),
  championship: z.string().max(100).optional()
}

// Função de sanitização de HTML
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}

// Função de sanitização de SQL (escape básico)
export function sanitizeSql(input: string): string {
  return input.replace(/['";\\]/g, '')
}

// Validação de entrada com sanitização
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  sanitize = true
): { success: true; data: T } | { success: false; error: string } {
  try {
    // Sanitizar strings se solicitado
    if (sanitize && typeof input === 'object' && input !== null) {
      input = sanitizeObject(input)
    }
    
    const result = schema.safeParse(input)
    
    if (!result.success) {
      const errors = result.error.errors.map(e => e.message).join(', ')
      return { success: false, error: errors }
    }
    
    return { success: true, data: result.data }
  } catch (error) {
    return { success: false, error: 'Erro de validação' }
  }
}

// Sanitizar objeto recursivamente
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}

// Validação de headers de segurança
export function validateSecurityHeaders(headers: Headers): boolean {
  const userAgent = headers.get('user-agent')
  const origin = headers.get('origin')
  
  // Bloquear user agents suspeitos
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
    /burp/i
  ]
  
  if (userAgent && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return false
  }
  
  // Validar origem se presente
  if (origin) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      process.env.NEXT_PUBLIC_APP_URL
    ].filter(Boolean)
    
    if (!allowedOrigins.includes(origin)) {
      return false
    }
  }
  
  return true
}

// Validação de IP
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

// Detectar tentativas de SQL injection
export function detectSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(--|\/\*|\*\/)/,
    /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR)\b)/i,
    /(<script|<iframe|<object|<embed)/i
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

// Detectar tentativas de XSS
export function detectXss(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
    /<svg[^>]*>/gi
  ]
  
  return xssPatterns.some(pattern => pattern.test(input))
}

// Validação completa de entrada
export function validateInput(input: string, type: 'text' | 'email' | 'url' = 'text'): {
  valid: boolean
  sanitized: string
  threats: string[]
} {
  const threats: string[] = []
  
  // Detectar ameaças
  if (detectSqlInjection(input)) {
    threats.push('SQL Injection')
  }
  
  if (detectXss(input)) {
    threats.push('XSS')
  }
  
  // Sanitizar
  let sanitized = sanitizeHtml(input)
  
  // Validações específicas por tipo
  switch (type) {
    case 'email':
      const emailResult = schemas.email.safeParse(sanitized)
      if (!emailResult.success) {
        threats.push('Email inválido')
      }
      break
    case 'url':
      try {
        new URL(sanitized)
      } catch {
        threats.push('URL inválida')
      }
      break
  }
  
  return {
    valid: threats.length === 0,
    sanitized,
    threats
  }
}

// Middleware de validação para APIs
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (input: unknown) => {
    const result = validateAndSanitize(schema, input)
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error}`)
    }
    return result.data
  }
}