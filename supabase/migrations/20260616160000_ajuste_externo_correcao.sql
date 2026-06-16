-- =========================================================
-- FIX: correção feita pelo LINK EXTERNO não remove a original
--
-- Sintoma (Amanda, 16/06): a folha do link mostra a entrada
-- corrigida de 15:06 → 08:00 (com "orig: 15:06"), o gestor aprova,
-- mas no espelho a marcação ORIGINAL das 15:06 continua aparecendo.
--
-- Causa raiz: a folha externa (SolicitarAjusteModal) enviava só
-- { data, hora, tipo, motivo } — SEM hora_original. E a RPC
-- externo.solicitar_ajustes_ponto_externo_batch gravava TODOS os
-- itens como tipo_ajuste='inclusao'. Como não havia correção nem
-- hora_original, a processar_ajuste_ponto não tinha o que remover,
-- e a batida original sobrevivia.
--
-- Correção (lado banco): a RPC passa a aceitar 'hora_original' em
-- cada item. Quando presente, grava tipo_ajuste='correcao' com a
-- hora_original — assim a aprovação remove a marcação original
-- (match por minuto) e insere a corrigida. Sem hora_original,
-- continua 'inclusao' (comportamento anterior preservado).
-- O front passa a enviar hora_original (commit acompanhante).
-- =========================================================

CREATE OR REPLACE FUNCTION externo.solicitar_ajustes_ponto_externo_batch(
  p_token text,
  p_itens jsonb,
  p_motivo text DEFAULT NULL,
  p_anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_item JSONB;
  v_data DATE;
  v_hora TIME;
  v_tipo TEXT;
  v_hora_original TIME;
  v_tipo_ajuste TEXT;
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
    -- hora_original presente => é correção de uma batida existente
    v_hora_original := NULLIF(v_item->>'hora_original','')::time;
    v_tipo_ajuste := CASE WHEN v_hora_original IS NOT NULL THEN 'correcao' ELSE 'inclusao' END;
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
      hora_solicitada, hora_original, motivo, status, created_by_nome, anexos
    ) VALUES (
      v_link.tenant_id, v_link.colaborador_id::uuid, v_link.colaborador_nome, v_link.colaborador_cpf,
      v_data, v_tipo_ajuste, v_tipo,
      v_hora, v_hora_original, v_motivo_item, 'pendente',
      v_link.colaborador_nome || ' (link externo)', COALESCE(p_anexos, '[]'::jsonb)
    ) RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'total', v_count, 'ids', to_jsonb(v_ids));
END;
$$;


GRANT EXECUTE ON FUNCTION externo.solicitar_ajustes_ponto_externo_batch(text, jsonb, text, jsonb) TO anon, authenticated;
