
-- Provisioning manual conta leiri@sudoclin.com (fase corrigida para 'ativo')
DO $$
DECLARE
  v_user_id UUID := '31d53e77-9840-4019-a85d-eba5e805282d';
  v_tenant_id UUID;
  v_onboarding_token UUID;
BEGIN

  -- 1. Criar tenant Sudoclin
  INSERT INTO public.tenants (nome, slug, plano)
  VALUES ('Sudoclin', 'sudoclin', 'starter')
  RETURNING id INTO v_tenant_id;

  -- 2. Criar profile
  INSERT INTO public.profiles (user_id, tenant_id, nome_completo)
  VALUES (v_user_id, v_tenant_id, 'Leiridiani Nuernberg');

  -- 3. Criar role owner
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'owner');

  -- 4. Criar registro programa_validador_clientes com fase válida
  INSERT INTO public.programa_validador_clientes (
    tenant_id,
    nome_empresa,
    cnpj,
    poc_nome,
    poc_email,
    fase,
    tipo_cliente,
    conta_ativada,
    conta_ativada_em,
    user_id
  ) VALUES (
    v_tenant_id,
    'Sudoclin',
    '26114701000145',
    'Leiridiani Nuernberg',
    'leiri@sudoclin.com',
    'ativo',
    'tester',
    true,
    now(),
    v_user_id
  )
  RETURNING onboarding_token INTO v_onboarding_token;

  -- 5. Atualizar onboarding_token no profile
  IF v_onboarding_token IS NOT NULL THEN
    UPDATE public.profiles
    SET onboarding_token = v_onboarding_token
    WHERE user_id = v_user_id;
  END IF;

END $$;
