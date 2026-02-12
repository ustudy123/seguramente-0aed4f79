-- Allow all authenticated users in the tenant to create plano_acoes (not just managers)
DROP POLICY IF EXISTS "Managers+ podem criar ações" ON public.plano_acoes;

CREATE POLICY "Usuários do tenant podem criar ações"
  ON public.plano_acoes
  FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());