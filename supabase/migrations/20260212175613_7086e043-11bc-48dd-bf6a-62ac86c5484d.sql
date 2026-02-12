
-- Fix: restrict audit insert to authenticated users with a tenant
DROP POLICY "System can insert audit" ON public.marketplace_audit_log;
CREATE POLICY "Authenticated users can insert audit" ON public.marketplace_audit_log FOR INSERT TO authenticated WITH CHECK (tenant_id = public.get_user_tenant_id() OR profissional_id IN (SELECT id FROM public.marketplace_profissionais WHERE user_id = auth.uid()));
