-- Allow superadmins to see ALL tickets
DROP POLICY "Tenant members can view tickets" ON public.suporte_tickets;
CREATE POLICY "Tenant members can view tickets" ON public.suporte_tickets
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));

-- Allow superadmins to update ANY ticket
DROP POLICY "Admins can update tickets" ON public.suporte_tickets;
CREATE POLICY "Admins can update tickets" ON public.suporte_tickets
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));

-- Same for comments
DROP POLICY IF EXISTS "Tenant members can view comments" ON public.suporte_ticket_comentarios;
DROP POLICY IF EXISTS "Tenant members can add comments" ON public.suporte_ticket_comentarios;

CREATE POLICY "Tenant members can view comments" ON public.suporte_ticket_comentarios
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));

CREATE POLICY "Tenant members can add comments" ON public.suporte_ticket_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() OR is_superadmin(auth.uid()));