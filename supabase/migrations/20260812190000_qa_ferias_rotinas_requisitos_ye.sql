-- ============================================================================
-- QA FÉRIAS — 3ª leva de rotinas: casos da análise de requisitos
-- YE-DP-FERIAS-001 (FERIAS-005..091, documentados em 20260812180000).
-- Padrão da casa: testa o que a LEI exige; divergência = falha proposital
-- com diagnóstico. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- FERIAS-005 — ausência amparada não reduz o saldo (art. 131)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6105);
        v_ini date := CURRENT_DATE - 60; v_fim date := CURRENT_DATE - 10; v_n int;
BEGIN
  -- 1 falta injustificada + 1 dia justificado no mesmo intervalo
  PERFORM public.qa_ponto_dia(v_cpf, 'QA Art131', v_ini + 5, NULL, 'falta');
  PERFORM public.qa_ponto_dia(v_cpf, 'QA Art131', v_ini + 6, NULL, 'justificado');

  r.passo_ordem := 1;
  r.passo_acao := 'Contar as faltas do período pela fonte do Ponto (1 falta + 1 dia justificado)';
  r.esperado := 'Conta 1 — ausência amparada (art. 131) não entra na escala do art. 130';
  v_n := public.ferias_faltas_do_ponto(public.qa_sandbox_tenant_id(), v_cpf, v_ini, v_fim);

  IF v_n = 1 THEN
    r.situacao := 'passou';
    r.obtido := 'Só a falta injustificada contou; o dia justificado ficou fora da escala. '
             || 'Ressalva: isso vale quando a fonte é o Ponto — no modo carga (faltas_carga '
             || 'digitadas), a distinção depende de quem digita.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A contagem devolveu %s (esperado 1). Somar ausência amparada à escala '
             || 'do art. 130 corta férias de quem adoeceu — o art. 131 lista o que NÃO é falta.',
             coalesce(v_n::text, 'NULL'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-006 — faltas não são descontadas dos dias de gozo (art. 130, §1º)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_006()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_dias int; v_subtrai text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Apurar o direito com 8 faltas: faixa, nunca subtração';
  r.esperado := '24 dias (faixa do art. 130) — jamais 22 (30 - 8)';
  v_dias := public.ferias_dias_por_faltas_clt(8);

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma função de férias subtrai faltas dos dias?';
  r.esperado := 'Nenhuma — o §1º veda o desconto um-a-um';
  SELECT string_agg(p.proname, ', ') INTO v_subtrai
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%- falta%' OR p.prosrc ILIKE '%-falta%');

  IF v_dias = 24 AND v_subtrai IS NULL THEN
    r.situacao := 'passou';
    r.obtido := '8 faltas renderam a faixa de 24 dias e nenhuma função subtrai faltas dos dias '
             || 'de gozo — o §1º do art. 130 está respeitado.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Violação do art. 130, §1º: faixa devolveu %s (esperado 24)%s.',
             coalesce(v_dias::text, 'NULL'),
             CASE WHEN v_subtrai IS NOT NULL
                  THEN format('; função(ões) subtraindo faltas: %s', v_subtrai) ELSE '' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;;

-- FERIAS-007 — tempo parcial segue a tabela geral (130-A revogado)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_007()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_resq text; v_dias int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): há resquício da tabela do 130-A (tempo parcial, máx. 18 dias)?';
  r.esperado := 'Nenhum — revogada em 2017; o parcial usa a escala geral (30 dias com até 5 faltas)';
  SELECT string_agg(p.proname, ', ') INTO v_resq
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%parcial%' OR p.prosrc ILIKE '%130-A%' OR p.prosrc ILIKE '%18 dias%');
  v_dias := public.ferias_dias_por_faltas_clt(0);

  IF v_resq IS NULL AND v_dias = 30 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma tabela de tempo parcial no código e a escala geral devolve 30 dias — '
             || 'contrato parcial recebe férias inteiras, como manda a redação pós-2017 '
             || '(mesmo guarda-corpo do FERIAS-015 contra regra revogada).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Resquício de regra revogada: %s (escala geral: %s dias). A tabela do '
             || '130-A não pode voltar.', coalesce(v_resq, '—'), coalesce(v_dias::text, '?'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-008 — prescrição (art. 149)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_008()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o marco prescricional dos períodos é calculado/vigiado?';
  r.esperado := 'Fim do concessivo + 5 anos (2 após a rescisão), com alerta antes de consumar';
  v_est := coalesce(public.qa_col_existe(NULL, '%prescri%'), public.qa_fns_com('%prescri%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: prescrição não existe no módulo — nenhum campo ou função calcula o '
             || 'marco do art. 149 (fim do concessivo + 5 anos; 2 anos após a extinção do '
             || 'contrato, CF art. 7º XXIX). Período esquecido atravessa o marco sem aviso: '
             || 'vira perda definitiva do trabalhador e evidência de desorganização na '
             || 'fiscalização. Correção: data de prescrição derivada por período, com alerta '
             || 'antecipado a RH/Jurídico.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prescrição controlada: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-017 — familiares juntos (art. 136, §1º)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_017()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o cadastro registra vínculo familiar entre colaboradores?';
  r.esperado := 'Familiares na mesma empresa sinalizados para a preferência de coincidência';
  v_est := coalesce(public.qa_col_existe(NULL, '%conjuge%'), public.qa_col_existe(NULL, '%familiar%'),
                    public.qa_fns_com('%familiar%ferias%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhum campo liga colaboradores da mesma família — a preferência do '
             || 'art. 136, §1º (familiares na mesma empresa tirarem férias juntos, se não '
             || 'prejudicar o serviço) não tem como ser sinalizada na programação. É direito '
             || 'informativo, não bloqueante. Correção: vínculo familiar no cadastro + aviso '
             || 'de coincidência na programação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vínculo familiar presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-022 — dobra só dos dias excedentes (Súmula 81)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe cálculo da dobra com o corte da Súmula 81?';
  r.esperado := 'Dobro APENAS sobre os dias gozados após o fim do concessivo';
  v_fns := public.qa_fns_com('%dobro%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (encadeado ao FERIAS-021): a dobra do art. 137 não é calculada em '
             || 'lugar nenhum — e quando for construída, precisa nascer com o corte da Súmula '
             || '81: férias que atravessam o vencimento dobram SÓ os dias excedentes (5 dentro '
             || 'do prazo saem simples; 25 fora saem em dobro). Dobrar o período inteiro '
             || 'superestima o passivo; ignorar o corte o esconde. Correção: cálculo dia a dia '
             || 'contra a data-limite do concessivo, com memória.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dobra presente (conferir o corte da Súmula 81): %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-024 — afastamento sobreposto suspende as férias
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_024()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6124);
        v_status text;
BEGIN
  INSERT INTO public.ferias_solicitacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_inicio, data_fim, dias_solicitados, saldo_dias, status)
  VALUES (public.qa_sandbox_tenant_id(), public.qa_um_usuario(), 'QA Sobreposição', v_cpf,
          CURRENT_DATE - 10, CURRENT_DATE + 19, 30, 30, 'em_gozo');

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar afastamento por doença no meio do gozo e observar a reação';
  r.esperado := 'Sobreposição detectada: gozo suspenso/interrompido e dias restantes preservados';
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_cpf, colaborador_nome, status, data_inicio, data_fim)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Sobreposição', 'ativo',
          CURRENT_DATE, CURRENT_DATE + 30);

  SELECT status INTO v_status FROM public.ferias_solicitacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf;

  IF v_status = 'em_gozo' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o afastamento entrou por cima das férias e NADA reagiu — a solicitação '
             || 'segue "em gozo" com o colaborador afastado por doença. Os dois institutos não '
             || 'coexistem: o gozo deveria suspender, os 20 dias restantes voltarem ao saldo e '
             || 'o eSocial ser ajustado. Sem a detecção, o colaborador "gasta" férias doente — '
             || 'e as férias não gozadas viram passivo. Correção: gatilho de afastamento '
             || 'verificando sobreposição com férias em gozo/aprovadas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('A sobreposição reagiu: solicitação passou a "%s".', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-033 — médias do art. 142 com memória
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe motor de cálculo da remuneração de férias (médias + 1/3)?';
  r.esperado := 'Salário da época + média das variáveis (art. 142) + terço, com memória reproduzível';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%valor_ferias%' OR p.prosrc ILIKE '%valor_terco%'
         OR (p.proname ILIKE '%ferias%' AND p.prosrc ILIKE '%media%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO CENTRAL do documento de requisitos: o CÁLCULO de férias não existe no '
             || 'banco. Os campos de valor da solicitação (valor_ferias, valor_terco, '
             || 'valor_abono, valor_total_bruto) são preenchíveis à mão, sem motor de médias '
             || '(art. 142), sem terço automático, sem memória e sem alerta de rubrica '
             || 'faltante. Quem recebe hora extra habitual, comissão ou adicional leva a MÉDIA '
             || 'para as férias — calcular só o fixo paga a menos, e sem memória nada se '
             || 'audita. Correção: motor de cálculo determinístico com base parametrizável '
             || 'por rubrica e memória exportável (é o RF-004 e o RNF-001 do documento).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Motor de cálculo presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-034 — incidências (art. 144 / Tema 985)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_034()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as naturezas tributáveis × indenizatórias são distinguidas?';
  r.esperado := 'Gozo + 1/3 com INSS/FGTS/IRRF (Tema 985 na patronal); abono + 1/3 fora da base (art. 144)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%ferias%'
    AND (p.prosrc ILIKE '%inss%' OR p.prosrc ILIKE '%irrf%' OR p.prosrc ILIKE '%indenizat%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe apuração de encargos de férias — nenhuma função distingue '
             || 'as duas naturezas que convivem no mesmo pagamento: férias gozadas + 1/3 '
             || 'sofrem INSS/FGTS/IRRF (o terço inclusive na patronal, Tema 985 do STF, '
             || 'modulado desde 15/09/2020); abono pecuniário + seu 1/3 são indenizatórios '
             || '(art. 144) e ficam FORA da base. Misturar erra o encargo para os dois lados. '
             || 'Depende do motor de cálculo do FERIAS-033 existir primeiro; as incidências '
             || 'nascem junto, versionadas ([VAL] contábil).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Incidências tratadas em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-035 — adiantamento do 13º produz efeito
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_035()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção adiantar_13 da programação é consumida por alguém?';
  r.esperado := 'Marcada, soma a 1ª parcela ao pagamento das férias e abate na apuração de novembro';
  v_fns := public.qa_fns_com('%adiantar_13%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o campo adiantar_13 existe na programação e NENHUMA função o lê — a '
             || 'opção é decorativa. O empregado que requer no prazo (Lei 4.749/65, art. 2º, '
             || '§2º) tem DIREITO à 1ª parcela do 13º junto com as férias; marcado o campo e '
             || 'nada acontecendo, ou o DP paga por fora (sem baixa, risco de duplicidade em '
             || 'novembro) ou o direito é ignorado. Correção: opção integrando o cálculo do '
             || 'pagamento e a baixa na apuração do 13º.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Adiantamento consumido em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-054 — reabertura de cálculo com dupla aprovação
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_054()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe reabertura formal de cálculo de férias fechado?';
  r.esperado := 'Motivo + dupla aprovação + diferença/estorno, preservando a versão anterior';
  v_fns := coalesce(public.qa_fns_com('%ferias%reabr%'), public.qa_fns_com('%reabert%ferias%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (encadeado ao FERIAS-033): sem motor de cálculo, não há fechamento — e '
             || 'sem fechamento, não há reabertura formal. Quando o cálculo nascer, o rito '
             || 'nasce junto: cálculo pago não se edita; reabre-se com motivo e DUPLA '
             || 'aprovação, gerando DIFERENÇA (a pagar/estornar) e preservando a versão que o '
             || 'colaborador recebeu. Mesmo desenho da reabertura de competência do Ponto '
             || '(PONTO-358).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reabertura formal presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-055 — aviso sem ciência não conclui a concessão
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_055()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_gate text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a ciência do aviso trava a progressão da concessão?';
  r.esperado := 'Sem assinatura/recusa formal, a concessão não conclui (art. 135, mediante recibo)';
  SELECT string_agg(p.proname, ', ') INTO v_gate
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%assinatura_status%' AND p.prosrc ILIKE '%ferias%';
  IF v_gate IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a solicitação tem os campos de assinatura (assinatura_link_id, '
             || 'assinatura_status — bom sinal), mas NENHUMA função os confere: nada impede a '
             || 'concessão de avançar (em_gozo, concluído) com o aviso pendente de ciência. O '
             || 'art. 135 exige a comunicação MEDIANTE RECIBO — sem ele, a empresa fica sem a '
             || 'prova central da concessão regular. Correção: transição de estado condicionada '
             || 'à ciência (ou recusa formal registrada).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ciência verificada em: %s.', v_gate);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-056 — ninguém aprova as próprias férias
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_056()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6156);
        v_uid uuid := public.qa_um_usuario(); v_aceitou boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    BEGIN
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), public.qa_fixture_email('FERIAS-056', 1))
      RETURNING id INTO v_uid;
    EXCEPTION WHEN OTHERS THEN
      r.situacao := 'nao_implementado';
      r.obtido := 'Sem usuário de autenticação disponível para simular o cenário.';
      RETURN r;
    END;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar solicitação APROVADA onde o aprovador é o próprio solicitante';
  r.esperado := 'Recusado — segregação de funções (mesma trava que o ajuste de ponto tem)';
  BEGIN
    INSERT INTO public.ferias_solicitacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_inicio, data_fim, dias_solicitados, saldo_dias, status,
       aprovado_por, aprovado_por_nome, data_aprovacao)
    VALUES (public.qa_sandbox_tenant_id(), v_uid, 'QA Autoaprovação', v_cpf,
            CURRENT_DATE + 40, CURRENT_DATE + 69, 30, 30, 'aprovado',
            v_uid, 'QA Autoaprovação', now());
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou férias APROVADAS PELO PRÓPRIO SOLICITANTE '
             || '(aprovado_por = colaborador_id) — não existe a trava de segregação que o '
             || 'ajuste de ponto já tem (chk_ajuste_sem_autoaprovacao, PONTO-252). Um gestor '
             || 'escolhe as próprias datas e valores sem contrapeso. Correção: CHECK '
             || '(aprovado_por IS NULL OR aprovado_por <> colaborador_id) em '
             || 'ferias_solicitacoes.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A autoaprovação foi recusada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-062 — coletivas com menos de 12 meses (art. 140)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_062()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o tratamento do contratado há menos de 12 meses em coletivas existe?';
  r.esperado := 'Proporcionais ao tempo de casa, excedente como licença remunerada, aquisitivo reiniciado';
  v_est := coalesce(public.qa_col_existe(NULL, '%coletiv%'), public.qa_fns_com('%ferias%coletiv%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (encadeado ao FERIAS-060): sem o fluxo de coletivas, a regra do art. '
             || '140 para o novato não tem onde viver — quem tem 6 meses de casa goza '
             || 'PROPORCIONAIS, o excedente da parada é licença remunerada (nunca débito '
             || 'futuro), e o aquisitivo REINICIA no retorno. É a regra mais errada na prática '
             || 'das coletivas: nasce junto com o fluxo do FERIAS-060.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Tratamento presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-080/081/082 — eSocial
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_080()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_infra text; v_ferias text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a concessão de férias gera o S-2230 (motivo 15)?';
  r.esperado := 'Cada período de gozo vira um evento de afastamento com datas exatas';
  SELECT string_agg(table_name, ', ') INTO v_infra
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%esocial%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ferias
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%esocial%' AND p.prosrc ILIKE '%ferias%';

  IF v_ferias IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a infraestrutura de eSocial existe (%s) mas é usada só pelos '
             || 'AFASTAMENTOS — nenhuma função liga FÉRIAS ao eSocial: a concessão não gera '
             || 'S-2230 com motivo 15. Sem o evento, o gozo não existe oficialmente para o '
             || 'governo, e folha/FGTS digital desalinham. Correção: aproveitar a '
             || 'infraestrutura existente (esocial_transmissoes) gerando o evento na '
             || 'concessão, um por período de gozo, com validação de datas antes do envio.',
             coalesce(v_infra, 'nenhuma?'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Férias ligadas ao eSocial em: %s.', v_ferias);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ferias_081()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_unq text; v_trad text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a transmissão tem anti-duplicidade e tradução de rejeição?';
  r.esperado := 'Reenvio corrigido substitui/retifica (nunca duplica) e a rejeição vira instrução clara';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  v_trad := coalesce(public.qa_fns_com('%rejeic%'), public.qa_fns_com('%rejeitad%esocial%'));

  IF v_unq IS NULL AND v_trad IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: esocial_transmissoes não tem unicidade (o mesmo evento pode ser '
             || 'gravado/enviado duas vezes) e nenhuma função interpreta rejeições — o retorno '
             || 'técnico chega cru e o reenvio é por conta do operador. Duplicidade no eSocial '
             || 'é passivo criado pela própria correção. Correção: chave natural do evento '
             || '(vínculo + tipo + período) + rotina que traduz a rejeição e conduz a '
             || 'retificação, nunca um clone.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; tradução: %s).',
                       coalesce(v_unq, '—'), coalesce(v_trad, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ferias_082()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as férias refletem nos eventos de folha (S-1200/S-1210)?';
  r.esperado := 'Rubricas de férias + 1/3 na remuneração e a data REAL do pagamento (prova do D-2)';
  v_fns := coalesce(public.qa_fns_com('%S-1200%'), public.qa_fns_com('%S-1210%'),
                    public.qa_fns_com('%detPgtoFer%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os eventos de folha do eSocial (S-1200 remuneração, S-1210 '
             || 'pagamentos) não existem no banco — o dinheiro das férias, quando pago, não '
             || 'vira declaração. O S-1210 é justamente o que prova a data real do pagamento '
             || '(o D-2 do art. 145) perante o Fisco. Depende do motor de cálculo '
             || '(FERIAS-033) e da ligação com o eSocial (FERIAS-080); os três nascem '
             || 'encadeados.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reflexo na folha presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-090 — rescisão liquida vencidas e proporcionais
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_090()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o desligamento consome os períodos de férias?';
  r.esperado := 'Vencidas integrais (dobro se concessivo vencido) + proporcionais por duodécimos, ambas + 1/3';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ferias_periodos%'
    AND (p.prosrc ILIKE '%rescis%' OR p.prosrc ILIKE '%deslig%' OR p.prosrc ILIKE '%indeniza%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o desligamento não conversa com os períodos de férias — nenhuma '
             || 'função apura vencidas + proporcionais + 1/3 na rescisão (arts. 146-148; '
             || 'Súmula 171). Colaborador desligado com período vencido sai sem a verba '
             || 'calculada e os períodos ficam abertos para sempre no módulo. Mesma lacuna do '
             || 'banco de horas na rescisão (PONTO-173): a saída do colaborador precisa '
             || 'liquidar os dois. Correção: gatilho de desligamento que fecha os períodos '
             || 'como indenizados, com memória e vínculo ao termo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Liquidação presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-091 — dois vínculos: períodos segregados
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_091()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6191);
        v_colidiu boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Abrir o MESMO período aquisitivo do MESMO CPF em duas empresas (dois vínculos)';
  r.esperado := 'Dois relógios independentes — contratos são autônomos entre si';
  INSERT INTO public.ferias_periodos_aquisitivos
    (tenant_id, empresa_id, colaborador_cpf, colaborador_nome, data_admissao,
     aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados, fonte_faltas,
     dias_direito, dias_saldo, faltas_consideradas, status, origem)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), v_cpf, 'QA Dois Vínculos F',
          CURRENT_DATE - 400, CURRENT_DATE - 395, CURRENT_DATE - 30,
          0, 0, 'carga', 30, 30, 0, 'ativo', 'sistema');
  BEGIN
    INSERT INTO public.ferias_periodos_aquisitivos
      (tenant_id, empresa_id, colaborador_cpf, colaborador_nome, data_admissao,
       aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados, fonte_faltas,
       dias_direito, dias_saldo, faltas_consideradas, status, origem)
    VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), v_cpf, 'QA Dois Vínculos F',
            CURRENT_DATE - 400, CURRENT_DATE - 395, CURRENT_DATE - 30,
            0, 0, 'carga', 30, 30, 0, 'ativo', 'sistema');
  EXCEPTION WHEN unique_violation THEN
    v_colidiu := true;
  END;

  IF v_colidiu THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO ESTRUTURAL (mesma raiz do PONTO-394): o período aquisitivo é chaveado '
             || 'por (tenant, CPF, início) — a constraint ferias_periodo_unico ignora a '
             || 'empresa/vínculo, mesmo com a coluna empresa_id existindo na tabela. Dois '
             || 'contratos do mesmo CPF admitidos na mesma época COLIDEM: o segundo vínculo '
             || 'não consegue ter o próprio relógio de férias. Correção: incluir o vínculo na '
             || 'chave (tenant, empresa, CPF, início) e propagar a segregação para programação '
             || 'e solicitações.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Cada vínculo abriu o próprio período — relógios independentes.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('FERIAS-005','qa_caso_ferias_005',true), ('FERIAS-006','qa_caso_ferias_006',true),
  ('FERIAS-007','qa_caso_ferias_007',true), ('FERIAS-008','qa_caso_ferias_008',true),
  ('FERIAS-017','qa_caso_ferias_017',true), ('FERIAS-022','qa_caso_ferias_022',true),
  ('FERIAS-024','qa_caso_ferias_024',true), ('FERIAS-033','qa_caso_ferias_033',true),
  ('FERIAS-034','qa_caso_ferias_034',true), ('FERIAS-035','qa_caso_ferias_035',true),
  ('FERIAS-054','qa_caso_ferias_054',true), ('FERIAS-055','qa_caso_ferias_055',true),
  ('FERIAS-056','qa_caso_ferias_056',true), ('FERIAS-062','qa_caso_ferias_062',true),
  ('FERIAS-080','qa_caso_ferias_080',true), ('FERIAS-081','qa_caso_ferias_081',true),
  ('FERIAS-082','qa_caso_ferias_082',true), ('FERIAS-090','qa_caso_ferias_090',true),
  ('FERIAS-091','qa_caso_ferias_091',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
