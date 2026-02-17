
-- Adicionar campos de vínculo POP na tabela documentos
ALTER TABLE public.documentos
ADD COLUMN IF NOT EXISTS pop_id UUID,
ADD COLUMN IF NOT EXISTS funcao_vinculada TEXT,
ADD COLUMN IF NOT EXISTS atividade_vinculada TEXT,
ADD COLUMN IF NOT EXISTS versao TEXT;

-- Índice para busca rápida por pop_id
CREATE INDEX IF NOT EXISTS idx_documentos_pop_id ON public.documentos(pop_id) WHERE pop_id IS NOT NULL;
