-- Política para permitir que qualquer pessoa (incluindo não autenticados) faça upload para pastas de onboarding
CREATE POLICY "Permitir upload público para onboarding" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'documentos' AND 
  (storage.foldername(name))[1] = 'colaboradores' AND 
  (storage.foldername(name))[2] = 'fotos'
);

CREATE POLICY "Permitir upload público para documentos de admissão" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'documentos' AND 
  (storage.foldername(name))[1] = 'admissao' AND 
  (storage.foldername(name))[2] = 'documentos'
);

-- Política para permitir visualização pública dos arquivos enviados durante o onboarding
CREATE POLICY "Permitir visualização pública de arquivos de onboarding" 
ON storage.objects 
FOR SELECT 
TO public
USING (
  bucket_id = 'documentos' AND 
  (
    ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos') OR
    ((storage.foldername(name))[1] = 'admissao' AND (storage.foldername(name))[2] = 'documentos')
  )
);
