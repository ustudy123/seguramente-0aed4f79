-- =========================================================
-- BANCO DE HORAS: listagem passa a bater com a tela de edição
--
-- Diagnóstico (confirmado com os dados da Cleciane, 06/2026):
--   listagem  +19h59 / -19h13
--   edição    +12h26 / -14h26
--   movimentações: apuracao 746cr/866db + apuracao_auto 453cr/11db
--                  + manual 276db
-- Ou seja: a edição JÁ batia com a origem 'apuracao' (746=12h26,
-- 866=14h26). O cálculo nunca esteve errado. A listagem inflava porque
-- somava DUAS coisas a mais:
--
--  1) movimentações órfãs de origem 'apuracao_auto', criadas por uma versão
--     antiga da apuração (migration 20260701). A apuração atual só apagava
--     origem='apuracao' antes de reinserir, então as 'apuracao_auto' nunca
--     eram limpas e acumulavam a cada reapuração. -> CORRIGIDO aqui: o
--     DELETE passa a remover as duas origens.
--  2) lançamentos manuais, que a listagem soma e a edição não via. -> a
--     edição passa a exibi-los (mudança no front, não nesta migration).
--
-- Também nesta migration: tolerância SIMÉTRICA de 10 min na batida, regra
-- informada pela empresa — até 10 min não gera nada; a partir de 11 conta
-- CHEIO, tanto crédito quanto débito, na entrada e na saída.
--
-- PRESERVADO sem mudança: dias protegidos (justificado/férias/atestado/
-- afastamento/feriado), atestado de horas descontando jornada, fallback de
-- jornada, extras/faltantes consolidados, saldo anterior, upsert do banco,
-- movimentações manuais e recálculo dos totais.
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
  -- Batidas da escala do dia (tolerância aplicada NA BATIDA, como na tela)
  v_ent_esc time; v_sai_esc time; v_interv int; v_tol_bat int;
  v_ent_cons int; v_sai_cons int; v_trab_ajust int; v_usou_batida boolean;
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

    v_ent_esc := NULL; v_sai_esc := NULL; v_interv := 0; v_tol_bat := 10;
    BEGIN
      SELECT entrada, saida, COALESCE(intervalo_min, 0), COALESCE(tolerancia_batida_min, 10)
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

    -- ── Tolerância SIMÉTRICA na batida (regra da empresa: 10 min) ────────
    -- Dentro de 10 min (para mais ou para menos) vale o horário oficial: não
    -- gera crédito nem débito. A partir de 11 min vale o horário REAL e o
    -- tempo conta CHEIO — 11 min de atraso são 11 min de débito, 11 min a
    -- mais na saída são 11 min de crédito. Mesma regra dos dois lados de cada
    -- batida, entrada e saída.
    v_usou_batida := false;

    IF v_ent_esc IS NOT NULL AND v_sai_esc IS NOT NULL
       AND r.entrada IS NOT NULL AND r.saida IS NOT NULL
       AND COALESCE(v_esperado, 0) > 0 THEN

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
-- Limpeza retroativa: remove as movimentações órfãs já acumuladas.
-- São resquícios da apuração automática antiga (origem 'apuracao_auto'),
-- não lançamentos de ninguém — os manuais têm origem 'manual' e ficam.
-- ---------------------------------------------------------
DELETE FROM public.ponto_banco_horas_movimentacoes
WHERE origem = 'apuracao_auto';

-- Recalcula os totais de todos os bancos afetados a partir do que sobrou.
UPDATE public.ponto_banco_horas b
SET creditos_minutos = t.cred,
    debitos_minutos = t.deb,
    compensados_minutos = t.comp,
    saldo_atual_minutos = b.saldo_anterior_minutos + t.cred - t.deb - t.comp,
    updated_at = now()
FROM (
  SELECT banco_horas_id,
         COALESCE(SUM(minutos) FILTER (WHERE tipo = 'credito'), 0)    AS cred,
         COALESCE(SUM(minutos) FILTER (WHERE tipo = 'debito'), 0)     AS deb,
         COALESCE(SUM(minutos) FILTER (WHERE tipo = 'compensacao'), 0) AS comp
  FROM public.ponto_banco_horas_movimentacoes
  GROUP BY banco_horas_id
) t
WHERE b.id = t.banco_horas_id;

-- ---------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------
DO $verifica$
DECLARE v_orfas int;
BEGIN
  SELECT count(*) INTO v_orfas
  FROM public.ponto_banco_horas_movimentacoes
  WHERE origem = 'apuracao_auto';

  IF v_orfas > 0 THEN
    RAISE EXCEPTION 'FALHOU: ainda restam % movimentações apuracao_auto.', v_orfas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'apurar_banco_horas_colaborador'
      AND prosrc LIKE '%apuracao_auto%'
  ) THEN
    RAISE EXCEPTION 'FALHOU: apuração não limpa mais a origem apuracao_auto.';
  END IF;

  RAISE NOTICE 'OK: órfãs removidas, apuração limpa as duas origens, tolerância simétrica de 10 min.';
END $verifica$;
