
-- Add empresa_id to filiais table to link establishments to companies
ALTER TABLE public.filiais 
ADD COLUMN empresa_id UUID REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_filiais_empresa_id ON public.filiais(empresa_id);
