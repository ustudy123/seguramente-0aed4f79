
-- 1. Desvincula documentos das pastas (set pasta_id to NULL)
UPDATE public.documentos 
SET pasta_id = NULL 
WHERE pasta_id IN (
  SELECT id FROM public.documento_pastas 
  WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a'
);

-- 2. Remove todas as pastas do tenant
DELETE FROM public.documento_pastas 
WHERE tenant_id = '299779a8-1cd2-4ffe-9462-78181426cd1a';
