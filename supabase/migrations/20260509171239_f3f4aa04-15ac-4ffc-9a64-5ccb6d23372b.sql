CREATE TABLE public.psicossocial_ghe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  empresa_id UUID NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psicossocial_ghe_tenant ON public.psicossocial_ghe(tenant_id);
CREATE INDEX idx_psicossocial_ghe_empresa ON public.psicossocial_ghe(empresa_id);
ALTER TABLE public.psicossocial_ghe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GHE select por tenant" ON public.psicossocial_ghe FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "GHE insert por tenant" ON public.psicossocial_ghe FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "GHE update por tenant" ON public.psicossocial_ghe FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "GHE delete por tenant" ON public.psicossocial_ghe FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER touch_psicossocial_ghe BEFORE UPDATE ON public.psicossocial_ghe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.psicossocial_ghe_cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghe_id UUID NOT NULL REFERENCES public.psicossocial_ghe(id) ON DELETE CASCADE,
  cargo_id UUID NOT NULL,
  departamento_id UUID NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ghe_id, cargo_id)
);
CREATE INDEX idx_ghe_cargos_ghe ON public.psicossocial_ghe_cargos(ghe_id);
CREATE INDEX idx_ghe_cargos_cargo ON public.psicossocial_ghe_cargos(cargo_id);
CREATE INDEX idx_ghe_cargos_tenant ON public.psicossocial_ghe_cargos(tenant_id);
ALTER TABLE public.psicossocial_ghe_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GHE Cargos select por tenant" ON public.psicossocial_ghe_cargos FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "GHE Cargos insert por tenant" ON public.psicossocial_ghe_cargos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "GHE Cargos delete por tenant" ON public.psicossocial_ghe_cargos FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());
