
-- Tabela de Grupos Econômicos
CREATE TABLE public.grupos_economicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  logo_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.grupos_economicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.grupos_economicos
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_grupos_economicos_updated_at
  BEFORE UPDATE ON public.grupos_economicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_grupos_economicos_tenant ON public.grupos_economicos(tenant_id);

-- Campos de hierarquia na empresa_cadastro
ALTER TABLE public.empresa_cadastro
  ADD COLUMN grupo_economico_id UUID REFERENCES public.grupos_economicos(id),
  ADD COLUMN tipo_unidade TEXT NOT NULL DEFAULT 'matriz' CHECK (tipo_unidade IN ('matriz', 'filial')),
  ADD COLUMN matriz_id UUID REFERENCES public.empresa_cadastro(id);

CREATE INDEX idx_empresa_grupo ON public.empresa_cadastro(grupo_economico_id);
CREATE INDEX idx_empresa_matriz ON public.empresa_cadastro(matriz_id);
