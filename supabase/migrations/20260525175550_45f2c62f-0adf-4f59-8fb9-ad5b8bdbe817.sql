DO $$
DECLARE
  r record;
  tgt uuid := '43612415-6ae1-46f7-84e4-92a6c817a8dc';
  uid uuid;
BEGIN
  SELECT user_id INTO uid FROM public.profiles WHERE tenant_id = tgt LIMIT 1;

  FOR i IN 1..3 LOOP
    FOR r IN
      SELECT table_name FROM information_schema.columns
      WHERE column_name = 'tenant_id' AND table_schema = 'public' AND table_name <> 'tenants'
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', r.table_name) USING tgt;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END LOOP;

  IF uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = uid;
    DELETE FROM public.superadmins WHERE user_id = uid;
  END IF;

  DELETE FROM public.tenants WHERE id = tgt;

  IF uid IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = uid;
  END IF;
END$$;