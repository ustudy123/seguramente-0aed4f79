-- =========================================================
-- AUDITORIA DO PONTO — correções de banco
--
-- 1. Recria proximo_tipo_marcacao_externo (estava AUSENTE do banco,
--    embora definida em migrations e chamada pelo PWA — toda chamada
--    retornava erro; é a função que decide Entrada/Saída no app).
-- 2. Remove overload órfão registrar_ponto_externo(...p_selfie_base64).
-- 3. Consolidação com VIRADA DE MEIA-NOITE (turno noturno): saída <=
--    entrada aberta soma 24h em vez de zerar. Função dividida em
--    helpers (_ponto_grava_abono, _ponto_calc_dia) porque o SQL Editor
--    do Supabase trunca o paste de funções muito grandes.
-- 4. consolidar_ponto_dia_todos: materializa faltas/dias sem marcação.
-- =========================================================

-- ── 1) proximo_tipo_marcacao_externo (recriada) ──
CREATE OR REPLACE FUNCTION public.proximo_tipo_marcacao_externo(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_data DATE;
  v_ultima RECORD;
  v_proximo TEXT;
  v_marcacoes JSON;
  v_afast public.afastamentos;
BEGIN
  SELECT * INTO v_link FROM public.ponto_links
  WHERE token = p_token AND ativo = true
    AND (data_expiracao IS NULL OR data_expiracao > now());
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link inválido ou expirado.');
  END IF;

  v_data := timezone('America/Sao_Paulo', now())::DATE;

  v_afast := public.afastamento_vigente(v_link.tenant_id, v_link.colaborador_cpf, v_data);
  IF v_afast.id IS NOT NULL THEN
    RETURN json_build_object(
      'afastado', true,
      'afastado_ate', CASE WHEN v_afast.data_fim IS NOT NULL THEN to_char(v_afast.data_fim, 'DD/MM/YYYY') ELSE NULL END,
      'afastado_desde', to_char(v_afast.data_inicio, 'DD/MM/YYYY')
    );
  END IF;

  SELECT hora_marcacao, tipo_marcacao INTO v_ultima
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data
  ORDER BY hora_marcacao DESC, created_at DESC
  LIMIT 1;

  IF v_ultima.tipo_marcacao IS NULL THEN
    v_proximo := 'entrada';
  ELSIF COALESCE(public.ponto_classifica_tipo(v_ultima.tipo_marcacao), 'in') = 'in' THEN
    v_proximo := 'saida';
  ELSE
    v_proximo := 'entrada';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'tipo', tipo_marcacao,
    'classe', COALESCE(public.ponto_classifica_tipo(tipo_marcacao), 'in'),
    'hora', to_char(hora_marcacao, 'HH24:MI')
  ) ORDER BY hora_marcacao ASC), '[]'::json)
  INTO v_marcacoes
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_link.tenant_id
    AND colaborador_cpf = v_link.colaborador_cpf
    AND data_marcacao = v_data;

  RETURN json_build_object(
    'proximo', v_proximo,
    'marcacoes', v_marcacoes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proximo_tipo_marcacao_externo(text) TO anon, authenticated;

-- ── 2) Remove overload órfão ──
DROP FUNCTION IF EXISTS public.registrar_ponto_externo(text, text, double precision, double precision, text, text);

-- ── 3) Helper de abono ──
-- PARTE A: helper que grava um dia abonado (justificado) no ponto_diario.
-- Extrai o bloco repetido de férias/atestado/afastamento.
CREATE OR REPLACE FUNCTION public._ponto_grava_abono(
  p_tenant_id UUID, p_colaborador_id UUID, p_colaborador_nome TEXT,
  p_colaborador_cpf TEXT, p_data DATE, p_observacao TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $abono$
BEGIN
  IF p_colaborador_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.ponto_diario (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao
  ) VALUES (
    p_tenant_id, public.ponto_empresa_do_colaborador(p_colaborador_id),
    p_colaborador_id, p_colaborador_nome, p_colaborador_cpf, p_data,
    NULL, NULL, NULL, NULL, make_interval(mins => 0), 'justificado', p_observacao
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
    status = 'justificado', observacao = EXCLUDED.observacao, updated_at = now();
END;
$abono$;

-- ── 3b) Helper de cálculo do dia (pareamento + status) ──
CREATE OR REPLACE FUNCTION public._ponto_calc_dia(
  p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE, p_cid UUID,
  OUT o_pent TIME, OUT o_salm TIME, OUT o_ralm TIME, OUT o_usai TIME,
  OUT o_horas INTERVAL, OUT o_status TEXT, OUT o_obs TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $calc$
DECLARE
  v_marc RECORD;
  v_count INT := 0;
  v_ins TIME[] := '{}'; v_outs TIME[] := '{}';
  v_abr TIME; v_classe TEXT; v_esp TEXT := 'in';
  v_min INT := 0; v_dif INT;
  v_anom BOOLEAN := false; v_aberta BOOLEAN := false;
  v_pend BOOLEAN := false; v_esc RECORD;
BEGIN
  FOR v_marc IN
    SELECT hora_marcacao, tipo_marcacao FROM public.ponto_marcacoes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf AND data_marcacao = p_data
    ORDER BY hora_marcacao ASC, created_at ASC
  LOOP
    v_count := v_count + 1;
    v_classe := COALESCE(public.ponto_classifica_tipo(v_marc.tipo_marcacao), v_esp);
    IF v_classe = 'in' THEN
      o_pent := COALESCE(o_pent, v_marc.hora_marcacao);
      v_ins := v_ins || v_marc.hora_marcacao;
      IF v_abr IS NOT NULL THEN v_anom := true; END IF;
      v_abr := v_marc.hora_marcacao; v_esp := 'out';
    ELSE
      IF v_abr IS NOT NULL THEN
        v_dif := (EXTRACT(EPOCH FROM (v_marc.hora_marcacao - v_abr)) / 60)::INT;
        IF v_dif < 0 THEN v_dif := v_dif + 1440; END IF;
        v_min := v_min + GREATEST(0, v_dif);
        v_abr := NULL;
      ELSE
        v_anom := true;
      END IF;
      v_outs := v_outs || v_marc.hora_marcacao;
      o_usai := v_marc.hora_marcacao; v_esp := 'in';
    END IF;
  END LOOP;

  v_aberta := (v_abr IS NOT NULL);
  IF array_length(v_outs,1) >= 2 THEN
    o_salm := v_outs[1];
    SELECT t INTO o_ralm FROM unnest(v_ins) AS t WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
  END IF;
  IF v_aberta AND array_length(v_outs,1) >= 1 AND array_length(v_ins,1) >= 2 THEN
    o_salm := v_outs[1];
    SELECT t INTO o_ralm FROM unnest(v_ins) AS t WHERE t > v_outs[1] ORDER BY t ASC LIMIT 1;
    o_usai := NULL;
  END IF;
  o_horas := make_interval(mins => v_min);

  SELECT EXISTS (SELECT 1 FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
      AND data_referencia = p_data AND status = 'pendente') INTO v_pend;

  IF v_pend THEN o_status := 'ajuste_pendente';
  ELSIF v_count = 0 THEN o_status := 'falta';
  ELSIF v_aberta OR v_anom THEN o_status := 'incompleto';
  ELSE
    o_status := 'regular';
    SELECT * INTO v_esc FROM public.ponto_escala_do_dia(p_tenant_id, p_colaborador_cpf, p_cid, p_data);
    IF v_esc.hora_entrada IS NOT NULL AND o_pent IS NOT NULL
       AND o_pent > (v_esc.hora_entrada + make_interval(mins => v_esc.tolerancia_min)) THEN
      o_status := 'atraso';
    END IF;
  END IF;

  IF v_anom AND NOT v_pend THEN
    o_obs := 'Sequência de marcações incompleta (entrada/saída sem par) — horas do período não pareado não contabilizadas. Solicite ajuste de ponto.';
  END IF;
END;
$calc$;

-- ── 3c) Consolidação principal (chama os helpers) ──
CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id UUID, p_colaborador_cpf TEXT, p_data DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $main$
DECLARE
  v_afast public.afastamentos;
  v_ferias public.ferias_solicitacoes;
  v_atest public.atestados;
  v_cid UUID; v_cnome TEXT; v_eid UUID; v_obs TEXT;
  c RECORD;
BEGIN
  SELECT colaborador_id, colaborador_nome INTO v_cid, v_cnome
  FROM public.ponto_marcacoes
  WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
  ORDER BY created_at DESC LIMIT 1;
  IF v_cid IS NULL THEN
    SELECT colaborador_id, colaborador_nome INTO v_cid, v_cnome
    FROM public.ponto_ajustes
    WHERE tenant_id = p_tenant_id AND colaborador_cpf = p_colaborador_cpf
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  SELECT f.* INTO v_ferias FROM public.ferias_solicitacoes f
  WHERE f.tenant_id = p_tenant_id AND f.colaborador_cpf = p_colaborador_cpf
    AND f.status IN ('aprovado','em_gozo','concluido')
    AND f.data_inicio <= p_data AND f.data_fim >= p_data
  ORDER BY f.data_inicio DESC LIMIT 1;
  IF v_ferias.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_ferias.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_ferias.colaborador_nome);
    v_obs := 'Férias: ' || to_char(v_ferias.data_inicio,'DD/MM/YYYY') || ' a ' || to_char(v_ferias.data_fim,'DD/MM/YYYY');
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs);
    RETURN;
  END IF;

  SELECT a.* INTO v_atest FROM public.atestados a
  WHERE a.tenant_id = p_tenant_id AND a.colaborador_cpf = p_colaborador_cpf
    AND a.data_inicio_afastamento IS NOT NULL
    AND a.data_inicio_afastamento <= p_data
    AND (a.data_fim_afastamento IS NULL OR a.data_fim_afastamento >= p_data)
  ORDER BY a.data_inicio_afastamento DESC LIMIT 1;
  IF v_atest.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_atest.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_atest.colaborador_nome);
    v_obs := 'Atestado: ' || to_char(v_atest.data_inicio_afastamento,'DD/MM/YYYY')
      || CASE WHEN v_atest.data_fim_afastamento IS NOT NULL THEN ' a ' || to_char(v_atest.data_fim_afastamento,'DD/MM/YYYY') ELSE '' END;
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs);
    RETURN;
  END IF;

  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_afast.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_afast.colaborador_nome);
    v_obs := 'Afastamento (' || COALESCE(replace(v_afast.motivo_principal::text,'_',' '),'registrado')
      || '): de ' || to_char(v_afast.data_inicio,'DD/MM/YYYY')
      || CASE WHEN v_afast.data_fim IS NOT NULL THEN ' a ' || to_char(v_afast.data_fim,'DD/MM/YYYY') ELSE ' — em aberto' END;
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs);
    RETURN;
  END IF;

  IF v_cid IS NULL THEN RETURN; END IF;
  v_eid := public.ponto_empresa_do_colaborador(v_cid);

  c := public._ponto_calc_dia(p_tenant_id, p_colaborador_cpf, p_data, v_cid);

  INSERT INTO public.ponto_diario (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao
  ) VALUES (
    p_tenant_id, v_eid, v_cid, v_cnome, p_colaborador_cpf, p_data,
    c.o_pent, c.o_salm, c.o_ralm, c.o_usai, c.o_horas, c.o_status, c.o_obs
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
    colaborador_nome = EXCLUDED.colaborador_nome,
    entrada = EXCLUDED.entrada, saida_almoco = EXCLUDED.saida_almoco,
    retorno_almoco = EXCLUDED.retorno_almoco, saida = EXCLUDED.saida,
    horas_trabalhadas = EXCLUDED.horas_trabalhadas,
    status = CASE WHEN public.ponto_diario.status = 'justificado' THEN 'justificado' ELSE EXCLUDED.status END,
    observacao = CASE WHEN public.ponto_diario.status = 'justificado'
                        AND public.ponto_diario.observacao LIKE 'Abonado por afastamento%'
                      THEN public.ponto_diario.observacao ELSE EXCLUDED.observacao END,
    updated_at = now();
END;
$main$;

-- ── 4) Materializa faltas + GRANTs ──
CREATE OR REPLACE FUNCTION public.consolidar_ponto_dia_todos(p_tenant_id UUID, p_data DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $todos$
DECLARE
  v_colab RECORD;
  v_n INT := 0;
BEGIN
  FOR v_colab IN
    SELECT DISTINCT a.cpf FROM public.admissoes a
    WHERE a.tenant_id = p_tenant_id AND a.cpf IS NOT NULL
      AND COALESCE(a.inativo, false) = false
      AND COALESCE(a.bate_ponto, true) = true
      AND a.data_admissao <= p_data
  LOOP
    PERFORM public.consolidar_ponto_diario_manual(p_tenant_id, v_colab.cpf, p_data);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$todos$;

REVOKE EXECUTE ON FUNCTION public.consolidar_ponto_dia_todos(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidar_ponto_dia_todos(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consolidar_ponto_diario_manual(uuid, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ponto_grava_abono(uuid, uuid, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._ponto_calc_dia(uuid, text, date, uuid) TO authenticated;
