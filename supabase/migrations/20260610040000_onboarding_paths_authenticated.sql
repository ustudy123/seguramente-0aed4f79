-- =========================================================
-- FIX (YOUREYES-141 parte 2): upload do onboarding bloqueado
-- para usuários LOGADOS
--
-- Em 15/05 a policy ampla de INSERT para authenticated no
-- bucket `documentos` foi removida, restando apenas a
-- documentos_tenant_insert (exige caminho iniciando com o
-- tenant_id). A tela pública de Finalizar Cadastro sobe em
-- colaboradores/fotos/... e admissoes/... — caminhos liberados
-- para anon (06/06), mas BLOQUEADOS para quem está logado
-- (ex.: gestor testando o link, ou colaborador que já possui
-- conta no sistema).
--
-- Correção: espelha para authenticated as mesmas policies dos
-- caminhos de onboarding que já existem para anon.
-- =========================================================

DROP POLICY IF EXISTS "Authenticated upload onboarding paths" ON storage.objects;
CREATE POLICY "Authenticated upload onboarding paths"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos' AND (
    (storage.foldername(name))[1] = 'admissoes' OR
    ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
  )
);

DROP POLICY IF EXISTS "Authenticated read onboarding paths" ON storage.objects;
CREATE POLICY "Authenticated read onboarding paths"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos' AND (
    (storage.foldername(name))[1] = 'admissoes' OR
    ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
  )
);

DROP POLICY IF EXISTS "Authenticated update onboarding paths" ON storage.objects;
CREATE POLICY "Authenticated update onboarding paths"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos' AND (
    (storage.foldername(name))[1] = 'admissoes' OR
    ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
  )
);

DROP POLICY IF EXISTS "Authenticated delete onboarding paths" ON storage.objects;
CREATE POLICY "Authenticated delete onboarding paths"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos' AND (
    (storage.foldername(name))[1] = 'admissoes' OR
    ((storage.foldername(name))[1] = 'colaboradores' AND (storage.foldername(name))[2] = 'fotos')
  )
);
