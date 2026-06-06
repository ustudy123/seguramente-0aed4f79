-- Primeiro, vamos recriar a função get_user_tenant_id para garantir que ela use user_id se id não for a FK
-- Mas como vimos, profiles tem user_id e tenant_id. A função atual usa user_id = auth.uid().

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- Agora vamos atualizar a política de INSERT
DROP POLICY IF EXISTS "Usuários podem solicitar ajustes" ON public.ponto_ajustes;

CREATE POLICY "Usuários podem solicitar ajustes" ON public.ponto_ajustes
FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id());

-- Garantir que as outras políticas também usem a função atualizada (opcional mas bom para consistência)
DROP POLICY IF EXISTS "Usuários podem ver ajustes do seu tenant" ON public.ponto_ajustes;
CREATE POLICY "Usuários podem ver ajustes do seu tenant" ON public.ponto_ajustes
FOR SELECT
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Managers+ podem aprovar ajustes" ON public.ponto_ajustes;
CREATE POLICY "Managers+ podem aprovar ajustes" ON public.ponto_ajustes
FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_minimum_role(auth.uid(), 'manager'::app_role));
