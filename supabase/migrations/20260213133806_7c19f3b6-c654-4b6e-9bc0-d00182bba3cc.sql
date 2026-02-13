
-- RF-EPI-EST-03: Adicionar campos unidade_medida e tipo_durabilidade ao cadastro de EPI
ALTER TABLE public.epi_tipos
  ADD COLUMN IF NOT EXISTS unidade_medida text NOT NULL DEFAULT 'unidade',
  ADD COLUMN IF NOT EXISTS tipo_durabilidade text NOT NULL DEFAULT 'duravel';

-- Comentários para documentação
COMMENT ON COLUMN public.epi_tipos.unidade_medida IS 'Unidade de medida: unidade, par, caixa, pacote, rolo, kit';
COMMENT ON COLUMN public.epi_tipos.tipo_durabilidade IS 'Tipo de durabilidade: duravel ou descartavel';
