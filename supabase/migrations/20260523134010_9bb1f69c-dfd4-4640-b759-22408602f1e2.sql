
DROP FUNCTION IF EXISTS public.superadmin_list_all_empresas() CASCADE;

CREATE FUNCTION public.superadmin_list_all_empresas()
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
  is_principal boolean,
  tenant_owner_email text
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
    b.empresa_id, b.razao_social, b.nome_fantasia, b.cnpj, b.ativo, b.empresa_created_at,
    b.tenant_id, b.tenant_nome, b.tenant_slug, b.total_empresas_tenant,
    (b.rn = 1) AS is_principal,
    COALESCE(owner.email_principal, owner_auth.email::text) AS tenant_owner_email
  FROM base b
  LEFT JOIN LATERAL (
    SELECT ub.email_principal, ur.user_id
    FROM public.user_roles ur
    JOIN public.usuarios_base ub ON ub.auth_user_id = ur.user_id AND ub.tenant_id = b.tenant_id
    WHERE ur.role = 'owner'
    LIMIT 1
  ) owner ON true
  LEFT JOIN LATERAL (
    SELECT u.email
    FROM auth.users u
    WHERE u.id = owner.user_id
    LIMIT 1
  ) owner_auth ON true;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_list_all_empresas() TO authenticated;
