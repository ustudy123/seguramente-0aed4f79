-- Add empresa_id to operational tables that are missing it
ALTER TABLE public.ferias_solicitacoes ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.desvios_seguranca ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.metas ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.feedbacks ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.documentos ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.documento_pastas ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.cultura_acoes ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.cultura_config ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.cultura_datas ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.cultura_marcos ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.cultura_rituais ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;
ALTER TABLE public.trilhas ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_ferias_solicitacoes_empresa ON public.ferias_solicitacoes(empresa_id);
CREATE INDEX idx_desvios_seguranca_empresa ON public.desvios_seguranca(empresa_id);
CREATE INDEX idx_metas_empresa ON public.metas(empresa_id);
CREATE INDEX idx_feedbacks_empresa ON public.feedbacks(empresa_id);
CREATE INDEX idx_documentos_empresa ON public.documentos(empresa_id);
CREATE INDEX idx_cultura_acoes_empresa ON public.cultura_acoes(empresa_id);
CREATE INDEX idx_trilhas_empresa ON public.trilhas(empresa_id);