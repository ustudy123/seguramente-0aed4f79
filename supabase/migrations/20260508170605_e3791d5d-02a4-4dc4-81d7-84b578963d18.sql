
-- Função para descobrir o próximo tipo a registrar (consumida pela tela pública)
CREATE OR REPLACE FUNCTION public.proximo_tipo_marcacao_externo(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_ultimo TEXT;
  v_data DATE;
  v_proximo TEXT;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  SELECT tipo_marcacao INTO v_ultimo
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultimo IS NULL THEN
    v_proximo := 'entrada';
  ELSIF v_ultimo IN ('entrada', 'retorno_almoco') THEN
    v_proximo := 'saida';
  ELSE
    v_proximo := 'entrada';
  END IF;

  RETURN json_build_object('proximo_tipo', v_proximo, 'ultimo_tipo', v_ultimo);
END;
$$;

-- Atualiza registrar_ponto_externo para decidir o tipo automaticamente
CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token text,
  p_tipo_marcacao text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_selfie_base64 text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD; v_marcacao_id UUID; v_hora TIME; v_data DATE;
  v_now TIMESTAMP; v_err TEXT; v_ultimo TEXT; v_tipo TEXT;
BEGIN
  v_now := timezone('America/Sao_Paulo', now());
  v_hora := v_now::TIME;
  v_data := v_now::DATE;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  -- Determina o próximo tipo automaticamente com base no último evento do dia
  SELECT tipo_marcacao INTO v_ultimo
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultimo IS NULL THEN
    v_tipo := 'entrada';
  ELSIF v_ultimo IN ('entrada', 'retorno_almoco') THEN
    v_tipo := 'saida';
  ELSE
    v_tipo := 'entrada';
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao,
      latitude, longitude, dispositivo, hash_marcacao, marcacao_original,
      endereco_geolocalizacao
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, v_hora, v_tipo, p_latitude, p_longitude, 'mobile_web',
      encode(sha256((v_link.colaborador_cpf || v_data::text || v_hora::text || v_tipo || clock_timestamp()::text)::bytea), 'hex'),
      true, p_endereco
    ) RETURNING id INTO v_marcacao_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN json_build_object('error', COALESCE(v_err, 'Não foi possível registrar agora.'));
  END;

  RETURN json_build_object(
    'success', true,
    'marcacao_id', v_marcacao_id,
    'colaborador_nome', v_link.colaborador_nome,
    'tipo_marcacao', v_tipo,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$$;
