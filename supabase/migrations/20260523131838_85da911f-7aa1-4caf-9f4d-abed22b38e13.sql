
CREATE OR REPLACE FUNCTION public.superadmin_list_all_empresas()
RETURNS TABLE (
  empresa_id uuid,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  ativo boolean,
  empresa_created_at timestamptz,
  tenant_id uuid,
  tenant_nome text,
  tenant_slug text,
  total_empresas_tenant bigint,
  is_principal boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      e.id AS empresa_id,
      e.razao_social,
      e.nome_fantasia,
      e.cnpj,
      e.ativo,
      e.created_at AS empresa_created_at,
      e.tenant_id,
      t.nome AS tenant_nome,
      t.slug AS tenant_slug,
      COUNT(*) OVER (PARTITION BY e.tenant_id) AS total_empresas_tenant,
      ROW_NUMBER() OVER (PARTITION BY e.tenant_id ORDER BY e.created_at ASC, e.id ASC) AS rn
    FROM public.empresa_cadastro e
    JOIN public.tenants t ON t.id = e.tenant_id
    WHERE public.is_superadmin(auth.uid())
  )
  SELECT
    empresa_id, razao_social, nome_fantasia, cnpj, ativo, empresa_created_at,
    tenant_id, tenant_nome, tenant_slug, total_empresas_tenant,
    (rn = 1) AS is_principal
  FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_list_all_empresas() TO authenticated;
