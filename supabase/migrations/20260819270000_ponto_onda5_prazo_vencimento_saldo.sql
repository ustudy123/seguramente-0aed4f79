-- ============================================================================
-- ONDA 5 (parte 2) — Prazo de vencimento em cada crédito do banco
-- PONTO-171 / PONTO-354
--
-- O mecanismo de conversão de saldo vencido em hora extra JÁ EXISTE e funciona
-- (converter_banco_horas_vencido): quando o prazo de compensação passa, o saldo
-- positivo vira hora extra a pagar. Só que ele NUNCA dispara — a apuração jamais
-- grava prazo_compensacao na linha do banco, então nenhum saldo tem vencimento e
-- a conversão nunca encontra o que converter. Resultado: saldos passam dos 6
-- meses do acordo individual (CLT art. 59, §5º) ou dos 12 do coletivo (§2º) sem
-- virar hora extra — ficam pendurados para sempre.
--
-- O QUE FAZ (aditivo): ao apurar a competência, apurar_banco_horas_colaborador
-- passa a gravar prazo_compensacao = fim da competência + prazo_compensacao_dias
-- do regime vigente (resolvido pela ponto_banco_regime_vigente da parte 1). Com
-- o prazo na linha, a conversão automática que já existe passa a ter o que
-- converter no vencimento.
--
-- GARANTIAS
--   · Depende da parte 1 (#21): usa o regime vigente já resolvido. Sem regime,
--     não há crédito nem prazo (nada muda em relação à parte 1).
--   · Só ACRESCENTA o prazo; quando não há regime, preserva o prazo já existente
--     na linha (não apaga vencimento de saldo acumulado sob regime anterior).
--   · Não altera a conversão nem o motor de saldo. Aditivo e idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apurar_banco_horas_colaborador(p_tenant_id uuid, p_colaborador_cpf text, p_competencia text, p_empresa_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_regime public.ponto_banco_horas_config;
  v_prazo date;
  -- Só para LOCALIZAR os dias no ponto_diario. Ao gravar seguimos usando
  -- p_colaborador_cpf, para não alterar o formato já existente na tabela.
  v_cpf text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
BEGIN
  SELECT colaborador_id, colaborador_nome, empresa_id
    INTO v_colaborador_id, v_colaborador_nome, v_empresa_id
  FROM public.ponto_diario
  WHERE tenant_id = p_tenant_id
    AND regexp_replace(colaborador_cpf, '[^0-9]', '', 'g') = v_cpf
    AND data BETWEEN v_ini AND v_fim
  ORDER BY data DESC
  LIMIT 1;

  IF v_colaborador_id IS NULL THEN
    RETURN;
  END IF;
  IF v_empresa_id IS NULL THEN
    v_empresa_id := COALESCE(public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf), p_empresa_id);
  END IF;

  -- FONTE ÚNICA: soma os saldos diários calculados pela função acima.
  SELECT
    COALESCE(SUM(CASE WHEN s.saldo_min > 0 THEN s.saldo_min ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN s.saldo_min < 0 THEN -s.saldo_min ELSE 0 END), 0)
  INTO v_creditos, v_debitos
  FROM public.ponto_saldo_dias_competencia(p_tenant_id, p_colaborador_cpf, p_competencia) s;

  -- (170) Banco só com instrumento vigente + (171/354) prazo de vencimento.
  -- Sem regime de compensação vigente: nada vai para o banco (devido em dinheiro
  -- na folha). Com regime: credita/debita e grava o prazo de compensação
  -- derivado (fim da competência + prazo_compensacao_dias do regime — 6 meses no
  -- acordo individual, até 12 no coletivo). CLT art. 59, §§2º/5º/6º.
  v_regime := public.ponto_banco_regime_vigente(p_tenant_id, p_colaborador_cpf, v_colaborador_id, v_fim);
  IF v_regime.id IS NULL THEN
    v_creditos := 0;
    v_debitos  := 0;
    v_prazo    := NULL;
  ELSE
    v_prazo := v_fim + COALESCE(v_regime.prazo_compensacao_dias, 180);
  END IF;

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
      prazo_compensacao = COALESCE(v_prazo, prazo_compensacao),
      updated_at = now()
  WHERE id = v_banco_id;
END;
$function$;

COMMENT ON FUNCTION public.apurar_banco_horas_colaborador(uuid, text, text, uuid) IS
  'Apura o banco de horas do colaborador. So credita/debita com regime vigente (parte 1) e grava prazo_compensacao = fim da competencia + prazo_compensacao_dias do regime (parte 2), para a conversao automatica de saldo vencido disparar. CLT art. 59 §§2/5/6.';
