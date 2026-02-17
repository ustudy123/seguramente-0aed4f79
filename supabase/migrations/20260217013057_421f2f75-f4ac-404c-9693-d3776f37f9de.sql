
-- Table for custom EPI categories (user-defined, beyond hardcoded defaults)
CREATE TABLE public.epi_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique category name per tenant
CREATE UNIQUE INDEX idx_epi_categorias_nome_tenant ON public.epi_categorias(tenant_id, nome);

-- Enable RLS
ALTER TABLE public.epi_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their categories"
  ON public.epi_categorias FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can create categories"
  ON public.epi_categorias FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant users can delete categories"
  ON public.epi_categorias FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
