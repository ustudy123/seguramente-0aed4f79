-- ============================================================================
-- QA PONTO — 4ª leva de rotinas: casos da análise de requisitos YE-DP-PONTO-001
-- (PONTO-370..398, documentados em 20260812110000).
--
-- Padrão da casa: cada rotina testa o comportamento que o DOCUMENTO e a LEI
-- exigem. Onde a estrutura nem existe no banco, a rotina audita o catálogo
-- (somente leitura) e FALHA de propósito com o diagnóstico — é o material do
-- relatório para o desenvolvimento. Nada de funcionalidade é alterado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de auditoria (somente leitura do catálogo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_fns_com(p_padrao text)
RETURNS text
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT string_agg(p.proname, ', ')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE p_padrao;
$$;

CREATE OR REPLACE FUNCTION public.qa_col_existe(p_tabela text, p_col_padrao text)
RETURNS text
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT string_agg(table_name || '.' || column_name, ', ')
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (p_tabela IS NULL OR table_name = p_tabela)
    AND column_name ILIKE p_col_padrao;
$$;

-- ---------------------------------------------------------------------------
-- PONTO-370 — Obrigatoriedade acima de 20 trabalhadores por estabelecimento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_370()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de obrigatoriedade por estabelecimento?';
  r.esperado := 'Coluna/função que registre a contagem de trabalhadores e sinalize o controle obrigatório (art. 74, §2º)';

  v_est := coalesce(public.qa_col_existe(NULL, '%obrigator%ponto%'), '')
        || coalesce(public.qa_col_existe(NULL, '%controle%obrigat%'), '')
        || coalesce(public.qa_fns_com('%74%§2%'), '')
        || coalesce(public.qa_fns_com('%obrigatoriedade%jornada%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o sistema não tem nenhuma noção de obrigatoriedade do controle por '
             || 'estabelecimento — não conta os 20 trabalhadores do art. 74, §2º, não sinaliza '
             || 'quem é obrigado e trata todo cliente igual. Consequência: cliente obrigado sem '
             || 'controle ativo não recebe aviso algum, e a Súmula 338 joga a jornada alegada '
             || 'pelo empregado contra ele. Correção: contagem por estabelecimento + sinalização '
             || 'de obrigatoriedade no cadastro, com alerta quando cruzar o limite.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de obrigatoriedade encontrada: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-371 — Controle facultativo sem falsas pendências
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_371()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_flag text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a configuração distingue empresa que optou por NÃO controlar?';
  r.esperado := 'Flag de controle ativo/facultativo por empresa ou estabelecimento';

  SELECT string_agg(column_name, ', ') INTO v_flag
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ponto_configuracao'
    AND (column_name ILIKE '%ativo%' OR column_name ILIKE '%facultativ%'
         OR column_name ILIKE '%habilitad%');

  IF v_flag IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: ponto_configuracao não tem flag de controle ativo/facultativo. Empresa '
             || 'com menos de 20 trabalhadores que NÃO adota controle é tratada igual às demais: '
             || 'a materialização gera falta em todo dia útil sem marcação (PONTO-290) e o painel '
             || 'enche de pendências indevidas. Correção: flag por empresa/estabelecimento que '
             || 'desligue a exigência de marcação (e, ligada, aplique o padrão legal completo).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Flag de controle presente: %s.', v_flag);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-372 — Registro por exceção exige o documento autorizador
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_372()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Ativar modo_apuracao = por_excecao SEM anexar o acordo (ponto_excecao_acordo_url vazio)';
  r.esperado := 'Recusado — o art. 74, §4º exige acordo individual escrito ou instrumento coletivo';

  BEGIN
    INSERT INTO public.ponto_configuracao (tenant_id, modo_apuracao, ponto_excecao_acordo_url)
    VALUES (public.qa_sandbox_tenant_id(), 'por_excecao', NULL);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR not_null_violation OR raise_exception THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco ACEITOU o modo "registro por exceção" sem documento autorizador '
             || '— a coluna ponto_excecao_acordo_url existe (bom sinal), mas nada obriga a '
             || 'preenchê-la. Registro por exceção sem acordo escrito é controle inválido perante '
             || 'o art. 74, §4º. Correção: CHECK/trigger exigindo o acordo anexado (URL não vazia) '
             || 'sempre que modo_apuracao = por_excecao.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O modo por exceção sem documento foi recusado — a exigência do §4º está no banco.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-373/374/375 — Art. 62 e teletrabalho
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_373()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe enquadramento do art. 62 no cadastro?';
  r.esperado := 'Campo que marque o vínculo como dispensado de controle (externo/gestão/tele por produção)';

  v_est := coalesce(public.qa_col_existe(NULL, '%dispensado_ponto%'), '')
        || coalesce(public.qa_col_existe(NULL, '%controle_jornada%'), '')
        || coalesce(public.qa_col_existe(NULL, '%art62%'), '')
        || coalesce(public.qa_col_existe(NULL, '%cargo_confianca%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe campo de enquadramento do art. 62. Gestor, externo e '
             || 'teletrabalhista por produção são tratados como controlados: a materialização '
             || 'gera falta para quem a lei dispensa de marcar. Correção: flag de dispensa de '
             || 'controle no vínculo (com o inciso e o documento de enquadramento), respeitada '
             || 'pela materialização de faltas e pelos alertas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Enquadramento presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_374()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o cadastro distingue teletrabalho por JORNADA de por PRODUÇÃO?';
  r.esperado := 'Campo de modalidade de teletrabalho (Lei 14.442/2022) — só produção/tarefa dispensa controle';

  v_est := coalesce(public.qa_col_existe(NULL, '%teletrabalho%'), '')
        || coalesce(public.qa_col_existe(NULL, '%remoto%'), '')
        || coalesce(public.qa_col_existe(NULL, '%home_office%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma tabela registra a modalidade de teletrabalho. Sem distinguir '
             || 'jornada de produção/tarefa (Lei 14.442/2022), o sistema não sabe quem DEVE '
             || 'continuar marcando remoto — risco nos dois sentidos: cobrar de quem é dispensado '
             || 'ou dispensar quem é controlado. Correção: modalidade no contrato/vínculo, '
             || 'amarrada à exigência de marcação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Modalidade de teletrabalho presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_375()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algo detecta controle de fato sobre dispensado do art. 62?';
  r.esperado := 'Alerta de descaracterização quando um dispensado acumula marcações reais';

  v_fns := public.qa_fns_com('%descaracteriza%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma rotina detecta descaracterização do art. 62 (dispensado com '
             || 'marcações de fato). Na Justiça, o controle de fato derruba a exclusão e traz '
             || 'as horas extras do período inteiro. Depende do enquadramento do PONTO-373 '
             || 'existir primeiro; com ele, a detecção é um cruzamento simples: dispensado + '
             || 'marcações recorrentes → alerta a RH/Jurídico.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Detecção presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-376 — Marcação futura é recusada (funcional)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_376()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_amanha boolean := false;
  v_hora_futura boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Marcação Futura', 3760);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir marcação com DATA de amanhã';
  r.esperado := 'Recusada — ninguém registra o ponto de amanhã';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Marcação Futura', CURRENT_DATE + 1, TIME '08:00', 'entrada');
    v_amanha := true;   -- aceitou (achado)
  EXCEPTION WHEN OTHERS THEN
    v_amanha := false;  -- recusou (correto)
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Inserir marcação de HOJE com hora futura (23:59)';
  r.esperado := 'Recusada ou registrada com a hora do servidor — nunca a hora informada no futuro';
  IF localtime < TIME '23:00' THEN
    BEGIN
      PERFORM public.qa_ponto_marca(v_cpf, 'QA Marcação Futura', CURRENT_DATE, TIME '23:59', 'entrada');
      v_hora_futura := true;
    EXCEPTION WHEN OTHERS THEN
      v_hora_futura := false;
    END;
  END IF;

  IF NOT v_amanha AND NOT v_hora_futura THEN
    r.situacao := 'passou';
    r.obtido := 'Data futura e hora futura foram recusadas — o carimbo de tempo não aceita futuro.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o banco ACEITOU marcação futura (data de amanhã: %s; hora futura '
             || 'hoje: %s). Data e hora vêm do cliente sem validação temporal — por API ou SQL, '
             || 'grava-se o ponto de amanhã, corrompendo a fidelidade que a Portaria 671 exige. '
             || 'Correção: recusar data/hora posteriores ao relógio do servidor no gatilho de '
             || 'inserção (com folga mínima para latência).',
             CASE WHEN v_amanha THEN 'ACEITA' ELSE 'recusada' END,
             CASE WHEN v_hora_futura THEN 'ACEITA' ELSE 'recusada/não testada' END);
    r.detalhe := jsonb_build_object('data_futura_aceita', v_amanha,
                                    'hora_futura_aceita', v_hora_futura);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-377 — Detecção de marcações "britânicas" (Súmula 338)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_377()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algo detecta uniformidade de marcações?';
  r.esperado := 'Rotina que sinalize espelho "britânico" (horários idênticos por período prolongado)';

  v_fns := coalesce(public.qa_fns_com('%britanic%'), public.qa_fns_com('%uniformidade%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nada detecta marcações uniformes. Um mês de batidas cravadas no mesmo '
             || 'minuto passa sem aviso — e a Súmula 338, III, do TST considera esses registros '
             || 'INVÁLIDOS como prova, invertendo a presunção a favor do empregado. O gerador de '
             || 'alertas (gerar_alertas_ponto) só conhece falta e atraso. Correção: verificação '
             || 'periódica de variância das marcações por colaborador, com alerta quando a '
             || 'uniformidade passar do limiar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Detecção de uniformidade presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-378 — Status on/off-line da marcação
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_378()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_col text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a marcação registra se nasceu on-line ou off-line?';
  r.esperado := 'Coluna de status on/off-line em ponto_marcacoes (a Portaria 671 exige a identificação no AFD)';

  SELECT string_agg(column_name, ', ') INTO v_col
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ponto_marcacoes'
    AND (column_name ILIKE '%offline%' OR column_name ILIKE '%online%'
         OR column_name ILIKE '%sincroniz%');

  IF v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: ponto_marcacoes não guarda o status on/off-line nem o momento da '
             || 'sincronização. Se a marcação offline for implementada, não haverá como '
             || 'distinguir a hora da batida da hora do envio — e o AFD do REP-P precisa '
             || 'identificar o status. Correção: colunas de status de origem (on/off-line) e '
             || 'de timestamp de sincronização, preservando a hora da batida como a oficial.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Status de origem presente: %s.', v_col);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-379 — Sincronização com a Hora Legal Brasileira
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_379()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe monitoração da Hora Legal Brasileira?';
  r.esperado := 'Rotina que confira o relógio contra a HBL e alerte desvio acima da tolerância';

  v_fns := coalesce(public.qa_fns_com('%hora legal%'), public.qa_fns_com('%hora_legal%'),
                    public.qa_fns_com('%observatorio%'), public.qa_fns_com('%ntp%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma rotina monitora o relógio contra a Hora Legal Brasileira. O '
             || 'carimbo das marcações depende do relógio do servidor sem verificação — a '
             || 'Portaria 671 exige o REP-P sincronizado com a HBL (Observatório Nacional). '
             || 'Correção: verificação periódica do desvio com tolerância parametrizada, alerta '
             || 'imediato e registro do evento na trilha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Monitoração presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-380/381 — Comprovante de registro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_380()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_tab boolean; v_nsr text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o comprovante existe como documento com conteúdo mínimo?';
  r.esperado := 'Comprovante com empregador, trabalhador, data/hora e NSR, vinculado à marcação';

  v_tab := to_regclass('public.ponto_comprovantes') IS NOT NULL;
  v_nsr := public.qa_col_existe('ponto_marcacoes', '%nsr%');

  IF NOT v_tab AND v_nsr IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o comprovante hoje é só um boolean (ponto_marcacoes.comprovante_gerado) '
             || '— não existe o documento em si, com identificação do empregador, do trabalhador, '
             || 'data/hora e NSR (que também não existe: nenhuma coluna de NSR na marcação). O '
             || 'comprovante é o recibo legal do trabalhador na Portaria 671. Correção: NSR '
             || 'sequencial por equipamento/tenant + comprovante como artefato com o conteúdo '
             || 'mínimo, arquivado e vinculado à marcação.';
    r.detalhe := jsonb_build_object('tabela_comprovantes', v_tab, 'coluna_nsr', v_nsr);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Comprovante estruturado (tabela: %s; NSR: %s).', v_tab, coalesce(v_nsr, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_381()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe vigilância do prazo de 48h do comprovante?';
  r.esperado := 'Alerta preventivo antes das 48h e crítico ao estourar (REP-P, Portaria 671)';

  v_fns := public.qa_fns_com('%comprovante%48%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nada vigia o prazo de 48 horas do comprovante do REP-P. Como o '
             || 'comprovante em si ainda não existe como documento (PONTO-380), o prazo legal '
             || 'de disponibilização não tem nem o que ser medido. Correção: após o comprovante '
             || 'existir, rotina periódica que alerte antes das 48h e escale ao estourar, com '
             || 'ação no Plano de Ação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vigilância do prazo presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-382/383/384 — Importação de AFD
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_382()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text; v_cols text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a importação de AFD valida integridade no banco?';
  r.esperado := 'Validação de CRC-16, SHA-256 encadeado e assinatura, com quarentena do arquivo inválido';

  v_fns := coalesce(public.qa_fns_com('%crc%'), public.qa_fns_com('%quarentena%'));
  SELECT string_agg(column_name, ', ') INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'ponto_repc_importacoes'
    AND column_name IN ('status', 'erros', 'registros_rejeitados');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a tabela de importações (ponto_repc_importacoes) tem os campos '
             || 'certos (%s), mas NENHUMA função do banco valida integridade de AFD — nada de '
             || 'CRC-16 (tipos 1-5), cadeia SHA-256 (tipo 7), assinatura .p7s ou quarentena. Se '
             || 'a validação existir só na tela, importação por API entra sem conferência, e '
             || 'arquivo corrompido contamina a base probatória. Correção: validação no banco '
             || '(ou edge function) com quarentena do arquivo reprovado e relatório de '
             || 'inconsistências.', coalesce(v_cols, 'nenhum'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Validação de integridade presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_383()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_unq text; v_nsr text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): reimportar o mesmo AFD duplicaria marcações?';
  r.esperado := 'Trava de duplicidade: NSR único por equipamento ou unicidade do arquivo importado';

  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint
  WHERE conrelid = 'public.ponto_repc_importacoes'::regclass AND contype = 'u';
  v_nsr := public.qa_col_existe('ponto_marcacoes', '%nsr%');

  IF v_unq IS NULL AND v_nsr IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não há trava de reimportação — ponto_repc_importacoes não tem unicidade '
             || 'de arquivo e a marcação não guarda NSR (a chave natural de deduplicação do AFD). '
             || 'Repetir um upload após falha no meio duplica batidas, dobra pares e suja a '
             || 'apuração. Correção: NSR na marcação + unicidade (equipamento, NSR), tornando o '
             || 'reprocessamento idempotente.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Trava de duplicidade presente (unicidade: %s; NSR: %s).',
                       coalesce(v_unq, '—'), coalesce(v_nsr, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_384()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): ajustes de relógio (tipo 4) e eventos sensíveis (tipo 6) do AFD têm onde morar?';
  r.esperado := 'Estrutura para os registros não-marcação do AFD, visíveis na trilha';

  v_est := coalesce(public.qa_col_existe(NULL, '%ajuste_relogio%'), '')
        || coalesce(public.qa_col_existe(NULL, '%evento_sensivel%'), '')
        || coalesce(public.qa_fns_com('%tipo 4%relogio%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe estrutura para os registros tipo 4 (ajuste do relógio do '
             || 'equipamento) e tipo 6 (eventos sensíveis) do AFD — numa importação, esses '
             || 'registros seriam descartados. Um relógio ajustado perto de uma marcação suspeita '
             || 'é exatamente o que a fiscalização procura na trilha. Correção: importar e expor '
             || 'esses registros na trilha de auditoria do equipamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-385 — Memória de cálculo e reprodutibilidade (funcional + auditoria)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_385()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3850);
  v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_d1 date;
  v_r1 text; v_r2 text;
  v_mem boolean;
BEGIN
  v_d1 := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar a mesma competência duas vezes com os mesmos insumos';
  r.esperado := 'Resultados idênticos (determinismo) — mesma fonte + mesmos parâmetros = mesma conta';

  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Memória', 480, 10, v_d1, v_d1);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Memória', v_d1, 500);

  SELECT string_agg(dia::text || ':' || coalesce(saldo_min::text, 'n'), '|' ORDER BY dia) INTO v_r1
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf, to_char(v_d1, 'YYYY-MM'));
  SELECT string_agg(dia::text || ':' || coalesce(saldo_min::text, 'n'), '|' ORDER BY dia) INTO v_r2
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf, to_char(v_d1, 'YYYY-MM'));

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): existe memória de cálculo versionada?';
  r.esperado := 'Artefato exportável com fonte, parâmetros e versão, por competência';

  v_mem := to_regclass('public.ponto_memoria_calculo') IS NOT NULL
        OR public.qa_fns_com('%memoria_calculo%') IS NOT NULL;

  IF v_r1 IS DISTINCT FROM v_r2 THEN
    r.situacao := 'falhou';
    r.obtido := 'A MESMA apuração, rodada duas vezes seguidas, deu resultados diferentes — a '
             || 'conta não é determinística, o que inviabiliza qualquer auditoria. Investigar '
             || 'dependência de ordem/tempo na apuração.';
    r.detalhe := jsonb_build_object('rodada1', v_r1, 'rodada2', v_r2);
  ELSIF NOT v_mem THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a apuração é determinística (duas rodadas idênticas — bom sinal), mas '
             || 'NÃO existe memória de cálculo: nenhuma tabela ou função registra, por '
             || 'competência, a fonte usada, a versão dos parâmetros e o passo a passo da conta. '
             || 'Sem memória, o auditor não refaz o cálculo e a empresa não explica o espelho '
             || 'ao colaborador. Correção: memória versionada e exportável gerada na apuração.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Apuração determinística e memória de cálculo presente.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-386 — Instrumento coletivo vigente NA COMPETÊNCIA
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_386()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_src text; v_usa_vigencia boolean; v_alerta text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consome ponto_cct_config filtra pela vigência?';
  r.esperado := 'A apuração escolhe o instrumento vigente NA DATA apurada (vigencia_inicio/fim)';

  SELECT prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'calcular_he_adicional_noturno_dia';

  IF v_src IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela ponto_cct_config existe (com vigencia_inicio/fim), mas nenhuma função '
             || 'de apuração a consome — os parâmetros da CCT são decorativos no banco.';
    RETURN r;
  END IF;

  v_usa_vigencia := v_src ILIKE '%vigencia%';
  v_alerta := public.qa_fns_com('%cct%venc%');

  IF NOT v_usa_vigencia THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: calcular_he_adicional_noturno_dia consome ponto_cct_config SEM filtrar '
             || 'pela vigência (vigencia_inicio/vigencia_fim existem na tabela e não aparecem na '
             || 'função). Reapurar uma competência antiga aplica a convenção atual — percentuais '
             || 'errados retroativos. Correção: escolher o instrumento cuja vigência cobre a DATA '
             || 'apurada; alertar sobreposição e vencimento (60/30 dias), que hoje também não '
             || 'existe.';
  ELSIF v_alerta IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A apuração filtra pela vigência (correto), mas não existe alerta de instrumento '
             || 'coletivo a vencer (60/30 dias) nem de vigências sobrepostas. Correção: rotina '
             || 'periódica de vigilância das vigências de ponto_cct_config.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vigência respeitada na apuração e vigilância presente em: %s.', v_alerta);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-387/388 — Espelho × fechamento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_387()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_confere boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o fechamento confere a situação dos espelhos?';
  r.esperado := 'Fechar competência exige espelhos confirmados/assinados (ou recusa formalizada)';

  SELECT bool_or(p.prosrc ILIKE '%espelho%' AND (p.prosrc ILIKE '%confirmad%'
              OR p.prosrc ILIKE '%assinatur%' OR p.prosrc ILIKE '%status%'))
    INTO v_confere
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%fechar%' AND p.proname NOT LIKE 'qa\_%';

  IF NOT coalesce(v_confere, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função de fechamento confere os espelhos. A tabela '
             || 'ponto_espelhos tem status, data_confirmacao e assinatura_hash — mas o '
             || 'fechamento (ponto_fechar_competencia_banco) só transita saldos, sem checar se o '
             || 'colaborador viu e assinou. Espelho sem ciência enfraquece a prova (Súmula 338). '
             || 'Correção: fechamento bloqueado (ou com justificativa formal) enquanto houver '
             || 'espelho pendente de confirmação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O fechamento confere a situação dos espelhos antes de concluir.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_388()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_confere boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o fechamento trava com pendência crítica aberta?';
  r.esperado := 'Ajustes pendentes, lacunas sem justificativa e falhas de integridade impedem fechar';

  SELECT bool_or(p.prosrc ILIKE '%pendente%')
    INTO v_confere
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%fechar%' AND p.proname NOT LIKE 'qa\_%';

  IF NOT coalesce(v_confere, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o fechamento não verifica pendências. Com ajuste pendente de aprovação '
             || 'ou lacuna sem justificativa, a competência fecha por cima e manda o dado errado '
             || 'para a folha — e o PONTO-193 mostra que depois de fechada não se mexe. Correção: '
             || 'lista de pendências críticas bloqueantes no fechamento (ajustes pendentes, dias '
             || 'incompletos sem tratamento, falha de integridade).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O fechamento verifica pendências antes de concluir.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-389/390/391 — Alertas, Plano de Ação e IA
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_389()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_link text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alerta de ponto consegue virar ação no Plano de Ação?';
  r.esperado := 'Vínculo estrutural entre ponto_alertas e o módulo Plano de Ação (5W2H com origem)';

  v_link := coalesce(public.qa_col_existe('ponto_alertas', '%plano%'), '')
         || coalesce(public.qa_col_existe(NULL, '%alerta_ponto%'), '');
  IF v_link = '' THEN
    SELECT coalesce(string_agg(p.proname, ', '), '') INTO v_link
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
      AND p.prosrc ILIKE '%ponto_alertas%' AND p.prosrc ILIKE '%plano%acao%';
  END IF;

  IF v_link = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não há ponte entre os alertas do ponto e o Plano de Ação — nem coluna '
             || 'de vínculo, nem função que crie a ação. O documento de requisitos faz dessa '
             || 'integração o coração preventivo do módulo (ação 5W2H nascendo do alerta, com '
             || 'origem navegável). Correção: função que converta alerta em ação preenchida, '
             || 'guardando o vínculo com o alerta/marcação/competência de origem.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte presente: %s.', v_link);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_390()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): concluir uma ação valida a eficácia sobre a ocorrência?';
  r.esperado := 'Baixa da ação confere se o alerta de origem pode encerrar e registra a evidência';

  v_fns := public.qa_fns_com('%eficacia%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe validação de eficácia — depende da ponte alerta→ação do '
             || 'PONTO-389, que também não existe. Sem ela, concluir a ação dá baixa cega: o '
             || 'intervalo continua suprimido na semana seguinte e ninguém percebe, porque o '
             || 'alerta morreu junto com a ação. Correção: na conclusão, reavaliar a ocorrência '
             || 'de origem; persistindo, reabrir ou gerar novo alerta com o histórico.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Validação de eficácia presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_391()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_auto text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma rotina decide sozinha sobre direito do trabalhador?';
  r.esperado := 'Nenhuma decisão automatizada (descontar, negar, punir) sem registro de revisão humana';

  -- Procura descontos/negativas automáticas sem ator humano registrado.
  SELECT string_agg(p.proname, ', ') INTO v_auto
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ponto%'
    AND (p.prosrc ILIKE '%decisao_automatica%' OR p.prosrc ILIKE '%rejeicao_automatica%'
         OR p.prosrc ILIKE '%desconto_automatico%');
  -- Nota: processar_ajuste_ponto registra 'auto_rejeitado' para AUTO-LANÇAMENTO
  -- (quem pediu = quem decidiu), sempre com humano autenticado — não é decisão
  -- automática do sistema, por isso os padrões acima são estritos.

  IF v_auto IS NOT NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: rotina(s) com decisão automática sobre o ponto: %s. A LGPD '
             || '(art. 20) e o próprio documento de requisitos exigem revisão humana para '
             || 'qualquer decisão que afete direito do trabalhador.', v_auto);
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'RESSALVA DOCUMENTADA: hoje nenhuma rotina decide sozinha sobre direitos (bom '
             || 'sinal para a LGPD art. 20) — mas o recurso "Analisar com IA" previsto no '
             || 'documento de requisitos (RF-010) ainda não existe no módulo, então o limite '
             || 'não tem o que limitar. Ao construir a IA de análise, este caso vira o guardião: '
             || 'sugestão registrada + decisão humana registrada, nunca execução automática. '
             || 'Reclassificar como "passou" quando a IA existir com o controle implantado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-392/393 — Dossiê e arquivamento automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_392()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe geração de dossiê de fiscalização?';
  r.esperado := 'Rotina que reúna AFD, AEJ, comprovantes, espelhos e trilha num pacote com índice e hashes';

  v_fns := coalesce(public.qa_fns_com('%dossie%'), public.qa_fns_com('%fiscaliza%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe o dossiê de fiscalização. Diante do Auditor-Fiscal, o DP '
             || 'teria de caçar peça por peça — e as principais nem existem ainda (AFD fora do '
             || 'leiaute, AEJ ausente, comprovante só como boolean; ver PONTO-210/211/380). O '
             || '"modo fiscalização em um clique" do documento depende primeiro dessas peças, '
             || 'depois do empacotador com índice e verificação de assinaturas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dossiê presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_393()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): peças do ponto se arquivam sozinhas no módulo Documentos?';
  r.esperado := 'Funções do ponto gravando no repositório de documentos, com classificação e vínculo';

  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%ponto%'
    AND (p.prosrc ILIKE '%documentos_empresa%' OR p.prosrc ILIKE '%storage.objects%'
         OR p.prosrc ILIKE '%documentos_funcionario%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função do ponto arquiva peça alguma no módulo Documentos — '
             || 'espelhos, extratos e arquivos ficam soltos nas tabelas do ponto (quando '
             || 'existem), sem a classificação por pasta e o vínculo previstos na seção 16 do '
             || 'documento de requisitos. Correção: ao gerar cada peça, gravar a referência no '
             || 'repositório de documentos com pasta, metadados e vínculo, sem upload manual.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Arquivamento automático presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-394 — Dois vínculos do mesmo CPF (funcional/estrutural)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_394()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3940);
  v_emp1 uuid; v_emp2 uuid;
  v_data date := CURRENT_DATE - 3;
  v_colidiu boolean := false;
BEGIN
  v_emp1 := public.qa_nova_empresa('QA Vínculo A ' || v_cpf, '11.222.333/0001-81');
  v_emp2 := public.qa_nova_empresa('QA Vínculo B ' || v_cpf, '11.444.777/0001-61');

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar o MESMO dia para o MESMO CPF em duas empresas (dois vínculos)';
  r.esperado := 'Cada vínculo tem a sua apuração do dia — contratos são autônomos entre si';

  PERFORM public.qa_ponto_dia(v_cpf, 'QA Dois Vínculos', v_data, v_emp1);
  BEGIN
    PERFORM public.qa_ponto_dia(v_cpf, 'QA Dois Vínculos', v_data, v_emp2);
  EXCEPTION WHEN unique_violation THEN
    v_colidiu := true;
  END;

  IF v_colidiu THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO ESTRUTURAL: a apuração diária é chaveada por (tenant, CPF, data) — a '
             || 'constraint unique_ponto_diario impede registrar o mesmo dia do mesmo CPF em '
             || 'duas empresas. Dois vínculos do mesmo trabalhador (duas empresas do grupo, '
             || 'dois estabelecimentos) são estruturalmente impossíveis: o segundo contrato '
             || 'sobrescreve ou colide com o primeiro. O documento de requisitos exige apuração '
             || 'e arquivos POR VÍNCULO. Correção: incluir o vínculo/empresa na chave da '
             || 'apuração (e propagar para banco de horas, espelhos e arquivos).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O mesmo CPF apurou o mesmo dia em dois vínculos, separados por empresa.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-395 — Transferência de estabelecimento
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_395()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe histórico de lotação com data de corte?';
  r.esperado := 'Vigência de lotação por estabelecimento (transferência encerra origem e inicia destino)';

  v_est := coalesce(public.qa_col_existe(NULL, '%transferencia%'), '')
        || coalesce(public.qa_col_existe(NULL, '%lotacao%'), '');

  IF v_est = '' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe histórico de lotação — a empresa do colaborador é um '
             || 'atributo solto em cada linha (empresa_id na marcação e no dia), sem vigência '
             || 'nem data de corte. Numa transferência real, os registros antigos continuam '
             || 'apontando para onde estiverem e nada garante origem encerrada/destino iniciado '
             || 'na data certa — o AFD de cada estabelecimento sai misturado. Correção: vigência '
             || 'de lotação (estabelecimento × período) consultada pela apuração e pelos '
             || 'arquivos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de lotação presente: %s.', v_est);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-396 — Colaborador só enxerga o próprio ponto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_396()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_propria boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de leitura restringem ao PRÓPRIO colaborador?';
  r.esperado := 'Política de SELECT em ponto_marcacoes/ponto_espelhos filtrando pelo CPF/usuário do leitor';

  SELECT bool_or(qual ILIKE '%cpf%' OR qual ILIKE '%auth.uid%' OR qual ILIKE '%proprio%')
    INTO v_propria
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('ponto_marcacoes', 'ponto_espelhos')
    AND cmd IN ('SELECT', 'ALL');

  IF NOT coalesce(v_propria, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma política de leitura de ponto_marcacoes ou ponto_espelhos '
             || 'restringe ao próprio colaborador — os filtros existentes param no tenant e no '
             || 'vínculo de empresa. Traduzindo: um colaborador comum, pela API, lê as marcações '
             || 'e espelhos DOS COLEGAS da empresa inteira (horários, atrasos, geolocalização). '
             || 'Dado de jornada é dado pessoal (LGPD): o titular vê o seu; gestor/DP veem '
             || 'conforme o papel. Correção: política que limite o perfil colaborador ao '
             || 'próprio CPF, mantendo o acesso amplo apenas para papéis de gestão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Leitura restrita ao próprio colaborador (com exceção controlada por papel).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-397 — Trilha de ACESSO a dado sensível e de exportações
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_397()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): visualização de dado sensível e exportação deixam rastro?';
  r.esperado := 'Registro de QUEM viu selfie/geolocalização e QUEM exportou dados, em log imutável';

  v_fns := coalesce(public.qa_fns_com('%log%selfie%'), public.qa_fns_com('%acesso%sensivel%'),
                    public.qa_fns_com('%log%exporta%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a trilha de auditoria só captura escrita (INSERT/UPDATE/DELETE, via '
             || 'gatilhos) — visualizar a selfie ou a geolocalização de uma marcação e exportar '
             || 'relatórios de ponto não deixam rastro algum. A LGPD (arts. 11 e 46) pede '
             || 'registro do tratamento de dado sensível; num vazamento, seria impossível saber '
             || 'quem acessou o quê. Correção: registrar o acesso no ponto de entrega (função '
             || 'RPC/edge que serve o dado sensível loga antes de servir; exportações gravam '
             || 'escopo e destinatário).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Trilha de acesso presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-398 — Contingência da integração com a folha
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_398()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE r public.qa_retorno; v_fns text; v_status text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): exportação para a folha tem fila e reenvio?';
  r.esperado := 'Falha na entrega enfileira e reenvia sem perda nem duplicidade';

  v_fns := coalesce(public.qa_fns_com('%exportacoes_folha%'), '');
  v_status := public.qa_col_existe('ponto_exportacoes_folha', 'status');

  IF v_fns = '' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a exportação para a folha é um registro passivo '
             || '(ponto_exportacoes_folha tem %s), mas nenhuma função do banco a processa — '
             || 'sem fila, sem reenvio, sem confirmação de recebimento. Se a geração falha no '
             || 'meio, o operador refaz na mão e ninguém garante ausência de duplicidade. '
             || 'Correção: estados explícitos (pendente/enviado/confirmado/falha) + rotina de '
             || 'reenvio idempotente.', coalesce('coluna ' || v_status, 'nem coluna de status'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Processamento da exportação presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- Registro no motor
-- ---------------------------------------------------------------------------
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT 'PONTO-' || n, 'qa_caso_ponto_' || n, true
FROM generate_series(370, 398) n
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
