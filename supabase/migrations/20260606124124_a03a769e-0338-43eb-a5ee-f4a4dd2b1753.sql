-- Remove as políticas problemáticas
DROP POLICY IF EXISTS "Allow public upload for onboarding docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload for onboarding photos" ON storage.objects;

-- Recria a política de upload de fotos do colaborador
-- Caminho: colaboradores/fotos/tenant_id/nome_arquivo
CREATE POLICY "Allow public upload for onboarding photos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'documentos' 
    AND (storage.foldername(name))[1] = 'colaboradores'
    AND (storage.foldername(name))[2] = 'fotos'
);

-- Recria a política de upload de documentos da admissão
-- Caminho: admissoes/tenant_id/colaborador_id/nome_arquivo
CREATE POLICY "Allow public upload for onboarding docs"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'documentos' 
    AND (storage.foldername(name))[1] = 'admissoes'
);

-- Garantir que anon tenha acesso ao bucket (geralmente já tem se houver políticas para anon)
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.buckets TO anon;