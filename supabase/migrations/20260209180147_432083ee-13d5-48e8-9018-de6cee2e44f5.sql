
-- Table to track holerite signature requests
CREATE TABLE public.holerite_assinaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  folha_item_id UUID NOT NULL,
  colaborador_id TEXT NOT NULL,
  colaborador_nome TEXT NOT NULL,
  competencia TEXT NOT NULL,
  documento_id UUID REFERENCES public.documentos(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_por TEXT,
  enviado_por_nome TEXT,
  assinado_em TIMESTAMPTZ,
  ip_assinatura TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.holerite_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for holerite_assinaturas"
ON public.holerite_assinaturas
FOR ALL
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_holerite_assinaturas_updated_at
BEFORE UPDATE ON public.holerite_assinaturas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
