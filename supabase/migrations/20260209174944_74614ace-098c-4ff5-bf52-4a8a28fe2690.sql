
-- ==============================================
-- MÓDULO FINANCEIRO DE PESSOAS - MVP
-- ==============================================

-- 1. Tipos de Benefícios (VA, VR, Plano Saúde, etc.)
CREATE TABLE public.beneficios_tipos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outros', -- alimentacao, saude, transporte, seguro, outros
  descricao TEXT,
  valor_padrao NUMERIC DEFAULT 0,
  tipo_desconto TEXT DEFAULT 'fixo', -- fixo, percentual
  percentual_desconto NUMERIC DEFAULT 0,
  valor_desconto_fixo NUMERIC DEFAULT 0,
  regras_cargo TEXT[] DEFAULT '{}',
  regras_vinculo TEXT[] DEFAULT '{}',
  regras_unidade TEXT[] DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficios_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers+ podem gerenciar tipos de benefícios"
  ON public.beneficios_tipos FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Usuários podem ver tipos de benefícios do tenant"
  ON public.beneficios_tipos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- 2. Benefícios vinculados a colaboradores
CREATE TABLE public.beneficios_colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  beneficio_tipo_id UUID NOT NULL REFERENCES public.beneficios_tipos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  valor_desconto NUMERIC DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, suspenso, cancelado
  motivo_cancelamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficios_colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers+ podem gerenciar benefícios de colaboradores"
  ON public.beneficios_colaboradores FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Usuários podem ver benefícios do tenant"
  ON public.beneficios_colaboradores FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- 3. Períodos da Folha de Pagamento
CREATE TABLE public.folha_periodos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  competencia TEXT NOT NULL, -- formato: YYYY-MM
  status TEXT NOT NULL DEFAULT 'aberto', -- aberto, previa, conferencia, fechado
  data_abertura DATE DEFAULT CURRENT_DATE,
  data_fechamento DATE,
  total_bruto NUMERIC DEFAULT 0,
  total_descontos NUMERIC DEFAULT 0,
  total_liquido NUMERIC DEFAULT 0,
  total_colaboradores INTEGER DEFAULT 0,
  observacoes TEXT,
  fechado_por UUID,
  fechado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, competencia)
);

ALTER TABLE public.folha_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers+ podem gerenciar períodos da folha"
  ON public.folha_periodos FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Usuários podem ver períodos do tenant"
  ON public.folha_periodos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- 4. Itens da Folha (por colaborador por período)
CREATE TABLE public.folha_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  periodo_id UUID NOT NULL REFERENCES public.folha_periodos(id) ON DELETE CASCADE,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  cargo TEXT,
  departamento TEXT,
  salario_base NUMERIC NOT NULL DEFAULT 0,
  total_proventos NUMERIC DEFAULT 0,
  total_descontos NUMERIC DEFAULT 0,
  total_liquido NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, calculado, conferido, aprovado
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers+ podem gerenciar itens da folha"
  ON public.folha_itens FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Usuários podem ver itens do tenant"
  ON public.folha_itens FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- 5. Eventos da Folha (proventos e descontos variáveis)
CREATE TABLE public.folha_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  folha_item_id UUID NOT NULL REFERENCES public.folha_itens(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- provento, desconto
  codigo TEXT,
  descricao TEXT NOT NULL,
  referencia TEXT, -- ex: "10h", "3 dias"
  valor NUMERIC NOT NULL DEFAULT 0,
  origem TEXT DEFAULT 'manual', -- manual, ponto, beneficio, ferias, afastamento
  origem_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folha_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers+ podem gerenciar eventos da folha"
  ON public.folha_eventos FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Usuários podem ver eventos do tenant"
  ON public.folha_eventos FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Triggers para updated_at
CREATE TRIGGER update_beneficios_tipos_updated_at BEFORE UPDATE ON public.beneficios_tipos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_beneficios_colaboradores_updated_at BEFORE UPDATE ON public.beneficios_colaboradores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_folha_periodos_updated_at BEFORE UPDATE ON public.folha_periodos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_folha_itens_updated_at BEFORE UPDATE ON public.folha_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
