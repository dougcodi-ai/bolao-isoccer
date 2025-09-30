// Componente para seleção de campeonatos com dados reais da API
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Trophy, 
  Globe, 
  Clock, 
  AlertCircle, 
  RefreshCw,
  Star,
  MapPin
} from 'lucide-react';
import useHighlightly from '../hooks/useHighlightly';

const LeagueSelector = ({ onLeagueSelect, selectedLeague = null }) => {
  const {
    loading,
    error,
    countries,
    leagues,
    rateLimitInfo,
    fetchCountries,
    fetchLeagues,
    fetchBrazilianLeagues,
    canMakeRequest,
    formatTimeUntilNext,
    clearData
  } = useHighlightly();

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showAllCountries, setShowAllCountries] = useState(false);

  // Carregar países ao montar o componente
  useEffect(() => {
    if (canMakeRequest()) {
      fetchCountries();
    }
  }, [fetchCountries, canMakeRequest]);

  // Carregar ligas brasileiras por padrão
  useEffect(() => {
    if (canMakeRequest()) {
      fetchBrazilianLeagues();
    }
  }, [fetchBrazilianLeagues, canMakeRequest]);

  /**
   * Selecionar país e buscar suas ligas
   */
  const handleCountrySelect = async (country) => {
    if (!canMakeRequest()) return;
    
    setSelectedCountry(country);
    await fetchLeagues(country.code, country.name);
  };

  /**
   * Selecionar liga brasileira
   */
  const handleBrazilianLeagues = async () => {
    if (!canMakeRequest()) return;
    
    setSelectedCountry({ name: 'Brasil', code: 'BR', flag: '🇧🇷' });
    await fetchBrazilianLeagues();
  };

  /**
   * Renderizar informações de rate limit
   */
  const renderRateLimitInfo = () => {
    if (!rateLimitInfo) return null;

    if (rateLimitInfo.blocked) {
      const timeLeft = formatTimeUntilNext();
      return (
        <Alert className="mb-4">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Rate limit atingido. Próxima requisição em: {timeLeft}
          </AlertDescription>
        </Alert>
      );
    }

    if (rateLimitInfo.requestsRemaining !== undefined) {
      return (
        <div className="mb-4 text-sm text-gray-600">
          Requisições restantes: {rateLimitInfo.requestsRemaining}/25 por hora
        </div>
      );
    }

    return null;
  };

  /**
   * Renderizar erro
   */
  const renderError = () => {
    if (!error) return null;

    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  };

  /**
   * Renderizar países
   */
  const renderCountries = () => {
    if (loading && countries.length === 0) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    const displayCountries = showAllCountries ? countries : countries.slice(0, 8);

    return (
      <div className="space-y-4">
        {/* Botão para ligas brasileiras */}
        <Button
          variant={selectedCountry?.code === 'BR' ? 'default' : 'outline'}
          className="w-full justify-start"
          onClick={handleBrazilianLeagues}
          disabled={!canMakeRequest()}
        >
          <Star className="h-4 w-4 mr-2" />
          🇧🇷 Ligas Brasileiras
        </Button>

        {/* Grid de países */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {displayCountries.map((country) => (
            <Button
              key={country.code}
              variant={selectedCountry?.code === country.code ? 'default' : 'outline'}
              className="h-12 justify-start text-left"
              onClick={() => handleCountrySelect(country)}
              disabled={!canMakeRequest()}
            >
              <MapPin className="h-4 w-4 mr-2" />
              <span className="truncate">
                {country.flag || '🌍'} {country.name}
              </span>
            </Button>
          ))}
        </div>

        {/* Botão para mostrar mais países */}
        {countries.length > 8 && (
          <Button
            variant="ghost"
            onClick={() => setShowAllCountries(!showAllCountries)}
            className="w-full"
          >
            {showAllCountries ? 'Mostrar menos' : `Mostrar mais (${countries.length - 8} países)`}
          </Button>
        )}
      </div>
    );
  };

  /**
   * Renderizar ligas
   */
  const renderLeagues = () => {
    if (loading && leagues.length === 0) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (leagues.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma liga encontrada</p>
          <p className="text-sm">Selecione um país para ver as ligas disponíveis</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {leagues.map((league) => (
          <Card 
            key={league.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedLeague?.id === league.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => onLeagueSelect(league)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {league.logo ? (
                      <img 
                        src={league.logo} 
                        alt={league.name}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Trophy className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{league.name}</h3>
                    <p className="text-sm text-gray-600">
                      {league.country} • {league.type || 'Liga'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  {league.season && (
                    <Badge variant="secondary">
                      {league.season}
                    </Badge>
                  )}
                  {league.current && (
                    <Badge variant="default" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Globe className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Selecionar Campeonato</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Limpar
        </Button>
      </div>

      {/* Rate limit info */}
      {renderRateLimitInfo()}

      {/* Error */}
      {renderError()}

      {/* Países */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Países</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderCountries()}
        </CardContent>
      </Card>

      {/* Ligas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5" />
            <span>
              Ligas {selectedCountry && `- ${selectedCountry.name}`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderLeagues()}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeagueSelector;