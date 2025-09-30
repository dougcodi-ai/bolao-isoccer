-- Adicionar campo championship à tabela matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS championship TEXT;

-- Atualizar jogos existentes com championship baseado no pool
UPDATE matches 
SET championship = pools.championship 
FROM pools 
WHERE matches.pool_id = pools.id 
  AND (matches.championship IS NULL OR matches.championship != pools.championship);

-- Verificar resultado
SELECT 
  m.id,
  m.home_team,
  m.away_team,
  m.championship as match_championship,
  p.championship as pool_championship
FROM matches m
JOIN pools p ON m.pool_id = p.id
LIMIT 10;