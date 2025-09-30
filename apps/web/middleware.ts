import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rate limiting storage (em produção, usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Configurações de rate limiting
const RATE_LIMITS = {
  api: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 req/15min para APIs
  auth: { requests: 5, windowMs: 15 * 60 * 1000 },  // 5 req/15min para auth
  default: { requests: 200, windowMs: 15 * 60 * 1000 } // 200 req/15min padrão
}

// Headers de segurança
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https: blob:;
    connect-src 'self' https://*.supabase.co https://api.stripe.com;
    frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s+/g, ' ').trim()
}

// Padrões suspeitos
const SUSPICIOUS_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zap/i,
  /burp/i,
  /<script/i,
  /javascript:/i,
  /union\s+select/i,
  /drop\s+table/i,
  /insert\s+into/i,
  /delete\s+from/i
]

function getRateLimitKey(ip: string, path: string): string {
  return `${ip}:${path}`
}

function getRateLimitConfig(path: string) {
  if (path.startsWith('/api/auth/')) return RATE_LIMITS.auth
  if (path.startsWith('/api/')) return RATE_LIMITS.api
  return RATE_LIMITS.default
}

function checkRateLimit(key: string, config: typeof RATE_LIMITS.api): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return true
  }
  
  if (record.count >= config.requests) {
    return false
  }
  
  record.count++
  return true
}

function cleanupRateLimit() {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

function detectSuspiciousActivity(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  const url = request.url
  const referer = request.headers.get('referer') || ''
  
  // Verificar user agent suspeito
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(userAgent))) {
    return true
  }
  
  // Verificar URL suspeita
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(url))) {
    return true
  }
  
  // Verificar referer suspeito
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(referer))) {
    return true
  }
  
  return false
}

async function logSecurityEvent(
  eventType: string,
  ip: string,
  userAgent: string,
  details: any,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  try {
    // Em produção, isso seria feito de forma assíncrona
    console.warn(`🔒 Security Event [${severity.toUpperCase()}]: ${eventType}`, {
      ip,
      userAgent: userAgent.substring(0, 200),
      details,
      timestamp: new Date().toISOString()
    })
    
    // Aqui você pode integrar com o sistema de logs de segurança
    // await securityLogger.logSecurityEvent(...)
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// Limpar rate limit store periodicamente
setInterval(cleanupRateLimit, 5 * 60 * 1000) // A cada 5 minutos



export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  // Detectar atividade suspeita
  if (detectSuspiciousActivity(request)) {
    await logSecurityEvent(
      'suspicious_activity',
      ip,
      userAgent,
      { 
        path: pathname,
        method: request.method,
        url: request.url
      },
      'high'
    )
    
    return new NextResponse('Forbidden', { 
      status: 403,
      headers: SECURITY_HEADERS
    })
  }

  // Rate limiting
  const rateLimitKey = getRateLimitKey(ip, pathname)
  const rateLimitConfig = getRateLimitConfig(pathname)
  
  if (!checkRateLimit(rateLimitKey, rateLimitConfig)) {
    await logSecurityEvent(
      'rate_limit_exceeded',
      ip,
      userAgent,
      { 
        path: pathname,
        limit: rateLimitConfig.requests,
        window: rateLimitConfig.windowMs
      },
      'medium'
    )
    
    return new NextResponse('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': Math.ceil(rateLimitConfig.windowMs / 1000).toString(),
        ...SECURITY_HEADERS
      }
    })
  }

  // Verificar autenticação para rotas protegidas
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      await logSecurityEvent(
        'unauthorized_access',
        ip,
        userAgent,
        { path: pathname, reason: 'missing_token' },
        'medium'
      )
      
      return new NextResponse('Unauthorized', { 
        status: 401,
        headers: SECURITY_HEADERS
      })
    }

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        await logSecurityEvent(
          'auth_failed',
          ip,
          userAgent,
          { path: pathname, reason: 'invalid_token', error: error?.message },
          'medium'
        )
        
        return new NextResponse('Invalid token', { 
          status: 401,
          headers: SECURITY_HEADERS
        })
      }
      
      // Log acesso bem-sucedido para APIs sensíveis
      if (pathname.includes('/admin/') || pathname.includes('/stripe/')) {
        await logSecurityEvent(
          'data_access',
          ip,
          userAgent,
          { 
            path: pathname,
            userId: user.id,
            action: 'api_access'
          },
          'low'
        )
      }
      
      // Adicionar user ID ao header para uso nas APIs
      const response = NextResponse.next()
      response.headers.set('x-user-id', user.id)
      
      // Aplicar headers de segurança
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      return response
    } catch (error) {
      await logSecurityEvent(
        'auth_failed',
        ip,
        userAgent,
        { path: pathname, reason: 'auth_error', error: String(error) },
        'high'
      )
      
      return new NextResponse('Authentication error', { 
        status: 500,
        headers: SECURITY_HEADERS
      })
    }
  }

  // Verificar autenticação para páginas protegidas
  const protectedPages = ['/dashboard', '/bolao', '/profile', '/admin']
  const isProtectedPage = protectedPages.some(page => pathname.startsWith(page))
  
  if (isProtectedPage) {
    const token = request.cookies.get('sb-access-token')?.value
    
    if (!token) {
      await logSecurityEvent(
        'unauthorized_access',
        ip,
        userAgent,
        { path: pathname, reason: 'missing_session' },
        'low'
      )
      
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        await logSecurityEvent(
          'auth_failed',
          ip,
          userAgent,
          { path: pathname, reason: 'invalid_session' },
          'low'
        )
        
        return NextResponse.redirect(new URL('/auth/login', request.url))
      }
      
      // Log acesso a páginas administrativas
      if (pathname.startsWith('/admin/')) {
        await logSecurityEvent(
          'admin_action',
          ip,
          userAgent,
          { 
            path: pathname,
            userId: user.id,
            action: 'page_access'
          },
          'medium'
        )
      }
    } catch (error) {
      await logSecurityEvent(
        'auth_failed',
        ip,
        userAgent,
        { path: pathname, reason: 'session_error', error: String(error) },
        'medium'
      )
      
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  // Aplicar headers de segurança para todas as respostas
  const response = NextResponse.next()
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}