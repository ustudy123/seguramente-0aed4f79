-- ============================================================================
-- QA PONTO — 3ª leva de rotinas executáveis: casos da análise de conformidade
-- (PONTO-350 a 357, documentados em 20260811180000).
--
-- Ficam para leva futura, por dependerem de tela/funcionalidade inexistente:
--   PONTO-358 (reabertura formal), 359 (comprovantes 48h), 360 (certificado),
--   361 (exportação folha), 362 (enumeração de CPFs em link), 363 (aviso LGPD).
--
-- Padrão da casa: as rotinas testam o comportamento CORRETO (lei/Portaria 671).
-- Onde o sistema diverge, a rotina FALHA de propósito com diagnóstico no
-- campo obtido — é o material do relatório para o desenvolvimento.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- Dia de ponto com minutos trabalhados sob medida (o qa_ponto_dia fixa 8h).
CREATE OR REPLACE FUNCTION public.qa_ponto_dia_min(
  p_cpf text, p_nome text, p_data date, p_minutos int
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ponto_diario
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data, entrada, saida, horas_trabalhadas, status)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), p_nome, p_cpf,
          p_data, TIME '08:00', TIME '08:00' + make_interval(mins => p_minutos),
          make_interval(mins => p_minutos), 'regular')
  ON CONFLICT (tenant_id, colaborador_cpf, data) DO UPDATE
    SET horas_trabalhadas = EXCLUDED.horas_trabalhadas,
        saida = EXCLUDED.saida;
END $$;

-- Escala fixa mínima com tolerância diária configurável + atribuição por CPF.
CREATE OR REPLACE FUNCTION public.qa_ponto_escala_tol(
  p_cpf text, p_nome text, p_jornada_min int, p_tol_min int,
  p_data_inicio date, p_data_fim date
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.ponto_escalas
    (tenant_id, nome, tipo, modalidade, jornada_diaria_minutos,
     jornada_semanal_minutos, intervalo_intrajornada_minutos,
     tolerancia_minutos, tolerancia_diaria_minutos,
     hora_entrada_padrao, hora_saida_padrao,
     equalizacao_mensal_ativa, carga_semanal_contratada_min, ativa)
  VALUES (public.qa_sandbox_tenant_id(), 'QA escala ' || p_cpf, 'fixa', 'fixa',
          p_jornada_min, p_jornada_min * 5, 60,
          p_tol_min, p_tol_min,
          TIME '08:00', TIME '17:00',
          false, p_jornada_min * 5, true)
  RETURNING id INTO v_id;

  INSERT INTO public.ponto_escala_atribuicoes
    (tenant_id, escala_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_inicio, data_fim, ativa)
  VALUES (public.qa_sandbox_tenant_id(), v_id, p_cpf, p_nome, p_cpf,
          p_data_inicio, p_data_fim, true);
  RETURN v_id;
END $$;

-- Marcação original mínima (passa pelos gatilhos reais de validação).
CREATE OR REPLACE FUNCTION public.qa_ponto_marca(
  p_cpf text, p_nome text, p_data date, p_hora time, p_tipo text,
  p_original boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ponto_marcacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_marcacao, hora_marcacao, tipo_marcacao,
     hash_marcacao, marcacao_original, origem_marcacao)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), p_nome, p_cpf,
          p_data, p_hora, p_tipo,
          'qa-seed', p_original, CASE WHEN p_original THEN 'O' ELSE 'A' END);
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-350 — Toque duplo: duas marcações no mesmo minuto
-- Portaria MTE 671/2021: o repique do mesmo toque não vira segunda marcação.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_350()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_data date := CURRENT_DATE;
  v_bloqueou_dupla boolean := false;
  v_bloqueou_saida_repique boolean := false;
  v_aceitou_depois boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Toque Duplo', 3501);

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar entrada às 08:00:00 e tentar NOVA entrada às 08:00:30 (mesmo minuto)';
  r.esperado := 'A segunda batida é recusada como repique do mesmo toque';

  PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:00:00', 'entrada');
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:00:30', 'entrada');
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou_dupla := true;
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar SAÍDA às 08:01:00 (ainda dentro da janela do repique)';
  r.esperado := 'Também recusada — o dedo que escorrega não fecha a jornada em 1 minuto';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '08:01:00', 'saida');
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou_saida_repique := true;
  END;

  r.passo_ordem := 3;
  r.passo_acao := 'Registrar saída legítima às 12:00';
  r.esperado := 'Aceita normalmente — a proteção não pode travar a jornada real';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Toque Duplo', v_data, TIME '12:00:00', 'saida');
    v_aceitou_depois := true;
  EXCEPTION WHEN OTHERS THEN
    v_aceitou_depois := false;
  END;

  IF v_bloqueou_dupla AND v_bloqueou_saida_repique AND v_aceitou_depois THEN
    r.situacao := 'passou';
    r.obtido := 'O repique no mesmo minuto foi recusado (entrada E saída), e a batida legítima '
             || 'posterior entrou normalmente. A janela anti-toque-duplo está ativa no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Proteção incompleta: repique de entrada %s, repique de saída %s, batida '
             || 'legítima depois %s. Duas batidas no mesmo minuto viram duas marcações no AFD e '
             || 'sujam a apuração. Correção: janela anti-toque-duplo no gatilho de marcação.',
             CASE WHEN v_bloqueou_dupla THEN 'BLOQUEADO' ELSE 'ACEITO' END,
             CASE WHEN v_bloqueou_saida_repique THEN 'BLOQUEADO' ELSE 'ACEITO' END,
             CASE WHEN v_aceitou_depois THEN 'aceita' ELSE 'RECUSADA (trava demais)' END);
    r.detalhe := jsonb_build_object('bloqueou_entrada_dupla', v_bloqueou_dupla,
                                    'bloqueou_saida_repique', v_bloqueou_saida_repique,
                                    'aceitou_batida_legitima', v_aceitou_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-351 — Batida retroativa reordena os rótulos sem tocar nos horários
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_351()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_data date := CURRENT_DATE - 1;
  v_retro_entrou boolean := false;
  v_msg_recusa text;
  v_seq text;
  v_horas text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Retroativa', 3511);

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar por ajuste a marcação das 12:00 (rotulada entrada) num dia de ontem';
  r.esperado := 'Aceita — é a única do dia, nada a reordenar';
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Retroativa', v_data, TIME '12:00', 'entrada', false);

  r.passo_ordem := 2;
  r.passo_acao := 'Lançar RETROATIVAMENTE a marcação das 08:00 — pelo relógio, ela vira a entrada '
               || 'e a das 12:00 vira saída';
  r.esperado := 'A retroativa entra e os rótulos são reordenados pelo relógio, sem tocar nos horários';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Retroativa', v_data, TIME '08:00', 'saida', false);
    v_retro_entrou := true;
  EXCEPTION WHEN OTHERS THEN
    v_msg_recusa := SQLERRM;
  END;

  SELECT string_agg(tipo_marcacao, '>' ORDER BY hora_marcacao),
         string_agg(hora_marcacao::text, '>' ORDER BY hora_marcacao)
    INTO v_seq, v_horas
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = v_data;

  IF v_retro_entrou AND v_seq = 'entrada>saida' AND v_horas = '08:00:00>12:00:00' THEN
    r.situacao := 'passou';
    r.obtido := 'A retroativa entrou e o dia foi reencaixado pelo relógio: entrada 08:00, saída '
             || '12:00, nenhum horário alterado.';
  ELSIF NOT v_retro_entrou THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a inclusão retroativa foi RECUSADA por inteiro. O gatilho de '
             || 'inserção chama a reordenação automática de rótulos '
             || '(ponto_reordena_tipos_dia), mas a reordenação esbarra na trava de imutabilidade '
             || 'da própria marcação (ponto_bloquear_update_marcacao) porque ninguém liga o '
             || 'contexto de retificação (app.ponto_retificacao) antes de reordenar. Resultado: '
             || 'toda retroativa que exija reordenar rótulos falha com "%s" — o RH não consegue '
             || 'completar o dia por ajuste. Correção: o reordenador automático deve executar '
             || 'dentro do contexto de retificação (é alteração de RÓTULO, não de horário — a '
             || 'Portaria 671 protege o horário registrado).', coalesce(v_msg_recusa, '?'));
    r.detalhe := jsonb_build_object('recusa', v_msg_recusa, 'sequencia', v_seq,
                                    'horarios', v_horas);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A retroativa entrou mas o dia ficou incoerente: sequência %s | horários %s '
             || '(esperado entrada>saida em 08:00>12:00). Rótulo errado contamina a apuração do '
             || 'dia inteiro.', coalesce(v_seq, 'vazio'), coalesce(v_horas, 'vazio'));
    r.detalhe := jsonb_build_object('sequencia', v_seq, 'horarios', v_horas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-352 — Tolerância zero é configuração válida (e respeitada)
-- Art. 58, §1º da CLT fixa um TETO; a empresa pode adotar tolerância menor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_352()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3521);
  v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_dia date;
  v_tol_lida int;
  v_saldo int;
BEGIN
  -- primeira segunda-feira do mês passado
  v_dia := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar escala com tolerância diária ZERO e ler de volta';
  r.esperado := 'O zero é aceito e devolvido como zero — não vira "usar padrão de 10"';

  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Tolerância Zero', 480, 0, v_dia, v_dia);
  SELECT e.tolerancia_min INTO v_tol_lida
  FROM public.ponto_escala_do_dia(public.qa_sandbox_tenant_id(), v_cpf, NULL::uuid, v_dia) e;

  IF coalesce(v_tol_lida, -1) <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A escala foi gravada com tolerância 0, mas a leitura devolveu %s. '
             || 'Zero está sendo tratado como "não configurado". Correção: distinguir 0 de NULL.',
             coalesce(v_tol_lida::text, 'NULL'));
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := format('Dia com 471 min trabalhados (9 min a menos que a jornada de 480), tolerância 0, em %s', v_dia);
  r.esperado := 'Com tolerância zero, o saldo do dia é -9 min — cada minuto conta';

  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Tolerância Zero', v_dia, 471);
  SELECT s.saldo_min INTO v_saldo
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
                                           to_char(v_dia, 'YYYY-MM')) s
  WHERE s.dia = v_dia;

  IF v_saldo = -9 THEN
    r.situacao := 'passou';
    r.obtido := 'Tolerância zero aceita e aplicada: os 9 minutos faltantes viraram débito de -9.';
  ELSIF v_saldo = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a tolerância configurada como ZERO foi IGNORADA — o dia com 9 minutos '
             || 'faltantes fechou com saldo 0. Causa: a apuração de saldo tem um perdão fixo de '
             || '10 minutos gravado no código (ponto_saldo_dias_competencia e a função _bruto '
             || 'aplicam "abs(saldo) <= 10 → 0" incondicionalmente), por cima do que a escala '
             || 'diz. Empresa que adota tolerância menor que a legal não consegue: o piso '
             || 'efetivo do sistema é 10 min. Correção: usar a tolerância da escala '
             || '(tolerancia_diaria_minutos) no lugar do 10 fixo, mantendo 10 apenas como teto '
             || 'padrão quando nada foi configurado.';
    r.detalhe := jsonb_build_object('saldo_obtido', v_saldo, 'saldo_esperado', -9,
                                    'tolerancia_configurada', 0);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Saldo inesperado: %s min (esperado -9 com tolerância zero). '
             || 'A apuração não está seguindo nem a configuração nem o padrão de 10.',
             coalesce(v_saldo::text, 'sem linha'));
    r.detalhe := jsonb_build_object('saldo_obtido', v_saldo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-353 — Fronteira exata do teto diário de 10 minutos (art. 58, §1º)
-- Até 10 min de variação no dia: não computa. 11 min: computa os 11 inteiros.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_353()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3531);
  v_base date := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  v_d1 date; v_d2 date;
  v_s1 int; v_s2 int;
BEGIN
  v_d1 := v_base + ((8 - EXTRACT(ISODOW FROM v_base)::int) % 7);  -- segunda-feira
  v_d2 := v_d1 + 1;                                               -- terça-feira

  PERFORM public.qa_ponto_escala_tol(v_cpf, 'QA Fronteira Teto', 480, 10, v_d1, v_d2);
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Fronteira Teto', v_d1, 490);  -- +10 min
  PERFORM public.qa_ponto_dia_min(v_cpf, 'QA Fronteira Teto', v_d2, 491);  -- +11 min

  r.passo_ordem := 1;
  r.passo_acao := format('Apurar dois dias com jornada de 480: %s com 490 min e %s com 491 min', v_d1, v_d2);
  r.esperado := 'Exatos +10 min: saldo 0 (dentro do teto). +11 min: saldo +11 INTEIRO, não só o excedente';

  SELECT max(s.saldo_min) FILTER (WHERE s.dia = v_d1),
         max(s.saldo_min) FILTER (WHERE s.dia = v_d2)
    INTO v_s1, v_s2
  FROM public.ponto_saldo_dias_competencia(public.qa_sandbox_tenant_id(), v_cpf,
                                           to_char(v_d1, 'YYYY-MM')) s;

  IF v_s1 = 0 AND v_s2 = 11 THEN
    r.situacao := 'passou';
    r.obtido := 'Fronteira exata correta: +10 min fechou em 0 (dentro do teto do art. 58, §1º) '
             || 'e +11 min computou os 11 inteiros — estourou o teto, conta tudo, não só o excedente.';
  ELSIF v_s1 = 0 AND v_s2 = 1 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: no dia com +11 min o sistema computou apenas 1 min (o excedente). '
             || 'O art. 58, §1º manda: ultrapassado o teto de 10 min, computa-se TODA a variação '
             || '(os 11 minutos), não só o que passou do teto. Correção: quando |saldo| > teto, '
             || 'manter o saldo integral.';
    r.detalhe := jsonb_build_object('saldo_d1', v_s1, 'saldo_d2', v_s2);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Fronteira errada: +10 min rendeu saldo %s (esperado 0) e +11 min rendeu %s '
             || '(esperado 11). O teto diário do art. 58, §1º não está sendo aplicado no ponto exato.',
             coalesce(v_s1::text, 'sem linha'), coalesce(v_s2::text, 'sem linha'));
    r.detalhe := jsonb_build_object('saldo_d1', v_s1, 'saldo_d2', v_s2);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-354 — Vencimento do saldo segue o instrumento do regime
-- Art. 59, §5º (banco individual: 6 meses) / §2º (acordo/CCT: 12 meses).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_354()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text := public.qa_cpf(3541);
  v_apuracao_preenche boolean;
  v_convertido boolean;
  v_mov int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a apuração do banco preenche o prazo de compensação?';
  r.esperado := 'apurar_banco_horas* deriva prazo_compensacao da configuração do regime (6m/12m)';

  SELECT bool_or(p.prosrc ILIKE '%prazo_compensacao%') INTO v_apuracao_preenche
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('apurar_banco_horas', 'apurar_banco_horas_colaborador');

  r.passo_ordem := 2;
  r.passo_acao := 'Semear saldo de 120 min com prazo vencido ontem e rodar a conversão automática';
  r.esperado := 'O saldo vencido vira hora extra: convertido_extras = true + movimentação de conversão';

  INSERT INTO public.ponto_banco_horas
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, tipo,
     competencia, saldo_anterior_minutos, creditos_minutos, debitos_minutos,
     compensados_minutos, saldo_atual_minutos, convertido_extras, prazo_compensacao)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Vencimento Banco', v_cpf, 'mensal',
          to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'), 0, 120, 0, 0, 120,
          false, CURRENT_DATE - 1);

  PERFORM public.converter_banco_horas_vencido();

  SELECT b.convertido_extras,
         (SELECT count(*) FROM public.ponto_banco_horas_movimentacoes m
           WHERE m.banco_horas_id = b.id AND m.tipo = 'conversao_he')
    INTO v_convertido, v_mov
  FROM public.ponto_banco_horas b
  WHERE b.tenant_id = public.qa_sandbox_tenant_id() AND b.colaborador_cpf = v_cpf;

  IF NOT coalesce(v_convertido, false) OR coalesce(v_mov, 0) = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A conversão de saldo vencido não funcionou nem com o prazo semeado à mão '
             || '(convertido=%s, movimentações=%s). O saldo que passa do prazo legal precisa virar '
             || 'hora extra a pagar.', coalesce(v_convertido::text, 'NULL'), coalesce(v_mov, 0));
  ELSIF NOT coalesce(v_apuracao_preenche, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o mecanismo de conversão existe e funciona QUANDO o prazo está na linha '
             || '(o teste semeou o prazo à mão e o saldo foi convertido) — mas a APURAÇÃO nunca '
             || 'preenche prazo_compensacao. A configuração do regime até guarda '
             || 'prazo_compensacao_dias (ponto_banco_horas_config), só que nenhuma função de '
             || 'apuração a consulta. Resultado prático: nenhum saldo tem vencimento, a conversão '
             || 'automática nunca encontra o que converter, e saldos de banco individual passam '
             || 'dos 6 meses do art. 59, §5º (ou dos 12 meses do §2º) sem virar hora extra. '
             || 'Correção: ao apurar a competência, gravar prazo_compensacao = fim da competência '
             || '+ prazo_compensacao_dias do regime vigente.';
    r.detalhe := jsonb_build_object('conversao_funciona', true,
                                    'apuracao_preenche_prazo', false);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A apuração deriva o prazo do regime e a conversão de saldo vencido funciona.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-355 — Saldo perto de vencer gera alerta com ação
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_355()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe rotina que alerte vencimento próximo do banco?';
  r.esperado := 'Alguma função gera alerta (ponto_alertas) sobre prazo/vencimento do banco de horas';

  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'qa\_%'  -- as rotinas de QA citam os termos no diagnóstico
    AND p.prosrc ILIKE '%ponto_alertas%'
    AND (p.prosrc ILIKE '%venc%' OR p.prosrc ILIKE '%prazo%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função do banco gera alerta de vencimento de saldo. O gerador de '
             || 'alertas de ponto (gerar_alertas_ponto) só conhece falta e atraso. Sem aviso '
             || 'antecipado, o RH só descobre o saldo vencido quando ele já virou passivo de hora '
             || 'extra (art. 59, §5º) — e o PONTO-354 mostra que nem essa conversão dispara hoje. '
             || 'Correção: rotina periódica que, X dias antes de prazo_compensacao, crie alerta em '
             || 'ponto_alertas com a ação sugerida (programar compensação ou pagar).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Alerta de vencimento presente em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-356 — Estouro do limite de acúmulo do banco
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_356()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_col_existe boolean;
  v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o limite de acúmulo configurado é aplicado em algum lugar?';
  r.esperado := 'A apuração compara o saldo com limite_acumulo_horas e trata/alerta o excedente';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ponto_banco_horas_config'
      AND column_name = 'limite_acumulo_horas'
  ) INTO v_col_existe;

  IF NOT v_col_existe THEN
    r.situacao := 'nao_implementado';
    r.obtido := 'A configuração nem tem campo de limite de acúmulo nesta base.';
    RETURN r;
  END IF;

  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%limite_acumulo%';

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o campo limite_acumulo_horas existe na configuração do banco '
             || '(ponto_banco_horas_config), mas NENHUMA função o consulta. É configuração '
             || 'decorativa: o gestor define um teto de acúmulo, o colaborador passa dele, e nada '
             || 'acontece — nem alerta, nem retenção, nem conversão do excedente. Correção: na '
             || 'apuração da competência, comparar saldo_atual_minutos com o limite do regime e '
             || 'gerar alerta/tratamento do excedente.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Limite de acúmulo aplicado em: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- PONTO-357 — Rejeição de ajuste: motivo visível, dia intocado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_357()
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
  v_cpf text;
  v_data date := CURRENT_DATE - 2;
  v_ajuste_id uuid;
  v_status_pend text;
  v_status_final text;
  v_antes text; v_depois text;
  v_motivo_visivel boolean;
  v_col_fantasma text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Rejeição Ajuste', 3571);
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Rejeição Ajuste', v_data, TIME '08:00', 'entrada');
  PERFORM public.qa_ponto_marca(v_cpf, 'QA Rejeição Ajuste', v_data, TIME '17:00', 'saida');

  SELECT string_agg(hora_marcacao::text || tipo_marcacao, '|' ORDER BY hora_marcacao)
    INTO v_antes
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = v_data;

  r.passo_ordem := 1;
  r.passo_acao := 'Abrir ajuste de correção (08:00 → 07:50) e consolidar o dia';
  r.esperado := 'Enquanto pende, o dia fica sinalizado como ajuste_pendente';

  INSERT INTO public.ponto_ajustes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_referencia, tipo_ajuste, tipo_marcacao, hora_original, hora_solicitada, motivo)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), 'QA Rejeição Ajuste', v_cpf,
          v_data, 'correcao', 'entrada', TIME '08:00', TIME '07:50',
          'Esqueci de bater na hora certa')
  RETURNING id INTO v_ajuste_id;

  PERFORM public.consolidar_ponto_diario_manual(public.qa_sandbox_tenant_id(), v_cpf, v_data);
  SELECT status INTO v_status_pend
  FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data = v_data;

  r.passo_ordem := 2;
  r.passo_acao := 'Rejeitar o ajuste com motivo e reconsolidar';
  r.esperado := 'Status rejeitado com motivo registrado; marcações e horários exatamente como antes';

  UPDATE public.ponto_ajustes
  SET status = 'rejeitado',
      observacao_aprovador = 'Documento não comprova o horário alegado',
      data_aprovacao = now()
  WHERE id = v_ajuste_id;

  PERFORM public.consolidar_ponto_diario_manual(public.qa_sandbox_tenant_id(), v_cpf, v_data);
  SELECT status INTO v_status_final
  FROM public.ponto_diario
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data = v_data;

  SELECT string_agg(hora_marcacao::text || tipo_marcacao, '|' ORDER BY hora_marcacao)
    INTO v_depois
  FROM public.ponto_marcacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id()
    AND colaborador_cpf = v_cpf AND data_marcacao = v_data;

  SELECT (observacao_aprovador IS NOT NULL AND btrim(observacao_aprovador) <> '')
    INTO v_motivo_visivel
  FROM public.ponto_ajustes WHERE id = v_ajuste_id;

  r.passo_ordem := 3;
  r.passo_acao := 'AUDITORIA (somente leitura): o fluxo de APROVAÇÃO de correção referencia colunas reais?';
  r.esperado := 'processar_ajuste_ponto grava marcação de ajuste usando colunas que existem';

  SELECT string_agg(c.col, ', ') INTO v_col_fantasma
  FROM (VALUES ('data_hora'), ('ajuste_id'), ('criado_por')) c(col)
  WHERE EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'processar_ajuste_ponto'
        AND p.prosrc ILIKE '%' || c.col || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public' AND ic.table_name = 'ponto_marcacoes'
        AND ic.column_name = c.col
    );

  IF v_status_pend = 'ajuste_pendente' AND v_status_final <> 'ajuste_pendente'
     AND v_antes = v_depois AND v_motivo_visivel AND v_col_fantasma IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Rejeição íntegra: o dia saiu de ajuste_pendente, o motivo ficou registrado, e as '
             || 'marcações originais não mudaram um segundo.';
  ELSIF v_status_pend = 'ajuste_pendente' AND v_status_final <> 'ajuste_pendente'
     AND v_antes = v_depois AND v_motivo_visivel THEN
    r.situacao := 'falhou';
    r.obtido := format('A REJEIÇÃO em si está íntegra (dia intocado, motivo visível, pendência '
             || 'baixada) — mas a auditoria do mesmo fluxo achou problema grave na APROVAÇÃO: '
             || 'processar_ajuste_ponto grava a marcação corrigida usando coluna(s) que NÃO '
             || 'EXISTEM em ponto_marcacoes (%s; a tabela usa data_marcacao/hora_marcacao/'
             || 'tipo_marcacao). Aprovar um ajuste de correção ou inclusão por essa função quebra '
             || 'em tempo de execução — ou existe um caminho paralelo na tela que contorna a '
             || 'função do banco. Correção: alinhar o INSERT/DELETE da função ao esquema real.',
             v_col_fantasma);
    r.detalhe := jsonb_build_object('colunas_fantasmas', v_col_fantasma,
                                    'rejeicao_integra', true);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Rejeição mal comportada: pendente=%s (esperado ajuste_pendente), '
             || 'final=%s (não podia seguir pendente), marcações %s, motivo %s. A rejeição não '
             || 'pode deixar rastro no dia nem sumir com a resposta ao colaborador.',
             coalesce(v_status_pend, 'NULL'), coalesce(v_status_final, 'NULL'),
             CASE WHEN v_antes = v_depois THEN 'intactas' ELSE 'ALTERADAS' END,
             CASE WHEN v_motivo_visivel THEN 'visível' ELSE 'AUSENTE' END);
    r.detalhe := jsonb_build_object('status_pendente', v_status_pend,
                                    'status_final', v_status_final,
                                    'marcacoes_intactas', v_antes = v_depois,
                                    'motivo_visivel', v_motivo_visivel,
                                    'colunas_fantasmas', v_col_fantasma);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- Registro das rotinas no motor
-- ---------------------------------------------------------------------------
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PONTO-350', 'qa_caso_ponto_350', true),
  ('PONTO-351', 'qa_caso_ponto_351', true),
  ('PONTO-352', 'qa_caso_ponto_352', true),
  ('PONTO-353', 'qa_caso_ponto_353', true),
  ('PONTO-354', 'qa_caso_ponto_354', true),
  ('PONTO-355', 'qa_caso_ponto_355', true),
  ('PONTO-356', 'qa_caso_ponto_356', true),
  ('PONTO-357', 'qa_caso_ponto_357', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
