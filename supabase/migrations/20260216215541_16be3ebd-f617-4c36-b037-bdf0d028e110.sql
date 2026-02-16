
-- Create storage bucket for trilha evidence uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('trilha-evidencias', 'trilha-evidencias', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload their own evidence files
CREATE POLICY "Users can upload trilha evidence"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trilha-evidencias'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Users can view their own evidence files
CREATE POLICY "Users can view own trilha evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trilha-evidencias'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Managers/admins can view all evidence in their tenant
CREATE POLICY "Managers can view all trilha evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trilha-evidencias'
  AND auth.uid() IS NOT NULL
  AND public.has_minimum_role(auth.uid(), 'manager')
);

-- RLS: Users can delete their own evidence
CREATE POLICY "Users can delete own trilha evidence"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trilha-evidencias'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);
