
-- Tabela para links de assinatura digital de aviso de férias
CREATE TABLE public.ferias_assinatura_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  colaborador_nome TEXT NOT NULL,
  colaborador_cpf TEXT,
  departamento TEXT,
  cargo TEXT,
  data_inicio_ferias TEXT NOT NULL,
  data_fim_ferias TEXT NOT NULL,
  dias_ferias INTEGER NOT NULL,
  abono_pecuniario BOOLEAN DEFAULT false,
  dias_abono INTEGER DEFAULT 0,
  salario_base NUMERIC DEFAULT 0,
  documento_storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'assinado', 'expirado')),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  assinado_em TIMESTAMPTZ,
  assinatura_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ferias_assinatura_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view ferias links"
  ON public.ferias_assinatura_links FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant users can insert ferias links"
  ON public.ferias_assinatura_links FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant users can update ferias links"
  ON public.ferias_assinatura_links FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_ferias_assinatura_links_updated_at
  BEFORE UPDATE ON public.ferias_assinatura_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
