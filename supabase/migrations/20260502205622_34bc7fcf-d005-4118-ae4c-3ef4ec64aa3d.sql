
-- 1) Função: ao criar uma empresa, vincula todos administradores daquele tenant
CREATE OR REPLACE FUNCTION public.auto_vincular_admins_nova_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuario_vinculos (
    tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_inicio
  )
  SELECT
    NEW.tenant_id,
    ub.id,
    NEW.id,
    'administrador'::usuario_tipo,
    'ativo'::vinculo_status,
    CURRENT_DATE
  FROM public.usuarios_base ub
  WHERE ub.tenant_id = NEW.tenant_id
    AND ub.tipo_usuario = 'administrador'
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_vincular_admins_nova_empresa ON public.empresa_cadastro;
CREATE TRIGGER trg_auto_vincular_admins_nova_empresa
AFTER INSERT ON public.empresa_cadastro
FOR EACH ROW
EXECUTE FUNCTION public.auto_vincular_admins_nova_empresa();

-- 2) Backfill: vincular todas empresas existentes a todos administradores do tenant
INSERT INTO public.usuario_vinculos (
  tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_inicio
)
SELECT
  ec.tenant_id,
  ub.id,
  ec.id,
  'administrador'::usuario_tipo,
  'ativo'::vinculo_status,
  CURRENT_DATE
FROM public.empresa_cadastro ec
JOIN public.usuarios_base ub
  ON ub.tenant_id = ec.tenant_id
 AND ub.tipo_usuario = 'administrador'
LEFT JOIN public.usuario_vinculos uv
  ON uv.empresa_id = ec.id AND uv.usuario_id = ub.id
WHERE uv.id IS NULL;
