-- =========================================================
-- CONSOLIDAÇÃO v3 + limpeza de duplicatas de migração
--
-- 1) ATRASO POR ESCALA (caso Letícia 14h-18h):
--    o limite de atraso era fixo em 08:10. Agora usa a escala
--    atribuída ao colaborador (hora_entrada_padrao + tolerância);
--    SEM escala atribuída → não marca atraso (regular)
-- 2) ANOMALIA DE SEQUÊNCIA (caso Luciani 01h11min):
--    duas entradas seguidas (saída esquecida) descartavam o
--    período sem avisar; o dia ficava "regular" enganoso.
--    Agora o dia fica 'incompleto' com observação orientando
--    a solicitar ajuste — sem inventar horas
-- 3) LIMPEZA das batidas duplicadas da Adriana (eco da
--    migração dos dois tenants: 12:00/12:02/12:04 etc.)
-- =========================================================

-- ---------------------------------------------------------
-- Helper: escala vigente do colaborador na data
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_escala_do_dia(p_tenant_id uuid, p_cpf text, p_colaborador_id uuid, p_data date)
RETURNS TABLE (hora_entrada time, tolerancia_min int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT e.hora_entrada_padrao, COALESCE(e.tolerancia_diaria_minutos, 10)
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_cpf OR a.colaborador_id = p_colaborador_id::text)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;
$$;

-- ---------------------------------------------------------
-- Consolidação v3
-- ---------------------------------------------------------
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

  -- Afastamento vigente: dia abonado (inalterado)
  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    IF v_colaborador_id IS NULL THEN
      v_colaborador_id := v_afast.colaborador_id;
      v_colaborador_nome := v_afast.colaborador_nome;
      v_empresa_id := public.ponto_empresa_do_colaborador(v_colaborador_id);
    END IF;
    v_observacao := 'Abonado por afastamento ('
      || COALESCE(replace(v_afast.motivo_principal::text, '_', ' '), 'registrado')
      || ') de ' || to_char(v_afast.data_inicio, 'DD/MM/YYYY')
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

-- ---------------------------------------------------------
-- Limpeza das duplicatas de migração da ADRIANA:
-- marcações da mesma classe (entrada/saída) a menos de 10min
-- uma da outra no mesmo dia — mantém a PRIMEIRA de cada grupo
-- ---------------------------------------------------------
DO $limpeza$
DECLARE
  v_del int;
BEGIN
  PERFORM set_config('app.allow_ponto_delete', 'true', true);

  WITH ordenadas AS (
    SELECT id, data_marcacao, hora_marcacao,
           COALESCE(public.ponto_classifica_tipo(tipo_marcacao), 'in') AS classe,
           LAG(hora_marcacao) OVER (
             PARTITION BY data_marcacao, COALESCE(public.ponto_classifica_tipo(tipo_marcacao), 'in')
             ORDER BY hora_marcacao
           ) AS hora_anterior
    FROM public.ponto_marcacoes
    WHERE tenant_id = '83f1b040-c857-45a4-b71d-506e2a32d527'
      AND colaborador_cpf = '06153113931'
  )
  DELETE FROM public.ponto_marcacoes pm
  USING ordenadas o
  WHERE pm.id = o.id
    AND o.hora_anterior IS NOT NULL
    AND o.hora_marcacao - o.hora_anterior < interval '10 minutes';
  GET DIAGNOSTICS v_del = ROW_COUNT;
  RAISE NOTICE 'Duplicatas de migração removidas (Adriana): %', v_del;

  PERFORM set_config('app.allow_ponto_delete', 'false', true);
END $limpeza$;

-- ---------------------------------------------------------
-- Reconsolida os últimos 45 dias (corrige "atrasos" indevidos
-- de turnos da tarde e os dias com anomalia), pulando fechados
-- ---------------------------------------------------------
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
  RAISE NOTICE 'Reconsolidação concluída. Pulados (períodos fechados): %', v_pulados;
END $reconsolida$;

-- ---------------------------------------------------------
-- CONFERÊNCIA: Adriana, Letícia e Luciani nos últimos dias
-- ---------------------------------------------------------
SELECT colaborador_nome, data, status,
       to_char(entrada, 'HH24:MI') AS entrada,
       to_char(saida, 'HH24:MI') AS saida,
       horas_trabalhadas, observacao
FROM public.ponto_diario
WHERE (colaborador_nome ILIKE '%adriana medeiros%'
   OR colaborador_nome ILIKE '%leticia%vargas%'
   OR colaborador_nome ILIKE '%luciani%')
  AND data >= CURRENT_DATE - 3
ORDER BY colaborador_nome, data DESC;
