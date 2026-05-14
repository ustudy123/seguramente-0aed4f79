-- D) Storage hardening: remove broad SELECT policies on public buckets.
-- Public buckets already serve files via the CDN public URL endpoint (which
-- bypasses RLS). The broad SELECT policies below only enable LISTING all
-- files in the bucket via the storage API, which is information disclosure.
-- Direct URL fetches (e.g. /storage/v1/object/public/avatars/<path>) keep working.

DROP POLICY IF EXISTS "Avatars são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Fotos de EPI são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Assinaturas são publicamente acessíveis" ON storage.objects;
DROP POLICY IF EXISTS "Imagens do feed são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Public can view blog media" ON storage.objects;