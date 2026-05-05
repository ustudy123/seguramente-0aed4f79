
REVOKE EXECUTE ON FUNCTION public.superadmin_global_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.superadmin_growth_series(int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.superadmin_tenants_status() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.superadmin_usuarios_global(text, int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.superadmin_global_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_growth_series(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_tenants_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_usuarios_global(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
