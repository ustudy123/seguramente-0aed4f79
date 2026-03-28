-- Add empresa_id to questionario_psicossocial_campanhas
ALTER TABLE public.questionario_psicossocial_campanhas 
ADD COLUMN empresa_id uuid REFERENCES public.empresa_cadastro(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_psicossocial_campanhas_empresa ON public.questionario_psicossocial_campanhas(empresa_id);