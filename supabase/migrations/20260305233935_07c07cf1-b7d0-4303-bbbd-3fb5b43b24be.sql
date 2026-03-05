
-- Adicionar empresa_id nas tabelas de ergonomia para vínculo com empresa/estabelecimento

ALTER TABLE public.ergonomia_itens_nr17
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

ALTER TABLE public.ergonomia_riscos
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

ALTER TABLE public.ergonomia_acoes
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

ALTER TABLE public.ergonomia_evidencias
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Índices para performance nas consultas filtradas por empresa
CREATE INDEX IF NOT EXISTS idx_ergonomia_itens_nr17_empresa_id ON public.ergonomia_itens_nr17(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ergonomia_riscos_empresa_id ON public.ergonomia_riscos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ergonomia_acoes_empresa_id ON public.ergonomia_acoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ergonomia_evidencias_empresa_id ON public.ergonomia_evidencias(empresa_id);
