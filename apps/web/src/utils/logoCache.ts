// Sistema de cache local para logos dos times
import teamLogoMap from '../../../../src/data/teamLogoMap.json';

interface CachedLogo {
  url: string;
  timestamp: number;
  blob?: Blob;
}

class LogoCache {
  private cache: Map<string, CachedLogo> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas
  private readonly MAX_CACHE_SIZE = 100; // Máximo de 100 logos em cache

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Obter logo do time com cache
   */
  async getTeamLogo(teamName: string): Promise<string> {
    if (!teamName) return this.getDefaultLogo(teamName);

    // Normalizar nome do time para busca
    const normalizedName = this.normalizeTeamName(teamName);
    
    // Buscar no mapeamento estático primeiro
    const staticUrl = this.getStaticLogoUrl(normalizedName);
    if (staticUrl) {
      return staticUrl;
    }

    // Buscar no cache
    const cached = this.cache.get(normalizedName);
    if (cached && this.isCacheValid(cached)) {
      return cached.url;
    }

    // Se não encontrou, retornar logo padrão
    return this.getDefaultLogo(teamName);
  }

  /**
   * Buscar logo no mapeamento estático
   */
  private getStaticLogoUrl(normalizedName: string): string | null {
    const logoMap = teamLogoMap as Record<string, string>;
    
    // Tentar várias variações do nome
    const variations = [
      normalizedName,
      normalizedName.toUpperCase(),
      normalizedName.toLowerCase(),
      normalizedName.replace(/\s+/g, ''),
      normalizedName.replace(/FC|EC|SC|CR|SE/gi, '').trim(),
      normalizedName.replace(/\s+(FC|EC|SC|CR|SE)$/gi, '').trim()
    ];

    for (const variation of variations) {
      if (logoMap[variation]) {
        return logoMap[variation];
      }
    }

    return null;
  }

  /**
   * Normalizar nome do time
   */
  private normalizeTeamName(teamName: string): string {
    return teamName
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  }

  /**
   * Verificar se cache é válido
   */
  private isCacheValid(cached: CachedLogo): boolean {
    return Date.now() - cached.timestamp < this.CACHE_DURATION;
  }

  /**
   * Gerar logo padrão
   */
  private getDefaultLogo(teamName: string): string {
    const initial = teamName?.charAt(0)?.toUpperCase() || '?';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=1f2937&color=ffffff&size=128&bold=true`;
  }

  /**
   * Adicionar logo ao cache
   */
  addToCache(teamName: string, url: string): void {
    const normalizedName = this.normalizeTeamName(teamName);
    
    // Limpar cache se estiver muito grande
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.clearOldestEntries();
    }

    this.cache.set(normalizedName, {
      url,
      timestamp: Date.now()
    });

    this.saveToLocalStorage();
  }

  /**
   * Limpar entradas mais antigas
   */
  private clearOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remover 20% das entradas mais antigas
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Carregar cache do localStorage
   */
  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('teamLogoCache');
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(data);
      }
    } catch (error) {
      console.warn('Erro ao carregar cache de logos:', error);
    }
  }

  /**
   * Salvar cache no localStorage
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data = Array.from(this.cache.entries());
      localStorage.setItem('teamLogoCache', JSON.stringify(data));
    } catch (error) {
      console.warn('Erro ao salvar cache de logos:', error);
    }
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('teamLogoCache');
    }
  }

  /**
   * Obter estatísticas do cache
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: 0 // TODO: Implementar tracking de hit rate
    };
  }

  /**
   * Pré-carregar logos dos times mais comuns
   */
  async preloadCommonLogos(): Promise<void> {
    const commonTeams = [
      'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Santos',
      'Vasco', 'Botafogo', 'Fluminense', 'Grêmio', 'Internacional',
      'Atlético-MG', 'Cruzeiro', 'Bahia', 'Vitória', 'Sport Recife'
    ];

    const promises = commonTeams.map(team => this.getTeamLogo(team));
    await Promise.allSettled(promises);
  }
}

// Instância singleton do cache
const logoCache = new LogoCache();

// Função utilitária para uso em componentes
export const getTeamLogo = async (teamName: string): Promise<string> => {
  return logoCache.getTeamLogo(teamName);
};

// Função síncrona para uso imediato (sem cache)
export const getTeamLogoSync = (teamName: string): string => {
  if (!teamName) {
    const initial = '?';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=1f2937&color=ffffff&size=128&bold=true`;
  }

  const logoMap = teamLogoMap as Record<string, string>;
  const normalizedName = teamName.toUpperCase().trim();
  
  // Tentar várias variações
  const variations = [
    normalizedName,
    teamName,
    teamName.toLowerCase(),
    teamName.replace(/\s+/g, ''),
    teamName.replace(/FC|EC|SC|CR|SE/gi, '').trim(),
    teamName.replace(/\s+(FC|EC|SC|CR|SE)$/gi, '').trim()
  ];

  for (const variation of variations) {
    if (logoMap[variation] || logoMap[variation.toUpperCase()] || logoMap[variation.toLowerCase()]) {
      return logoMap[variation] || logoMap[variation.toUpperCase()] || logoMap[variation.toLowerCase()];
    }
  }

  // Logo padrão
  const initial = teamName.charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=1f2937&color=ffffff&size=128&bold=true`;
};

export default logoCache;