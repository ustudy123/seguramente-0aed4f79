
-- Add missing columns to existing psicossocial_alertas table
ALTER TABLE public.psicossocial_alertas
  ADD COLUMN IF NOT EXISTS dimensao_id TEXT,
  ADD COLUMN IF NOT EXISTS dimensao_nome TEXT,
  ADD COLUMN IF NOT EXISTS score_risco INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_ips INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS classificacao TEXT DEFAULT 'elevado';

-- Add unique constraint for dedup
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'psicossocial_alertas_campanha_dimensao_key'
  ) THEN
    ALTER TABLE public.psicossocial_alertas 
      ADD CONSTRAINT psicossocial_alertas_campanha_dimensao_key UNIQUE (campanha_id, dimensao_id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add acao_id column if not exists (existing table has acao_criada_id)
ALTER TABLE public.psicossocial_alertas
  ADD COLUMN IF NOT EXISTS acao_id UUID REFERENCES public.plano_acoes(id);
