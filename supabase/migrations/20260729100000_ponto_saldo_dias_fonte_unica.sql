-- =========================================================
-- BANCO DE HORAS: uma única implementação da regra de saldo
--
-- POR QUE ESTA MIGRATION EXISTE
-- A regra de crédito/débito por dia estava escrita DUAS vezes:
--   1) em TypeScript, no navegador (dialog "Editar Banco");
--   2) em SQL, na apuração (apurar_banco_horas_colaborador).
-- Toda vez que uma era ajustada, sobrava uma diferença na outra — e as duas
-- telas voltavam a divergir. Não é problema de fórmula, é de duplicação.
--
-- Agora existe UMA implementação: ponto_saldo_dias_competencia. A apuração
-- soma a partir dela, e a tela lê dela. Não há mais como divergirem.
--
-- A REGRA (a mesma que já era usada no dialog):
--   * dia protegido (justificado, férias, atestado de dias, afastamento,
--     feriado) -> saldo 0;
--   * jornada esperada vem de ponto_jornada_do_dia, com fallback pela
--     atribuição de escala mais antiga em dia útil;
--   * atestado de HORAS desconta da jornada esperada;
--   * havendo escala com horários e as duas batidas, aplica TOLERÂNCIA
--     SIMÉTRICA na batida (10 min): dentro da janela vale o horário oficial;
--     a partir de 11 min vale o horário real e o tempo conta CHEIO — tanto
--     para crédito quanto para débito, na entrada e na saída;
--   * status 'falta' -> débito da jornada efetiva;
--   * sem escala com horários -> extras/faltantes consolidados, ou
--     trabalhado bruto menos jornada.
-- =========================================================

CREATE OR REPLACE FUNCTION public.ponto_saldo_dias_competencia(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_competencia text
)
RETURNS TABLE (
  dia            date,
  entrada        time,
  saida          time,
  trabalhado_min int,
  jornada_min    int,
  saldo_min      int,
  protegido      boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_colaborador_id text;
  v_fb_jornada int;
  v_fb_tol int := 0;
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
  r RECORD;
BEGIN
  SELECT colaborador_id INTO v_colaborador_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  -- Fallback de jornada: atribuição ativa mais antiga do colaborador.
  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0)
    INTO v_fb_jornada, v_fb_tol
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_colaborador_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  FOR r IN
    SELECT d.data, d.status, d.tipo_dia, d.observacao, d.horas_trabalhadas,
           d.horas_extras, d.horas_faltantes, d.colaborador_id, d.entrada, d.saida
    FROM public.ponto_diario d
    WHERE d.tenant_id = p_tenant_id
      AND d.colaborador_cpf = p_colaborador_cpf
      AND d.data BETWEEN v_ini AND v_fim
    ORDER BY d.data
  LOOP
    -- ── Dia protegido: não gera crédito nem débito ──────────────────────
    v_protegido := (
      r.status = 'justificado'
      OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado')
      OR COALESCE(r.observacao, '') ILIKE '%atestado%'
      OR EXISTS (
        SELECT 1 FROM public.atestados a
        WHERE a.tenant_id = p_tenant_id
          AND a.colaborador_cpf = p_colaborador_cpf
          AND COALESCE(a.unidade_afastamento, 'dias') = 'dias'
          AND a.data_inicio_afastamento IS NOT NULL
          AND a.data_inicio_afastamento <= r.data
          AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data
      )
    );

    IF v_protegido THEN
      dia := r.data; entrada := r.entrada; saida := r.saida;
      trabalhado_min := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
      jornada_min := 0; saldo_min := 0; protegido := true;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- ── Jornada esperada ────────────────────────────────────────────────
    SELECT j.jornada_min, j.tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id::text, r.data) j;

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

    -- Atestado de HORAS desconta da jornada esperada
    SELECT COALESCE(SUM(COALESCE(a.horas_afastamento, 0) * 60 + COALESCE(a.minutos_afastamento, 0)), 0)
      INTO v_atest_min
    FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id
      AND a.colaborador_cpf = p_colaborador_cpf
      AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
      AND a.data_inicio_afastamento IS NOT NULL
      AND a.data_inicio_afastamento <= r.data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data;

    v_jornada_efetiva := GREATEST(0, v_esperado - COALESCE(v_atest_min, 0));

    -- ── Batidas previstas da escala do dia ──────────────────────────────
    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 10;
    BEGIN
      SELECT e.entrada, e.saida, COALESCE(e.intervalo_min, 0), COALESCE(e.tolerancia_batida_min, 10)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id::text, r.data) e;
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas)/60)::int, 0);
    v_usou_batida := false;
    v_diff := 0;

    -- ── Tolerância SIMÉTRICA na batida ──────────────────────────────────
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

      v_trab_ajust := GREATEST(0, v_sai_cons - v_ent_cons - COALESCE(v_interv, 0));
      v_diff := v_trab_ajust - v_jornada_efetiva;
      v_trab := v_trab_ajust;
      v_usou_batida := true;
    END IF;

    IF NOT v_usou_batida THEN
      v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras)/60)::int, 0);
      v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes)/60)::int, 0);

      IF v_extras > 0 OR v_faltantes > 0 THEN
        v_diff := v_extras - v_faltantes;
      ELSIF v_jornada_efetiva = 0 THEN
        v_diff := 0;
      ELSIF r.status = 'falta' THEN
        v_diff := -v_jornada_efetiva;
      ELSE
        v_diff := v_trab - v_jornada_efetiva;
        -- Sem escala com horários, a tolerância DIÁRIA ainda vale.
        IF abs(v_diff) <= COALESCE(v_tol, 0) THEN
          v_diff := 0;
        END IF;
      END IF;
    END IF;

    dia := r.data;
    entrada := r.entrada;
    saida := r.saida;
    trabalhado_min := v_trab;
    jornada_min := v_jornada_efetiva;
    saldo_min := v_diff;
    protegido := false;
    RETURN NEXT;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ponto_saldo_dias_competencia(uuid, text, text) TO authenticated;


-- =========================================================
-- A apuração passa a SOMAR desta função (não recalcula nada por conta)
-- =========================================================
CREATE OR REPLACE FUNCTION public.apurar_banco_horas_colaborador(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_competencia text,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_colaborador_id text;
  v_colaborador_nome text;
  v_empresa_id uuid := p_empresa_id;
  v_banco_id uuid;
  v_creditos int := 0;
  v_debitos int := 0;
  v_saldo_anterior int := 0;
  v_tem_anterior boolean := false;
  v_comp_anterior text;
  v_tot_cred int := 0;
  v_tot_deb int := 0;
  v_tot_comp int := 0;
BEGIN
  SELECT colaborador_id, colaborador_nome, empresa_id
    INTO v_colaborador_id, v_colaborador_nome, v_empresa_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  IF v_colaborador_id IS NULL THEN
    RETURN;
  END IF;
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_id := p_empresa_id;
  END IF;

  -- FONTE ÚNICA: soma os saldos diários calculados pela função acima.
  SELECT
    COALESCE(SUM(CASE WHEN s.saldo_min > 0 THEN s.saldo_min ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.saldo_min < 0 THEN -s.saldo_min ELSE 0 END), 0)
  INTO v_creditos, v_debitos
  FROM public.ponto_saldo_dias_competencia(p_tenant_id, p_colaborador_cpf, p_competencia) s;

  -- Saldo anterior = saldo atual da competência anterior; se não houver,
  -- preserva o saldo anterior lançado manualmente nesta competência.
  v_comp_anterior := to_char(v_ini - INTERVAL '1 month', 'YYYY-MM');
  SELECT saldo_atual_minutos INTO v_saldo_anterior
  FROM public.ponto_banco_horas
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND competencia = v_comp_anterior;
  v_tem_anterior := FOUND;
  IF NOT v_tem_anterior THEN
    SELECT saldo_anterior_minutos INTO v_saldo_anterior
    FROM public.ponto_banco_horas
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND competencia = p_competencia;
  END IF;
  v_saldo_anterior := COALESCE(v_saldo_anterior, 0);

  INSERT INTO public.ponto_banco_horas (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
    tipo, competencia, saldo_anterior_minutos
  ) VALUES (
    p_tenant_id, v_empresa_id, v_colaborador_id, v_colaborador_nome, p_colaborador_cpf,
    'mensal', p_competencia, v_saldo_anterior
  )
  ON CONFLICT (tenant_id, colaborador_cpf, competencia)
  DO UPDATE SET
    saldo_anterior_minutos = EXCLUDED.saldo_anterior_minutos,
    empresa_id = COALESCE(public.ponto_banco_horas.empresa_id, EXCLUDED.empresa_id),
    colaborador_nome = EXCLUDED.colaborador_nome,
    colaborador_id = EXCLUDED.colaborador_id,
    updated_at = now()
  RETURNING id INTO v_banco_id;

  IF v_banco_id IS NULL THEN
    SELECT id INTO v_banco_id
    FROM public.ponto_banco_horas
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND competencia = p_competencia;
  END IF;

  -- Remove as movimentações automáticas anteriores (as duas origens
  -- históricas). Lançamentos manuais são preservados.
  DELETE FROM public.ponto_banco_horas_movimentacoes
  WHERE banco_horas_id = v_banco_id
    AND origem IN ('apuracao', 'apuracao_auto');

  IF v_creditos > 0 THEN
    INSERT INTO public.ponto_banco_horas_movimentacoes (
      tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem
    ) VALUES (
      p_tenant_id, v_banco_id, p_colaborador_cpf, v_fim, 'credito', v_creditos,
      'Apuração automática — horas trabalhadas além da jornada', 'apuracao'
    );
  END IF;

  IF v_debitos > 0 THEN
    INSERT INTO public.ponto_banco_horas_movimentacoes (
      tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem
    ) VALUES (
      p_tenant_id, v_banco_id, p_colaborador_cpf, v_fim, 'debito', v_debitos,
      'Apuração automática — atrasos, faltas e saídas antecipadas', 'apuracao'
    );
  END IF;

  SELECT
    COALESCE(SUM(minutos) FILTER (WHERE tipo = 'credito'), 0),
    COALESCE(SUM(minutos) FILTER (WHERE tipo = 'debito'), 0),
    COALESCE(SUM(minutos) FILTER (WHERE tipo = 'compensacao'), 0)
  INTO v_tot_cred, v_tot_deb, v_tot_comp
  FROM public.ponto_banco_horas_movimentacoes
  WHERE banco_horas_id = v_banco_id;

  UPDATE public.ponto_banco_horas
  SET creditos_minutos = v_tot_cred,
      debitos_minutos = v_tot_deb,
      compensados_minutos = v_tot_comp,
      saldo_atual_minutos = saldo_anterior_minutos + v_tot_cred - v_tot_deb - v_tot_comp,
      updated_at = now()
  WHERE id = v_banco_id;
END;
$$;


-- Limpeza retroativa das movimentações órfãs da apuração antiga.
DELETE FROM public.ponto_banco_horas_movimentacoes
WHERE origem = 'apuracao_auto';

UPDATE public.ponto_banco_horas b
SET creditos_minutos = t.cred,
    debitos_minutos = t.deb,
    compensados_minutos = t.comp,
    saldo_atual_minutos = b.saldo_anterior_minutos + t.cred - t.deb - t.comp,
    updated_at = now()
FROM (
  SELECT banco_horas_id,
         COALESCE(SUM(minutos) FILTER (WHERE tipo = 'credito'), 0)     AS cred,
         COALESCE(SUM(minutos) FILTER (WHERE tipo = 'debito'), 0)      AS deb,
         COALESCE(SUM(minutos) FILTER (WHERE tipo = 'compensacao'), 0) AS comp
  FROM public.ponto_banco_horas_movimentacoes
  GROUP BY banco_horas_id
) t
WHERE b.id = t.banco_horas_id;


DO $verifica$
DECLARE v_orfas int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ponto_saldo_dias_competencia') THEN
    RAISE EXCEPTION 'FALHOU: função de saldo diário não foi criada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'apurar_banco_horas_colaborador'
      AND prosrc LIKE '%ponto_saldo_dias_competencia%'
  ) THEN
    RAISE EXCEPTION 'FALHOU: apuração não está somando da função única.';
  END IF;

  SELECT count(*) INTO v_orfas
  FROM public.ponto_banco_horas_movimentacoes
  WHERE origem = 'apuracao_auto';
  IF v_orfas > 0 THEN
    RAISE EXCEPTION 'FALHOU: restam % movimentações apuracao_auto.', v_orfas;
  END IF;

  RAISE NOTICE 'OK: fonte única criada, apuração soma dela, órfãs removidas.';
END $verifica$;
