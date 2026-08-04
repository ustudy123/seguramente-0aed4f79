CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text)
 RETURNS TABLE(dia date, entrada time without time zone, saida time without time zone, trabalhado_min integer, jornada_min integer, saldo_min integer, protegido boolean, equalizacao boolean, excedente_retido_min integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_colaborador_id text;
  v_fb_jornada int;
  v_fb_tol int := 0;
  v_fb_escala_id uuid;
  v_jornada int;
  v_tol int;
  v_esperado int;
  v_atest_min int;
  v_jornada_efetiva int;
  v_extras int;
  v_faltantes int;
  v_trab int;
  v_diff int;
  v_ent_esc time; v_sai_esc time; v_interv int; v_tol_bat int;
  v_ent_cons int; v_sai_cons int; v_trab_ajust int; v_usou_batida boolean;
  v_protegido boolean;
  v_trab_marc int;
  v_janela int;
  v_janela_cons int;
  v_interv_real int;
  v_desc_interv int;
  v_int_ini time; v_int_fim time;
  v_eq_data date;
  v_eq_total int;
  v_eq_liberado boolean := false;
  v_eq_teve_linha boolean := false;
  v_eq_m jsonb;
  v_eq_auto boolean := false;
  v_qtd_sab int := 0;
  v_ult_sab date;
  v_exc_decidido boolean;
  r RECORD;
BEGIN
  v_ult_sab := v_fim - ((EXTRACT(ISODOW FROM v_fim)::int + 1) % 7);

  SELECT colaborador_id INTO v_colaborador_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0), e.id
    INTO v_fb_jornada, v_fb_tol, v_fb_escala_id
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  SELECT pem.data_equalizacao, pem.total_equalizacao_min, (pem.art61_liberado_em IS NOT NULL)
    INTO v_eq_data, v_eq_total, v_eq_liberado
  FROM public.ponto_equalizacao_mensal pem
  WHERE pem.tenant_id = p_tenant_id
    AND pem.colaborador_cpf = v_cpf
    AND pem.competencia = p_competencia;

  IF v_eq_data IS NOT NULL AND EXTRACT(ISODOW FROM v_eq_data) <> 6 THEN
    v_eq_data := v_ult_sab;
  END IF;

  IF v_eq_data IS NULL AND v_fb_escala_id IS NOT NULL THEN
    SELECT count(*) INTO v_qtd_sab
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
      AND EXTRACT(ISODOW FROM d.data) = 6
      AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0);

    IF v_qtd_sab >= 1 THEN
      SELECT d.data INTO v_eq_data
      FROM public.ponto_diario d
      WHERE d.tenant_id = p_tenant_id
        AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
        AND d.data BETWEEN v_ini AND v_fim
        AND EXTRACT(ISODOW FROM d.data) = 6
        AND (d.entrada IS NOT NULL OR COALESCE((EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0)
      ORDER BY d.data DESC
      LIMIT 1;

      v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
      v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
      v_eq_auto := (v_eq_total > 0);
      IF NOT v_eq_auto THEN
        v_eq_data := NULL;
      END IF;
    END IF;
  END IF;

  FOR r IN
    SELECT d.data, d.status, d.tipo_dia, d.observacao, d.horas_trabalhadas,
           d.horas_extras, d.horas_faltantes, d.colaborador_id, d.entrada, d.saida
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND d.data BETWEEN v_ini AND v_fim
    ORDER BY d.data
  LOOP
    v_protegido := (
      r.status = 'justificado'
      OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado')
      OR COALESCE(r.observacao, '') ILIKE '%atestado%'
      OR EXISTS (
        SELECT 1 FROM public.atestados a
        WHERE a.tenant_id = p_tenant_id
          AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
          AND COALESCE(a.unidade_afastamento, 'dias') = 'dias'
          AND a.data_inicio_afastamento IS NOT NULL
          AND a.data_inicio_afastamento <= r.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data
      )
      -- Atestado em horas em dia SEM nenhuma marcação: o dia inteiro está
      -- amparado pelo documento; não há batida para medir ausência residual,
      -- portanto não gera débito.
      OR (
        r.entrada IS NULL AND r.saida IS NULL
        AND COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0) = 0
        AND EXISTS (
          SELECT 1 FROM public.atestados a
          WHERE a.tenant_id = p_tenant_id
            AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
            AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
            AND a.data_inicio_afastamento IS NOT NULL
            AND a.data_inicio_afastamento <= r.data
            AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data
        )
      )
    );

    IF v_protegido THEN
      IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
        v_eq_teve_linha := true;
      END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      jornada_min := 0; saldo_min := 0; protegido := true;
      equalizacao := false; excedente_retido_min := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
      v_eq_teve_linha := true;
      v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_diff := v_trab - COALESCE(v_eq_total, 0);
      excedente_retido_min := 0;
      IF v_diff > 120 AND NOT v_eq_liberado THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
      IF abs(v_diff) <= 10 THEN v_diff := 0; END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := v_trab;
      jornada_min := COALESCE(v_eq_total, 0);
      saldo_min := v_diff;
      protegido := false;
      equalizacao := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT j.jornada_min, j.tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) j;

    IF v_jornada IS NULL OR v_jornada = 0 THEN
      IF EXTRACT(DOW FROM r.data)::int IN (0, 6) THEN
        v_esperado := 0;
      ELSE
        v_esperado := COALESCE(v_fb_jornada, 0);
      END IF;
    ELSE
      v_esperado := v_jornada;
    END IF;
    v_tol := CASE WHEN COALESCE(v_tol, 0) <> 0 THEN v_tol ELSE COALESCE(v_fb_tol, 0) END;

    SELECT COALESCE(SUM(COALESCE(a.horas_afastamento, 0) * 60 + COALESCE(a.minutos_afastamento, 0)), 0)
      INTO v_atest_min
    FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id
      AND regexp_replace(a.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
      AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
      AND a.data_inicio_afastamento IS NOT NULL
      AND a.data_inicio_afastamento <= r.data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data;

    v_jornada_efetiva := GREATEST(0, v_esperado - COALESCE(v_atest_min, 0));

    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 10;
    BEGIN
      SELECT e.entrada, e.saida, COALESCE(e.intervalo_min, 0), COALESCE(e.tolerancia_batida_min, 10)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) e;
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
    v_usou_batida := false;
    v_diff := 0;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
       AND v_jornada_efetiva > 0 THEN

      v_ent_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.entrada)/60)::int - (EXTRACT(EPOCH FROM v_ent_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_ent_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.entrada)/60)::int
      END;

      v_sai_cons := CASE
        WHEN abs((EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM v_sai_esc)/60)::int) <= COALESCE(v_tol_bat, 10)
          THEN (EXTRACT(EPOCH FROM v_sai_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM r.saida)/60)::int
      END;

      v_trab_marc := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_janela := (EXTRACT(EPOCH FROM r.saida)/60)::int - (EXTRACT(EPOCH FROM r.entrada)/60)::int;
      IF v_janela < 0 THEN
        v_janela := v_janela + 1440;
      END IF;
      v_interv_real := GREATEST(0, v_janela - v_trab_marc);

      v_janela_cons := v_sai_cons - v_ent_cons;
      IF v_janela_cons < 0 THEN
        v_janela_cons := v_janela_cons + 1440;
      END IF;

      IF v_interv_real > 0 THEN
        v_desc_interv := 0;
      ELSE
        v_int_ini := NULL; v_int_fim := NULL;
        IF v_sai_cons >= v_ent_cons THEN
          BEGIN
            SELECT w.inicio, w.fim INTO v_int_ini, v_int_fim
            FROM public.ponto_intervalo_janela_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) w;
          EXCEPTION WHEN OTHERS THEN
            v_int_ini := NULL; v_int_fim := NULL;
          END;
        END IF;

        IF v_int_ini IS NOT NULL AND v_int_fim IS NOT NULL THEN
          v_desc_interv := GREATEST(0,
            LEAST(v_sai_cons, (EXTRACT(EPOCH FROM v_int_fim)/60)::int)
            - GREATEST(v_ent_cons, (EXTRACT(EPOCH FROM v_int_ini)/60)::int)
          );
        ELSE
          v_desc_interv := LEAST(COALESCE(v_interv, 0), GREATEST(0, v_janela - v_jornada_efetiva));
        END IF;
      END IF;

      v_trab_ajust := GREATEST(0, v_janela_cons - v_interv_real - v_desc_interv);
      v_diff := GREATEST(0, v_janela - v_interv_real - v_desc_interv) - v_jornada_efetiva;
      v_trab := GREATEST(0, v_janela - v_interv_real - v_desc_interv);
      v_usou_batida := true;
    END IF;

    IF NOT v_usou_batida THEN
      v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras)/60)::int, 0);
      v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes)/60)::int, 0);

      IF v_extras > 0 OR v_faltantes > 0 THEN
        v_diff := v_extras - v_faltantes;
      ELSIF v_jornada_efetiva = 0 THEN
        v_diff := GREATEST(0, v_trab);
      ELSIF r.status = 'falta' THEN
        v_diff := -v_jornada_efetiva;
      ELSE
        v_diff := v_trab - v_jornada_efetiva;
        IF abs(v_diff) <= COALESCE(v_tol, 0) THEN
          v_diff := 0;
        END IF;
      END IF;
    END IF;

    IF abs(v_diff) <= 10 THEN
      v_diff := 0;
    END IF;

    excedente_retido_min := 0;
    IF v_jornada_efetiva > 0 AND v_diff > 120 THEN
      SELECT EXISTS (
        SELECT 1 FROM public.ponto_excedente_decisao x
        WHERE x.tenant_id = p_tenant_id
          AND regexp_replace(x.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
          AND x.dia = r.data
          AND x.decisao = 'liberado'
      ) INTO v_exc_decidido;

      IF NOT COALESCE(v_exc_decidido, false) THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
    END IF;

    dia := r.data;
    entrada := r.entrada;
    saida := r.saida;
    trabalhado_min := v_trab;
    jornada_min := v_jornada_efetiva;
    saldo_min := v_diff;
    protegido := false;
    equalizacao := false;
    RETURN NEXT;
  END LOOP;

  IF v_eq_data IS NOT NULL AND NOT v_eq_teve_linha AND v_eq_data < CURRENT_DATE THEN
    dia := v_eq_data; entrada := NULL; saida := NULL;
    trabalhado_min := 0;
    jornada_min := COALESCE(v_eq_total, 0);
    saldo_min := -COALESCE(v_eq_total, 0);
    protegido := false; equalizacao := true; excedente_retido_min := 0;
    IF saldo_min <> 0 THEN RETURN NEXT; END IF;
  END IF;

  IF v_eq_data IS NULL AND v_fim < CURRENT_DATE AND v_fb_escala_id IS NOT NULL
     AND v_qtd_sab = 0 THEN
    v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
    v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
    IF v_eq_total > 0 THEN
      dia := v_ult_sab; entrada := NULL; saida := NULL;
      trabalhado_min := 0;
      jornada_min := v_eq_total;
      saldo_min := -v_eq_total;
      protegido := false; equalizacao := true; excedente_retido_min := 0;
      RETURN NEXT;
    END IF;
  END IF;
END;
$function$;