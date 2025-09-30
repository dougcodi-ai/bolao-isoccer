-- Tabelas para integração com API Highlightly
-- Execute este script no Supabase SQL Editor

-- Tabela para cache da API
CREATE TABLE IF NOT EXISTS api_cache (
  id BIGSERIAL PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_created_at ON api_cache(created_at);

-- Tabela para log de requisições da API
CREATE TABLE IF NOT EXISTS api_requests_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rate limiting e analytics
CREATE INDEX IF NOT EXISTS idx_api_requests_user_created ON api_requests_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON api_requests_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_requests_success ON api_requests_log(success);

-- Tabela para configurações da API por usuário
CREATE TABLE IF NOT EXISTS user_api_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  rate_limit_override INTEGER, -- Override do rate limit padrão
  preferred_leagues JSONB, -- Ligas favoritas do usuário
  notification_settings JSONB, -- Configurações de notificação
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS idx_user_api_settings_user_id ON user_api_settings(user_id);

-- Tabela para estatísticas de uso da API (para dashboard admin)
CREATE TABLE IF NOT EXISTS api_usage_stats (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  most_used_endpoint VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_api_usage_stats_date ON api_usage_stats(date);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_api_cache_updated_at 
  BEFORE UPDATE ON api_cache 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_api_settings_updated_at 
  BEFORE UPDATE ON user_api_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS (Row Level Security)

-- api_cache: Acesso público para leitura, apenas sistema para escrita
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_cache_read_policy" ON api_cache
  FOR SELECT USING (true);

CREATE POLICY "api_cache_write_policy" ON api_cache
  FOR ALL USING (auth.role() = 'service_role');

-- api_requests_log: Usuários só veem seus próprios logs
ALTER TABLE api_requests_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_requests_log_user_policy" ON api_requests_log
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "api_requests_log_admin_policy" ON api_requests_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'master'
    )
  );

-- user_api_settings: Usuários só veem suas próprias configurações
ALTER TABLE user_api_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_api_settings_user_policy" ON user_api_settings
  FOR ALL USING (auth.uid() = user_id);

-- api_usage_stats: Apenas admins podem ver
ALTER TABLE api_usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_usage_stats_admin_policy" ON api_usage_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role = 'master'
    )
  );

-- Função para limpar cache antigo (executar via cron job)
CREATE OR REPLACE FUNCTION clean_old_api_cache(max_age_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_cache 
  WHERE created_at < NOW() - INTERVAL '1 hour' * max_age_hours;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para gerar estatísticas diárias
CREATE OR REPLACE FUNCTION generate_daily_api_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
  stats_record RECORD;
BEGIN
  -- Calcular estatísticas do dia
  SELECT 
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    COUNT(DISTINCT user_id) as unique_users,
    MODE() WITHIN GROUP (ORDER BY endpoint) as most_used_endpoint
  INTO stats_record
  FROM api_requests_log
  WHERE DATE(created_at) = target_date;

  -- Inserir ou atualizar estatísticas
  INSERT INTO api_usage_stats (
    date, total_requests, successful_requests, 
    failed_requests, unique_users, most_used_endpoint
  ) VALUES (
    target_date, 
    COALESCE(stats_record.total_requests, 0),
    COALESCE(stats_record.successful_requests, 0),
    COALESCE(stats_record.failed_requests, 0),
    COALESCE(stats_record.unique_users, 0),
    stats_record.most_used_endpoint
  )
  ON CONFLICT (date) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    successful_requests = EXCLUDED.successful_requests,
    failed_requests = EXCLUDED.failed_requests,
    unique_users = EXCLUDED.unique_users,
    most_used_endpoint = EXCLUDED.most_used_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação
COMMENT ON TABLE api_cache IS 'Cache inteligente para respostas da API Highlightly';
COMMENT ON TABLE api_requests_log IS 'Log de todas as requisições para rate limiting e analytics';
COMMENT ON TABLE user_api_settings IS 'Configurações personalizadas da API por usuário';
COMMENT ON TABLE api_usage_stats IS 'Estatísticas diárias de uso da API para dashboard admin';

COMMENT ON FUNCTION clean_old_api_cache IS 'Remove entradas de cache mais antigas que X horas';
COMMENT ON FUNCTION generate_daily_api_stats IS 'Gera estatísticas diárias de uso da API';