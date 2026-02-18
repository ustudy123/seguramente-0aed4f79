-- Fix RLS policy: ALL with only USING (no WITH CHECK) blocks INSERT/UPDATE
-- Need to drop and recreate with WITH CHECK
DROP POLICY IF EXISTS "Tenant isolation for terceiros" ON public.terceiros;

CREATE POLICY "Tenant isolation for terceiros"
ON public.terceiros
FOR ALL
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());
