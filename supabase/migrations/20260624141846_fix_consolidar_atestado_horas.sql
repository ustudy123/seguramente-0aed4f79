-- Fix: consolidação de ponto tratava atestado de HORAS como dia cheio e
-- interpretava data_fim_afastamento NULL como "vigente para sempre", o que
-- rotulava dias trabalhados como Atestado/justificado em massa.
--
-- Regra corrigida no bloco de atestado:
--   * Só abona o dia quando o atestado é de DIA CHEIO (unidade_afastamento = 'dias').
--     Atestado de HORAS é parcial e NÃO rebaixa o dia (segue calculado pelas marcações).
--   * Fim nulo passa a valer apenas o data_inicio_afastamento (1 dia), via
--     COALESCE(data_fim_afastamento, data_inicio_afastamento), e não "para sempre".
--
-- Demais blocos (férias, afastamento, cálculo do dia, feriado) idênticos à
-- versão viva em produção.

CREATE OR REPLACE FUNCTION public.consolidar_ponto_diario_manual(p_tenant_id uuid, p_colaborador_cpf text, p_data date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_afast public.afastamentos;
  v_ferias public.ferias_solicitacoes;
  v_atest public.atestados;
  v_cid UUID; v_cnome TEXT; v_eid UUID; v_obs TEXT;
  c RECORD; cf RECORD;
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
  -- Fallback pela admissão: essencial em dias sem marcação (materializa
  -- feriado/falta de quem não bateu ponto naquele dia).
  IF v_cid IS NULL THEN
    SELECT id, nome_completo INTO v_cid, v_cnome
    FROM public.admissoes
    WHERE tenant_id = p_tenant_id AND cpf = p_colaborador_cpf
      AND COALESCE(inativo, false) = false
    ORDER BY data_admissao DESC LIMIT 1;
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
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs, 'ferias');
    RETURN;
  END IF;

  -- ATESTADO: só abona o dia se for atestado de DIA CHEIO (unidade='dias').
  -- Atestado de HORAS é parcial e NÃO rebaixa o dia (segue pelas marcações).
  -- Fim nulo = vale apenas o data_inicio (1 dia), não "para sempre".
  SELECT a.* INTO v_atest FROM public.atestados a
  WHERE a.tenant_id = p_tenant_id AND a.colaborador_cpf = p_colaborador_cpf
    AND a.data_inicio_afastamento IS NOT NULL
    AND COALESCE(a.unidade_afastamento,'dias') = 'dias'
    AND a.data_inicio_afastamento <= p_data
    AND COALESCE(a.data_fim_afastamento, a.data_inicio_afastamento) >= p_data
  ORDER BY a.data_inicio_afastamento DESC LIMIT 1;
  IF v_atest.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_atest.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_atest.colaborador_nome);
    v_obs := 'Atestado: ' || to_char(v_atest.data_inicio_afastamento,'DD/MM/YYYY')
      || CASE WHEN v_atest.data_fim_afastamento IS NOT NULL THEN ' a ' || to_char(v_atest.data_fim_afastamento,'DD/MM/YYYY') ELSE '' END;
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs, 'atestado');
    RETURN;
  END IF;

  v_afast := public.afastamento_vigente(p_tenant_id, p_colaborador_cpf, p_data);
  IF v_afast.id IS NOT NULL THEN
    v_cid := COALESCE(v_cid, v_afast.colaborador_id);
    v_cnome := COALESCE(v_cnome, v_afast.colaborador_nome);
    v_obs := 'Afastamento (' || COALESCE(replace(v_afast.motivo_principal::text,'_',' '),'registrado')
      || '): de ' || to_char(v_afast.data_inicio,'DD/MM/YYYY')
      || CASE WHEN v_afast.data_fim IS NOT NULL THEN ' a ' || to_char(v_afast.data_fim,'DD/MM/YYYY') ELSE ' — em aberto' END;
    PERFORM public._ponto_grava_abono(p_tenant_id, v_cid, v_cnome, p_colaborador_cpf, p_data, v_obs, 'afastamento');
    RETURN;
  END IF;

  IF v_cid IS NULL THEN RETURN; END IF;
  v_eid := public.ponto_empresa_do_colaborador(v_cid);

  SELECT * INTO c FROM public._ponto_calc_dia(p_tenant_id, p_colaborador_cpf, p_data, v_cid);
  SELECT * INTO cf FROM public._ponto_class_feriado(p_tenant_id, p_colaborador_cpf, v_cid, p_data, c.o_status, c.o_obs);

  INSERT INTO public.ponto_diario (
    tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
    entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status, observacao,
    tipo_dia, feriado_nome, feriado_trabalhado
  ) VALUES (
    p_tenant_id, v_eid, v_cid, v_cnome, p_colaborador_cpf, p_data,
    c.o_pent, c.o_salm, c.o_ralm, c.o_usai, c.o_horas, cf.o_status, cf.o_obs,
    cf.o_tipo_dia, cf.o_fer_nome, cf.o_fer_trab
  )
  ON CONFLICT (tenant_id, colaborador_cpf, data)
  DO UPDATE SET
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.ponto_diario.empresa_id),
    colaborador_nome = EXCLUDED.colaborador_nome,
    entrada = EXCLUDED.entrada, saida_almoco = EXCLUDED.saida_almoco,
    retorno_almoco = EXCLUDED.retorno_almoco, saida = EXCLUDED.saida,
    horas_trabalhadas = EXCLUDED.horas_trabalhadas,
    status = EXCLUDED.status, observacao = EXCLUDED.observacao,
    tipo_dia = EXCLUDED.tipo_dia, feriado_nome = EXCLUDED.feriado_nome,
    feriado_trabalhado = EXCLUDED.feriado_trabalhado,
    updated_at = now();
END;
$function$;
