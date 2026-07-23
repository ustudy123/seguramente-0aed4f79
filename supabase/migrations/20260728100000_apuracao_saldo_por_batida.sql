-- =========================================================
-- APURAÇÃO DO BANCO DE HORAS: alinhar com a tela de edição
--
-- PROBLEMA: os créditos/débitos da LISTAGEM (valor gravado pela apuração)
-- divergiam dos mostrados no dialog "Editar Banco" — ex.: Adriana, 07/2026,
-- listagem +8h51/-12h16 x dialog +7h50/-12h20. O correto é o do dialog.
--
-- CAUSA: as duas telas aplicavam a tolerância em lugares diferentes.
--   - Apuração (antes): saldo = trabalhado_bruto - jornada; depois
--     DESCARTAVA o dia se |saldo| coubesse na tolerância diária.
--   - Dialog (correto): ajusta as BATIDAS pela tolerância (entrada/saída) e
--     só então calcula saldo = trabalhado_ajustado - jornada.
-- Por isso chegar adiantado virava crédito na apuração (mas não no dialog),
-- e atrasos pequenos eram zerados na apuração (mas contavam no dialog).
--
-- ESCOPO DESTA MIGRATION (mínimo):
--   ALTERADO: apenas o cálculo do saldo do dia quando existe escala com
--   horários definidos — passa a usar ponto_escala_do_dia (entrada, saída,
--   intervalo, tolerância de batida), como o dialog.
--   PRESERVADO, sem qualquer mudança: dias protegidos (justificado, férias,
--   atestado, afastamento, feriado), atestado de horas descontando jornada,
--   fallback de jornada por atribuição mais antiga, regra de extras/faltantes
--   consolidados, saldo anterior, upsert do banco, movimentações manuais e
--   recálculo dos totais.
--   Quando NÃO há escala com horários, o caminho antigo continua idêntico.
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
  -- Batidas da escala do dia, para aplicar a tolerância NA BATIDA (regra do dialog)
  v_ent_esc time;
  v_sai_esc time;
  v_interv int;
  v_tol_bat int;
  v_ent_real time;
  v_sai_real time;
  v_ent_cons int;        -- entrada considerada (minutos do dia)
  v_sai_cons int;        -- saída considerada (minutos do dia)
  v_trab_ajust int;      -- trabalhado após ajuste das batidas
  v_usou_batida boolean; -- true quando o cálculo por batida foi aplicado
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

    -- Batidas previstas da escala do dia (mesma fonte usada pelo dialog).
    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 5;
    BEGIN
      SELECT entrada, saida, COALESCE(intervalo_min, 0), COALESCE(tolerancia_batida_min, 5)
        INTO v_ent_esc, v_sai_esc, v_interv, v_tol_bat
      FROM public.ponto_escala_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id::text, r.data);
    EXCEPTION WHEN OTHERS THEN
      v_ent_esc := NULL; v_sai_esc := NULL;
    END;

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

    -- ── Cálculo por BATIDA (regra do dialog "Editar Banco") ──────────────
    -- A tolerância é aplicada NA BATIDA, não no saldo do dia:
    --   entrada dentro da tolerância  -> considera o horário oficial;
    --   saída  dentro da tolerância   -> considera o horário oficial;
    --   saída após o horário          -> considera a real (extra integral).
    -- Consequência (correta): chegar adiantado não vira crédito, e atraso
    -- além da tolerância conta integralmente. Antes a RPC fazia
    -- (trabalhado_bruto - jornada) e depois descartava o dia se o SALDO
    -- coubesse na tolerância diária — daí divergir do que a tela mostrava.
    v_usou_batida := false;
    v_ent_real := r.entrada;
    v_sai_real := r.saida;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND v_ent_real IS NOT NULL AND v_sai_real IS NOT NULL
       AND COALESCE(v_esperado, 0) > 0 THEN

      v_ent_cons := CASE
        WHEN EXTRACT(EPOCH FROM v_ent_real)/60 <= EXTRACT(EPOCH FROM v_ent_esc)/60 + COALESCE(v_tol_bat, 5)
          THEN (EXTRACT(EPOCH FROM v_ent_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM v_ent_real)/60)::int
      END;

      v_sai_cons := CASE
        WHEN EXTRACT(EPOCH FROM v_sai_real)/60 >= EXTRACT(EPOCH FROM v_sai_esc)/60
          THEN (EXTRACT(EPOCH FROM v_sai_real)/60)::int
        WHEN EXTRACT(EPOCH FROM v_sai_real)/60 >= EXTRACT(EPOCH FROM v_sai_esc)/60 - COALESCE(v_tol_bat, 5)
          THEN (EXTRACT(EPOCH FROM v_sai_esc)/60)::int
        ELSE (EXTRACT(EPOCH FROM v_sai_real)/60)::int
      END;

      v_trab_ajust := GREATEST(0, v_sai_cons - v_ent_cons - COALESCE(v_interv, 0));

      -- Atestado de HORAS continua descontando da jornada esperada.
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

      IF v_jornada_efetiva > 0 THEN
        v_diff := v_trab_ajust - v_jornada_efetiva;
        v_usou_batida := true;
      END IF;
    END IF;

    IF v_usou_batida THEN
      -- Tolerância já aplicada na batida: o saldo entra integral.
      IF v_diff > 0 THEN
        v_creditos := v_creditos + v_diff;
      ELSIF v_diff < 0 THEN
        v_debitos := v_debitos + (-v_diff);
      END IF;
      CONTINUE;
    END IF;

    -- ── Sem escala com horários: mantém exatamente a regra anterior ──────
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

-- ---------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------
DO $verifica$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.proname = 'apurar_banco_horas_colaborador'
      AND p.prosrc LIKE '%v_usou_batida%'
  ) THEN
    RAISE EXCEPTION 'FALHOU: apuração não foi atualizada com o cálculo por batida.';
  END IF;
  RAISE NOTICE 'OK: apuração alinhada ao dialog (tolerância aplicada na batida).';
END $verifica$;
