-- Adiciona colunas de escopo/situações de trabalho na tabela de campanhas psicossociais
-- Conformidade: NR-1, NR-17, ISO 45003 — unidade de análise = situação de trabalho (setor+função)

ALTER TABLE public.questionario_psicossocial_campanhas
  ADD COLUMN IF NOT EXISTS situacoes_trabalho JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escopo_tipo TEXT DEFAULT 'empresa';

CREATE INDEX IF NOT EXISTS idx_campanhas_psico_situacoes 
  ON public.questionario_psicossocial_campanhas USING GIN (situacoes_trabalho);

COMMENT ON COLUMN public.questionario_psicossocial_campanhas.situacoes_trabalho IS 
  'Array de pares {setorId, setorNome, funcaoId, funcaoNome} — unidade de análise NR-17. Obrigatório para exportação ao GRO.';

COMMENT ON COLUMN public.questionario_psicossocial_campanhas.escopo_tipo IS 
  'Tipo de escopo da campanha. Se empresa, situacoes_trabalho deve ser preenchido para envio ao GRO.';