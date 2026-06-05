CREATE OR REPLACE FUNCTION public.superadmin_list_tenant_users(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Verify if the caller is a superadmin
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmins podem listar usuários de outros tenants';
  END IF;

  SELECT jsonb_agg(row_to_json(x) ORDER BY x.nome_completo) INTO result
  FROM (
    SELECT
      p.id,
      p.nome_completo,
      p.user_id,
      p.tenant_id,
      u.email,
      (
        SELECT jsonb_agg(jsonb_build_object('role', r.role))
        FROM public.user_roles r
        WHERE r.user_id = p.user_id
      ) as user_roles
    FROM public.profiles p
    JOIN auth.users u ON p.user_id = u.id
    WHERE p.tenant_id = _tenant_id
  ) x;

  RETURN COALESCE(result, '[]'::jsonb);
END; $function$;

GRANT EXECUTE ON FUNCTION public.superadmin_list_tenant_users(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_tenant_users(uuid) TO service_role;