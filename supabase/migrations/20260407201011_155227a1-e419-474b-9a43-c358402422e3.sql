CREATE TABLE public.manuais_gerados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('funcao', 'funcao_global', 'cultura')),
  referencia_id TEXT,
  titulo TEXT NOT NULL,
  html TEXT NOT NULL,
  documento_id UUID,
  gerado_por UUID,
  gerado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.manuais_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view manuais"
  ON public.manuais_gerados FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can insert manuais"
  ON public.manuais_gerados FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can update manuais"
  ON public.manuais_gerados FOR UPDATE
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_manuais_gerados_lookup ON public.manuais_gerados (tenant_id, tipo, referencia_id);

CREATE TRIGGER update_manuais_gerados_updated_at
  BEFORE UPDATE ON public.manuais_gerados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();