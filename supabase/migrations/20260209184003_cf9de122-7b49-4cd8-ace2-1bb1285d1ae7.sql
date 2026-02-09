
-- ==========================================
-- 1. Tabela de Condições Especiais de Trabalho (CET)
-- ==========================================
CREATE TABLE public.condicoes_especiais_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  norma_regulamentadora TEXT, -- NR-35, NR-33, NR-10, etc.
  icone TEXT, -- nome do ícone lucide
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

ALTER TABLE public.condicoes_especiais_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.condicoes_especiais_trabalho
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_cet_updated_at
  BEFORE UPDATE ON public.condicoes_especiais_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 2. Tabela Função × EPI (Matriz de Proteção Esperada)
-- ==========================================
CREATE TABLE public.funcao_epis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  epi_tipo_id UUID NOT NULL REFERENCES public.epi_tipos(id) ON DELETE CASCADE,
  obrigatorio BOOLEAN NOT NULL DEFAULT true, -- true=obrigatório, false=complementar
  justificativa TEXT, -- por que este EPI é necessário
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cargo_id, epi_tipo_id)
);

ALTER TABLE public.funcao_epis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.funcao_epis
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ==========================================
-- 3. Tabela Função × CET
-- ==========================================
CREATE TABLE public.funcao_cets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  cargo_id UUID NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  cet_id UUID NOT NULL REFERENCES public.condicoes_especiais_trabalho(id) ON DELETE CASCADE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, cargo_id, cet_id)
);

ALTER TABLE public.funcao_cets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.funcao_cets
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ==========================================
-- 4. Tabela EPI × CET (qual EPI atende qual CET)
-- ==========================================
CREATE TABLE public.epi_cets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  epi_tipo_id UUID NOT NULL REFERENCES public.epi_tipos(id) ON DELETE CASCADE,
  cet_id UUID NOT NULL REFERENCES public.condicoes_especiais_trabalho(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, epi_tipo_id, cet_id)
);

ALTER TABLE public.epi_cets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.epi_cets
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

-- ==========================================
-- 5. Índices para performance
-- ==========================================
CREATE INDEX idx_funcao_epis_cargo ON public.funcao_epis(cargo_id);
CREATE INDEX idx_funcao_epis_tipo ON public.funcao_epis(epi_tipo_id);
CREATE INDEX idx_funcao_cets_cargo ON public.funcao_cets(cargo_id);
CREATE INDEX idx_funcao_cets_cet ON public.funcao_cets(cet_id);
CREATE INDEX idx_epi_cets_tipo ON public.epi_cets(epi_tipo_id);
CREATE INDEX idx_epi_cets_cet ON public.epi_cets(cet_id);
