-- Criar bucket para anexos da ouvidoria
INSERT INTO storage.buckets (id, name, public)
VALUES ('ouvidoria-anexos', 'ouvidoria-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
-- Usuários autenticados podem fazer upload
CREATE POLICY "Usuários podem fazer upload de anexos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ouvidoria-anexos' 
  AND auth.role() = 'authenticated'
);

-- Managers+ podem ver todos os anexos do tenant
CREATE POLICY "Managers podem ver anexos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ouvidoria-anexos'
  AND auth.role() = 'authenticated'
);

-- Usuários podem deletar próprios anexos (baseado no path)
CREATE POLICY "Usuários podem deletar próprios anexos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ouvidoria-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Adicionar coluna de anexos na tabela ouvidoria
ALTER TABLE public.ouvidoria
ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;