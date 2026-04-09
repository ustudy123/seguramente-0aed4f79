
-- Adicionar novos campos na tabela cargos
ALTER TABLE public.cargos
ADD COLUMN IF NOT EXISTS subordinacao TEXT,
ADD COLUMN IF NOT EXISTS interfaces_cargo TEXT,
ADD COLUMN IF NOT EXISTS objetivo_funcao TEXT,
ADD COLUMN IF NOT EXISTS escopo_geral TEXT,
ADD COLUMN IF NOT EXISTS padroes_execucao TEXT,
ADD COLUMN IF NOT EXISTS cultura_esperada TEXT,
ADD COLUMN IF NOT EXISTS erros_riscos TEXT,
ADD COLUMN IF NOT EXISTS criterios_sucesso TEXT,
ADD COLUMN IF NOT EXISTS ferramentas_cargo TEXT;

-- Adicionar novos campos na tabela funcao_atividades
ALTER TABLE public.funcao_atividades
ADD COLUMN IF NOT EXISTS como TEXT,
ADD COLUMN IF NOT EXISTS resultado_esperado TEXT,
ADD COLUMN IF NOT EXISTS processo TEXT;
