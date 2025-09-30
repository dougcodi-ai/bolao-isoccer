-- Adicionar campo championship à tabela pools
-- Este campo é essencial para associar cada bolão a um campeonato específico

-- 1. Adicionar a coluna championship
ALTER TABLE public.pools 
ADD COLUMN IF NOT EXISTS championship text;

-- 2. Adicionar comentário para documentação
COMMENT ON COLUMN public.pools.championship IS 'Campeonato associado ao bolão (ex: Brasileirão Série A, Copa do Brasil, etc.)';

-- 3. Atualizar pools existentes com um campeonato padrão (opcional)
-- UPDATE public.pools 
-- SET championship = 'Brasileirão Série A' 
-- WHERE championship IS NULL;

-- 4. Verificar a estrutura atualizada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'pools'
ORDER BY ordinal_position;