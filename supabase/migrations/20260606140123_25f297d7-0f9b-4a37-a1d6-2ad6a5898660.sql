-- Ajustar a política de inserção para permitir que gestores insiram ajustes de seus subordinados
DROP POLICY IF EXISTS "Usuários podem solicitar ajustes" ON public.ponto_ajustes;

CREATE POLICY "Usuários podem solicitar ajustes" ON public.ponto_ajustes
FOR INSERT 
WITH CHECK (
  (tenant_id = get_user_tenant_id()) OR 
  (has_minimum_role(auth.uid(), 'manager'::app_role))
);
