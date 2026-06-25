-- =====================================================================
-- Apuração automática do Banco de Horas a partir do ponto (on-demand)
-- =====================================================================
-- Contexto: até aqui o Banco de Horas era 100% manual (lançamentos e
-- import de planilha). A consolidação diária (consolidar_ponto_diario_manual
-- v3) grava em ponto_diario apenas horas_trabalhadas/status, NÃO calcula
-- horas extras/atraso em minutos. Portanto a apuração do saldo é feita aqui,
-- comparando, por dia, as horas trabalhadas com a JORNADA ESPERADA da escala
-- do colaborador.
--
-- Disparo: ON-DEMAND. A função pública apurar_banco_horas() é chamada pelo
-- botão "Apurar agora" (gestor/RH). NÃO há trigger no caminho da batida —
-- decisão de produto para não recalcular dado de folha no hot path.
--
-- Convivência com lançamentos manuais: a apuração grava movimentações com
-- origem='apuracao' (resumidas por competência) e recalcula o saldo somando
-- TODAS as movimentações (apuradas + manuais). Lançamentos manuais existentes
-- recebem origem='manual' (default) e são preservados. Re-apurar substitui
-- apenas as movimentações origem='apuracao'.
-- =====================================================================

-- 1) Coluna para separar movimentações apuradas das manuais ------------
ALTER TABLE public.ponto_banco_horas_movimentacoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

-- 2) Helper: jornada diária esperada (minutos) e tolerância da escala ---
-- Mesma resolução de escala usada em ponto_escala_do_dia (atribuição
-- vigente por CPF ou colaborador_id). Retorna a carga diária esperada.
CREATE OR REPLACE FUNCTION public.ponto_jornada_do_dia(
  p_tenant_id uuid,
  p_cpf text,
  p_colaborador_id text,
  p_data date
)
RETURNS TABLE (jornada_min int, tol_min int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT e.jornada_diaria_minutos, COALESCE(e.tolerancia_diaria_minutos, 0)
  FROM public.ponto_escala_atribuicoes a
  JOIN public.ponto_escalas e ON e.id = a.escala_id
  WHERE a.tenant_id = p_tenant_id
    AND (a.colaborador_cpf = p_cpf OR a.colaborador_id = p_colaborador_id)
    AND COALESCE(a.ativa, true) = true
    AND a.data_inicio <= p_data
    AND (a.data_fim IS NULL OR a.data_fim >= p_data)
  ORDER BY a.data_inicio DESC
  LIMIT 1;
$$;

-- 3) Apuração de UM colaborador numa competência (uso interno) ----------
-- SECURITY DEFINER e SEM checagem de auth: é chamada apenas pela função
-- pública apurar_banco_horas() (que faz o gate de papel). O EXECUTE é
-- revogado de PUBLIC/authenticated logo abaixo para impedir chamada direta.
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

    IF r.status = 'falta' THEN
      v_debitos := v_debitos + v_jornada;
      CONTINUE;
    END IF;

    v_trab := COALESCE((EXTRACT(EPOCH FROM r.horas_trabalhadas) / 60)::int, 0);
    v_diff := v_trab - v_jornada;
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

-- 4) Função pública: apura a competência inteira (com gate de papel) ----
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
