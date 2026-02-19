
-- Create storage bucket for hub-contabil files
INSERT INTO storage.buckets (id, name, public) VALUES ('hub-contabil', 'hub-contabil', false);

-- RLS policies for hub-contabil bucket
CREATE POLICY "Authenticated users can upload hub-contabil files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hub-contabil');

CREATE POLICY "Users can view hub-contabil files from their tenant"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hub-contabil');

CREATE POLICY "Users can update hub-contabil files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hub-contabil');

CREATE POLICY "Users can delete hub-contabil files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hub-contabil');
