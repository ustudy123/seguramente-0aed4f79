-- ============================================================================
-- QA ESC — rotinas dos casos da análise de requisitos YE-DP-ESC-001
-- (ESC-001..031, documentados em 20260821120000). 7 casos de nível 'api'
-- ganham rotina; ESC-030 (extrato no portal) é de tela e fica para o Cypress.
--
-- Padrão da casa: sondas de escrita no sandbox (qa_modo_ligar) + auditorias
-- somente leitura em pg_proc/pg_constraint/information_schema. Divergência
-- com a norma/documento = falha proposital com diagnóstico e correção
-- sugerida. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- ESC-001 — 12x36 exige acordo formal
CREATE OR REPLACE FUNCTION public.qa_caso_esc_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_id uuid; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Criar escala 12x36 ATIVA sem nenhum acordo anexado';
  r.esperado := 'Bloqueio ou pendência de formalização (art. 59-A) — nunca silêncio';
  INSERT INTO public.ponto_escalas
    (tenant_id, nome, tipo, ciclo_horas_trabalho, ciclo_horas_descanso, ativa)
  VALUES (v_t, 'QA — 12x36 sem acordo', '12x36', 12, 36, true)
  RETURNING id INTO v_id;
  INSERT INTO public.ponto_escala_atribuicoes
    (tenant_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf, data_inicio, ativa)
  VALUES (v_t, v_id, gen_random_uuid(), 'QA Colaborador Esc Um', public.qa_cpf(61), CURRENT_DATE, true);

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguém exige acordo_individual_url/cct_act_url quando a escala é 12x36?';
  r.esperado := 'Validação na criação/atribuição, com pendência enquanto o acordo não é arquivado';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%acordo_individual_url%' OR p.prosrc ILIKE '%cct_act_url%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a 12x36 nasceu ativa, foi atribuída a um colaborador e NADA cobrou '
             || 'o acordo — os campos existem (acordo_individual_url, cct_act_url) e '
             || 'nenhuma função os lê: são pastas vazias que ninguém confere. O art. 59-A '
             || 'condiciona a 12x36 a acordo individual ESCRITO, ACT ou CCT; sem a '
             || 'formalização, a jornada é inválida e toda hora além da 8ª vira extra com '
             || 'reflexos, do período inteiro — o passivo clássico da escala. A apuração do '
             || 'ciclo funciona (PONTO-150/151), o que agrava: o sistema apura direitinho '
             || 'uma escala juridicamente inexistente. Correção: pendência de formalização '
             || 'na criação/atribuição de 12x36 sem acordo anexado, com o documento '
             || 'arquivado no módulo Documentos (RF-003/RN-014).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Formalização cobrada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ESC-010 — atestado >15 dias encaminha a Afastamentos
CREATE OR REPLACE FUNCTION public.qa_caso_esc_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(62); v_afast_vinc uuid; v_afast_novo int; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar atestado de 20 dias e conferir se o Afastamento nasce';
  r.esperado := 'Empresa abona 15; do 16º dia em diante, afastamento previdenciário criado/encaminhado, sem duplicar';
  INSERT INTO public.atestados
    (tenant_id, colaborador_nome, colaborador_cpf, tipo, data_emissao,
     profissional_nome, profissional_registro,
     data_inicio_afastamento, data_fim_afastamento, dias_afastamento)
  VALUES (v_t, 'QA Colaborador Esc Dois', v_cpf, 'assistencial', CURRENT_DATE,
          'QA Dr. Sonda', 'CRM-QA-0001',
          CURRENT_DATE, CURRENT_DATE + 19, 20)
  RETURNING afastamento_id INTO v_afast_vinc;

  SELECT count(*) INTO v_afast_novo FROM public.afastamentos a
  WHERE a.tenant_id = v_t AND a.colaborador_cpf = v_cpf;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguma função cria/encaminha afastamento a partir do atestado longo?';
  r.esperado := 'Ponte automática atestado→Afastamentos no 16º dia';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%atestado%' AND p.prosrc ILIKE '%INSERT INTO%afastamentos%';

  IF v_afast_vinc IS NULL AND v_afast_novo = 0 AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o atestado de 20 dias entrou e NENHUM afastamento nasceu — '
             || 'afastamento_id ficou nulo, a tabela afastamentos não ganhou linha e não '
             || 'existe função que faça a ponte. O gatilho do atestado (trg_consolida_'
             || 'atestado) só reconsolida o ponto dos dias; a passagem de bastão do 16º '
             || 'dia (Lei 8.213, arts. 59-60 — empresa paga 15, INSS assume dali) depende '
             || 'de alguém LEMBRAR de abrir o afastamento noutro módulo. Esquecer é perder '
             || 'o encaminhamento do benefício e seguir "abonando" por conta da empresa o '
             || 'que é do INSS. A inteligência do lado dos Afastamentos existe e funciona '
             || '(AFAST-020..022) — falta o afluente. Correção: atestado com período >15 '
             || 'dias cria/encaminha o afastamento vinculado (afastamento_id), uma única '
             || 'vez, com alerta ao DP.';
  ELSIF v_afast_vinc IS NOT NULL OR v_afast_novo > 0 THEN
    r.situacao := 'passou';
    r.obtido := format('Afastamento criado/vinculado a partir do atestado (vínculo: %s; novos: %s).',
                       coalesce(v_afast_vinc::text, '—'), v_afast_novo);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ESC-011 — atestados sobrepostos
CREATE OR REPLACE FUNCTION public.qa_caso_esc_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(63); v_qtd int; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar dois atestados com períodos sobrepostos para o mesmo CPF';
  r.esperado := 'Sobreposição detectada e sinalizada — o mesmo dia não abona duas vezes';
  INSERT INTO public.atestados
    (tenant_id, colaborador_nome, colaborador_cpf, tipo, data_emissao,
     profissional_nome, profissional_registro,
     data_inicio_afastamento, data_fim_afastamento, dias_afastamento)
  VALUES (v_t, 'QA Colaborador Esc Três', v_cpf, 'assistencial', CURRENT_DATE - 12,
          'QA Dr. Sonda', 'CRM-QA-0002', CURRENT_DATE - 12, CURRENT_DATE - 3, 10);
  BEGIN
    INSERT INTO public.atestados
      (tenant_id, colaborador_nome, colaborador_cpf, tipo, data_emissao,
       profissional_nome, profissional_registro,
       data_inicio_afastamento, data_fim_afastamento, dias_afastamento)
    VALUES (v_t, 'QA Colaborador Esc Três', v_cpf, 'assistencial', CURRENT_DATE - 8,
            'QA Dr. Sonda B', 'CRM-QA-0003', CURRENT_DATE - 8, CURRENT_DATE - 1, 8);
  EXCEPTION WHEN check_violation OR exclusion_violation OR raise_exception THEN
    r.situacao := 'passou';
    r.obtido := format('Atestado sobreposto foi recusado/sinalizado (%s).', SQLERRM);
    RETURN r;
  END;
  SELECT count(*) INTO v_qtd FROM public.atestados a
  WHERE a.tenant_id = v_t AND a.colaborador_cpf = v_cpf;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguma função detecta sobreposição de períodos de atestado?';
  r.esperado := 'Detecção na entrada, mantendo o tratamento mais favorável';
  -- "sobrepoe" aparece em comentário de apuração (fallback de jornada) —
  -- detecção de verdade fala em sobreposição/sobreposto e olha a tabela atestados
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%atestados%'
    AND (p.prosrc ILIKE '%sobreposi%' OR p.prosrc ILIKE '%sobreposto%' OR p.prosrc ILIKE '%overlap%');

  IF v_qtd >= 2 AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os dois atestados sobrepostos (6 dias em comum) entraram como '
             || 'registros independentes — sem constraint, gatilho ou função que detecte '
             || 'a sobreposição. A apuração diária do ponto até se salva (o EXISTS por '
             || 'data conta o dia uma vez), mas tudo que SOMA por atestado dobra: '
             || 'dias_afastamento acumulados, a régua dos 15 dias (o 16º dia do INSS '
             || 'calculado sobre dias somados em dobro) e os indicadores de absenteísmo. '
             || 'E o mesmo documento reenviado passa como atestado novo, sem ninguém ser '
             || 'avisado. Nos afastamentos a regra de não-sobreposição existe '
             || '(AFAST-011) — nos atestados, não. Correção: detecção na entrada (período '
             || '× CPF), sinalização para o DP decidir e contagem de dias única — cada '
             || 'dia doente conta uma vez.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Sobreposição tratada (registros: %s; detecção: %s).',
                       v_qtd, coalesce(v_fns, 'na gravação'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ESC-012 — ausência do art. 473 sem documento
CREATE OR REPLACE FUNCTION public.qa_caso_esc_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_flag text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem cobra o anexo quando a justificativa o exige?';
  r.esperado := 'Justificativa com requer_anexo sem documento fica pendente — não abona nem desconta às cegas';
  v_flag := public.qa_col_existe('ponto_justificativas', 'requer_anexo');
  -- listar_justificativas_externo só EXIBE a flag e
  -- ponto_auditoria_ajustes_motivo apenas RELATA quantos ajustes ficaram sem
  -- anexo; cobrança de verdade valida ao justificar ou mantém pendência com prazo
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT IN ('listar_justificativas_externo', 'seed_justificativas_padrao',
                          'ponto_auditoria_ajustes_motivo')
    AND p.prosrc ILIKE '%requer_anexo%';

  IF v_flag IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (a pergunta existe, a cobrança não): ponto_justificativas tem '
             || 'requer_anexo, a tela recebe a flag (listar_justificativas_externo) e o '
             || 'relatório de auditoria até CONTA os ajustes sem anexo '
             || '(ponto_auditoria_ajustes_motivo) — mas nada IMPEDE o abono sem documento, '
             || 'nada mantém a pendência com prazo de comprovação, nada alerta antes do '
             || 'desconto. O art. 473 abona MEDIANTE comprovação: sem o documento, abonar '
             || 'é abrir mão de prova; descontar às cegas é descontar direito líquido '
             || '(certidão que chega depois). O rol e os prazos já têm dono (AFAST-050) — '
             || 'falta o fluxo da pendência. Correção: justificativa com requer_anexo e '
             || 'sem documento fica "pendente de comprovação" com prazo [VAL]; alerta ao '
             || 'colaborador e ao DP antes de virar desconto; documento arquivado no '
             || 'módulo Documentos preserva o DSR da semana.';
  ELSIF v_flag IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A flag requer_anexo não existe mais em ponto_justificativas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Anexo cobrado por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ESC-020 — troca de turno com aprovação e recálculo
CREATE OR REPLACE FUNCTION public.qa_caso_esc_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de troca de turno (solicitação, aprovação, recálculo)?';
  r.esperado := 'Troca registrada com aprovação e reflexos recalculados para os dois envolvidos';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%troca%turno%' OR table_name ILIKE '%turno%troca%'
         OR table_name ILIKE 'ponto%troca%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ponto_escala_atribuicoes%' AND p.prosrc ILIKE '%troca%';

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não há estrutura de troca de turno — nenhuma tabela de '
             || 'solicitação/aprovação, nenhuma função que troque atribuições em par. Na '
             || 'prática a troca vira edição manual de duas linhas de '
             || 'ponto_escala_atribuicoes: sem aprovação do gestor, sem registro de quem '
             || 'trocou com quem e — o ponto jurídico — sem recálculo da interjornada de '
             || '11h e dos adicionais dos DOIS envolvidos (o rapaz que sai do turno do dia '
             || 'e pega o noturno de amanhã pode estar violando o art. 66 por boa '
             || 'vontade). Correção: fluxo de troca como transação (solicita → aprova → '
             || 'efetiva) preservando o histórico de vigência (PONTO-152) e simulando '
             || 'interjornada/adicionais ANTES de consumar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de troca presente (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ESC-021 — cobertura de escala
CREATE OR REPLACE FUNCTION public.qa_caso_esc_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algum motor cruza atribuições × afastamentos para apontar turno descoberto?';
  r.esperado := 'Turno previsto sem colaborador disponível vira alerta ao gestor antes do dia';
  -- "cobertura de ponto" (apuração de férias) e "faltas descobertas" são
  -- outra coisa; o radar de escala fala de cobertura/descoberto DE TURNO
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%turno%'
    AND (p.prosrc ILIKE '%cobertura%' OR p.prosrc ILIKE '%descobert%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o radar de cobertura não existe — nenhuma função cruza as '
             || 'atribuições de escala com afastamentos, férias ou desligamentos para '
             || 'apontar o turno que vai ficar vazio. O sistema TEM todos os ingredientes '
             || '(ponto_escala_atribuicoes com vigência, afastamentos com período, férias '
             || 'aprovadas) e não os junta: o gestor descobre o buraco com o posto vazio, '
             || 'e a solução de última hora costuma ser dobra de turno — que estoura '
             || 'interjornada e HE (justamente o que PONTO-080/092 vigiam). Correção: '
             || 'rotina que projeta os próximos turnos por escala e acusa os descobertos, '
             || 'com alerta ao gestor e ação de cobertura no Plano de Ação (seção 15 do '
             || 'documento).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cobertura vigiada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ESC-031 — revezamento de 6 horas
CREATE OR REPLACE FUNCTION public.qa_caso_esc_031()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_mods text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o revezamento existe como conceito e alguém valida as 6 horas?';
  r.esperado := 'Escala de revezamento acima de 6h exige instrumento coletivo (CF art. 7º, XIV)';
  SELECT pg_get_constraintdef(oid) INTO v_mods
  FROM pg_constraint
  WHERE conrelid = 'public.ponto_escalas'::regclass
    AND conname = 'ponto_escalas_modalidade_check';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%revezamento%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o turno ininterrupto de revezamento não existe como '
             || 'conceito no motor — a modalidade da escala só conhece %s, nenhuma função '
             || 'menciona revezamento e, portanto, nada valida a jornada constitucional de '
             || '6 HORAS (CF art. 7º, XIV; ampliável a 8h só por negociação coletiva). Uma '
             || 'indústria em 3 turnos alternados cadastrada como escala comum de 8h roda '
             || 'sem protesto — e a 7ª e a 8ª hora de TODOS os turnos viram extra em juízo, '
             || 'do período inteiro. Correção: tipificar o revezamento no cadastro; acima '
             || 'de 6h de jornada, exigir o instrumento coletivo anexado (o mesmo fio do '
             || 'ESC-001), registrando o fundamento.',
             coalesce(v_mods, '(constraint de modalidade ausente)'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Revezamento tratado por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Registro no motor ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('ESC-001', 'qa_caso_esc_001'),
  ('ESC-010', 'qa_caso_esc_010'),
  ('ESC-011', 'qa_caso_esc_011'),
  ('ESC-012', 'qa_caso_esc_012'),
  ('ESC-020', 'qa_caso_esc_020'),
  ('ESC-021', 'qa_caso_esc_021'),
  ('ESC-031', 'qa_caso_esc_031')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql;

DO $fim$
BEGIN
  RAISE NOTICE 'QA ESC: 7 rotinas registradas (ESC-001..031). ESC-030 é de tela (Cypress).';
END $fim$;
