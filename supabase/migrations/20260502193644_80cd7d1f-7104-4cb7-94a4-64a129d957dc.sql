ALTER TABLE public.departamentos
ADD COLUMN IF NOT EXISTS filial_id uuid REFERENCES public.filiais(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departamentos_filial_id ON public.departamentos(filial_id);