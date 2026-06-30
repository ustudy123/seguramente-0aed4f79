-- =========================================================
-- Fix: atestado de HORAS (parcial) não deve gerar "Atraso"
--
-- Caso real: colaboradora com atestado médico pela manhã (atestado de horas)
-- bate o ponto à tarde (ex.: 13:22). O cálculo do dia comparava a 1ª entrada
-- com a escala e marcava 'atraso', ignorando que a manhã estava coberta pelo
-- atestado. Resultado: dia indevidamente rotulado como "Atraso".
--
-- Correção em _ponto_calc_dia: se há um atestado de HORAS vigente no dia, a
-- chegada tardia é justificada pelo atestado — o dia deixa de ser 'atraso'
-- (vira 'regular'), preservando as horas trabalhadas reais. Demais regras
-- (falta, incompleto, ajuste_pendente, dia cheio) ficam inalteradas.
--
-- Reconsolida retroativamente apenas os dias hoje em 'atraso' que tenham
-- atestado de horas (não toca em dias 'justificado'/férias/afastamento).
-- =========================================================

CREATE OR REPLACE FUNCTION public._ponto_calc_dia(
  p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE, p_cid UUID,
  OUT o_pent TIME, OUT o_salm TIME, OUT o_ralm TIME, OUT o_usai TIME,
  OUT o_horas INTERVAL, OUT o_status TEXT, OUT o_obs TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $calc$
DECLARE
  v_marc RECORD;
  v_count INT := 0;
  v_ins TIME[] := '{}'; v_outs TIME[] := '{}';
  v_abr TIME; v_classe TEXT; v_esp TEXT := 'in';
  v_min INT := 0; v_dif INT;
  v_anom BOOLEAN := false; v_aberta BOOLEAN := false;
  v_pend BOOLEAN := false; v_esc RECORD;
BEGIN
  FOR v_marc IN
    SELECT hora_marcacao, tipo_marcacao FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf AND data_marcacao = p_data
    ORDER BY hora_marcacao ASC, created_at ASC
  LOOP
    v_count := v_count + 1;
    v_classe := COALESCE(public.ponto_classifica_tipo(v_marc.tipo_marcacao), v_esp);
    IF v_classe = 'in' THEN
      o_pent := COALESCE(o_pent, v_marc.hora_marcacao);
      v_ins := v_ins || v_marc.hora_marcacao;
      IF v_abr IS NOT NULL THEN v_anom := true; END IF;
      v_abr := v_marc.hora_marcacao; v_esp := 'out';
    ELSE
      IF v_abr IS NOT NULL THEN
        v_dif := (EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT;
        IF v_dif < 0 THEN v_dif := v_dif + 1440; END IF;
        v_min := v_min + GREATEST(0, v_dif);
        v_abr := NULL;
      ELSE
        v_anom := true;
      END IF;
      v_outs := v_outs || v_marc.hora_marcacao;
      o_usai := v_marc.hora_marcacao; v_esp := 'in';
    END IF;
  END LOOP;

  v_aberta := (v_abr IS NOT NULL);
  IF array_length(v_outs,1) >= 2 THEN
    o_salm := v_outs[1];
    SELECT t INTO o_ralm FROM unnest(v_ins) AS t WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
  END IF;
  IF v_aberta AND array_length(v_outs,1) >= 1 AND array_length(v_ins,1) >= 2 THEN
    o_salm := v_outs[1];
    SELECT t INTO o_ralm FROM unnest(v_ins) AS t WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
    o_usai := NULL;
  END IF;
  o_horas := make_interval(mins => v_min);

  SELECT EXISTS (SELECT 1 FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
      AND data_referencia = p_data AND status = 'pendente') INTO v_pend;

  IF v_pend THEN o_status := 'ajuste_pendente';
  ELSIF v_count = 0 THEN o_status := 'falta';
  ELSIF v_aberta OR v_anom THEN o_status := 'incompleto';
  ELSE
    o_status := 'regular';
    SELECT * INTO v_esc FROM public.ponto_escala_do_dia(p_tenant_id, p_colaborador_cpf, p_cid, p_data);
    IF v_esc.hora_entrada IS NOT NULL AND o_pent IS NOT NULL
       AND o_pent > (v_esc.hora_entrada + make_interval(mins => v_esc.tolerancia_min)) THEN
      o_status := 'atraso';
    END IF;
  END IF;

  -- Atestado de HORAS no dia: a ausência parcial (manhã/tarde) é justificada
  -- pelo atestado, então um atraso na (re)entrada não deve penalizar o dia.
  -- Mantém as horas trabalhadas; apenas evita rotular como 'atraso'.
  IF o_status = 'atraso' AND EXISTS (
    SELECT 1 FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id AND a.colaborador_cpf = p_colaborador_cpf
      AND a.data_inicio_afastamento IS NOT NULL
      AND COALESCE(a.unidade_afastamento,'dias') = 'horas'
      AND a.data_inicio_afastamento <= p_data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= p_data
  ) THEN
    o_status := 'regular';
    o_obs := COALESCE(NULLIF(o_obs, '') || ' ', '') || 'Atraso justificado por atestado de horas no dia.';
  END IF;

  IF v_anom AND NOT v_pend THEN
    o_obs := 'Sequência de marcações incompleta (entrada/saída sem par) — horas do período não pareado não contabilizadas. Solicite ajuste de ponto.';
  END IF;
END;
$calc$;

-- ── Reconsolidação retroativa: só os dias hoje em 'atraso' com atestado de
--    horas (não toca em 'justificado'/férias/afastamento) ──
DO $rec$
DECLARE v RECORD;
BEGIN
  FOR v IN
    SELECT DISTINCT pd.tenant_id, pd.colaborador_cpf, pd.data
    FROM public.ponto_diario pd
    WHERE pd.status = 'atraso'
      AND pd.data >= CURRENT_DATE - 90
      AND EXISTS (
        SELECT 1 FROM public.atestados a
        WHERE a.tenant_id = pd.tenant_id
          AND a.colaborador_cpf = pd.colaborador_cpf
          AND a.data_inicio_afastamento IS NOT NULL
          AND COALESCE(a.unidade_afastamento,'dias') = 'horas'
          AND a.data_inicio_afastamento <= pd.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= pd.data
      )
  LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v.data);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RAISE NOTICE 'Reconsolidação atraso x atestado de horas concluída';
END $rec$;
