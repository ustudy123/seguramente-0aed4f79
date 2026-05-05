CREATE POLICY "Allow public update documents via onboarding_token" 
ON public.admissao_documentos 
FOR UPDATE 
TO public
USING (
  admissao_id IN (
    SELECT id FROM public.admissoes WHERE onboarding_token IS NOT NULL
  )
);
