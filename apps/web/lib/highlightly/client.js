// Cliente da API Highlightly com rate limiting e cache
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class HighlightlyClient {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.apiHost = 'sport-highlights-api.p.rapidapi.com';
    this.baseUrl = 'https://sport-highlights-api.p.rapidapi.com';
    
    // Rate limiting: 25 requests/hora, mínimo 5 minutos entre requests
    this.maxRequestsPerHour = 25;
    this.minIntervalMinutes = 5;
    
    if (!this.apiKey) {
      console.warn('⚠️ RAPIDAPI_KEY não configurada - modo cache apenas');
    }
  }

  /**
   * Verifica se o usuário pode fazer uma nova requisição
   */
  async checkRateLimit(userId) {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - this.minIntervalMinutes * 60 * 1000);

      // Verificar requests na última hora
      const { data: hourlyRequests, error: hourlyError } = await supabase
        .from('api_requests_log')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });

      if (hourlyError) throw hourlyError;

      // Verificar se excedeu limite por hora
      if (hourlyRequests.length >= this.maxRequestsPerHour) {
        return {
          allowed: false,
          reason: 'rate_limit_hour',
          message: `Limite de ${this.maxRequestsPerHour} requisições por hora excedido`,
          nextAllowedAt: new Date(hourlyRequests[0].created_at).getTime() + 60 * 60 * 1000
        };
      }

      // Verificar intervalo mínimo
      if (hourlyRequests.length > 0) {
        const lastRequest = new Date(hourlyRequests[0].created_at);
        if (lastRequest > fiveMinutesAgo) {
          return {
            allowed: false,
            reason: 'rate_limit_interval',
            message: `Aguarde ${this.minIntervalMinutes} minutos entre requisições`,
            nextAllowedAt: lastRequest.getTime() + this.minIntervalMinutes * 60 * 1000
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Erro ao verificar rate limit:', error);
      return { allowed: false, reason: 'error', message: 'Erro interno' };
    }
  }

  /**
   * Registra uma requisição no log
   */
  async logRequest(userId, endpoint, success, responseData = null, error = null) {
    try {
      await supabase
        .from('api_requests_log')
        .insert({
          user_id: userId,
          endpoint,
          success,
          response_data: responseData,
          error_message: error?.message,
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }
  }

  /**
   * Busca dados do cache
   */
  async getFromCache(cacheKey, maxAgeMinutes = 60) {
    try {
      const maxAge = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
      
      const { data, error } = await supabase
        .from('api_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gte('created_at', maxAge.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        console.log(`📦 Cache hit para: ${cacheKey}`);
        return data[0].data;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar cache:', error);
      return null;
    }
  }

  /**
   * Salva dados no cache
   */
  async saveToCache(cacheKey, data) {
    try {
      // Remove cache antigo da mesma chave
      await supabase
        .from('api_cache')
        .delete()
        .eq('cache_key', cacheKey);

      // Salva novo cache
      await supabase
        .from('api_cache')
        .insert({
          cache_key: cacheKey,
          data,
          created_at: new Date().toISOString()
        });

      console.log(`💾 Cache salvo para: ${cacheKey}`);
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  }

  /**
   * Faz requisição para a API com rate limiting e cache
   */
  async makeRequest(endpoint, userId, cacheKey = null, cacheMaxAge = 60) {
    try {
      // 1. Verificar cache primeiro
      if (cacheKey) {
        const cachedData = await this.getFromCache(cacheKey, cacheMaxAge);
        if (cachedData) {
          return { success: true, data: cachedData, fromCache: true };
        }
      }

      // 2. Verificar rate limiting
      const rateLimitCheck = await this.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        return { 
          success: false, 
          error: rateLimitCheck.reason,
          message: rateLimitCheck.message,
          nextAllowedAt: rateLimitCheck.nextAllowedAt
        };
      }

      // 3. Fazer requisição para API
      if (!this.apiKey) {
        throw new Error('API key não configurada');
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.apiHost
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // 4. Salvar no cache
      if (cacheKey) {
        await this.saveToCache(cacheKey, data);
      }

      // 5. Registrar log de sucesso
      await this.logRequest(userId, endpoint, true, data);

      return { success: true, data, fromCache: false };

    } catch (error) {
      console.error(`Erro na requisição ${endpoint}:`, error);
      
      // Registrar log de erro
      await this.logRequest(userId, endpoint, false, null, error);
      
      return { 
        success: false, 
        error: 'api_error',
        message: error.message 
      };
    }
  }

  /**
   * Busca países disponíveis
   */
  async getCountries(userId) {
    return this.makeRequest(
      '/football/countries',
      userId,
      'countries',
      24 * 60 // Cache por 24 horas
    );
  }

  /**
   * Busca ligas de um país
   */
  async getLeagues(userId, countryCode = null, countryName = null) {
    let endpoint = '/football/leagues?limit=100';
    let cacheKey = 'leagues_all';
    
    if (countryCode) {
      endpoint += `&countryCode=${countryCode}`;
      cacheKey = `leagues_${countryCode}`;
    } else if (countryName) {
      endpoint += `&countryName=${encodeURIComponent(countryName)}`;
      cacheKey = `leagues_${countryName.toLowerCase()}`;
    }

    return this.makeRequest(
      endpoint,
      userId,
      cacheKey,
      12 * 60 // Cache por 12 horas
    );
  }

  /**
   * Busca partidas de uma liga
   */
  async getMatches(userId, leagueId, limit = 50) {
    return this.makeRequest(
      `/football/matches?leagueId=${leagueId}&limit=${limit}`,
      userId,
      `matches_${leagueId}`,
      30 // Cache por 30 minutos para dados mais dinâmicos
    );
  }

  /**
   * Busca classificação de uma liga
   */
  async getStandings(userId, leagueId, season = null) {
    let endpoint = `/football/standings?leagueId=${leagueId}`;
    let cacheKey = `standings_${leagueId}`;
    
    if (season) {
      endpoint += `&season=${season}`;
      cacheKey += `_${season}`;
    }

    return this.makeRequest(
      endpoint,
      userId,
      cacheKey,
      60 // Cache por 1 hora
    );
  }

  /**
   * Busca ligas brasileiras específicas
   */
  async getBrazilianLeagues(userId) {
    const result = await this.getLeagues(userId, 'BR', 'Brazil');
    
    if (result.success) {
      // Filtrar ligas brasileiras importantes
      const importantLeagues = result.data.data?.filter(league => {
        const name = league.name.toLowerCase();
        return (
          name.includes('brasileiro') ||
          name.includes('copa do brasil') ||
          name.includes('libertadores') ||
          name.includes('sulamericana') ||
          name.includes('série a') ||
          name.includes('série b')
        );
      }) || [];

      return { ...result, data: { ...result.data, data: importantLeagues } };
    }

    return result;
  }

  /**
   * Limpa cache antigo (executar periodicamente)
   */
  async cleanOldCache(maxAgeHours = 24) {
    try {
      const maxAge = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      await supabase
        .from('api_cache')
        .delete()
        .lt('created_at', maxAge.toISOString());

      console.log('🧹 Cache antigo limpo');
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  }
}

export default HighlightlyClient;