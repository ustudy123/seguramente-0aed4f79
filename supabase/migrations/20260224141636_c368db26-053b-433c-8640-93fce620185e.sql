-- Adicionar coluna empresa_id nas tabelas principais
-- Tabela Admissões (Colaboradores)
ALTER TABLE public.admissoes 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela Afastamentos
ALTER TABLE public.afastamentos 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela Atestados
ALTER TABLE public.atestados 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela Benefícios Colaboradores
ALTER TABLE public.beneficios_colaboradores 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela Ponto Marcações
ALTER TABLE public.ponto_marcacoes 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela Ponto Diário
ALTER TABLE public.ponto_diario 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela EPIs (Estoque)
ALTER TABLE public.epis 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela EPI Entregas
ALTER TABLE public.epi_entregas 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Tabela Avaliação Ciclos
ALTER TABLE public.avaliacao_ciclos 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresa_cadastro(id);

-- Indices para performance nas consultas filtradas
CREATE INDEX IF NOT EXISTS idx_admissoes_empresa_id ON public.admissoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_afastamentos_empresa_id ON public.afastamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_atestados_empresa_id ON public.atestados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_beneficios_empresa_id ON public.beneficios_colaboradores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ponto_marcacoes_empresa_id ON public.ponto_marcacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ponto_diario_empresa_id ON public.ponto_diario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_epis_empresa_id ON public.epis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_epi_entregas_empresa_id ON public.epi_entregas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_ciclos_empresa_id ON public.avaliacao_ciclos(empresa_id);