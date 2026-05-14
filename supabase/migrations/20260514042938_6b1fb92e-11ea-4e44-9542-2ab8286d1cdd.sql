-- Helper: valida se objeto de storage pertence ao tenant do usuário
CREATE OR REPLACE FUNCTION public.user_can_access_storage_object(
  _bucket text,
  _name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _first text;
BEGIN
  _tenant := public.get_user_tenant_id();
  IF _tenant IS NULL THEN
    RETURN false;
  END IF;

  _first := split_part(_name, '/', 1);

  IF _first = _tenant::text THEN
    RETURN true;
  END IF;

  IF _bucket = 'sst-documentos' THEN
    RETURN EXISTS (SELECT 1 FROM public.sst_documentos
      WHERE tenant_id = _tenant AND arquivo_url LIKE '%' || _name);
  ELSIF _bucket = 'pdi-evidencias' THEN
    RETURN EXISTS (SELECT 1 FROM public.pdi_evidencias
      WHERE tenant_id = _tenant AND arquivo_url LIKE '%' || _name);
  ELSIF _bucket = 'plano-evidencias' THEN
    RETURN EXISTS (SELECT 1 FROM public.plano_evidencias
      WHERE tenant_id = _tenant AND arquivo_url LIKE '%' || _name);
  ELSIF _bucket = 'hub-contabil' THEN
    RETURN false;
  ELSIF _bucket = 'ouvidoria-anexos' THEN
    RETURN EXISTS (SELECT 1 FROM public.ouvidoria
      WHERE tenant_id = _tenant
        AND anexos::text LIKE '%' || _name || '%');
  ELSIF _bucket = 'marketplace-docs' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.marketplace_profissional_documentos d
      JOIN public.marketplace_profissionais p ON p.id = d.profissional_id
      WHERE p.tenant_id = _tenant
        AND d.arquivo_url LIKE '%' || _name
    );
  ELSIF _bucket = 'ponto-selfies' THEN
    RETURN EXISTS (SELECT 1 FROM public.ponto_marcacoes
      WHERE tenant_id = _tenant AND selfie_url LIKE '%' || _name);
  ELSIF _bucket = 'atestados' THEN
    RETURN EXISTS (SELECT 1 FROM public.atestados
      WHERE tenant_id = _tenant AND arquivo_url LIKE '%' || _name);
  ELSIF _bucket = 'ergonomia-evidencias' THEN
    RETURN EXISTS (SELECT 1 FROM public.ergonomia_evidencias
      WHERE tenant_id = _tenant AND arquivo_url LIKE '%' || _name);
  ELSIF _bucket = 'jornada-documentos' THEN
    RETURN EXISTS (SELECT 1 FROM public.jornada_documentos
      WHERE tenant_id = _tenant AND arquivo_url LIKE '%' || _name);
  ELSIF _bucket = 'eventos-sst' THEN
    RETURN EXISTS (SELECT 1 FROM public.eventos_sst
      WHERE tenant_id = _tenant AND cat_arquivo_url LIKE '%' || _name);
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_storage_object(text, text) TO authenticated;

-- SST-DOCUMENTOS
DROP POLICY IF EXISTS "SST documentos select" ON storage.objects;
DROP POLICY IF EXISTS "SST documentos upload" ON storage.objects;
DROP POLICY IF EXISTS "SST documentos update" ON storage.objects;
DROP POLICY IF EXISTS "SST documentos delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read sst-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload sst-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update sst-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete sst-documentos" ON storage.objects;

CREATE POLICY "Tenant pode ler sst-documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sst-documentos' AND public.user_can_access_storage_object('sst-documentos', name));

CREATE POLICY "Tenant pode inserir sst-documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sst-documentos' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

CREATE POLICY "Tenant pode atualizar sst-documentos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sst-documentos' AND public.user_can_access_storage_object('sst-documentos', name));

CREATE POLICY "Tenant pode deletar sst-documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sst-documentos' AND public.user_can_access_storage_object('sst-documentos', name));

-- PDI-EVIDENCIAS
DROP POLICY IF EXISTS "PDI evidencias select" ON storage.objects;
DROP POLICY IF EXISTS "PDI evidencias upload" ON storage.objects;
DROP POLICY IF EXISTS "PDI evidencias delete" ON storage.objects;

CREATE POLICY "Tenant pode ler pdi-evidencias"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pdi-evidencias' AND public.user_can_access_storage_object('pdi-evidencias', name));

CREATE POLICY "Tenant pode inserir pdi-evidencias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pdi-evidencias' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

CREATE POLICY "Tenant pode deletar pdi-evidencias"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pdi-evidencias' AND public.user_can_access_storage_object('pdi-evidencias', name));

-- PLANO-EVIDENCIAS
DROP POLICY IF EXISTS "Managers+ podem fazer upload de evidências" ON storage.objects;
DROP POLICY IF EXISTS "Managers+ podem deletar evidências" ON storage.objects;
DROP POLICY IF EXISTS "Plano evidencias select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read plano-evidencias" ON storage.objects;

CREATE POLICY "Tenant pode ler plano-evidencias"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'plano-evidencias' AND public.user_can_access_storage_object('plano-evidencias', name));

CREATE POLICY "Tenant pode inserir plano-evidencias"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'plano-evidencias' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

CREATE POLICY "Tenant pode deletar plano-evidencias"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'plano-evidencias' AND public.user_can_access_storage_object('plano-evidencias', name));

-- HUB-CONTABIL
DROP POLICY IF EXISTS "Hub contabil select" ON storage.objects;
DROP POLICY IF EXISTS "Hub contabil upload" ON storage.objects;
DROP POLICY IF EXISTS "Hub contabil update" ON storage.objects;
DROP POLICY IF EXISTS "Hub contabil delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read hub-contabil" ON storage.objects;

CREATE POLICY "Tenant pode ler hub-contabil"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hub-contabil' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

CREATE POLICY "Tenant pode inserir hub-contabil"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hub-contabil' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

CREATE POLICY "Tenant pode atualizar hub-contabil"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hub-contabil' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

CREATE POLICY "Tenant pode deletar hub-contabil"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hub-contabil' AND split_part(name,'/',1) = public.get_user_tenant_id()::text);

-- OUVIDORIA-ANEXOS
DROP POLICY IF EXISTS "Managers podem ver anexos" ON storage.objects;
DROP POLICY IF EXISTS "Ouvidoria anexos upload" ON storage.objects;
DROP POLICY IF EXISTS "Ouvidoria anexos select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read ouvidoria-anexos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload ouvidoria-anexos" ON storage.objects;

CREATE POLICY "Managers do tenant podem ler ouvidoria-anexos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ouvidoria-anexos'
  AND has_minimum_role(auth.uid(), 'manager'::app_role)
  AND public.user_can_access_storage_object('ouvidoria-anexos', name)
);

CREATE POLICY "Qualquer um pode subir anexo de ouvidoria"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'ouvidoria-anexos');

-- MARKETPLACE-DOCS
DROP POLICY IF EXISTS "Marketplace docs upload" ON storage.objects;
DROP POLICY IF EXISTS "Marketplace docs select" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read marketplace-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload marketplace-docs" ON storage.objects;

CREATE POLICY "Profissional dono pode ler marketplace-docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'marketplace-docs'
  AND EXISTS (
    SELECT 1 FROM public.marketplace_profissional_documentos d
    JOIN public.marketplace_profissionais p ON p.id = d.profissional_id
    WHERE d.arquivo_url LIKE '%' || storage.objects.name
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Profissional pode subir marketplace-docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'marketplace-docs'
  AND split_part(name,'/',1) IN (
    SELECT id::text FROM public.marketplace_profissionais WHERE user_id = auth.uid()
  )
);

-- PONTO-SELFIES: bloquear DELETE
DROP POLICY IF EXISTS "Ponto selfies delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete ponto-selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete ponto-selfies" ON storage.objects;

CREATE POLICY "Apenas superadmin pode deletar ponto-selfies"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ponto-selfies'
  AND has_role(auth.uid(), 'superadmin'::app_role)
);
