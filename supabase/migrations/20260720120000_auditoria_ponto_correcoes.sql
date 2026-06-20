-- =========================================================
-- AUDITORIA DO PONTO — correções de banco
--
-- 1. Recria proximo_tipo_marcacao_externo (estava AUSENTE do banco,
--    embora definida em migrations e chamada pelo PWA — toda chamada
--    retornava erro; é a função que decide Entrada/Saída no app).
-- 2. Remove overload órfão registrar_ponto_externo(...p_selfie_base64)
--    que não é usado por ninguém (a versão com p_selfie_url/_nome é a
--    vigente).
-- 3. Consolidação: trata VIRADA DE MEIA-NOITE (turno noturno) — saída
--    menor que a entrada aberta passa a contar como dia seguinte, em
--    vez de zerar as horas.
-- 4. Helper para materializar FALTAS de dias sem marcação (consolida
--    todos os colaboradores ativos em uma data), evitando que faltas
--    e dias sem registro "sumam" do espelho.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) RECRIA proximo_tipo_marcacao_externo (função sumida)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proximo_tipo_marcacao_externo(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_data DATE;
  v_ultima RECORD;
  v_proximo TEXT;
  v_marcacoes JSON;
  v_afast public.afastamentos;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  v_afast := public.afastamento_vigente(v_link.tenant_id, v_link.colaborador_cpf, v_data);
  IF v_afast.id IS NOT NULL THEN
    RETURN json_build_object(
      'afastado', true,
      'afastado_ate', CASE WHEN v_afast.data_fim IS NOT NULL THEN to_char(v_afast.data_fim, 'DD/MM/YYYY') ELSE NULL END,
      'afastado_desde', to_char(v_afast.data_inicio, 'DD/MM/YYYY')
    );
  END IF;

  SELECT hora_marcacao, tipo_marcacao INTO v_ultima
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima.tipo_marcacao IS NULL THEN
    v_proximo := 'entrada';
  ELSIF COALESCE(public.ponto_classifica_tipo(v_ultima.tipo_marcacao), 'in') = 'in' THEN
    v_proximo := 'saida';
  ELSE
    v_proximo := 'entrada';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'tipo', tipo_marcacao,
    'classe', COALESCE(public.ponto_classifica_tipo(tipo_marcacao), 'in'),
    'hora', to_char(hora_marcacao, 'HH24:MI')
  ) ORDER BY hora_marcacao ASC), '[]'::json)
  INTO v_marcacoes
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data;

  RETURN json_build_object(
    'proximo', v_proximo,
    'marcacoes', v_marcacoes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────
-- 2) REMOVE overload órfão de registrar_ponto_externo
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.registrar_ponto_externo(
  text, text, double precision, double precision, text, text
);

-- ─────────────────────────────────────────────────────────
-- 3) CONSOLIDAÇÃO com virada de meia-noite
--    Recria consolidar_ponto_diario_manual preservando a lógica
--    vigente, mas no pareamento: se a saída for <= entrada aberta,
--    soma 24h (turno que cruza a meia-noite) em vez de zerar.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID AS $$
DECLARE
  v_afast public.afastamentos;
  v_ferias public.ferias_solicitacoes;
  v_atest public.atestados;
  v_colaborador_id UUID;
  v_colaborador_nome TEXT;
  v_empresa_id UUID;
  v_marc RECORD;
  v_count INT := 0;
  v_ins TIME[] := '{}';
  v_outs TIME[] := '{}';
  v_primeira_entrada TIME;
  v_ultima_saida TIME;
  v_saida_almoco TIME;
  v_retorno_almoco TIME;
  v_aberto_em TIME;
  v_classe TEXT;
  v_esperado TEXT := 'in';
  v_total_minutos INT := 0;
  v_anomalia BOOLEAN := false;
  v_jornada_aberta BOOLEAN := false;
  v_horas_trabalhadas INTERVAL;
  v_status TEXT;
  v_observacao TEXT;
  v_tem_ajuste_pendente BOOLEAN := false;
  v_escala RECORD;
  v_diff_min INT;
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

  -- Férias vigentes
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
        entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL, make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = 'justificado', observacao = EXCLUDED.observacao, updated_at = now();
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
        entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL, make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = 'justificado', observacao = EXCLUDED.observacao, updated_at = now();
    END IF;
    RETURN;
  END IF;

  -- Afastamento vigente
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
        entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao
      ) VALUES (
        p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf, p_data,
        NULL, NULL, NULL, NULL, make_interval(mins => 0), 'justificado', v_observacao
      )
      ON CONFLICT (tenant_id, colaborador_cpf, data)
      DO UPDATE SET
        empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
        status = 'justificado', observacao = EXCLUDED.observacao, updated_at = now();
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
        v_anomalia := true;
      END IF;
      v_aberto_em := v_marc.hora_marcacao;
      v_esperado := 'out';
    ELSE
      IF v_aberto_em IS NOT NULL THEN
        -- Diferença em minutos. Se a saída for <= entrada, considera que
        -- cruzou a meia-noite (turno noturno) e soma 24h, em vez de zerar.
        v_diff_min := (EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_aberto_em)) / 60)::INT;
        IF v_diff_min < 0 THEN
          v_diff_min := v_diff_min + 24 * 60;
        END IF;
        v_total_minutos := v_total_minutos + GREATEST(0, v_diff_min);
        v_aberto_em := NULL;
      ELSE
        v_anomalia := true;
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
      colaborador_nome = EXCLUDED.colaborador_nome,
      entrada = EXCLUDED.entrada,
      saida_almoco = EXCLUDED.saida_almoco,
      retorno_almoco = EXCLUDED.retorno_almoco,
      saida = EXCLUDED.saida,
      horas_trabalhadas = EXCLUDED.horas_trabalhadas,
      status = CASE WHEN public.ponto_diario.status = 'justificado'
                    THEN 'justificado'
                    ELSE EXCLUDED.status END,
      observacao = CASE
        WHEN public.ponto_diario.status = 'justificado'
             AND public.ponto_diario.observacao LIKE 'Abonado por afastamento%'
        THEN public.ponto_diario.observacao
        ELSE EXCLUDED.observacao END,
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─────────────────────────────────────────────────────────
-- 4) Helper: materializa o dia para TODOS os colaboradores ativos
--    (faz faltas e dias sem marcação aparecerem no espelho).
--    Pode ser chamado sob demanda ou por um agendamento diário.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consolidar_ponto_dia_todos(p_tenant_id UUID, p_data DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_colab RECORD;
  v_n INT := 0;
BEGIN
  FOR v_colab IN
    SELECT DISTINCT a.cpf
    FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id
      AND a.cpf IS NOT NULL
      AND COALESCE(a.inativo, false) = false
      AND COALESCE(a.bate_ponto, true) = true
      AND a.data_admissao <= p_data
  LOOP
    PERFORM public.consolidar_ponto_diario_manual(p_tenant_id, v_colab.cpf, p_data);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consolidar_ponto_dia_todos(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidar_ponto_dia_todos(uuid, date) TO authenticated;

-- Garante que o front (gestor autenticado) possa reconsolidar um dia
-- via RPC após editar uma marcação no espelho.
GRANT EXECUTE ON FUNCTION public.consolidar_ponto_diario_manual(uuid, text, date) TO authenticated;
