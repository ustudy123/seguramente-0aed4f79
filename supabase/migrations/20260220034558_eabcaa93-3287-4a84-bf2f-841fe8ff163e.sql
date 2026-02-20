
-- Calendário de envios/recebimentos recorrentes
CREATE TABLE public.hub_calendario_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'envio', -- 'envio' ou 'recebimento'
  categoria TEXT NOT NULL, -- 'folha', 'fgts', 'inss', 'irrf', 'darf', 'gps', 'esocial', 'dctfweb', 'outro'
  dia_limite INTEGER NOT NULL CHECK (dia_limite >= 1 AND dia_limite <= 31),
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_calendario_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.hub_calendario_envios
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_hub_calendario_envios_updated_at
  BEFORE UPDATE ON public.hub_calendario_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para rastrear status mensal de cada item do calendário
CREATE TABLE public.hub_calendario_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendario_id UUID NOT NULL REFERENCES public.hub_calendario_envios(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- '2026-02'
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'concluido', 'atrasado'
  concluido_por TEXT,
  concluido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, calendario_id, competencia)
);

ALTER TABLE public.hub_calendario_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.hub_calendario_status
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_hub_calendario_status_updated_at
  BEFORE UPDATE ON public.hub_calendario_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
