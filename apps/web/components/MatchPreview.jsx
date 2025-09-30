// Componente de preview de partidas com dados futuros e passados
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar,
  Clock,
  Trophy,
  Target,
  History,
  AlertCircle,
  RefreshCw,
  Users,
  MapPin,
  TrendingUp
} from 'lucide-react';
import useHighlightly from '../hooks/useHighlightly';

const MatchPreview = ({ league, onMatchSelect }) => {
  const {
    loading,
    error,
    matches,
    standings,
    fetchMatches,
    fetchStandings,
    canMakeRequest,
    formatTimeUntilNext
  } = useHighlightly();

  const [activeTab, setActiveTab] = useState('upcoming');

  // Carregar dados quando a liga mudar
  useEffect(() => {
    if (league?.id && canMakeRequest()) {
      fetchMatches(league.id, 100); // Buscar mais partidas
      fetchStandings(league.id);
    }
  }, [league?.id, fetchMatches, fetchStandings, canMakeRequest]);

  /**
   * Separar partidas por status
   */
  const categorizeMatches = () => {
    const now = new Date();
    
    const upcoming = matches.filter(match => {
      const matchDate = new Date(match.date);
      return matchDate > now && match.status !== 'finished';
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const finished = matches.filter(match => {
      return match.status === 'finished' || match.status === 'completed';
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const live = matches.filter(match => {
      return match.status === 'live' || match.status === 'in_progress';
    });

    return { upcoming, finished, live };
  };

  /**
   * Formatar data e hora
   */
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const dateStr = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: diffDays > 365 ? 'numeric' : undefined
    });

    if (diffDays === 0) return `Hoje, ${timeStr}`;
    if (diffDays === 1) return `Amanhã, ${timeStr}`;
    if (diffDays === -1) return `Ontem, ${timeStr}`;
    if (diffDays > 0 && diffDays <= 7) {
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
      return `${dayName}, ${timeStr}`;
    }

    return `${dateStr}, ${timeStr}`;
  };

  /**
   * Obter posição do time na classificação
   */
  const getTeamPosition = (teamName) => {
    const team = standings.find(s => 
      s.team?.name?.toLowerCase() === teamName?.toLowerCase()
    );
    return team?.position || null;
  };

  /**
   * Renderizar card de partida
   */
  const renderMatchCard = (match, isUpcoming = false) => {
    const homePosition = getTeamPosition(match.home_team);
    const awayPosition = getTeamPosition(match.away_team);

    return (
      <Card 
        key={match.id}
        className={`cursor-pointer transition-all hover:shadow-md ${
          match.status === 'live' ? 'ring-2 ring-green-500' : ''
        }`}
        onClick={() => onMatchSelect && onMatchSelect(match)}
      >
        <CardContent className="p-4">
          {/* Header com data e status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{formatDateTime(match.date)}</span>
            </div>
            <div className="flex items-center space-x-2">
              {match.venue && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-20">{match.venue}</span>
                </div>
              )}
              <Badge 
                variant={
                  match.status === 'live' ? 'destructive' :
                  match.status === 'finished' ? 'secondary' :
                  'default'
                }
              >
                {match.status === 'live' ? 'AO VIVO' :
                 match.status === 'finished' ? 'FINAL' :
                 'AGENDADO'}
              </Badge>
            </div>
          </div>

          {/* Times e placar */}
          <div className="flex items-center justify-between">
            {/* Time da casa */}
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                {match.home_team_logo ? (
                  <img 
                    src={match.home_team_logo} 
                    alt={match.home_team}
                    className="w-6 h-6 object-contain"
                  />
                ) : (
                  <Users className="h-4 w-4 text-gray-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold truncate">{match.home_team}</span>
                  {homePosition && (
                    <Badge variant="outline" className="text-xs">
                      {homePosition}º
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Placar ou VS */}
            <div className="mx-4 text-center">
              {match.status === 'finished' && (match.home_score !== null || match.away_score !== null) ? (
                <div className="text-2xl font-bold">
                  {match.home_score || 0} - {match.away_score || 0}
                </div>
              ) : match.status === 'live' ? (
                <div className="text-xl font-bold text-green-600">
                  {match.home_score || 0} - {match.away_score || 0}
                  <div className="text-xs text-green-600 animate-pulse">
                    {match.minute || 'AO VIVO'}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-semibold text-gray-400">
                  VS
                </div>
              )}
            </div>

            {/* Time visitante */}
            <div className="flex items-center space-x-3 flex-1 justify-end">
              <div className="flex-1 text-right">
                <div className="flex items-center justify-end space-x-2">
                  {awayPosition && (
                    <Badge variant="outline" className="text-xs">
                      {awayPosition}º
                    </Badge>
                  )}
                  <span className="font-semibold truncate">{match.away_team}</span>
                </div>
              </div>
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                {match.away_team_logo ? (
                  <img 
                    src={match.away_team_logo} 
                    alt={match.away_team}
                    className="w-6 h-6 object-contain"
                  />
                ) : (
                  <Users className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
          </div>

          {/* Informações adicionais */}
          {(match.referee || match.round) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500">
                {match.round && (
                  <span>{match.round}</span>
                )}
                {match.referee && (
                  <span>Árbitro: {match.referee}</span>
                )}
              </div>
            </div>
          )}

          {/* Botão de ação para partidas futuras */}
          {isUpcoming && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <Button 
                size="sm" 
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onMatchSelect && onMatchSelect(match, 'bet');
                }}
              >
                <Target className="h-4 w-4 mr-1" />
                Fazer Palpite
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  /**
   * Renderizar classificação resumida
   */
  const renderStandingsPreview = () => {
    if (!standings.length) return null;

    const topTeams = standings.slice(0, 5);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Classificação</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topTeams.map((team, index) => (
              <div key={team.team?.id || index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold">
                    {team.position}
                  </div>
                  <div className="flex items-center space-x-2">
                    {team.team?.logo && (
                      <img 
                        src={team.team.logo} 
                        alt={team.team.name}
                        className="w-5 h-5 object-contain"
                      />
                    )}
                    <span className="font-medium">{team.team?.name}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{team.points} pts</span>
                  <span>{team.played} j</span>
                </div>
              </div>
            ))}
          </div>
          {standings.length > 5 && (
            <Button variant="ghost" size="sm" className="w-full mt-2">
              Ver classificação completa
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!league) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Selecione uma liga para ver as partidas</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={() => {
              if (canMakeRequest()) {
                fetchMatches(league.id, 100);
                fetchStandings(league.id);
              }
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { upcoming, finished, live } = categorizeMatches();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {league.logo && (
            <img 
              src={league.logo} 
              alt={league.name}
              className="w-8 h-8 object-contain"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold">{league.name}</h2>
            <p className="text-sm text-gray-600">{league.country}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (canMakeRequest()) {
              fetchMatches(league.id, 100);
              fetchStandings(league.id);
            }
          }}
          disabled={loading || !canMakeRequest()}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Rate limit warning */}
      {!canMakeRequest() && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Próxima atualização em: {formatTimeUntilNext()}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Partidas */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="live" className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Ao Vivo ({live.length})</span>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Próximas ({upcoming.length})</span>
              </TabsTrigger>
              <TabsTrigger value="finished" className="flex items-center space-x-1">
                <History className="h-4 w-4" />
                <span>Finalizadas ({finished.length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-4 mt-4">
              {loading && live.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))
              ) : live.length > 0 ? (
                live.map(match => renderMatchCard(match))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma partida ao vivo</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {loading && upcoming.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))
              ) : upcoming.length > 0 ? (
                upcoming.map(match => renderMatchCard(match, true))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma partida agendada</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="finished" className="space-y-4 mt-4">
              {loading && finished.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))
              ) : finished.length > 0 ? (
                finished.map(match => renderMatchCard(match))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma partida finalizada</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Classificação */}
        <div>
          {renderStandingsPreview()}
        </div>
      </div>
    </div>
  );
};

export default MatchPreview;