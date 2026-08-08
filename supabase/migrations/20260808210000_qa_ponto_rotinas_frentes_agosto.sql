-- =========================================================
-- QA — Ponto: rotinas das frentes de agosto — 1ª leva (07/08)
--
-- Implementa as rotinas executáveis de 9 dos 16 casos documentados na
-- migration 20260808200000. O critério da leva: entram os casos cuja
-- verificação depende de fixtures que o cercado já sabe montar
-- (admissão, empresa, ponto_diario, marcação). Ficam para a 2ª leva os
-- que exigem cenário completo de apuração com escala e feriado
-- resolvido — o motor os reporta honestamente como sem rotina:
--
--   PONTO-291 (amparo na materialização: precisa de atestado aprovado)
--   PONTO-312 (reatribuição no reapurar: precisa do fluxo de fechamento)
--   PONTO-320..322 (RN23: precisa de feriado + marcações no dia)
--   PONTO-330..331 (espelho-resumo: precisa de competência apurada)
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE. As rotinas testam o comportamento
-- que as correções de agosto prometeram; se alguma regredir, a bateria
-- acusa com o diagnóstico no obtido.
-- =========================================================

SET lock_timeout = '10s';

-- Helper: admissão de ponto no cercado (colaborador que bate ponto).
-- Devolve o CPF limpo — boa parte do ponto é localizada por CPF.
CREATE OR REPLACE FUNCTION public.qa_ponto_admissao(
  p_nome text,
  p_cpf_semente int,
  p_empresa_id uuid DEFAULT NULL,
  p_data_admissao date DEFAULT CURRENT_DATE - 60
)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_cpf text := public.qa_cpf(p_cpf_semente);
BEGIN
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao, empresa_id)
  VALUES (public.qa_sandbox_tenant_id(), p_nome, v_cpf,
          public.qa_fixture_email('PONTO-AGO', p_cpf_semente),
          'Operador', 'concluido', p_data_admissao, p_empresa_id);
  RETURN v_cpf;
END $$;

-- Helper: linha pronta de ponto_diario no cercado.
CREATE OR REPLACE FUNCTION public.qa_ponto_dia(
  p_cpf text, p_nome text, p_data date,
  p_empresa_id uuid DEFAULT NULL,
  p_status text DEFAULT 'completo'
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ponto_diario
    (tenant_id, empresa_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data, entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, status)
  VALUES (public.qa_sandbox_tenant_id(), p_empresa_id, gen_random_uuid(), p_nome, p_cpf,
          p_data, TIME '08:00', TIME '12:00', TIME '13:00', TIME '17:00', 8.0, p_status);
END $$;

-- Um dia útil recente e já vivido (evita cair em fim de semana).
CREATE OR REPLACE FUNCTION public.qa_dia_util_passado(p_atras int DEFAULT 7)
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT d::date FROM generate_series(CURRENT_DATE - p_atras, CURRENT_DATE - 1, interval '1 day') d
  WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5
  ORDER BY d LIMIT 1
$$;

-- ══ PONTO-290: dia sem batida é materializado ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_290()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_dia date := public.qa_dia_util_passado(); v_n int; v_res jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Faltante Materializado', 29001);

  r.passo_ordem := 1;
  r.passo_acao := format('Materializar o dia útil %s, sem nenhuma marcação do colaborador', v_dia);
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
        v_cpf text; v_dia date := public.qa_dia_util_passado(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Idempotente', 29201);
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
    r.obtido := format('%s linhas para a mesma data — a materialização repetida DUPLICA o dia, a doença que a frente um-dia-por-data acabou de tratar.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-293: diagnóstico acusa antes e silencia depois ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_293()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_comp text := to_char(CURRENT_DATE, 'YYYY-MM'); v_antes int; v_depois int;
BEGIN
  PERFORM public.qa_modo_ligar();
  -- Admissão no início do mês corrente: os dias úteis já vividos do mês
  -- estão todos sem linha.
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Diagnosticado', 29301,
                                    NULL, date_trunc('month', CURRENT_DATE)::date);

  r.passo_ordem := 1; r.passo_acao := 'Rodar o diagnóstico com os dias sem linha';
  r.esperado := 'O colaborador aparece na lista de não materializados';
  SELECT count(*) INTO v_antes
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_antes = 0 THEN
    -- Início de mês sem dia útil vivido ainda: nada a diagnosticar.
    IF public.qa_dia_util_passado(CURRENT_DATE - date_trunc('month', CURRENT_DATE)::date + 1) IS NULL
       OR date_trunc('month', CURRENT_DATE)::date > CURRENT_DATE - 1 THEN
      r.situacao := 'passou';
      r.obtido := 'Competência sem dia útil vivido — nada a materializar, diagnóstico vazio é o correto.';
      RETURN r;
    END IF;
    r.situacao := 'falhou';
    r.obtido := 'O DIAGNÓSTICO NÃO ENXERGA O BURACO: colaborador com dias úteis sem linha não aparece em ponto_dias_nao_materializados.';
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Materializar o mês e rodar o diagnóstico de novo';
  r.esperado := 'O colaborador sai da lista';
  PERFORM public.ponto_materializar_faltas(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE - 1, v_t);
  SELECT count(*) INTO v_depois
  FROM public.ponto_dias_nao_materializados(v_t, v_comp) d
  WHERE regexp_replace(d.colaborador_cpf, '[^0-9]', '', 'g') = v_cpf;

  IF v_depois = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Diagnóstico acusou o buraco e silenciou depois da materialização.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'Após materializar, o colaborador continua na lista — ou a materialização não cobriu, ou o diagnóstico não bate com ela.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-300: no máximo uma linha por data ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_300()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM');
        v_dup int; v_lista text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Um Dia Por Data', 30001);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Um Dia Por Data', public.qa_dia_util_passado());

  r.passo_ordem := 1;
  r.passo_acao := 'Apurar a competência e procurar datas repetidas na saída';
  r.esperado := 'Nenhuma data aparece mais de uma vez';
  SELECT count(*), string_agg(x.dia::text, ', ') INTO v_dup, v_lista
  FROM (
    SELECT s.dia FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp) s
    GROUP BY s.dia HAVING count(*) > 1
  ) x;

  IF v_dup = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Um dia civil, uma linha de apuração — a garantia do invólucro está de pé.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('DATA DUPLICADA NA APURAÇÃO (%s): o dia debita o colaborador duas vezes — a regressão do caso Adriana (débito de 3h40 inexistente).', v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-301: dia normal atravessa intocado ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_301()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM'); v_dif int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Intocado', 30101);
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Intocado', public.qa_dia_util_passado());

  r.passo_ordem := 1;
  r.passo_acao := 'Comparar a apuração pública com a bruta num período sem duplicatas';
  r.esperado := 'Idênticas, linha a linha — o invólucro só age quando há duplicata';
  SELECT count(*) INTO v_dif FROM (
    SELECT * FROM public.ponto_saldo_dias_competencia(v_t, v_cpf, v_comp)
    EXCEPT
    SELECT * FROM public.ponto_saldo_dias_competencia_bruto(v_t, v_cpf, v_comp)
  ) x;

  IF v_dif = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Sem duplicata, a saída pública é idêntica à bruta — a correção foi cirúrgica como prometido.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('%s linha(s) diferentes entre a função pública e a bruta num período SEM duplicatas — o invólucro está alterando dias que deveria deixar em paz.', v_dif);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-310: apuração por empresa só traz aquela empresa ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_310()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp_a uuid; v_emp_b uuid; v_cpf_a text; v_cpf_b text;
        v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM');
        v_a_na_a int; v_b_na_a int; v_a_na_b int; v_b_na_b int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp_a := public.qa_nova_empresa('[QA-PONTO] Empresa A', '11222333031001');
  v_emp_b := public.qa_nova_empresa('[QA-PONTO] Empresa B', '11222333031102');
  v_cpf_a := public.qa_ponto_admissao('[QA-PONTO] Da Empresa A', 31001, v_emp_a);
  v_cpf_b := public.qa_ponto_admissao('[QA-PONTO] Da Empresa B', 31002, v_emp_b);
  PERFORM public.qa_ponto_dia(v_cpf_a, '[QA-PONTO] Da Empresa A', public.qa_dia_util_passado(), v_emp_a);
  PERFORM public.qa_ponto_dia(v_cpf_b, '[QA-PONTO] Da Empresa B', public.qa_dia_util_passado(), v_emp_b);

  r.passo_ordem := 1; r.passo_acao := 'Apurar o espelho-resumo filtrando pela empresa A';
  r.esperado := 'Só o colaborador da A na saída';
  SELECT count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_a),
         count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_b)
  INTO v_a_na_a, v_b_na_a
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_a, v_comp) e;

  r.passo_ordem := 2; r.passo_acao := 'Apurar pela empresa B';
  r.esperado := 'Só o da B — sem interseção';
  SELECT count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_a),
         count(*) FILTER (WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf_b)
  INTO v_a_na_b, v_b_na_b
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_b, v_comp) e;

  IF v_a_na_a = 1 AND v_b_na_a = 0 AND v_b_na_b = 1 AND v_a_na_b = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Cada empresa apura o próprio pessoal, e mais ninguém.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('VAZAMENTO ENTRE EMPRESAS DO MESMO TENANT: na apuração da A, colaborador A %sx e B %sx; na da B, A %sx e B %sx. Fechar a empresa A não pode arrastar gente da B — é a regressão do caso "fecha pra todas as empresas".',
      v_a_na_a, v_b_na_a, v_a_na_b, v_b_na_b);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-311: sem empresa na linha, vale a do cadastro ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_311()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp_a uuid; v_emp_b uuid; v_cpf text; v_resolvida uuid;
        v_comp text := to_char(CURRENT_DATE - 7, 'YYYY-MM'); v_na_a int; v_na_b int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp_a := public.qa_nova_empresa('[QA-PONTO] Cadastro A', '11222333031203');
  v_emp_b := public.qa_nova_empresa('[QA-PONTO] Cadastro B', '11222333031304');
  v_cpf := public.qa_ponto_admissao('[QA-PONTO] Sem Empresa Na Linha', 31101, v_emp_a);
  -- Linha de ponto SEM empresa preenchida — o cenário da válvula de escape.
  PERFORM public.qa_ponto_dia(v_cpf, '[QA-PONTO] Sem Empresa Na Linha', public.qa_dia_util_passado(), NULL);

  r.passo_ordem := 1; r.passo_acao := 'Resolver a empresa do CPF pelo cadastro';
  r.esperado := 'A empresa da admissão (A), não qualquer uma';
  v_resolvida := public.ponto_empresa_do_cpf(v_t, v_cpf);
  IF v_resolvida IS DISTINCT FROM v_emp_a THEN
    r.situacao := 'falhou';
    r.obtido := format('ponto_empresa_do_cpf devolveu %s (esperado a empresa A da admissão).', coalesce(v_resolvida::text, 'nulo'));
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Apurar pela empresa A e pela empresa B';
  r.esperado := 'O colaborador aparece na A (empresa do cadastro) e nunca na B';
  SELECT count(*) INTO v_na_a
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_a, v_comp) e
  WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf;
  SELECT count(*) INTO v_na_b
  FROM public.ponto_espelho_resumo_empresa(v_t, v_emp_b, v_comp) e
  WHERE regexp_replace(e.colaborador_cpf,'[^0-9]','','g') = v_cpf;

  IF v_na_a >= 1 AND v_na_b = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Linha sem empresa foi resolvida pelo cadastro: entra na A, nunca na B.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Colaborador sem empresa na linha: %sx na apuração da A e %sx na da B. A válvula "OR empresa_id IS NULL" — que punha todo mundo em todas — não pode voltar.', v_na_a, v_na_b);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-340: origem O na batida, A no ajuste ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_340()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text; v_origem text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_cpf := public.qa_cpf(34001);

  r.passo_ordem := 1; r.passo_acao := 'Registrar batida comum, sem informar origem';
  r.esperado := 'origem_marcacao = O (original), pelo DEFAULT';
  INSERT INTO public.ponto_marcacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao)
  VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Batida Comum', v_cpf,
          CURRENT_DATE - 1, TIME '08:00', 'entrada', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'))
  RETURNING origem_marcacao INTO v_origem;

  IF v_origem <> 'O' THEN
    r.situacao := 'falhou';
    r.obtido := format('Batida comum nasceu com origem %s (esperado O).', v_origem);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Gravar marcação de ajuste com origem A';
  r.esperado := 'origem_marcacao = A aceita e persistida';
  INSERT INTO public.ponto_marcacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao,
     marcacao_original, origem_marcacao)
  VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Batida Comum', v_cpf,
          CURRENT_DATE - 1, TIME '08:05', 'entrada', encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'),
          false, 'A')
  RETURNING origem_marcacao INTO v_origem;

  IF v_origem = 'A' THEN
    r.situacao := 'passou';
    r.obtido := 'Batida nasce O; ajuste é rotulado A e não se disfarça de original.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Ajuste gravado com origem %s (esperado A).', v_origem);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PONTO-341: origem fora da lista é recusada ══
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_341()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1; r.passo_acao := 'Gravar marcação com origem_marcacao = X';
  r.esperado := 'Recusado pelo CHECK (só O/A/P/E/I)';
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, origem_marcacao)
    VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Origem Inventada', public.qa_cpf(34101),
            CURRENT_DATE - 1, TIME '08:00', 'entrada',
            encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 'X');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU origem X — fora da lista O/A/P/E/I, quebraria a geração do AEJ.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusada a origem X.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Gravar marcação com origem nula';
  r.esperado := 'Recusado — coluna NOT NULL';
  BEGIN
    INSERT INTO public.ponto_marcacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_marcacao, hora_marcacao, tipo_marcacao, hash_marcacao, origem_marcacao)
    VALUES (v_t, gen_random_uuid(), '[QA-PONTO] Origem Nula', public.qa_cpf(34102),
            CURRENT_DATE - 1, TIME '08:00', 'entrada',
            encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), NULL);
    r.situacao := 'falhou'; r.obtido := 'Recusou X mas ACEITOU origem nula.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Só entram as cinco origens previstas, e nunca nula.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PONTO-290', 'qa_caso_ponto_290', true),
  ('PONTO-292', 'qa_caso_ponto_292', true),
  ('PONTO-293', 'qa_caso_ponto_293', true),
  ('PONTO-300', 'qa_caso_ponto_300', true),
  ('PONTO-301', 'qa_caso_ponto_301', true),
  ('PONTO-310', 'qa_caso_ponto_310', true),
  ('PONTO-311', 'qa_caso_ponto_311', true),
  ('PONTO-340', 'qa_caso_ponto_340', true),
  ('PONTO-341', 'qa_caso_ponto_341', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'jornada-rotina/ponto');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
