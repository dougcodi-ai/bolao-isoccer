// Dashboard de monitoramento para usuário Master
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity,
  Users,
  Database,
  Clock,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Eye,
  Zap,
  BarChart3,
  Settings,
  Download
} from 'lucide-react';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';

const AdminDashboard = () => {
  const user = useUser();
  const supabase = useSupabaseClient();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recentLogs, setRecentLogs] = useState([]);
  const [cacheStats, setCacheStats] = useState({});
  const [rateLimitStats, setRateLimitStats] = useState({});
  const [error, setError] = useState(null);

  /**
   * Verificar se é usuário Master
   */
  const isMaster = user?.email === 'master@bolao.com' || user?.user_metadata?.role === 'master';

  /**
   * Buscar estatísticas gerais
   */
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Estatísticas de requisições
      const { data: requestStats, error: requestError } = await supabase
        .from('api_requests_log')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (requestError) throw requestError;

      // Estatísticas de cache
      const { data: cacheData, error: cacheError } = await supabase
        .from('api_cache')
        .select('endpoint, created_at, expires_at')
        .order('created_at', { ascending: false });

      if (cacheError) throw cacheError;

      // Logs recentes
      const { data: logsData, error: logsError } = await supabase
        .from('api_requests_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsError) throw logsError;

      // Processar estatísticas
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const requestsLastHour = requestStats.filter(r => new Date(r.created_at) >= oneHourAgo);
      const requestsLast24h = requestStats.length;
      const successfulRequests = requestStats.filter(r => r.success).length;
      const failedRequests = requestStats.filter(r => !r.success).length;

      // Estatísticas de cache
      const activeCacheEntries = cacheData.filter(c => new Date(c.expires_at) > now).length;
      const expiredCacheEntries = cacheData.filter(c => new Date(c.expires_at) <= now).length;
      const cacheHitRate = requestStats.filter(r => r.from_cache).length / Math.max(requestStats.length, 1) * 100;

      // Rate limiting por usuário
      const userRequests = requestStats.reduce((acc, req) => {
        acc[req.user_id] = (acc[req.user_id] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalRequests24h: requestsLast24h,
        requestsLastHour: requestsLastHour.length,
        successfulRequests,
        failedRequests,
        successRate: (successfulRequests / Math.max(requestsLast24h, 1) * 100).toFixed(1),
        uniqueUsers: Object.keys(userRequests).length,
        avgRequestsPerUser: (requestsLast24h / Math.max(Object.keys(userRequests).length, 1)).toFixed(1)
      });

      setCacheStats({
        active: activeCacheEntries,
        expired: expiredCacheEntries,
        total: cacheData.length,
        hitRate: cacheHitRate.toFixed(1)
      });

      setRateLimitStats(userRequests);
      setRecentLogs(logsData);

    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Limpar cache expirado
   */
  const clearExpiredCache = async () => {
    try {
      const { error } = await supabase
        .from('api_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      alert('Cache expirado limpo com sucesso!');
      fetchStats();
    } catch (err) {
      alert('Erro ao limpar cache: ' + err.message);
    }
  };

  /**
   * Exportar logs
   */
  const exportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('api_requests_log')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const csv = [
        'Data,Usuário,Endpoint,Sucesso,Tempo Resposta,Erro',
        ...data.map(log => [
          new Date(log.created_at).toLocaleString('pt-BR'),
          log.user_id,
          log.endpoint,
          log.success ? 'Sim' : 'Não',
          log.response_time_ms || 0,
          log.error_message || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao exportar logs: ' + err.message);
    }
  };

  useEffect(() => {
    if (isMaster) {
      fetchStats();
      const interval = setInterval(fetchStats, 60000); // Atualizar a cada minuto
      return () => clearInterval(interval);
    }
  }, [isMaster]);

  if (!isMaster) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Acesso negado. Esta página é restrita a usuários Master.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Dashboard de Monitoramento</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-1" />
            Exportar Logs
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estatísticas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisições 24h</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests24h || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.requestsLastHour || 0} na última hora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.failedRequests || 0} falhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.avgRequestsPerUser || 0} req/usuário
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats.hitRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {cacheStats.active || 0} entradas ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com detalhes */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Logs Recentes</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="users">Rate Limiting</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Requisições</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentLogs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={log.success ? "default" : "destructive"}>
                        {log.success ? "OK" : "ERRO"}
                      </Badge>
                      <span className="font-mono text-sm">{log.endpoint}</span>
                      {log.from_cache && (
                        <Badge variant="secondary">Cache</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gerenciamento de Cache</CardTitle>
              <Button variant="outline" size="sm" onClick={clearExpiredCache}>
                <Database className="h-4 w-4 mr-1" />
                Limpar Expirado
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{cacheStats.active || 0}</div>
                  <div className="text-sm text-gray-600">Ativas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{cacheStats.expired || 0}</div>
                  <div className="text-sm text-gray-600">Expiradas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{cacheStats.total || 0}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting por Usuário (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(rateLimitStats).map(([userId, count]) => (
                  <div key={userId} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-mono text-sm">{userId}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{count} requisições</span>
                      <Badge variant={count > 20 ? "destructive" : count > 15 ? "secondary" : "default"}>
                        {count > 20 ? "Alto" : count > 15 ? "Médio" : "Normal"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;