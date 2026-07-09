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
  v_tem_anterior boolean := false;
  v_comp_anterior text;
  v_tot_cred int := 0;
  v_tot_deb int := 0;
  v_tot_comp int := 0;
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
    SELECT data, status, tipo_dia, observacao, horas_trabalhadas, colaborador_id
    FROM public.ponto_diario
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data BETWEEN v_ini AND v_fim
  LOOP
    IF r.status = 'justificado'
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
       ) THEN
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
  v_tem_anterior := FOUND;
  IF NOT v_tem_anterior THEN
    SELECT saldo_anterior_minutos INTO v_saldo_anterior
    FROM public.ponto_banco_horas
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND competencia = p_competencia;
    IF NOT FOUND THEN v_saldo_anterior := 0; END IF;
  END IF;

  SELECT id, creditos_minutos, debitos_minutos, compensados_minutos
    INTO v_banco_id, v_tot_cred, v_tot_deb, v_tot_comp
  FROM public.ponto_banco_horas
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND competencia = p_competencia;

  IF v_banco_id IS NULL THEN
    INSERT INTO public.ponto_banco_horas (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      tipo, competencia, saldo_anterior_minutos,
      creditos_minutos, debitos_minutos, compensados_minutos, saldo_atual_minutos
    ) VALUES (
      p_tenant_id, v_empresa_id, v_colaborador_id::text, v_colaborador_nome, p_colaborador_cpf,
      'mensal', p_competencia, v_saldo_anterior,
      v_creditos, v_debitos, 0, v_saldo_anterior + v_creditos - v_debitos
    ) RETURNING id INTO v_banco_id;
  ELSE
    UPDATE public.ponto_banco_horas
       SET creditos_minutos = v_creditos,
           debitos_minutos = v_debitos,
           saldo_anterior_minutos = v_saldo_anterior,
           saldo_atual_minutos = v_saldo_anterior + v_creditos - v_debitos - COALESCE(v_tot_comp,0)
     WHERE id = v_banco_id;
  END IF;
END;
$function$;