
-- 1) Otimizar a função
CREATE OR REPLACE FUNCTION public.user_has_empresa_vinculo(_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo text;
BEGIN
  IF _empresa_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT tipo_usuario::text INTO v_tipo
  FROM public.usuarios_base
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_tipo IS NULL OR v_tipo NOT IN (
    'clinica_parceira', 'consultor_externo', 'prestador_terceiro', 'auditor', 'suporte_autorizado'
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub ON ub.id = uv.usuario_id
    WHERE ub.auth_user_id = auth.uid()
      AND uv.empresa_id = _empresa_id
      AND uv.status = 'ativo'
  );
END;
$$;

-- 2) Substituir policies existentes

-- admissoes
DROP POLICY IF EXISTS "Usuários podem ver admissões do seu tenant" ON public.admissoes;
CREATE POLICY "select_admissoes_vinculo"
ON public.admissoes FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- atestados (sem policy anterior)
CREATE POLICY "select_atestados_vinculo"
ON public.atestados FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- afastamentos (sem policy anterior)
CREATE POLICY "select_afastamentos_vinculo"
ON public.afastamentos FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- ocorrencias
DROP POLICY IF EXISTS "ocorrencias_select" ON public.ocorrencias;
CREATE POLICY "select_ocorrencias_vinculo"
ON public.ocorrencias FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- metas
DROP POLICY IF EXISTS "Usuários podem ver metas do seu tenant" ON public.metas;
CREATE POLICY "select_metas_vinculo"
ON public.metas FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- ferias_solicitacoes
DROP POLICY IF EXISTS "ferias_sol_tenant_select" ON public.ferias_solicitacoes;
CREATE POLICY "select_ferias_vinculo"
ON public.ferias_solicitacoes FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- desvios_seguranca
DROP POLICY IF EXISTS "desvios_select" ON public.desvios_seguranca;
CREATE POLICY "select_desvios_vinculo"
ON public.desvios_seguranca FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);

-- epis
DROP POLICY IF EXISTS "Usuários podem ver EPIs do seu tenant" ON public.epis;
CREATE POLICY "select_epis_vinculo"
ON public.epis FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.user_has_empresa_vinculo(empresa_id)
);
