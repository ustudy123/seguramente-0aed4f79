
CREATE TABLE IF NOT EXISTS public.cargo_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cargo_id, departamento_id)
);

CREATE INDEX IF NOT EXISTS idx_cargo_departamentos_cargo ON public.cargo_departamentos(cargo_id);
CREATE INDEX IF NOT EXISTS idx_cargo_departamentos_dep ON public.cargo_departamentos(departamento_id);
CREATE INDEX IF NOT EXISTS idx_cargo_departamentos_tenant ON public.cargo_departamentos(tenant_id);

ALTER TABLE public.cargo_departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select cargo_departamentos by tenant"
ON public.cargo_departamentos FOR SELECT
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "insert cargo_departamentos by tenant"
ON public.cargo_departamentos FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "update cargo_departamentos by tenant"
ON public.cargo_departamentos FOR UPDATE
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "delete cargo_departamentos by tenant"
ON public.cargo_departamentos FOR DELETE
USING (tenant_id = public.get_user_tenant_id());
