-- =========================================================
-- ATRASO PELA ESCALA DO COLABORADOR (em vez de 08:10 fixo)
--
-- A consolidação marcava 'atraso' sempre que a primeira
-- entrada do dia fosse após 08:10, ignorando a escala.
-- Colaboradores de turno vespertino/noturno apareciam
-- eternamente como "Atraso".
--
-- Agora: o limite = hora_entrada_padrao da escala vigente do
-- colaborador na data + tolerancia_minutos da escala.
-- Sem escala atribuída, mantém o comportamento atual
-- (08:00 + 10min = 08:10), sem mudança para quem não usa escalas.
--
-- Ao final, reconsolida os dias recentes marcados como
-- 'atraso' de colaboradores COM escala (os únicos cujo status
-- pode mudar), pulando períodos fechados.
-- =========================================================

CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID AS $$
DECLARE
  v_afast public.afastamentos;
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
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
  v_observacao TEXT := NULL;
  v_tem_ajuste_pendente BOOLEAN := false;
  v_colaborador_id UUID;
  v_colaborador_nome TEXT;
  v_outs TIME[] := '{}';
  v_ins  TIME[] := '{}';
  -- Escala vigente do colaborador na data (para o limite de atraso)
  v_escala_entrada TIME := NULL;
  v_escala_tolerancia INT := NULL;
  v_limite_atraso TIME;
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

  -- Afastamento vigente? Dia abonado.
  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    IF v_colaborador_id IS NULL THEN
      v_colaborador_id := v_afast.colaborador_id;
      v_colaborador_nome := v_afast.colaborador_nome;
    END IF;
    v_observacao := 'Abonado por afastamento ('
      || COALESCE(replace(v_afast.motivo_principal::text, '_', ' '), 'registrado')
      || ') de ' || to_char(v_afast.data_inicio, 'DD/MM/YYYY')
      || CASE WHEN v_afast.data_fim IS NOT NULL
           THEN ' a ' || to_char(v_afast.data_fim, 'DD/MM/YYYY')
           ELSE ' — em aberto' END;

    IF v_colaborador_id IS NOT NULL THEN
      INSERT INTO public.ponto_diario (
        tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
        entrada, saida_almoco, retorno_almoco, saida,
        horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL,
        make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        status = 'justificado',
        observacao = EXCLUDED.observacao,
        updated_at = now();
    END IF;
    RETURN;
  END IF;

  -- ── Fluxo normal (alternância entrada/saída) ──
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
      v_aberto_em := v_marc.hora_marcacao;
      v_esperado := 'out';
    ELSE
      IF v_aberto_em IS NOT NULL THEN
        v_total_minutos := v_total_minutos + GREATEST(0,
          (EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_aberto_em)) / 60)::INT);
        v_aberto_em := NULL;
      END IF;
      v_outs := v_outs || v_marc.hora_marcacao;
      v_ultima_saida := v_marc.hora_marcacao;
      v_esperado := 'in';
    END IF;
  END LOOP;

  v_jornada_aberta := (v_aberto_em IS NOT NULL);

  IF array_length(v_outs, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco
    FROM unnest(v_ins) AS t
    WHERE t > v_outs[1]
    ORDER BY t ASC LIMIT 1;
  END IF;
  IF v_jornada_aberta AND array_length(v_outs, 1) >= 1 AND array_length(v_ins, 1) >= 2 THEN
    v_saida_almoco := v_outs[1];
    SELECT t INTO v_retorno_almoco
    FROM unnest(v_ins) AS t
    WHERE t > v_outs[1]
    ORDER BY t ASC LIMIT 1;
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

  -- ── Limite de atraso pela ESCALA vigente do colaborador na data ──
  -- Atribuição ativa cujo período cobre p_data, casada por CPF ou id.
  SELECT e.hora_entrada_padrao, e.tolerancia_minutos
  INTO v_escala_entrada, v_escala_tolerancia
  FROM public.ponto_escala_atribuicoes pa
  JOIN public.ponto_escalas e
    ON e.id = pa.escala_id AND COALESCE(e.ativa, true)
  WHERE pa.tenant_id = p_tenant_id
    AND COALESCE(pa.ativa, true)
    AND (
      (pa.colaborador_cpf IS NOT NULL AND pa.colaborador_cpf = p_colaborador_cpf)
      OR (v_colaborador_id IS NOT NULL AND pa.colaborador_id = v_colaborador_id::text)
    )
    AND pa.data_inicio <= p_data
    AND (pa.data_fim IS NULL OR pa.data_fim >= p_data)
  ORDER BY pa.data_inicio DESC, pa.created_at DESC
  LIMIT 1;

  -- Sem escala: mantém o comportamento anterior (08:00 + 10min = 08:10)
  v_limite_atraso := COALESCE(v_escala_entrada, '08:00'::TIME)
    + make_interval(mins => COALESCE(v_escala_tolerancia, 10));

  IF v_tem_ajuste_pendente THEN
    v_status := 'ajuste_pendente';
  ELSIF v_count = 0 THEN
    v_status := 'falta';
  ELSIF v_jornada_aberta THEN
    v_status := 'incompleto';
  ELSIF v_primeira_entrada IS NOT NULL AND v_primeira_entrada > v_limite_atraso THEN
    v_status := 'atraso';
  ELSE
    v_status := 'regular';
  END IF;

  IF v_colaborador_id IS NOT NULL THEN
    INSERT INTO public.ponto_diario (
      tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
      entrada, saida_almoco, retorno_almoco, saida,
      horas_trabalhadas, status
    ) VALUES (
      p_tenant_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
      v_primeira_entrada, v_saida_almoco, v_retorno_almoco, v_ultima_saida,
      v_horas_trabalhadas, v_status
    )
    ON CONFLICT (tenant_id, colaborador_cpf, data)
    DO UPDATE SET
      entrada = EXCLUDED.entrada,
      saida_almoco = EXCLUDED.saida_almoco,
      retorno_almoco = EXCLUDED.retorno_almoco,
      saida = EXCLUDED.saida,
      horas_trabalhadas = EXCLUDED.horas_trabalhadas,
      status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE EXCLUDED.status END,
      observacao = CASE WHEN public.ponto_diario.observacao LIKE 'Abonado por afastamento%' THEN NULL ELSE public.ponto_diario.observacao END,
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- ---------------------------------------------------------
-- Reconsolida dias recentes marcados como 'atraso' de
-- colaboradores COM escala atribuída (únicos cujo status pode
-- mudar com a nova regra). Pula períodos fechados.
-- ---------------------------------------------------------
DO $reconsolida$
DECLARE
  v RECORD;
  v_pulados INT := 0;
BEGIN
  FOR v IN
    SELECT DISTINCT pd.tenant_id, pd.colaborador_cpf, pd.data
    FROM public.ponto_diario pd
    WHERE pd.status = 'atraso'
      AND pd.data >= CURRENT_DATE - 45
      AND EXISTS (
        SELECT 1
        FROM public.ponto_escala_atribuicoes pa
        WHERE pa.tenant_id = pd.tenant_id
          AND COALESCE(pa.ativa, true)
          AND (
            (pa.colaborador_cpf IS NOT NULL AND pa.colaborador_cpf = pd.colaborador_cpf)
            OR pa.colaborador_id = pd.colaborador_id::text
          )
          AND pa.data_inicio <= pd.data
          AND (pa.data_fim IS NULL OR pa.data_fim >= pd.data)
      )
  LOOP
    BEGIN
      PERFORM public.consolidar_ponto_diario_manual(v.tenant_id, v.colaborador_cpf, v.data);
    EXCEPTION WHEN OTHERS THEN
      v_pulados := v_pulados + 1; -- período fechado ou outra trava: mantém
    END;
  END LOOP;
  RAISE NOTICE 'Reconsolidação de atrasos concluída. Dias pulados: %', v_pulados;
END $reconsolida$;
