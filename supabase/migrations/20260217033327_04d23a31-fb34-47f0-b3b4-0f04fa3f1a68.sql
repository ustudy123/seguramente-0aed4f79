
-- Drop the old constraint that doesn't include tamanho
ALTER TABLE public.epi_estoque_local DROP CONSTRAINT IF EXISTS epi_estoque_local_epi_id_local_estoque_id_key;

-- Drop the expression-based index (doesn't work with PostgREST upsert)
DROP INDEX IF EXISTS epi_estoque_local_epi_local_tamanho_unique;

-- Set tamanho to empty string instead of null for better unique constraint handling
UPDATE public.epi_estoque_local SET tamanho = '' WHERE tamanho IS NULL;

-- Create a proper unique constraint (not expression-based)
ALTER TABLE public.epi_estoque_local 
  ALTER COLUMN tamanho SET DEFAULT '',
  ALTER COLUMN tamanho SET NOT NULL;

ALTER TABLE public.epi_estoque_local 
  ADD CONSTRAINT epi_estoque_local_epi_local_tamanho_unique 
  UNIQUE (epi_id, local_estoque_id, tenant_id, tamanho);
