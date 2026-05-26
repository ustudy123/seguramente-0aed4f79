
CREATE TABLE public.empresa_import_pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cnpj TEXT NOT NULL,
  razao_social_planilha TEXT,
  razao_social_existente TEXT,
  empresa_existente_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL,
  linha_planilha INTEGER,
  arquivo_nome TEXT,
  motivo TEXT NOT NULL DEFAULT 'cnpj_duplicado',
  status TEXT NOT NULL DEFAULT 'pendente',
  importado_por UUID,
  importado_por_nome TEXT,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emp_imp_pend_tenant ON public.empresa_import_pendencias(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_import_pendencias TO authenticated;
GRANT ALL ON public.empresa_import_pendencias TO service_role;

ALTER TABLE public.empresa_import_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select" ON public.empresa_import_pendencias
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant insert" ON public.empresa_import_pendencias
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant update" ON public.empresa_import_pendencias
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant delete" ON public.empresa_import_pendencias
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER update_emp_imp_pend_updated_at
  BEFORE UPDATE ON public.empresa_import_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
