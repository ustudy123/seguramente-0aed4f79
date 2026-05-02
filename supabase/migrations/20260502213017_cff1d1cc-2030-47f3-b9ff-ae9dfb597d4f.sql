-- RPC para deletar empresa com validações de governança
CREATE OR REPLACE FUNCTION public.delete_empresa_segura(_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _is_master boolean;
  _qtd_colab int;
  _qtd_terc int;
BEGIN
  -- Carrega empresa e tenant
  SELECT tenant_id INTO _tenant_id
  FROM public.empresa_cadastro
  WHERE id = _empresa_id;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Apenas administrador master (owner) ou superadmin do próprio tenant pode excluir
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner','superadmin')
  ) INTO _is_master;

  -- Valida que o usuário pertence ao mesmo tenant
  IF NOT _is_master THEN
    RAISE EXCEPTION 'Apenas o Administrador Master da empresa pode excluí-la.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tenant_id = _tenant_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.superadmins s WHERE s.user_id = auth.uid() AND s.ativo = true
  ) THEN
    RAISE EXCEPTION 'Você não pertence a este tenant.';
  END IF;

  -- Bloqueia se houver colaboradores (admissões ativas) vinculados
  SELECT COUNT(*) INTO _qtd_colab
  FROM public.admissoes
  WHERE empresa_id = _empresa_id;

  -- Bloqueia se houver terceiros (prestadores) vinculados
  SELECT COUNT(*) INTO _qtd_terc
  FROM public.terceiros
  WHERE empresa_id = _empresa_id;

  IF _qtd_colab > 0 OR _qtd_terc > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir esta empresa: existem % colaborador(es) e % prestador(es) cadastrado(s). Remova ou transfira os vínculos antes de excluir.', _qtd_colab, _qtd_terc;
  END IF;

  -- Limpa vínculos auxiliares
  DELETE FROM public.usuario_vinculos WHERE empresa_id = _empresa_id;
  DELETE FROM public.empresa_obrigacoes WHERE empresa_id = _empresa_id;

  -- Exclui a empresa
  DELETE FROM public.empresa_cadastro WHERE id = _empresa_id;

  RETURN jsonb_build_object('success', true, 'empresa_id', _empresa_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_empresa_segura(uuid) TO authenticated;