-- Atualizar a política de inserção para incluir o tipo 'aviso'
DROP POLICY IF EXISTS "Managers podem criar anúncios" ON public.feed_posts;

CREATE POLICY "Managers podem criar anúncios" ON public.feed_posts 
FOR INSERT 
TO authenticated 
WITH CHECK (
  (tenant_id = get_user_tenant_id()) AND 
  (autor_id = auth.uid()) AND 
  (tipo = ANY (ARRAY['anuncio'::text, 'aniversario'::text, 'tempo_casa'::text, 'aviso'::text])) AND 
  has_minimum_role(auth.uid(), 'manager'::app_role)
);

-- Grant redundante para garantir acesso à tabela (boa prática do projeto)
GRANT INSERT ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
