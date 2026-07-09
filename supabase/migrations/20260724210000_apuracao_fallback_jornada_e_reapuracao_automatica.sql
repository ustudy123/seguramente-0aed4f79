-- =====================================================================
-- Fix v2: "Apurar agora" do Banco de Horas — fallback de jornada,
--         cast uuid→text e reapuração automática ao aprovar ajustes
-- =====================================================================
-- A correção anterior (20260724200000) não bastou por dois motivos:
--   1) BUG BLOQUEADOR: ponto_diario.colaborador_id é UUID e
--      ponto_jornada_do_dia espera TEXT — a chamada sem ::text estoura
--      42883 em runtime e ABORTA a transação inteira do "Apurar agora"
--      (zero movimentações para todos). A versão antiga não estourava
--      porque descartava os dias 'incompleto' antes de chegar na chamada.
--   2) FALLBACK DE JORNADA: o dialog "Editar Banco" usa a atribuição
--      ativa mais antiga do colaborador (sem filtro de vigência) quando
--      ponto_jornada_do_dia devolve 0/nulo num dia útil — cobre dias
--      anteriores ao data_inicio da escala. O SQL pulava esses dias.
-- Além disso, a apuração passa a espelhar a fórmula do dialog
-- (horas_extras/horas_faltantes têm preferência quando preenchidas) e
-- processar_ajuste_ponto passa a REAPURAR automaticamente a competência
-- do ajuste aprovado/rejeitado (se o colaborador já tem banco), para o
-- Banco de Horas refletir aprovações sem precisar de "Apurar agora".
--
-- Recria a cadeia completa (independe do que já foi rodado antes):
--   ponto_jornada_do_dia, apurar_banco_horas_colaborador,
--   apurar_banco_horas, processar_ajuste_ponto.
-- =====================================================================

-- 1) Jornada esperada do dia (versão dias_config — igual a 20260702205452)
CREATE OR REPLACE FUNCTION public.ponto_jornada_do_dia(
  p_tenant_id uuid, p_cpf text, p_colaborador_id text, p_data date
)
RETURNS TABLE(jornada_min integer, tol_min integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escala public.ponto_escalas;
  v_dow int;
  v_dia_key text;
  v_ordinal int;
  v_dia_cfg jsonb;
  v_comp jsonb;
  v_entrada time;
  v_saida time;
  v_intervalo int;
  v_jornada int;
BEGIN
  SELECT e.* INTO v_escala
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_cpf OR a.colaborador_id = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;

  IF v_escala.id IS NULL THEN
    RETURN;
  END IF;

  -- Escalas sem dias_config (12x36, ciclo, etc.): mantém comportamento anterior
  IF v_escala.dias_config IS NULL OR jsonb_typeof(v_escala.dias_config) <> 'object' THEN
    jornada_min := v_escala.jornada_diaria_minutos;
    tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  v_dow := EXTRACT(DOW FROM p_data)::int; -- 0=domingo ... 6=sabado
  v_dia_key := CASE v_dow
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END;

  v_dia_cfg := v_escala.dias_config -> v_dia_key;

  -- Dia marcado como trabalha=true: deriva jornada dos horários do dia
  IF v_dia_cfg IS NOT NULL AND COALESCE((v_dia_cfg->>'trabalha')::boolean, false) THEN
    v_entrada := (v_dia_cfg->>'entrada')::time;
    v_saida := (v_dia_cfg->>'saida')::time;
    v_jornada := EXTRACT(EPOCH FROM (v_saida - v_entrada))::int / 60;
    IF COALESCE((v_dia_cfg->>'tem_almoco')::boolean, false)
       AND (v_dia_cfg->>'inicio_almoco') IS NOT NULL
       AND (v_dia_cfg->>'fim_almoco') IS NOT NULL THEN
      v_jornada := v_jornada - (EXTRACT(EPOCH FROM (
        (v_dia_cfg->>'fim_almoco')::time - (v_dia_cfg->>'inicio_almoco')::time
      ))::int / 60);
    END IF;
    jornada_min := GREATEST(v_jornada, 0);
    tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Dia marcado como folga: verifica compensações mensais (ex: 4º sábado do mês)
  IF v_escala.compensacoes_mensais IS NOT NULL
     AND jsonb_typeof(v_escala.compensacoes_mensais) = 'array' THEN
    v_ordinal := ((EXTRACT(DAY FROM p_data)::int - 1) / 7) + 1;
    SELECT c INTO v_comp
    FROM jsonb_array_elements(v_escala.compensacoes_mensais) c
    WHERE c->>'dia_semana' = v_dia_key
      AND COALESCE((c->>'ordinal_mes')::int, 0) = v_ordinal
    LIMIT 1;

    IF v_comp IS NOT NULL THEN
      v_entrada := (v_comp->>'entrada')::time;
      v_saida := (v_comp->>'saida')::time;
      v_intervalo := COALESCE((v_comp->>'intervalo')::int, 0);
      v_jornada := (EXTRACT(EPOCH FROM (v_saida - v_entrada))::int / 60) - v_intervalo;
      jornada_min := GREATEST(v_jornada, 0);
      tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Folga real: jornada zero (apuração vai ignorar o dia)
  jornada_min := 0;
  tol_min := COALESCE(v_escala.tolerancia_diaria_minutos, 0);
  RETURN NEXT;
END;
$function$;

-- 2) Apuração por colaborador: cast ::text, fallback de jornada e fórmula
--    idêntica à do dialog "Editar Banco" -----------------------------------
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
           horas_extras, horas_faltantes, colaborador_id
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

    IF v_diff > v_tol THEN
      v_creditos := v_creditos + v_diff;       -- trabalhou além da jornada
    ELSIF v_diff < -v_tol THEN
      v_debitos := v_debitos + (-v_diff);      -- trabalhou aquém (atraso/saída antecipada)
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

REVOKE EXECUTE ON FUNCTION public.apurar_banco_horas(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apurar_banco_horas(uuid, text, uuid) TO authenticated;

-- 4) processar_ajuste_ponto: reapura o banco de horas da competência ao
--    aprovar/rejeitar (base verbatim = 20260702174019; a reapuração roda
--    DEPOIS do abono, para não debitar dia recém-justificado, e só quando
--    o colaborador já tem banco na competência — não cria banco fantasma).
CREATE OR REPLACE FUNCTION public.processar_ajuste_ponto(p_ajuste_id uuid, p_aprovado boolean, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ajuste public.ponto_ajustes%ROWTYPE;
  v_has_access boolean := false;
  v_is_gestor boolean := false;
  v_vinculo_role text;
  v_aprovador_nome text;
  v_tipo text;
  v_just_tipo_abono text;
  v_just_nome text;
  v_deve_abonar boolean := false;
  v_colab_uuid uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_ajuste FROM public.ponto_ajustes WHERE id = p_ajuste_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ajuste não encontrado'; END IF;
  IF v_ajuste.status <> 'pendente' THEN RAISE EXCEPTION 'Este ajuste já foi processado'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_base ub
    WHERE ub.auth_user_id = v_uid AND ub.tenant_id = v_ajuste.tenant_id AND ub.status = 'ativo'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    SELECT uv.tipo_vinculo::text INTO v_vinculo_role
    FROM public.usuario_vinculos uv
    JOIN public.usuarios_base ub2 ON ub2.id = uv.usuario_id
    WHERE ub2.auth_user_id = v_uid
      AND uv.tenant_id = v_ajuste.tenant_id
      AND uv.status = 'ativo'
      AND (uv.data_fim IS NULL OR uv.data_fim >= CURRENT_DATE)
    LIMIT 1;
    IF v_vinculo_role IS NOT NULL THEN
      v_has_access := true;
      v_is_gestor := v_vinculo_role IN ('gestor','administrador','proprietario','rh');
    END IF;
  END IF;

  IF NOT v_has_access THEN
    SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_uid AND p.tenant_id = v_ajuste.tenant_id) INTO v_has_access;
  END IF;
  IF NOT v_has_access THEN RAISE EXCEPTION 'Sem acesso a este tenant'; END IF;

  IF NOT v_is_gestor THEN
    v_is_gestor :=
      public.has_role(v_uid, 'manager'::public.app_role)
      OR public.has_role(v_uid, 'admin'::public.app_role)
      OR public.has_role(v_uid, 'owner'::public.app_role)
      OR public.has_role(v_uid, 'superadmin'::public.app_role);
  END IF;

  IF NOT v_is_gestor THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios_base ub3
      WHERE ub3.auth_user_id = v_uid AND ub3.tipo_usuario IN ('gestor','administrador','proprietario','rh')
    ) INTO v_is_gestor;
  END IF;

  IF NOT v_is_gestor THEN RAISE EXCEPTION 'Apenas gestor/RH pode processar ajustes de ponto'; END IF;

  SELECT nome_completo INTO v_aprovador_nome
  FROM public.usuarios_base
  WHERE auth_user_id = v_uid AND tenant_id = v_ajuste.tenant_id
  LIMIT 1;
  IF v_aprovador_nome IS NULL THEN
    SELECT nome_completo INTO v_aprovador_nome FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  END IF;

  UPDATE public.ponto_ajustes
  SET status = CASE WHEN p_aprovado THEN 'aprovado' ELSE 'rejeitado' END,
      aprovado_por = v_uid,
      aprovado_por_nome = v_aprovador_nome,
      data_aprovacao = now(),
      observacao_aprovador = p_observacao
  WHERE id = p_ajuste_id;

  IF p_aprovado AND v_ajuste.justificativa_id IS NOT NULL THEN
    SELECT tipo_abono, nome INTO v_just_tipo_abono, v_just_nome
    FROM public.ponto_justificativas WHERE id = v_ajuste.justificativa_id;
    v_deve_abonar := (v_just_tipo_abono = 'sim')
      OR (v_just_tipo_abono = 'configuravel' AND COALESCE(v_ajuste.abonar_se_aprovado, false));
    IF v_deve_abonar THEN
      BEGIN v_colab_uuid := v_ajuste.colaborador_id::uuid;
      EXCEPTION WHEN OTHERS THEN v_colab_uuid := NULL;
      END;
    END IF;
  END IF;

  IF NOT p_aprovado OR v_ajuste.tipo_ajuste IN ('justificativa', 'abono') THEN
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL AND COALESCE(v_ajuste.dia_inteiro, false) THEN
      PERFORM public._ponto_gera_batidas_dia_inteiro(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia, v_ajuste.id, v_uid
      );
    END IF;
    PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);
    IF v_deve_abonar AND v_colab_uuid IS NOT NULL THEN
      PERFORM public._ponto_grava_abono(
        v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
        v_ajuste.colaborador_cpf, v_ajuste.data_referencia,
        COALESCE(v_just_nome, v_ajuste.motivo)
      );
    END IF;
    -- Reapuração automática do banco de horas da competência do ajuste.
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.ponto_banco_horas b
        WHERE b.tenant_id = v_ajuste.tenant_id
          AND b.colaborador_cpf = v_ajuste.colaborador_cpf
          AND b.competencia = to_char(v_ajuste.data_referencia, 'YYYY-MM')
      ) THEN
        PERFORM public.apurar_banco_horas_colaborador(
          v_ajuste.tenant_id, v_ajuste.colaborador_cpf,
          to_char(v_ajuste.data_referencia, 'YYYY-MM'), v_ajuste.empresa_id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'reapuracao do banco de horas falhou: %', SQLERRM;
    END;
    RETURN jsonb_build_object('success', true, 'abonado', v_deve_abonar);
  END IF;

  v_tipo := COALESCE(v_ajuste.tipo_marcacao, 'batida');
  IF v_tipo = 'saida_almoco' THEN v_tipo := 'saida'; END IF;
  IF v_tipo = 'retorno_almoco' THEN v_tipo := 'entrada'; END IF;

  -- CORREÇÃO SEGURA: só apaga se houver hora_original explícita.
  -- Sem hora_original o comportamento vira "inclusão" (apenas insere),
  -- evitando o sumiço em massa de batidas do mesmo tipo no dia.
  IF v_ajuste.tipo_ajuste = 'correcao' AND v_ajuste.hora_original IS NOT NULL THEN
    PERFORM set_config('app.allow_ponto_delete', 'true', true);
    DELETE FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_original, 'HH24:MI');
    PERFORM set_config('app.allow_ponto_delete', 'false', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ponto_marcacoes
    WHERE tenant_id = v_ajuste.tenant_id
      AND colaborador_cpf = v_ajuste.colaborador_cpf
      AND data_marcacao = v_ajuste.data_referencia
      AND tipo_marcacao = v_tipo
      AND to_char(hora_marcacao, 'HH24:MI') = to_char(v_ajuste.hora_solicitada, 'HH24:MI')
  ) THEN
    INSERT INTO public.ponto_marcacoes (
      tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
      data_marcacao, hora_marcacao, tipo_marcacao, marcacao_original, created_by, hash_marcacao
    ) VALUES (
      v_ajuste.tenant_id, v_ajuste.empresa_id, v_ajuste.colaborador_id, v_ajuste.colaborador_nome, v_ajuste.colaborador_cpf,
      v_ajuste.data_referencia, v_ajuste.hora_solicitada, v_tipo, false, v_uid, 'AJUSTE-' || p_ajuste_id
    );
  END IF;

  PERFORM public.consolidar_ponto_diario_manual(v_ajuste.tenant_id, v_ajuste.colaborador_cpf, v_ajuste.data_referencia);

  IF v_deve_abonar AND v_colab_uuid IS NOT NULL THEN
    PERFORM public._ponto_grava_abono(
      v_ajuste.tenant_id, v_colab_uuid, v_ajuste.colaborador_nome,
      v_ajuste.colaborador_cpf, v_ajuste.data_referencia,
      COALESCE(v_just_nome, v_ajuste.motivo)
    );
  END IF;

  -- Reapuração automática do banco de horas da competência do ajuste.
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.ponto_banco_horas b
      WHERE b.tenant_id = v_ajuste.tenant_id
        AND b.colaborador_cpf = v_ajuste.colaborador_cpf
        AND b.competencia = to_char(v_ajuste.data_referencia, 'YYYY-MM')
    ) THEN
      PERFORM public.apurar_banco_horas_colaborador(
        v_ajuste.tenant_id, v_ajuste.colaborador_cpf,
        to_char(v_ajuste.data_referencia, 'YYYY-MM'), v_ajuste.empresa_id
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reapuracao do banco de horas falhou: %', SQLERRM;
  END;

  RETURN jsonb_build_object('success', true, 'abonado', v_deve_abonar);
END;
$function$;
