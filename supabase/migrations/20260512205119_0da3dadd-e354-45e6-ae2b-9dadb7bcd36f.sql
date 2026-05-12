CREATE OR REPLACE FUNCTION public.contar_colaboradores_por_empresa(p_tenant_id uuid)
RETURNS TABLE(empresa_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.empresa_id, COUNT(*)::bigint AS total
  FROM public.admissoes a
  WHERE a.tenant_id = p_tenant_id
    AND a.status = 'concluido'
    AND a.empresa_id IS NOT NULL
  GROUP BY a.empresa_id;
$$;

GRANT EXECUTE ON FUNCTION public.contar_colaboradores_por_empresa(uuid) TO authenticated;