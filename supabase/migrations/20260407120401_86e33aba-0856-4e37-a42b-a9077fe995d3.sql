ALTER TABLE public.empresa_cadastro 
ADD COLUMN IF NOT EXISTS ai_context TEXT;

COMMENT ON COLUMN public.empresa_cadastro.ai_context IS 'Informações de contexto da empresa para serem usadas por ferramentas de IA em todo o sistema.';