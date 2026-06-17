-- =========================================================
-- Integra FÉRIAS e ATESTADO ao espelho de ponto
--
-- Hoje só AFASTAMENTO abona o dia (status 'justificado'). Esta
-- migration estende a consolidação para também abonar dias de:
--   - Férias (ferias_solicitacoes, status aprovado/em_gozo/concluido)
--   - Atestado (atestados, período data_inicio/fim_afastamento)
--
-- Mantém o status 'justificado' (sem novos status). O LABEL específico
-- no espelho vem do PREFIXO da observação, reconhecido pelo front:
--   'Férias: ...', 'Atestado: ...', 'Afastamento (...): ...'
-- Prioridade quando há sobreposição: Férias > Atestado > Afastamento.
--
-- Inclui reconsolidação retroativa dos dias de férias/atestado vigentes
-- (próximos/últimos 60 dias) para refletir lançamentos já existentes.
-- =========================================================

CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID AS $$
DECLARE
  v_afast public.afastamentos;
  v_ferias public.ferias_solicitacoes;
  v_atest public.atestados;
  v_marc RECORD;
  v_classe TEXT;
  v_esperado TEXT := 'in';
  v_aberto_em TIME := NULL;
  v_total_minutos INT := 0;
  v_count INT := 0;
  v_primeira_entrada TIME := NULL;
  v_ultima_saida TIME := NULL;
  v_saida_almoco TIME := NULL;
  v_retorno_almoco TIME := NULL;
  v_jornada_aberta BOOLEAN := false;
  v_anomalia BOOLEAN := false;  -- entrada dupla (período órfão descartado)
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
  v_observacao TEXT := NULL;
  v_tem_ajuste_pendente BOOLEAN := false;
  v_colaborador_id UUID;
  v_colaborador_nome TEXT;
  v_empresa_id UUID;
  v_outs TIME[] := '{}';
  v_ins  TIME[] := '{}';
  v_escala RECORD;
BEGIN
  SELECT colaborador_id, colaborador_nome INTO v_colaborador_id, v_colaborador_nome
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
  ORDER BY created_at DESC LIMIT 1;

  IF v_colaborador_id IS NULL THEN
    SELECT colaborador_id, colaborador_nome INTO v_colaborador_id, v_colaborador_nome
    FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  v_empresa_id := public.ponto_empresa_do_colaborador(v_colaborador_id);

  -- Férias vigentes (aprovada/em gozo): dia abonado como "Férias"
  SELECT f.* INTO v_ferias
  FROM public.ferias_solicitacoes f
  WHERE f.tenant_id = p_tenant_id
    AND f.colaborador_cpf = p_colaborador_cpf
    AND f.status IN ('aprovado','em_gozo','concluido')
    AND f.data_inicio <= p_data
    AND f.data_fim >= p_data
  ORDER BY f.data_inicio DESC
  LIMIT 1;
  IF v_ferias.id IS NOT NULL THEN
    IF v_colaborador_id IS NULL THEN
      v_colaborador_id := v_ferias.colaborador_id;
      v_colaborador_nome := v_ferias.colaborador_nome;
      v_empresa_id := public.ponto_empresa_do_colaborador(v_colaborador_id);
    END IF;
    v_observacao := 'Férias: ' || to_char(v_ferias.data_inicio, 'DD/MM/YYYY')
      || ' a ' || to_char(v_ferias.data_fim, 'DD/MM/YYYY');
    IF v_colaborador_id IS NOT NULL THEN
      INSERT INTO public.ponto_diario (
        tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
        entrada, saida_almoco, retorno_almoco, saida,
        horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL,
        make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = 'justificado',
        observacao = EXCLUDED.observacao,
        updated_at = now();
    END IF;
    RETURN;
  END IF;

  -- Atestado vigente: dia abonado como "Atestado"
  SELECT a.* INTO v_atest
  FROM public.atestados a
  WHERE a.tenant_id = p_tenant_id
    AND a.colaborador_cpf = p_colaborador_cpf
    AND a.data_inicio_afastamento IS NOT NULL
    AND a.data_inicio_afastamento <= p_data
    AND (a.data_fim_afastamento IS NULL OR a.data_fim_afastamento >= p_data)
  ORDER BY a.data_inicio_afastamento DESC
  LIMIT 1;
  IF v_atest.id IS NOT NULL THEN
    IF v_colaborador_id IS NULL THEN
      v_colaborador_id := v_atest.colaborador_id;
      v_colaborador_nome := v_atest.colaborador_nome;
      v_empresa_id := public.ponto_empresa_do_colaborador(v_colaborador_id);
    END IF;
    v_observacao := 'Atestado: ' || to_char(v_atest.data_inicio_afastamento, 'DD/MM/YYYY')
      || CASE WHEN v_atest.data_fim_afastamento IS NOT NULL
           THEN ' a ' || to_char(v_atest.data_fim_afastamento, 'DD/MM/YYYY')
           ELSE '' END;
    IF v_colaborador_id IS NOT NULL THEN
      INSERT INTO public.ponto_diario (
        tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
        entrada, saida_almoco, retorno_almoco, saida,
        horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL,
        make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = 'justificado',
        observacao = EXCLUDED.observacao,
        updated_at = now();
    END IF;
    RETURN;
  END IF;

  -- Afastamento vigente: dia abonado (inalterado)
  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    IF v_colaborador_id IS NULL THEN
      v_colaborador_id := v_afast.colaborador_id;
      v_colaborador_nome := v_afast.colaborador_nome;
      v_empresa_id := public.ponto_empresa_do_colaborador(v_colaborador_id);
    END IF;
    v_observacao := 'Afastamento ('
      || COALESCE(replace(v_afast.motivo_principal::text, '_', ' '), 'registrado')
      || '): de ' || to_char(v_afast.data_inicio, 'DD/MM/YYYY')
      || CASE WHEN v_afast.data_fim IS NOT NULL
           THEN ' a ' || to_char(v_afast.data_fim, 'DD/MM/YYYY')
           ELSE ' — em aberto' END;

    IF v_colaborador_id IS NOT NULL THEN
      INSERT INTO public.ponto_diario (
        tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
        entrada, saida_almoco, retorno_almoco, saida,
        horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL,
        make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = 'justificado',
        observacao = EXCLUDED.observacao,
        updated_at = now();
    END IF;
    RETURN;
  END IF;

  -- ── Alternância entrada/saída, detectando entrada dupla ──
  FOR v_marc IN
    SELECT hora_marcacao, tipo_marcacao
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
    ORDER BY hora_marcacao ASC, created_at ASC
  LOOP
    v_count := v_count + 1;
    v_classe := COALESCE(public.ponto_classifica_tipo(v_marc.tipo_marcacao), v_esperado);

    IF v_classe = 'in' THEN
      IF v_primeira_entrada IS NULL THEN
        v_primeira_entrada := v_marc.hora_marcacao;
      END IF;
      v_ins := v_ins || v_marc.hora_marcacao;
      IF v_aberto_em IS NOT NULL THEN
        v_anomalia := true; -- entrada com jornada já aberta: período órfão
      END IF;
      v_aberto_em := v_marc.hora_marcacao;
      v_esperado := 'out';
    ELSE
      IF v_aberto_em IS NOT NULL THEN
        v_total_minutos := v_total_minutos + GREATEST(0,
          (EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_aberto_em)) / 60)::INT);
        v_aberto_em := NULL;
      ELSE
        v_anomalia := true; -- saída sem entrada aberta
      END IF;
      v_outs := v_outs || v_marc.hora_marcacao;
      v_ultima_saida := v_marc.hora_marcacao;
      v_esperado := 'in';
    END IF;
  END LOOP;

  v_jornada_aberta := (v_aberto_em IS NOT NULL);

  IF array_length(v_outs, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco FROM unnest(v_ins) AS t
    WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
  END IF;
  IF v_jornada_aberta AND array_length(v_outs, 1) >= 1 AND array_length(v_ins, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco FROM unnest(v_ins) AS t
    WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
    v_ultima_saida := NULL;
  END IF;

  v_horas_trabalhadas := make_interval(mins => v_total_minutos);

  SELECT EXISTS (
    SELECT 1 FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_referencia = p_data
      AND status = 'pendente'
  ) INTO v_tem_ajuste_pendente;

  IF v_tem_ajuste_pendente THEN
    v_status := 'ajuste_pendente';
  ELSIF v_count = 0 THEN
    v_status := 'falta';
  ELSIF v_jornada_aberta OR v_anomalia THEN
    v_status := 'incompleto';
  ELSE
    -- Atraso pela ESCALA do colaborador (sem escala: não marca atraso)
    v_status := 'regular';
    SELECT * INTO v_escala FROM public.ponto_escala_do_dia(p_tenant_id, p_colaborador_cpf, v_colaborador_id, p_data);
    IF v_escala.hora_entrada IS NOT NULL
       AND v_primeira_entrada IS NOT NULL
       AND v_primeira_entrada > (v_escala.hora_entrada + make_interval(mins => v_escala.tolerancia_min)) THEN
      v_status := 'atraso';
    END IF;
  END IF;

  IF v_anomalia AND NOT v_tem_ajuste_pendente THEN
    v_observacao := 'Sequência de marcações incompleta (entrada/saída sem par) — horas do período não pareado não contabilizadas. Solicite ajuste de ponto.';
  END IF;

  IF v_colaborador_id IS NOT NULL THEN
    INSERT INTO public.ponto_diario (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
      entrada, saida_almoco, retorno_almoco, saida,
      horas_trabalhadas, status, observacao
    ) VALUES (
      p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
      v_primeira_entrada, v_saida_almoco, v_retorno_almoco, v_ultima_saida,
      v_horas_trabalhadas, v_status, v_observacao
    )
    ON CONFLICT (tenant_id, colaborador_cpf, data)
    DO UPDATE SET
      empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
      entrada = EXCLUDED.entrada,
      saida_almoco = EXCLUDED.saida_almoco,
      retorno_almoco = EXCLUDED.retorno_almoco,
      saida = EXCLUDED.saida,
      horas_trabalhadas = EXCLUDED.horas_trabalhadas,
      status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE EXCLUDED.status END,
      observacao = CASE
        WHEN public.ponto_diario.status = 'justificado' AND public.ponto_diario.observacao LIKE 'Abonado por afastamento%' THEN public.ponto_diario.observacao
        ELSE EXCLUDED.observacao END,
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Reconsolida os últimos 45 dias (mesmo escopo da v3), pulando fechados
DO $reconsolida$
DECLARE
  v RECORD;
  v_pulados INT := 0;
BEGIN
  FOR v IN
    SELECT DISTINCT tenant_id, colaborador_cpf, data_marcacao
    FROM public.ponto_marcacoes
    WHERE data_marcacao >= CURRENT_DATE - 45
  LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v.data_marcacao);
    EXCEPTION WHEN OTHERS THEN
      v_pulados := v_pulados + 1;
    END;
  END LOOP;
  RAISE NOTICE 'Reconsolidação (reafirmação v3) concluída. Pulados: %', v_pulados;
END $reconsolida$;

-- ── Reconsolidação retroativa: férias e atestados que cobrem dias
--    dentro de uma janela de -60 a +60 dias de hoje ──
DO $rec$
DECLARE
  v RECORD;
  v_d DATE;
BEGIN
  -- Férias aprovadas/em gozo
  FOR v IN
    SELECT tenant_id, colaborador_cpf, data_inicio, data_fim
    FROM public.ferias_solicitacoes
    WHERE status IN ('aprovado','em_gozo','concluido')
      AND data_fim >= CURRENT_DATE - 60
      AND data_inicio <= CURRENT_DATE + 60
      AND colaborador_cpf IS NOT NULL
  LOOP
    v_d := GREATEST(v.data_inicio, CURRENT_DATE - 60);
    WHILE v_d <= LEAST(v.data_fim, CURRENT_DATE + 60) LOOP
      BEGIN
        PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v_d);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      v_d := v_d + 1;
    END LOOP;
  END LOOP;

  -- Atestados com período
  FOR v IN
    SELECT tenant_id, colaborador_cpf, data_inicio_afastamento AS di,
           COALESCE(data_fim_afastamento, data_inicio_afastamento) AS df
    FROM public.atestados
    WHERE data_inicio_afastamento IS NOT NULL
      AND COALESCE(data_fim_afastamento, data_inicio_afastamento) >= CURRENT_DATE - 60
      AND data_inicio_afastamento <= CURRENT_DATE + 60
      AND colaborador_cpf IS NOT NULL
  LOOP
    v_d := GREATEST(v.di, CURRENT_DATE - 60);
    WHILE v_d <= LEAST(v.df, CURRENT_DATE + 60) LOOP
      BEGIN
        PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v_d);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      v_d := v_d + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Reconsolidação férias/atestado concluída';
END $rec$;

-- ── Triggers: ao lançar/alterar férias ou atestado, consolida os dias
--    do período para que apareçam no espelho mesmo sem batida de ponto ──
CREATE OR REPLACE FUNCTION public.trg_consolida_ferias()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d DATE;
BEGIN
  IF NEW.colaborador_cpf IS NULL THEN RETURN NEW; END IF;
  -- Limita a janela para não varrer períodos absurdos
  v_d := GREATEST(NEW.data_inicio, CURRENT_DATE - 120);
  WHILE v_d <= LEAST(NEW.data_fim, CURRENT_DATE + 180) LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, v_d);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    v_d := v_d + 1;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_consolida_ferias ON public.ferias_solicitacoes;
CREATE TRIGGER trigger_consolida_ferias
  AFTER INSERT OR UPDATE OF status, data_inicio, data_fim ON public.ferias_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_consolida_ferias();

CREATE OR REPLACE FUNCTION public.trg_consolida_atestado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d DATE; v_fim DATE;
BEGIN
  IF NEW.colaborador_cpf IS NULL OR NEW.data_inicio_afastamento IS NULL THEN RETURN NEW; END IF;
  v_fim := COALESCE(NEW.data_fim_afastamento, NEW.data_inicio_afastamento);
  v_d := GREATEST(NEW.data_inicio_afastamento, CURRENT_DATE - 120);
  WHILE v_d <= LEAST(v_fim, CURRENT_DATE + 180) LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(NEW.tenant_id, NEW.colaborador_cpf, v_d);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    v_d := v_d + 1;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_consolida_atestado ON public.atestados;
CREATE TRIGGER trigger_consolida_atestado
  AFTER INSERT OR UPDATE OF data_inicio_afastamento, data_fim_afastamento ON public.atestados
  FOR EACH ROW EXECUTE FUNCTION public.trg_consolida_atestado();
