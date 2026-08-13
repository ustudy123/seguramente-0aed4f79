-- =====================================================================
-- QA · PONTO-290/292/293 passam a montar o cenário dentro do regime
--
-- Com a chave de controle por empresa (20260813180000), a materialização
-- só cobre quem está no regime de ponto. As rotinas 290, 292 e 293
-- criavam o colaborador SEM empresa e sem nenhuma batida — que é
-- exatamente o perfil que o novo critério exclui de propósito, e por
-- bom motivo: na produção esse perfil são 11.788 pessoas que nunca
-- bateram ponto.
--
-- O requisito NÃO está sendo afrouxado. Ele continua o mesmo, agora com
-- o recorte correto: numa empresa que ADOTA controle de jornada, o dia
-- sem batida tem de existir no espelho. O que deixou de ser exigido é
-- gerar falta para empresa que nunca usou o módulo — isso era o defeito,
-- não o requisito.
--
-- Cada rotina passa a criar a empresa com a chave ligada, e a 293 ganha
-- um segundo passo que fecha a outra metade da regra: colaborador de
-- empresa FORA do regime não pode aparecer no diagnóstico. Sem esse
-- passo, a rotina aprovaria um sistema que voltasse a materializar tudo.
-- =====================================================================

SET lock_timeout = '10s';

-- Helper: empresa de teste já dentro do regime de ponto.
CREATE OR REPLACE FUNCTION public.qa_empresa_com_ponto(p_nome text, p_cnpj text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.qa_nova_empresa(p_nome, p_cnpj);
  UPDATE public.empresa_cadastro SET usa_controle_ponto = true WHERE id = v_id;
  RETURN v_id;
END $$;

COMMENT ON FUNCTION public.qa_empresa_com_ponto(text, text) IS
  'Empresa de teste que adota controle de jornada. Cenário de ponto tem de nascer no regime, senão testa outra coisa.';

-- ══ PONTO-290: o dia sem batida existe ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_290()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_n int; v_res jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Com Ponto', '11222333029001');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Faltante Materializado', 29001, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s numa empresa que adota controle, sem nenhuma marcação do colaborador', v_dia);
  r.esperado := 'Linha criada em ponto_diario — o dia sem batida passa a existir';
  v_res := public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia;
  IF v_n = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('O DIA SEM BATIDA CONTINUA SEM EXISTIR: a materialização não criou linha para %s (retorno: %s). '
      'É a reabertura do caso de 13/07 — a falta que não desconta porque nunca é vista.', v_dia, v_res::text);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Materializar um período inteiramente no futuro';
  r.esperado := 'Ignorado — não existe falta em dia que não aconteceu';
  v_res := public.ponto_materializar_faltas(CURRENT_DATE + 1, CURRENT_DATE + 5, v_t);
  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data > CURRENT_DATE;
  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'O dia sem batida foi materializado e o futuro ficou de fora.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linha(s) criadas em datas futuras — falta antecipada não existe.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-292: materializar duas vezes não duplica ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_292()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_cpf text; v_dia date := public.qa_dia_util_passado(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Idempotente', '11222333029201');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Idempotente', 29201, v_emp);
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  r.passo_ordem := 1;
  r.passo_acao := 'Rodar a materialização de novo sobre o mesmo dia';
  r.esperado := 'Nenhuma linha nova — rodar N vezes produz o estado de rodar uma';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, v_t);

  SELECT count(*) INTO v_n FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_dia;
  IF v_n = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Três execuções, uma linha — a rotina diária é segura de repetir.';
  ELSIF v_n = 0 THEN
    r.situacao := 'falhou'; r.obtido := 'A materialização não criou linha nenhuma (ver PONTO-290).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linhas para o mesmo dia — a rotina duplica quando repetida.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-293: o diagnóstico acusa o buraco — e só o buraco de verdade ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_293()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_emp_fora uuid; v_cpf text; v_cpf_fora text;
        v_comp text := to_char(CURRENT_DATE, 'YYYY-MM'); v_antes int; v_depois int; v_fora int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Diagnosticada', '11222333029301');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Diagnosticado', 29301,
                                    v_emp, date_trunc('month', CURRENT_DATE)::date);

  -- Empresa que NÃO adota controle: não pode aparecer no diagnóstico.
  v_emp_fora := public.qa_nova_empresa('[QA-PONTO] Unidade Sem Ponto', '11222333029302');
  v_cpf_fora := public.qa_ponto_admissao('[QA-PONTO] Fora do Regime', 29302,
                                         v_emp_fora, date_trunc('month', CURRENT_DATE)::date);

  r.passo_ordem := 1; r.passo_acao := 'Rodar o diagnóstico com os dias sem linha';
  r.esperado := 'O colaborador da empresa que adota controle aparece na lista';
  SELECT count(*) INTO v_antes
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_antes = 0 THEN
    IF date_trunc('month', CURRENT_DATE)::date > CURRENT_DATE - 1 THEN
      r.situacao := 'passou';
      r.obtido := 'Competência sem dia útil vivido — nada a materializar, diagnóstico vazio é o correto.';
      RETURN r;
    END IF;
    r.situacao := 'falhou';
    r.obtido := 'O DIAGNÓSTICO NÃO ENXERGA O BURACO: colaborador de empresa que adota controle, com dias úteis sem linha, não aparece em ponto_dias_nao_materializados.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir que a empresa SEM controle de jornada ficou de fora';
  r.esperado := 'Não aparece — quem não adota controle não gera falta';
  SELECT count(*) INTO v_fora
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf_fora;

  IF v_fora > 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: colaborador de empresa que NÃO adota controle de jornada aparece no '
             || 'diagnóstico. Materializar isso criaria falta para quem nunca esteve no controle '
             || '— na produção de 13/08 eram 11.788 pessoas nessa situação, em 1.387 empresas '
             || 'sem uma única batida.';
    RETURN r;
  END IF;

  r.passo_ordem := 3; r.passo_acao := 'Materializar o mês e rodar o diagnóstico de novo';
  r.esperado := 'O colaborador do regime sai da lista';
  PERFORM public.ponto_materializar_faltas(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE - 1, v_t);
  SELECT count(*) INTO v_depois
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_depois = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Diagnóstico acusou o buraco de quem está no regime, ignorou quem não está, e '
             || 'silenciou depois da materialização.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Após materializar, o colaborador continua na lista com %s dia(s) — ou a '
                    || 'materialização não cobriu, ou o diagnóstico não bate com ela.', v_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
