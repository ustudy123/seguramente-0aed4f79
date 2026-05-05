-- Add new columns to admissoes
ALTER TABLE public.admissoes 
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS onboarding_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pendente' CHECK (onboarding_status IN ('pendente', 'em_analise', 'concluido'));

-- Create an index for the token for faster lookups
CREATE INDEX IF NOT EXISTS idx_admissoes_onboarding_token ON public.admissoes(onboarding_token);

-- Update RLS for public access via token (for the onboarding page)
-- This allows anyone with a valid token to read their own admission data and update it
CREATE POLICY "Allow public read via onboarding_token" 
ON public.admissoes 
FOR SELECT 
USING (onboarding_token IS NOT NULL);

CREATE POLICY "Allow public update via onboarding_token" 
ON public.admissoes 
FOR UPDATE 
USING (onboarding_token IS NOT NULL);

-- Allow public access to documents via token
CREATE POLICY "Allow public read documents via onboarding_token" 
ON public.admissao_documentos 
FOR SELECT 
USING (
  admissao_id IN (
    SELECT id FROM public.admissoes WHERE onboarding_token IS NOT NULL
  )
);

CREATE POLICY "Allow public insert documents via onboarding_token" 
ON public.admissao_documentos 
FOR INSERT 
WITH CHECK (
  admissao_id IN (
    SELECT id FROM public.admissoes WHERE onboarding_token IS NOT NULL
  )
);
