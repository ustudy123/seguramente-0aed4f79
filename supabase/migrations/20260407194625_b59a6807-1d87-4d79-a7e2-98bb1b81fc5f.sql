CREATE TABLE public.funcao_indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cargo_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  meta text,
  periodicidade text DEFAULT 'mensal',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.funcao_indicadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.funcao_indicadores
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));