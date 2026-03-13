
-- Tabela de links de assinatura para contratos de experiência
CREATE TABLE public.experiencia_assinatura_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  signatario_nome TEXT NOT NULL,
  signatario_papel TEXT NOT NULL DEFAULT 'colaborador',
  signatario_email TEXT,
  documento_html TEXT,
  documento_storage_path TEXT,
  tipo_documento TEXT NOT NULL DEFAULT 'contrato',
  status TEXT NOT NULL DEFAULT 'pendente',
  assinado_em TIMESTAMPTZ,
  assinatura_url TEXT,
  ip_assinatura TEXT,
  user_agent_assinatura TEXT,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  criado_por UUID,
  criado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.experiencia_assinatura_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can manage their signature links"
  ON public.experiencia_assinatura_links
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- RPC pública para buscar link por token (SECURITY DEFINER - sem expor tabela)
CREATE OR REPLACE FUNCTION public.buscar_experiencia_assinatura_link(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', l.id,
    'tenant_id', l.tenant_id,
    'contrato_id', l.contrato_id,
    'signatario_nome', l.signatario_nome,
    'signatario_papel', l.signatario_papel,
    'tipo_documento', l.tipo_documento,
    'documento_html', l.documento_html,
    'documento_storage_path', l.documento_storage_path,
    'status', l.status,
    'assinado_em', l.assinado_em,
    'expira_em', l.expira_em,
    'colaborador_nome', c.colaborador_nome,
    'cargo', c.cargo,
    'data_admissao', c.data_admissao
  ) INTO result
  FROM experiencia_assinatura_links l
  LEFT JOIN contratos_experiencia c ON c.id = l.contrato_id
  WHERE l.token = p_token;

  RETURN result;
END;
$$;

-- Índices
CREATE INDEX idx_experiencia_assinatura_links_token ON public.experiencia_assinatura_links(token);
CREATE INDEX idx_experiencia_assinatura_links_contrato ON public.experiencia_assinatura_links(contrato_id);
CREATE INDEX idx_experiencia_assinatura_links_tenant ON public.experiencia_assinatura_links(tenant_id);
