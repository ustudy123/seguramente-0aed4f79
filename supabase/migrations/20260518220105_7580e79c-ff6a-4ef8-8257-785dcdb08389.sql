ALTER TABLE public.psicossocial_ghe_cargos
  DROP CONSTRAINT IF EXISTS psicossocial_ghe_cargos_ghe_id_cargo_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS psicossocial_ghe_cargos_ghe_cargo_dept_uniq
  ON public.psicossocial_ghe_cargos (ghe_id, cargo_id, COALESCE(departamento_id, '00000000-0000-0000-0000-000000000000'::uuid));