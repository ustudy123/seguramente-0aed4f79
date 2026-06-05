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
    LEFT JOIN empresa_cadastro ec ON ec.tenant_id = t.id AND ec.tipo_unidade = 'matriz'
  ) x;

  RETURN COALESCE(result, '[]'::jsonb);
END; $function$;