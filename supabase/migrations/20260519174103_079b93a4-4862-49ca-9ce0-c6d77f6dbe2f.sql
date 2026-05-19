CREATE OR REPLACE FUNCTION public.has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tenant_id = _tenant_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_tenant_access(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_access(uuid) TO authenticated;