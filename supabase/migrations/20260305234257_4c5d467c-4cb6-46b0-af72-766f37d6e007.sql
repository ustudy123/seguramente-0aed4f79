
-- Adicionar empresa_id em departamentos e cargos

ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

ALTER TABLE public.cargos
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departamentos_empresa_id ON public.departamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cargos_empresa_id ON public.cargos(empresa_id);
