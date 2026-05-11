ALTER TABLE public.plano_acoes 
ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS arquivada_em timestamptz,
ADD COLUMN IF NOT EXISTS arquivada_por text;

CREATE INDEX IF NOT EXISTS idx_plano_acoes_arquivada ON public.plano_acoes(arquivada);