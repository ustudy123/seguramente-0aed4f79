
-- Função auxiliar: retorna o tipo_usuario do usuário logado
CREATE OR REPLACE FUNCTION public.get_current_user_tipo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tipo_usuario::text
  FROM public.usuarios_base
  WHERE auth_user_id = auth.uid()
  LIMIT 1
$$;

-- Função principal: verifica se o usuário logado tem vínculo ativo com a empresa
-- Retorna TRUE se:
--   1) O usuário não é "profissional" (tipos internos têm acesso irrestrito), OU
--   2) O usuário é profissional e tem vínculo ativo com a empresa_id informada, OU
--   3) empresa_id é NULL (registros globais do tenant)
CREATE OR REPLACE FUNCTION public.user_has_empresa_vinculo(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Se empresa_id é NULL, permitir (registros globais)
    WHEN _empresa_id IS NULL THEN true
    -- Se o usuário não é tipo profissional, permitir tudo
    WHEN public.get_current_user_tipo() IS NULL THEN true
    WHEN public.get_current_user_tipo() NOT IN (
      'clinica_parceira', 'consultor_externo', 'prestador_terceiro', 'auditor', 'suporte_autorizado'
    ) THEN true
    -- Se é profissional, verificar vínculo ativo
    ELSE EXISTS (
      SELECT 1
      FROM public.usuario_vinculos uv
      JOIN public.usuarios_base ub ON ub.id = uv.usuario_id
      WHERE ub.auth_user_id = auth.uid()
        AND uv.empresa_id = _empresa_id
        AND uv.status = 'ativo'
    )
  END
$$;
