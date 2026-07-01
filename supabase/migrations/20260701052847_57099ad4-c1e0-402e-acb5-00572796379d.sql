CREATE OR REPLACE FUNCTION public.apurar_banco_horas_colaborador(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text, p_empresa_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ini date := to_date(p_competencia || '-01', 'YYYY-MM-DD');
  v_fim date := (to_date(p_competencia || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date;
  v_colaborador_id uuid;
  v_colaborador_nome text;
  v_empresa_id uuid := p_empresa_id;
  v_banco_id uuid;
  v_creditos int := 0;
  v_debitos int := 0;
  v_saldo_anterior int := 0;
  v_comp_anterior text;
  v_jornada int;
  v_tol int;
  v_trab int;
  v_diff int;
  v_atest_min int;
  v_jornada_efetiva int;
  r RECORD;
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

  FOR r IN
    SELECT data, status, tipo_dia, horas_trabalhadas, colaborador_id
    FROM public.ponto_diario
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data BETWEEN v_ini AND v_fim
  LOOP
    IF r.status NOT IN ('regular', 'atraso', 'falta')
       OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado') THEN
      CONTINUE;
    END IF;

    SELECT jornada_min, tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id::text, r.data);

    IF v_jornada IS NULL OR v_jornada = 0 THEN
      CONTINUE;
    END IF;
    v_tol := COALESCE(v_tol, 0);

    SELECT COALESCE(SUM(COALESCE(a.horas_afastamento, 0) * 60 + COALESCE(a.minutos_afastamento, 0)), 0)
      INTO v_atest_min
    FROM public.atestados a
    WHERE a.tenant_id = p_tenant_id
      AND a.colaborador_cpf = p_colaborador_cpf
      AND COALESCE(a.unidade_afastamento, 'dias') = 'horas'
      AND a.data_inicio_afastamento IS NOT NULL
      AND a.data_inicio_afastamento <= r.data
      AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= r.data;

    v_jornada_efetiva := GREATEST(0, v_jornada - COALESCE(v_atest_min, 0));

    IF v_jornada_efetiva = 0 THEN
      CONTINUE;
    END IF;

    IF r.status = 'falta' THEN
      v_debitos := v_debitos + v_jornada_efetiva;
      CONTINUE;
    END IF;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas) / 60)::int, 0);
    v_diff := v_trab - v_jornada_efetiva;
    IF v_diff > v_tol THEN
      v_creditos := v_creditos + v_diff;
    ELSIF v_diff < -v_tol THEN
      v_debitos := v_debitos + (-v_diff);
    END IF;
  END LOOP;

  v_comp_anterior := to_char(v_ini - INTERVAL '1 month', 'YYYY-MM');
  SELECT saldo_atual_minutos INTO v_saldo_anterior
  FROM public.ponto_banco_horas
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND competencia = v_comp_anterior;
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

  DELETE FROM public.ponto_banco_horas_movimentacoes
  WHERE banco_horas_id = v_banco_id
    AND COALESCE(origem, '') = 'apuracao_auto';

  IF v_creditos > 0 THEN
    INSERT INTO public.ponto_banco_horas_movimentacoes (
      tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem
    ) VALUES (
      p_tenant_id, v_banco_id, p_colaborador_cpf, v_fim, 'credito', v_creditos,
      'Apuração automática da competência ' || p_competencia, 'apuracao_auto'
    );
  END IF;

  IF v_debitos > 0 THEN
    INSERT INTO public.ponto_banco_horas_movimentacoes (
      tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem
    ) VALUES (
      p_tenant_id, v_banco_id, p_colaborador_cpf, v_fim, 'debito', v_debitos,
      'Apuração automática da competência ' || p_competencia, 'apuracao_auto'
    );
  END IF;

  UPDATE public.ponto_banco_horas
  SET creditos_minutos = COALESCE((
        SELECT SUM(minutos) FROM public.ponto_banco_horas_movimentacoes
        WHERE banco_horas_id = v_banco_id AND tipo = 'credito'), 0),
      debitos_minutos = COALESCE((
        SELECT SUM(minutos) FROM public.ponto_banco_horas_movimentacoes
        WHERE banco_horas_id = v_banco_id AND tipo = 'debito'), 0),
      compensados_minutos = COALESCE((
        SELECT SUM(minutos) FROM public.ponto_banco_horas_movimentacoes
        WHERE banco_horas_id = v_banco_id AND tipo = 'compensacao'), 0),
      saldo_atual_minutos = saldo_anterior_minutos
        + COALESCE((SELECT SUM(minutos) FROM public.ponto_banco_horas_movimentacoes WHERE banco_horas_id = v_banco_id AND tipo = 'credito'), 0)
        - COALESCE((SELECT SUM(minutos) FROM public.ponto_banco_horas_movimentacoes WHERE banco_horas_id = v_banco_id AND tipo = 'debito'), 0)
        - COALESCE((SELECT SUM(minutos) FROM public.ponto_banco_horas_movimentacoes WHERE banco_horas_id = v_banco_id AND tipo = 'compensacao'), 0),
      updated_at = now()
  WHERE id = v_banco_id;
END;
$function$;