ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS gestor_admissao_id uuid REFERENCES public.admissoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gestor_substituto_admissao_id uuid REFERENCES public.admissoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituto_ativo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_departamentos_gestor_admissao ON public.departamentos(gestor_admissao_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_gestor_sub_admissao ON public.departamentos(gestor_substituto_admissao_id);

NOTIFY pgrst, 'reload schema';