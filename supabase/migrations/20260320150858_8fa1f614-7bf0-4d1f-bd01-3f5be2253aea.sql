-- Add legal classification fields to eventos_sst
ALTER TABLE public.eventos_sst 
  ADD COLUMN IF NOT EXISTS tipo_acidente_legal TEXT,
  ADD COLUMN IF NOT EXISTS cid10 TEXT,
  ADD COLUMN IF NOT EXISTS nexo_causal TEXT,
  ADD COLUMN IF NOT EXISTS agente_causador_esocial TEXT,
  ADD COLUMN IF NOT EXISTS dias_afastamento_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_perdidas NUMERIC(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_eventos_sst_tipo_legal ON public.eventos_sst(tenant_id, tipo_acidente_legal);
CREATE INDEX IF NOT EXISTS idx_eventos_sst_cid10 ON public.eventos_sst(tenant_id, cid10);