SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%ponto_%'
    OR pg_get_functiondef(p.oid) ILIKE '%data_referencia%'
    OR pg_get_functiondef(p.oid) ILIKE '%data_marcacao%'
  );