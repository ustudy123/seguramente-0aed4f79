ALTER TABLE public.questionario_psicossocial_campanhas
ADD COLUMN IF NOT EXISTS ghe_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS idx_psico_campanhas_ghe_ids
ON public.questionario_psicossocial_campanhas USING GIN (ghe_ids);

COMMENT ON COLUMN public.questionario_psicossocial_campanhas.ghe_ids IS
'GHEs (Grupos Homogêneos de Exposição) vinculados à campanha — usado para estratificação por cargo/setor a partir do CPF do respondente.';