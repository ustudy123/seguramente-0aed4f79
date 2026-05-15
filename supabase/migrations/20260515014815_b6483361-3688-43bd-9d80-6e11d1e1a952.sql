
-- ============= sst-documentos: remover policies amplas =============
DROP POLICY IF EXISTS "Tenant users can read SST docs" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can upload SST docs" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can delete SST docs" ON storage.objects;

-- ============= marketplace-docs: remover policies amplas =============
DROP POLICY IF EXISTS "Users can view their own docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own docs" ON storage.objects;

-- ============= epi-fotos: remover policies amplas e corrigir bug profiles.id -> user_id =============
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos EPI" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar suas fotos EPI" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem excluir fotos EPI" ON storage.objects;

DROP POLICY IF EXISTS "epi-fotos: tenant read" ON storage.objects;
DROP POLICY IF EXISTS "epi-fotos: tenant insert" ON storage.objects;
DROP POLICY IF EXISTS "epi-fotos: tenant update" ON storage.objects;
DROP POLICY IF EXISTS "epi-fotos: tenant delete" ON storage.objects;

CREATE POLICY "epi-fotos: tenant read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "epi-fotos: tenant insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "epi-fotos: tenant update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "epi-fotos: tenant delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- ============= ponto-ajustes-anexos: exigir prefixo de tenant =============
DROP POLICY IF EXISTS "Tenant pode ler anexos de ajuste" ON storage.objects;

CREATE POLICY "Tenant pode ler anexos de ajuste"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
);

-- ============= ouvidoria-anexos: restringir upload e remover duplicata =============
DROP POLICY IF EXISTS "Qualquer um pode subir anexo de ouvidoria" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem fazer upload de anexos" ON storage.objects;

CREATE POLICY "Upload de anexo de ouvidoria com prefixo válido"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'ouvidoria-anexos'
  AND (
    (storage.foldername(name))[1] = 'anonimo'
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);

-- Limitar tamanho do bucket ouvidoria-anexos a 10MB
UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'ouvidoria-anexos';
