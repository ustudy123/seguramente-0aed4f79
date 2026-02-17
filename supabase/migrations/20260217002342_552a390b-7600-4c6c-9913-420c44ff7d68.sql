
-- Remove the unique constraint on tenant_id to allow multiple companies per tenant
ALTER TABLE public.empresa_cadastro DROP CONSTRAINT IF EXISTS empresa_cadastro_tenant_id_key;

-- Add ativo column with default true
ALTER TABLE public.empresa_cadastro ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_empresa_cadastro_tenant_ativo ON public.empresa_cadastro(tenant_id, ativo);
