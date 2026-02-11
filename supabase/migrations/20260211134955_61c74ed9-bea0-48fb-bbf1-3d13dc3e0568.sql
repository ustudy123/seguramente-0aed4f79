
-- Remover políticas públicas permissivas da advertencia_links
DROP POLICY IF EXISTS "advertencia_links_public_select" ON public.advertencia_links;
DROP POLICY IF EXISTS "advertencia_links_public_update" ON public.advertencia_links;
