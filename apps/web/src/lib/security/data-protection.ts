import crypto from 'crypto'

// Campos sensíveis que devem ser protegidos
const SENSITIVE_FIELDS = [
  'password',
  'email',
  'phone',
  'cpf',
  'credit_card',
  'stripe_customer_id',
  'stripe_session_id',
  'api_key',
  'secret',
  'token',
  'private_key'
]

// Padrões de dados sensíveis
const SENSITIVE_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  phone: /\b(?:\+55\s?)?(?:\(\d{2}\)\s?)?\d{4,5}-?\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  apiKey: /\b[A-Za-z0-9]{32,}\b/g,
  jwt: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
}

// Chave de criptografia (em produção, usar variável de ambiente)
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || crypto.randomBytes(32)
const ALGORITHM = 'aes-256-gcm'

export class DataProtection {
  // Criptografar dados sensíveis
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    }
  }

  // Descriptografar dados
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY)
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'))
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  // Mascarar dados sensíveis para logs
  static maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      return this.maskString(data)
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item))
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked: any = {}
      
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          masked[key] = this.maskValue(value)
        } else {
          masked[key] = this.maskSensitiveData(value)
        }
      }
      
      return masked
    }
    
    return data
  }

  // Verificar se um campo é sensível
  private static isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase()
    return SENSITIVE_FIELDS.some(sensitive => 
      lowerField.includes(sensitive) || sensitive.includes(lowerField)
    )
  }

  // Mascarar valor
  private static maskValue(value: any): string {
    if (typeof value !== 'string') {
      return '[MASKED]'
    }
    
    if (value.length <= 4) {
      return '*'.repeat(value.length)
    }
    
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
  }

  // Mascarar string com padrões sensíveis
  private static maskString(text: string): string {
    let masked = text
    
    // Mascarar emails
    masked = masked.replace(SENSITIVE_PATTERNS.email, (match) => {
      const [local, domain] = match.split('@')
      return `${local.substring(0, 2)}***@${domain}`
    })
    
    // Mascarar CPFs
    masked = masked.replace(SENSITIVE_PATTERNS.cpf, '***.***.***-**')
    
    // Mascarar telefones
    masked = masked.replace(SENSITIVE_PATTERNS.phone, '(**) ****-****')
    
    // Mascarar cartões de crédito
    masked = masked.replace(SENSITIVE_PATTERNS.creditCard, '**** **** **** ****')
    
    // Mascarar API keys
    masked = masked.replace(SENSITIVE_PATTERNS.apiKey, '[API_KEY_MASKED]')
    
    // Mascarar JWTs
    masked = masked.replace(SENSITIVE_PATTERNS.jwt, '[JWT_MASKED]')
    
    return masked
  }

  // Sanitizar dados para resposta da API
  static sanitizeApiResponse(data: any, userRole: string = 'user'): any {
    if (typeof data === 'string') {
      return data
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeApiResponse(item, userRole))
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {}
      
      for (const [key, value] of Object.entries(data)) {
        // Remover campos sensíveis baseado no papel do usuário
        if (this.shouldRemoveField(key, userRole)) {
          continue
        }
        
        sanitized[key] = this.sanitizeApiResponse(value, userRole)
      }
      
      return sanitized
    }
    
    return data
  }

  // Verificar se campo deve ser removido baseado no papel do usuário
  private static shouldRemoveField(fieldName: string, userRole: string): boolean {
    const adminOnlyFields = [
      'stripe_customer_id',
      'stripe_session_id',
      'payment_method_id',
      'internal_notes',
      'admin_flags'
    ]
    
    const sensitiveFields = [
      'password',
      'password_hash',
      'api_key',
      'secret',
      'private_key'
    ]
    
    // Sempre remover campos altamente sensíveis
    if (sensitiveFields.some(field => fieldName.toLowerCase().includes(field))) {
      return true
    }
    
    // Remover campos admin-only para usuários não-admin
    if (userRole !== 'admin' && adminOnlyFields.some(field => fieldName.toLowerCase().includes(field))) {
      return true
    }
    
    return false
  }

  // Detectar vazamento de dados em logs
  static detectDataLeak(logMessage: string): {
    hasLeak: boolean
    leakTypes: string[]
    sanitizedMessage: string
  } {
    const leakTypes: string[] = []
    let sanitizedMessage = logMessage
    
    // Verificar cada padrão sensível
    Object.entries(SENSITIVE_PATTERNS).forEach(([type, pattern]) => {
      if (pattern.test(logMessage)) {
        leakTypes.push(type)
      }
    })
    
    // Sanitizar a mensagem
    sanitizedMessage = this.maskString(logMessage)
    
    return {
      hasLeak: leakTypes.length > 0,
      leakTypes,
      sanitizedMessage
    }
  }

  // Hash de dados para comparação sem exposição
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  // Gerar token seguro
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  // Validar força de senha
  static validatePasswordStrength(password: string): {
    isStrong: boolean
    score: number
    feedback: string[]
  } {
    const feedback: string[] = []
    let score = 0
    
    // Comprimento mínimo
    if (password.length >= 8) {
      score += 1
    } else {
      feedback.push('Senha deve ter pelo menos 8 caracteres')
    }
    
    // Letras minúsculas
    if (/[a-z]/.test(password)) {
      score += 1
    } else {
      feedback.push('Adicione letras minúsculas')
    }
    
    // Letras maiúsculas
    if (/[A-Z]/.test(password)) {
      score += 1
    } else {
      feedback.push('Adicione letras maiúsculas')
    }
    
    // Números
    if (/\d/.test(password)) {
      score += 1
    } else {
      feedback.push('Adicione números')
    }
    
    // Caracteres especiais
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 1
    } else {
      feedback.push('Adicione caracteres especiais')
    }
    
    // Verificar padrões comuns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i
    ]
    
    if (commonPatterns.some(pattern => pattern.test(password))) {
      score -= 2
      feedback.push('Evite padrões comuns')
    }
    
    return {
      isStrong: score >= 4,
      score: Math.max(0, score),
      feedback
    }
  }

  // Limpar dados sensíveis da memória
  static clearSensitiveData(obj: any): void {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (this.isSensitiveField(key)) {
          obj[key] = null
        }
      })
    }
  }

  // Verificar se dados contêm informações pessoais (LGPD)
  static containsPersonalData(data: any): boolean {
    const personalDataFields = [
      'email',
      'name',
      'phone',
      'cpf',
      'address',
      'birth_date',
      'ip_address'
    ]
    
    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).some(key => 
        personalDataFields.some(field => 
          key.toLowerCase().includes(field)
        )
      )
    }
    
    return false
  }
}

// Middleware para proteção de dados em APIs
export function createDataProtectionMiddleware() {
  return {
    // Sanitizar request
    sanitizeRequest: (req: any, userRole: string = 'user') => {
      if (req.body) {
        req.body = DataProtection.sanitizeApiResponse(req.body, userRole)
      }
      return req
    },
    
    // Sanitizar response
    sanitizeResponse: (res: any, userRole: string = 'user') => {
      return DataProtection.sanitizeApiResponse(res, userRole)
    },
    
    // Log seguro
    secureLog: (message: string, data?: any) => {
      const leak = DataProtection.detectDataLeak(message)
      
      if (leak.hasLeak) {
        console.warn('🔒 Data leak detected in log:', leak.leakTypes)
        console.log(leak.sanitizedMessage)
        
        if (data) {
          console.log(DataProtection.maskSensitiveData(data))
        }
      } else {
        console.log(message)
        if (data) {
          console.log(data)
        }
      }
    }
  }
}