// Componente de status ao vivo
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Radio, 
  Clock, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

const LiveStatus = ({ 
  isPolling, 
  lastUpdate, 
  error, 
  hasLiveMatches, 
  liveCount = 0,
  upcomingCount = 0,
  timeUntilNext,
  formattedTimeUntilNext,
  onForceUpdate,
  onTogglePolling,
  compact = false 
}) => {
  
  /**
   * Formatar última atualização
   */
  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Nunca';
    
    const now = new Date();
    const diff = now - lastUpdate;
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes === 0) {
      return `${seconds}s atrás`;
    } else if (minutes < 60) {
      return `${minutes}m atrás`;
    } else {
      return lastUpdate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  /**
   * Obter status da conexão
   */
  const getConnectionStatus = () => {
    if (error) {
      if (error.includes('rate_limit') || error.includes('Rate limit')) {
        return {
          status: 'rate_limited',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          icon: Clock,
          text: 'Rate Limit'
        };
      }
      return {
        status: 'error',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: WifiOff,
        text: 'Erro'
      };
    }
    
    if (isPolling) {
      return {
        status: 'connected',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: Wifi,
        text: 'Conectado'
      };
    }
    
    return {
      status: 'disconnected',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      icon: WifiOff,
      text: 'Desconectado'
    };
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  if (compact) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        {/* Status de conexão */}
        <div className={`flex items-center space-x-1 ${connectionStatus.color}`}>
          <StatusIcon className="h-4 w-4" />
          {hasLiveMatches && (
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          )}
        </div>

        {/* Contadores */}
        {(liveCount > 0 || upcomingCount > 0) && (
          <div className="flex items-center space-x-2">
            {liveCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {liveCount} ao vivo
              </Badge>
            )}
            {upcomingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {upcomingCount} próximas
              </Badge>
            )}
          </div>
        )}

        {/* Próxima atualização */}
        {isPolling && formattedTimeUntilNext && (
          <span className="text-gray-500 text-xs">
            {formattedTimeUntilNext}
          </span>
        )}

        {/* Botão de atualização */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onForceUpdate}
          disabled={!onForceUpdate}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Status principal */}
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${connectionStatus.bgColor}`}>
              <StatusIcon className={`h-5 w-5 ${connectionStatus.color}`} />
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold">{connectionStatus.text}</span>
                {hasLiveMatches && (
                  <div className="flex items-center space-x-1">
                    <Radio className="h-4 w-4 text-red-500" />
                    <span className="text-red-500 text-sm font-medium">AO VIVO</span>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                Última atualização: {formatLastUpdate()}
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="flex items-center space-x-4">
            {/* Partidas ao vivo */}
            {liveCount > 0 && (
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">{liveCount}</div>
                <div className="text-xs text-gray-600">Ao Vivo</div>
              </div>
            )}

            {/* Próximas partidas */}
            {upcomingCount > 0 && (
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{upcomingCount}</div>
                <div className="text-xs text-gray-600">Próximas</div>
              </div>
            )}

            {/* Próxima atualização */}
            {isPolling && (
              <div className="text-center">
                <div className="text-sm font-medium">
                  {formattedTimeUntilNext || '0s'}
                </div>
                <div className="text-xs text-gray-600">Próxima</div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onForceUpdate}
              disabled={!onForceUpdate}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            
            {onTogglePolling && (
              <Button
                variant={isPolling ? "secondary" : "default"}
                size="sm"
                onClick={onTogglePolling}
              >
                {isPolling ? (
                  <>
                    <WifiOff className="h-4 w-4 mr-1" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-1" />
                    Conectar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Informações adicionais */}
        {isPolling && !error && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Atualizações automáticas ativas</span>
            <span>Intervalo: 5 minutos</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveStatus;