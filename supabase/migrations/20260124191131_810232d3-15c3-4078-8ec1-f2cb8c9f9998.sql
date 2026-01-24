-- Adicionar campos para micro-perguntas no humor_diario
ALTER TABLE public.humor_diario
ADD COLUMN micropergunta_tipo text,
ADD COLUMN micropergunta_resposta text;

-- Comentários para documentação
COMMENT ON COLUMN public.humor_diario.micropergunta_tipo IS 'Tipo/chave da micro-pergunta rotativa apresentada';
COMMENT ON COLUMN public.humor_diario.micropergunta_resposta IS 'Resposta selecionada para a micro-pergunta';