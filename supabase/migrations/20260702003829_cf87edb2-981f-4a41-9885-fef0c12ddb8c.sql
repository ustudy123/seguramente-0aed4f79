-- Permite que managers/gestores também gerenciem justificativas de ponto
DROP POLICY IF EXISTS "admins gerenciam justificativas - delete" ON public.ponto_justificativas;
DROP POLICY IF EXISTS "admins gerenciam justificativas - insert" ON public.ponto_justificativas;
DROP POLICY IF EXISTS "admins gerenciam justificativas - update" ON public.ponto_justificativas;

CREATE POLICY "gestores gerenciam justificativas - delete"
ON public.ponto_justificativas FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "gestores gerenciam justificativas - insert"
ON public.ponto_justificativas FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "gestores gerenciam justificativas - update"
ON public.ponto_justificativas FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'superadmin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);