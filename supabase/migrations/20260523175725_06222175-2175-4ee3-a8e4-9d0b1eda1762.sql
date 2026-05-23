CREATE OR REPLACE FUNCTION public.solicitar_ajustes_ponto_externo_batch(
  p_token TEXT,
  p_itens JSONB,
  p_motivo TEXT,
  p_anexos JSONB DEFAULT '[]'::jsonb
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_item JSONB;
  v_data DATE;
  v_hora TIME;
  v_tipo TEXT;
  v_motivo_item TEXT;
  v_now TIMESTAMPTZ := now();
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id UUID;
  v_count INT := 0;
BEGIN
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RETURN json_build_object('error','Inclua ao menos uma marcação para ajuste.');
  END IF;
  IF jsonb_array_length(p_itens) > 40 THEN
    RETURN json_build_object('error','Máximo de 40 ajustes por solicitação.');
  END IF;

  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error','Link inválido ou expirado.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_data := (v_item->>'data')::date;
    v_hora := (v_item->>'hora')::time;
    v_tipo := v_item->>'tipo';
    v_motivo_item := COALESCE(NULLIF(trim(v_item->>'motivo'),''), NULLIF(trim(p_motivo),''));

    IF v_motivo_item IS NULL OR length(v_motivo_item) < 5 THEN
      RETURN json_build_object('error','Cada ajuste precisa de uma justificativa (mín. 5 caracteres).');
    END IF;
    IF v_tipo NOT IN ('entrada','saida','saida_almoco','retorno_almoco') THEN
      RETURN json_build_object('error','Tipo de marcação inválido: ' || COALESCE(v_tipo,'(vazio)'));
    END IF;
    IF v_data IS NULL OR v_hora IS NULL THEN
      RETURN json_build_object('error','Data e hora são obrigatórios para cada ajuste.');
    END IF;
    IF v_data > CURRENT_DATE THEN
      RETURN json_build_object('error','Não é permitido solicitar ajuste para data futura.');
    END IF;
    IF v_data = CURRENT_DATE AND (v_data + v_hora) > v_now THEN
      RETURN json_build_object('error','Não é permitido solicitar ajuste para horário futuro.');
    END IF;

    INSERT INTO public.ponto_ajustes (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_referencia, tipo_ajuste, tipo_marcacao,
      hora_solicitada, motivo, status, created_by_nome, anexos
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, 'inclusao', v_tipo,
      v_hora, v_motivo_item, 'pendente',
      v_link.colaborador_nome || ' (link externo)', COALESCE(p_anexos, '[]'::jsonb)
    ) RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'total', v_count, 'ids', to_jsonb(v_ids));
END;
$$;