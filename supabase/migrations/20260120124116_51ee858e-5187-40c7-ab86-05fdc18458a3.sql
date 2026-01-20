-- Tabela de Departamentos
CREATE TABLE public.departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

-- Tabela de Cargos
CREATE TABLE public.cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  nivel TEXT, -- junior, pleno, senior, etc
  faixa_salarial_min NUMERIC,
  faixa_salarial_max NUMERIC,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

-- Tabela de Filiais
CREATE TABLE public.filiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  responsavel_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, nome)
);

-- Enable RLS
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filiais ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departamentos
CREATE POLICY "Usuários podem ver departamentos do seu tenant"
ON public.departamentos FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar departamentos"
ON public.departamentos FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for cargos
CREATE POLICY "Usuários podem ver cargos do seu tenant"
ON public.cargos FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar cargos"
ON public.cargos FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for filiais
CREATE POLICY "Usuários podem ver filiais do seu tenant"
ON public.filiais FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Managers+ podem gerenciar filiais"
ON public.filiais FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_departamentos_updated_at
  BEFORE UPDATE ON public.departamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cargos_updated_at
  BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_filiais_updated_at
  BEFORE UPDATE ON public.filiais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();