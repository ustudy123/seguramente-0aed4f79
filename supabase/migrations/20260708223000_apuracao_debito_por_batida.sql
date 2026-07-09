-- Apuração do banco de horas passa a calcular DÉBITO POR BATIDA:
--   * atraso na ENTRADA (real > prevista + tolerancia_minutos da escala) e
--   * SAÍDA ANTECIPADA (real < prevista - tolerancia_minutos)
-- geram débito, cada um; horas além da jornada seguem virando crédito.
-- A tolerância vem SEMPRE da escala do colaborador (tolerancia_minutos),
-- respeitando escalas diferentes por colaborador.
--
-- Substitui o modelo anterior, que comparava apenas o TOTAL do dia contra a
-- jornada usando a tolerância diária (por isso um atraso de entrada dentro da
-- tolerância diária — ex.: 6min com tol. diária 10 — não era debitado).

-- 1) Função auxiliar: débito (min) de atraso de entrada + saída antecipada do dia.
--    Compara cada batida com o bloco previsto da escala de MAIOR sobreposição.
--    Retorna 0 quando não há escala/blocos ou quando o dia não tem batidas.
CREATE OR REPLACE FUNCTION public.ponto_debito_batida_do_dia(
  p_tenant_id uuid,
  p_colaborador_cpf text,
  p_data date,
  p_entrada time,
  p_saida time
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_escala_id uuid;
  v_tol int := 5;
  v_dow int := EXTRACT(DOW FROM p_data)::int;  -- 0=dom ... 6=sab
  v_dia text;
  v_ini_prev time;   -- início do primeiro bloco do dia (entrada prevista)
  v_fim_prev time;   -- fim do último bloco do dia (saída prevista)
  v_debito int := 0;
  v_atraso int;
  v_antec int;
BEGIN
  IF p_entrada IS NULL AND p_saida IS NULL THEN
    RETURN 0;
  END IF;

  -- Escala vigente do colaborador na data (atribuição ativa mais recente).
  SELECT a.escala_id INTO v_escala_id
  FROM public.ponto_escala_atribuicoes a
  WHERE a.tenant_id = p_tenant_id
    AND regexp_replace(a.colaborador_cpf, '\D', '', 'g') = regexp_replace(p_colaborador_cpf, '\D', '', 'g')
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF v_escala_id IS NULL THEN
    RETURN 0;  -- sem escala: não há previsto para comparar
  END IF;

  SELECT COALESCE(e.tolerancia_minutos, 5) INTO v_tol
  FROM public.ponto_escalas e WHERE e.id = v_escala_id;

  v_dia := CASE v_dow
    WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda' WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'  WHEN 4 THEN 'quinta'  WHEN 5 THEN 'sexta'
    ELSE 'sabado' END;

  -- Entrada prevista = início do primeiro bloco; saída prevista = fim do último.
  SELECT MIN(hora_inicio), MAX(hora_fim) INTO v_ini_prev, v_fim_prev
  FROM public.ponto_escala_periodos
  WHERE tenant_id = p_tenant_id AND escala_id = v_escala_id AND dia_semana = v_dia;

  IF v_ini_prev IS NULL THEN
    RETURN 0;  -- dia sem expediente previsto (folga): não debita por batida
  END IF;

  -- Atraso de entrada
  IF p_entrada IS NOT NULL THEN
    v_atraso := EXTRACT(EPOCH FROM (p_entrada - v_ini_prev)) / 60;
    IF v_atraso > v_tol THEN
      v_debito := v_debito + v_atraso;  -- desconta o atraso cheio (não só o excedente)
    END IF;
  END IF;

  -- Saída antecipada
  IF p_saida IS NOT NULL THEN
    v_antec := EXTRACT(EPOCH FROM (v_fim_prev - p_saida)) / 60;
    IF v_antec > v_tol THEN
      v_debito := v_debito + v_antec;
    END IF;
  END IF;

  RETURN GREATEST(0, v_debito);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ponto_debito_batida_do_dia(uuid, text, date, time, time) TO authenticated, service_role;


-- 2) Apuração recriada usando o débito por batida.
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
  v_atest_min int;       -- minutos de atestado de HORAS no dia
  v_jornada_efetiva int; -- jornada esperada já descontado o atestado de horas
  v_esperado int;        -- jornada esperada do dia (RPC ou fallback)
  v_extras int;
  v_faltantes int;
  v_fb_jornada int;      -- fallback: jornada_diaria_minutos da atribuição mais antiga
  v_fb_tol int := 0;
  v_deb_batida int;   -- débito por batida (atraso entrada + saída antecipada)
  r RECORD;
BEGIN
  -- Identidade do colaborador (registro mais recente da competência).
  SELECT colaborador_id, colaborador_nome, empresa_id
    INTO v_colaborador_id, v_colaborador_nome, v_empresa_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  -- Sem registros na competência: nada a apurar (não cria banco vazio).
  IF v_colaborador_id IS NULL THEN
    RETURN;
  END IF;
  IF p_empresa_id IS NOT NULL THEN
    v_empresa_id := p_empresa_id;
  END IF;

  -- Fallback de jornada (espelha o dialog "Editar Banco"): atribuição ativa
  -- MAIS ANTIGA do colaborador, sem filtro de vigência — cobre dias anteriores
  -- ao data_inicio da escala atual, em que ponto_jornada_do_dia devolve vazio.
  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0)
    INTO v_fb_jornada, v_fb_tol
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_colaborador_cpf OR a.colaborador_id = v_colaborador_id)
    AND COALESCE(a.ativa, true) = true
  ORDER BY a.data_inicio ASC
  LIMIT 1;

  -- Soma créditos/débitos por dia, com a MESMA fórmula do dialog.
  FOR r IN
    SELECT data, status, tipo_dia, observacao, horas_trabalhadas,
           horas_extras, horas_faltantes, colaborador_id, entrada, saida
    FROM public.ponto_diario
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data BETWEEN v_ini AND v_fim
  LOOP
    -- Dias abonados/protegidos não geram débito nem crédito:
    --  - status 'justificado' (abono por justificativa aprovada);
    --  - tipo_dia férias/atestado/afastamento/feriado;
    --  - observação mencionando atestado OU data coberta por atestado de
    --    DIAS (registros antigos ficaram com tipo_dia='normal').
    -- Todos os DEMAIS dias são apurados — inclusive 'incompleto'.
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

    -- ::text é OBRIGATÓRIO: colaborador_id é uuid e o parâmetro é text
    -- (sem o cast a resolução da função falha e aborta a apuração toda).
    SELECT jornada_min, tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id::text, r.data);

    -- Jornada esperada com fallback (regra do dialog): RPC > 0 usa RPC;
    -- senão dia útil usa o fallback e fim de semana fica sem jornada.
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

    v_extras    := COALESCE((EXTRACT(EPOCH FROM r.horas_extras) / 60)::int, 0);
    v_faltantes := COALESCE((EXTRACT(EPOCH FROM r.horas_faltantes) / 60)::int, 0);

    IF v_extras > 0 OR v_faltantes > 0 THEN
      -- Valores consolidados têm preferência (mesma regra do dialog) e
      -- valem até em fim de semana (extra de sábado/domingo credita).
      v_diff := v_extras - v_faltantes;
    ELSE
      -- Sem base de jornada: dia neutro (igual ao dialog).
      IF v_esperado = 0 THEN
        CONTINUE;
      END IF;

      -- Atestado de HORAS vigente no dia: desconta da jornada esperada
      -- (ausência justificada não gera débito nem crédito). Atestado de
      -- DIAS já foi excluído acima.
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

      -- Jornada totalmente coberta pelo atestado: nada a apurar no dia.
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

    -- MODELO POR BATIDA (substitui a comparação por total do dia):
    -- • DÉBITO do dia = atraso de entrada + saída antecipada, cada um medido
    --   contra o bloco previsto da escala, com a tolerância_minutos da própria
    --   escala do colaborador. É a ÚNICA fonte de débito de dia trabalhado
    --   (dias de falta já debitaram a jornada cheia e deram CONTINUE acima).
    -- • CRÉDITO do dia = quanto o trabalhado excede a jornada esperada
    --   (hora extra), mantido do modelo anterior.
    v_deb_batida := public.ponto_debito_batida_do_dia(
      p_tenant_id, p_colaborador_cpf, r.data, r.entrada, r.saida);

    IF v_diff > v_tol THEN
      -- Trabalhou além da jornada → crédito (hora extra).
      v_creditos := v_creditos + v_diff;
    END IF;

    IF v_deb_batida > 0 THEN
      -- Atraso de entrada e/ou saída antecipada além da tolerância → débito.
      -- Não somamos o déficit do total do dia aqui para não contar em dobro.
      v_debitos := v_debitos + v_deb_batida;
    END IF;
  END LOOP;

  -- Saldo anterior = saldo atual da competência imediatamente anterior.
  -- Se a competência anterior NÃO tem banco (ex.: implantação), preserva o
  -- Saldo Anterior já lançado manualmente nesta competência (digitado no
  -- "Editar Banco") em vez de zerá-lo.
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

  -- Upsert do banco da competência (mantém compensados/manuais existentes).
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

  -- Substitui apenas as movimentações apuradas anteriores (preserva manuais).
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

  -- Recalcula totais do banco a partir de TODAS as movimentações.
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

-- 3) Função pública (wrapper com gate de papel) — inalterada ---------------
CREATE OR REPLACE FUNCTION public.apurar_banco_horas(
  p_tenant_id uuid,
  p_competencia text,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_access boolean := false;
  v_count int := 0;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Acesso ao tenant (cadastro ativo ou profile no tenant).
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = p_tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = v_uid AND p.tenant_id = p_tenant_id
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Sem acesso a este tenant';
  END IF;

  -- Papel mínimo: gestor/RH.
  IF NOT public.has_minimum_role(v_uid, 'manager'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas gestor/RH pode apurar o banco de horas';
  END IF;

  FOR r IN
    SELECT DISTINCT colaborador_cpf
    FROM public.ponto_diario
    WHERE tenant_id = p_tenant_id
      AND to_char(data, 'YYYY-MM') = p_competencia
      AND colaborador_cpf IS NOT NULL
      AND (p_empresa_id IS NULL OR empresa_id = p_empresa_id OR empresa_id IS NULL)
  LOOP
    PERFORM public.apurar_banco_horas_colaborador(p_tenant_id, r.colaborador_cpf, p_competencia, p_empresa_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'competencia', p_competencia,
    'colaboradores', v_count
  );
END;
$$;

