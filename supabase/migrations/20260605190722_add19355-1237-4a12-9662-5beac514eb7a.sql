CREATE OR REPLACE FUNCTION public.superadmin_delete_tenant(_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify if the caller is a superadmin
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmins podem excluir empresas';
  END IF;

  -- The deletion will cascade to most tables because of FOREIGN KEY ... ON DELETE CASCADE
  -- We start by deleting the tenant record itself
  DELETE FROM public.tenants WHERE id = _tenant_id;
  
  -- Note: auth.users are NOT automatically deleted by deleting from public.tenants
  -- because auth is in a different schema and usually not linked with ON DELETE CASCADE 
  -- in a way that affects auth.users. 
  -- However, profiles and other linked data in public schema will be gone.
END; $function$;

GRANT EXECUTE ON FUNCTION public.superadmin_delete_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_delete_tenant(uuid) TO service_role;