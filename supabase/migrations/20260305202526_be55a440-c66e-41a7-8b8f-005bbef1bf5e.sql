DO $$
DECLARE
  r RECORD;
  tenant_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO tenant_ids FROM tenants WHERE created_at < '2026-03-05';
  IF tenant_ids IS NULL THEN RETURN; END IF;

  -- Temporarily disable all triggers to avoid FK checks
  SET session_replication_role = 'replica';

  -- Delete from ALL tables with tenant_id column
  FOR r IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    WHERE c.column_name = 'tenant_id' AND c.table_schema = 'public' AND c.table_name != 'tenants'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE tenant_id = ANY($1)', r.table_name) USING tenant_ids;
  END LOOP;

  -- Delete tenants
  DELETE FROM tenants WHERE id = ANY(tenant_ids);

  -- Re-enable triggers
  SET session_replication_role = 'origin';
END;
$$;