-- Ajuste do modelo de débito do banco de horas: DÉFICIT DO TOTAL DO DIA com
-- TOLERÂNCIA POR BATIDA da escala (tolerancia_minutos), não a tolerância diária.
--
-- Motivação: um atraso de entrada pode ser COMPENSADO por saída mais tarde.
-- O que importa é o saldo do dia: trabalhado − jornada esperada. Se o déficit
-- for menor ou igual à tolerância (5min na escala padrão) → dia regular.
--   Ex.: entrou 07:58 e saiu 18:02 (8h34 de 8h38) → déficit 4min ≤ 5 → regular.
--        entrou 07:58 e saiu 18:00 (8h32 de 8h38) → déficit 6min > 5 → débito 6.
--
-- A função auxiliar ponto_debito_batida_do_dia deixa de ser usada pela apuração
-- (o cálculo volta a ser por total do dia). Mantida no banco por compatibilidade.

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
  v_jornada int;
  v_tol int;
  v_trab int;
  v_diff int;
  v_atest_min int;
  v_jornada_efetiva int;
  v_esperado int;
  v_extras int;
  v_faltantes int;
  v_fb_jornada int;
  v_fb_tol int := 0;      -- tolerancia_minutos (por batida) da escala
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

  -- Fallback de jornada e tolerância POR BATIDA (tolerancia_minutos) da escala
  -- ativa mais antiga do colaborador.
  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_minutos, 5)
    INTO v_fb_jornada, v_fb_tol
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_colaborador_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  FOR r IN
    SELECT data, status, tipo_dia, observacao, horas_trabalhadas,
           horas_extras, horas_faltantes, colaborador_id
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

    -- Jornada esperada do dia (RPC) + tolerância POR BATITA da escala.
    SELECT jornada_min INTO v_jornada
    FROM public.ponto_jornada_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id::text, r.data);

    IF v_jornada IS NULL OR v_jornada = 0 THEN
      IF EXTRACT(DOW FROM r.data)::int IN (0, 6) THEN
        v_esperado := 0;
      ELSE
        v_esperado := COALESCE(v_fb_jornada, 0);
      END IF;
    ELSE
      v_esperado := v_jornada;
    END IF;
    -- Tolerância usada = tolerancia_minutos (por batida) da escala.
    v_tol := COALESCE(v_fb_tol, 5);

    v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras) / 60)::int, 0);
    v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes) / 60)::int, 0);

    IF v_extras > 0 OR v_faltantes > 0 THEN
      v_diff := v_extras - v_faltantes;
    ELSE
      IF v_esperado = 0 THEN
        CONTINUE;
      END IF;

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

      IF v_jornada_efetiva = 0 THEN
        CONTINUE;
      END IF;

      IF r.status = 'falta' THEN
        v_debitos := v_debitos + v_jornada_efetiva;
        CONTINUE;
      END IF;

      v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas) / 60)::int, 0);
      v_diff := v_trab - v_jornada_efetiva;
    END IF;

    -- DÉFICIT/EXCEDENTE DO TOTAL DO DIA com tolerância por batida da escala:
    -- compensação (sair mais tarde) abate atraso de entrada naturalmente.
    IF v_diff > v_tol THEN
      v_creditos := v_creditos + v_diff;         -- trabalhou além da jornada
    ELSIF v_diff < -v_tol THEN
      v_debitos := v_debitos + (-v_diff);        -- déficit do dia (não compensado)
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

  DELETE FROM public.ponto_banco_horas_movimentacoes
  WHERE banco_horas_id = v_banco_id
    AND origem = 'apuracao';

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

REVOKE EXECUTE ON FUNCTION public.apurar_banco_horas_colaborador(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
