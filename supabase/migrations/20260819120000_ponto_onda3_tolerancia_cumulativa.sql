-- ============================================================================
-- ONDA 3 (parte 1) — Tolerância cumulativa dos dois tetos legais
-- PONTO-041 / PONTO-042 / (mantém PONTO-353, PONTO-040)
--
-- CLT art. 58, §1º + TST Súmula 366: as variações de registro não descontam
-- nem viram extra até 5 minutos POR MARCAÇÃO, observado o teto de 10 minutos
-- DIÁRIOS. Ultrapassado qualquer um dos tetos, computa-se a TOTALIDADE do
-- tempo que excede a jornada — não apenas o que passou da tolerância.
--
-- O QUE MUDA no corpo de apuração (ponto_saldo_dias_competencia_bruto):
--   (a) o encaixe de batida na escala passa a usar o padrão de 5 min por
--       marcação (era 10 — o dobro do limite legal);
--   (b) o piso final de tolerância deixa de ser um "abs(saldo) <= 10" cego:
--       o ATRASO/ANTECIPAÇÃO (déficit) é absorvido só até o teto POR MARCAÇÃO
--       (5), enquanto a SOBRA no dia continua com o teto DIÁRIO (10). Assim um
--       déficit de 6 min numa marcação passa a ser computado por inteiro
--       (Súmula 366), e a fronteira do teto diário na sobra (10→0, 11→11)
--       segue idêntica.
--
-- Estruturas novas: nenhuma. Só o corpo da função. O wrapper de "um dia por
-- data" (ponto_saldo_dias_competencia) não muda.
--
-- ATENÇÃO PRODUÇÃO: este corpo, em produção, foi remendado à mão no passado
-- (ver 20260805120000_um_dia_por_data_na_apuracao.sql, comentário). Por isso o
-- SCRIPT DE ENTREGA (docs/script_ponto_onda3_tolerancia.sql) NÃO cola este
-- corpo cego: ele aplica as duas trocas cirúrgicas sobre o corpo que estiver
-- vivo em produção. Esta migration vale para o ambiente de teste, cujo corpo
-- é exatamente o do repositório.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia_bruto(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text)
 RETURNS TABLE(dia date, entrada time without time zone, saida time without time zone, trabalhado_min integer, jornada_min integer, saldo_min integer, protegido boolean, equalizacao boolean, excedente_retido_min integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
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
  v_vinc_ini date;
  v_vinc_fim date;
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
  v_prot_credito boolean;
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
  v_ja_emitiu date[] := ARRAY[]::date[];
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
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf OR a.colaborador_id::text = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  SELECT MIN(a.data_inicio),
         CASE WHEN bool_or(a.data_fim IS NULL) THEN NULL ELSE MAX(a.data_fim) END
    INTO v_vinc_ini, v_vinc_fim
  FROM public.ponto_escala_atribuicoes a
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf,''), '[^0-9]', '', 'g') = v_cpf OR a.colaborador_id::text = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true;

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
      AND (d.entrada IS NOT NULL OR COALESCE(floor(EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0);

    IF v_qtd_sab >= 1 THEN
      SELECT d.data INTO v_eq_data
      FROM public.ponto_diario d
      WHERE d.tenant_id = p_tenant_id
        AND regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
        AND d.data BETWEEN v_ini AND v_fim
        AND EXTRACT(ISODOW FROM d.data) = 6
        AND (d.entrada IS NOT NULL OR COALESCE(floor(EXTRACT(EPOCH FROM d.horas_trabalhadas)/60)::int,0) > 0)
      ORDER BY d.data DESC
      LIMIT 1;

      BEGIN
        v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
      EXCEPTION WHEN OTHERS THEN
        v_eq_m := NULL;
      END;
      v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
      v_eq_auto := (v_eq_total > 0);
      IF NOT v_eq_auto THEN
        v_eq_data := NULL;
      END IF;
    END IF;
  END IF;

  IF v_eq_data IS NULL AND v_fim < CURRENT_DATE AND v_fb_escala_id IS NOT NULL
     AND v_qtd_sab = 0 THEN
    BEGIN
      v_eq_m := public.ponto_equalizacao_competencia(p_tenant_id, v_fb_escala_id, p_competencia);
    EXCEPTION WHEN OTHERS THEN
      v_eq_m := NULL;
    END;
    v_eq_total := COALESCE((v_eq_m->>'total_equalizacao_min')::int, 0);
    IF v_eq_total > 0 THEN
      v_eq_data := v_ult_sab;
    END IF;
  END IF;

  FOR r IN
    SELECT g.d::date AS data,
           d.status, d.tipo_dia, d.observacao,
           COALESCE(d.horas_trabalhadas, INTERVAL '0') AS horas_trabalhadas,
           d.horas_extras, d.horas_faltantes,
           COALESCE(d.colaborador_id::text, v_colaborador_id) AS colaborador_id,
           d.entrada, d.saida
    FROM generate_series(v_ini, v_fim, INTERVAL '1 day') g(d)
    LEFT JOIN LATERAL (
      SELECT p.*
      FROM public.ponto_diario p
      WHERE p.tenant_id = p_tenant_id
        AND regexp_replace(p.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
        AND p.data = g.d::date
      ORDER BY COALESCE(floor(EXTRACT(EPOCH FROM p.horas_trabalhadas)/60)::int, 0) DESC,
               p.updated_at DESC NULLS LAST
      LIMIT 1
    ) d ON true
    WHERE d.data IS NOT NULL
       OR (
         v_vinc_ini IS NOT NULL
         AND g.d::date >= v_vinc_ini
         AND (v_vinc_fim IS NULL OR g.d::date <= v_vinc_fim)
         AND g.d::date <= CURRENT_DATE
       )
    ORDER BY 1
  LOOP
    IF r.data = ANY (v_ja_emitiu) THEN
      CONTINUE;
    END IF;
    v_ja_emitiu := v_ja_emitiu || r.data;

    IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
      v_eq_teve_linha := true;
    END IF;

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
      OR (
        r.entrada IS NULL AND r.saida IS NULL
        AND COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0) = 0
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

    v_prot_credito := v_protegido
      AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
      AND COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0) > 0;

    -- Sabado de equalizacao SEMPRE prevalece (mesmo em dias marcados como
    -- justificado / "compensacao de horas"), desde que haja tempo trabalhado.
    IF v_eq_data IS NOT NULL AND r.data = v_eq_data
       AND (NOT v_protegido OR COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0) > 0) THEN
      v_eq_teve_linha := true;
      v_trab := COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_diff := v_trab - COALESCE(v_eq_total, 0);
      excedente_retido_min := 0;
      IF v_diff > 120 AND NOT v_eq_liberado THEN
        excedente_retido_min := v_diff - 120;
        v_diff := 120;
      END IF;
      IF abs(v_diff) <= 10 THEN v_diff := 0; END IF;
      IF v_protegido AND v_diff < 0 THEN v_diff := 0; END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := v_trab;
      jornada_min := COALESCE(v_eq_total, 0);
      saldo_min := v_diff;
      protegido := COALESCE(v_protegido, false);
      equalizacao := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_protegido AND NOT v_prot_credito THEN
      IF v_eq_data IS NOT NULL AND r.data = v_eq_data THEN
        v_eq_teve_linha := true;
      END IF;
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      jornada_min := 0; saldo_min := 0; protegido := true;
      equalizacao := false; excedente_retido_min := 0;
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
    IF v_eq_data IS NOT NULL
       AND EXTRACT(ISODOW FROM r.data) = 6
       AND r.data <> v_eq_data THEN
      v_esperado := 0;
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

    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 5;
    BEGIN
      SELECT e.entrada, e.saida, COALESCE(e.intervalo_min, 0), COALESCE(e.tolerancia_batida_min, 5)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, v_cpf, r.colaborador_id::text, r.data) e;
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

    v_trab := COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
    v_usou_batida := false;
    v_diff := 0;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
       AND v_jornada_efetiva > 0 THEN

      v_ent_cons := CASE
        WHEN abs(floor(EXTRACT(EPOCH FROM r.entrada)/60)::int - floor(EXTRACT(EPOCH FROM v_ent_esc)/60)::int) <= COALESCE(v_tol_bat, 5)
          THEN floor(EXTRACT(EPOCH FROM v_ent_esc)/60)::int
        ELSE floor(EXTRACT(EPOCH FROM r.entrada)/60)::int
      END;

      v_sai_cons := CASE
        WHEN abs(floor(EXTRACT(EPOCH FROM r.saida)/60)::int - floor(EXTRACT(EPOCH FROM v_sai_esc)/60)::int) <= COALESCE(v_tol_bat, 5)
          THEN floor(EXTRACT(EPOCH FROM v_sai_esc)/60)::int
        ELSE floor(EXTRACT(EPOCH FROM r.saida)/60)::int
      END;

      v_trab_marc := COALESCE(floor(EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      v_janela := floor(EXTRACT(EPOCH FROM (r.saida - r.entrada))/60)::int;
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
            LEAST(v_sai_cons, floor(EXTRACT(EPOCH FROM v_int_fim)/60)::int)
            - GREATEST(v_ent_cons, floor(EXTRACT(EPOCH FROM v_int_ini)/60)::int)
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
      v_extras    := COALESCE(floor(EXTRACT(EPOCH FROM r.horas_extras)/60)::int, 0);
      v_faltantes := COALESCE(floor(EXTRACT(EPOCH FROM r.horas_faltantes)/60)::int, 0);

      IF v_extras > 0 OR v_faltantes > 0 THEN
        v_diff := v_extras - v_faltantes;
      ELSIF v_jornada_efetiva = 0 THEN
        v_diff := GREATEST(0, v_trab);
      ELSIF r.status = 'falta' THEN
        v_diff := -v_jornada_efetiva;
      ELSE
        v_diff := v_trab - v_jornada_efetiva;
        -- Déficit absorvido só até o teto POR MARCAÇÃO (art. 58 §1º / Súmula
        -- 366); sobra no dia mantém o teto DIÁRIO configurado.
        IF v_diff < 0 THEN
          IF abs(v_diff) <= COALESCE(v_tol_bat, 5) THEN
            v_diff := 0;
          END IF;
        ELSIF abs(v_diff) <= COALESCE(v_tol, 0) THEN
          v_diff := 0;
        END IF;
      END IF;
    END IF;

    -- Tolerância do art. 58, §1º + Súmula 366, com os dois tetos cumulativos:
    --   · déficit (atraso/antecipação): absorvido só até o teto POR MARCAÇÃO;
    --   · sobra no dia: absorvida até o teto DIÁRIO (10).
    -- Estourou o teto aplicável, computa-se a TOTALIDADE (não só o excedente).
    IF v_diff < 0 THEN
      IF abs(v_diff) <= COALESCE(v_tol_bat, 5) THEN
        v_diff := 0;
      END IF;
    ELSIF v_diff <= 10 THEN
      v_diff := 0;
    END IF;

    IF v_prot_credito AND v_diff < 0 THEN
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
    protegido := COALESCE(v_prot_credito, false);
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
END;
$function$


