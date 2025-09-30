"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Database, 
  Users, 
  Eye,
  Download,
  RefreshCw,
  TrendingUp,
  Lock
} from "lucide-react";

interface SecurityEvent {
  id: string;
  type: string;
  user_id?: string;
  ip_address: string;
  user_agent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  created_at: string;
}

interface SecurityStats {
  total_events: number;
  events_last_24h: number;
  suspicious_ips: number;
  failed_logins: number;
  sql_injection_attempts: number;
  xss_attempts: number;
  rate_limit_violations: number;
}

interface DatabaseAuditLog {
  id: string;
  user_id: string;
  operation: string;
  table_name: string;
  ip_address: string;
  created_at: string;
}

export default function SecurityDashboard() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<DatabaseAuditLog[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar eventos de segurança
      const eventsResponse = await fetch('/api/admin/security/events', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (!eventsResponse.ok) {
        throw new Error('Falha ao carregar eventos de segurança');
      }

      const eventsData = await eventsResponse.json();
      setSecurityEvents(eventsData.events || []);

      // Buscar estatísticas
      const statsResponse = await fetch('/api/admin/security/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      // Buscar logs de auditoria
      const auditResponse = await fetch('/api/admin/security/audit', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setAuditLogs(auditData.logs || []);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'authentication_failed': return <Lock className="h-4 w-4" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />;
      case 'sql_injection_attempt': return <Database className="h-4 w-4" />;
      case 'rate_limit_exceeded': return <TrendingUp className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const exportSecurityReport = async () => {
    try {
      const response = await fetch('/api/admin/security/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Erro ao exportar relatório:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Carregando dashboard de segurança...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar dados de segurança: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Dashboard de Segurança
          </h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real da segurança do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSecurityData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={exportSecurityReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_events}</div>
              <p className="text-xs text-muted-foreground">
                {stats.events_last_24h} nas últimas 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">IPs Suspeitos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.suspicious_ips}</div>
              <p className="text-xs text-muted-foreground">
                Bloqueados automaticamente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falhas de Login</CardTitle>
              <Lock className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed_logins}</div>
              <p className="text-xs text-muted-foreground">
                Tentativas de acesso negadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ataques Bloqueados</CardTitle>
              <Database className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.sql_injection_attempts + stats.xss_attempts}
              </div>
              <p className="text-xs text-muted-foreground">
                SQL Injection + XSS
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs de Conteúdo */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Eventos de Segurança</TabsTrigger>
          <TabsTrigger value="audit">Logs de Auditoria</TabsTrigger>
          <TabsTrigger value="analysis">Análise de Ameaças</TabsTrigger>
        </TabsList>

        {/* Eventos de Segurança */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Recentes de Segurança</CardTitle>
              <CardDescription>
                Últimos eventos detectados pelo sistema de monitoramento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityEvents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum evento de segurança registrado
                  </p>
                ) : (
                  securityEvents.slice(0, 20).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start space-x-4 p-4 border rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        {getEventTypeIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">{event.type}</p>
                          <Badge 
                            className={`${getSeverityColor(event.severity)} text-white`}
                          >
                            {event.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          IP: {event.ip_address}
                        </p>
                        {event.details && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {JSON.stringify(event.details, null, 2)}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs de Auditoria */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Auditoria do Banco de Dados</CardTitle>
              <CardDescription>
                Operações realizadas no banco de dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log de auditoria encontrado
                  </p>
                ) : (
                  auditLogs.slice(0, 20).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{log.operation}</Badge>
                        <span className="text-sm font-medium">{log.table_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.ip_address}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Análise de Ameaças */}
        <TabsContent value="analysis">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>IPs Mais Ativos</CardTitle>
                <CardDescription>
                  Endereços IP com maior atividade suspeita
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Aqui você pode implementar análise de IPs */}
                  <p className="text-sm text-muted-foreground">
                    Análise em desenvolvimento...
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Padrões de Ataque</CardTitle>
                <CardDescription>
                  Tipos de ataques mais frequentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats && (
                    <>
                      <div className="flex justify-between">
                        <span>SQL Injection</span>
                        <span>{stats.sql_injection_attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>XSS</span>
                        <span>{stats.xss_attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate Limiting</span>
                        <span>{stats.rate_limit_violations}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}