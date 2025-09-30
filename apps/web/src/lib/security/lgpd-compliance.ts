import { createClient } from '@supabase/supabase-js'
import { DataProtection } from './data-protection'

// Tipos de consentimento LGPD
export type ConsentType = 
  | 'essential'      // Funcionalidades essenciais
  | 'analytics'      // Análise e métricas
  | 'marketing'      // Marketing e comunicação
  | 'personalization' // Personalização de experiência
  | 'third_party'    // Compartilhamento com terceiros

export interface ConsentRecord {
  id?: string
  user_id: string
  consent_type: ConsentType
  granted: boolean
  granted_at?: string
  revoked_at?: string
  ip_address: string
  user_agent: string
  version: string // Versão da política de privacidade
  purpose: string // Finalidade específica
  legal_basis: string // Base legal (consentimento, interesse legítimo, etc.)
}

export interface DataProcessingRecord {
  id?: string
  user_id: string
  data_type: string
  processing_purpose: string
  legal_basis: string
  retention_period: string
  third_parties?: string[]
  created_at?: string
}

export interface DataSubjectRequest {
  id?: string
  user_id: string
  request_type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection'
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  requested_at: string
  completed_at?: string
  details?: string
  response?: string
}

class LGPDCompliance {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Registrar consentimento
  async recordConsent(consent: Omit<ConsentRecord, 'id' | 'granted_at'>) {
    try {
      const consentRecord: ConsentRecord = {
        ...consent,
        granted_at: consent.granted ? new Date().toISOString() : undefined,
        revoked_at: !consent.granted ? new Date().toISOString() : undefined
      }

      const { data, error } = await this.supabase
        .from('lgpd_consents')
        .insert(consentRecord)
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Failed to record consent:', error)
      return { success: false, error }
    }
  }

  // Obter consentimentos do usuário
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('lgpd_consents')
        .select('*')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Failed to get user consents:', error)
      return []
    }
  }

  // Verificar se usuário deu consentimento específico
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('lgpd_consents')
        .select('granted, revoked_at')
        .eq('user_id', userId)
        .eq('consent_type', consentType)
        .order('granted_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return false

      // Se foi revogado, não tem consentimento
      if (data.revoked_at) return false

      return data.granted
    } catch (error) {
      return false
    }
  }

  // Revogar consentimento
  async revokeConsent(userId: string, consentType: ConsentType, ip: string, userAgent: string) {
    try {
      // Registrar revogação
      await this.recordConsent({
        user_id: userId,
        consent_type: consentType,
        granted: false,
        ip_address: ip,
        user_agent: userAgent,
        version: '1.0',
        purpose: 'Revogação de consentimento',
        legal_basis: 'Direito do titular'
      })

      // Executar ações de revogação baseadas no tipo
      await this.executeConsentRevocation(userId, consentType)

      return { success: true }
    } catch (error) {
      console.error('Failed to revoke consent:', error)
      return { success: false, error }
    }
  }

  // Executar ações quando consentimento é revogado
  private async executeConsentRevocation(userId: string, consentType: ConsentType) {
    switch (consentType) {
      case 'analytics':
        // Parar coleta de dados analíticos
        await this.stopAnalyticsCollection(userId)
        break
      case 'marketing':
        // Remover de listas de marketing
        await this.removeFromMarketing(userId)
        break
      case 'personalization':
        // Limpar dados de personalização
        await this.clearPersonalizationData(userId)
        break
      case 'third_party':
        // Notificar terceiros sobre revogação
        await this.notifyThirdParties(userId)
        break
    }
  }

  // Registrar processamento de dados
  async recordDataProcessing(processing: Omit<DataProcessingRecord, 'id' | 'created_at'>) {
    try {
      const { data, error } = await this.supabase
        .from('lgpd_data_processing')
        .insert({
          ...processing,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return { success: true, data }
    } catch (error) {
      console.error('Failed to record data processing:', error)
      return { success: false, error }
    }
  }

  // Criar solicitação de titular de dados
  async createDataSubjectRequest(request: Omit<DataSubjectRequest, 'id' | 'requested_at' | 'status'>) {
    try {
      const { data, error } = await this.supabase
        .from('lgpd_data_subject_requests')
        .insert({
          ...request,
          status: 'pending',
          requested_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      // Notificar equipe de privacidade
      await this.notifyPrivacyTeam(data)

      return { success: true, data }
    } catch (error) {
      console.error('Failed to create data subject request:', error)
      return { success: false, error }
    }
  }

  // Processar solicitação de acesso aos dados
  async processAccessRequest(userId: string): Promise<any> {
    try {
      // Coletar todos os dados do usuário
      const userData = await this.collectUserData(userId)
      
      // Mascarar dados sensíveis de terceiros
      const sanitizedData = DataProtection.sanitizeApiResponse(userData, 'user')
      
      return {
        user_profile: sanitizedData.profile,
        pools: sanitizedData.pools,
        predictions: sanitizedData.predictions,
        purchases: sanitizedData.purchases,
        consents: sanitizedData.consents,
        processing_records: sanitizedData.processing,
        generated_at: new Date().toISOString(),
        retention_info: await this.getRetentionInfo(userId)
      }
    } catch (error) {
      console.error('Failed to process access request:', error)
      throw error
    }
  }

  // Processar solicitação de apagamento
  async processErasureRequest(userId: string): Promise<{ success: boolean; details: string[] }> {
    const details: string[] = []
    
    try {
      // Verificar se há obrigações legais que impedem o apagamento
      const legalObligations = await this.checkLegalObligations(userId)
      
      if (legalObligations.length > 0) {
        return {
          success: false,
          details: [`Apagamento impedido por obrigações legais: ${legalObligations.join(', ')}`]
        }
      }

      // Anonimizar dados em vez de apagar completamente (para manter integridade)
      await this.anonymizeUserData(userId)
      details.push('Dados pessoais anonimizados')

      // Marcar conta como apagada
      await this.supabase
        .from('profiles')
        .update({
          email: `deleted_${userId}@deleted.local`,
          display_name: 'Usuário Removido',
          avatar_url: null,
          deleted_at: new Date().toISOString()
        })
        .eq('id', userId)

      details.push('Perfil marcado como removido')

      // Registrar o apagamento
      await this.recordDataProcessing({
        user_id: userId,
        data_type: 'all_personal_data',
        processing_purpose: 'Exercício do direito ao apagamento',
        legal_basis: 'Solicitação do titular',
        retention_period: 'N/A - dados apagados'
      })

      return { success: true, details }
    } catch (error) {
      console.error('Failed to process erasure request:', error)
      return { success: false, details: ['Erro interno no processamento'] }
    }
  }

  // Coletar todos os dados do usuário
  private async collectUserData(userId: string) {
    const [profile, pools, predictions, purchases, consents, processing] = await Promise.all([
      this.supabase.from('profiles').select('*').eq('id', userId).single(),
      this.supabase.from('pools').select('*').eq('owner_id', userId),
      this.supabase.from('predictions').select('*').eq('user_id', userId),
      this.supabase.from('booster_purchases').select('*').eq('user_id', userId),
      this.supabase.from('lgpd_consents').select('*').eq('user_id', userId),
      this.supabase.from('lgpd_data_processing').select('*').eq('user_id', userId)
    ])

    return {
      profile: profile.data,
      pools: pools.data,
      predictions: predictions.data,
      purchases: purchases.data,
      consents: consents.data,
      processing: processing.data
    }
  }

  // Verificar obrigações legais
  private async checkLegalObligations(userId: string): Promise<string[]> {
    const obligations: string[] = []

    // Verificar transações financeiras recentes
    const { data: recentPurchases } = await this.supabase
      .from('booster_purchases')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString()) // 5 anos

    if (recentPurchases && recentPurchases.length > 0) {
      obligations.push('Retenção obrigatória para fins fiscais (5 anos)')
    }

    // Verificar disputas ou processos em andamento
    // (implementar conforme necessário)

    return obligations
  }

  // Anonimizar dados do usuário
  private async anonymizeUserData(userId: string) {
    const anonymizedId = `anon_${DataProtection.generateSecureToken(16)}`

    // Anonimizar referências em outras tabelas
    const tables = ['predictions', 'booster_purchases', 'pool_members']
    
    for (const table of tables) {
      await this.supabase
        .from(table)
        .update({ user_id: anonymizedId })
        .eq('user_id', userId)
    }
  }

  // Obter informações de retenção
  private async getRetentionInfo(userId: string) {
    return {
      profile_data: '2 anos após inatividade',
      financial_data: '5 anos (obrigação legal)',
      analytics_data: '1 ano',
      marketing_data: 'Até revogação do consentimento',
      logs_security: '90 dias'
    }
  }

  // Parar coleta de analytics
  private async stopAnalyticsCollection(userId: string) {
    // Implementar integração com Google Analytics, etc.
    console.log(`Analytics collection stopped for user ${userId}`)
  }

  // Remover de marketing
  private async removeFromMarketing(userId: string) {
    // Implementar integração com ferramentas de email marketing
    console.log(`User ${userId} removed from marketing lists`)
  }

  // Limpar dados de personalização
  private async clearPersonalizationData(userId: string) {
    // Limpar preferências, histórico, etc.
    console.log(`Personalization data cleared for user ${userId}`)
  }

  // Notificar terceiros
  private async notifyThirdParties(userId: string) {
    // Notificar parceiros sobre revogação de consentimento
    console.log(`Third parties notified about consent revocation for user ${userId}`)
  }

  // Notificar equipe de privacidade
  private async notifyPrivacyTeam(request: DataSubjectRequest) {
    // Implementar notificação (email, Slack, etc.)
    console.log('Privacy team notified about new data subject request:', request)
  }

  // Verificar se precisa de consentimento para ação
  static requiresConsent(action: string): ConsentType | null {
    const consentMap: Record<string, ConsentType> = {
      'analytics_tracking': 'analytics',
      'email_marketing': 'marketing',
      'personalized_content': 'personalization',
      'third_party_sharing': 'third_party'
    }

    return consentMap[action] || null
  }

  // Gerar relatório de conformidade
  async generateComplianceReport(startDate: string, endDate: string) {
    try {
      const [consents, requests, processing] = await Promise.all([
        this.supabase
          .from('lgpd_consents')
          .select('consent_type, granted')
          .gte('granted_at', startDate)
          .lte('granted_at', endDate),
        
        this.supabase
          .from('lgpd_data_subject_requests')
          .select('request_type, status')
          .gte('requested_at', startDate)
          .lte('requested_at', endDate),
        
        this.supabase
          .from('lgpd_data_processing')
          .select('data_type, processing_purpose')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
      ])

      return {
        period: { startDate, endDate },
        consents: this.aggregateConsents(consents.data || []),
        dataSubjectRequests: this.aggregateRequests(requests.data || []),
        dataProcessing: this.aggregateProcessing(processing.data || []),
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to generate compliance report:', error)
      throw error
    }
  }

  private aggregateConsents(consents: any[]) {
    return consents.reduce((acc, consent) => {
      const type = consent.consent_type
      if (!acc[type]) acc[type] = { granted: 0, revoked: 0 }
      
      if (consent.granted) {
        acc[type].granted++
      } else {
        acc[type].revoked++
      }
      
      return acc
    }, {})
  }

  private aggregateRequests(requests: any[]) {
    return requests.reduce((acc, request) => {
      const type = request.request_type
      const status = request.status
      
      if (!acc[type]) acc[type] = {}
      if (!acc[type][status]) acc[type][status] = 0
      
      acc[type][status]++
      
      return acc
    }, {})
  }

  private aggregateProcessing(processing: any[]) {
    return processing.reduce((acc, proc) => {
      const purpose = proc.processing_purpose
      if (!acc[purpose]) acc[purpose] = 0
      acc[purpose]++
      return acc
    }, {})
  }
}

// Instância singleton
export const lgpdCompliance = new LGPDCompliance()

// Hook para verificar consentimento
export async function checkConsent(userId: string, action: string): Promise<boolean> {
  const requiredConsent = LGPDCompliance.requiresConsent(action)
  
  if (!requiredConsent) {
    return true // Não requer consentimento
  }
  
  return await lgpdCompliance.hasConsent(userId, requiredConsent)
}