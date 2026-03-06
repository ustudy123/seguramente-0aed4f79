-- Remove profissionais com dados fictícios (fotos locais /avatars/)
DELETE FROM marketplace_profissionais
WHERE foto_url LIKE '/avatars/%';