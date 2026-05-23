
REVOKE EXECUTE ON FUNCTION public.superadmin_spinoff_dry_run(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.superadmin_spinoff_execute(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.superadmin_spinoff_dry_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_spinoff_execute(uuid, uuid, text, uuid) TO authenticated;
