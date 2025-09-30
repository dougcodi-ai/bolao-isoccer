# Instruções para Adicionar Campo Championship

## Status Atual ✅
- **Código preparado**: Todas as interfaces TypeScript, consultas e componentes já estão prontos para usar o campo `championship`
- **Consulta atualizada**: A consulta principal em `palpites/page.tsx` já inclui `championship` na seleção
- **Componentes prontos**: `PoolSelector.tsx` já tem lógica para exibir campeonatos com cores e ícones
- **Scripts criados**: Scripts de migração e atualização automática estão prontos

## Ação Necessária 🔧
O campo `championship` precisa ser adicionado manualmente à tabela `pools` no Supabase.

### Opção 1: Via Supabase Dashboard (Recomendado)
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Execute o seguinte SQL:

```sql
-- Adicionar campo championship
ALTER TABLE public.pools ADD COLUMN championship text;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_pools_championship ON public.pools(championship);

-- Atualizar pools existentes com campeonatos baseados no nome
UPDATE public.pools 
SET championship = CASE 
  WHEN LOWER(name) LIKE '%brasileirão%' OR LOWER(name) LIKE '%série a%' OR LOWER(name) LIKE '%serie a%' THEN 'Brasileirão Série A'
  WHEN LOWER(name) LIKE '%série b%' OR LOWER(name) LIKE '%serie b%' THEN 'Brasileirão Série B'
  WHEN LOWER(name) LIKE '%copa do brasil%' OR LOWER(name) LIKE '%copa brasil%' THEN 'Copa do Brasil'
  WHEN LOWER(name) LIKE '%libertadores%' THEN 'Copa Libertadores'
  WHEN LOWER(name) LIKE '%sul-americana%' OR LOWER(name) LIKE '%sulamericana%' THEN 'Copa Sul-Americana'
  ELSE 'Brasileirão Série A'
END
WHERE championship IS NULL;
```

### Opção 2: Via Table Editor
1. Acesse: https://supabase.com/dashboard
2. Vá para **Table Editor** > **pools**
3. Clique em **Add Column**
4. Configure:
   - **Nome**: `championship`
   - **Tipo**: `text`
   - **Nullable**: `true`
5. Salve a coluna

### Verificação ✅
Após adicionar o campo, execute este script para verificar e atualizar os pools:

```bash
node check-championship-field.cjs
```

## Funcionalidades que Serão Ativadas 🚀

### 1. Seletor de Pools com Campeonatos
- Exibição do campeonato de cada bolão
- Cores específicas por tipo de campeonato
- Ícones diferenciados (troféu para copas, usuários para ligas)

### 2. Filtros por Campeonato (Futuro)
- Filtrar jogos por campeonato específico
- Navegação entre diferentes competições
- Organização melhor dos dados

### 3. Associação Automática
- Pools criados serão automaticamente associados a campeonatos
- Lógica inteligente baseada no nome do bolão
- Campeonatos padrão configuráveis

## Arquivos Preparados 📁

### Interfaces TypeScript
- `src/app/palpites/page.tsx` - Interface Pool com championship
- `src/app/bolao/meus/page.tsx` - Interface Pool com championship
- `src/components/PoolSelector.tsx` - Interface Pool com championship

### Consultas Atualizadas
- `src/app/palpites/page.tsx:517` - Consulta inclui championship
- `src/components/PoolSelector.tsx` - Lógica de cores e ícones

### Scripts de Migração
- `add-championship-field.sql` - SQL para adicionar campo
- `check-championship-field.cjs` - Verificação e atualização automática
- `2025-01-20_add_championship_field.sql` - Patch completo

## Próximos Passos 📋
1. ✅ **Adicionar campo championship** (manual via Supabase)
2. ✅ **Executar script de verificação**
3. ⏳ **Implementar filtros por campeonato**
4. ⏳ **Adicionar lógica de troca dinâmica de jogos**
5. ⏳ **Integrar com API Highlightly para logos**

---

**Nota**: Todo o código já está preparado. Apenas a adição do campo no banco de dados é necessária para ativar todas as funcionalidades relacionadas a campeonatos.