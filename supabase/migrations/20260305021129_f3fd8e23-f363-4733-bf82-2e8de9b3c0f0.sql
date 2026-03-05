
ALTER TABLE public.programa_validador_clientes
ADD COLUMN IF NOT EXISTS empresa_cadastro_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programa_validador_clientes_empresa_cadastro_id
  ON public.programa_validador_clientes(empresa_cadastro_id);
