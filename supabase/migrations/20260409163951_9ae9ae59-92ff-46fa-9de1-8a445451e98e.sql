
-- =============================================
-- 1. STORAGE: Fix tenant isolation
-- =============================================

-- eventos-sst: Add tenant check
DROP POLICY IF EXISTS "Auth users can view evento sst files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload evento sst files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete evento sst files" ON storage.objects;

CREATE POLICY "Tenant users can view evento sst files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eventos-sst' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can upload evento sst files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eventos-sst' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can delete evento sst files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eventos-sst' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);

-- ergonomia-evidencias: Add tenant check
DROP POLICY IF EXISTS "Authenticated podem ver evidências ergonômicas" ON storage.objects;
DROP POLICY IF EXISTS "Managers podem fazer upload de evidências ergonômicas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated podem deletar evidências ergonômicas" ON storage.objects;

CREATE POLICY "Tenant users can view ergonomia evidencias" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ergonomia-evidencias' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can upload ergonomia evidencias" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ergonomia-evidencias' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can delete ergonomia evidencias" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ergonomia-evidencias' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- jornada-documentos: Add tenant check
DROP POLICY IF EXISTS "Authenticated users can read jornada docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload jornada docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete jornada docs" ON storage.objects;

CREATE POLICY "Tenant users can read jornada docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'jornada-documentos' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can upload jornada docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'jornada-documentos' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can delete jornada docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'jornada-documentos' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);

-- hub-contabil: Add tenant check
DROP POLICY IF EXISTS "Authenticated users can upload hub-contabil files" ON storage.objects;

CREATE POLICY "Tenant users can upload hub-contabil files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hub-contabil' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
-- Add missing SELECT and DELETE policies
CREATE POLICY "Tenant users can view hub-contabil files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hub-contabil' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can delete hub-contabil files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hub-contabil' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text AND has_minimum_role(auth.uid(), 'manager'::app_role));

-- ponto-selfies: Add tenant check
DROP POLICY IF EXISTS "Anyone can view ponto selfies" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ponto selfies" ON storage.objects;

CREATE POLICY "Tenant users can view ponto selfies" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ponto-selfies' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);
CREATE POLICY "Tenant users can upload ponto selfies" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ponto-selfies' AND (storage.foldername(name))[1] = (get_user_tenant_id())::text);

-- =============================================
-- 2. OTP: Remove anon direct SELECT
-- =============================================
DROP POLICY IF EXISTS "Anon pode ler OTP por telefone e campanha" ON public.psicossocial_otp_verificacao;

-- =============================================
-- 3. CONVITES: Remove public USING(true) policy
-- =============================================
DROP POLICY IF EXISTS "Acesso público para buscar convite por token" ON public.questionario_psicossocial_convites;

-- =============================================
-- 4. CONSENTIMENTOS: Restrict anon insert
-- =============================================
DROP POLICY IF EXISTS "Permitir inserção anônima de consentimento" ON public.psicossocial_consentimentos;
CREATE POLICY "Anon pode inserir consentimento com campanha" ON public.psicossocial_consentimentos
  FOR INSERT TO anon, authenticated
  WITH CHECK (campanha_id IS NOT NULL);
