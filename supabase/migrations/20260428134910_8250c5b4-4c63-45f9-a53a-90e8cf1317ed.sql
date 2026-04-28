CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token TEXT,
  p_tipo_marcacao TEXT,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_endereco TEXT DEFAULT NULL,
  p_selfie_base64 TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_marcacao_id UUID;
  v_hora TIME;
  v_data DATE;
  v_tipo_label TEXT;
BEGIN
  SELECT * INTO v_link
  FROM public.ponto_links
  WHERE token = p_token
    AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  IF p_tipo_marcacao NOT IN ('entrada', 'saida') THEN
    RETURN json_build_object('error', 'Este link permite apenas registro de Entrada ou Saída.');
  END IF;

  v_hora := LOCALTIME;
  v_data := CURRENT_DATE;
  v_tipo_label := CASE p_tipo_marcacao
    WHEN 'entrada' THEN 'Entrada'
    WHEN 'saida' THEN 'Saída'
    ELSE p_tipo_marcacao
  END;

  IF EXISTS (
    SELECT 1
    FROM public.ponto_marcacoes
    WHERE tenant_id = v_link.tenant_id
      AND colaborador_cpf = v_link.colaborador_cpf
      AND data_marcacao = v_data
      AND tipo_marcacao = p_tipo_marcacao
  ) THEN
    RETURN json_build_object('error', v_tipo_label || ' já registrada hoje.');
  END IF;

  IF p_tipo_marcacao = 'saida' AND NOT EXISTS (
    SELECT 1
    FROM public.ponto_marcacoes
    WHERE tenant_id = v_link.tenant_id
      AND colaborador_cpf = v_link.colaborador_cpf
      AND data_marcacao = v_data
      AND tipo_marcacao = 'entrada'
  ) THEN
    RETURN json_build_object('error', 'Não é possível registrar Saída sem uma Entrada prévia no mesmo dia.');
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes (
      tenant_id,
      colaborador_id,
      colaborador_nome,
      colaborador_cpf,
      data_marcacao,
      hora_marcacao,
      tipo_marcacao,
      latitude,
      longitude,
      dispositivo,
      hash_marcacao,
      marcacao_original
    ) VALUES (
      v_link.tenant_id,
      v_link.colaborador_id,
      v_link.colaborador_nome,
      v_link.colaborador_cpf,
      v_data,
      v_hora,
      p_tipo_marcacao,
      p_latitude,
      p_longitude,
      'mobile_web',
      encode(digest((v_link.colaborador_cpf || v_data::text || v_hora::text || p_tipo_marcacao || clock_timestamp()::text)::bytea, 'sha256'), 'hex'),
      true
    ) RETURNING id INTO v_marcacao_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN json_build_object('error', v_tipo_label || ' já registrada hoje.');
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%Não é possível registrar%' THEN
        RETURN json_build_object('error', SQLERRM);
      END IF;
      RETURN json_build_object('error', 'Não foi possível concluir o registro de ponto agora. Tente novamente em instantes.');
  END;

  RETURN json_build_object(
    'success', true,
    'marcacao_id', v_marcacao_id,
    'colaborador_nome', v_link.colaborador_nome,
    'tipo_marcacao', p_tipo_marcacao,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;