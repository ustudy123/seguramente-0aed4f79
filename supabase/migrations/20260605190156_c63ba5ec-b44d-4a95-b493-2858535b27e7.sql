CREATE OR REPLACE FUNCTION public.superadmin_tenants_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) INTO result
  FROM (
    SELECT
      t.*,
      ec.email,
      ec.telefone,
      ec.cnpj,
      (SELECT COUNT(*) FROM profiles WHERE tenant_id = t.id) AS total_usuarios,
      (SELECT COUNT(*) FROM admissoes WHERE tenant_id = t.id AND status = 'concluido') AS total_colaboradores
    FROM tenants t
    LEFT JOIN LATERAL (
      SELECT email, telefone, cnpj
      FROM empresa_cadastro
      WHERE tenant_id = t.id AND tipo_unidade = 'matriz'
      ORDER BY created_at DESC
      LIMIT 1
    ) ec ON true
  ) x;

  RETURN COALESCE(result, '[]'::jsonb);
END; $function$;