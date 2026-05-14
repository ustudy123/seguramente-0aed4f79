
-- =========================================================
-- 1) landing_leads — validação básica para evitar abuso
-- =========================================================
ALTER TABLE public.landing_leads
  DROP CONSTRAINT IF EXISTS landing_leads_nome_len,
  DROP CONSTRAINT IF EXISTS landing_leads_email_len,
  DROP CONSTRAINT IF EXISTS landing_leads_email_fmt,
  DROP CONSTRAINT IF EXISTS landing_leads_telefone_len,
  DROP CONSTRAINT IF EXISTS landing_leads_empresa_len,
  DROP CONSTRAINT IF EXISTS landing_leads_cargo_len,
  DROP CONSTRAINT IF EXISTS landing_leads_setor_len,
  DROP CONSTRAINT IF EXISTS landing_leads_diag_size;

ALTER TABLE public.landing_leads
  ADD CONSTRAINT landing_leads_nome_len      CHECK (nome IS NULL OR char_length(nome) <= 200),
  ADD CONSTRAINT landing_leads_email_len     CHECK (email IS NULL OR char_length(email) <= 320),
  ADD CONSTRAINT landing_leads_email_fmt     CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT landing_leads_telefone_len  CHECK (telefone IS NULL OR char_length(telefone) <= 30),
  ADD CONSTRAINT landing_leads_empresa_len   CHECK (empresa IS NULL OR char_length(empresa) <= 300),
  ADD CONSTRAINT landing_leads_cargo_len     CHECK (cargo IS NULL OR char_length(cargo) <= 200),
  ADD CONSTRAINT landing_leads_setor_len     CHECK (setor IS NULL OR char_length(setor) <= 200),
  ADD CONSTRAINT landing_leads_diag_size     CHECK (diagnostico_resultado IS NULL OR pg_column_size(diagnostico_resultado) <= 16384);

-- =========================================================
-- 2) psicossocial_telefone_usado — remover acesso anônimo
-- =========================================================
DROP POLICY IF EXISTS "Anon pode inserir telefone usado por campanha"  ON public.psicossocial_telefone_usado;
DROP POLICY IF EXISTS "Anon pode verificar telefone usado por campanha" ON public.psicossocial_telefone_usado;

-- =========================================================
-- 3) hub-contabil — remover política de leitura ampla
-- =========================================================
DROP POLICY IF EXISTS "Users can view hub-contabil files from their tenant" ON storage.objects;

-- =========================================================
-- 4) empresas-logos — restringir upload/update/delete ao tenant dono
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;

CREATE POLICY "empresas-logos: tenant upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'empresas-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresa_cadastro ec
    WHERE ec.id::text = (storage.foldername(name))[1]
      AND ec.tenant_id = public.get_user_tenant_id()
  )
);

CREATE POLICY "empresas-logos: tenant update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'empresas-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresa_cadastro ec
    WHERE ec.id::text = (storage.foldername(name))[1]
      AND ec.tenant_id = public.get_user_tenant_id()
  )
)
WITH CHECK (
  bucket_id = 'empresas-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresa_cadastro ec
    WHERE ec.id::text = (storage.foldername(name))[1]
      AND ec.tenant_id = public.get_user_tenant_id()
  )
);

CREATE POLICY "empresas-logos: tenant delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'empresas-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresa_cadastro ec
    WHERE ec.id::text = (storage.foldername(name))[1]
      AND ec.tenant_id = public.get_user_tenant_id()
  )
);
