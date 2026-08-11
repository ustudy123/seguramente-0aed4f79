-- =========================================================
-- QA — Férias: rotinas — 1ª leva (11/08)
--
-- Implementa a execução de 10 dos 27 casos documentados em
-- 20260811200000 — os que já são testáveis contra o banco ATUAL.
-- O levantamento do schema mostrou que a fundação existe:
--   ferias_dias_por_faltas_clt()  -> a escala do art. 130 pronta
--   ferias_prog_estado            -> enum com os 9 estados do ciclo
--   ferias_periodos_aquisitivos / ferias_programacao /
--   ferias_solicitacoes           -> as três tabelas-alvo
-- ...e que as VALIDAÇÕES do motor de regras (seção 5 do documento de
-- requisitos) ainda não: nada de fracionamento, saldo, véspera de
-- feriado, concessivo ou abono no banco. As rotinas testam a regra
-- LEGAL; onde o banco ainda não a garante, falham de propósito com o
-- diagnóstico — vira pauta mensurável para o desenvolvimento do módulo.
--
-- Ficam para a 2ª leva (dependem de motor/fluxo a construir):
-- FERIAS-003/004, 010, 016, 021, 030..032, 040, 042, 051..053,
-- 060/061, 070/071 — reportados como sem rotina, honestamente.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE. Só rotinas e fixtures qa_*.
-- =========================================================

SET lock_timeout = '10s';

-- Fixture: período aquisitivo no cercado.
CREATE OR REPLACE FUNCTION public.qa_ferias_periodo(
  p_cpf text, p_nome text, p_faltas int DEFAULT 0,
  p_aquisitivo_fim date DEFAULT CURRENT_DATE - 30
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_direito int := public.ferias_dias_por_faltas_clt(p_faltas);
BEGIN
  INSERT INTO public.ferias_periodos_aquisitivos
    (tenant_id, colaborador_cpf, colaborador_nome, data_admissao,
     aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados,
     fonte_faltas, dias_direito, dias_saldo, faltas_consideradas, status, origem)
  VALUES (public.qa_sandbox_tenant_id(), p_cpf, p_nome,
          p_aquisitivo_fim - interval '1 year',
          p_aquisitivo_fim - interval '1 year', p_aquisitivo_fim,
          p_faltas, 0, 'carga', v_direito, v_direito, p_faltas, 'ativo', 'sistema')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ══ FERIAS-001: coerência entre faltas e direito no período gravado ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40001); v_id uuid; v_direito numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar período aquisitivo com 8 faltas e direito INCOERENTE de 30 dias';
  r.esperado := 'O banco deriva ou recusa: com 8 faltas, o art. 130 dá 24 dias';
  INSERT INTO public.ferias_periodos_aquisitivos
    (tenant_id, colaborador_cpf, colaborador_nome, data_admissao,
     aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados,
     fonte_faltas, dias_direito, dias_saldo, faltas_consideradas, status, origem)
  VALUES (v_t, v_cpf, '[QA-FERIAS] Oito Faltas', CURRENT_DATE - interval '2 years',
          CURRENT_DATE - interval '2 years', CURRENT_DATE - interval '1 year',
          8, 0, 'carga', 30, 30, 8, 'ativo', 'manual')
  RETURNING id INTO v_id;

  SELECT dias_direito INTO v_direito FROM public.ferias_periodos_aquisitivos WHERE id = v_id;
  IF v_direito = 24 THEN
    r.situacao := 'passou';
    r.obtido := 'O banco corrigiu o direito para 24 dias — a escala do art. 130 é garantida na escrita.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O BANCO ACEITOU direito de %s dias com 8 faltas — o art. 130 manda 24. '
      'A função ferias_dias_por_faltas_clt existe e está correta, mas nada obriga o dado gravado a '
      'passar por ela: entrada manual ou importação grava qualquer número. Correção: trigger '
      'derivando dias_direito das faltas consideradas (com exceção auditada para validação manual).',
      v_direito);
  END IF;
  RETURN r;
EXCEPTION
  WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Incoerência recusada na escrita.'; RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-002: escala do art. 130 nas oito fronteiras ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_err text := '';
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Avaliar ferias_dias_por_faltas_clt nas fronteiras 5/6, 14/15, 23/24, 32/33';
  r.esperado := '30/24, 24/18, 18/12, 12/0 — cada fronteira no degrau certo';

  IF public.ferias_dias_por_faltas_clt(5)  <> 30 THEN v_err := v_err || ' 5->'  || public.ferias_dias_por_faltas_clt(5); END IF;
  IF public.ferias_dias_por_faltas_clt(6)  <> 24 THEN v_err := v_err || ' 6->'  || public.ferias_dias_por_faltas_clt(6); END IF;
  IF public.ferias_dias_por_faltas_clt(14) <> 24 THEN v_err := v_err || ' 14->' || public.ferias_dias_por_faltas_clt(14); END IF;
  IF public.ferias_dias_por_faltas_clt(15) <> 18 THEN v_err := v_err || ' 15->' || public.ferias_dias_por_faltas_clt(15); END IF;
  IF public.ferias_dias_por_faltas_clt(23) <> 18 THEN v_err := v_err || ' 23->' || public.ferias_dias_por_faltas_clt(23); END IF;
  IF public.ferias_dias_por_faltas_clt(24) <> 12 THEN v_err := v_err || ' 24->' || public.ferias_dias_por_faltas_clt(24); END IF;
  IF public.ferias_dias_por_faltas_clt(32) <> 12 THEN v_err := v_err || ' 32->' || public.ferias_dias_por_faltas_clt(32); END IF;
  IF public.ferias_dias_por_faltas_clt(33) <> 0  THEN v_err := v_err || ' 33->' || public.ferias_dias_por_faltas_clt(33); END IF;

  IF v_err = '' THEN
    r.situacao := 'passou';
    r.obtido := 'As oito fronteiras da escala do art. 130 caem no degrau certo.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'FRONTEIRA ERRADA na escala do art. 130:' || v_err || '. Cada erro aqui é dia de férias a mais ou a menos para alguém.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-011: fracionamento sem período de 14 dias ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40011);
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Sem Quatorze', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar P1=10, P2=10, P3=10 (soma 30, nenhum período com 14 dias)';
  r.esperado := 'Recusado — o art. 134, §1º exige um período de ao menos 14 dias corridos';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias, p3_inicio, p3_fim, p3_dias,
       abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Sem Quatorze',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 39, 10,
            CURRENT_DATE + 90, CURRENT_DATE + 99, 10,
            CURRENT_DATE + 150, CURRENT_DATE + 159, 10,
            false, 0, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU 10+10+10: a soma fecha 30, mas nenhum período atinge os 14 dias '
      'corridos do art. 134, §1º. A regra do fracionamento não existe em nenhuma camada do banco — '
      'é o motor de regras da seção 5 do documento de requisitos, ainda a construir.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Composição sem período de 14 dias recusada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-012: terceiro período menor que 5 dias ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40012); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Terceiro Curto', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar P1=20, P2=7, P3=3 (terceiro período abaixo de 5 dias)';
  r.esperado := 'Recusado — todo período do fracionamento tem piso de 5 dias corridos';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias, p3_inicio, p3_fim, p3_dias,
       abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Terceiro Curto',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 49, 20,
            CURRENT_DATE + 90, CURRENT_DATE + 96, 7,
            CURRENT_DATE + 150, CURRENT_DATE + 152, 3,
            false, 0, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN check_violation THEN v_aceitou := false;
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o teto estrutural de 3 períodos';
  r.esperado := 'Não existe P4 — a estrutura limita a 3, como manda a lei';
  -- A tabela tem apenas p1/p2/p3: o teto de 3 períodos é estrutural.

  IF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'Período abaixo de 5 dias recusado; teto de 3 períodos garantido pela estrutura.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU um período de 3 dias — abaixo do piso de 5 dias corridos do art. 134, §1º. '
      'O lado bom: o teto de 3 períodos é estrutural (só existem P1/P2/P3). Falta o piso por período no motor de regras.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-013: mais dias do que o saldo ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40013);
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Sem Saldo', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Solicitar 42 dias com saldo de 30';
  r.esperado := 'Recusado, com o saldo e o período aquisitivo na mensagem';
  BEGIN
    INSERT INTO public.ferias_solicitacoes
      (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim,
       dias_solicitados, saldo_dias, status)
    VALUES (v_t, '[QA-FERIAS] Sem Saldo', v_cpf,
            CURRENT_DATE + 30, CURRENT_DATE + 71, 42, 30, 'pendente');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU solicitação de 42 dias com saldo de 30 — a própria linha carrega '
      'as duas colunas (dias_solicitados e saldo_dias) e nada as compara. O direito do art. 130 é '
      'teto duro; a validação vive só na tela. Correção: CHECK (dias_solicitados <= saldo_dias) '
      'como rede mínima, e o motor de regras por cima.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Solicitação acima do saldo recusada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-014: início na véspera de feriado da unidade ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40014); v_emp uuid; v_feriado date := CURRENT_DATE + 45;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-FERIAS] Unidade Com Feriado', '11222333040014');
  PERFORM public.qa_feriado_da_unidade(v_emp, v_feriado, '[QA] Feriado Municipal');
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Vespera', 0);

  r.passo_ordem := 1;
  r.passo_acao := format('Programar início em %s — 1 dia antes do feriado da unidade (%s)', v_feriado - 1, v_feriado);
  r.esperado := 'Recusado — vedado iniciar nos 2 dias que antecedem feriado (art. 134, §3º)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, empresa_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_emp, v_cpf, '[QA-FERIAS] Vespera',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            v_feriado - 1, v_feriado + 28, 30, false, 0, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU férias iniciando na véspera de feriado da unidade — o art. 134, §3º '
      'veda o início nos 2 dias que antecedem feriado ou DSR. A fonte única de feriados por unidade '
      '(RN22, feriados_da_empresa) existe e não é consultada aqui. Correção: validação na programação '
      'usando o calendário da unidade, com sugestão da data válida mais próxima.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Véspera de feriado recusada pelo calendário da unidade.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-015: nenhuma trava etária revogada no código ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_015()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_n int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): procurar trava por idade nas funções e constraints de férias';
  r.esperado := 'Nenhuma — a restrição etária do antigo art. 134, §2º foi revogada pela Lei 13.467/2017';

  SELECT count(*), string_agg(p.proname, ', ')
  INTO v_n, v_lista
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%'
    AND p.proname NOT LIKE 'qa\_%'  -- as próprias rotinas de QA citam a trava no texto do diagnóstico
    AND (pg_get_functiondef(p.oid) ILIKE '%idade%'
         OR pg_get_functiondef(p.oid) ILIKE '%data_nascimento%');

  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma função de férias condiciona o gozo à idade — o sistema não carrega a trava revogada (erro comum em legados).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('POSSÍVEL TRAVA ETÁRIA em %s função(ões) de férias: %s. A obrigação de período único para menor de 18/maior de 50 foi REVOGADA pela Lei 13.467/2017 — conferir e remover se for restrição de gozo.', v_n, v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-020: programação além do limite concessivo ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40020); v_fim date := CURRENT_DATE - interval '13 months';
BEGIN
  PERFORM public.qa_modo_ligar();
  -- aquisitivo terminou há 13 meses: o limite concessivo (12 meses) já venceu
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Concessivo Vencido', 0, v_fim::date);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar férias com o limite concessivo já vencido, sem alçada de diretoria';
  r.esperado := 'Bloqueado para perfis comuns — e, quando autorizado, com o custo da dobra exibido (art. 137)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Concessivo Vencido',
            v_fim - interval '1 year', v_fim,
            CURRENT_DATE + 30, CURRENT_DATE + 59, 30, false, 0, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU programação com o concessivo vencido, sem alçada e sem sinalizar a '
      'dobra: as férias deviam ter sido concedidas nos 12 meses seguintes ao aquisitivo (art. 134) e '
      'agora o pagamento é em dobro (art. 137). Programar sem ver o custo é assinar o passivo no '
      'escuro. Correção: bloqueio com exceção de diretoria + exibição do valor da dobra (motor da seção 5).';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Programação além do concessivo bloqueada sem alçada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-041: abono acima de 1/3 ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40041);
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Abono Guloso', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar abono de 15 dias num direito de 30 (limite legal: 10)';
  r.esperado := 'Recusado — o abono é de ATÉ 1/3 do período (art. 143)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Abono Guloso',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 44, 15, true, 15, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU abono de 15 dias num direito de 30 — o art. 143 limita a 1/3 '
      '(10 dias; e em direito reduzido pelo art. 130 o teto acompanha). abono_dias é inteiro sem '
      'validação contra o direito. Correção: validação do 1/3 sobre o direito REAL no motor de regras.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Abono acima de 1/3 recusado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FERIAS-050: o enum do ciclo tem os 9 estados do documento ══
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_labels text; v_faltando text := '';
        v_esperados text[] := ARRAY['sugerido','planejado','confirmado','ciente','solicitado',
                                    'aprovado','em_gozo','concluido','cancelado'];
  e text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Conferir o enum ferias_prog_estado contra os 9 estados do ciclo (seção 4.2)';
  r.esperado := 'Todos presentes; valor fora da lista é recusado';

  SELECT string_agg(en.enumlabel, ',') INTO v_labels
  FROM pg_enum en JOIN pg_type t ON t.oid = en.enumtypid
  WHERE t.typname = 'ferias_prog_estado';

  IF v_labels IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O enum ferias_prog_estado não existe — o ciclo de estados do documento não tem contrato no banco.';
    RETURN r;
  END IF;

  FOREACH e IN ARRAY v_esperados LOOP
    IF position(e IN v_labels) = 0 THEN v_faltando := v_faltando || ' ' || e; END IF;
  END LOOP;

  r.passo_ordem := 2;
  r.passo_acao := 'Gravar programação com estado inventado';
  r.esperado := 'Recusado pelo enum';
  BEGIN
    EXECUTE format(
      'INSERT INTO public.ferias_programacao
         (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
          abono_vender, abono_dias, adiantar_13, estado)
       VALUES (%L, %L, %L, %L, %L, false, 0, false, %L::public.ferias_prog_estado)',
      public.qa_sandbox_tenant_id(), public.qa_cpf(40050), '[QA-FERIAS] Estado Inventado',
      CURRENT_DATE - interval '13 months', CURRENT_DATE - 30, 'aprovadissimo');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU estado fora da lista fechada do ciclo.';
    RETURN r;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL; -- recusado, como esperado
  END;

  IF v_faltando = '' THEN
    r.situacao := 'passou';
    r.obtido := 'Os 9 estados do ciclo existem no enum e valor inventado é recusado — o contrato da seção 4.2 está no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'Estados do ciclo AUSENTES no enum:' || v_faltando || '. O documento (4.2) define 9; o banco conhece: ' || v_labels || '.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('FERIAS-001', 'qa_caso_ferias_001', true),
  ('FERIAS-002', 'qa_caso_ferias_002', true),
  ('FERIAS-011', 'qa_caso_ferias_011', true),
  ('FERIAS-012', 'qa_caso_ferias_012', true),
  ('FERIAS-013', 'qa_caso_ferias_013', true),
  ('FERIAS-014', 'qa_caso_ferias_014', true),
  ('FERIAS-015', 'qa_caso_ferias_015', true),
  ('FERIAS-020', 'qa_caso_ferias_020', true),
  ('FERIAS-041', 'qa_caso_ferias_041', true),
  ('FERIAS-050', 'qa_caso_ferias_050', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'jornada-rotina/ferias');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
