
-- Add ranking boost column for professionals with technical capacity certificates
ALTER TABLE public.marketplace_profissionais
ADD COLUMN tem_atestado_capacidade boolean NOT NULL DEFAULT false;

-- Add index for ranking queries
CREATE INDEX idx_marketplace_prof_ranking ON public.marketplace_profissionais (status, tem_atestado_capacidade DESC, created_at);
