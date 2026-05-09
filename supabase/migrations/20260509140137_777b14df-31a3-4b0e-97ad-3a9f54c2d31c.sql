
-- RPC: validar se CPF pertence a um colaborador cadastrado e se já respondeu
CREATE OR REPLACE FUNCTION public.validar_cpf_colaborador_campanha(
  p_campanha_id uuid,
  p_cpf text,
  p_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_cpf_limpo text;
  v_existe boolean;
  v_ja_respondeu boolean;
BEGIN
  -- Normaliza CPF (apenas dígitos)
  v_cpf_limpo := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');

  IF length(v_cpf_limpo) <> 11 THEN
    RETURN jsonb_build_object(
      'valido_colaborador', false,
      'ja_respondeu', false,
      'erro', 'CPF inválido'
    );
  END IF;

  -- Busca tenant da campanha
  SELECT tenant_id INTO v_tenant_id
  FROM public.questionario_psicossocial_campanhas
  WHERE id = p_campanha_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'valido_colaborador', false,
      'ja_respondeu', false,
      'erro', 'Campanha não encontrada'
    );
  END IF;

  -- Verifica se o CPF pertence a algum usuário do tipo colaborador no tenant da campanha
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_base ub
    WHERE ub.tenant_id = v_tenant_id
      AND regexp_replace(coalesce(ub.cpf, ''), '[^0-9]', '', 'g') = v_cpf_limpo
      AND ub.tipo_usuario::text = 'colaborador'
  ) INTO v_existe;

  -- Verifica duplicidade pelo hash (mesma lógica de verificar_hash_ja_respondeu)
  SELECT EXISTS (
    SELECT 1
    FROM public.questionario_psicossocial_respostas r
    WHERE r.campanha_id = p_campanha_id
      AND r.telefone_hash = p_hash
  ) INTO v_ja_respondeu;

  RETURN jsonb_build_object(
    'valido_colaborador', v_existe,
    'ja_respondeu', coalesce(v_ja_respondeu, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validar_cpf_colaborador_campanha(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.validar_cpf_colaborador_campanha(uuid, text, text) TO anon, authenticated;
