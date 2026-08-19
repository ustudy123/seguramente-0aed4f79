-- ============================================================================
-- ONDA 3 (parte 4) — Turno da virada pertence ao dia de início
-- PONTO-022
--
-- A jornada que cruza a meia-noite (ex.: entrada 22:00, saída 06:00 do dia
-- seguinte, ambas lançadas no dia de início) pertence INTEGRALMENTE ao dia em
-- que começou. Dois pontos ordenavam as batidas pelo relógio e, vendo 06:00
-- antes de 22:00, quebravam a jornada:
--   · a REORDENAÇÃO de rótulos (ponto_reordena_tipos_dia) trocava 06:00 para
--     entrada e 22:00 para saída — apurava 16h e jogava falta no dia seguinte;
--   · a CONSOLIDAÇÃO (_ponto_calc_dia) via a saída antes da entrada, marcava
--     anomalia e fechava o dia como incompleto (0h).
--
-- CORREÇÃO: ambas passam a usar uma ordem CÍCLICA das batidas — o turno começa
-- logo após o MAIOR vão do dia. Num dia comum o maior vão é o descanso noturno
-- (o dia começa na primeira batida; nada muda). Num turno de virada o maior vão
-- fica entre a saída da madrugada e a entrada da noite, então o turno começa na
-- entrada da noite e a batida da madrugada é reconhecida como do dia seguinte.
-- Nenhum horário é alterado; muda só a ORDEM em que as batidas são lidas.
--
-- O ponto de corte é calculado por uma função nova, ponto_corte_virada, usada
-- pelas duas. Dias comuns não são afetados.
-- ============================================================================

-- Ponto de corte da virada: a hora da batida que INICIA o turno (logo após o
-- maior vão do dia). Devolve NULL quando não há virada (o maior vão é o descanso
-- noturno, caso comum) — aí a ordem por relógio já está certa.
CREATE OR REPLACE FUNCTION public.ponto_corte_virada(
  p_tenant_id uuid, p_colaborador_cpf text, p_data date
) RETURNS time
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH m AS (
    SELECT hora_marcacao AS h
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
  ),
  g AS (
    SELECT h, EXTRACT(EPOCH FROM (h - lag(h) OVER (ORDER BY h)))/60 AS gap
    FROM m
  ),
  stats AS (
    SELECT (SELECT max(gap) FROM g) AS max_int,
           1440 - EXTRACT(EPOCH FROM ((SELECT max(h) FROM m) - (SELECT min(h) FROM m)))/60 AS wrap_gap
  )
  SELECT CASE
           WHEN (SELECT count(*) FROM m) < 2 THEN NULL
           WHEN s.max_int > s.wrap_gap
             THEN (SELECT h FROM g WHERE gap = s.max_int ORDER BY h LIMIT 1)
           ELSE NULL
         END
  FROM stats s;
$$;

COMMENT ON FUNCTION public.ponto_corte_virada(uuid, text, date) IS
  'Hora da batida que inicia o turno quando a jornada cruza a meia-noite (logo apos o maior vao do dia). NULL em dias comuns. Usada para ordenar as batidas em ordem ciclica.';

-- ---------------------------------------------------------------------------
-- REORDENAÇÃO de rótulos, agora em ordem cíclica (virada reconhecida).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ponto_reordena_tipos_dia(p_tenant_id uuid, p_colaborador_cpf text, p_data date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n       int;
  v_min_gap numeric;
  v_corte   time := public.ponto_corte_virada(p_tenant_id, p_colaborador_cpf, p_data);
  v_changed uuid[];
  v_id      uuid;
  v_antes   jsonb;
BEGIN
  -- Contagem e menor vão entre batidas JÁ na ordem cíclica (guarda de ruído).
  SELECT count(*), min(gap) INTO v_n, v_min_gap
  FROM (
    SELECT (ordk - lag(ordk) OVER (ORDER BY ordk)) / 60 AS gap
    FROM (
      SELECT EXTRACT(EPOCH FROM hora_marcacao)
             + CASE WHEN v_corte IS NOT NULL AND hora_marcacao < v_corte
                    THEN 86400 ELSE 0 END AS ordk
      FROM public.ponto_marcacoes
      WHERE tenant_id = p_tenant_id
        AND colaborador_cpf = p_colaborador_cpf
        AND data_marcacao = p_data
    ) e
  ) g;

  IF v_n IS NULL OR v_n = 0
     OR v_n % 2 = 1
     OR (v_min_gap IS NOT NULL AND v_min_gap < 15) THEN
    RETURN false;
  END IF;

  -- Retrato de antes, para o log de auditoria.
  SELECT jsonb_agg(jsonb_build_object('hora', hora_marcacao, 'tipo', tipo_marcacao)
                   ORDER BY hora_marcacao)
    INTO v_antes
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND data_marcacao = p_data;

  PERFORM set_config('app.ponto_reordena', 'on', true);

  WITH reord AS (
    SELECT id,
           row_number() OVER (
             ORDER BY (EXTRACT(EPOCH FROM hora_marcacao)
                       + CASE WHEN v_corte IS NOT NULL AND hora_marcacao < v_corte
                              THEN 86400 ELSE 0 END),
                      created_at
           ) AS pos
    FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data_marcacao = p_data
  ), upd AS (
    UPDATE public.ponto_marcacoes m
    SET    tipo_marcacao = CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END
    FROM   reord r
    WHERE  m.id = r.id
      AND  m.tipo_marcacao IS DISTINCT FROM
           (CASE WHEN r.pos % 2 = 1 THEN 'entrada' ELSE 'saida' END)
    RETURNING m.id
  )
  SELECT array_agg(id) INTO v_changed FROM upd;

  PERFORM set_config('app.ponto_reordena', 'off', true);

  IF v_changed IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_changed LOOP
      BEGIN
        PERFORM public.classificar_marcacao_clt(v_id);
      EXCEPTION WHEN OTHERS THEN
        NULL;  -- classificação CLT é auxiliar; nunca quebra o fluxo
      END;
    END LOOP;

    BEGIN
      INSERT INTO public.ponto_audit_log (
        tenant_id, tabela_origem, registro_id, acao,
        dados_anteriores, dados_novos, usuario_id
      )
      SELECT p_tenant_id, 'ponto_marcacoes', v_changed[1], 'AJUSTE',
             jsonb_build_object('operacao', 'REORDENACAO_ROTULOS',
                                'data', p_data, 'sequencia', v_antes),
             jsonb_build_object('operacao', 'REORDENACAO_ROTULOS',
                                'data', p_data,
                                'motivo', 'Batida incluída em horário anterior às existentes; '
                                       || 'rótulos entrada/saída reencaixados pelo relógio '
                                       || '(ordem cíclica, virada reconhecida). '
                                       || 'Nenhum horário foi alterado.',
                                'marcacoes_afetadas', to_jsonb(v_changed),
                                'sequencia', (
                                  SELECT jsonb_agg(jsonb_build_object('hora', hora_marcacao,
                                                                      'tipo', tipo_marcacao)
                                                   ORDER BY hora_marcacao)
                                  FROM public.ponto_marcacoes
                                  WHERE tenant_id = p_tenant_id
                                    AND colaborador_cpf = p_colaborador_cpf
                                    AND data_marcacao = p_data
                                )),
             auth.uid();
    EXCEPTION WHEN OTHERS THEN
      NULL;  -- auditoria é registro acessório; nunca derruba a aprovação
    END;
  END IF;

  RETURN (v_changed IS NOT NULL);
END;
$function$;

-- ---------------------------------------------------------------------------
-- CONSOLIDAÇÃO diária, lendo as batidas em ordem cíclica (virada reconhecida).
-- Só muda a ordem de leitura das batidas; o resto do cálculo é o mesmo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ponto_calc_dia(p_tenant_id uuid, p_colaborador_cpf text, p_data date, p_cid uuid, OUT o_pent time without time zone, OUT o_salm time without time zone, OUT o_ralm time without time zone, OUT o_usai time without time zone, OUT o_horas interval, OUT o_status text, OUT o_obs text)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_marc RECORD;
  v_count INT := 0;
  v_ins TIME[] := '{}'; v_outs TIME[] := '{}';
  v_abr TIME; v_classe TEXT; v_esp TEXT := 'in';
  v_min INT := 0; v_dif INT;
  v_anom BOOLEAN := false; v_aberta BOOLEAN := false;
  v_pend BOOLEAN := false; v_esc RECORD;
  v_corte TIME := public.ponto_corte_virada(p_tenant_id, p_colaborador_cpf, p_data);
BEGIN
  FOR v_marc IN
    SELECT hora_marcacao, tipo_marcacao FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf AND data_marcacao = p_data
    ORDER BY (EXTRACT(EPOCH FROM hora_marcacao)
              + CASE WHEN v_corte IS NOT NULL AND hora_marcacao < v_corte
                     THEN 86400 ELSE 0 END) ASC,
             created_at ASC
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
        -- Trunca os segundos (FLOOR) para alinhar com a exibição do Espelho
        v_dif := FLOOR(EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT;
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
$function$;
