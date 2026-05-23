CREATE POLICY "ponto_ajustes_externo_insert"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = 'externo'
);

CREATE POLICY "ponto_ajustes_externo_select"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = 'externo'
);