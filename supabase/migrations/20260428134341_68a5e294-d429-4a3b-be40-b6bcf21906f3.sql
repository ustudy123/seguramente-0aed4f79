
-- Adicionar coluna anexos à tabela de ajustes de ponto
ALTER TABLE public.ponto_ajustes
  ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Criar bucket privado para anexos de ajustes de ponto
INSERT INTO storage.buckets (id, name, public)
VALUES ('ponto-ajustes-anexos', 'ponto-ajustes-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas: usuários autenticados podem fazer upload em pastas com seu próprio user_id
CREATE POLICY "Authenticated users can upload ponto-ajustes attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ponto-ajustes-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can read ponto-ajustes attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete own ponto-ajustes attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ponto-ajustes-anexos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
