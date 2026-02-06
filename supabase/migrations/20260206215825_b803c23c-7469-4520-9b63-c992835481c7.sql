-- Adicionar tipo de campanha e campos para reaplicação controlada
ALTER TABLE public.questionario_psicossocial_campanhas
ADD COLUMN tipo text NOT NULL DEFAULT 'regular' CHECK (tipo IN ('regular', 'extraordinaria')),
ADD COLUMN motivo_extraordinaria text,
ADD COLUMN evento_gatilho_tipo text,
ADD COLUMN evento_gatilho_id uuid,
ADD COLUMN campanha_anterior_id uuid REFERENCES public.questionario_psicossocial_campanhas(id),
ADD COLUMN periodicidade text CHECK (periodicidade IN ('mensal', 'trimestral', 'semestral', 'anual'));

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.tipo IS 'Tipo da campanha: regular (ciclo programado) ou extraordinaria (reaplicação controlada)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.motivo_extraordinaria IS 'Motivo da reaplicação extraordinária (acidente, reestruturação, conflito, etc)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.evento_gatilho_tipo IS 'Tipo do evento que gatilhou a reaplicação (acidente, denuncia, ia_sugestao, solicitacao_colaborador)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.evento_gatilho_id IS 'ID do evento relacionado (ouvidoria, atestado, etc)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.campanha_anterior_id IS 'Referência à campanha anterior para comparação';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.periodicidade IS 'Periodicidade do ciclo regular';