DROP POLICY IF EXISTS "Usuários podem solicitar ajustes" ON public.ponto_ajustes;

CREATE POLICY "Usuários podem solicitar ajustes"
ON public.ponto_ajustes
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);