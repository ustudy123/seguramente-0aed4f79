
-- =========================================================
-- FIX CRÍTICO: sst-documentos
-- =========================================================
DROP POLICY IF EXISTS "Tenant users can read sst-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can upload sst-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can update sst-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can delete sst-documentos" ON storage.objects;

CREATE POLICY "sst-documentos: tenant read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'sst-documentos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "sst-documentos: tenant insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sst-documentos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "sst-documentos: tenant update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sst-documentos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'sst-documentos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "sst-documentos: tenant delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sst-documentos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- =========================================================
-- FIX CRÍTICO: epi-fotos
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can read epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can upload epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can update epi-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Tenant users can delete epi-fotos" ON storage.objects;

CREATE POLICY "epi-fotos: tenant read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "epi-fotos: tenant insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "epi-fotos: tenant update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "epi-fotos: tenant delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'epi-fotos'
  AND (storage.foldername(name))[1] = (
    SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
  )
);
