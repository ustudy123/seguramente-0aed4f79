
-- ============================================================
-- 🔴 CRÍTICAS — Storage cross-tenant
-- ============================================================
-- Padrão: substituir policies amplas (bucket_id = 'X' AND auth.role()='authenticated')
-- por policies tenant-scoped via storage.foldername(name)[1] = tenant_id.

-- Helper: pega tenant_id do usuário corrente
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- ──────── BUCKET: documentos ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%''documentos''%' OR with_check ILIKE '%''documentos''%')
      AND policyname NOT ILIKE '%tenant%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "documentos_tenant_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "documentos_tenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "documentos_tenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "documentos_tenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

-- ──────── BUCKET: esocial-certificados ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%''esocial-certificados''%' OR with_check ILIKE '%''esocial-certificados''%')
      AND policyname NOT ILIKE '%tenant%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "esocial_certs_tenant_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'esocial-certificados'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "esocial_certs_tenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'esocial-certificados'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "esocial_certs_tenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'esocial-certificados'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "esocial_certs_tenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'esocial-certificados'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

-- ──────── BUCKET: hub-contabil ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%''hub-contabil''%' OR with_check ILIKE '%''hub-contabil''%')
      AND policyname NOT ILIKE '%tenant%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "hub_contabil_tenant_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hub-contabil'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "hub_contabil_tenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hub-contabil'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "hub_contabil_tenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'hub-contabil'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "hub_contabil_tenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'hub-contabil'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

-- ──────── BUCKET: plano-evidencias ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%''plano-evidencias''%' OR with_check ILIKE '%''plano-evidencias''%')
      AND policyname NOT ILIKE '%tenant%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "plano_evid_tenant_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'plano-evidencias'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "plano_evid_tenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'plano-evidencias'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "plano_evid_tenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'plano-evidencias'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "plano_evid_tenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'plano-evidencias'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

-- ──────── BUCKET: ponto-ajustes-anexos (HIGH) ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual ILIKE '%''ponto-ajustes-anexos''%' OR with_check ILIKE '%''ponto-ajustes-anexos''%')
      AND policyname NOT ILIKE '%tenant%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "ponto_ajustes_tenant_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "ponto_ajustes_tenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "ponto_ajustes_tenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

CREATE POLICY "ponto_ajustes_tenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND (storage.foldername(name))[1] = public.current_user_tenant_id()::text
);

-- ============================================================
-- 🟡 ALTAS — Tabelas
-- ============================================================

-- ──────── advertencia_links: UPDATE só manager+ ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='advertencia_links' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.advertencia_links', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "advertencia_links_update_manager"
ON public.advertencia_links FOR UPDATE
TO authenticated
USING (
  tenant_id = public.current_user_tenant_id()
  AND public.has_minimum_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  tenant_id = public.current_user_tenant_id()
  AND public.has_minimum_role(auth.uid(), 'manager'::app_role)
);

-- ──────── psicossocial_otp_verificacao: bloquear UPDATE anon ────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='psicossocial_otp_verificacao'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.psicossocial_otp_verificacao', p.policyname);
  END LOOP;
END $$;

-- Apenas service_role (edge function) pode operar a tabela.
-- Como SECURITY DEFINER funções e service_role bypass RLS, basta NÃO criar policy para anon/authenticated.
-- Mantém RLS habilitado e nega acesso direto via API pública.
ALTER TABLE public.psicossocial_otp_verificacao ENABLE ROW LEVEL SECURITY;

-- Policy explícita de "deny" para anon/authenticated não é necessária:
-- sem policies, o acesso via PostgREST é negado por padrão.
-- A edge function `psicossocial-whatsapp-otp` usa service_role, que bypassa RLS.
