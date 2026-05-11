
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('blog-media', 'blog-media', true, 104857600, ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

DROP POLICY IF EXISTS "Public can view blog media" ON storage.objects;
CREATE POLICY "Public can view blog media" ON storage.objects FOR SELECT USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS "Superadmins can upload blog media" ON storage.objects;
CREATE POLICY "Superadmins can upload blog media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'blog-media' AND public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can update blog media" ON storage.objects;
CREATE POLICY "Superadmins can update blog media" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'blog-media' AND public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can delete blog media" ON storage.objects;
CREATE POLICY "Superadmins can delete blog media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'blog-media' AND public.is_superadmin(auth.uid()));
