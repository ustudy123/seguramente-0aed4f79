SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- agregados/procedures quebram pg_get_functiondef
  AND (
    pg_get_functiondef(p.oid) ILIKE '%= NEW.data_marcacao%'
    OR pg_get_functiondef(p.oid) ILIKE '%= NEW.data_referencia%'
    OR pg_get_functiondef(p.oid) ILIKE '%data = text%'
  );