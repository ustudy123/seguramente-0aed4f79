-- Adicionar campos de exame admissional na tabela admissoes
ALTER TABLE public.admissoes 
ADD COLUMN IF NOT EXISTS exame_admissional_data DATE,
ADD COLUMN IF NOT EXISTS exame_admissional_validade DATE,
ADD COLUMN IF NOT EXISTS exame_admissional_resultado TEXT,
ADD COLUMN IF NOT EXISTS exame_admissional_clinica TEXT,
ADD COLUMN IF NOT EXISTS exame_admissional_medico TEXT,
ADD COLUMN IF NOT EXISTS exame_admissional_crm TEXT,
ADD COLUMN IF NOT EXISTS exame_admissional_observacoes TEXT;

-- Adicionar campo de periodicidade de exames na tabela de cargos
ALTER TABLE public.cargos
ADD COLUMN IF NOT EXISTS periodicidade_exame_meses INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS exames_obrigatorios TEXT[] DEFAULT ARRAY['Clínico Geral'];

-- Comentários para documentação
COMMENT ON COLUMN public.admissoes.exame_admissional_data IS 'Data de realização do exame admissional';
COMMENT ON COLUMN public.admissoes.exame_admissional_validade IS 'Data de validade do exame admissional';
COMMENT ON COLUMN public.admissoes.exame_admissional_resultado IS 'Resultado do exame: apto, inapto, apto_com_restricoes';
COMMENT ON COLUMN public.admissoes.exame_admissional_clinica IS 'Nome da clínica onde foi realizado o exame';
COMMENT ON COLUMN public.admissoes.exame_admissional_medico IS 'Nome do médico responsável';
COMMENT ON COLUMN public.admissoes.exame_admissional_crm IS 'CRM do médico responsável';
COMMENT ON COLUMN public.admissoes.exame_admissional_observacoes IS 'Observações sobre o exame';
COMMENT ON COLUMN public.cargos.periodicidade_exame_meses IS 'Periodicidade de realização de exames ocupacionais em meses';
COMMENT ON COLUMN public.cargos.exames_obrigatorios IS 'Lista de exames obrigatórios para o cargo';