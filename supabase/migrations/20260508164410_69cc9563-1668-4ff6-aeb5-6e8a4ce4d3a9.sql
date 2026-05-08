
-- 1. Permitir múltiplas marcações por dia: remover unique constraint
ALTER TABLE public.ponto_marcacoes DROP CONSTRAINT IF EXISTS unique_marcacao;

-- 2. Status 'pendente_ajuste' permitido em ponto_diario (CHECK era textual livre, sem alteração necessária)

-- 3. registrar_ponto_externo: remove validação de duplicidade
CREATE OR REPLACE FUNCTION public.registrar_ponto_externo(
  p_token text,
  p_tipo_marcacao text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_selfie_base64 text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link RECORD; v_marcacao_id UUID; v_hora TIME; v_data DATE;
  v_now TIMESTAMP; v_err TEXT;
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

  IF p_tipo_marcacao NOT IN ('entrada', 'saida') THEN
    RETURN json_build_object('error', 'Tipo inválido. Use Entrada ou Saída.');
  END IF;

  BEGIN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao,
      latitude, longitude, dispositivo, hash_marcacao, marcacao_original,
      endereco_geolocalizacao
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, v_hora, p_tipo_marcacao, p_latitude, p_longitude, 'mobile_web',
      encode(sha256((v_link.colaborador_cpf || v_data::text || v_hora::text || p_tipo_marcacao || clock_timestamp()::text)::bytea), 'hex'),
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
    'tipo_marcacao', p_tipo_marcacao,
    'hora', to_char(v_hora, 'HH24:MI:SS'),
    'data', to_char(v_data, 'DD/MM/YYYY')
  );
END;
$function$;

-- 4. consolidar_ponto_diario: parear cronologicamente entrada→saida e somar todos os pares
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_minutos INT := 0;
  v_pendente BOOLEAN := false;
  v_primeira_entrada TIME;
  v_ultima_saida TIME;
  v_status TEXT;
  v_pending_entrada TIMESTAMP;
  r RECORD;
BEGIN
  -- Itera em ordem cronológica todas as marcações do dia/colaborador
  v_pending_entrada := NULL;
  FOR r IN
    SELECT tipo_marcacao, hora_marcacao
    FROM public.ponto_marcacoes
    WHERE tenant_id = NEW.tenant_id
      AND colaborador_cpf = NEW.colaborador_cpf
      AND data_marcacao = NEW.data_marcacao
    ORDER BY hora_marcacao ASC, created_at ASC
  LOOP
    IF r.tipo_marcacao IN ('entrada', 'retorno_almoco') THEN
      -- Abre um novo período (se já houver um aberto, o anterior é descartado/aguardando ajuste)
      IF v_pending_entrada IS NOT NULL THEN
        v_pendente := true;
      END IF;
      v_pending_entrada := r.hora_marcacao;
      IF v_primeira_entrada IS NULL THEN
        v_primeira_entrada := r.hora_marcacao;
      END IF;
    ELSIF r.tipo_marcacao IN ('saida', 'saida_almoco') THEN
      IF v_pending_entrada IS NULL THEN
        -- Saída sem entrada prévia → pendente de ajuste
        v_pendente := true;
      ELSE
        v_total_minutos := v_total_minutos
          + EXTRACT(EPOCH FROM (r.hora_marcacao - v_pending_entrada))::INT / 60;
        v_pending_entrada := NULL;
      END IF;
      v_ultima_saida := r.hora_marcacao;
    END IF;
  END LOOP;

  -- Sobrou entrada sem saída correspondente
  IF v_pending_entrada IS NOT NULL THEN
    v_pendente := true;
  END IF;

  IF v_primeira_entrada IS NULL AND v_ultima_saida IS NULL THEN
    v_status := 'falta';
  ELSIF v_pendente THEN
    v_status := 'pendente_ajuste';
  ELSIF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > '08:10'::TIME THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
  END IF;

  INSERT INTO public.ponto_diario (
    tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida,
    horas_trabalhadas, status
  ) VALUES (
    NEW.tenant_id, NEW.colaborador_id, NEW.colaborador_nome, NEW.colaborador_cpf, NEW.data_marcacao,
    v_primeira_entrada, v_ultima_saida,
    make_interval(mins => v_total_minutos), v_status
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    entrada = v_primeira_entrada,
    saida = v_ultima_saida,
    horas_trabalhadas = make_interval(mins => v_total_minutos),
    status = CASE
      WHEN public.ponto_diario.status = 'justificado' THEN 'justificado'
      ELSE v_status
    END,
    updated_at = now();

  RETURN NEW;
END;
$function$;
