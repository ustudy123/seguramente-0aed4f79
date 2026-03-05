
-- Adicionar empresa_id nas tabelas operacionais que precisam de vínculo por empresa

-- Plano de Ação (ações são geradas no contexto de uma empresa)
ALTER TABLE public.plano_acoes
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Estratégia & Governança (SWOT, Oceano Azul, Organograma são por empresa)
ALTER TABLE public.estrategia_swot
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

ALTER TABLE public.estrategia_oceano_azul
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

ALTER TABLE public.estrategia_organograma
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Cultura (única por empresa/tenant, upsert por empresa_id+tenant_id)
ALTER TABLE public.estrategia_cultura
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Ocorrências disciplinares (por empresa)
ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Permissões de Trabalho (SST - por empresa/estabelecimento)
ALTER TABLE public.permissoes_trabalho
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Documentos SST (por empresa)
ALTER TABLE public.sst_documentos
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Terceiros (empresa prestadora vinculada à empresa contratante)
ALTER TABLE public.terceiros
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- PDIs (plano de desenvolvimento por empresa)
ALTER TABLE public.pdis
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_plano_acoes_empresa_id ON public.plano_acoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_estrategia_swot_empresa_id ON public.estrategia_swot(empresa_id);
CREATE INDEX IF NOT EXISTS idx_estrategia_oceano_azul_empresa_id ON public.estrategia_oceano_azul(empresa_id);
CREATE INDEX IF NOT EXISTS idx_estrategia_organograma_empresa_id ON public.estrategia_organograma(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_empresa_id ON public.ocorrencias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_permissoes_trabalho_empresa_id ON public.permissoes_trabalho(empresa_id);
CREATE INDEX IF NOT EXISTS idx_sst_documentos_empresa_id ON public.sst_documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_terceiros_empresa_id ON public.terceiros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pdis_empresa_id ON public.pdis(empresa_id);
