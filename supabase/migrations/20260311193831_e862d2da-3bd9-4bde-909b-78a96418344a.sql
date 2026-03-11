
-- Add selfie columns to ponto_marcacoes
ALTER TABLE public.ponto_marcacoes 
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_nome TEXT,
  ADD COLUMN IF NOT EXISTS endereco_geolocalizacao TEXT;

-- Create storage bucket for ponto selfies
INSERT INTO storage.buckets (id, name, public)
VALUES ('ponto-selfies', 'ponto-selfies', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for ponto-selfies bucket
CREATE POLICY "Authenticated users can upload ponto selfies"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ponto-selfies');

CREATE POLICY "Anyone can view ponto selfies"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ponto-selfies');

CREATE POLICY "Users can delete own ponto selfies"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ponto-selfies');
