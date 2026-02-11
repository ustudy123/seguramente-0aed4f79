
-- Enums for the strategy module
CREATE TYPE public.swot_tipo AS ENUM ('forca', 'fraqueza', 'oportunidade', 'ameaca');
CREATE TYPE public.swot_classificacao AS ENUM ('estrategico', 'operacional', 'cultural', 'pessoas', 'mercado');
CREATE TYPE public.swot_impacto AS ENUM ('baixo', 'medio', 'alto');
CREATE TYPE public.oceano_quadrante AS ENUM ('eliminar', 'reduzir', 'elevar', 'criar');

-- SWOT Analysis
CREATE TABLE public.estrategia_swot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  escopo TEXT DEFAULT 'empresa',
  unidade TEXT,
  periodo TEXT,
  projeto TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estrategia_swot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.estrategia_swot FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE TRIGGER update_estrategia_swot_updated_at BEFORE UPDATE ON public.estrategia_swot FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SWOT Items
CREATE TABLE public.estrategia_swot_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  swot_id UUID NOT NULL REFERENCES public.estrategia_swot(id) ON DELETE CASCADE,
  tipo swot_tipo NOT NULL,
  descricao TEXT NOT NULL,
  classificacao swot_classificacao DEFAULT 'estrategico',
  impacto swot_impacto DEFAULT 'medio',
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estrategia_swot_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.estrategia_swot_itens FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE TRIGGER update_estrategia_swot_itens_updated_at BEFORE UPDATE ON public.estrategia_swot_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Blue Ocean Matrix
CREATE TABLE public.estrategia_oceano_azul (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  swot_id UUID REFERENCES public.estrategia_swot(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estrategia_oceano_azul ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.estrategia_oceano_azul FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE TRIGGER update_estrategia_oceano_azul_updated_at BEFORE UPDATE ON public.estrategia_oceano_azul FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Blue Ocean Items
CREATE TABLE public.estrategia_oceano_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  oceano_id UUID NOT NULL REFERENCES public.estrategia_oceano_azul(id) ON DELETE CASCADE,
  quadrante oceano_quadrante NOT NULL,
  descricao TEXT NOT NULL,
  swot_item_id UUID REFERENCES public.estrategia_swot_itens(id) ON DELETE SET NULL,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estrategia_oceano_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.estrategia_oceano_itens FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- Culture (Mission, Vision, Values)
CREATE TABLE public.estrategia_cultura (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) UNIQUE,
  missao TEXT,
  visao TEXT,
  valores JSONB DEFAULT '[]'::jsonb,
  principios JSONB DEFAULT '[]'::jsonb,
  comportamentos_esperados JSONB DEFAULT '[]'::jsonb,
  comportamentos_nao_tolerados JSONB DEFAULT '[]'::jsonb,
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estrategia_cultura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.estrategia_cultura FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE TRIGGER update_estrategia_cultura_updated_at BEFORE UPDATE ON public.estrategia_cultura FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Organogram
CREATE TABLE public.estrategia_organograma (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  parent_id UUID REFERENCES public.estrategia_organograma(id) ON DELETE SET NULL,
  cargo_id UUID REFERENCES public.cargos(id) ON DELETE SET NULL,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  nome_ocupante TEXT,
  tipo TEXT DEFAULT 'funcao',
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estrategia_organograma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.estrategia_organograma FOR ALL USING (tenant_id = public.get_user_tenant_id());
CREATE TRIGGER update_estrategia_organograma_updated_at BEFORE UPDATE ON public.estrategia_organograma FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_swot_tenant ON public.estrategia_swot(tenant_id);
CREATE INDEX idx_swot_itens_swot ON public.estrategia_swot_itens(swot_id);
CREATE INDEX idx_oceano_swot ON public.estrategia_oceano_azul(swot_id);
CREATE INDEX idx_oceano_itens_oceano ON public.estrategia_oceano_itens(oceano_id);
CREATE INDEX idx_organograma_tenant ON public.estrategia_organograma(tenant_id);
CREATE INDEX idx_organograma_parent ON public.estrategia_organograma(parent_id);
