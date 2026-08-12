-- ============================================================================
-- QA PONTO — 5ª leva (parte 1): rotinas do catálogo original de conformidade
-- PONTO-001..093 (marcação, apuração do dia, tolerância, intervalos, HE).
-- Padrão da casa: testa o comportamento que a LEI exige; divergência vira
-- falha proposital com diagnóstico. Nenhuma funcionalidade é alterada.
-- ============================================================================

-- Dia de ponto com horários explícitos (entrada/almoço/saída sob medida).
CREATE OR REPLACE FUNCTION public.qa_ponto_dia_horarios(
  p_cpf text, p_nome text, p_data date,
  p_entrada time, p_saida time,
  p_salm time DEFAULT NULL, p_ralm time DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_min int;
BEGIN
  v_min := floor(EXTRACT(EPOCH FROM (p_saida - p_entrada))/60)::int;
  IF v_min < 0 THEN v_min := v_min + 1440; END IF;
  IF p_salm IS NOT NULL AND p_ralm IS NOT NULL THEN
    v_min := v_min - floor(EXTRACT(EPOCH FROM (p_ralm - p_salm))/60)::int;
  END IF;
  INSERT INTO public.ponto_diario
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf, data,
     entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status)
  VALUES (public.qa_sandbox_tenant_id(), v_id, p_nome, p_cpf, p_data,
          p_entrada, p_salm, p_ralm, p_saida, make_interval(mins => v_min), 'regular')
  ON CONFLICT (tenant_id, colaborador_cpf, data) DO UPDATE
    SET entrada = EXCLUDED.entrada, saida = EXCLUDED.saida,
        saida_almoco = EXCLUDED.saida_almoco, retorno_almoco = EXCLUDED.retorno_almoco,
        horas_trabalhadas = EXCLUDED.horas_trabalhadas
  RETURNING colaborador_id INTO v_id;
  RETURN v_id;
END $$;

-- PONTO-001 — marcação com data, hora e CPF
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-003 — sistema não marca ponto automaticamente
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-004 — original não pode ser alterada nem apagada
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
    r.obtido := 'Alteração e exclusão da marcação original foram bloqueadas. Nota de risco já '
             || 'conhecida: a trava de exclusão libera papéis de gestão '
             || '(pode_excluir_registro_ponto) — a mesma população que edita pela tela.';
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
END $$;

-- PONTO-020 — dia completo: saldo zero, status regular
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-021 — número ímpar de marcações não inventa par
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-022 — turno que cruza a meia-noite pertence ao dia de início
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-023 — dia útil sem marcação é falta
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_023()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text; v_dia date := public.qa_dia_util_passado();
        v_status text;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Falta Real', 5023);
  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s sem nenhuma marcação', v_dia);
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
             || 'INEXISTENTE — a consolidação só cria a linha quando consegue resolver o '
             || 'colaborador a partir de uma marcação ou ajuste anterior. Quem nunca bateu '
             || '(admitido que não compareceu, colaborador sem onboarding do app) nunca vira '
             || 'falta: é o funcionário invisível. Correção: resolver o colaborador também pelo '
             || 'cadastro de admissões na materialização.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O dia sem marcação ficou como %s — ausência tratada como neutra esconde '
             || 'o efeito legal sobre o DSR.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- PONTO-024 — ausência amparada não vira falta
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_024()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-025 — colaborador afastado não consegue marcar
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_025()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-040 — variação de até 5 min não é computada (bilateral)
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-041 — fronteira exata dos 5 minutos por marcação
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-042 — teto diário e limite por marcação são cumulativos
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_042()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-043 — cadastro de tolerância acima do limite legal é recusado
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_043()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-060/061 — supressão de intervalo (parcial e total)
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ponto_061()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-062 — faixas de intervalo por duração da jornada
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_062()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-063 — redução por norma coletiva respeita o piso de 30 minutos
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_063()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-064 — pré-assinalação do intervalo
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_064()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-080 — interjornada de 11 horas
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_080()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-090 — HE em dia útil com 50%
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_090()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-091 — horas normais usam a jornada real da escala
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_091()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-092 — excesso ao limite de 2h extras é apurado E sinalizado
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_092()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- PONTO-093 — necessidade imperiosa tem regime próprio
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_093()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- Registro no motor
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PONTO-001','qa_caso_ponto_001',true), ('PONTO-003','qa_caso_ponto_003',true),
  ('PONTO-004','qa_caso_ponto_004',true), ('PONTO-020','qa_caso_ponto_020',true),
  ('PONTO-021','qa_caso_ponto_021',true), ('PONTO-022','qa_caso_ponto_022',true),
  ('PONTO-023','qa_caso_ponto_023',true), ('PONTO-024','qa_caso_ponto_024',true),
  ('PONTO-025','qa_caso_ponto_025',true), ('PONTO-040','qa_caso_ponto_040',true),
  ('PONTO-041','qa_caso_ponto_041',true), ('PONTO-042','qa_caso_ponto_042',true),
  ('PONTO-043','qa_caso_ponto_043',true), ('PONTO-060','qa_caso_ponto_060',true),
  ('PONTO-061','qa_caso_ponto_061',true), ('PONTO-062','qa_caso_ponto_062',true),
  ('PONTO-063','qa_caso_ponto_063',true), ('PONTO-064','qa_caso_ponto_064',true),
  ('PONTO-080','qa_caso_ponto_080',true), ('PONTO-090','qa_caso_ponto_090',true),
  ('PONTO-091','qa_caso_ponto_091',true), ('PONTO-092','qa_caso_ponto_092',true),
  ('PONTO-093','qa_caso_ponto_093',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;
