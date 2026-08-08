-- =========================================================
-- QA — Empresa: rotinas da revisão de 07/08 (casos de nível api)
--
-- Implementa as rotinas executáveis dos casos documentados na migration
-- 20260808150000: EMP-070/071 (unicidade de CPF), FER-001..005 (tabela
-- de feriados da unidade) e TAC-001/003 (TAC detalhado). Os casos de
-- nível e2e da mesma leva (EMP-072, TAC-002/004, RASC-*, LOTE-001)
-- vivem no React e ficam de fora por critério — o motor já os reporta
-- como e2e em vez de contá-los como dívida.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE AQUI. Onde o sistema hoje se
-- comporta diferente do que o caso exige (CPF duplicado aceito, duas
-- tabelas de feriado na mesma unidade, TAC com vigência invertida),
-- a rotina testa o comportamento CORRETO e vai FALHAR de propósito:
-- é assim que o achado chega ao relatório para o desenvolvimento.
-- =========================================================

SET lock_timeout = '10s';

-- Helper: empresa PF no cercado (o qa_nova_empresa existente é só PJ).
CREATE OR REPLACE FUNCTION public.qa_nova_empresa_pf(
  p_razao text, p_cpf text, p_ativo boolean DEFAULT true
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, nome_fantasia, tipo_pessoa, cpf, ativo)
  VALUES (public.qa_sandbox_tenant_id(), p_razao, p_razao, 'pf', p_cpf, p_ativo)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ══ EMP-070: duas PF ativas com o mesmo CPF ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_070()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(700); v_dup uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_nova_empresa_pf('[QA-EMP] Firma Individual A', v_cpf, true);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segunda empresa PF ATIVA com o mesmo CPF no mesmo tenant';
  r.esperado := 'Recusado com erro de duplicidade, como acontece com CNPJ (EMP-020)';
  BEGIN
    v_dup := public.qa_nova_empresa_pf('[QA-EMP] Firma Individual B', v_cpf, true);
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU a segunda empresa ativa com o mesmo CPF. '
      'O trigger prevent_duplicate_active_cnpj compara apenas a coluna cnpj — '
      'empresa PF (cnpj nulo, documento em cpf) passa sem verificação nenhuma. '
      'A regra de unicidade de EMP-020 depende do tipo de pessoa, e não deveria.';
    RETURN r;
  EXCEPTION WHEN unique_violation THEN
    r.obtido := 'Recusado o CPF limpo.';
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Repetir com o mesmo CPF pontuado (espelho de EMP-013)';
  r.esperado := 'Reconhecido como o mesmo documento e recusado';
  BEGIN
    v_dup := public.qa_nova_empresa_pf('[QA-EMP] Firma Individual C',
      format('%s.%s.%s-%s', substr(v_cpf,1,3), substr(v_cpf,4,3), substr(v_cpf,7,3), substr(v_cpf,10,2)),
      true);
    r.situacao := 'falhou';
    r.obtido := 'O CPF pontuado entrou ativo ao lado do mesmo número limpo — a comparação precisa normalizar a pontuação, como o trigger de CNPJ já faz.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Duplicata de CPF recusada com e sem pontuação.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ EMP-071: duplicata INATIVA do mesmo CPF convive; reativar é barrado ══
CREATE OR REPLACE FUNCTION public.qa_caso_emp_071()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(710); v_inativa uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_nova_empresa_pf('[QA-EMP] PF Ativa', v_cpf, true);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segunda empresa PF com o mesmo CPF e ativo = false';
  r.esperado := 'Aceita — a proibição vale só entre ativas (espelho de EMP-023)';
  v_inativa := public.qa_nova_empresa_pf('[QA-EMP] PF Historica', v_cpf, false);
  IF v_inativa IS NULL THEN
    r.situacao := 'falhou'; r.obtido := 'A inativa não entrou.'; RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar reativar a inativa com o CPF ainda ativo na outra';
  r.esperado := 'Recusado (espelho de EMP-021)';
  BEGIN
    UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_inativa;
    r.situacao := 'falhou';
    r.obtido := 'A REATIVAÇÃO PASSOU: duas empresas PF ativas com o mesmo CPF. Mesma causa de EMP-070 — o trigger de duplicidade não olha a coluna cpf.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Inativa convive; reativação com CPF já ativo é barrada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- FERIADOS — helper: tabela de feriados no cercado
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_tabela_feriados(
  p_nome text, p_tenant uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_t uuid := COALESCE(p_tenant, public.qa_sandbox_tenant_id()); v_id uuid;
BEGIN
  INSERT INTO public.feriado_tabelas (tenant_id, nome, uf, municipio, ano, ativo)
  VALUES (v_t, p_nome, 'SP', 'São Paulo', 2026, true)
  RETURNING id INTO v_id;
  INSERT INTO public.feriado_tabela_itens (tenant_id, tabela_id, nome, data, recorrente, tipo, ativo)
  VALUES (v_t, v_id, '[QA] Aniversário da Cidade', DATE '2026-01-25', false, 'feriado', true);
  RETURN v_id;
END $$;

-- ══ FER-001: vincular tabela à unidade ══
CREATE OR REPLACE FUNCTION public.qa_caso_fer_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-FER] Unidade SP', '11222333007101');
  v_tab := public.qa_nova_tabela_feriados('[QA-FER] Feriados SP 2026');

  r.passo_ordem := 1; r.passo_acao := 'Vincular a tabela à unidade';
  r.esperado := 'Vínculo gravado em feriado_tabela_empresas';
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab, v_emp);

  SELECT count(*) INTO v_n FROM public.feriado_tabela_empresas
  WHERE empresa_id = v_emp AND tabela_id = v_tab;
  IF v_n = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Unidade vinculada à tabela; os itens da tabela valem para ela.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('Esperado 1 vínculo, encontrado %s.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FER-002: trocar substitui, não acumula ══
CREATE OR REPLACE FUNCTION public.qa_caso_fer_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab1 uuid; v_tab2 uuid; v_n int; v_qual uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp  := public.qa_nova_empresa('[QA-FER] Unidade Troca', '11222333007202');
  v_tab1 := public.qa_nova_tabela_feriados('[QA-FER] Tabela Antiga');
  v_tab2 := public.qa_nova_tabela_feriados('[QA-FER] Tabela Nova');
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab1, v_emp);

  r.passo_ordem := 1; r.passo_acao := 'Trocar a tabela (remover a antiga, gravar a nova)';
  r.esperado := 'Após a troca, exatamente um vínculo, apontando a tabela nova';
  DELETE FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab2, v_emp);

  SELECT count(*), min(tabela_id) INTO v_n, v_qual
  FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  IF v_n <> 1 OR v_qual <> v_tab2 THEN
    r.situacao := 'falhou';
    r.obtido := format('Após a troca: %s vínculo(s), tabela %s.', v_n, v_qual);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Selecionar a opção sem tabela';
  r.esperado := 'Unidade fica sem vínculo, sem erro';
  DELETE FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  SELECT count(*) INTO v_n FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  IF v_n = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Troca substitui; desvincular zera sem erro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('Sobraram %s vínculo(s) após desvincular.', v_n);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FER-003: duas tabelas na mesma unidade ══
CREATE OR REPLACE FUNCTION public.qa_caso_fer_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab1 uuid; v_tab2 uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp  := public.qa_nova_empresa('[QA-FER] Unidade Ambigua', '11222333007303');
  v_tab1 := public.qa_nova_tabela_feriados('[QA-FER] Municipal');
  v_tab2 := public.qa_nova_tabela_feriados('[QA-FER] Estadual');
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab1, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segundo vínculo (outra tabela) sem apagar o primeiro';
  r.esperado := 'Recusado — uma tabela de feriados por unidade';
  BEGIN
    INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
    VALUES (v_t, v_tab2, v_emp);
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU a mesma unidade em DUAS tabelas de feriados. '
      'O UNIQUE é (tabela_id, empresa_id) e a regra de uma tabela por unidade vive só '
      'no delete-then-insert da tela — dado por API ou SQL cria a ambiguidade, e a '
      'apuração de ponto não tem critério para escolher qual calendário vale.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Segundo vínculo simultâneo recusado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FER-004: tabela de outro cliente ══
CREATE OR REPLACE FUNCTION public.qa_caso_fer_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id();
        v_emp uuid; v_tab_t2 uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN
    r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r;
  END IF;
  v_emp    := public.qa_nova_empresa('[QA-FER] Unidade T1', '11222333007404');
  v_tab_t2 := public.qa_nova_tabela_feriados('[QA-FER] Tabela do Outro Cliente', v_t2);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir vínculo no tenant 1 apontando tabela de feriados do tenant 2';
  r.esperado := 'Recusado — tabela e unidade precisam ser do mesmo tenant';
  BEGIN
    INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
    VALUES (v_t1, v_tab_t2, v_emp);
    r.situacao := 'falhou';
    r.obtido := 'VÍNCULO CRUZANDO TENANTS ACEITO: a unidade do tenant 1 ficou presa ao '
      'calendário de feriados de outro cliente. A RLS confere o tenant da linha de '
      'vínculo, e a FK de tabela_id não olha tenant — falta um gatilho de coerência.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou';
    r.obtido := 'Vínculo cruzando tenants recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ FER-005: apagar a tabela vinculada ══
CREATE OR REPLACE FUNCTION public.qa_caso_fer_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab uuid; v_vinculos int; v_empresa_ok int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-FER] Unidade Cascade', '11222333007505');
  v_tab := public.qa_nova_tabela_feriados('[QA-FER] Tabela Extinta');
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab, v_emp);

  r.passo_ordem := 1; r.passo_acao := 'Apagar a tabela de feriados vinculada';
  r.esperado := 'Cascade leva o vínculo junto; nenhum vínculo órfão';
  DELETE FROM public.feriado_tabelas WHERE id = v_tab;
  SELECT count(*) INTO v_vinculos FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  IF v_vinculos <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('Sobraram %s vínculo(s) órfão(s) após apagar a tabela.', v_vinculos);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Conferir a unidade';
  r.esperado := 'Empresa intacta, apenas sem tabela';
  SELECT count(*) INTO v_empresa_ok FROM public.empresa_cadastro WHERE id = v_emp AND ativo = true;
  IF v_empresa_ok = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou o vínculo; a unidade segue íntegra.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'A exclusão da tabela afetou a própria empresa.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ TAC-001: registrar e reler TAC ══
CREATE OR REPLACE FUNCTION public.qa_caso_tac_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_emp uuid; v_lido jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-TAC] Empresa com TAC', '11222333007606');

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar um TAC com órgão, número, vigência e condicionantes';
  r.esperado := 'Item gravado por inteiro em tac_detalhes';
  UPDATE public.empresa_cadastro
  SET tac_detalhes = jsonb_build_array(jsonb_build_object(
        'orgao', 'MPT',
        'numero', 'TAC-2026/001',
        'vigencia_inicio', '2026-01-01',
        'vigencia_fim', '2027-12-31',
        'condicionantes', 'Adequação ergonômica do setor de expedição',
        'arquivado', false))
  WHERE id = v_emp;

  r.passo_ordem := 2; r.passo_acao := 'Reler o cadastro';
  r.esperado := 'O TAC volta como foi gravado';
  SELECT tac_detalhes INTO v_lido FROM public.empresa_cadastro WHERE id = v_emp;
  IF jsonb_typeof(v_lido) = 'array'
     AND jsonb_array_length(v_lido) = 1
     AND v_lido->0->>'numero' = 'TAC-2026/001'
     AND v_lido->0->>'orgao' = 'MPT'
     AND v_lido->0->>'condicionantes' IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'TAC gravado e relido por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('tac_detalhes voltou: %s', left(v_lido::text, 120));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ TAC-003: vigência invertida ══
CREATE OR REPLACE FUNCTION public.qa_caso_tac_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_emp uuid; v_lido jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-TAC] Vigencia Invertida', '11222333007707');

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar TAC com vigência fim (2026-01-01) anterior ao início (2026-12-31)';
  r.esperado := 'Idealmente recusado — vigência incoerente não é TAC válido';
  BEGIN
    UPDATE public.empresa_cadastro
    SET tac_detalhes = jsonb_build_array(jsonb_build_object(
          'orgao', 'MPT',
          'numero', 'TAC-2026/999',
          'vigencia_inicio', '2026-12-31',
          'vigencia_fim', '2026-01-01',
          'arquivado', false))
    WHERE id = v_emp;

    SELECT tac_detalhes INTO v_lido FROM public.empresa_cadastro WHERE id = v_emp;
    IF v_lido->0->>'vigencia_fim' < v_lido->0->>'vigencia_inicio' THEN
      r.situacao := 'falhou';
      r.obtido := 'O BANCO ACEITOU TAC com fim de vigência anterior ao início. '
        'tac_detalhes é JSONB livre, sem validação em nenhuma camada — mesma '
        'incoerência que ENQ-013 aponta no mandato da CIPA. Dado com regra própria '
        'merece estrutura, não JSON livre.';
    ELSE
      r.situacao := 'passou';
      r.obtido := 'Vigência invertida não persistiu.';
    END IF;
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: vigência do TAC precisa ser coerente.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('EMP-070', 'qa_caso_emp_070', true),
  ('EMP-071', 'qa_caso_emp_071', true),
  ('FER-001', 'qa_caso_fer_001', true),
  ('FER-002', 'qa_caso_fer_002', true),
  ('FER-003', 'qa_caso_fer_003', true),
  ('FER-004', 'qa_caso_fer_004', true),
  ('FER-005', 'qa_caso_fer_005', true),
  ('TAC-001', 'qa_caso_tac_001', true),
  ('TAC-003', 'qa_caso_tac_003', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
