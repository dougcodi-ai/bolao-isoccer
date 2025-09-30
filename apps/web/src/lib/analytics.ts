// Analytics utility para GA4 e Mixpanel
// Eventos definidos no PRD: clicks CTA, view plans, create_bolao_start, purchase_complete, view_booster

interface AnalyticsEvent {
  event: string
  category?: string
  label?: string
  value?: number
  custom_parameters?: Record<string, any>
}

class Analytics {
  private isProduction = process.env.NODE_ENV === 'production'
  private gtag: any
  private mixpanel: any

  constructor() {
    if (typeof window !== 'undefined') {
      this.gtag = (window as any).gtag
      this.mixpanel = (window as any).mixpanel
    }
  }

  // Método principal para enviar eventos
  track(eventName: string, properties: Record<string, any> = {}) {
    if (!this.isProduction) {
      console.log('Analytics Event:', eventName, properties)
      return
    }

    // Google Analytics 4
    if (this.gtag) {
      this.gtag('event', eventName, {
        event_category: properties.category || 'engagement',
        event_label: properties.label,
        value: properties.value,
        ...properties.custom_parameters
      })
    }

    // Mixpanel
    if (this.mixpanel) {
      this.mixpanel.track(eventName, properties)
    }
  }

  // Eventos específicos do PRD
  clickCTA(ctaText: string, location: string) {
    this.track('cta_click', {
      category: 'CTA',
      label: ctaText,
      location: location,
      custom_parameters: {
        cta_text: ctaText,
        cta_location: location
      }
    })
  }

  viewPlans() {
    this.track('view_plans', {
      category: 'Plans',
      label: 'plans_section_viewed'
    })
  }

  createBolaoStart(planType?: string) {
    this.track('create_bolao_start', {
      category: 'Bolao',
      label: 'creation_started',
      custom_parameters: {
        plan_type: planType || 'free'
      }
    })
  }

  purchaseComplete(planId: string, amount: number, currency: string = 'BRL') {
    this.track('purchase_complete', {
      category: 'Purchase',
      label: planId,
      value: amount,
      custom_parameters: {
        plan_id: planId,
        amount: amount,
        currency: currency
      }
    })
  }

  viewBooster(boosterType: string) {
    this.track('view_booster', {
      category: 'Boosters',
      label: boosterType,
      custom_parameters: {
        booster_type: boosterType
      }
    })
  }

  // Eventos de navegação
  pageView(pageName: string, path: string) {
    this.track('page_view', {
      category: 'Navigation',
      label: pageName,
      custom_parameters: {
        page_name: pageName,
        page_path: path
      }
    })
  }

  // Eventos de autenticação
  signupStart(method: string = 'email') {
    this.track('signup_start', {
      category: 'Auth',
      label: method,
      custom_parameters: {
        signup_method: method
      }
    })
  }

  signupComplete(method: string = 'email') {
    this.track('signup_complete', {
      category: 'Auth',
      label: method,
      custom_parameters: {
        signup_method: method
      }
    })
  }

  loginStart(method: string = 'email') {
    this.track('login_start', {
      category: 'Auth',
      label: method,
      custom_parameters: {
        login_method: method
      }
    })
  }

  loginComplete(method: string = 'email') {
    this.track('login_complete', {
      category: 'Auth',
      label: method,
      custom_parameters: {
        login_method: method
      }
    })
  }

  // Eventos de engajamento
  scrollDepth(percentage: number) {
    this.track('scroll_depth', {
      category: 'Engagement',
      label: `${percentage}%`,
      value: percentage,
      custom_parameters: {
        scroll_percentage: percentage
      }
    })
  }

  timeOnPage(seconds: number) {
    this.track('time_on_page', {
      category: 'Engagement',
      label: 'session_duration',
      value: seconds,
      custom_parameters: {
        duration_seconds: seconds
      }
    })
  }

  // Eventos de erro
  error(errorType: string, errorMessage: string) {
    this.track('error', {
      category: 'Error',
      label: errorType,
      custom_parameters: {
        error_type: errorType,
        error_message: errorMessage
      }
    })
  }

  // Identificar usuário (para Mixpanel)
  identify(userId: string, properties: Record<string, any> = {}) {
    if (!this.isProduction) {
      console.log('Analytics Identify:', userId, properties)
      return
    }

    if (this.mixpanel) {
      this.mixpanel.identify(userId)
      this.mixpanel.people.set(properties)
    }
  }

  // Definir propriedades do usuário
  setUserProperties(properties: Record<string, any>) {
    if (!this.isProduction) {
      console.log('Analytics User Properties:', properties)
      return
    }

    if (this.gtag) {
      this.gtag('config', 'GA_MEASUREMENT_ID', {
        custom_map: properties
      })
    }

    if (this.mixpanel) {
      this.mixpanel.people.set(properties)
    }
  }
}

// Instância singleton
export const analytics = new Analytics()

// Hook para usar analytics em componentes React
export function useAnalytics() {
  return analytics
}

// Tipos para TypeScript
export type AnalyticsEventName = 
  | 'cta_click'
  | 'view_plans'
  | 'create_bolao_start'
  | 'purchase_complete'
  | 'view_booster'
  | 'page_view'
  | 'signup_start'
  | 'signup_complete'
  | 'login_start'
  | 'login_complete'
  | 'scroll_depth'
  | 'time_on_page'
  | 'error'