-- =========================================================
-- STORAGE: bucket para conteúdo de módulos de trilha
--
-- Módulos do tipo PDF / Apresentação precisam de upload de arquivo
-- (hoje o editor só aceitava URL). O arquivo é exibido em <iframe>
-- no executor da trilha, então o bucket é PÚBLICO para leitura.
--
-- Escrita: usuários autenticados (criação/edição de módulo já é
-- restrita na aplicação a gestor/RH/admin). Leitura: pública.
-- =========================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trilha-conteudo', 'trilha-conteudo', true, 52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png','image/jpeg','image/jpg','image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 52428800,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública (necessária para o iframe do PDF/apresentação)
DROP POLICY IF EXISTS "Public can view trilha conteudo" ON storage.objects;
CREATE POLICY "Public can view trilha conteudo" ON storage.objects
  FOR SELECT USING (bucket_id = 'trilha-conteudo');

-- Escrita por usuários autenticados
DROP POLICY IF EXISTS "Authenticated can upload trilha conteudo" ON storage.objects;
CREATE POLICY "Authenticated can upload trilha conteudo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trilha-conteudo');

DROP POLICY IF EXISTS "Authenticated can update trilha conteudo" ON storage.objects;
CREATE POLICY "Authenticated can update trilha conteudo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'trilha-conteudo');

DROP POLICY IF EXISTS "Authenticated can delete trilha conteudo" ON storage.objects;
CREATE POLICY "Authenticated can delete trilha conteudo" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'trilha-conteudo');
