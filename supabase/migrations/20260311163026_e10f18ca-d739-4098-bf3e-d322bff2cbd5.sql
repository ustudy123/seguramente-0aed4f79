
-- Remover todos os registros públicos de leiri@sudoclin.com
DO $$
DECLARE
  v_user_id UUID := '31d53e77-9840-4019-a85d-eba5e805282d';
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE user_id = v_user_id;

  DELETE FROM public.programa_validador_clientes WHERE user_id = v_user_id OR tenant_id = v_tenant_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE user_id = v_user_id;
  DELETE FROM public.tenants WHERE id = v_tenant_id;
END $$;
