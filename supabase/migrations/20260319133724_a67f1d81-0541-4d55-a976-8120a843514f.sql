-- Add WITH CHECK to existing RLS policies for tenant isolation on estrategia tables
-- Drop and recreate with proper WITH CHECK clause

DROP POLICY IF EXISTS "Tenant isolation" ON estrategia_swot;
CREATE POLICY "Tenant isolation" ON estrategia_swot FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation" ON estrategia_swot_itens;
CREATE POLICY "Tenant isolation" ON estrategia_swot_itens FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation" ON estrategia_oceano_azul;
CREATE POLICY "Tenant isolation" ON estrategia_oceano_azul FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation" ON estrategia_oceano_itens;
CREATE POLICY "Tenant isolation" ON estrategia_oceano_itens FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation" ON estrategia_cultura;
CREATE POLICY "Tenant isolation" ON estrategia_cultura FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation" ON estrategia_organograma;
CREATE POLICY "Tenant isolation" ON estrategia_organograma FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());