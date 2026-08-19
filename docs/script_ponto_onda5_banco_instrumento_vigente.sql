-- ============================================================================
-- ENTREGA — ONDA 5 (parte 1): banco de horas só com instrumento vigente
-- Alvos: ponto_banco_regime_vigente (nova); apurar_banco_horas_colaborador
-- PONTO-170
--
-- O banco de horas creditava para todo mundo, sem regime nem acordo. Sem
-- instrumento valido e vigente (CLT art. 59, §§2º e 5º), a hora extra e devida
-- em DINHEIRO na competencia — manda-la para o banco e postergar pagamento
-- devido. Passa a so creditar/debitar o banco quando ha regime de compensacao
-- vigente para o vinculo; sem regime, o excedente segue apurado no dia e vai
-- para a folha (nao some).
--
-- GARANTIAS
--   · So muda quem NAO tem regime: vinculo com regime vigente segue identico.
--   · Nao apaga nada — a hora extra continua apurada no dia; apenas nao vira
--     saldo de banco sem lastro. A batch apurar_banco_horas so repassa para esta
--     funcao, entao o comportamento propaga sozinho.
-- Aditivo e idempotente (CREATE OR REPLACE). Sem backfill.
-- ============================================================================

-- (1) Resolução do regime de banco vigente do vínculo ------------------------
CREATE OR REPLACE FUNCTION public.ponto_banco_regime_vigente(
  p_tenant_id      uuid,
  p_colaborador_cpf text,
  p_colaborador_id text,
  p_ref_data       date
)
RETURNS public.ponto_banco_horas_config
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf       text := regexp_replace(COALESCE(p_colaborador_cpf, ''), '[^0-9]', '', 'g');
  v_escala_id uuid;
  v_empresa   uuid;
  v_cfg       public.ponto_banco_horas_config;
BEGIN
  -- Escala vigente do colaborador na data (para casar a config por escala).
  SELECT a.escala_id INTO v_escala_id
  FROM public.ponto_escala_atribuicoes a
  WHERE a.tenant_id = p_tenant_id
    AND (regexp_replace(COALESCE(a.colaborador_cpf, ''), '[^0-9]', '', 'g') = v_cpf
         OR a.colaborador_id::text = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND (a.data_inicio IS NULL OR a.data_inicio <= p_ref_data)
    AND (a.data_fim IS NULL OR a.data_fim >= p_ref_data)
  ORDER BY a.data_inicio DESC NULLS LAST
  LIMIT 1;

  v_empresa := public.ponto_empresa_do_cpf(p_tenant_id, p_colaborador_cpf);

  -- Regime vigente que cobre o vínculo: específico da escala > da empresa >
  -- do tenant. Se o regime exige acordo individual ou CCT/ACT, precisa do
  -- instrumento anexado (acordo_id) para valer.
  SELECT c.* INTO v_cfg
  FROM public.ponto_banco_horas_config c
  WHERE c.tenant_id = p_tenant_id
    AND COALESCE(c.ativo, false) = true
    AND (c.data_inicio IS NULL OR c.data_inicio <= p_ref_data)
    AND (c.escala_id IS NULL OR c.escala_id = v_escala_id)
    AND (c.empresa_id IS NULL OR c.empresa_id = v_empresa)
    AND (
      (COALESCE(c.exige_acordo_individual, false) = false
       AND COALESCE(c.exige_cct_act, false) = false)
      OR c.acordo_id IS NOT NULL
    )
  ORDER BY (c.escala_id IS NOT NULL) DESC,
           (c.empresa_id IS NOT NULL) DESC,
           c.data_inicio DESC NULLS LAST
  LIMIT 1;

  RETURN v_cfg;  -- linha com todos os campos NULL quando não há regime vigente
END;
$$;

COMMENT ON FUNCTION public.ponto_banco_regime_vigente(uuid, text, text, date) IS
  'Resolve o regime de banco de horas vigente do vinculo na data (config especifica da escala prevalece sobre a da empresa e a do tenant; exige acordo/CCT anexado quando o regime marca que o exige). Retorna a linha de ponto_banco_horas_config, ou linha nula quando nao ha regime. CLT art. 59 §§2/5.';

-- (2) Apuração credita/debita o banco só com regime vigente ------------------
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

  -- (170) Banco só com instrumento vigente (CLT art. 59, §§2º/5º): sem regime
  -- de compensação vigente para o vínculo, nada vai para o banco — o excedente
  -- continua apurado no dia e é devido em dinheiro (folha). Com regime, credita
  -- e debita como sempre.
  v_regime := public.ponto_banco_regime_vigente(p_tenant_id, p_colaborador_cpf, v_colaborador_id, v_fim);
  IF v_regime.id IS NULL THEN
    v_creditos := 0;
    v_debitos  := 0;
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
      updated_at = now()
  WHERE id = v_banco_id;
END;
$function$;

COMMENT ON FUNCTION public.apurar_banco_horas_colaborador(uuid, text, text, uuid) IS
  'Apura o banco de horas do colaborador na competencia. So credita/debita o banco quando ha regime de compensacao vigente (ponto_banco_regime_vigente); sem regime, o excedente nao vira saldo de banco (devido em dinheiro na folha). CLT art. 59 §§2/5.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK
--   regime_helper : t  (funcao ponto_banco_regime_vigente existe)
--   apuracao_gate : t  (a apuracao consulta o regime vigente)
-- ---------------------------------------------------------------------------
SELECT
  (to_regprocedure('public.ponto_banco_regime_vigente(uuid,text,text,date)') IS NOT NULL) AS regime_helper,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname='apurar_banco_horas_colaborador'
            AND prosrc ILIKE '%ponto_banco_regime_vigente%')                              AS apuracao_gate,
  CASE WHEN to_regprocedure('public.ponto_banco_regime_vigente(uuid,text,text,date)') IS NOT NULL
        AND EXISTS (SELECT 1 FROM pg_proc WHERE proname='apurar_banco_horas_colaborador'
              AND prosrc ILIKE '%ponto_banco_regime_vigente%')
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
