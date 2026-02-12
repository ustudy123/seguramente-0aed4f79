
-- Table to store PDI signature links
CREATE TABLE public.pdi_assinatura_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  pdi_id UUID NOT NULL REFERENCES public.pdis(id) ON DELETE CASCADE,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  signatario_nome TEXT NOT NULL,
  signatario_papel TEXT NOT NULL, -- 'colaborador', 'lider', 'rh'
  signatario_telefone TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'assinado', 'expirado'
  documento_storage_path TEXT, -- path to the generated HTML in storage
  assinatura_url TEXT, -- path to signature image in storage
  assinado_em TIMESTAMPTZ,
  ip_assinatura TEXT,
  user_agent_assinatura TEXT,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdi_assinatura_links ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view signature links"
  ON public.pdi_assinatura_links FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can create signature links"
  ON public.pdi_assinatura_links FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant members can update signature links"
  ON public.pdi_assinatura_links FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER update_pdi_assinatura_links_updated_at
  BEFORE UPDATE ON public.pdi_assinatura_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
