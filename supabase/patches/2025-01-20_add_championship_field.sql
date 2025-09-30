-- Patch: Adicionar campo championship à tabela pools
-- Data: 2025-01-20
-- Descrição: Adiciona campo championship para associar cada bolão a um campeonato específico

-- 1. Adicionar campo championship à tabela pools
ALTER TABLE public.pools 
ADD COLUMN IF NOT EXISTS championship text;

-- 2. Adicionar comentário para documentação
COMMENT ON COLUMN public.pools.championship IS 'Campeonato associado ao bolão (ex: Brasileirão Série A, Copa do Brasil, Copa Libertadores, etc.)';

-- 3. Criar índice para melhor performance nas consultas por campeonato
CREATE INDEX IF NOT EXISTS idx_pools_championship ON public.pools(championship);

-- 4. Atualizar pools existentes com campeonatos padrão baseado no nome (opcional)
-- Isso pode ser executado após a criação da coluna para pools já existentes
UPDATE public.pools 
SET championship = CASE 
  WHEN LOWER(name) LIKE '%brasileirão%' OR LOWER(name) LIKE '%série a%' OR LOWER(name) LIKE '%serie a%' THEN 'Brasileirão Série A'
  WHEN LOWER(name) LIKE '%série b%' OR LOWER(name) LIKE '%serie b%' THEN 'Brasileirão Série B'
  WHEN LOWER(name) LIKE '%copa do brasil%' OR LOWER(name) LIKE '%copa brasil%' THEN 'Copa do Brasil'
  WHEN LOWER(name) LIKE '%libertadores%' THEN 'Copa Libertadores'
  WHEN LOWER(name) LIKE '%sul-americana%' OR LOWER(name) LIKE '%sulamericana%' THEN 'Copa Sul-Americana'
  ELSE 'Brasileirão Série A' -- Padrão para pools sem indicação específica
END
WHERE championship IS NULL;

-- 5. Verificar a estrutura atualizada
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'pools'
ORDER BY ordinal_position;