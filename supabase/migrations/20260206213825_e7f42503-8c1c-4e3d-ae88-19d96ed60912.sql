-- Adicionar campos para modelo híbrido de anonimato nas campanhas
ALTER TABLE public.questionario_psicossocial_campanhas
ADD COLUMN IF NOT EXISTS permite_identificacao_voluntaria boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS mensagem_institucional text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS politica_uso_dados text DEFAULT NULL;

-- Adicionar campo para registrar se colaborador optou por se identificar na resposta
ALTER TABLE public.questionario_psicossocial_respostas
ADD COLUMN IF NOT EXISTS identificacao_voluntaria boolean NOT NULL DEFAULT false;

-- Adicionar comentários para documentar os campos
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.anonimo IS 'Se true, questionário é anônimo por padrão (não exibe nome/CPF)';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.permite_identificacao_voluntaria IS 'Se true, permite que colaborador opte por se identificar voluntariamente';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.mensagem_institucional IS 'Mensagem personalizada exibida ao colaborador sobre uso dos dados';
COMMENT ON COLUMN public.questionario_psicossocial_campanhas.politica_uso_dados IS 'Texto completo da política de uso dos dados para LGPD';
COMMENT ON COLUMN public.questionario_psicossocial_respostas.identificacao_voluntaria IS 'Se true, colaborador optou voluntariamente por se identificar';