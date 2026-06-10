-- =========================================================
-- FIX: Sequência CLT de 4 batidas no registro de ponto externo
--
-- Problema: o link externo alternava apenas entrada/saída.
-- Um dia normal virava 2x "entrada" + 2x "saida", e a
-- consolidação (que mapeia por tipo) calculava o total errado
-- (ex.: 03h58min num dia de 8h) e gerava espelhos confusos.
--
-- Solução:
-- 1) proximo_tipo_marcacao_externo sugere o próximo tipo da
--    sequência CLT que ainda falta no dia:
--    entrada -> saida_almoco -> retorno_almoco -> saida
--    e retorna também os tipos já registrados (para a UI).
-- 2) registrar_ponto_externo aceita o tipo escolhido (o
--    colaborador pode trocar manualmente, ex. quem não marca
--    almoço), valida contra a lista permitida e bloqueia
--    tipo duplicado no mesmo dia com mensagem amigável.
-- =========================================================

CREATE OR REPLACE FUNCTION public.proximo_tipo_marcacao_externo(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_data DATE;
  v_tipos TEXT[];
  v_proximo TEXT;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  SELECT COALESCE(array_agg(DISTINCT tipo_marcacao), '{}')
  INTO v_tipos
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data;

  -- Próximo tipo da sequência CLT que ainda não foi registrado hoje
  IF NOT ('entrada' = ANY(v_tipos)) THEN
    v_proximo := 'entrada';
  ELSIF NOT ('saida_almoco' = ANY(v_tipos)) THEN
    v_proximo := 'saida_almoco';
  ELSIF NOT ('retorno_almoco' = ANY(v_tipos)) THEN
    v_proximo := 'retorno_almoco';
  ELSIF NOT ('saida' = ANY(v_tipos)) THEN
    v_proximo := 'saida';
  ELSE
    v_proximo := NULL; -- jornada completa
  END IF;

  RETURN json_build_object(
    'proximo_tipo', v_proximo,
    'tipos_registrados', to_json(v_tipos),
    'jornada_completa', v_proximo IS NULL
  );
END;
$$;

-- Recria registrar_ponto_externo mantendo a assinatura de 7 parâmetros
-- (selfie incluída) e adicionando validação de tipo + anti-duplicidade
DROP FUNCTION IF EXISTS public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text);

CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token text,
  p_tipo_marcacao text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_selfie_url text DEFAULT NULL,
  p_selfie_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD; v_marcacao_id UUID; v_hora TIME; v_data DATE;
  v_now TIMESTAMP; v_err TEXT; v_tipos TEXT[]; v_tipo TEXT;
  v_label TEXT;
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

  -- Tipos já registrados hoje
  SELECT COALESCE(array_agg(DISTINCT tipo_marcacao), '{}')
  INTO v_tipos
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data;

  -- Tipo: usa o informado (escolha manual do colaborador) ou
  -- calcula o próximo da sequência CLT que ainda falta
  IF p_tipo_marcacao IS NOT NULL THEN
    IF p_tipo_marcacao NOT IN ('entrada', 'saida_almoco', 'retorno_almoco', 'saida') THEN
      RETURN json_build_object('error', 'Tipo de marcação inválido.');
    END IF;
    v_tipo := p_tipo_marcacao;
  ELSE
    IF NOT ('entrada' = ANY(v_tipos)) THEN v_tipo := 'entrada';
    ELSIF NOT ('saida_almoco' = ANY(v_tipos)) THEN v_tipo := 'saida_almoco';
    ELSIF NOT ('retorno_almoco' = ANY(v_tipos)) THEN v_tipo := 'retorno_almoco';
    ELSIF NOT ('saida' = ANY(v_tipos)) THEN v_tipo := 'saida';
    ELSE
      RETURN json_build_object('error', 'Sua jornada de hoje já está completa (4 marcações). Para registrar hora extra ou corrigir algum horário, use "Solicitar Ajuste de Ponto".');
    END IF;
  END IF;

  -- Anti-duplicidade: o mesmo tipo não pode repetir no dia
  IF v_tipo = ANY(v_tipos) THEN
    v_label := CASE v_tipo
      WHEN 'entrada' THEN 'Entrada'
      WHEN 'saida_almoco' THEN 'Saída Almoço'
      WHEN 'retorno_almoco' THEN 'Retorno Almoço'
      ELSE 'Saída' END;
    RETURN json_build_object('error',
      'Você já registrou ' || v_label || ' hoje. Se o horário estiver errado, use "Solicitar Ajuste de Ponto".');
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao,
      latitude, longitude, dispositivo, hash_marcacao, marcacao_original,
      endereco_geolocalizacao, selfie_url, selfie_nome
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, v_hora, v_tipo, p_latitude, p_longitude, 'mobile_web',
      encode(sha256((v_link.colaborador_cpf || v_data::text || v_hora::text || v_tipo || clock_timestamp()::text)::bytea), 'hex'),
      true, p_endereco, p_selfie_url, p_selfie_nome
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

-- Regrants (a migration de hardening revogou os defaults)
REVOKE EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_externo(text, text, double precision, double precision, text, text, text) TO anon, authenticated;
