-- =====================================================================
-- Fix: apuração do Banco de Horas deve DESCONTAR o atestado de HORAS
--      da jornada esperada do dia.
-- =====================================================================
-- Problema: apurar_banco_horas_colaborador compara horas trabalhadas x
-- jornada esperada da escala. Dias com atestado de DIAS já são ignorados
-- (tipo_dia='atestado'), mas o atestado de HORAS (parcial) NÃO seta tipo_dia
-- e o dia é apurado normalmente — sem abater as horas do atestado. Assim, um
-- atestado de 4h vira "débito" indevido (o sistema cobra a jornada cheia).
--
-- Ex.: jornada 8h, atestado 4h manhã.
--   - Faltou o resto (0h trabalhadas): hoje debita 8h; correto = 4h.
--   - Trabalhou 4h38 à tarde: hoje debita ~3h22; correto = crédito de ~38min.
--
-- Correção: para cada dia, calcula os minutos de atestado de HORAS vigentes e
-- os desconta da jornada esperada (jornada efetiva = jornada - atestado, min 0)
-- antes de apurar crédito/débito, inclusive no ramo de falta.
--
-- Após aplicar, re-execute "Apurar agora" na(s) competência(s) afetada(s).
-- =====================================================================

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
  v_comp_anterior text;
  v_tot_cred int := 0;
  v_tot_deb int := 0;
  v_tot_comp int := 0;
  v_jornada int;
  v_tol int;
  v_trab int;
  v_diff int;
  v_atest_min int;      -- minutos de atestado de HORAS no dia
  v_jornada_efetiva int; -- jornada esperada já descontado o atestado de horas
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

  -- Soma créditos/débitos comparando horas trabalhadas x jornada esperada.
  FOR r IN
    SELECT data, status, tipo_dia, horas_trabalhadas, colaborador_id
    FROM public.ponto_diario
    WHERE tenant_id = p_tenant_id
      AND colaborador_cpf = p_colaborador_cpf
      AND data BETWEEN v_ini AND v_fim
  LOOP
    -- Apura apenas dias efetivamente trabalháveis. Dias abonados/neutros
    -- (justificado, férias, atestado, afastamento, feriado) e estados
    -- inconclusivos (incompleto, ajuste_pendente, pendente) são ignorados.
    IF r.status NOT IN ('regular', 'atraso', 'falta')
       OR COALESCE(r.tipo_dia, 'normal') IN ('ferias', 'atestado', 'afastamento', 'feriado') THEN
      CONTINUE;
    END IF;

    SELECT jornada_min, tol_min INTO v_jornada, v_tol
    FROM public.ponto_jornada_do_dia(p_tenant_id, p_colaborador_cpf, r.colaborador_id, r.data);

    -- Sem escala/jornada definida não há base para apurar este dia.
    IF v_jornada IS NULL OR v_jornada = 0 THEN
      CONTINUE;
    END IF;
    v_tol := COALESCE(v_tol, 0);

    -- Atestado de HORAS vigente no dia: desconta da jornada esperada (as
    -- horas do atestado são ausência justificada, não geram débito nem
    -- crédito). Atestado de DIAS já foi excluído acima (tipo_dia='atestado').
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
    IF v_diff > v_tol THEN
      v_creditos := v_creditos + v_diff;       -- trabalhou além da jornada
    ELSIF v_diff < -v_tol THEN
      v_debitos := v_debitos + (-v_diff);      -- trabalhou aquém (atraso/saída antecipada)
    END IF;
  END LOOP;

  -- Saldo anterior = saldo atual da competência imediatamente anterior.
  v_comp_anterior := to_char(v_ini - INTERVAL '1 month', 'YYYY-MM');
  SELECT saldo_atual_minutos INTO v_saldo_anterior
  FROM public.ponto_banco_horas
  WHERE tenant_id = p_tenant_id
    AND colaborador_cpf = p_colaborador_cpf
    AND competencia = v_comp_anterior;
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
