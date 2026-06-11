-- =========================================================
-- FIX: upload de documentos de admissão bloqueado para
-- gestores VINCULADOS (multi-empresa) — caso da Cacilda
--
-- Diagnóstico:
-- • Documentos são enviados em '{tenant_id}/admissoes/...' e
--   '{tenant_id}/colaboradores/...'
-- • A policy documentos_tenant_insert exige que a 1ª pasta seja
--   current_user_tenant_id(), que lê profiles.tenant_id — o
--   tenant PRINCIPAL do usuário
-- • A Cacilda opera na BARROS & NUERNBERG por VÍNCULO; o upload
--   vai para o tenant da Barros mas a policy compara com o tenant
--   principal dela → negado. Os docs já enviados não aparecem
--   porque a policy de SELECT tem a mesma limitação.
--
-- Correção: helper que reúne TODOS os tenants acessíveis pelo
-- usuário (profile + usuarios_base + usuario_vinculos) e
-- policies de storage que aceitam qualquer um deles.
-- =========================================================

-- ---------------------------------------------------------
-- 1) Helper: todos os tenants que o usuário pode acessar
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  UNION
  SELECT tenant_id FROM public.usuarios_base
   WHERE auth_user_id = auth.uid() AND status = 'ativo'
  UNION
  SELECT uv.tenant_id
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub ON ub.id = uv.usuario_id
   WHERE ub.auth_user_id = auth.uid()
     AND uv.status = 'ativo'
     AND (uv.data_fim IS NULL OR uv.data_fim >= CURRENT_DATE);
$$;

REVOKE EXECUTE ON FUNCTION public.user_tenant_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_tenant_ids() TO authenticated;

-- ---------------------------------------------------------
-- 2) Policies de storage do bucket 'documentos' reconhecendo
--    todos os tenants do usuário (não só o principal)
-- ---------------------------------------------------------

-- INSERT
DROP POLICY IF EXISTS "documentos_multitenant_insert" ON storage.objects;
CREATE POLICY "documentos_multitenant_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    -- caminho tenant-first: {tenant_id}/...
    (storage.foldername(name))[1] IN (SELECT public.user_tenant_ids()::text)
  )
);

-- SELECT (para os documentos já enviados voltarem a aparecer)
DROP POLICY IF EXISTS "documentos_multitenant_select" ON storage.objects;
CREATE POLICY "documentos_multitenant_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    (storage.foldername(name))[1] IN (SELECT public.user_tenant_ids()::text)
  )
);

-- UPDATE (upsert)
DROP POLICY IF EXISTS "documentos_multitenant_update" ON storage.objects;
CREATE POLICY "documentos_multitenant_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] IN (SELECT public.user_tenant_ids()::text)
);

-- DELETE
DROP POLICY IF EXISTS "documentos_multitenant_delete" ON storage.objects;
CREATE POLICY "documentos_multitenant_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] IN (SELECT public.user_tenant_ids()::text)
);

-- ---------------------------------------------------------
-- 3) RLS da tabela admissao_documentos: a gestora vinculada
--    também precisa inserir/atualizar o registro do documento
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "admissao_documentos_multitenant_all" ON public.admissao_documentos;
CREATE POLICY "admissao_documentos_multitenant_all"
ON public.admissao_documentos FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));
