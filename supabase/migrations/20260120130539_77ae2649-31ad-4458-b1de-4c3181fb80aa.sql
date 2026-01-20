-- Criar bucket de storage para documentos de admissão
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos', 
  'documentos', 
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Política para usuários autenticados fazerem upload
CREATE POLICY "Usuarios autenticados podem fazer upload de documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

-- Política para usuários autenticados visualizarem documentos do seu tenant
CREATE POLICY "Usuarios autenticados podem visualizar documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documentos');

-- Política para usuários autenticados atualizarem documentos
CREATE POLICY "Usuarios autenticados podem atualizar documentos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos');

-- Política para usuários autenticados deletarem documentos
CREATE POLICY "Usuarios autenticados podem deletar documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documentos');