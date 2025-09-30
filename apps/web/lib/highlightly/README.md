# Integração API Highlightly

Sistema completo de integração com a API Sport Highlights da RapidAPI, implementando rate limiting, cache inteligente e dados ao vivo.

## 🚀 Características

- **Rate Limiting**: 25 requisições por usuário/hora com intervalo mínimo de 5 minutos
- **Cache Inteligente**: Sistema de cache com Supabase para otimizar performance
- **Dados ao Vivo**: Polling automático a cada 5 minutos para partidas ao vivo
- **Logs Detalhados**: Sistema completo de logging para debug e monitoramento
- **Dashboard Admin**: Painel de controle para usuários Master

## 📁 Estrutura de Arquivos

```
lib/highlightly/
├── client.js              # Cliente principal da API
├── supabase-setup.sql     # Script de configuração do banco
├── test-api.js           # Script de teste da API
└── README.md             # Esta documentação

hooks/
├── useHighlightly.js     # Hook React principal
├── usePolling.js         # Hook para polling automático
└── useLiveMatches.js     # Hook para dados ao vivo

components/
├── LeagueSelector.jsx    # Seletor de campeonatos
├── MatchPreview.jsx      # Preview de partidas
├── LiveStatus.jsx        # Status de conexão ao vivo
└── AdminDashboard.jsx    # Dashboard de monitoramento
```

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione no arquivo `.env.local`:

```env
RAPIDAPI_KEY=sua_chave_rapidapi_aqui
```

### 2. Configuração do Supabase

Execute o script SQL no Supabase SQL Editor:

```bash
# Copie o conteúdo de supabase-setup.sql e execute no Supabase
```

### 3. Teste da Integração

```bash
cd apps/web
node lib/highlightly/test-api.js
```

## 🔧 Uso Básico

### Hook Principal

```jsx
import useHighlightly from '../hooks/useHighlightly';

function MyComponent() {
  const {
    loading,
    error,
    countries,
    leagues,
    matches,
    fetchCountries,
    fetchBrazilianLeagues,
    fetchMatches,
    canMakeRequest,
    rateLimitInfo
  } = useHighlightly();

  useEffect(() => {
    if (canMakeRequest()) {
      fetchBrazilianLeagues();
    }
  }, []);

  return (
    <div>
      {loading && <p>Carregando...</p>}
      {error && <p>Erro: {error}</p>}
      {leagues.map(league => (
        <div key={league.id}>{league.name}</div>
      ))}
    </div>
  );
}
```

### Dados ao Vivo

```jsx
import useLiveMatches from '../hooks/useLiveMatches';

function LiveMatches({ league }) {
  const {
    liveMatches,
    upcomingMatches,
    isPolling,
    hasLiveMatches,
    forceUpdate
  } = useLiveMatches(league, {
    pollingInterval: 5 * 60 * 1000, // 5 minutos
    enabled: true
  });

  return (
    <div>
      {hasLiveMatches() && (
        <div>
          <h3>Partidas ao Vivo ({liveMatches.length})</h3>
          {liveMatches.map(match => (
            <div key={match.id}>
              {match.home_team} vs {match.away_team}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Seletor de Campeonatos

```jsx
import LeagueSelector from '../components/LeagueSelector';

function App() {
  const [selectedLeague, setSelectedLeague] = useState(null);

  return (
    <div>
      <LeagueSelector 
        onLeagueSelect={setSelectedLeague}
        selectedLeague={selectedLeague}
      />
    </div>
  );
}
```

## 📊 Rate Limiting

O sistema implementa rate limiting rigoroso:

- **25 requisições por usuário/hora**
- **Intervalo mínimo de 5 minutos entre requisições**
- **Cache automático para reduzir requisições**
- **Logs detalhados de todas as requisições**

### Verificar Rate Limit

```jsx
const { canMakeRequest, rateLimitInfo } = useHighlightly();

if (!canMakeRequest()) {
  console.log('Rate limit atingido:', rateLimitInfo);
}
```

## 💾 Sistema de Cache

Cache inteligente com diferentes TTLs:

- **Países**: 24 horas
- **Ligas**: 12 horas  
- **Partidas**: 30 minutos
- **Classificações**: 1 hora

### Limpeza Automática

O sistema limpa automaticamente cache expirado e mantém logs por 30 dias.

## 🔍 Monitoramento

### Dashboard Admin

Acesso restrito a usuários Master:

```jsx
import AdminDashboard from '../components/AdminDashboard';

// Apenas usuários com email master@bolao.com ou role 'master'
function AdminPage() {
  return <AdminDashboard />;
}
```

### Métricas Disponíveis

- Requisições por hora/dia
- Taxa de sucesso/erro
- Usuários ativos
- Cache hit rate
- Rate limiting por usuário
- Logs detalhados

## 🚨 Tratamento de Erros

### Tipos de Erro

```javascript
// Rate limit atingido
{
  success: false,
  error: 'rate_limit_hour',
  message: 'Limite de 25 requisições por hora atingido',
  nextAllowedAt: timestamp
}

// Intervalo mínimo não respeitado
{
  success: false,
  error: 'rate_limit_interval', 
  message: 'Aguarde 5 minutos entre requisições',
  nextAllowedAt: timestamp
}

// Erro da API
{
  success: false,
  error: 'api_error',
  message: 'Erro 403: Forbidden'
}
```

### Tratamento Automático

O sistema trata automaticamente:

- Retry com backoff exponencial
- Pausa automática em rate limits
- Cache de respostas de erro (temporário)
- Logs detalhados para debug

## 🔧 Configurações Avançadas

### Personalizar Polling

```jsx
const liveMatches = useLiveMatches(league, {
  pollingInterval: 2 * 60 * 1000, // 2 minutos para partidas ao vivo
  enabled: hasLiveMatches,
  maxRetries: 5,
  retryDelay: 30000
});
```

### Cliente Direto

```jsx
import HighlightlyClient from '../lib/highlightly/client';

const client = new HighlightlyClient();

// Uso direto (não recomendado - use os hooks)
const result = await client.getMatches(userId, leagueId);
```

## 📈 Performance

### Otimizações Implementadas

1. **Cache Inteligente**: Reduz requisições desnecessárias
2. **Rate Limiting**: Evita bloqueios da API
3. **Polling Adaptativo**: Frequência baseada em partidas ao vivo
4. **Lazy Loading**: Carregamento sob demanda
5. **Cleanup Automático**: Remove dados antigos automaticamente

### Métricas Esperadas

- **Cache Hit Rate**: 70-80%
- **Requisições/Usuário/Dia**: 10-15
- **Tempo de Resposta**: < 2s (cache) / < 5s (API)

## 🛠️ Troubleshooting

### Problemas Comuns

1. **Erro 403**: Verificar chave RAPIDAPI_KEY
2. **Rate Limit**: Aguardar intervalo ou verificar logs
3. **Cache Vazio**: Executar limpeza de cache expirado
4. **Polling Parado**: Verificar conexão e rate limits

### Debug

```bash
# Testar API
node lib/highlightly/test-api.js

# Verificar logs no Supabase
SELECT * FROM api_requests_log ORDER BY created_at DESC LIMIT 10;

# Verificar cache
SELECT endpoint, COUNT(*) FROM api_cache GROUP BY endpoint;
```

## 📝 Logs

Todos os logs são armazenados na tabela `api_requests_log`:

```sql
SELECT 
  created_at,
  user_id,
  endpoint,
  success,
  response_time_ms,
  from_cache,
  error_message
FROM api_requests_log 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## 🔒 Segurança

- Chaves API armazenadas em variáveis de ambiente
- Rate limiting por usuário autenticado
- Logs não contêm dados sensíveis
- RLS (Row Level Security) no Supabase
- Validação de entrada em todas as funções

## 📞 Suporte

Para problemas ou dúvidas:

1. Verificar logs no dashboard admin
2. Executar script de teste
3. Verificar configuração do Supabase
4. Consultar documentação da API Highlightly