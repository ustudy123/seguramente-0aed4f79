-- Remove duplicatas mantendo o mais antigo
DELETE FROM public.psicossocial_ghe_cargos a
USING public.psicossocial_ghe_cargos b
WHERE a.ctid > b.ctid
  AND a.tenant_id = b.tenant_id
  AND a.cargo_id = b.cargo_id
  AND a.departamento_id IS NOT DISTINCT FROM b.departamento_id;

-- Índice único (par cargo + departamento é exclusivo de 1 GHE no tenant)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ghe_cargo_dept_per_tenant
  ON public.psicossocial_ghe_cargos (tenant_id, cargo_id, departamento_id);