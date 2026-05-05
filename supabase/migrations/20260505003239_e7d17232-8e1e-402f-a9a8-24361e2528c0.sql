CREATE OR REPLACE FUNCTION public.superadmin_tenants_list()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) INTO result
  FROM (
    SELECT
      t.*,
      (SELECT COUNT(*) FROM profiles WHERE tenant_id = t.id) AS total_usuarios,
      (SELECT COUNT(*) FROM admissoes WHERE tenant_id = t.id AND status = 'concluido') AS total_colaboradores
    FROM tenants t
  ) x;

  RETURN COALESCE(result, '[]'::jsonb);
END; $$;