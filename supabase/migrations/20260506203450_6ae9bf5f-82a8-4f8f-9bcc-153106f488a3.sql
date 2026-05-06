-- Permitir múltiplos registros de cultura por tenant, um por empresa/grupo
-- Remove a unique constraint que limita a 1 cultura por tenant (caso exista)
DO $$
DECLARE
  c_name text;
BEGIN
  FOR c_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.estrategia_cultura'::regclass
      AND contype IN ('u','p')
      AND conname <> 'estrategia_cultura_pkey'
  LOOP
    EXECUTE format('ALTER TABLE public.estrategia_cultura DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

-- Garante unicidade por (tenant, empresa) e (tenant, grupo)
CREATE UNIQUE INDEX IF NOT EXISTS estrategia_cultura_tenant_empresa_uniq
  ON public.estrategia_cultura (tenant_id, empresa_id)
  WHERE empresa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS estrategia_cultura_tenant_grupo_uniq
  ON public.estrategia_cultura (tenant_id, grupo_economico_id)
  WHERE grupo_economico_id IS NOT NULL;