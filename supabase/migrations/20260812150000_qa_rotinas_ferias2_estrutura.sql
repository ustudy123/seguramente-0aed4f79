-- ============================================================================
-- QA — Grupo 2 (final): rotinas da 2ª leva de Férias (17 casos) e dos casos
-- avulsos de Estrutura Organizacional (EMP/ENQ/DESL/COLAB/ADM — 14 casos).
-- Mesmo padrão das levas anteriores: comportamento exigido pela lei/documento;
-- estrutura ausente vira falha proposital com diagnóstico. Nada é alterado.
-- ============================================================================

-- ══════════════════════════ FÉRIAS — 2ª LEVA ══════════════════════════

-- FERIAS-003 — afastamento longo reinicia o aquisitivo (art. 133)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_olha boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o recálculo do período aquisitivo consulta os afastamentos?';
  r.esperado := 'Benefício previdenciário > 6 meses e licença > 30 dias zeram o aquisitivo (art. 133)';
  SELECT bool_or(p.prosrc ILIKE '%afastament%') INTO v_olha
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('ferias_recalcular_periodo', 'ferias_recalcular_empresa');
  IF NOT coalesce(v_olha, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o recálculo de férias não consulta o módulo de Afastamentos — as '
             || 'hipóteses do art. 133 (benefício previdenciário por mais de 6 meses, licença '
             || 'remunerada acima de 30 dias, paralisação > 30 dias) nunca zeram o período '
             || 'aquisitivo. Colaborador que passou 8 meses no INSS volta com o aquisitivo '
             || 'contando como se nada houvesse. Correção: cruzar afastamentos no recálculo, '
             || 'reiniciando o aquisitivo com a origem registrada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O recálculo consulta os afastamentos.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-004 — dois aquisitivos abertos: baixa o mais antigo primeiro
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6004); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Dois Períodos', 0, CURRENT_DATE - 400);
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Dois Períodos', 0, CURRENT_DATE - 30);

  r.passo_ordem := 1;
  r.passo_acao := 'Com dois aquisitivos em aberto (um vencendo!), programar férias contra o MAIS NOVO';
  r.esperado := 'Recusado ou alertado — o período antigo é o que vira dobra se vencer';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome,
       aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Dois Períodos',
            CURRENT_DATE - 395, CURRENT_DATE - 30,
            CURRENT_DATE + 40, CURRENT_DATE + 69, 30, false, 0, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: com o período ANTIGO a caminho da dobra, o banco aceitou programação '
             || 'contra o período NOVO sem recusa nem alerta — nada prioriza a baixa do '
             || 'aquisitivo mais antigo (a programação nem referencia formalmente qual período '
             || 'baixa: os campos aquisitivo_inicio/fim são texto livre, sem FK). É o erro '
             || 'mais caro possível: programar contra o novo e deixar o velho vencer em dobro '
             || '(art. 137). Correção: vínculo formal programação → período aquisitivo + '
             || 'trava/alerta priorizando o mais antigo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A programação contra o período novo foi recusada/alertada com o antigo em aberto.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-010 — fracionar 14+11+5 com concordância registrada
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6010);
        v_aceitou boolean := false; v_concord text;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Fraciona OK', 0, CURRENT_DATE - 30);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar a composição LEGAL 14+11+5 (art. 134, §1º)';
  r.esperado := 'Aceita — e com a concordância do empregado registrada como evidência';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias,
       p3_inicio, p3_fim, p3_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Fraciona OK',
            CURRENT_DATE - 395, CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 43, 14,
            CURRENT_DATE + 90, CURRENT_DATE + 100, 11,
            CURRENT_DATE + 150, CURRENT_DATE + 154, 5,
            false, 0, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir onde fica registrada a CONCORDÂNCIA do empregado com o fracionamento';
  r.esperado := 'Campo/evidência de concordância — o §1º só permite fracionar com ela';
  v_concord := public.qa_col_existe('ferias_programacao', '%concord%');

  IF v_aceitou AND v_concord IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Composição legal aceita com evidência de concordância.';
  ELSIF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a composição válida 14+11+5 foi aceita, mas NÃO EXISTE campo de '
             || 'concordância do empregado — o art. 134, §1º só admite o fracionamento "desde '
             || 'que haja concordância", e sem a evidência registrada a empresa não prova o '
             || 'requisito em juízo. Correção: campo de concordância (quem, quando, como) '
             || 'obrigatório para programação fracionada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'A composição LEGAL 14+11+5 foi recusada — validação mais restritiva que a lei.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-016 — estudante menor de 18: coincidência com férias escolares
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_016()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o domínio de férias conhece o estudante menor de 18?';
  r.esperado := 'Sinalização do colaborador e alerta na janela de programação (art. 136, §2º)';
  v_est := coalesce(public.qa_col_existe(NULL, '%estudante%'),
                    public.qa_fns_com('%estudante%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhum campo registra a condição de estudante — o direito do menor de '
             || '18 de fazer coincidir as férias com as escolares (art. 136, §2º) não tem como '
             || 'ser sinalizado na programação. Correção: flag de estudante no cadastro + '
             || 'alerta na programação de menor de idade fora do recesso escolar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Condição de estudante presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-021 — dobra aparece sozinha no painel
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o valor em dobro do concessivo vencido é calculado por alguém?';
  r.esperado := 'No dia seguinte ao vencimento, a dobra do art. 137 aparece automaticamente';
  v_fns := public.qa_fns_com('%dobro%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (par financeiro do FERIAS-020): nenhuma função calcula a dobra do art. '
             || '137 — o concessivo vencido não vira valor em lugar algum, e o passivo só '
             || 'aparece quando alguém lembra de procurar. O painel deveria exibir o dobro '
             || 'automaticamente no dia seguinte ao vencimento: passivo visível é o que dispara '
             || 'a gestão. Correção: rotina diária que identifica concessivos vencidos e '
             || 'materializa a obrigação em dobro.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dobra calculada em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-030 — aviso por escrito 30 dias antes
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o aviso de férias (D-30) é gerado e vigiado?';
  r.esperado := 'Alerta em D-45 e aviso emitido com 30 dias, com recibo de ciência (art. 135)';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%historico%'  -- o gatilho de histórico só copia colunas
    AND p.prosrc ILIKE '%aviso_gerado%';
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o campo aviso_gerado existe na solicitação, mas NENHUMA função o '
             || 'preenche ou vigia — não há relógio do art. 135 (aviso por escrito com 30 dias '
             || 'de antecedência, mediante recibo). Sem o aviso tempestivo documentado, a '
             || 'concessão é irregular mesmo com as férias gozadas. Correção: alerta em D-45, '
             || 'emissão do aviso em D-30 via módulo de Documentos com recibo de ciência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aviso vigiado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-031 — aprovar com início em menos de 30 dias exige justificativa
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6031); v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Aprovar solicitação com início em 20 dias, sem aviso emitido e sem justificativa';
  r.esperado := 'Travado — início em menos de 30 dias significa aviso fora do prazo legal';
  BEGIN
    INSERT INTO public.ferias_solicitacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_inicio, data_fim, dias_solicitados, saldo_dias, status, aviso_gerado)
    VALUES (public.qa_sandbox_tenant_id(), public.qa_um_usuario(), 'QA Aviso Curto', v_cpf,
            CURRENT_DATE + 20, CURRENT_DATE + 49, 30, 30, 'aprovado', false);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR not_null_violation THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou solicitação APROVADA com início em 20 dias, sem aviso '
             || 'emitido e sem justificativa registrada. O art. 135 exige o aviso com 30 dias; '
             || 'a exceção operacional até pode existir, mas só com alerta aceito e '
             || 'justificativa em trilha. Correção: trava no status aprovado quando '
             || '(data_inicio - hoje) < 30 e aviso_gerado = false, com campo de justificativa '
             || 'da exceção.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A aprovação com prazo de aviso inviável foi travada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-032 — pagamento D-2 com terço automático
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a aprovação gera a obrigação financeira (D-2) com o terço?';
  r.esperado := 'Vencimento em D-2 do início (art. 145) e terço constitucional em TODOS os cálculos';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%valor_terco%' OR p.prosrc ILIKE '%registro_financeiro_id%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a solicitação tem os campos financeiros (valor_ferias, valor_terco, '
             || 'valor_total_bruto, registro_financeiro_id), mas NENHUMA função os calcula ou '
             || 'preenche — o terço constitucional (CF art. 7º, XVII) e o vencimento em D-2 '
             || '(art. 145) dependem de alguém lembrar e digitar. Pagamento fora do D-2 gera '
             || 'dobra do valor pela Súmula 450 (discussão atual no TST, mas o prazo segue '
             || 'legal). Correção: aprovação dispara o cálculo (salário base + terço, abono '
             || 'incluído) e cria a obrigação com vencimento D-2, alertando a tesouraria.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Financeiro de férias calculado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-040 — abono requerido no prazo (com carimbo do requerimento)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6040);
        v_aceitou boolean := false; v_carimbo text;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Abono Prazo', 0, CURRENT_DATE + 60);

  r.passo_ordem := 1;
  r.passo_acao := 'Requerer abono de 10 dias (1/3 de 30) faltando 60 dias para o fim do aquisitivo';
  r.esperado := 'Aceito — prazo legal respeitado (até 15 dias antes do término, art. 143, §1º)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Abono Prazo',
            CURRENT_DATE - 305, CURRENT_DATE + 60,
            CURRENT_DATE + 90, CURRENT_DATE + 109, 20, true, 10, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o carimbo de QUANDO o abono foi requerido';
  r.esperado := 'Data do requerimento registrada — sem ela não se prova o prazo do §1º';
  v_carimbo := public.qa_col_existe('ferias_programacao', '%requer%');

  IF v_aceitou AND v_carimbo IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Abono no prazo aceito, com data de requerimento registrada.';
  ELSIF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o abono dentro do prazo foi aceito, mas a programação NÃO GUARDA a '
             || 'data do requerimento — e o prazo do art. 143, §1º (até 15 dias antes do fim '
             || 'do aquisitivo) se prova exatamente por esse carimbo. Sem ele, qualquer abono '
             || 'vira discutível. Correção: data/autor do requerimento na programação '
             || '(complementa o FERIAS-041, que já apontou a falta do limite de 1/3).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'O abono legítimo (1/3, no prazo) foi recusado — validação mais restritiva que a lei.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-042 — abono fora do prazo de 15 dias fica indisponível
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_042()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6042); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Abono Tarde', 0, CURRENT_DATE + 10);

  r.passo_ordem := 1;
  r.passo_acao := 'Requerer abono faltando só 10 dias para o fim do aquisitivo (prazo legal: 15)';
  r.esperado := 'Indisponível/recusado, com explicação do prazo — não um aceite silencioso';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Abono Tarde',
            CURRENT_DATE - 355, CURRENT_DATE + 10,
            CURRENT_DATE + 30, CURRENT_DATE + 49, 20, true, 10, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o abono requerido FORA do prazo (10 dias do fim do aquisitivo; a lei '
             || 'exige requerimento até 15 dias antes — art. 143, §1º) foi aceito sem aviso. '
             || 'O empregador não é obrigado a aceitar abono extemporâneo, e aceitá-lo sem '
             || 'saber cria expectativa e passivo. Correção: validar o prazo contra o fim do '
             || 'aquisitivo e recusar com mensagem clara (ou exigir aceite expresso do '
             || 'empregador como liberalidade).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O abono fora do prazo foi recusado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-051 — cancelamento devolve saldo e deixa trilha
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_devolve boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cancelar férias aprovadas devolve os dias ao saldo?';
  r.esperado := 'Dias voltam ao período aquisitivo, alerta de vencimento reabre, trilha registra motivo';
  SELECT bool_or(p.prosrc ILIKE '%cancelad%' AND p.prosrc ILIKE '%saldo%') INTO v_devolve
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.proname ILIKE '%ferias%' OR p.prosrc ILIKE '%ferias_solicitacoes%');
  IF NOT coalesce(v_devolve, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função devolve os dias ao saldo quando a solicitação é '
             || 'cancelada — o status muda para "cancelado" e os dias ficam perdidos entre a '
             || 'solicitação e o período aquisitivo (que nem são formalmente ligados). O risco '
             || 'do concessivo também não reabre. Correção: cancelamento com motivo '
             || 'obrigatório que devolva os dias ao período, reabra o alerta de vencimento e '
             || 'registre quem/quando/por quê na trilha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O cancelamento devolve o saldo.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-052 — data confirmada só muda com justificativa
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_052()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6052); v_id uuid;
        v_mudou boolean := false;
BEGIN
  INSERT INTO public.ferias_programacao
    (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
     p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Data Firmada',
          CURRENT_DATE - 395, CURRENT_DATE - 30,
          CURRENT_DATE + 45, CURRENT_DATE + 74, 30, false, 0, false, 'confirmado')
  RETURNING id INTO v_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Alterar a data de início de uma programação CONFIRMADA, sem justificativa';
  r.esperado := 'Recusado ou exigindo justificativa — data confirmada é compromisso';
  BEGIN
    UPDATE public.ferias_programacao SET p1_inicio = CURRENT_DATE + 80, p1_fim = CURRENT_DATE + 109
    WHERE id = v_id;
    v_mudou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_mudou := false; END;

  IF v_mudou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a data de férias CONFIRMADAS mudou silenciosamente — sem justificativa '
             || 'obrigatória, sem alçada. O histórico até registra a mudança (gatilho de '
             || 'histórico existe), mas registrar não é o mesmo que exigir motivo: a alteração '
             || 'unilateral de data confirmada é a origem clássica de conflito trabalhista. '
             || 'Correção: a partir do estado confirmado, alteração de data exige campo de '
             || 'justificativa preenchido e registra o autor.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A alteração sem justificativa foi recusada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-053 — em gozo bloqueia o ponto
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_053()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text; v_marcou boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Em Gozo', 6053);
  INSERT INTO public.ferias_solicitacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_inicio, data_fim, dias_solicitados, saldo_dias, status)
  VALUES (public.qa_sandbox_tenant_id(), public.qa_um_usuario(), 'QA Em Gozo', v_cpf,
          CURRENT_DATE - 5, CURRENT_DATE + 10, 16, 30, 'em_gozo');

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar marcar ponto DURANTE férias em gozo';
  r.esperado := 'Recusado — férias suspendem a prestação de serviço, como o afastamento';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Em Gozo', CURRENT_DATE, TIME '08:00', 'entrada');
    v_marcou := true;
  EXCEPTION WHEN OTHERS THEN v_marcou := false; END;

  IF v_marcou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o colaborador EM FÉRIAS marcou ponto normalmente. O validador de '
             || 'marcação só consulta a tabela de afastamentos — férias em gozo não bloqueiam '
             || 'nada (a ponte férias→afastamentos não existe). Trabalho registrado durante as '
             || 'férias é indício de férias não gozadas: passivo em dobro. Correção: o '
             || 'validador de marcação também consultar ferias_solicitacoes em_gozo (ou o '
             || 'início do gozo gerar afastamento automático).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A marcação durante o gozo foi recusada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-060/061 — férias coletivas
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): férias coletivas existem como fluxo próprio?';
  r.esperado := 'Até 2 períodos/ano, mínimo de 10 dias, comunicações ao MTE/sindicato/empregados (art. 139-141)';
  v_est := coalesce(public.qa_col_existe(NULL, '%coletiv%'), public.qa_fns_com('%ferias%coletiv%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: férias coletivas não existem no sistema — nem estrutura, nem fluxo. '
             || 'Empresa que parar em dezembro terá de lançar férias individuais uma a uma, '
             || 'sem os comunicados obrigatórios ao órgão do Ministério do Trabalho e ao '
             || 'sindicato com 15 dias de antecedência (art. 139, §§2º-3º) e sem o controle '
             || 'de 2 períodos/ano com mínimo de 10 dias. Correção: fluxo coletivo por '
             || 'empresa/setor gerando as programações individuais e os comunicados.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de coletivas presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ferias_061()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os limites das coletivas (mínimo 10 dias, máx. 2 períodos) têm onde ser validados?';
  r.esperado := 'Período coletivo < 10 dias corridos bloqueado; 3º período no ano bloqueado (art. 139, §1º)';
  v_est := coalesce(public.qa_col_existe(NULL, '%coletiv%'), public.qa_fns_com('%ferias%coletiv%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem a estrutura de coletivas (FERIAS-060), os limites do art. 139, '
             || '§1º — nenhum período menor que 10 dias corridos, no máximo 2 períodos anuais '
             || '— não têm onde ser validados. Quando o fluxo nascer, estas duas travas nascem '
             || 'junto (CHECK no período e contagem anual por empresa).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (validar os limites): %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-070 — encargos por enquadramento (Simples Anexo III × IV)
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o parâmetro de dispensa patronal do Simples é usado no cálculo?';
  r.esperado := 'Provisão distingue Anexo III (sem patronal, mantém FGTS) de Anexo IV (com patronal)';
  v_fns := public.qa_fns_com('%simples_dispensa%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o parâmetro existe (ferias_config.simples_dispensa_patronal), mas '
             || 'NENHUMA função o consome — não há cálculo de encargos de férias que distinga '
             || 'Simples Anexo III (dispensa a contribuição patronal, mantém FGTS) do Anexo IV '
             || '(recolhe). A provisão sai errada para um dos dois grupos. Correção: memória '
             || 'de cálculo dos encargos lendo o enquadramento do cadastro da empresa.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Encargos por enquadramento em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- FERIAS-071 — cobertura operacional da equipe
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_071()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): programar demais gente do mesmo time gera alerta de cobertura?';
  r.esperado := 'Limite parametrizado (ex.: 20% simultâneos) com alerta informativo — não bloqueio';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%cobertura%'
    AND (p.prosrc ILIKE '%equipe%' OR p.prosrc ILIKE '%departamento%' OR p.prosrc ILIKE '%simultan%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe verificação de cobertura — programar 40% de um departamento '
             || 'no mesmo mês passa sem aviso. É informação de gestão (a época das férias é '
             || 'prerrogativa do empregador, art. 136), então o desenho certo é ALERTA com '
             || 'mapa de calor, nunca bloqueio. Correção: parâmetro de % máximo simultâneo por '
             || 'departamento com alerta na programação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cobertura verificada em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══════════════════════ ESTRUTURA ORGANIZACIONAL ══════════════════════

-- EMP-050 — total de empregados vem da contagem real
CREATE OR REPLACE FUNCTION public.qa_caso_emp_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_conta boolean; v_trigger boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o total de empregados é derivado dos vínculos ativos?';
  r.esperado := 'total_colaboradores calculado da contagem real, atualizado por movimentação';
  SELECT bool_or(p.prosrc ILIKE '%admissoes%') INTO v_conta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recalcular_cota_pcd';
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.admissoes'::regclass AND NOT t.tgisinternal
      AND (p.proname ILIKE '%cota%' OR p.prosrc ILIKE '%total_colaboradores%'
           OR p.prosrc ILIKE '%recalcular_cota%')
  ) INTO v_trigger;

  IF coalesce(v_conta, false) AND v_trigger THEN
    r.situacao := 'passou';
    r.obtido := 'O recálculo conta os vínculos reais e dispara nas movimentações de admissão.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o total de empregados ainda depende de digitação — o recálculo '
             || 'de cota %s conta de admissões e %s gatilho nas movimentações. Enquanto '
             || 'empresa_cadastro.total_colaboradores for número digitado, toda régua legal '
             || 'baseada em headcount (cota PcD, CIPA, SESMT, obrigatoriedade de ponto) herda '
             || 'o erro de digitação. Correção: derivar da contagem de vínculos ativos.',
             CASE WHEN coalesce(v_conta,false) THEN 'JÁ' ELSE 'NÃO' END,
             CASE WHEN v_trigger THEN 'tem' ELSE 'NÃO tem' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EMP-051 — admissão e demissão recalculam a cota
CREATE OR REPLACE FUNCTION public.qa_caso_emp_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_emp uuid; v_antes int; v_depois int;
BEGIN
  v_emp := public.qa_empresa_com_cota('QA Cota Movimento', '19.131.243/0001-97', 100, NULL, NULL, NULL);
  SELECT total_colaboradores INTO v_antes FROM public.empresa_cadastro WHERE id = v_emp;

  r.passo_ordem := 1;
  r.passo_acao := 'Admitir um colaborador na empresa e conferir se o total/cota reagiu';
  r.esperado := 'A movimentação recalcula o total e a cota PcD automaticamente';
  PERFORM public.qa_ponto_admissao('QA Cota Movimento Colab', 7051, v_emp);
  SELECT total_colaboradores INTO v_depois FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_depois IS DISTINCT FROM v_antes THEN
    r.situacao := 'passou';
    r.obtido := format('A admissão recalculou o total (%s → %s) — a cota acompanha a movimentação.',
                       coalesce(v_antes::text,'-'), coalesce(v_depois::text,'-'));
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: admitir um colaborador NÃO mexeu no total da empresa (segue %s). '
             || 'A cota PcD da Lei 8.213/91 muda de faixa exatamente nas movimentações '
             || '(100→101 empregados muda a exigência) — sem recálculo automático, a empresa '
             || 'cruza a faixa sem saber. Correção: gatilho de admissão/desligamento '
             || 'recalculando total e cota.', coalesce(v_antes::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EMP-052 — só PcD com documentação válida conta
CREATE OR REPLACE FUNCTION public.qa_caso_emp_052()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_laudo text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a contagem de PcD tem lastro documental (laudo válido)?';
  r.esperado := 'Só contam PcDs com laudo dentro do prazo, ligados a pessoas reais';
  v_laudo := public.qa_col_existe(NULL, '%laudo%');
  IF v_laudo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe laudo em lugar nenhum do banco — pcd_quantidade_atual é um '
             || 'número sem ligação com pessoas nem com documentos. Na fiscalização, o que '
             || 'vale é o laudo caracterizador válido de cada PcD; um contador solto não '
             || 'sustenta a cota da Lei 8.213/91. Correção: marcação de PcD no vínculo com o '
             || 'laudo anexado e vigência, e a contagem derivando daí.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Lastro documental presente: %s.', v_laudo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EMP-053 — reabilitados do INSS contam para a cota
CREATE OR REPLACE FUNCTION public.qa_caso_emp_053()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a categoria "reabilitado do INSS" existe?';
  r.esperado := 'A Lei 8.213/91 admite na cota PcDs E beneficiários reabilitados — categorias distintas';
  v_est := coalesce(public.qa_col_existe(NULL, '%reabilitad%'), public.qa_fns_com('%reabilitad%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o sistema não conhece o beneficiário reabilitado do INSS — só "PcD". '
             || 'A Lei 8.213/91, art. 93, manda preencher a cota com as DUAS categorias; '
             || 'empresa com reabilitados no quadro não consegue computá-los e aparenta '
             || 'déficit que não tem. Correção: categoria própria no vínculo, somada na cota.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Categoria presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;;

-- EMP-054 — cota sobre o total da empresa, não por filial
CREATE OR REPLACE FUNCTION public.qa_caso_emp_054()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_agrupa boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o recálculo de cota agrupa matriz e filiais?';
  r.esperado := 'Cota apurada sobre o total da pessoa jurídica (todos os estabelecimentos somados)';
  SELECT bool_or(p.prosrc ILIKE '%matriz%' OR p.prosrc ILIKE '%raiz%' OR p.prosrc ILIKE '%filia%')
    INTO v_agrupa
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recalcular_cota_pcd';
  IF NOT coalesce(v_agrupa, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o recálculo de cota trata cada cadastro isoladamente — não agrupa '
             || 'matriz e filiais pela raiz do CNPJ. A cota da Lei 8.213/91 é da EMPRESA '
             || '(pessoa jurídica inteira): três filiais de 40 empregados não devem 0+0+0, '
             || 'devem a cota de 120. Correção: apuração agrupada pela raiz do CNPJ, com a '
             || 'exigência exibida no grupo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O recálculo agrupa os estabelecimentos da mesma pessoa jurídica.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ENQ-050 — SESMT vem do dimensionamento (NR-04)
CREATE OR REPLACE FUNCTION public.qa_caso_enq_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): sesmt_obrigatorio é derivado de grau de risco × empregados?';
  r.esperado := 'A NR-04 dimensiona deterministicamente; os dois insumos já estão no cadastro';
  v_fns := public.qa_fns_com('%sesmt_obrigatorio%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sesmt_obrigatorio é um interruptor manual — nenhuma função o deriva do '
             || 'cruzamento grau de risco × número de empregados (Quadro II da NR-04), embora '
             || 'os dois dados já existam no cadastro. Quem preenche errado carrega o '
             || 'enquadramento errado para todo o compliance. Correção: cálculo determinístico '
             || 'com o quadro da NR-04 parametrizado, mantendo o manual só como exceção '
             || 'justificada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dimensionamento presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ENQ-051 — CIPA vem do Quadro I da NR-05
CREATE OR REPLACE FUNCTION public.qa_caso_enq_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cipa_obrigatoria é derivada de CNAE × empregados?';
  r.esperado := 'A NR-05 dimensiona pelo Quadro I; switch manual é fonte de erro';
  v_fns := public.qa_fns_com('%cipa_obrigatoria%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: cipa_obrigatoria é switch manual — nenhuma função aplica o Quadro I '
             || 'da NR-05 (dimensionamento por CNAE × número de empregados). Mesmo padrão do '
             || 'SESMT (ENQ-050): dado derivável tratado como digitação. Correção: '
             || 'dimensionamento automático com o quadro parametrizado por vigência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dimensionamento presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-013 — desligamento programado com data futura
CREATE OR REPLACE FUNCTION public.qa_caso_desl_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tem_estado boolean; v_col text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe o estado "desligamento programado" (data futura)?';
  r.esperado := 'Aviso prévio trabalhado projeta o término para o futuro — registro ≠ efetivação';
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'admissao_status' AND e.enumlabel ILIKE '%program%'
  ) INTO v_tem_estado;
  v_col := public.qa_col_existe('admissoes', '%data_deslig%');

  IF NOT v_tem_estado THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: não existe o estado intermediário "desligamento programado" — o '
             || 'vínculo vai direto de ativo para desligado%s. No aviso prévio trabalhado, o '
             || 'contrato segue vivo por até 30 dias após o registro: o colaborador ainda '
             || 'marca ponto, acumula férias e só na DATA é efetivado. Sem o estado, ou se '
             || 'desliga antecipado (corta acesso de quem ainda trabalha) ou se registra '
             || 'depois (perde o aviso). Correção: estado programado com data futura e '
             || 'efetivação automática na data.',
             CASE WHEN v_col IS NULL THEN ' e nem data de desligamento futura há onde guardar' ELSE '' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O estado de desligamento programado existe.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-074 — estabilidade pré-aposentadoria por CCT
CREATE OR REPLACE FUNCTION public.qa_caso_desl_074()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cct boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as estabilidades conhecem cláusulas de CCT?';
  r.esperado := 'Estabilidade pré-aposentadoria vem da CCT (período/condições variam por categoria)';
  SELECT bool_or(p.prosrc ILIKE '%cct%' OR p.prosrc ILIKE '%convencao%' OR p.prosrc ILIKE '%coletiv%')
    INTO v_cct
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'estabilidades_vigentes';
  IF NOT coalesce(v_cct, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a verificação de estabilidades (estabilidades_vigentes) só conhece as '
             || 'hipóteses LEGAIS — não existe cadastro de cláusulas de CCT no domínio de '
             || 'desligamento (a única tabela de CCT do sistema, ponto_cct_config, guarda só '
             || 'parâmetros de jornada). A estabilidade pré-aposentadoria é tipicamente '
             || 'convencional: sem a cláusula cadastrada, o sistema não avisa e a demissão de '
             || 'um estável convencional vira reintegração. Correção: cadastro de cláusulas '
             || 'de estabilidade por CCT/categoria com vigência, somado às legais.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'As estabilidades consultam cláusulas convencionais.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- DESL-081 — homologação obrigatória por cláusula coletiva
CREATE OR REPLACE FUNCTION public.qa_caso_desl_081()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a exigência de homologação sindical tem onde ser registrada?';
  r.esperado := 'Pós-reforma, homologação só é exigível por CCT — o sistema precisa saber de qual categoria';
  v_est := public.qa_col_existe('admissoes', '%homolog%');
  IF v_est IS NOT NULL AND public.qa_fns_com('%homolog%') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO PARCIAL: os campos de registro existem (%s) — dá para ANOTAR a '
             || 'homologação feita —, mas nada torna a homologação EXIGÍVEL: nenhuma função '
             || 'verifica se a categoria do colaborador tem cláusula de CCT exigindo o rito '
             || '(mesma raiz do DESL-074: não há cadastro de cláusulas coletivas). O '
             || 'desligamento de categoria com homologação obrigatória conclui sem aviso. '
             || 'Correção: flag de exigência na cláusula da CCT/categoria, travando ou '
             || 'alertando o checklist de desligamento.', v_est);
  ELSIF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: homologação não existe no sistema — nem campo, nem verificação. '
             || 'Correção: registro + exigência por cláusula de CCT/categoria.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Homologação registrável e verificada: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- COLAB-030/031/032 — importação de planilha idempotente
CREATE OR REPLACE FUNCTION public.qa_caso_colab_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a importação de colaboradores existe como processo no banco?';
  r.esperado := 'Reimportar a mesma planilha identifica existentes e devolve a decisão — nunca duplica';
  v_est := coalesce(public.qa_fns_com('%importa%colaborador%'), public.qa_fns_com('%planilha%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a importação de colaboradores não existe como processo no banco — sem '
             || 'função de conciliação, a tela grava linha a linha e reimportar a mesma '
             || 'planilha duplicaria em silêncio (só a trava de CPF por admissão ativa segura '
             || 'parte). O desenho correto: detectar existentes pelo CPF, listar e devolver a '
             || 'decisão ao usuário (manter × substituir). Correção: função de importação com '
             || 'staging e relatório de conflitos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Processo de importação presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção "manter os dados atuais" existe na reimportação?';
  r.esperado := 'Colaborador já existente com escolha "manter" preserva o que foi alterado no sistema';
  v_est := public.qa_fns_com('%manter%colaborador%');
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem o processo de importação (COLAB-030), a escolha "manter" não '
             || 'existe. O risco que ela previne: a planilha envelhece — depois da importação '
             || 'inicial, o RH corrige dados NO SISTEMA; uma reimportação ingênua sobrescreve '
             || 'as correções com os dados velhos da planilha. "Manter" preserva o atual e '
             || 'ignora a planilha para os existentes.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Opção presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_032()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção "substituir" atualiza no lugar (UPDATE), sem recriar?';
  r.esperado := 'Substituir mantém o id da pessoa — apagar e recriar deixa todo o histórico órfão';
  v_est := public.qa_fns_com('%substitu%colaborador%');
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem o processo de importação (COLAB-030), a escolha "substituir" não '
             || 'existe — e é a mais perigosa de improvisar: se a tela um dia apagar e '
             || 'recriar, o id muda e TODO o histórico da pessoa (ponto, férias, atestados, '
             || 'documentos) vira órfão. Substituir é UPDATE no registro existente, nunca '
             || 'DELETE+INSERT. Registrado aqui para o desenho da funcionalidade nascer certo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Opção presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ADM-107 — ASO admissional é documento de saúde, não anexo genérico
CREATE OR REPLACE FUNCTION public.qa_caso_adm_107()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o ASO admissional existe como entidade de saúde própria?';
  r.esperado := 'Regime próprio de acesso, retenção e sigilo (NR-07/LGPD art. 11) — não anexo comum';
  v_est := coalesce(public.qa_col_existe(NULL, '%aso_admissional%'),
                    public.qa_fns_com('%aso%admissional%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o ASO admissional não existe como entidade — o único ASO do sistema é '
             || 'o de RETORNO de afastamento (afastamentos.aso_retorno_*). Na admissão, o ASO '
             || 'entraria como anexo genérico, com o mesmo tratamento de um comprovante de '
             || 'residência — mas é dado de SAÚDE: sigilo médico (NR-07), acesso restrito, '
             || 'retenção de 20 anos e LGPD art. 11. Correção: categoria própria de documento '
             || 'de saúde na admissão, com política de acesso restritiva e retenção '
             || 'diferenciada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('ASO admissional estruturado: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('FERIAS-003','qa_caso_ferias_003',true), ('FERIAS-004','qa_caso_ferias_004',true),
  ('FERIAS-010','qa_caso_ferias_010',true), ('FERIAS-016','qa_caso_ferias_016',true),
  ('FERIAS-021','qa_caso_ferias_021',true), ('FERIAS-030','qa_caso_ferias_030',true),
  ('FERIAS-031','qa_caso_ferias_031',true), ('FERIAS-032','qa_caso_ferias_032',true),
  ('FERIAS-040','qa_caso_ferias_040',true), ('FERIAS-042','qa_caso_ferias_042',true),
  ('FERIAS-051','qa_caso_ferias_051',true), ('FERIAS-052','qa_caso_ferias_052',true),
  ('FERIAS-053','qa_caso_ferias_053',true), ('FERIAS-060','qa_caso_ferias_060',true),
  ('FERIAS-061','qa_caso_ferias_061',true), ('FERIAS-070','qa_caso_ferias_070',true),
  ('FERIAS-071','qa_caso_ferias_071',true),
  ('EMP-050','qa_caso_emp_050',true), ('EMP-051','qa_caso_emp_051',true),
  ('EMP-052','qa_caso_emp_052',true), ('EMP-053','qa_caso_emp_053',true),
  ('EMP-054','qa_caso_emp_054',true), ('ENQ-050','qa_caso_enq_050',true),
  ('ENQ-051','qa_caso_enq_051',true), ('DESL-013','qa_caso_desl_013',true),
  ('DESL-074','qa_caso_desl_074',true), ('DESL-081','qa_caso_desl_081',true),
  ('COLAB-030','qa_caso_colab_030',true), ('COLAB-031','qa_caso_colab_031',true),
  ('COLAB-032','qa_caso_colab_032',true), ('ADM-107','qa_caso_adm_107',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
