-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 12 de 15
-- Ponto (1 de 3)
--
-- POR QUE ESTA TRILHA EXISTE
-- A bancada de testes tem tres camadas: a ROTINA (uma funcao), o CASO
-- DOCUMENTADO (linha em qa_casos_teste) e a PONTE que liga uma a outra
-- (qa_implementacoes). Rotina e estrutura; caso e ponte sao dados. As tres
-- nasceram em migrations, que so alcancam o ambiente de teste — nunca a
-- producao. Resultado medido: a producao documenta 568 casos e executa 268,
-- enquanto o projeto documenta 822 e executa 565.
--
-- Esta trilha leva as tres camadas para a producao. A homologacao herda na
-- proxima copia (as tabelas do motor de QA sao copiadas de la na integra).
--
-- GARANTIAS
--   - Idempotente: rodar duas vezes nao duplica nem quebra.
--   - NAO altera nenhuma regra de negocio. So a bancada que as verifica.
--   - Modulo resolvido pelo CAMINHO, nao pelo identificador interno (os
--     identificadores diferem entre ambientes).
--   - A ponte so e criada quando a rotina existe de fato no destino.
--   - Cada rotina entra em bloco proprio: falha de uma vira NOTICE, nao
--     aborta o arquivo.
--   - O cercado (tenant isolado onde os testes rodam) JA existe na producao —
--     esta trilha nao mexe nele, nem em dado de cliente.
-- Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) ROTINAS — 56 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_esc_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_esc_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_esc_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; m record;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Marcação Base', 5001);
  r.passo_ordem := 1;
  r.passo_acao := 'Registrar uma marcação e conferir os campos essenciais';
  r.esperado := 'Data, hora, CPF e hash presentes e coerentes';
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Marcação Base', CURRENT_DATE, TIME '08:00', 'entrada');
  SELECT * INTO m FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf
  ORDER BY created_at DESC LIMIT 1;
  IF m.data_marcacao = CURRENT_DATE AND m.hora_marcacao = TIME '08:00'
     AND m.colaborador_cpf = v_cpf AND coalesce(m.hash_marcacao, '') <> ''
     AND m.hash_marcacao <> 'qa-seed' THEN
    r.situacao := 'passou';
    r.obtido := 'Marcação gravada com data, hora, CPF e hash gerado pelo gatilho.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Campos incompletos: data=%s hora=%s cpf=%s hash=%s. A identificação '
      || 'por CPF e o carimbo íntegro são a base da Portaria 671.',
      m.data_marcacao, m.hora_marcacao, m.colaborador_cpf,
      CASE WHEN coalesce(m.hash_marcacao,'') IN ('','qa-seed') THEN 'NÃO GERADO' ELSE 'ok' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_jobs int := 0;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe rotina agendada que INSIRA marcações?';
  r.esperado := 'Nenhuma — marcação automática é vedada pela Portaria 671';
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE command ILIKE ''%ponto_marcacoes%'' AND command ILIKE ''%INSERT%'''
    INTO v_jobs;
  END IF;
  IF v_jobs = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhum agendamento insere marcações. As únicas inserções fora do gesto do '
             || 'usuário são as batidas de abono aprovadas por gestor (dia inteiro justificado), '
             || 'que carregam origem própria — não são ficção de jornada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s agendamento(s) inserem marcações automaticamente — ficção de jornada '
             || 'vedada pela Portaria 671, que destrói o valor probatório do conjunto.', v_jobs);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
  DECLARE r public.qa_retorno; v_cpf text; v_id uuid;
          v_upd boolean := false; v_del boolean := false;
  BEGIN
    v_cpf := public.qa_ponto_admissao('QA Imutável', 5004);
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Imutável', CURRENT_DATE - 1, TIME '08:00', 'entrada');
    SELECT id INTO v_id FROM public.ponto_marcacoes
    WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf LIMIT 1;

    r.passo_ordem := 1;
    r.passo_acao := 'Tentar ALTERAR a hora da marcação original';
    r.esperado := 'Bloqueado pela imutabilidade';
    BEGIN
      UPDATE public.ponto_marcacoes SET hora_marcacao = TIME '07:00' WHERE id = v_id;
      v_upd := true;
    EXCEPTION WHEN OTHERS THEN v_upd := false; END;

    r.passo_ordem := 2;
    r.passo_acao := 'Tentar APAGAR a marcação original (sem privilégio de gestor)';
    r.esperado := 'Bloqueado';
    BEGIN
      DELETE FROM public.ponto_marcacoes WHERE id = v_id;
      v_del := NOT EXISTS (SELECT 1 FROM public.ponto_marcacoes WHERE id = v_id);
    EXCEPTION WHEN OTHERS THEN v_del := false; END;

    IF NOT v_upd AND NOT v_del THEN
      r.situacao := 'passou';
      r.obtido := 'Alteração e exclusão da marcação original foram bloqueadas. A exclusão direta '
               || 'por papel de gestão foi fechada e o e-mail hardcoded de exceção foi removido. '
               || 'Risco remanescente (fora desta rotina): os RPC excluir_marcacao_ponto e '
               || 'processar_ajuste_ponto (tipo "correcao") ainda apagam a marcação original pelo '
               || 'flag de sessão app.allow_ponto_delete — correção por substituição, não por acréscimo.';
    ELSE
      r.situacao := 'falhou';
      r.obtido := format('A marcação original foi %s — registro que se altera não prova nada '
               || '(Súmula 338; Portaria 671 veda a alteração).',
               CASE WHEN v_upd AND v_del THEN 'ALTERADA E APAGADA'
                    WHEN v_upd THEN 'ALTERADA' ELSE 'APAGADA' END);
    END IF;
    RETURN r;
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
  END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5020);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_saldo int; v_status text;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Dia Completo', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Dia Completo', v_dia, 480);

  r.passo_ordem := 1;
  r.passo_acao := format('Apurar dia completo (480 min trabalhados, jornada 480) em %s', v_dia);
  r.esperado := 'Saldo zero e status regular — a régua de todos os demais casos';
  SELECT max(s.saldo_min) INTO v_saldo
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_dia, 'YYYY-MM')) s WHERE s.dia = v_dia;
  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF v_saldo = 0 AND v_status = 'regular' THEN
    r.situacao := 'passou';
    r.obtido := 'Dia completo fechou com saldo zero e status regular.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Dia completo saiu torto: saldo=%s (esperado 0), status=%s (esperado regular).',
                       coalesce(v_saldo::text, 'sem linha'), coalesce(v_status, 'NULL'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_dia date := CURRENT_DATE - 2;
        d record;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Ímpar', 5021);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Ímpar', v_dia, TIME '08:00', 'entrada', false);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Ímpar', v_dia, TIME '12:00', 'saida',   false);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Ímpar', v_dia, TIME '13:00', 'entrada', false);

  r.passo_ordem := 1;
  r.passo_acao := 'Consolidar dia com 3 marcações (entrada 08, saída 12, entrada 13 — sem saída final)';
  r.esperado := 'Só o período pareado conta (4h); dia visivelmente incompleto, sem par inventado';
  PERFORM public.consolidar_ponto_diario_manual(public.qa_sandbox_tenant_id(), v_cpf, v_dia);
  SELECT status, horas_trabalhadas INTO d FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF d.status = 'incompleto' AND d.horas_trabalhadas = INTERVAL '4 hours' THEN
    r.situacao := 'passou';
    r.obtido := 'O dia ficou incompleto com 4h (só o par fechado) — nenhuma saída foi inventada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Ímpar mal tratado: status=%s (esperado incompleto), horas=%s (esperado 4h). '
             || 'Fechar o par que falta seria CRIAR marcação — vedado pela Portaria 671.',
             coalesce(d.status, 'sem linha'), coalesce(d.horas_trabalhadas::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_dia date := CURRENT_DATE - 2;
        d record;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Meia-Noite', 5022);

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar turno 22:00 → 06:00 no dia de início e consolidar';
  r.esperado := '8 horas apuradas NO DIA DE INÍCIO — a virada não parte a jornada em duas';
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Meia-Noite', v_dia, TIME '22:00', 'entrada', false);
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Meia-Noite', v_dia, TIME '06:00', 'saida', false);
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a saída de 06:00 lançada no dia de início foi RECUSADA (%s). '
             || 'O gatilho de reordenação automática interpreta a batida da madrugada como '
             || '"anterior" à entrada de 22:00 e tenta reetiquetar — colidindo com a '
             || 'imutabilidade. Resultado: o turno que cruza a meia-noite não pode ser '
             || 'registrado no dia de início, e a jornada acaba partida em dois dias (falta '
             || 'fictícia no segundo, prorrogação noturna subdimensionada). Correção: a '
             || 'reordenação por relógio precisa reconhecer a virada (saída menor que a '
             || 'entrada = dia seguinte), como a apuração já faz.', SQLERRM);
    RETURN r;
  END;
  PERFORM public.consolidar_ponto_diario_manual(public.qa_sandbox_tenant_id(), v_cpf, v_dia);
  SELECT horas_trabalhadas, status INTO d FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF d.horas_trabalhadas = INTERVAL '8 hours' THEN
    r.situacao := 'passou';
    r.obtido := 'O turno noturno fechou 8h no dia de início — sem falta fictícia no dia seguinte.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Turno da virada apurou %s (esperado 8h, status atual %s). Partir a jornada '
             || 'em dois dias gera falta fictícia e subdimensiona a prorrogação noturna.',
             coalesce(d.horas_trabalhadas::text, 'sem linha'), coalesce(d.status, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_023()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_emp uuid; v_cpf text;
        v_dia date := public.qa_dia_util_passado();
        v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_empresa_com_ponto('[QA-PONTO] Unidade Falta Real', '11222333050231');
  v_cpf := public.qa_ponto_admissao('QA Falta Real', 5023, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s sem nenhuma marcação, em empresa que adota controle', v_dia);
  r.esperado := 'O dia vira FALTA — não dia neutro (a falta repercute no DSR)';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, public.qa_sandbox_tenant_id());
  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF v_status = 'falta' THEN
    r.situacao := 'passou';
    r.obtido := 'Dia útil sem batida materializado como falta.';
  ELSIF v_status IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o dia útil sem marcação de um colaborador que NUNCA bateu ponto ficou '
             || 'INEXISTENTE, mesmo em empresa que adota controle de jornada. Quem nunca bateu '
             || '(admitido que não compareceu, colaborador sem onboarding do app) nunca vira '
             || 'falta: é o funcionário invisível.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O dia sem marcação ficou como %s — ausência tratada como neutra esconde '
             || 'o efeito legal sobre o DSR.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_023()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_023 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_024()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_status text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Amparado', 5024);
  -- Batida em outro dia para o consolidador conseguir resolver o colaborador
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Amparado', CURRENT_DATE, TIME '08:00', 'entrada');
  INSERT INTO public.atestados
    (tenant_id, colaborador_cpf, colaborador_nome, tipo, data_emissao,
     profissional_nome, profissional_registro,
     data_inicio_afastamento, data_fim_afastamento, unidade_afastamento)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Amparado',
          'atestados', v_dia, 'Dra. QA', 'CRM-QA-0001', v_dia, v_dia, 'dias');

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar %s com atestado cobrindo o dia', v_dia);
  r.esperado := 'O dia não vira falta — ausência amparada tem regime próprio (art. 473 e afins)';
  PERFORM public.ponto_materializar_faltas(v_dia, v_dia, public.qa_sandbox_tenant_id());
  SELECT status INTO v_status FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND data = v_dia;

  IF coalesce(v_status, 'ausente') <> 'falta' THEN
    r.situacao := 'passou';
    r.obtido := format('O dia amparado por atestado não virou falta (ficou: %s).',
                       coalesce(v_status, 'sem linha — dia não materializado como falta'));
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'O dia COM ATESTADO virou falta — desconto indevido de DSR e de salário sobre '
             || 'ausência amparada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_024()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_024 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_025()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_bloqueou boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Afastado', 5025);
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_cpf, colaborador_nome, status, data_inicio, data_fim)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Afastado', 'ativo',
          CURRENT_DATE - 5, CURRENT_DATE + 5);

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar marcar ponto durante afastamento ativo';
  r.esperado := 'Recusado — na suspensão não há serviço a registrar';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Afastado', CURRENT_DATE, TIME '08:00', 'entrada');
    v_bloqueou := false;
  EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;

  IF v_bloqueou THEN
    r.situacao := 'passou';
    r.obtido := 'A marcação durante o afastamento foi recusada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'O afastado conseguiu marcar ponto — registro de serviço durante suspensão do '
             || 'contrato contamina a apuração e o eSocial.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_025()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_025 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5040);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_d1 date; v_d2 date; v_s1 int; v_s2 int;
BEGIN
  v_d1 := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_d2 := v_d1 + 1;
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Tolerância 5', 480, 10, v_d1, v_d2);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Tolerância 5', v_d1, 476);  -- 4 min a menos
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Tolerância 5', v_d2, 484);  -- 4 min a mais

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar dias com variação de 4 min para menos e para mais';
  r.esperado := 'Saldo zero nos dois — a tolerância não desconta E não paga';
  SELECT max(s.saldo_min) FILTER (WHERE s.dia = v_d1),
         max(s.saldo_min) FILTER (WHERE s.dia = v_d2) INTO v_s1, v_s2
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_d1, 'YYYY-MM')) s;

  IF v_s1 = 0 AND v_s2 = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Variação de 4 minutos absorvida nos dois sentidos — bilateral como manda o art. 58, §1º.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Tolerância mal aplicada: -4 min deu saldo %s e +4 min deu %s (esperado 0 e 0).',
                       coalesce(v_s1::text, '-'), coalesce(v_s2::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5041);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_d1 date; v_d2 date; v_s1 int; v_s2 int;
BEGIN
  v_d1 := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_d2 := v_d1 + 1;
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Fronteira 5', 480, 10, v_d1, v_d2);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Fronteira 5', v_d1, 475);  -- exatos 5 min
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Fronteira 5', v_d2, 474);  -- 6 min

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar variação de exatos 5 min (uma marcação) e de 6 min';
  r.esperado := '5 min: absorvido. 6 min: excedeu o limite POR MARCAÇÃO — computa os 6 (Súmula 366)';
  SELECT max(s.saldo_min) FILTER (WHERE s.dia = v_d1),
         max(s.saldo_min) FILTER (WHERE s.dia = v_d2) INTO v_s1, v_s2
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_d1, 'YYYY-MM')) s;

  IF v_s1 = 0 AND v_s2 = -6 THEN
    r.situacao := 'passou';
    r.obtido := 'Fronteira exata: 5 min absorvidos, 6 min computados integralmente.';
  ELSIF v_s1 = 0 AND v_s2 = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a variação de 6 minutos numa única marcação foi ZERADA. O sistema só '
             || 'aplica o teto diário genérico de 10 minutos — o limite de 5 POR MARCAÇÃO '
             || '(art. 58, §1º; Súmula 366: excedido, computa-se a totalidade) não existe na '
             || 'apuração de saldo. É a borda mais cara do módulo: muda a base de toda a hora '
             || 'extra. Correção: aplicar os dois limites cumulativamente.';
    r.detalhe := jsonb_build_object('saldo_5min', v_s1, 'saldo_6min', v_s2);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Fronteira errada: 5 min deu %s (esperado 0) e 6 min deu %s (esperado -6).',
                       coalesce(v_s1::text, '-'), coalesce(v_s2::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_042()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_src text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a consolidação de batidas respeita o limite de 5 min por marcação?';
  r.esperado := 'Dois tetos cumulativos: 5 min por marcação E 10 min no dia';
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'ponto_saldo_dias_competencia_bruto';

  IF v_src ILIKE '%tolerancia_batida_min, 10%' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o encaixe de batida na escala usa padrão de 10 MINUTOS POR MARCAÇÃO '
             || '(COALESCE(tolerancia_batida_min, 10) na apuração) — o dobro do limite legal de '
             || '5. Com duas batidas, até 20 minutos diários podem ser absorvidos, o dobro do '
             || 'teto de 10 do art. 58, §1º. O teto diário exato (10→0, 11→11) está correto '
             || '(PONTO-353), mas o limite por marcação não é aplicado (PONTO-041). Correção: '
             || 'padrão 5 por marcação e teto conjunto de 10 no dia.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O encaixe por marcação não usa mais o padrão de 10 — conferir se os dois tetos '
             || 'estão cumulativos (fronteiras em PONTO-041/353).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_042()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_042 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_043()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar escala com tolerância de 30 minutos (6× o limite legal)';
  r.esperado := 'Recusado — a Súmula 449 veda inclusive por negociação coletiva';
  BEGIN
    PERFORM public.qa_ponto_escala_tol(public.qa_cpf(5043), 'QA Tolerância 30', 480, 30,
                                       CURRENT_DATE - 10, CURRENT_DATE - 10);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco ACEITOU tolerância de 30 minutos. Não existe CHECK limitando '
             || 'tolerancia_minutos/tolerancia_diaria_minutos ao teto legal (5/10) — e a Súmula '
             || '449 do TST fecha a porta até para a negociação coletiva elastecer. O parâmetro '
             || 'fora da faixa produz apuração ilegal em silêncio. Correção: CHECK no cadastro '
             || 'de escalas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Tolerância acima do limite legal foi recusada no cadastro.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_043()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_043 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe cálculo de indenização por supressão de intervalo?';
  r.esperado := '50% sobre APENAS o período suprimido, natureza indenizatória (art. 71, §4º pós-2017)';
  v_fns := coalesce(public.qa_fns_com('%supress%'), public.qa_fns_com('%71%indeniz%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe cálculo de supressão de intervalo. Jornada acima de 6h com '
             || 'pausa menor que 1h deveria gerar indenização de 50% SÓ sobre os minutos '
             || 'suprimidos (redação pós-reforma) — hoje a supressão passa em branco na '
             || 'apuração. Atenção ao implementar: a regra ANTIGA (hora cheia, natureza '
             || 'salarial) foi revogada em 2017 — usar a nova.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cálculo de supressão presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_061()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_dia date := CURRENT_DATE - 2; v_marcado boolean;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Sem Pausa', 5061);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Sem Pausa', v_dia, TIME '08:00', 'entrada', false);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Sem Pausa', v_dia, TIME '16:30', 'saida', false);
  PERFORM public.consolidar_ponto_diario_manual(public.qa_sandbox_tenant_id(), v_cpf, v_dia);

  r.passo_ordem := 1;
  r.passo_acao := 'Dia de 8h30 corridas, sem nenhuma pausa — conferir se a supressão TOTAL é sinalizada';
  r.esperado := 'Ocorrência de intervalo suprimido registrada (alerta ou marcação no dia)';
  SELECT EXISTS (
    SELECT 1 FROM public.ponto_alertas
    WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf
      AND (tipo ILIKE '%interval%' OR descricao ILIKE '%interval%')
  ) INTO v_marcado;

  IF v_marcado THEN
    r.situacao := 'passou';
    r.obtido := 'A supressão total do intervalo gerou sinalização.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: 8h30 corridas sem NENHUMA pausa não geraram alerta nem ocorrência — '
             || 'a supressão integral do intervalo (art. 71) passa invisível. É violação com '
             || 'indenização devida e fator de risco de SST. Correção: detecção na consolidação '
             || 'do dia + alerta (o gerador atual só conhece falta e atraso).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_061()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_061 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_062()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o mínimo de intervalo é aplicado POR FAIXA de jornada?';
  r.esperado := 'Até 4h: sem mínimo; 4–6h: 15 min; acima de 6h: 1h (art. 71)';
  v_fns := coalesce(public.qa_fns_com('%faixa%interval%'), public.qa_fns_com('%15 min%interval%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função aplica o mínimo de intervalo por faixa de jornada. '
             || 'Sem as faixas do art. 71 (nenhum mínimo até 4h; 15 min entre 4 e 6h; 1h acima '
             || 'de 6h), qualquer validação futura que aplique "1 hora para todos" criará '
             || 'supressão fictícia nas jornadas curtas — e hoje não há validação alguma '
             || '(PONTO-060/061). Implementar as faixas junto com o cálculo de supressão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Faixas aplicadas em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_062()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_062 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_063()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar CCT com intervalo mínimo de 20 minutos (abaixo do piso legal de 30)';
  r.esperado := 'Recusado — a negociação pode reduzir, mas o piso de 30 min é absoluto (art. 611-A, III)';
  BEGIN
    INSERT INTO public.ponto_cct_config (tenant_id, nome, intervalo_minimo_min, ativo)
    VALUES (public.qa_sandbox_tenant_id(), 'QA CCT Piso Intervalo', 20, true);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco ACEITOU CCT com intervalo mínimo de 20 minutos — abaixo do '
             || 'piso absoluto de 30 que nem a negociação coletiva pode furar (art. 611-A, III, '
             || 'da CLT). Correção: CHECK (intervalo_minimo_min IS NULL OR intervalo_minimo_min '
             || '>= 30) em ponto_cct_config.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'CCT com intervalo abaixo do piso de 30 minutos foi recusada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_063()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_063 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_064()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a pré-assinalação do intervalo existe como registro declarado?';
  r.esperado := 'Intervalo previsto declarado, deduzido na apuração e VISÍVEL ao trabalhador';
  v_est := coalesce(public.qa_col_existe(NULL, '%pre_assinal%'), public.qa_fns_com('%pre_assinal%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO PARCIAL: a apuração até DEDUZ um intervalo previsto quando o dia tem só '
             || 'duas batidas (mecânica interna do saldo), mas não existe a PRÉ-ASSINALAÇÃO como '
             || 'figura formal: nada declara o intervalo previsto por vínculo, nada o exibe no '
             || 'espelho, e a Súmula 338 só valida marcação de duas batidas COM pré-assinalação '
             || 'expressa. Correção: campo de intervalo pré-assinalado no perfil de jornada, '
             || 'refletido no espelho e nos arquivos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Pré-assinalação presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_064()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_064 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_080()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_col text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o descanso de 11h entre jornadas é verificado?';
  r.esperado := 'Validação/alerta quando o intervalo entre a saída e a próxima entrada é menor que 11h';
  v_fns := public.qa_fns_com('%interjornada%');
  v_col := public.qa_col_existe('ponto_configuracao', 'interjornada%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a configuração até guarda o parâmetro (%s), mas NENHUMA função '
             || 'verifica o descanso de 11 horas do art. 66 — sair 23h e entrar 6h passa sem '
             || 'aviso. A supressão da interjornada é violação autônoma, devida mesmo que tudo '
             || 'seja pago como extra. Correção: verificação na consolidação (saída do dia D × '
             || 'entrada do dia D+1) com alerta.', coalesce(v_col, 'nem o parâmetro existe'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Interjornada verificada em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_080()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_080 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_090()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5090);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);  -- segunda-feira
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA HE 50', v_dia,
             TIME '08:00', TIME '19:00', TIME '12:00', TIME '13:00');  -- 10h trabalhadas

  r.passo_ordem := 1;
  r.passo_acao := format('Calcular HE do dia útil %s com 10h trabalhadas (jornada 8h)', v_dia);
  r.esperado := '120 min de HE a 50% — a apuração central do módulo';
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);

  IF (v_res->>'he50_min')::int = 120 AND (v_res->>'percentual_he50')::numeric = 50 THEN
    r.situacao := 'passou';
    r.obtido := 'Duas horas além da jornada viraram 120 min de HE com adicional de 50%.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('HE de dia útil errada: %s (esperado he50_min=120, percentual 50).', v_res::text);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_090()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_090 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_091()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5091);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Jornada 6h', 360, 10, v_dia, v_dia);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Jornada 6h', v_dia, TIME '08:00', TIME '15:00');
  -- 7h trabalhadas contra jornada CONTRATUAL de 6h → 60 min de HE

  r.passo_ordem := 1;
  r.passo_acao := 'Calcular HE de colaborador com jornada contratual de 6h que trabalhou 7h';
  r.esperado := '60 min de HE — a jornada da ESCALA é o limite, não as 8h padrão';
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);

  IF (v_res->>'he50_min')::int = 60 THEN
    r.situacao := 'passou';
    r.obtido := 'A hora extra respeitou a jornada contratual de 6h.';
  ELSIF coalesce((v_res->>'he50_min')::int, 0) = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o cálculo de HE IGNOROU a escala do colaborador — usou 8h fixas (ou a '
             || 'CCT genérica) e apagou a hora extra de quem tem jornada contratual de 6h. A '
             || 'função calcular_he_adicional_noturno_dia não consulta a escala/atribuição do '
             || 'colaborador. Tratar 8h como padrão universal apaga HE de jornadas menores. '
             || 'Correção: buscar a jornada do dia na escala vigente do vínculo.';
    r.detalhe := v_res;
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Valor inesperado: %s (esperado he50_min=60).', v_res::text);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_091()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_091 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_092()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5092);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb; v_alerta boolean;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Excesso HE', v_dia,
             TIME '08:00', TIME '21:00', TIME '12:00', TIME '13:00');  -- 12h → 4h extras

  r.passo_ordem := 1;
  r.passo_acao := 'Calcular dia com 4 horas extras (o dobro do limite legal de 2h)';
  r.esperado := 'TODAS as 240 min apuradas (trabalho além do limite continua devido) + sinalização do excesso';
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  SELECT EXISTS (SELECT 1 FROM public.ponto_alertas
    WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf) INTO v_alerta;

  IF (v_res->>'he50_min')::int = 240 AND v_alerta THEN
    r.situacao := 'passou';
    r.obtido := 'As 4 horas foram apuradas integralmente e o excesso ao limite foi sinalizado.';
  ELSIF (v_res->>'he50_min')::int = 120 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO GRAVE: o cálculo CORTOU as horas extras no limite de 2h — de 240 minutos '
             || 'trabalhados além da jornada, só 120 foram apurados (LEAST com he_limite_diario '
             || 'na função de cálculo) e o excedente sumiu SEM alerta. O limite do art. 59 é '
             || 'norma de conduta, não de cálculo: trabalho prestado além dele continua devido '
             || '(com o mesmo adicional) — o que se faz é apurar tudo E alertar o gestor. Hoje o '
             || 'sistema literalmente deixa de pagar o que passou do limite. Correção: remover o '
             || 'corte e criar o alerta de excesso.';
    r.detalhe := v_res;
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Apuração inesperada: %s (esperado 240 min + alerta; alerta=%s).',
                       v_res::text, v_alerta);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_092()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_092 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_093()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a prorrogação por necessidade imperiosa existe como figura própria?';
  r.esperado := 'Registro da hipótese (art. 61) com tratamento distinto do acréscimo comum';
  v_est := coalesce(public.qa_col_existe(NULL, '%necessidade_imperiosa%'),
                    public.qa_fns_com('%imperiosa%'), public.qa_fns_com('%art61%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO PARCIAL: existe a liberação art. 61 na equalização '
             || '(ponto_equalizacao_art61_liberar), mas a NECESSIDADE IMPERIOSA como figura '
             || 'completa — registro do motivo (força maior/serviços inadiáveis), comunicação, '
             || 'limite de 12h e reflexo próprio — não está modelada. Sem ela, toda prorrogação '
             || 'excepcional cai no regime comum. Correção: tipificar a hipótese na ocorrência '
             || 'do dia, com evidência do motivo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Figura presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_093()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_093 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_110()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5110);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_not jsonb; v_diu jsonb; v_cpf2 text := public.qa_cpf(5111);
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Noturno', v_dia, TIME '22:00', TIME '05:00');
  v_not := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  v_cid := public.qa_ponto_dia_horarios(v_cpf2, 'QA Diurno', v_dia, TIME '08:00', TIME '17:00');
  v_diu := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);

  r.passo_ordem := 1;
  r.passo_acao := 'Calcular turno 22h–5h (todo noturno) e turno 8h–17h (todo diurno)';
  r.esperado := 'Noturno: minutos na janela com adicional de 20%. Diurno: zero adicional';

  IF coalesce((v_not->>'adicional_noturno_min')::int, 0) > 0
     AND (v_not->>'percentual_adn')::numeric = 20
     AND coalesce((v_diu->>'adicional_noturno_min')::int, 0) = 0 THEN
    r.situacao := 'passou';
    r.obtido := format('Janela correta: turno noturno rendeu %s min de adicional (20%%) e o '
                       || 'diurno rendeu zero.', v_not->>'adicional_noturno_min');
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Janela do art. 73 errada: noturno=%s, diurno=%s (esperado noturno > 0 a '
                       || '20%% e diurno = 0).', v_not::text, v_diu::text);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_110()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_110 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_111()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5112);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb; v_adn int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Ficta', v_dia, TIME '22:00', TIME '05:00');
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  v_adn := coalesce((v_res->>'adicional_noturno_min')::int, 0);

  r.passo_ordem := 1;
  r.passo_acao := '7 horas de relógio na janela noturna (420 min reais)';
  r.esperado := '480 min apurados — a hora ficta de 52min30s AUMENTA a contagem (420×60÷52,5)';

  IF v_adn = 480 THEN
    r.situacao := 'passou';
    r.obtido := 'A hora ficta foi aplicada: 420 minutos de relógio viraram 480 apurados.';
  ELSIF v_adn = 420 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a hora ficta NÃO foi aplicada — 420 minutos de relógio ficaram 420. '
             || 'Ignorá-la subdimensiona a jornada noturna em 12,5% (art. 73, §1º).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Contagem noturna inesperada: %s min (esperado 480 com ficta).', v_adn);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_111()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_111 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_112()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5113);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_cid uuid; v_res jsonb; v_adn int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Prorrogação', v_dia, TIME '22:00', TIME '07:00');
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dia);
  v_adn := coalesce((v_res->>'adicional_noturno_min')::int, 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Jornada integralmente noturna prorrogada até as 7h (22h → 7h)';
  r.esperado := 'O adicional alcança TAMBÉM as horas após as 5h (Súmula 60, II, do TST)';

  IF v_adn > 480 THEN
    r.situacao := 'passou';
    r.obtido := format('A prorrogação manteve o adicional: %s min apurados (além dos 480 da janela).', v_adn);
  ELSIF v_adn = 480 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o adicional CESSOU às 5h — as 2 horas de prorrogação (5h–7h) de uma '
             || 'jornada integralmente noturna ficaram SEM adicional. A Súmula 60, II, do TST '
             || 'manda o adicional acompanhar a prorrogação. O cálculo corta a janela em '
             || '05:00 fixo. Correção: quando a jornada é cumprida integralmente no período '
             || 'noturno, estender o adicional às horas prorrogadas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Contagem inesperada: %s min.', v_adn);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_112()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_112 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_113()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o regime noturno RURAL existe (janela, percentual e hora cheia próprios)?';
  r.esperado := 'Lavoura 21h–5h / pecuária 20h–4h, adicional 25%, SEM hora ficta (Lei 5.889/73)';
  v_est := coalesce(public.qa_col_existe(NULL, '%rural%'), public.qa_fns_com('%rural%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe regime rural — o cálculo noturno aplica a regra urbana '
             || '(22h–5h, 20%, ficta) a todo mundo. Trabalhador rural tem janela própria '
             || '(lavoura 21h–5h; pecuária 20h–4h), adicional de 25% e hora CHEIA (sem ficta) '
             || 'pela Lei 5.889/1973. Cliente do agro apuraria errado nos três eixos. Correção: '
             || 'enquadramento urbano/rural no vínculo, com parâmetros por regime.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Regime rural presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_113()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_113 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_130()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5130);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dom date; v_cid uuid; v_res jsonb;
BEGIN
  -- primeiro domingo do mês passado
  v_dom := v_base + ((7 - EXTRACT(DOW FROM v_base)::int) % 7);
  v_cid := public.qa_ponto_dia_horarios(v_cpf, 'QA Domingo', v_dom, TIME '08:00', TIME '16:00');
  v_res := public.calcular_he_adicional_noturno_dia(v_cid, v_dom);

  r.passo_ordem := 1;
  r.passo_acao := format('Trabalho de jornada NORMAL (8h) num domingo (%s), sem folga compensatória', v_dom);
  r.esperado := 'As 8 horas rendem a dobra (Lei 605/49, art. 9º; Súmula 146) — não zero';

  IF coalesce((v_res->>'he100_min')::int, 0) >= 480 THEN
    r.situacao := 'passou';
    r.obtido := 'O domingo trabalhado sem compensação rendeu a dobra sobre a jornada inteira.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o domingo trabalhado DENTRO da jornada rendeu %s min a 100%% — o '
             || 'cálculo só dobra o que EXCEDE a jornada (trata domingo como mera HE 100%%). '
             || 'Pela Lei 605/49 e Súmula 146 do TST, o trabalho em domingo/feriado não '
             || 'compensado é pago EM DOBRO por inteiro, jornada normal inclusive. Para '
             || 'feriados já existe a apuração própria (PONTO-320); para DOMINGO sem '
             || 'compensação não existe nada. Correção: detectar domingo sem folga '
             || 'compensatória na semana e dobrar a jornada trabalhada.',
             coalesce((v_res->>'he100_min')::text, '0'));
    r.detalhe := v_res;
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_130()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_130 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_131()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_empA uuid; v_empB uuid; v_cpfA text; v_cpfB text;
        v_dia date := public.qa_dia_util_passado(); v_comp text;
        v_a record; v_b record;
BEGIN
  v_comp := to_char(v_dia, 'YYYY-MM');
  v_empA := public.qa_nova_empresa('QA Feriado Unidade A', '34.028.316/0001-03');
  v_empB := public.qa_nova_empresa('QA Feriado Unidade B', '60.701.190/0001-04');
  v_cpfA := public.qa_ponto_admissao('QA Colab Unidade A', 5131, v_empA);
  v_cpfB := public.qa_ponto_admissao('QA Colab Unidade B', 5132, v_empB);
  PERFORM public.qa_feriado_da_unidade(v_empA, v_dia);   -- feriado SÓ na unidade A
  PERFORM public.qa_ponto_dia(v_cpfA, 'QA Colab Unidade A', v_dia, v_empA);
  PERFORM public.qa_ponto_dia(v_cpfB, 'QA Colab Unidade B', v_dia, v_empB);

  r.passo_ordem := 1;
  r.passo_acao := 'Mesmo dia trabalhado nas unidades A (feriado municipal) e B (dia comum)';
  r.esperado := 'Adicional de feriado APENAS para o colaborador da unidade A';
  SELECT * INTO v_a FROM public.ponto_feriado_adicional_competencia(v_t, v_empA, v_comp) f
   WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpfA;
  SELECT * INTO v_b FROM public.ponto_feriado_adicional_competencia(v_t, v_empB, v_comp) f
   WHERE regexp_replace(f.colaborador_cpf, '[^0-9]', '', 'g') = v_cpfB;

  IF coalesce(v_a.qtd_feriados_trabalhados, 0) >= 1 AND v_b.colaborador_cpf IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'O feriado valeu para a unidade dele e para nenhuma outra.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Abrangência errada: unidade A (com feriado) apurou %s feriado(s) '
             || 'trabalhado(s); unidade B (sem feriado) %s. Feriado municipal vale para a '
             || 'unidade daquele município e para nenhuma outra.',
             coalesce(v_a.qtd_feriados_trabalhados, 0),
             CASE WHEN v_b.colaborador_cpf IS NULL THEN 'nada (correto)' ELSE 'TAMBÉM apurou' END);
  END IF;
  RETURN r;
EXCEPTION WHEN undefined_function THEN
  r.situacao := 'falhou';
  r.obtido := 'A apuração de feriado depende de função que não existe no banco '
           || '(feriado_comportamento — criada direto em produção, nunca versionada). '
           || 'Mesmo achado do PONTO-320/321.';
  r.erro_tecnico := SQLERRM; RETURN r;
WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_131()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_131 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_132()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a falta injustificada desconta o repouso semanal?';
  r.esperado := 'Semana com falta injustificada perde a remuneração do DSR (Lei 605/49, art. 6º)';
  v_fns := public.qa_fns_com('%dsr%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: DSR não existe em nenhuma função do banco — nem o desconto por falta '
             || 'injustificada (Lei 605/49, art. 6º), nem o reflexo das horas extras sobre o '
             || 'repouso. A falta hoje só marca o dia; a consequência semanal, frequentemente '
             || 'esquecida pelos sistemas, não é apurada. Correção: apuração semanal de '
             || 'assiduidade alimentando o evento de DSR na exportação para a folha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('DSR tratado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_132()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_132 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_133()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): sete dias seguidos de trabalho disparam alerta?';
  r.esperado := 'Semana sem 24h consecutivas de repouso é sinalizada (CLT art. 67)';
  v_fns := coalesce(public.qa_fns_com('%repouso%semanal%'), public.qa_fns_com('%24 horas%consecutiv%'),
                    public.qa_fns_com('%sete dias%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nada verifica o repouso semanal de 24 horas consecutivas. Colaborador '
             || 'que trabalha sete dias seguidos passa sem aviso — violação autônoma do art. 67, '
             || 'devida mesmo com tudo pago em dobro. Correção: verificação semanal na '
             || 'consolidação com alerta ao gestor.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Verificação presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_133()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_133 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_150()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração entende o ciclo 12x36?';
  r.esperado := 'Dia de 12h no ciclo não gera HE; dia de folga não gera falta (art. 59-A)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%corrigir%' AND p.proname NOT ILIKE '%copia%'
    AND (p.prosrc ILIKE '%ciclo_horas_trabalho%' OR p.prosrc ILIKE '%12x36%')
    AND (p.proname ILIKE '%saldo%' OR p.proname ILIKE '%apurar%'
         OR p.proname ILIKE '%consolidar%' OR p.proname ILIKE '%calc%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a escala guarda os campos de ciclo (ciclo_horas_trabalho/descanso em '
             || 'ponto_escalas), mas NENHUMA apuração os lê. Colaborador 12x36 teria 4 horas de '
             || '"extra" em todo plantão (12h contra jornada de 8h) e "falta" em toda folga de '
             || '36h. A escala tem regime próprio (art. 59-A) e depende de instrumento que a '
             || 'autorize. Correção: apuração por ciclo quando a modalidade da escala for de '
             || 'plantão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ciclo tratado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_150()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_150 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_151()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração de feriado distingue a escala 12x36?';
  r.esperado := 'Na 12x36 o feriado trabalhado é compensado pela própria escala (art. 59-A, §2º) — sem dobra';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%feriado%'
    AND (p.prosrc ILIKE '%12x36%' OR p.prosrc ILIKE '%ciclo_horas%' OR p.prosrc ILIKE '%plantao%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a apuração de feriado trabalhado (PONTO-320) não distingue a escala '
             || '12x36 — aplicaria a dobra a quem tem a compensação embutida por lei (art. '
             || '59-A, §2º: feriados e prorrogação noturna considerados compensados). É a '
             || 'exceção legal expressa: aplicar a regra geral gera PAGAMENTO INDEVIDO. '
             || 'Correção: a apuração de feriado deve pular vínculos em escala de plantão '
             || 'autorizada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Distinção presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_151()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_151 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_152()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5152);
        v_d_antigo date := CURRENT_DATE - 30; v_d_novo date := CURRENT_DATE - 5;
        e_antigo record; e_novo record;
BEGIN
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Vigência A', 480, 10, CURRENT_DATE - 60, CURRENT_DATE - 15);
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Vigência B', 360, 10, CURRENT_DATE - 14, NULL);

  r.passo_ordem := 1;
  r.passo_acao := 'Trocar de escala (480 min → 360 min) e consultar a escala de um dia ANTIGO e de um dia NOVO';
  r.esperado := 'O dia antigo responde com a escala antiga; o novo, com a nova';
  SELECT * INTO e_antigo FROM public.ponto_escala_do_dia(
    public.qa_sandbox_tenant_id(), v_cpf, v_cpf, v_d_antigo) LIMIT 1;
  SELECT * INTO e_novo FROM public.ponto_escala_do_dia(
    public.qa_sandbox_tenant_id(), v_cpf, v_cpf, v_d_novo) LIMIT 1;

  IF coalesce(e_antigo.jornada_min, -1) IN (480, 0) AND coalesce(e_novo.jornada_min, -1) IN (360, 0)
     AND NOT (coalesce(e_antigo.jornada_min,0) = 0 AND coalesce(e_novo.jornada_min,0) = 0) THEN
    r.situacao := 'passou';
    r.obtido := 'Cada dia respondeu com a escala vigente na época — o passado ficou com a '
             || 'escala antiga.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Vigência de escala mal resolvida: dia antigo devolveu jornada %s '
             || '(esperado a antiga, 480) e dia novo %s (esperado a nova, 360). Apurar dia '
             || 'antigo com escala nova falsifica o passado.',
             coalesce(e_antigo.jornada_min::text, 'nada'), coalesce(e_novo.jornada_min::text, 'nada'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_152()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_152 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_153()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5153);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_antes int; v_depois int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Retroação', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Retroação', v_dia, 540);  -- +60

  SELECT max(s.saldo_min) INTO v_antes
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_dia, 'YYYY-MM')) s WHERE s.dia = v_dia;

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar competência passada, ALTERAR a jornada da escala e reapurar o mesmo dia';
  r.esperado := 'O resultado do dia antigo NÃO muda — parâmetro versionado não retroage';
  UPDATE public.ponto_escalas SET jornada_diaria_minutos = 300
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND nome = 'QA escala ' || v_cpf;

  SELECT max(s.saldo_min) INTO v_depois
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
       to_char(v_dia, 'YYYY-MM')) s WHERE s.dia = v_dia;

  IF v_antes = v_depois THEN
    r.situacao := 'passou';
    r.obtido := format('O dia antigo manteve o saldo (%s min) após a mudança do parâmetro.', v_antes);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: mudar a jornada da escala HOJE reescreveu a apuração de um dia '
             || 'do mês PASSADO (saldo foi de %s para %s min). Os parâmetros da escala não são '
             || 'versionados por vigência — a apuração lê sempre o valor atual. Todo espelho '
             || 'antigo muda junto: auditoria vira reescrita da história. Correção: versionar '
             || 'parâmetros com vigência (a estrutura de atribuições por período já existe; '
             || 'falta a escala em si não ser editada em vigor, e sim substituída).',
             coalesce(v_antes::text, '-'), coalesce(v_depois::text, '-'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_153()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_153 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_170()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5170);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_comp text; v_cred int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_comp := to_char(v_dia, 'YYYY-MM');
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Banco Sem Acordo', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Banco Sem Acordo', v_dia, 540);  -- +60

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar banco de horas de colaborador SEM nenhum regime/acordo de banco configurado';
  r.esperado := 'A hora extra NÃO entra em banco — sem instrumento (art. 59, §§2º/5º) ela é devida em dinheiro';
  PERFORM public.apurar_banco_horas_colaborador(public.qa_sandbox_tenant_id(), v_cpf, v_comp);
  SELECT creditos_minutos INTO v_cred FROM public.ponto_banco_horas
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND competencia = v_comp;

  IF v_cred IS NULL OR v_cred = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Sem instrumento, nenhum crédito foi para o banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: %s min de hora extra entraram no BANCO sem existir regime '
             || 'configurado (ponto_banco_horas_config vazio) nem acordo anexado. A apuração '
             || 'credita banco para todo mundo, incondicionalmente. Sem instrumento válido, '
             || 'hora extra é devida em DINHEIRO na competência — mandar para banco sem lastro '
             || 'é postergar pagamento devido. Correção: apurar banco apenas para vínculos com '
             || 'regime vigente; os demais exportam a HE para a folha.', v_cred);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_170()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_170 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_171()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_preenche boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o vencimento do saldo é controlado de ponta a ponta?';
  r.esperado := 'Prazo derivado do regime na apuração + conversão automática ao vencer';
  SELECT bool_or(p.prosrc ILIKE '%prazo_compensacao%') INTO v_preenche
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('apurar_banco_horas', 'apurar_banco_horas_colaborador');
  IF NOT coalesce(v_preenche, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (confirma o PONTO-354): a conversão de saldo vencido existe e funciona, '
             || 'mas nunca dispara porque a apuração jamais grava prazo_compensacao na linha do '
             || 'banco. Vencido o prazo legal (6 meses no acordo individual; 1 ano no coletivo), '
             || 'a compensação deixa de ser possível e a hora vira crédito em dinheiro — hoje o '
             || 'saldo fica pendurado para sempre. Correção: prazo derivado do regime na '
             || 'apuração de cada competência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A apuração grava o prazo e a conversão tem o que converter.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_171()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_171 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_172()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o regime de compensação limita a jornada a 10h/dia?';
  r.esperado := 'Jornada compensatória não pode passar de 10h (art. 59, §2º) — verificação própria';
  v_fns := coalesce(public.qa_fns_com('%600%compensa%'), public.qa_fns_com('%10 horas%'),
                    public.qa_fns_com('%dez horas%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma verificação limita a jornada em regime de compensação às 10 '
             || 'horas diárias do art. 59, §2º. O limite é DO REGIME e independe do teto de 2h '
             || 'extras: dia de 11h com banco de horas é irregular mesmo que o saldo compense '
             || 'depois. A configuração de jornada máxima existe (jornada_diaria_max_minutos), '
             || 'mas nada a confronta na apuração do banco. Correção: alerta na consolidação '
             || 'quando o dia em regime de compensação passar de 600 minutos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Limite verificado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_172()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_172 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_173()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o desligamento liquida o saldo do banco de horas?';
  r.esperado := 'Saldo positivo pago na rescisão sobre a REMUNERAÇÃO DA RESCISÃO (art. 59, §3º)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%banco_horas%'
    AND (p.prosrc ILIKE '%rescis%' OR p.prosrc ILIKE '%desliga%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o desligamento não conversa com o banco de horas — nenhuma função '
             || 'liquida o saldo na rescisão. O art. 59, §3º manda pagar as horas não '
             || 'compensadas calculadas sobre a remuneração DA DATA DA RESCISÃO (não a da '
             || 'época trabalhada). Colaborador desligado com saldo positivo simplesmente '
             || 'perde o registro. Correção: gatilho de desligamento que apura e exporta o '
             || 'saldo final para a rescisão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Liquidação presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_173()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_173 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_174()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma rotina invalida o banco por habitualidade de HE?';
  r.esperado := 'Nenhuma — o art. 59-B, parágrafo único (pós-reforma) diz que a habitualidade NÃO descaracteriza';
  v_fns := public.qa_fns_com('%habitual%invalid%');
  IF v_fns IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma rotina invalida o acordo de compensação por habitualidade — correto '
             || 'pós-reforma (art. 59-B, parágrafo único). Sistema que invalidasse aplicaria '
             || 'direito revogado (antiga Súmula 85, IV).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: rotina(s) invalidando banco por habitualidade: %s — regra '
             || 'revogada pela Lei 13.467/2017.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_174()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_174 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_175()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(5175);
        v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
        v_dia date; v_comp text; v_banco uuid; v_manual int;
BEGIN
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);
  v_comp := to_char(v_dia, 'YYYY-MM');
  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Manual Preservado', 480, 10, v_dia, v_dia);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Manual Preservado', v_dia, 540);
  PERFORM public.apurar_banco_horas_colaborador(public.qa_sandbox_tenant_id(), v_cpf, v_comp);
  SELECT id INTO v_banco FROM public.ponto_banco_horas
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf AND competencia = v_comp;
  IF v_banco IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'Não foi possível montar o cenário: a apuração não criou a linha do banco.';
    RETURN r;
  END IF;
  INSERT INTO public.ponto_banco_horas_movimentacoes
    (tenant_id, banco_horas_id, colaborador_cpf, data_referencia, tipo, minutos, descricao, origem)
  VALUES (public.qa_sandbox_tenant_id(), v_banco, v_cpf, v_dia, 'credito', 33,
          'Lançamento manual do gestor (QA)', 'manual');

  r.passo_ordem := 1;
  r.passo_acao := 'Reapurar a competência e conferir o lançamento manual de 33 min';
  r.esperado := 'O manual sobrevive — reapuração regenera só as movimentações automáticas';
  PERFORM public.apurar_banco_horas_colaborador(public.qa_sandbox_tenant_id(), v_cpf, v_comp);
  SELECT count(*) INTO v_manual FROM public.ponto_banco_horas_movimentacoes
  WHERE banco_horas_id = v_banco AND origem = 'manual' AND minutos = 33;

  IF v_manual = 1 THEN
    r.situacao := 'passou';
    r.obtido := 'O lançamento manual sobreviveu à reapuração — só as movimentações automáticas '
             || 'foram regeneradas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O lançamento manual %s após a reapuração — regenerar decisão humana '
             || 'registrada apaga autor e justificativa.',
             CASE WHEN v_manual = 0 THEN 'SUMIU' ELSE 'foi duplicado' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_175()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_175 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_190()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fantasma boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o caminho de correção por ajuste aprovado funciona no banco?';
  r.esperado := 'Aprovação de correção insere marcação de ajuste (original=false) preservando a fonte';
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto'
      AND p.prosrc ILIKE '%data_hora%'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ponto_marcacoes' AND column_name = 'data_hora'
  ) INTO v_fantasma;

  IF v_fantasma THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (o mesmo do PONTO-357, agora no caso que lhe é próprio): o ÚNICO caminho '
             || 'legítimo de correção — aprovação do ajuste inserindo a batida de correção — '
             || 'está quebrado no banco: processar_ajuste_ponto grava usando colunas que não '
             || 'existem em ponto_marcacoes (data_hora/tipo/origem; a tabela usa data_marcacao/'
             || 'hora_marcacao/tipo_marcacao). Aprovar correção ou inclusão por essa função '
             || 'quebra em execução, ou a tela contorna a função por caminho próprio. '
             || 'Correção: alinhar o INSERT/DELETE ao esquema real.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O fluxo de correção por ajuste referencia o esquema real (batida de correção '
             || 'com original preservada).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_190()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_190 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_191()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_encadeado boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o hash das marcações é encadeado e alguém o confere?';
  r.esperado := 'Hash de cada marcação incorpora o anterior (cadeia) + rotina de verificação da cadeia';
  SELECT bool_or(p.prosrc ILIKE '%anterior%'), string_agg(DISTINCT p.proname, ', ')
    INTO v_encadeado, v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%hash_marcacao%' AND p.prosrc ILIKE '%verific%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: cada marcação tem hash próprio, mas (1) o hash NÃO é encadeado — não '
             || 'incorpora o hash da marcação anterior, então remover uma linha inteira não '
             || 'quebra nada — e (2) NENHUMA rotina confere os hashes: um UPDATE direto com a '
             || 'trava desligada, ou feito por quem pode, nunca seria detectado. Encadeamento '
             || 'verificado é o que transforma "não editamos" em prova (registro tipo 7 do '
             || 'AFD). Correção: hash(linha + hash_anterior) + rotina periódica de verificação '
             || 'da cadeia com alerta.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Verificação de hash presente em: %s (encadeado: %s).', v_fns, v_encadeado);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_191()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_191 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_192()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_log uuid;
        v_del boolean := false; v_upd boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Trilha', 5192);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Trilha', CURRENT_DATE - 1, TIME '09:00', 'entrada');
  SELECT id INTO v_log FROM public.ponto_audit_log
  WHERE tenant_id = public.qa_sandbox_tenant_id() ORDER BY created_at DESC LIMIT 1;
  IF v_log IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A marcação não gerou registro na trilha (ponto_audit_log vazio para o cercado) '
             || '— trilha incompleta.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar APAGAR e ALTERAR um registro da trilha de auditoria';
  r.esperado := 'Ambos bloqueados — trilha que se apaga não é trilha';
  BEGIN
    DELETE FROM public.ponto_audit_log WHERE id = v_log;
    v_del := NOT EXISTS (SELECT 1 FROM public.ponto_audit_log WHERE id = v_log);
  EXCEPTION WHEN OTHERS THEN v_del := false; END;
  BEGIN
    UPDATE public.ponto_audit_log SET acao = 'adulterado' WHERE id = v_log;
    v_upd := true;
  EXCEPTION WHEN OTHERS THEN v_upd := false; END;

  IF NOT v_del AND NOT v_upd THEN
    r.situacao := 'passou';
    r.obtido := 'A trilha recusou exclusão e alteração — registro imutável (append-only).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A trilha foi %s — auditoria que se edita não prova nada.',
             CASE WHEN v_del AND v_upd THEN 'APAGADA e ALTERADA'
                  WHEN v_del THEN 'APAGADA' ELSE 'ALTERADA' END);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_192()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_192 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_193()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text;
        v_mes date := date_trunc('month', CURRENT_DATE - INTERVAL '3 months')::date;
        v_fech uuid; v_bloqueou boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Fechado', 5193, NULL, v_mes - 30);
  INSERT INTO public.ponto_fechamentos (tenant_id, competencia, status, data_fechamento)
  VALUES (public.qa_sandbox_tenant_id(), to_char(v_mes, 'YYYY-MM'), 'fechado', now())
  RETURNING id INTO v_fech;

  r.passo_ordem := 1;
  r.passo_acao := format('Tentar marcar ponto em competência FECHADA (%s), sem privilégio', to_char(v_mes, 'YYYY-MM'));
  r.esperado := 'Recusado — documento entregue e assinado não se altera';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Fechado', v_mes + 2, TIME '08:00', 'entrada');
    v_bloqueou := false;
  EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;

  DELETE FROM public.ponto_fechamentos WHERE id = v_fech;  -- não poluir os demais casos

  IF v_bloqueou THEN
    r.situacao := 'passou';
    r.obtido := 'A competência fechada recusou a marcação. Nota de risco: o gatilho abre '
             || 'exceção para papéis de gestão (a "válvula" já apontada na trilha de ajustes) '
             || '— a reabertura formal do PONTO-358 é o caminho correto.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'A competência FECHADA aceitou marcação nova sem reabertura — o espelho já '
             || 'entregue muda por baixo dos panos.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_193()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_193 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_194()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a geração de espelhos do fechamento é atômica no banco?';
  r.esperado := 'Falha no meio não deixa competência com espelhos de metade dos colaboradores';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ponto_espelhos%' AND p.prosrc ILIKE '%INSERT%';
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função do banco GERA os espelhos — eles nascem por um caminho '
             || 'de tela/edge que o banco não conhece, gravando linha a linha em '
             || 'ponto_espelhos. Sem uma função transacional, falha no meio deixa espelho '
             || 'parcial (metade dos colaboradores com documento, metade sem) — pior que '
             || 'ausente, porque parece completo. Correção: geração dos espelhos da '
             || 'competência numa função única (tudo-ou-nada) chamada pelo fechamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Geração transacional presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_194()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_194 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_210()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_cpf text; v_t uuid := public.qa_sandbox_tenant_id();
  v_n1 bigint; v_n2 bigint;
  v_mudou boolean := false;
  v_unico boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar duas marcacoes e conferir se o NSR nasce sozinho e continua a serie';
  r.esperado := 'NSR atribuido na gravacao, sequencial, sem buraco';

  v_cpf := public.qa_ponto_admissao('QA NSR', 2101);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA NSR', CURRENT_DATE - 2, TIME '08:00', 'entrada');
  PERFORM public.qa_ponto_marca(v_cpf, 'QA NSR', CURRENT_DATE - 2, TIME '12:00', 'saida');

  SELECT min(nsr), max(nsr) INTO v_n1, v_n2
  FROM public.ponto_marcacoes
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar ALTERAR o NSR de uma marcacao ja gravada';
  r.esperado := 'Recusado — o numero amarra o registro ao arquivo-fonte';
  BEGIN
    UPDATE public.ponto_marcacoes SET nsr = nsr + 1000
    WHERE tenant_id = v_t AND colaborador_cpf = v_cpf;
    v_mudou := true;
  EXCEPTION WHEN OTHERS THEN v_mudou := false; END;

  r.passo_ordem := 3;
  r.passo_acao := 'Conferir que o NSR nao se repete dentro do estabelecimento';
  r.esperado := 'Indice unico por (tenant, empresa, nsr)';
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ponto_marcacoes'
      AND indexname = 'ponto_marcacoes_nsr_unico'
  ) INTO v_unico;

  IF v_n1 IS NOT NULL AND v_n2 = v_n1 + 1 AND NOT v_mudou AND v_unico THEN
    r.situacao := 'passou';
    r.obtido := format('NSR atribuido na gravacao (%s e %s, sem buraco), imutavel depois de '
             || 'gravado e unico por estabelecimento. Marcacoes anteriores a esta '
             || 'funcionalidade ficam sem NSR ate rodar o preenchimento historico.', v_n1, v_n2);
  ELSIF v_n1 IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a marcacao foi gravada SEM NSR. Sem numeracao sequencial de registro, '
             || 'o AFD improvisa numeros na exportacao e nada demonstra que nenhum registro foi '
             || 'removido. E o requisito central do arquivo-fonte da Portaria 671.';
  ELSIF v_n2 <> v_n1 + 1 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a serie do NSR tem buraco (%s depois de %s). Buraco na sequencia '
             || 'e exatamente o que a fiscalizacao le como registro removido.', v_n2, v_n1);
  ELSIF v_mudou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o NSR de uma marcacao ja gravada pode ser ALTERADO. Numero que muda nao '
             || 'amarra nada — o vinculo entre a marcacao e o arquivo-fonte deixa de provar.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: falta o indice que impede NSR repetido dentro do estabelecimento.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_210()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_210 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_211()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o AEJ existe?';
  r.esperado := 'Arquivo Eletrônico de Jornada gerado pelo programa de tratamento (Portaria 671)';
  v_fns := coalesce(public.qa_fns_com('%aej%'), public.qa_col_existe(NULL, '%aej%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (confirma a auditoria de conformidade): o AEJ não existe em lugar '
             || 'nenhum do banco — nem função, nem coluna, nem tabela. É a saída OBRIGATÓRIA '
             || 'do programa de tratamento na Portaria 671 (substituiu AFDT/ACJEF) e a peça '
             || 'que a fiscalização pede junto com o AFD. Correção: gerador de AEJ no leiaute '
             || 'vigente, assinado, a partir da apuração da competência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('AEJ presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_211()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_211 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_212()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_val text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a importação de AFD detecta lacuna de NSR?';
  r.esperado := 'Arquivo com sequência quebrada é recusado POR INTEIRO';
  v_val := coalesce(public.qa_fns_com('%lacuna%'), public.qa_fns_com('%sequencial%nsr%'),
                    public.qa_fns_com('%nsr%sequencia%'));
  IF v_val IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem NSR no modelo (PONTO-210) e sem validação de integridade na '
             || 'importação (PONTO-382), a lacuna de sequência nem é DETECTÁVEL — um AFD com '
             || 'registros removidos entraria inteiro e viraria prova adulterada no acervo. '
             || 'Correção: validar a sequência de NSR na importação e recusar o arquivo '
             || 'completo em caso de lacuna, com relatório.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Validação de lacuna presente em: %s.', v_val);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_212()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_212 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 61 casos.

-- Ponto (1 de 3) (61 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('ESC-001', '12x36 só vale com o acordo formal — sem ele, a atribuição é sinalizada', 'negativo', 'critica', 'aprovado', 'A 12x36 não é escolha administrativa: a lei a condiciona a acordo individual ESCRITO, ACT ou CCT. Escala 12x36 aplicada sem a formalização é jornada inválida — na reclamatória, todas as horas além da 8ª viram extra, com reflexos, de todo o período. O sistema deve exigir/sinalizar o acordo na criação e na atribuição da escala.', 'Cadastro de escalas disponível no ambiente de teste.', '[{"acao": "Criar escala 12x36 SEM anexar acordo (individual/ACT/CCT)", "ordem": 1, "resultado_esperado": "Bloqueio ou sinalização de pendência de formalização — nunca silêncio"}, {"acao": "Atribuir a escala a um colaborador", "ordem": 2, "resultado_esperado": "Pendência visível enquanto o acordo não for arquivado"}, {"acao": "Anexar o acordo assinado", "ordem": 3, "resultado_esperado": "Escala regularizada; documento guardado no módulo Documentos (RN-014)"}]', 'Sem papel assinado não há 12x36 — há passivo de hora extra.', 'Requisitos YE-DP-ESC-001: RN-001 / CA-001 / RF-003. ponto_escalas já tem acordo_individual_url e cct_act_url — a sonda confere se alguém os EXIGE. A apuração do ciclo é o PONTO-150/151.', 'api', 'CLT art. 59-A (12x36 mediante acordo individual escrito, ACT ou CCT)', 'em_triagem', NULL),
    ('ESC-010', 'Atestado acima de 15 dias abona 15 e encaminha a Afastamentos — sem duplicar', 'alternativo', 'critica', 'aprovado', 'O atestado longo muda de natureza no 16º dia: até 15 dias é abono da empresa; dali em diante é benefício previdenciário — matéria do módulo Afastamentos. O sistema deve fazer a passagem SOZINHO: registrado atestado de 20 dias, abona 15 e cria/encaminha o afastamento correspondente, uma única vez (a duplicidade paga em dobro ou perde o prazo do INSS).', 'Fluxo de atestados operante no ambiente de teste.', '[{"acao": "Registrar atestado de 20 dias", "ordem": 1, "resultado_esperado": "15 primeiros dias abonados pela empresa"}, {"acao": "Conferir o módulo Afastamentos", "ordem": 2, "resultado_esperado": "Afastamento previdenciário criado/encaminhado a partir do 16º dia, vinculado ao atestado"}, {"acao": "Registrar o mesmo atestado de novo", "ordem": 3, "resultado_esperado": "Sem duplicar abono nem afastamento"}]', 'No 16º dia o atestado troca de dono — e o sistema faz a mudança.', 'Requisitos YE-DP-ESC-001: RN-010 / CA-006 / RF-012. A régua dos 15 dias no lado dos AFASTAMENTOS é o AFAST-020..022; aqui a cobrança é a PONTE a partir do atestado (atestados.afastamento_id existe — a sonda confere quem o preenche).', 'api', 'Lei 8.213/91, arts. 59-60 (empresa paga os 15 primeiros dias; INSS assume do 16º)', 'em_triagem', NULL),
    ('ESC-011', 'Atestados sobrepostos são detectados, não abonados em dobro', 'negativo', 'alta', 'aprovado', 'Dois atestados cobrindo o mesmo período — o mesmo documento reenviado, ou dois médicos para os mesmos dias — não podem abonar em dobro nem confundir a contagem dos 15 dias. O sistema detecta a sobreposição na entrada, sinaliza e mantém o tratamento mais favorável conforme a regra, com o operador decidindo o caso ambíguo.', 'Atestados registrados no ambiente de teste.', '[{"acao": "Registrar atestado de 01 a 10 do mês", "ordem": 1, "resultado_esperado": "Abonado normalmente"}, {"acao": "Registrar outro atestado de 05 a 12 (sobrepõe 6 dias)", "ordem": 2, "resultado_esperado": "Sobreposição detectada e sinalizada — não entra como abono independente"}, {"acao": "Conferir a contagem de dias abonados", "ordem": 3, "resultado_esperado": "Cada dia conta UMA vez, inclusive na régua dos 15 dias"}]', 'O mesmo dia doente não abona duas vezes.', 'Requisitos YE-DP-ESC-001: fluxo alternativo (seção 9) / validações (seção 13). A tabela atestados não tem exclusão de período — a sonda testa se a sobreposição passa em silêncio. Em afastamentos a regra existe (AFAST-011).', 'api', 'Documento YE-DP-ESC-001, fluxo alternativo "Atestado sobreposto/duplicado"; RN de integridade (sem abono duplicado)', 'em_triagem', NULL),
    ('ESC-012', 'Ausência do art. 473 sem documento fica pendente — não abona por fé', 'negativo', 'alta', 'aprovado', 'O rol do art. 473 abona a falta, mas mediante COMPROVAÇÃO: certidão de óbito, de casamento, declaração de comparecimento, comprovante de doação de sangue. Sem o documento no prazo, a ausência fica PENDENTE — nem abonada (não há prova) nem descontada às cegas (o prazo de comprovação corre) — e o colaborador é cobrado antes de virar desconto.', 'Justificativas de ausência configuradas no ambiente de teste.', '[{"acao": "Justificar falta por hipótese do art. 473 SEM anexar documento", "ordem": 1, "resultado_esperado": "Fica pendente de comprovação — o abono não se consuma"}, {"acao": "Deixar o prazo de comprovação expirar", "ordem": 2, "resultado_esperado": "Alerta ao colaborador e ao DP antes de qualquer desconto"}, {"acao": "Anexar o documento", "ordem": 3, "resultado_esperado": "Abono efetivado; DSR da semana preservado; documento arquivado"}]', 'O art. 473 abona com prova — sem documento, pendência; nunca desconto silencioso.', 'Requisitos YE-DP-ESC-001: RN-009 / CA-007 / fluxo alternativo. ponto_justificativas tem requer_anexo — a sonda confere se a exigência é aplicada ou decorativa. O rol e os prazos são o AFAST-050.', 'api', 'CLT art. 473 (rol de ausências sem prejuízo do salário, mediante comprovação)', 'em_triagem', NULL),
    ('ESC-020', 'Troca de turno entre colaboradores: aprovada, registrada e recalculada', 'alternativo', 'media', 'aprovado', 'Trocar o turno de dois colaboradores não é editar duas linhas: a troca precisa de aprovação (gestor), registro (quem trocou com quem, quando) e RECÁLCULO dos envolvidos — a interjornada de 11h e o adicional noturno podem mudar para os dois. Troca informal que viola a interjornada é passivo criado por boa vontade.', 'Dois colaboradores com escalas atribuídas no ambiente de teste.', '[{"acao": "Solicitar a troca de turno entre dois colaboradores", "ordem": 1, "resultado_esperado": "Registro da solicitação com aprovação do gestor"}, {"acao": "Aprovar a troca", "ordem": 2, "resultado_esperado": "Escalas dos dois atualizadas com histórico preservado"}, {"acao": "Conferir os reflexos", "ordem": 3, "resultado_esperado": "Interjornada e adicionais recalculados para AMBOS; violação sinalizada antes de consumar"}]', 'Troca é transação com aprovação — não edição de agenda.', 'Requisitos YE-DP-ESC-001: RF-013 / fluxo alternativo. Não há estrutura de trocas hoje — a sonda confere. A vigência de atribuição é o PONTO-152.', 'api', 'CLT art. 66 (interjornada) c/c documento YE-DP-ESC-001, RF-013 (troca com aprovação e recálculo)', 'em_triagem', NULL),
    ('ESC-021', 'Turno sem cobertura é apontado antes do dia, não descoberto no dia', 'feliz', 'media', 'aprovado', 'Operação por turnos vive de cobertura: turno previsto sem colaborador atribuído (férias, afastamento, desligamento no meio do ciclo) precisa aparecer ANTES — como alerta ao gestor e ação de cobertura — e não ser descoberto com o posto vazio. O sistema conhece as escalas, as atribuições vigentes e os afastamentos: cruzá-los é o radar.', 'Escalas com atribuições e um afastamento no meio do ciclo no ambiente de teste.', '[{"acao": "Afastar um colaborador escalado", "ordem": 1, "resultado_esperado": "Turnos futuros dele apontados como descobertos"}, {"acao": "Conferir o painel do gestor", "ordem": 2, "resultado_esperado": "Alerta de cobertura com sugestão de troca/realocação"}, {"acao": "Cobrir o turno", "ordem": 3, "resultado_esperado": "Alerta encerrado com o registro de quem cobriu"}]', 'Escala boa é a que avisa o buraco antes do buraco.', 'Requisitos YE-DP-ESC-001: seção 14 / RF-020. A sonda confere se algum motor cruza atribuições × afastamentos/desligamentos.', 'api', 'Documento YE-DP-ESC-001, alerta "Escala sem cobertura" (seção 14) / RF-013', 'em_triagem', NULL),
    ('ESC-030', 'Colaborador vê o próprio saldo e extrato de banco de horas no portal', 'feliz', 'media', 'aprovado', 'Banco de horas sem extrato é fonte de litígio: o colaborador precisa ver, no portal/app, o próprio saldo, os créditos e débitos por período e o prazo de compensação — a mesma fonte que o DP enxerga (PONTO-330). Transparência aqui é prevenção: divergência descoberta no mês é acerto; descoberta na rescisão é processo.', 'Colaborador com movimentações de banco no ambiente de teste.', '[{"acao": "Abrir o portal do colaborador → banco de horas", "ordem": 1, "resultado_esperado": "Saldo atual, créditos, débitos e prazo de compensação visíveis"}, {"acao": "Comparar com o extrato do DP", "ordem": 2, "resultado_esperado": "Mesma fonte, mesmos números"}, {"acao": "Conferir outro colaborador", "ordem": 3, "resultado_esperado": "Cada um vê apenas o próprio saldo"}]', 'O saldo do banco é do colaborador — ele o vê sem pedir.', 'Requisitos YE-DP-ESC-001: RF-017. Caso de tela (Cypress). O motor do saldo é o PONTO-170..175/330.', 'e2e', 'CLT art. 59 c/c documento YE-DP-ESC-001, RF-017 (transparência do saldo ao colaborador)', 'em_triagem', NULL),
    ('ESC-031', 'Turno ininterrupto de revezamento é de 6 horas, salvo negociação coletiva', 'negativo', 'alta', 'aprovado', 'Revezamento que alterna turnos (dia/noite) em operação contínua tem jornada constitucional de 6 HORAS — só a negociação coletiva pode ampliá-la (o STF admite até 8h por CCT/ACT). Escala de revezamento cadastrada com 8h sem instrumento coletivo é a 7ª e 8ª hora viradas extra todos os dias, para todos os turnos.', 'Cadastro de escalas com modalidade de revezamento no ambiente de teste.', '[{"acao": "Criar escala de revezamento com jornada de 8h SEM CCT/ACT anexado", "ordem": 1, "resultado_esperado": "Sinalização: acima de 6h exige negociação coletiva"}, {"acao": "Anexar o instrumento coletivo", "ordem": 2, "resultado_esperado": "Jornada ampliada aceita, com o fundamento registrado"}, {"acao": "Criar revezamento de 6h", "ordem": 3, "resultado_esperado": "Aceita sem exigência — é o padrão constitucional"}]', 'No revezamento, a 7ª hora só existe com a assinatura do sindicato.', 'Requisitos YE-DP-ESC-001: RN-012 [OLC]/[RCC]. A sonda confere se a validação existe para a modalidade de revezamento.', 'api', 'CF art. 7º, XIV (turno ininterrupto de revezamento: 6h, salvo negociação coletiva)', 'em_triagem', NULL),
    ('PONTO-001', 'Marcação é registrada com data, hora e identificação por CPF', 'feliz', 'critica', 'aprovado', 'Caminho base do módulo. A identificação por CPF é exigência expressa da Portaria 671 e atravessa todos os artefatos regulamentares.', 'Colaborador ativo, escala 5x2, jornada de 8h.', '[{"acao": "Registrar marcação de entrada", "ordem": 1, "resultado_esperado": "Gravada com data, hora, CPF do trabalhador e identificação do estabelecimento"}, {"acao": "Conferir o fuso aplicado", "ordem": 2, "resultado_esperado": "Horário local do estabelecimento, sem deslocamento por UTC"}, {"acao": "Conferir se o CPF está no registro", "ordem": 3, "resultado_esperado": "Presente — é a chave exigida pela Portaria 671"}]', 'A marcação nasce completa e identificada conforme a norma.', 'Caso base. Se falhar, os demais do bloco não têm significado.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 74, §2º; Portaria MTE 671/2021 (identificação do trabalhador por CPF, e não mais por PIS, em AFD, AEJ, comprovante e espelho)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-002', 'Sistema não restringe horário de marcação', 'negativo', 'critica', 'aprovado', 'A vedação é expressa. Impedir a batida fora do horário previsto apaga a prova de que o trabalho ocorreu — exatamente o oposto da finalidade do registro.', 'Colaborador com jornada 08:00–17:00.', '[{"acao": "Marcar às 05:30, muito antes da entrada prevista", "ordem": 1, "resultado_esperado": "ACEITO e registrado"}, {"acao": "Marcar às 23:50, muito depois da saída prevista", "ordem": 2, "resultado_esperado": "ACEITO e registrado"}, {"acao": "Marcar em domingo, fora da escala", "ordem": 3, "resultado_esperado": "ACEITO e registrado; o tratamento é na apuração, nunca no bloqueio"}, {"acao": "Conferir se algum parâmetro do sistema permite bloquear", "ordem": 4, "resultado_esperado": "Nenhuma configuração pode impedir a marcação"}]', 'Nenhum horário é recusado. Divergências viram alerta na apuração, não bloqueio.', 'A auditoria as-built registra um toggle "permitir registro fora de horário" que é gravado e não aplicado. O passo 4 exige mais que isso: a configuração NÃO PODE existir como bloqueio, porque a norma veda. Parâmetro que permite descumprir a lei é defeito, mesmo desligado.', 'e2e', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021: é vedado restringir horários de marcação', 'comportamento_correto', 'AS-BUILT 2026-08-20: a vedação legal já é cumprida. O backend registrar_ponto_externo NÃO tem trava de horário/janela, e a tela de marcação (PontoExterno) não condiciona o botão à hora do dia — qualquer horário é aceito. Falta apenas o teste de tela automatizado (Cypress) para comprovar a regra; o comportamento em si está correto. Divergência de horário é item da apuração (alerta, nunca bloqueio).'),
    ('PONTO-003', 'Sistema não marca ponto automaticamente', 'negativo', 'critica', 'aprovado', 'Marcação automática é ficção de jornada. A norma veda porque destrói o valor probatório de todo o conjunto.', 'Colaborador com escala cadastrada.', '[{"acao": "Passar o dia sem nenhuma batida", "ordem": 1, "resultado_esperado": "Nenhuma marcação é criada pelo sistema"}, {"acao": "Conferir se a escala preenche marcação prevista", "ordem": 2, "resultado_esperado": "A escala define jornada ESPERADA, nunca marcação realizada"}, {"acao": "Conferir rotinas automáticas e jobs", "ordem": 3, "resultado_esperado": "Nenhuma cria registro em ponto_marcacoes"}]', 'Marcação só existe por ato do trabalhador ou por ajuste formal aprovado.', 'A pré-assinalação de intervalo é exceção prevista e distinta: ela declara intervalo previsto, não cria batida. Ver PONTO-072.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021: é vedado marcar ponto automaticamente', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-004', 'Marcação original não pode ser alterada nem apagada', 'negativo', 'critica', 'aprovado', 'É o coração da inalterabilidade. Registro que pode ser editado não prova nada, e a Súmula 338 joga o ônus sobre quem não consegue provar.', 'Marcação já gravada.', '[{"acao": "Tentar alterar o horário pela edição em linha do espelho", "ordem": 1, "resultado_esperado": "Nenhum caminho da aplicação permite"}, {"acao": "Tentar alterar direto pela API", "ordem": 2, "resultado_esperado": "Recusado pelo banco"}, {"acao": "Tentar apagar a marcação", "ordem": 3, "resultado_esperado": "Recusado"}, {"acao": "Corrigir pelo fluxo de ajuste aprovado", "ordem": 4, "resultado_esperado": "Cria batida de CORREÇÃO; a original permanece visível e íntegra"}]', 'A marcação original é imutável. Correção é acréscimo, nunca substituição.', 'A auditoria as-built (GAP-010, 019, 023, 035) indica que a edição em linha do espelho permite alterar a marcação original. Deve falhar nos passos 1 e 2. É o requisito que o próprio documento chama de mais importante da seção.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021: é vedado alterar ou apagar marcações registradas; CLT, art. 74; TST, Súmula 338 (ônus da prova do empregador)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-005', 'Comprovante de marcação fica disponível após cada batida', 'feliz', 'critica', 'aprovado', 'É direito do trabalhador ter prova da própria batida, sem depender de pedir.', 'Colaborador que acabou de marcar.', '[{"acao": "Conferir o comprovante logo após a marcação", "ordem": 1, "resultado_esperado": "Disponível sem solicitação prévia"}, {"acao": "Conferir os campos", "ordem": 2, "resultado_esperado": "Os dados padronizados exigidos pela norma vigente"}, {"acao": "Extrair os comprovantes das últimas 48 horas", "ordem": 3, "resultado_esperado": "Todos os do período, no mínimo"}, {"acao": "Conferir a assinatura eletrônica", "ordem": 4, "resultado_esperado": "Padrão PAdES com certificado ICP-Brasil (Portaria MTP 1.486/2022)"}]', 'O trabalhador tem acesso autônomo e assinado ao comprovante de cada batida.', 'GAP conhecido: não há comprovante nem assinatura ICP-Brasil. O passo 3 tem piso normativo de 48 horas — guardar mais é permitido, menos não. Requisitos YE-DP-PONTO-001: RF-003/CA-003 — conteúdo mínimo e prazo de 48h ganharam casos próprios (PONTO-380/381).', 'e2e', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Comprovante de Registro de Ponto do Trabalhador); MTE, Perguntas e Respostas oficiais: a emissão no momento é dispensada se o sistema disponibilizar acesso eletrônico após cada marcação, independentemente de solicitação prévia, e permitir extrair as últimas 48 horas', 'aguardando_construcao', 'AS-BUILT 2026-08-20: o BANCO está pronto (onda 7 — tabela ponto_comprovantes, emissão com NSR+hash, prazo de 48h e a extração pelo próprio trabalhador; casos 380/381/359 verdes). Falta a TELA: o comprovante (pdfMarca/cartaoPonto) só é gerado na aba de relatórios do RH (PontoRelatoriosTab); na tela do trabalhador, após bater, aparece só a confirmação — sem botão de baixar o comprovante nem acesso às últimas 48h. Construir o acesso autônomo do trabalhador (Portaria 671).'),
    ('PONTO-006', 'Cerca virtual registra e sinaliza, nunca bloqueia', 'alternativo', 'alta', 'aprovado', 'Geolocalização é evidência, não autorização. Recusar batida por distância é restringir a marcação, o que a norma veda.', 'Colaborador com unidade que tem cerca virtual configurada.', '[{"acao": "Marcar a 2 km da unidade", "ordem": 1, "resultado_esperado": "ACEITA; distância registrada; alerta gerado; justificativa solicitada"}, {"acao": "Marcar com GPS indisponível no aparelho", "ordem": 2, "resultado_esperado": "ACEITA; condição registrada; alerta gerado"}, {"acao": "Conferir se existe configuração que bloqueie por distância", "ordem": 3, "resultado_esperado": "Nenhuma pode bloquear"}]', 'A localização qualifica a marcação; jamais a impede.', 'Mesmo raciocínio do PONTO-002: a existência do parâmetro de bloqueio já é o defeito.', 'e2e', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (vedação de restringir horários e condições de marcação); LGPD, art. 6º (necessidade)', 'aguardando_construcao', 'AS-BUILT 2026-08-20: "nunca bloqueia" ATENDIDO (a tela não trava a marcação por geofence — o botão não olha a cerca) e "registra" ATENDIDO (o banco grava latitude/longitude/dentro_cerca/geofence_ref). Falta o "sinaliza": a GeofenceConfigCard é só configuração do RH; o trabalhador não recebe aviso "fora da área" e não há alerta de fora-da-cerca na apuração. Construir apenas o sinal (badge/alerta), sem bloquear.'),
    ('PONTO-020', 'Dia completo apura jornada, saldo zero e status regular', 'feliz', 'critica', 'aprovado', 'Caminho feliz da apuração. Base de comparação para todos os demais.', 'Escala 5x2, 8h, intervalo de 1h, entrada 08:00, saída 17:00.', '[{"acao": "Marcações 08:00, 12:00, 13:00, 17:00", "ordem": 1, "resultado_esperado": "8h trabalhadas"}, {"acao": "Conferir saldo", "ordem": 2, "resultado_esperado": "Zero"}, {"acao": "Conferir status e alertas", "ordem": 3, "resultado_esperado": "Regular, sem alerta"}, {"acao": "Conferir a memória de cálculo", "ordem": 4, "resultado_esperado": "Persistida, com a versão dos parâmetros usada"}]', 'Dia regular apurado, com memória rastreável.', 'O passo 4 é exigência do RQ-021: sem memória versionada não há como reapurar competência antiga com os parâmetros da época.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 58, caput (duração normal de até 8 horas diárias)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-021', 'Número ímpar de marcações não inventa par', 'excecao', 'critica', 'aprovado', 'Fechar o par que falta seria criar marcação. A norma veda, e o dia deve ficar visivelmente incompleto para ser corrigido pelo fluxo formal.', 'Escala 5x2.', '[{"acao": "Marcações 08:00, 12:00, 13:00 — sem a saída", "ordem": 1, "resultado_esperado": "Dia INCOMPLETO"}, {"acao": "Conferir horas apuradas", "ordem": 2, "resultado_esperado": "Apenas o período pareado (4h), sem completar o aberto"}, {"acao": "Conferir alerta", "ordem": 3, "resultado_esperado": "Gerado, com o dia sinalizado para correção"}, {"acao": "Conferir se o sistema fechou o par sozinho", "ordem": 4, "resultado_esperado": "NÃO — nenhuma marcação criada automaticamente"}]', 'Dia incompleto permanece incompleto e visível.', 'O passo 4 é o negativo essencial: um motor mal escrito "ajuda" fechando com o horário da escala, e isso é marcação automática vedada.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (vedação de marcar ponto automaticamente); CLT, art. 74', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-022', 'Turno que cruza a meia-noite pertence ao dia de início', 'alternativo', 'critica', 'aprovado', 'Partir a jornada em dois dias gera falta fictícia no segundo e subdimensiona a prorrogação noturna.', 'Escala noturna.', '[{"acao": "Entrada 22:00 do dia 10, saída 06:00 do dia 11", "ordem": 1, "resultado_esperado": "8h atribuídas integralmente ao dia 10"}, {"acao": "Conferir o dia 11", "ordem": 2, "resultado_esperado": "Sem saldo negativo e sem falta por causa dessa jornada"}, {"acao": "Conferir o adicional noturno", "ordem": 3, "resultado_esperado": "Calculado sobre a jornada inteira, sem corte na virada do dia"}]', 'A jornada é uma só e pertence ao dia em que começou.', 'O passo 2 é onde o erro aparece na prática: o colaborador leva falta num dia em que trabalhou a noite inteira.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 73, §5º e Súmula 60, II do TST (prorrogação da jornada noturna, que pressupõe jornada única e contínua)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-023', 'Dia sem marcação em dia útil é falta, não dia neutro', 'negativo', 'alta', 'aprovado', 'A falta tem consequência sobre o DSR. Tratar ausência como neutro esconde o efeito legal.', 'Escala 5x2, dia útil sem justificativa.', '[{"acao": "Nenhuma marcação em dia útil", "ordem": 1, "resultado_esperado": "Falta registrada"}, {"acao": "Conferir o saldo", "ordem": 2, "resultado_esperado": "Negativo, igual à jornada esperada do dia"}, {"acao": "Conferir o efeito no DSR da semana", "ordem": 3, "resultado_esperado": "Perda do repouso semanal, conforme art. 6º da Lei 605/1949"}]', 'A falta é apurada e repercute no DSR.', 'O passo 3 é o que quase nenhum sistema faz e é obrigação legal expressa.', 'api', 'OBRIGAÇÃO LEGAL — Lei 605/1949, art. 6º (falta injustificada faz perder a remuneração do repouso semanal)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-024', 'Ausência amparada não vira falta', 'alternativo', 'alta', 'aprovado', 'Férias, atestado, afastamento e as hipóteses do art. 473 têm regime próprio.', 'Colaborador com cada situação, uma por vez.', '[{"acao": "Colaborador em férias", "ordem": 1, "resultado_esperado": "Dia justificado, saldo zero, sem falta e sem alerta"}, {"acao": "Colaborador com atestado aceito", "ordem": 2, "resultado_esperado": "Dia justificado, sem perda de DSR"}, {"acao": "Colaborador afastado pelo INSS", "ordem": 3, "resultado_esperado": "Contrato suspenso; dia não gera falta nem saldo"}, {"acao": "Falta amparada pelo art. 473 (ex.: falecimento de cônjuge)", "ordem": 4, "resultado_esperado": "Justificada, sem perda de DSR"}]', 'Cada amparo legal produz o efeito próprio, distinto da falta injustificada.', 'O passo 4 costuma faltar: o art. 473 lista hipóteses específicas com número de dias próprio, e o sistema precisa distingui-las de "abono genérico".', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 473 (faltas justificadas); Lei 605/1949, art. 6º, §1º (motivos que não retiram o repouso); CLT, art. 476 (suspensão por benefício previdenciário)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-025', 'Colaborador afastado não consegue marcar', 'negativo', 'alta', 'aprovado', 'Durante a suspensão não há prestação de serviço a registrar.', 'Colaborador com afastamento ativo.', '[{"acao": "Tentar marcar durante o afastamento", "ordem": 1, "resultado_esperado": "Recusado com mensagem explicativa; nada gravado"}, {"acao": "Conferir se ficou registro parcial", "ordem": 2, "resultado_esperado": "Nenhum"}, {"acao": "Marcar após o retorno formal", "ordem": 3, "resultado_esperado": "Aceito normalmente"}]', 'A suspensão impede o registro, e o retorno o restabelece.', 'Note a tensão deliberada com o PONTO-002: aqui a recusa NÃO é restrição de horário, é ausência de contrato em curso. A distinção precisa estar clara na mensagem ao trabalhador. Requisitos YE-DP-AFAST-001: o lado AFASTAMENTOS (registro, efeito e reflexo) está em AFAST-010..080.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 476 (suspensão do contrato durante benefício previdenciário)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-040', 'Variação de até 5 minutos por marcação não é computada', 'feliz', 'critica', 'aprovado', 'A tolerância é bilateral: não desconta e não paga.', 'Escala 08:00–17:00.', '[{"acao": "Marcações 08:03, 12:00, 13:00, 17:00", "ordem": 1, "resultado_esperado": "Sem desconto e sem hora extra; considera-se 08:00"}, {"acao": "Marcações 07:57, 12:00, 13:00, 17:00", "ordem": 2, "resultado_esperado": "Igualmente neutro — a tolerância vale para os dois lados"}]', 'Variação dentro do limite é neutra em ambos os sentidos.', 'O passo 2 é o lado esquecido: sistemas costumam tolerar o atraso e computar a antecipação como extra, o que contraria o §1º.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º: variações de até 5 minutos por marcação, limitadas a 10 minutos diários, não são descontadas nem computadas como jornada extraordinária', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-041', 'Fronteira exata dos 5 minutos por marcação', 'excecao', 'critica', 'aprovado', 'É a borda mais cara do módulo: errar aqui muda a base de cálculo de toda a hora extra da empresa.', 'Escala 08:00–17:00.', '[{"acao": "Entrada às 08:05, exatamente no limite", "ordem": 1, "resultado_esperado": "Dentro da tolerância — nada computado"}, {"acao": "Entrada às 08:06, um minuto além", "ordem": 2, "resultado_esperado": "Estourou: computam-se os 6 minutos INTEGRALMENTE, não apenas 1"}, {"acao": "Saída às 17:05", "ordem": 3, "resultado_esperado": "Dentro da tolerância"}, {"acao": "Saída às 17:07", "ordem": 4, "resultado_esperado": "Computam-se os 7 minutos integralmente (Súmula 366)"}]', 'No limite exato é neutro; um minuto além computa tudo.', 'A Súmula 366 é contraintuitiva e é onde a maioria dos motores erra: computa-se o excedente à JORNADA, não o excedente à TOLERÂNCIA. Sete minutos viram sete, nunca dois.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º; JURISPRUDÊNCIA CONSOLIDADA — TST, Súmula 366: ultrapassado o limite, computa-se a TOTALIDADE do tempo que exceder a jornada, não apenas o excedente à tolerância', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-042', 'Teto diário de 10 minutos, independente do limite por marcação', 'excecao', 'critica', 'aprovado', 'São dois tetos cumulativos. Respeitar só o de 5 minutos por marcação deixa passar 20 minutos diários em quatro batidas.', 'Escala 08:00–17:00 com quatro marcações.', '[{"acao": "Variações de 4 minutos em cada uma das 4 marcações, somando 16", "ordem": 1, "resultado_esperado": "Cada uma está dentro dos 5, MAS o teto diário de 10 estourou: computa-se integralmente o excedente à jornada"}, {"acao": "Variações somando exatamente 10 minutos", "ordem": 2, "resultado_esperado": "Dentro do teto — nada computado"}, {"acao": "Variações somando 11 minutos", "ordem": 3, "resultado_esperado": "Estourou; computa-se tudo"}]', 'Os dois tetos valem ao mesmo tempo; estourar qualquer um computa a totalidade.', 'O passo 1 é o caso clássico e o mais provável de estar errado.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º: limitadas a 10 minutos diários; TST, Súmula 366', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-043', 'Cadastro de tolerância acima do limite legal é recusado', 'negativo', 'critica', 'aprovado', 'A Súmula 449 fecha a porta inclusive para a negociação coletiva. O sistema não pode oferecer o parâmetro fora da faixa.', 'Tela de parâmetros de jornada.', '[{"acao": "Gravar tolerância de 12 minutos por marcação", "ordem": 1, "resultado_esperado": "RECUSADO, com mensagem citando o limite legal"}, {"acao": "Gravar 15 minutos alegando previsão em CCT", "ordem": 2, "resultado_esperado": "RECUSADO — a Súmula 449 invalida a ampliação por norma coletiva"}, {"acao": "Gravar tolerância zero", "ordem": 3, "resultado_esperado": "ACEITO — reduzir é permitido; toda variação passa a ser computada"}, {"acao": "Gravar valor negativo", "ordem": 4, "resultado_esperado": "RECUSADO"}]', 'A faixa aceita é de 0 a 5 minutos por marcação e 0 a 10 diários.', 'O passo 2 é o mais importante e o menos óbvio: é comum o sistema liberar o campo "porque a CCT permite". A Súmula 449 diz que não permite. Requisitos YE-DP-PONTO-001: RN-004 — CCT/ACT pode fixar tolerância MAIS benéfica que a legal; a trava é só para cima.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 58, §1º; JURISPRUDÊNCIA CONSOLIDADA — TST, Súmula 449: é inválida cláusula de norma coletiva que amplie o limite de tolerância previsto em lei', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-060', 'Supressão parcial do intervalo paga apenas o período suprimido', 'excecao', 'critica', 'aprovado', 'A regra mudou em 2017 e muitos sistemas ainda calculam pela anterior, que pagava a hora inteira com natureza salarial e reflexos.', 'Jornada de 8h, intervalo mínimo de 1h.', '[{"acao": "Marcações 08:00, 12:00, 12:40, 17:00 — intervalo de 40 minutos", "ordem": 1, "resultado_esperado": "20 minutos suprimidos, com acréscimo de 50%"}, {"acao": "Conferir a natureza da verba", "ordem": 2, "resultado_esperado": "INDENIZATÓRIA, sem reflexos em DSR, férias, 13º ou FGTS"}, {"acao": "Conferir se foi lançado como hora extra", "ordem": 3, "resultado_esperado": "NÃO — é grandeza própria, com rubrica própria"}, {"acao": "Conferir a saída para a folha", "ordem": 4, "resultado_esperado": "Rubrica indenizatória; a folha não pode consumir como salarial"}]', 'Paga-se o suprimido, com 50%, como verba indenizatória.', 'Os passos 2 e 3 são o achado: a saída do cálculo não é "1 hora extra", é "X minutos suprimidos". Lançar como hora extra gera reflexos indevidos e distorce a base do eSocial.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 71, §4º (redação da Lei 13.467/2017): a não concessão total ou parcial gera pagamento de natureza INDENIZATÓRIA apenas do período suprimido, com acréscimo de 50% sobre a hora normal', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-061', 'Intervalo integralmente suprimido', 'excecao', 'critica', 'aprovado', 'Nenhuma pausa em jornada superior a 6 horas.', 'Jornada de 8h sem pré-assinalação.', '[{"acao": "Apenas 08:00 e 17:00", "ordem": 1, "resultado_esperado": "60 minutos suprimidos"}, {"acao": "Conferir alerta", "ordem": 2, "resultado_esperado": "Gerado no dia, para permitir correção antes do fechamento"}, {"acao": "Conferir se o sistema deduziu intervalo que não houve", "ordem": 3, "resultado_esperado": "NÃO — sem pré-assinalação, não se presume pausa"}]', 'A supressão total é apurada e alertada.', 'O passo 3 é o negativo crítico: deduzir 1 hora "porque a escala prevê" é inventar pausa não ocorrida e subdimensionar a jornada.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 71, caput e §4º', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-062', 'Faixas de intervalo conforme a duração da jornada', 'alternativo', 'alta', 'aprovado', 'O mínimo aplicável depende da faixa da jornada. Aplicar 1 hora a todas as jornadas gera supressão fictícia nas curtas.', 'Colaboradores com jornadas de durações diferentes.', '[{"acao": "Jornada de 4 horas, sem intervalo", "ordem": 1, "resultado_esperado": "Nenhuma supressão — abaixo da faixa que exige pausa"}, {"acao": "Jornada de exatamente 6 horas, sem intervalo", "ordem": 2, "resultado_esperado": "Mínimo de 15 minutos aplicável — 15 suprimidos"}, {"acao": "Jornada de 6h01, intervalo de 15 minutos", "ordem": 3, "resultado_esperado": "Passou a exigir 1 hora — 45 minutos suprimidos"}, {"acao": "Jornada de 5 horas com intervalo de 10 minutos", "ordem": 4, "resultado_esperado": "5 minutos suprimidos (mínimo de 15)"}]', 'Cada faixa aplica o seu mínimo, com virada no ponto exato.', 'O passo 3 é a fronteira: 6 horas exatas e 6h01 caem em regimes diferentes, com salto de 15 minutos para 1 hora.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 71, caput (mais de 6 horas: mínimo de 1 hora, máximo de 2) e §1º (entre 4 e 6 horas: 15 minutos)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-063', 'Redução do intervalo por norma coletiva respeita o piso de 30 minutos', 'alternativo', 'alta', 'aprovado', 'A negociação coletiva pode reduzir, mas há piso absoluto.', 'Empresa com CCT que reduz o intervalo.', '[{"acao": "Parametrizar intervalo de 30 minutos por CCT e cumprir 30", "ordem": 1, "resultado_esperado": "Nenhuma supressão; a memória indica a origem do parâmetro"}, {"acao": "Tentar parametrizar 20 minutos", "ordem": 2, "resultado_esperado": "RECUSADO — abaixo do piso do art. 611-A, III"}, {"acao": "Conferir a memória de cálculo", "ordem": 3, "resultado_esperado": "Indica que o mínimo veio de norma coletiva, com vigência"}]', 'A redução é possível até 30 minutos e a origem fica registrada.', 'O passo 3 importa para defesa: apurar com parâmetro reduzido sem registrar o instrumento que autorizou deixa o cálculo sem lastro.', 'api', 'CONDICIONADA A CCT/ACT — CLT, art. 611-A, III: norma coletiva pode reduzir o intervalo, respeitado o mínimo de 30 minutos para jornadas superiores a 6 horas', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-064', 'Pré-assinalação deduz intervalo previsto e fica visível', 'alternativo', 'media', 'aprovado', 'Permite operar com duas marcações, desde que o intervalo previsto seja declarado e visível.', 'Colaborador com pré-assinalação configurada.', '[{"acao": "Marcações 08:00 e 17:00 com pré-assinalação de 1 hora", "ordem": 1, "resultado_esperado": "Intervalo previsto deduzido; dia regular"}, {"acao": "Conferir o espelho", "ordem": 2, "resultado_esperado": "Indica expressamente que o intervalo foi pré-assinalado, não marcado"}, {"acao": "Colaborador registra o intervalo real, menor que o previsto", "ordem": 3, "resultado_esperado": "O real prevalece sobre o pré-assinalado; supressão apurada"}]', 'A pré-assinalação é presunção que cede diante da marcação real.', 'O passo 3 é essencial: pré-assinalação que ignora batida real vira ficção de pausa.', 'api', 'CONDICIONADA AO ENQUADRAMENTO — CLT, art. 74, §2º e regulamentação do registro; a pré-assinalação do intervalo é prática admitida no controle de jornada', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-080', 'Descanso mínimo de 11 horas entre jornadas', 'excecao', 'alta', 'aprovado', 'A supressão do descanso é violação autônoma, independente de haver hora extra.', 'Duas jornadas consecutivas.', '[{"acao": "Saída às 23:00 e entrada às 07:00 do dia seguinte", "ordem": 1, "resultado_esperado": "3 horas de descanso suprimido registradas como grandeza própria; alerta gerado"}, {"acao": "Saída às 20:00 e entrada às 07:00 — exatamente 11 horas", "ordem": 2, "resultado_esperado": "Nenhuma supressão"}, {"acao": "Saída às 20:00 e entrada às 06:59", "ordem": 3, "resultado_esperado": "1 minuto suprimido — a fronteira é exata"}, {"acao": "Conferir a interjornada na virada de fim de semana", "ordem": 4, "resultado_esperado": "Contada entre jornadas efetivas, não por dia de calendário"}]', 'O descanso é medido entre jornadas reais, com fronteira exata em 11 horas.', 'A auditoria indica que a detecção existe em outro módulo (Análise de Jornada), duplicada. O RQ-005 pede implementação única — duas implementações da mesma regra divergem com o tempo.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 66: descanso mínimo de 11 horas consecutivas entre duas jornadas', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-090', 'Hora extra em dia útil com adicional mínimo de 50%', 'feliz', 'critica', 'aprovado', 'É a apuração central do módulo e a que hoje não existe.', 'Escala 8h, jornada 08:00–17:00.', '[{"acao": "Marcações 08:00, 12:00, 13:00, 18:30", "ordem": 1, "resultado_esperado": "90 minutos na faixa de 50%"}, {"acao": "Conferir o percentual aplicado", "ordem": 2, "resultado_esperado": "50% é PISO; percentual maior de CCT prevalece se houver"}, {"acao": "Conferir a memória", "ordem": 3, "resultado_esperado": "Mostra jornada esperada, realizada, excedente e o percentual com sua origem"}]', 'A hora extra é apurada por faixa, com percentual parametrizável acima do piso.', 'O passo 2 é a razão de o percentual nunca poder ser constante no código: 50% é mínimo constitucional, e CCTs frequentemente preveem 60%, 70% ou 100%.', 'api', 'OBRIGAÇÃO LEGAL — CF/1988, art. 7º, XVI (mínimo de 50% sobre a hora normal); CLT, art. 59, §1º', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-091', 'Horas normais usam a jornada real da escala, não 8 horas fixas', 'alternativo', 'critica', 'aprovado', 'Jornada contratual menor é limite contratual. Tratar 8 horas como padrão universal apaga a hora extra de quem tem jornada de 6.', 'Colaborador com jornada contratual de 6 horas.', '[{"acao": "20 dias trabalhados de 6 horas", "ordem": 1, "resultado_esperado": "120 horas normais, não 160"}, {"acao": "Jornada de 6h30 num dia de 6 horas", "ordem": 2, "resultado_esperado": "30 minutos de hora extra"}, {"acao": "Turno ininterrupto de revezamento", "ordem": 3, "resultado_esperado": "Jornada de 6 horas (CF, art. 7º, XIV), salvo negociação coletiva"}]', 'A jornada esperada vem da escala do colaborador.', 'O passo 2 é onde o erro fere o trabalhador: com 8h fixas como base, a 7ª hora de quem tem jornada de 6 não aparece como extra.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 58, caput ("salvo limite inferior"); CF, art. 7º, XIII (jornada de ATÉ 8 horas)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-092', 'Excesso ao limite de 2 horas extras é apurado E sinalizado', 'excecao', 'alta', 'aprovado', 'Trabalho além do limite legal continua sendo devido — o que se faz é apurar e alertar, nunca deixar de pagar.', 'Colaborador com jornada de 11 horas.', '[{"acao": "Jornada de 11 horas, sendo 8 normais", "ordem": 1, "resultado_esperado": "3 horas extras apuradas INTEGRALMENTE"}, {"acao": "Conferir alerta", "ordem": 2, "resultado_esperado": "Excesso ao limite do art. 59 sinalizado ao RH"}, {"acao": "Conferir se o sistema limitou a apuração a 2 horas", "ordem": 3, "resultado_esperado": "NÃO — limitar a apuração seria deixar de pagar hora trabalhada"}]', 'Apura tudo, sinaliza o excesso.', 'O passo 3 é o negativo mais perigoso deste bloco: um motor que "respeita o limite" truncando a apuração cria passivo em vez de evitá-lo.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59, caput: acréscimo de até 2 horas extras diárias', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-093', 'Prorrogação por necessidade imperiosa tem regime próprio', 'alternativo', 'media', 'aprovado', 'A hipótese existe em lei e tem tratamento distinto do acréscimo comum.', 'Evento registrado como necessidade imperiosa.', '[{"acao": "Marcar a ocorrência como prorrogação do art. 61", "ordem": 1, "resultado_esperado": "Registrada com a hipótese e a justificativa"}, {"acao": "Conferir o tratamento", "ordem": 2, "resultado_esperado": "Distinto do acréscimo comum, conforme a hipótese"}]', 'A hipótese do art. 61 é identificável e tratada à parte.', 'EXIGE VALIDAÇÃO JURÍDICA antes de virar rotina: os efeitos variam conforme a hipótese (força maior, serviços inadiáveis, recuperação de paralisação) e há divergência sobre o adicional aplicável.', 'api', 'CONDICIONADA AO ENQUADRAMENTO — CLT, art. 61 (necessidade imperiosa, força maior ou serviços inadiáveis, com regras próprias de limite e comunicação)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-110', 'Adicional noturno urbano de 20% na janela das 22h às 5h', 'feliz', 'critica', 'aprovado', 'Base do cálculo noturno.', 'Colaborador urbano.', '[{"acao": "Jornada das 18:00 às 23:30", "ordem": 1, "resultado_esperado": "Adicional apenas sobre os 90 minutos após as 22:00"}, {"acao": "Jornada das 22:00 às 06:00", "ordem": 2, "resultado_esperado": "Adicional sobre 22:00–05:00; das 05:00 às 06:00 segue a regra da prorrogação (PONTO-112)"}, {"acao": "Jornada das 08:00 às 17:00", "ordem": 3, "resultado_esperado": "Nenhum adicional noturno"}, {"acao": "Conferir o percentual", "ordem": 4, "resultado_esperado": "20% é PISO; percentual maior de CCT prevalece"}]', 'O adicional incide sobre os minutos dentro da janela legal.', 'Implementado como parâmetro na escala e não consumido por motor nenhum.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 73, caput (mínimo de 20%) e §2º (período noturno urbano: das 22h de um dia às 5h do dia seguinte)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-111', 'Hora ficta noturna de 52 minutos e 30 segundos', 'excecao', 'critica', 'aprovado', 'A hora ficta AUMENTA a quantidade de horas noturnas apuradas. Ignorá-la subdimensiona a jornada de quem trabalha à noite.', 'Colaborador urbano em jornada integralmente noturna.', '[{"acao": "Jornada das 22:00 às 05:00 — 7 horas de relógio", "ordem": 1, "resultado_esperado": "8 horas noturnas apuradas (7h ÷ 52min30s), com a conversão demonstrada na memória"}, {"acao": "Conferir o efeito no saldo", "ordem": 2, "resultado_esperado": "A conversão pode gerar hora extra mesmo sem o trabalhador exceder o relógio"}, {"acao": "Conferir a memória de cálculo", "ordem": 3, "resultado_esperado": "Mostra minutos de relógio, fator de conversão e horas resultantes"}]', 'A hora ficta é aplicada e a conversão é auditável.', 'O passo 2 é o efeito que surpreende o RH: 7 horas de relógio viram 8 horas de jornada, e a diferença é hora extra devida. Sem a memória do passo 3, ninguém entende de onde veio.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 73, §1º: a hora do trabalho noturno urbano é computada como 52 minutos e 30 segundos', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-112', 'Prorrogação da jornada noturna mantém o adicional', 'excecao', 'critica', 'aprovado', 'Sem a Súmula 60, II, o adicional cessaria às 5h e a prorrogação ficaria sem adicional — resultado que o TST já rejeitou.', 'Colaborador urbano em jornada noturna prorrogada.', '[{"acao": "Jornada das 22:00 às 07:00", "ordem": 1, "resultado_esperado": "Adicional também sobre 05:00–07:00, por prorrogação"}, {"acao": "Jornada das 02:00 às 07:00 — não cumpriu integralmente o período noturno", "ordem": 2, "resultado_esperado": "A Súmula 60, II exige cumprimento integral; tratar conforme a orientação, com a razão registrada"}, {"acao": "Conferir a hora ficta nas horas prorrogadas", "ordem": 3, "resultado_esperado": "Conforme orientação jurídica adotada, registrada na memória"}]', 'A prorrogação carrega o adicional quando a jornada noturna foi integralmente cumprida.', 'EXIGE VALIDAÇÃO JURÍDICA no passo 3: a aplicação da hora ficta às horas prorrogadas é controvertida. O caso registra a pergunta em vez de fingir que há resposta pacífica.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 73, §5º; JURISPRUDÊNCIA CONSOLIDADA — TST, Súmula 60, II: cumprida integralmente a jornada no período noturno e prorrogada esta, o adicional é devido também sobre as horas prorrogadas', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-113', 'Trabalhador rural tem janela, percentual e regra próprios', 'alternativo', 'alta', 'aprovado', 'O regime rural é integralmente diferente do urbano nos três eixos.', 'Colaboradores rurais de lavoura e de pecuária.', '[{"acao": "Rural lavoura, jornada das 20:00 às 04:00", "ordem": 1, "resultado_esperado": "Janela 21:00–05:00, adicional de 25%, sem hora ficta"}, {"acao": "Rural pecuária, mesma jornada", "ordem": 2, "resultado_esperado": "Janela 20:00–04:00 — diferente da lavoura"}, {"acao": "Conferir se aplicou hora ficta", "ordem": 3, "resultado_esperado": "NÃO — a Lei 5.889/1973 não prevê hora ficta"}, {"acao": "Conferir o percentual", "ordem": 4, "resultado_esperado": "25%, não 20%"}]', 'O enquadramento rural aplica as três regras próprias simultaneamente.', 'Este caso sozinho demonstra por que janela, percentual e hora ficta precisam ser parâmetros por enquadramento e nunca constantes.', 'api', 'CONDICIONADA AO ENQUADRAMENTO — Lei 5.889/1973, art. 7º: lavoura das 21h às 5h; pecuária das 20h às 4h; adicional de 25%; SEM hora ficta', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-130', 'Trabalho em domingo ou feriado não compensado é pago em dobro', 'excecao', 'critica', 'aprovado', 'A dobra é regime próprio, distinto do adicional de hora extra.', 'Feriado nacional cadastrado.', '[{"acao": "Jornada integral em feriado nacional sem folga compensatória", "ordem": 1, "resultado_esperado": "Pagamento em dobro, sem prejuízo do repouso"}, {"acao": "Mesmo feriado, com folga compensatória concedida", "ordem": 2, "resultado_esperado": "Sem dobra; a compensação é registrada e rastreável"}, {"acao": "Trabalho em domingo que é o repouso semanal", "ordem": 3, "resultado_esperado": "Mesmo tratamento da Súmula 146"}, {"acao": "Conferir alerta", "ordem": 4, "resultado_esperado": "Trabalho em feriado sem compensação sinalizado ao RH"}]', 'A dobra é aplicada quando não há compensação, e a compensação é comprovável.', 'O passo 2 exige que o sistema saiba se houve folga compensatória — informação que precisa existir para a dobra não ser aplicada indevidamente.', 'api', 'JURISPRUDÊNCIA CONSOLIDADA — TST, Súmula 146: o trabalho em domingos e feriados, não compensado, é pago em dobro, sem prejuízo da remuneração do repouso; OBRIGAÇÃO LEGAL — CLT, art. 67', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-131', 'Feriado é reconhecido pela abrangência e pela unidade do colaborador', 'alternativo', 'alta', 'aprovado', 'Feriado municipal vale para a unidade daquele município e para nenhuma outra.', 'Empresa com unidades em municípios diferentes.', '[{"acao": "Feriado municipal da unidade A, colaborador da unidade A sem marcação", "ordem": 1, "resultado_esperado": "Dia registrado como FERIADO, não como falta"}, {"acao": "Mesmo feriado, colaborador da unidade B", "ordem": 2, "resultado_esperado": "Dia útil normal; falta se não houver marcação"}, {"acao": "Feriado estadual", "ordem": 3, "resultado_esperado": "Aplica-se a todas as unidades daquele estado"}, {"acao": "Feriado nacional", "ordem": 4, "resultado_esperado": "Aplica-se a todas as unidades"}]', 'A abrangência do feriado governa quem é afetado.', 'O passo 2 é o erro que gera falta indevida em massa: aplicar feriado municipal a toda a empresa.', 'api', 'OBRIGAÇÃO LEGAL — Lei 605/1949 e Lei 9.093/1995 (feriados civis e religiosos, inclusive municipais)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-132', 'Falta injustificada retira a remuneração do repouso da semana', 'excecao', 'alta', 'aprovado', 'É consequência automática e frequentemente não implementada.', 'Semana com uma falta.', '[{"acao": "Uma falta injustificada na semana", "ordem": 1, "resultado_esperado": "Perda do DSR daquela semana, calculada como valor"}, {"acao": "Falta com atestado aceito", "ordem": 2, "resultado_esperado": "Sem perda do repouso"}, {"acao": "Atraso, sem falta", "ordem": 3, "resultado_esperado": "Conferir a regra adotada e registrá-la expressamente"}, {"acao": "Conferir a saída", "ordem": 4, "resultado_esperado": "DSR como VALOR devido ou perdido, não como marcação de sim ou não"}]', 'O DSR é apurado como valor e responde às faltas da semana.', 'O passo 3 EXIGE VALIDAÇÃO: o art. 6º fala em falta; o efeito do atraso sobre o repouso depende de interpretação e de norma coletiva. Registrar a decisão em vez de assumir. | Requisitos YE-DP-ESC-001: a perda do DSR por falta injustificada (RN-007) segue aqui; o reflexo da HE no DSR (Súmula 172) é o FOLHA-022.', 'api', 'OBRIGAÇÃO LEGAL — Lei 605/1949, art. 6º: a falta injustificada na semana faz o empregado perder a remuneração do repouso semanal', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-133', 'Semana sem 24 horas consecutivas de repouso gera alerta', 'excecao', 'alta', 'aprovado', 'Trabalhar sete dias seguidos é violação autônoma, ainda que tudo seja pago.', 'Colaborador que trabalhou todos os dias da semana.', '[{"acao": "Marcações em todos os sete dias", "ordem": 1, "resultado_esperado": "Alerta de ausência de repouso semanal"}, {"acao": "Conferir se o repouso foi de 24 horas CONSECUTIVAS", "ordem": 2, "resultado_esperado": "Folgas fracionadas não satisfazem o art. 67"}, {"acao": "Conferir a preferência pelo domingo", "ordem": 3, "resultado_esperado": "Sinalizada quando o repouso recai sistematicamente em outro dia"}]', 'A ausência de repouso é detectada mesmo quando as horas são pagas.', 'O passo 2 é sutil e importante: duas folgas de 12 horas não equivalem a 24 consecutivas.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 67: repouso semanal remunerado de 24 horas consecutivas, preferencialmente aos domingos', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-150', 'Escala 12x36 apura ciclo de trabalho e folga', 'feliz', 'alta', 'aprovado', 'A escala tem regime próprio e depende de instrumento que a autorize.', 'Colaborador em 12x36 com instrumento vigente.', '[{"acao": "Dia de trabalho do ciclo, 12 horas registradas", "ordem": 1, "resultado_esperado": "Jornada esperada de 12h, saldo zero"}, {"acao": "Dia de folga do ciclo, sem marcação", "ordem": 2, "resultado_esperado": "Folga; sem falta e sem saldo negativo"}, {"acao": "Conferir a existência do instrumento", "ordem": 3, "resultado_esperado": "Sem acordo escrito ou norma coletiva, a escala não pode ser aplicada"}]', 'O ciclo é calculado a partir de data de referência e sequência.', 'O passo 3 é o que costuma faltar: a 12x36 sem instrumento é jornada de 12 horas comum, com 4 horas extras diárias. | Requisitos YE-DP-ESC-001: a apuração da 12x36 segue aqui; a FORMALIZAÇÃO (acordo escrito/ACT/CCT, art. 59-A) é o ESC-001.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59-A: escala 12x36 mediante acordo individual escrito, convenção ou acordo coletivo', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-151', 'Na 12x36, feriados e prorrogação noturna são compensados', 'excecao', 'alta', 'aprovado', 'É exceção legal expressa. Aplicar a regra geral de feriado à 12x36 gera pagamento indevido.', 'Colaborador em 12x36, feriado coincidindo com dia de escala.', '[{"acao": "Trabalho em feriado no dia de escala", "ordem": 1, "resultado_esperado": "SEM pagamento adicional por feriado; razão registrada na memória"}, {"acao": "Prorrogação noturna na 12x36", "ordem": 2, "resultado_esperado": "Considerada compensada pelo parágrafo único"}, {"acao": "Mesmo cenário em escala 5x2", "ordem": 3, "resultado_esperado": "Regra geral: dobra da Súmula 146 e adicional de prorrogação"}]', 'A exceção do art. 59-A é aplicada apenas a quem está nessa escala.', 'O passo 3 é a contraprova: uma implementação que generalize a exceção deixaria de pagar feriado a toda a empresa. | Requisitos YE-DP-ESC-001: a apuração da 12x36 segue aqui; a FORMALIZAÇÃO (acordo escrito/ACT/CCT, art. 59-A) é o ESC-001.', 'api', 'CONDICIONADA AO ENQUADRAMENTO — CLT, art. 59-A, parágrafo único: na escala 12x36 consideram-se compensados os feriados e as prorrogações de trabalho noturno', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-152', 'Troca de escala preserva o histórico de vigência', 'alternativo', 'critica', 'aprovado', 'Apurar dia antigo com escala nova falsifica o passado.', 'Colaborador com troca de escala no dia 15.', '[{"acao": "Apurar dias 1 a 14", "ordem": 1, "resultado_esperado": "Com a escala ANTERIOR"}, {"acao": "Apurar dias 15 em diante", "ordem": 2, "resultado_esperado": "Com a escala NOVA"}, {"acao": "Reapurar a competência inteira depois da troca", "ordem": 3, "resultado_esperado": "Resultado idêntico ao original — cada dia com a escala da sua data"}, {"acao": "Tentar vigência retroativa sobre competência fechada", "ordem": 4, "resultado_esperado": "RECUSADO, com explicação"}]', 'Cada dia é apurado com o parâmetro vigente naquele dia.', 'O passo 3 é o teste real do versionamento: reapurar não pode mudar o passado.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 74 e dever de guarda dos controles; a apuração deve usar o parâmetro vigente na data do fato gerador', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-153', 'Alteração de parâmetro não altera competência já apurada', 'excecao', 'critica', 'aprovado', 'Parâmetros versionados por vigência são o que separa auditoria de reescrita da história.', 'Competência anterior já apurada.', '[{"acao": "Alterar hoje o percentual de hora extra", "ordem": 1, "resultado_esperado": "Nova versão do parâmetro, com vigência a partir de hoje"}, {"acao": "Reapurar o mês passado", "ordem": 2, "resultado_esperado": "Resultado idêntico ao original, com a versão ANTIGA do parâmetro"}, {"acao": "Conferir a memória do mês passado", "ordem": 3, "resultado_esperado": "Indica qual versão do parâmetro foi usada"}]', 'Reapuração é reprodução, não recálculo com regras novas.', 'Sem isso, qualquer ajuste de parâmetro reescreve meses fechados e destrói o valor probatório do espelho já entregue.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 74; princípio da apuração pela norma vigente na data do fato gerador', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-170', 'Hora extra só vai para banco se houver instrumento vigente', 'excecao', 'critica', 'aprovado', 'Sem instrumento, a hora extra é devida em dinheiro. Mandar para banco sem lastro é postergar pagamento devido.', 'Colaborador sem acordo de compensação.', '[{"acao": "Hora extra realizada sem instrumento vigente", "ordem": 1, "resultado_esperado": "Direcionada a PAGAMENTO, não a banco; alerta ao RH"}, {"acao": "Colaborador com acordo individual escrito", "ordem": 2, "resultado_esperado": "Pode ir para banco, prazo de 6 meses (§5º)"}, {"acao": "Colaborador com instrumento coletivo", "ordem": 3, "resultado_esperado": "Pode ir para banco, prazo de até 12 meses (§2º)"}, {"acao": "Compensação dentro do mesmo mês", "ordem": 4, "resultado_esperado": "Admitida por acordo individual, inclusive tácito (§6º)"}]', 'O destino da hora extra segue o instrumento aplicável àquele colaborador.', 'Os prazos NÃO são um número único: 6 meses, 12 meses ou mesmo mês, conforme o instrumento. O sistema precisa saber qual se aplica a cada pessoa. | Requisitos YE-DP-ESC-001: os regimes, prazos e a conversão do banco de horas seguem donos aqui (RN-002/RN-008 do documento); o extrato no portal do colaborador é o ESC-030.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59, §§2º, 5º e 6º: o banco de horas depende de convenção, acordo coletivo ou acordo individual escrito, conforme o prazo', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-171', 'Saldo não compensado no prazo vira hora extra devida', 'excecao', 'critica', 'aprovado', 'Vencido o prazo, a compensação deixa de ser possível e a hora vira crédito em dinheiro.', 'Saldo positivo com prazo vencido.', '[{"acao": "Saldo positivo após a data de vencimento", "ordem": 1, "resultado_esperado": "Convertido em hora extra devida, com movimentação e evidência"}, {"acao": "Conferir a data de vencimento", "ordem": 2, "resultado_esperado": "Calculada a partir do instrumento, não de constante"}, {"acao": "Saldo a 30 dias do vencimento", "ordem": 3, "resultado_esperado": "Alerta gerado com antecedência para permitir compensação"}, {"acao": "Conferir se o saldo simplesmente expirou", "ordem": 4, "resultado_esperado": "NÃO — saldo não desaparece; vira crédito"}]', 'O vencimento converte, nunca elimina.', 'O passo 4 é o negativo grave: zerar saldo vencido é apropriação de hora trabalhada. | Requisitos YE-DP-ESC-001: os regimes, prazos e a conversão do banco de horas seguem donos aqui (RN-002/RN-008 do documento); o extrato no portal do colaborador é o ESC-030.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59, §§2º e 5º (prazos de compensação); §3º (pagamento das horas não compensadas)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-172', 'Compensação respeita o limite de 10 horas diárias', 'excecao', 'alta', 'aprovado', 'O limite é do regime de compensação e independe do limite de 2 horas extras.', 'Colaborador em regime de banco de horas.', '[{"acao": "Jornada de 11 horas em regime de compensação", "ordem": 1, "resultado_esperado": "Alerta de excesso ao limite do §2º; horas apuradas integralmente"}, {"acao": "Jornada de exatamente 10 horas", "ordem": 2, "resultado_esperado": "Dentro do limite"}, {"acao": "Saldo ultrapassa o limite de acúmulo parametrizado", "ordem": 3, "resultado_esperado": "Alerta conforme configuração; sem bloquear a apuração"}]', 'Os limites geram alerta e nunca truncam a apuração.', 'Mesma lógica do PONTO-092: sinalizar sem deixar de apurar.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59, §2º: compensação sem exceder 10 horas diárias', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-173', 'Rescisão com saldo de banco de horas', 'excecao', 'critica', 'aprovado', 'A base de cálculo é a remuneração da rescisão, não a da época em que a hora foi trabalhada.', 'Colaborador em desligamento com saldo positivo.', '[{"acao": "Iniciar desligamento com saldo positivo", "ordem": 1, "resultado_esperado": "Saldo apresentado; conclusão bloqueada sem tratamento"}, {"acao": "Conferir a base de cálculo", "ordem": 2, "resultado_esperado": "Remuneração da data da rescisão, conforme §3º"}, {"acao": "Saldo NEGATIVO na rescisão", "ordem": 3, "resultado_esperado": "Tratamento conforme orientação jurídica, registrado"}, {"acao": "Conferir integração com o módulo de Desligamento", "ordem": 4, "resultado_esperado": "O saldo chega às verbas rescisórias"}]', 'Nenhum desligamento conclui com saldo de banco sem tratamento.', 'O passo 3 EXIGE VALIDAÇÃO: o desconto de saldo negativo na rescisão é controvertido. Conecta com DESL-100 e DESL-101, já documentados.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59, §3º: na rescisão sem compensação integral, pagamento das horas não compensadas sobre a remuneração da DATA DA RESCISÃO', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-174', 'Habitualidade de hora extra não invalida o acordo de compensação', 'negativo', 'media', 'aprovado', 'Regra pós-reforma que inverteu entendimento anterior. Sistema que invalida o banco por habitualidade aplica direito revogado.', 'Colaborador com hora extra habitual e banco vigente.', '[{"acao": "Hora extra em todos os dias do mês, com banco vigente", "ordem": 1, "resultado_esperado": "Acordo permanece válido; horas seguem para banco"}, {"acao": "Conferir se o sistema descaracterizou o acordo", "ordem": 2, "resultado_esperado": "NÃO — o art. 59-B veda essa consequência"}]', 'A habitualidade não desfaz o regime de compensação.', 'Caso de proteção contra implementação baseada em jurisprudência anterior à Lei 13.467/2017.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 59-B, parágrafo único: a prestação habitual de horas extras não descaracteriza o acordo de compensação', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-175', 'Reapuração preserva lançamento manual', 'excecao', 'alta', 'aprovado', 'Lançamento manual tem autor e justificativa. Regenerá-lo apaga decisão humana registrada.', 'Banco com movimentações automáticas e um lançamento manual.', '[{"acao": "Reapurar a competência", "ordem": 1, "resultado_esperado": "Movimentações automáticas regeneradas"}, {"acao": "Conferir o lançamento manual", "ordem": 2, "resultado_esperado": "PRESERVADO, com autor e justificativa intactos"}, {"acao": "Conferir o saldo final", "ordem": 3, "resultado_esperado": "Coerente, sem duplicar nem perder o manual"}]', 'A reapuração recalcula o automático e respeita o manual.', 'Sem isso, cada reapuração apaga correções feitas pelo RH e o saldo oscila sem explicação.', 'api', 'BOA PRÁTICA — rastreabilidade do saldo; apoia CLT, art. 59, §3º (o saldo precisa ser reconstituível na rescisão)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-190', 'Ajuste cria batida de correção e preserva a original', 'alternativo', 'critica', 'aprovado', 'É o único caminho legítimo de correção.', 'Marcação esquecida.', '[{"acao": "Colaborador solicita inclusão com motivo", "ordem": 1, "resultado_esperado": "Ajuste pendente; dia sinalizado; aprovador notificado"}, {"acao": "Gestor aprova", "ordem": 2, "resultado_esperado": "Batida de CORREÇÃO criada; original preservada; dia e saldo reapurados"}, {"acao": "Conferir o espelho", "ordem": 3, "resultado_esperado": "Mostra original e correção, com autor, data e motivo"}, {"acao": "Gestor rejeita outro ajuste", "ordem": 4, "resultado_esperado": "Status rejeitado; motivo visível ao solicitante; nada alterado no dia"}]', 'A correção é acréscimo rastreável, com aprovação registrada.', 'A auditoria indica que esse fluxo está bem construído. É caso de proteção do que já funciona.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (inalterabilidade das marcações); TST, Súmula 338', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-191', 'Cadeia de hash detecta alteração direta no banco', 'excecao', 'critica', 'aprovado', 'Encadeamento criptográfico é o que transforma "não editamos" em prova.', 'Marcações gravadas com hash encadeado.', '[{"acao": "Alterar um registro direto no banco", "ordem": 1, "resultado_esperado": "A rotina de verificação DETECTA e reporta a inconsistência"}, {"acao": "Conferir a cobertura do hash", "ordem": 2, "resultado_esperado": "Toda batida, original ou de correção, tem hash encadeado com a anterior"}, {"acao": "Conferir a periodicidade da verificação", "ordem": 3, "resultado_esperado": "Executada por rotina, não apenas sob demanda"}]', 'A cadeia é homogênea e verificada.', 'O passo 2 é o gap indicado na auditoria: o hash não é homogêneo entre batidas originais e ajustadas, o que deixa lacuna na cadeia.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (inalterabilidade e armazenamento de registro de ponto); TST, Súmula 338', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-192', 'Trilha de auditoria é completa e não pode ser apagada', 'negativo', 'critica', 'aprovado', 'Trilha que pode ser apagada não é trilha.', 'Módulo em operação.', '[{"acao": "Executar todas as operações relevantes do módulo", "ordem": 1, "resultado_esperado": "Cada uma gera registro com autor, data, valor anterior e posterior"}, {"acao": "Tentar excluir registro da trilha por qualquer caminho", "ordem": 2, "resultado_esperado": "IMPOSSÍVEL"}, {"acao": "Tentar alterar registro da trilha", "ordem": 3, "resultado_esperado": "IMPOSSÍVEL"}, {"acao": "Conferir se a trilha registra tentativas negadas", "ordem": 4, "resultado_esperado": "Sim — tentativa recusada também é evento auditável"}]', 'A trilha é completa, imutável e registra inclusive o que foi negado.', 'O passo 4 é frequentemente esquecido e é o que permite detectar tentativa de fraude. Requisitos YE-DP-PONTO-001: seção 23 — a trilha também deve capturar ACESSOS a dados sensíveis e exportações (caso PONTO-397).', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021; LGPD, art. 37 (registro das operações de tratamento)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-193', 'Competência fechada não aceita alteração', 'negativo', 'critica', 'aprovado', 'Alterar competência fechada muda documento já entregue e assinado.', 'Competência fechada.', '[{"acao": "Tentar ajuste em competência fechada", "ordem": 1, "resultado_esperado": "RECUSADO com mensagem explicativa"}, {"acao": "Tentar alterar marcação de período fechado direto pela API", "ordem": 2, "resultado_esperado": "RECUSADO"}, {"acao": "Reabrir formalmente, com motivo e alçada adequada", "ordem": 3, "resultado_esperado": "Reabertura registrada na trilha"}, {"acao": "Fechar novamente", "ordem": 4, "resultado_esperado": "NOVA VERSÃO do espelho; a anterior permanece recuperável"}]', 'O fechamento é barreira, e a reabertura é ato formal versionado.', 'O passo 4 importa: substituir o espelho anterior apagaria o documento que o trabalhador já recebeu.', 'api', 'OBRIGAÇÃO LEGAL — CLT, art. 74 e dever de guarda; o espelho fechado é o documento entregue ao trabalhador', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-194', 'Falha durante o fechamento não deixa espelho parcial', 'excecao', 'alta', 'aprovado', 'Espelho parcial é pior que espelho ausente: parece completo e não é.', 'Fechamento em execução.', '[{"acao": "Interromper o processo no meio", "ordem": 1, "resultado_esperado": "NENHUM espelho parcial persistido"}, {"acao": "Conferir o estado da competência", "ordem": 2, "resultado_esperado": "Continua aberta, sem registro de fechamento"}, {"acao": "Repetir o fechamento", "ordem": 3, "resultado_esperado": "Conclui normalmente, sem duplicar"}]', 'O fechamento é tudo ou nada.', 'Mesma classe do DESL-091: integração não bloqueante que deixa estado intermediário.', 'api', 'BOA PRÁTICA — integridade transacional; apoia CLT, art. 74 (o espelho é documento com valor probatório)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-195', 'Colaborador tem ciência do espelho, com direito a ressalva', 'alternativo', 'alta', 'aprovado', 'Ciência sem possibilidade de discordar não é ciência.', 'Competência fechada.', '[{"acao": "Colaborador acessa o portal após o fechamento", "ordem": 1, "resultado_esperado": "Espelho visível na íntegra"}, {"acao": "Registrar ciência", "ordem": 2, "resultado_esperado": "Gravada com data e identificação"}, {"acao": "Registrar RESSALVA em vez de ciência", "ordem": 3, "resultado_esperado": "Aceita e registrada; o fechamento não a apaga"}, {"acao": "Conferir o espelho depois da ressalva", "ordem": 4, "resultado_esperado": "A ressalva acompanha o documento"}]', 'O trabalhador pode concordar ou discordar, e ambos ficam registrados.', 'O passo 3 é o que distingue ciência real de mero aceite: sistema que só oferece "concordo" produz prova frágil.', 'e2e', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Espelho de Ponto Eletrônico); TST, Súmula 338 (valor probatório dos controles)', 'aguardando_construcao', 'AS-BUILT 2026-08-20: o BANCO suporta (coluna ponto_espelhos.ressalva_texto existe e a onda 6 já bloqueia o fechamento sem ciência — caso 387 verde). Falta a TELA por inteiro: não existe nenhuma interface de ciência/ressalva no módulo (busca por ciência/ressalva/concordar/discordar não achou nada no ponto). O trabalhador não tem onde dar ciência do espelho nem registrar discordância. É a maior das seis telas.'),
    ('PONTO-210', 'AFD é gerado com numeração sequencial sem lacunas', 'feliz', 'critica', 'aprovado', 'A sequência sem lacunas é o que demonstra que nada foi removido.', 'Período com marcações.', '[{"acao": "Gerar AFD por período", "ordem": 1, "resultado_esperado": "Arquivo no leiaute VIGENTE na data da geração"}, {"acao": "Conferir a numeração", "ordem": 2, "resultado_esperado": "Sequencial, sem lacunas"}, {"acao": "Conferir a assinatura", "ordem": 3, "resultado_esperado": "CAdES com certificado ICP-Brasil"}, {"acao": "Conferir a identificação do trabalhador", "ordem": 4, "resultado_esperado": "Por CPF, conforme a Portaria 671"}]', 'O AFD é íntegro, sequencial e assinado.', 'ATENÇÃO DE VIGÊNCIA: o leiaute muda. Este caso verifica CONFORMIDADE COM O LEIAUTE VIGENTE, e não um leiaute específico. Baixar a versão oficial na data do desenvolvimento — nunca implementar a partir de documentação de terceiros.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Arquivo Fonte de Dados, com marcações inalteráveis; no REP-P pode ser fracionado); Portaria MTP 1.486/2022 (assinatura CAdES com certificado ICP-Brasil)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-211', 'AEJ é gerado pelo programa de tratamento', 'feliz', 'critica', 'aprovado', 'O AEJ é a saída obrigatória do PTRP e hoje não existe.', 'Competência fechada, estabelecimento definido.', '[{"acao": "Gerar AEJ", "ordem": 1, "resultado_esperado": "Arquivo no leiaute vigente, assinado, com emissão registrada"}, {"acao": "Conferir a jornada apurada no arquivo", "ordem": 2, "resultado_esperado": "Valores reais; zero apenas onde de fato não houve"}, {"acao": "Conferir a identificação", "ordem": 3, "resultado_esperado": "Por CPF"}]', 'O AEJ existe, é assinado e reflete a apuração real.', 'O passo 2 conecta com o achado central da auditoria: enquanto o motor não calcular, o AEJ levaria zeros — e um AEJ de zeros é declaração formal de que não houve hora extra.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (Arquivo Eletrônico de Jornada, gerado pelo programa de tratamento, substituindo AFDT e ACJEF); Portaria MTP 1.486/2022 (assinatura CAdES)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.'),
    ('PONTO-212', 'Importação de AFD com lacuna é recusada por inteiro', 'negativo', 'alta', 'aprovado', 'Importar arquivo com lacuna incorpora prova adulterada ao acervo.', 'Arquivo AFD com registro faltante na sequência.', '[{"acao": "Importar o arquivo", "ordem": 1, "resultado_esperado": "RECUSADO por inteiro; relatório da inconsistência apresentado"}, {"acao": "Conferir o que foi gravado", "ordem": 2, "resultado_esperado": "NADA — importação parcial é pior que nenhuma"}, {"acao": "Importar arquivo íntegro", "ordem": 3, "resultado_esperado": "Aceito"}]', 'Ou entra íntegro, ou não entra.', 'O passo 2 é o negativo essencial: importação parcial mistura registros de origens distintas sem que ninguém saiba. Requisitos YE-DP-PONTO-001: RF-004 — além da lacuna de NSR, integridade CRC-16/SHA-256/assinatura e quarentena ganharam o caso PONTO-382.', 'api', 'OBRIGAÇÃO LEGAL — Portaria MTE 671/2021 (integridade e inalterabilidade do AFD)', 'aguardando_construcao', 'A regra é obrigação legal e o motor de apuração ainda não existe, conforme a auditoria as-built. Falha esperada e já conhecida — não é novidade a cada relatório. O caso serve como especificação contra a qual construir, com o dispositivo legal ao lado. Reavaliar quando o motor entrar.')
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'jornada-rotina/ponto'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();


-- (3) PONTES — 56 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('ESC-001', 'qa_caso_esc_001', true),
    ('ESC-010', 'qa_caso_esc_010', true),
    ('ESC-011', 'qa_caso_esc_011', true),
    ('ESC-012', 'qa_caso_esc_012', true),
    ('ESC-020', 'qa_caso_esc_020', true),
    ('ESC-021', 'qa_caso_esc_021', true),
    ('ESC-031', 'qa_caso_esc_031', true),
    ('PONTO-001', 'qa_caso_ponto_001', true),
    ('PONTO-003', 'qa_caso_ponto_003', true),
    ('PONTO-004', 'qa_caso_ponto_004', true),
    ('PONTO-020', 'qa_caso_ponto_020', true),
    ('PONTO-021', 'qa_caso_ponto_021', true),
    ('PONTO-022', 'qa_caso_ponto_022', true),
    ('PONTO-023', 'qa_caso_ponto_023', true),
    ('PONTO-024', 'qa_caso_ponto_024', true),
    ('PONTO-025', 'qa_caso_ponto_025', true),
    ('PONTO-040', 'qa_caso_ponto_040', true),
    ('PONTO-041', 'qa_caso_ponto_041', true),
    ('PONTO-042', 'qa_caso_ponto_042', true),
    ('PONTO-043', 'qa_caso_ponto_043', true),
    ('PONTO-060', 'qa_caso_ponto_060', true),
    ('PONTO-061', 'qa_caso_ponto_061', true),
    ('PONTO-062', 'qa_caso_ponto_062', true),
    ('PONTO-063', 'qa_caso_ponto_063', true),
    ('PONTO-064', 'qa_caso_ponto_064', true),
    ('PONTO-080', 'qa_caso_ponto_080', true),
    ('PONTO-090', 'qa_caso_ponto_090', true),
    ('PONTO-091', 'qa_caso_ponto_091', true),
    ('PONTO-092', 'qa_caso_ponto_092', true),
    ('PONTO-093', 'qa_caso_ponto_093', true),
    ('PONTO-110', 'qa_caso_ponto_110', true),
    ('PONTO-111', 'qa_caso_ponto_111', true),
    ('PONTO-112', 'qa_caso_ponto_112', true),
    ('PONTO-113', 'qa_caso_ponto_113', true),
    ('PONTO-130', 'qa_caso_ponto_130', true),
    ('PONTO-131', 'qa_caso_ponto_131', true),
    ('PONTO-132', 'qa_caso_ponto_132', true),
    ('PONTO-133', 'qa_caso_ponto_133', true),
    ('PONTO-150', 'qa_caso_ponto_150', true),
    ('PONTO-151', 'qa_caso_ponto_151', true),
    ('PONTO-152', 'qa_caso_ponto_152', true),
    ('PONTO-153', 'qa_caso_ponto_153', true),
    ('PONTO-170', 'qa_caso_ponto_170', true),
    ('PONTO-171', 'qa_caso_ponto_171', true),
    ('PONTO-172', 'qa_caso_ponto_172', true),
    ('PONTO-173', 'qa_caso_ponto_173', true),
    ('PONTO-174', 'qa_caso_ponto_174', true),
    ('PONTO-175', 'qa_caso_ponto_175', true),
    ('PONTO-190', 'qa_caso_ponto_190', true),
    ('PONTO-191', 'qa_caso_ponto_191', true),
    ('PONTO-192', 'qa_caso_ponto_192', true),
    ('PONTO-193', 'qa_caso_ponto_193', true),
    ('PONTO-194', 'qa_caso_ponto_194', true),
    ('PONTO-210', 'qa_caso_ponto_210', true),
    ('PONTO-211', 'qa_caso_ponto_211', true),
    ('PONTO-212', 'qa_caso_ponto_212', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 61, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('ESC-001'), ('ESC-010'), ('ESC-011'), ('ESC-012'), ('ESC-020'), ('ESC-021'), ('ESC-030'), ('ESC-031'), ('PONTO-001'), ('PONTO-002'), ('PONTO-003'), ('PONTO-004'), ('PONTO-005'), ('PONTO-006'), ('PONTO-020'), ('PONTO-021'), ('PONTO-022'), ('PONTO-023'), ('PONTO-024'), ('PONTO-025'), ('PONTO-040'), ('PONTO-041'), ('PONTO-042'), ('PONTO-043'), ('PONTO-060'), ('PONTO-061'), ('PONTO-062'), ('PONTO-063'), ('PONTO-064'), ('PONTO-080'), ('PONTO-090'), ('PONTO-091'), ('PONTO-092'), ('PONTO-093'), ('PONTO-110'), ('PONTO-111'), ('PONTO-112'), ('PONTO-113'), ('PONTO-130'), ('PONTO-131'), ('PONTO-132'), ('PONTO-133'), ('PONTO-150'), ('PONTO-151'), ('PONTO-152'), ('PONTO-153'), ('PONTO-170'), ('PONTO-171'), ('PONTO-172'), ('PONTO-173'), ('PONTO-174'), ('PONTO-175'), ('PONTO-190'), ('PONTO-191'), ('PONTO-192'), ('PONTO-193'), ('PONTO-194'), ('PONTO-195'), ('PONTO-210'), ('PONTO-211'), ('PONTO-212')),
x AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM alvo) AS esperados,
    (SELECT count(*) FROM alvo a JOIN public.qa_casos_teste c ON c.codigo = a.codigo) AS casos_no_alvo,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_casos_teste c ON c.codigo = a.codigo
       JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NOT NULL) AS com_rotina,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_implementacoes i ON i.codigo = a.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NULL) AS ponte_orfa
)
SELECT esperados, casos_no_alvo, com_rotina, ponte_orfa,
       CASE WHEN casos_no_alvo = esperados AND ponte_orfa = 0
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
