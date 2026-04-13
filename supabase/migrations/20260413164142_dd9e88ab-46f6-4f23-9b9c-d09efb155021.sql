-- Add logo_url column to empresa_cadastro
ALTER TABLE public.empresa_cadastro ADD COLUMN IF NOT EXISTS logo_url text;

-- Create storage bucket for company logos (public for easy access in documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresas-logos', 'empresas-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for empresas-logos bucket
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresas-logos');

CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'empresas-logos');

CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'empresas-logos');

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'empresas-logos');