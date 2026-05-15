DO $$
DECLARE
  v_tenant uuid := 'b344b6ba-7457-4786-ad00-0bbf84666959';
  r record;
  i int;
BEGIN
  FOR i IN 1..5 LOOP
    FOR r IN
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'empresa_id'
        AND table_name <> 'empresa_cadastro'
    LOOP
      BEGIN
        EXECUTE format(
          'DELETE FROM public.%I WHERE empresa_id IN (SELECT id FROM public.empresa_cadastro WHERE tenant_id = %L)',
          r.table_name, v_tenant
        );
      EXCEPTION WHEN foreign_key_violation THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  DELETE FROM public.empresa_cadastro WHERE tenant_id = v_tenant;
END $$;