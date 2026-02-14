
-- Permissão de Trabalho (PT)
CREATE TYPE public.pt_status AS ENUM ('rascunho', 'liberada', 'bloqueada', 'encerrada', 'cancelada');

CREATE TABLE public.permissoes_trabalho (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  terceiro_id UUID NOT NULL REFERENCES public.terceiros(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  local TEXT NOT NULL,
  atividade TEXT NOT NULL,
  descricao TEXT,
  atividades_risco TEXT[] DEFAULT '{}',
  status public.pt_status NOT NULL DEFAULT 'rascunho',
  motivo_bloqueio TEXT,
  criado_por UUID,
  criado_por_nome TEXT,
  liberado_por UUID,
  liberado_por_nome TEXT,
  liberado_em TIMESTAMPTZ,
  encerrado_por UUID,
  encerrado_por_nome TEXT,
  encerrado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: workers linked to a PT
CREATE TABLE public.permissao_trabalhadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  permissao_id UUID NOT NULL REFERENCES public.permissoes_trabalho(id) ON DELETE CASCADE,
  trabalhador_id UUID NOT NULL REFERENCES public.terceiro_trabalhadores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  docs_ok BOOLEAN NOT NULL DEFAULT false,
  treins_ok BOOLEAN NOT NULL DEFAULT false,
  aso_ok BOOLEAN NOT NULL DEFAULT false,
  apto BOOLEAN NOT NULL DEFAULT false,
  motivo_bloqueio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(permissao_id, trabalhador_id)
);

-- RLS
ALTER TABLE public.permissoes_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissao_trabalhadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access permissoes_trabalho" ON public.permissoes_trabalho
  FOR ALL USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant access permissao_trabalhadores" ON public.permissao_trabalhadores
  FOR ALL USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Auto-generate PT code
CREATE OR REPLACE FUNCTION public.gerar_codigo_pt()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 'PT-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.permissoes_trabalho
  WHERE tenant_id = NEW.tenant_id;
  NEW.codigo := 'PT-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gerar_codigo_pt
  BEFORE INSERT ON public.permissoes_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.gerar_codigo_pt();

-- Auto updated_at
CREATE TRIGGER trg_pt_updated_at
  BEFORE UPDATE ON public.permissoes_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_pt_tenant ON public.permissoes_trabalho(tenant_id);
CREATE INDEX idx_pt_terceiro ON public.permissoes_trabalho(terceiro_id);
CREATE INDEX idx_pt_status ON public.permissoes_trabalho(status);
CREATE INDEX idx_pt_trab_permissao ON public.permissao_trabalhadores(permissao_id);
