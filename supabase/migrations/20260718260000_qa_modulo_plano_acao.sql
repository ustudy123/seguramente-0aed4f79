-- =========================================================
-- QA — Módulo PLANO DE AÇÃO (tabelas: plano_acoes + plano_tarefas)
--
-- Quarto e ULTIMO item do bloco Planejamento & Gestão. Rico e bem defendido:
-- planos no formato 5W2H com priorizacao GUT.
--
-- Schema REAL (lido, ALTERs conferidos):
--   plano_acoes: codigo NOT NULL, titulo NOT NULL (5W2H: porque/onde/prazo/
--     como/custo), origem_modulo NOT NULL
--     GUT: gravidade/urgencia/tendencia CHECK BETWEEN 1 AND 5
--     pontuacao_gut GENERATED (g*u*t, calculada — nao aceita insert manual)
--     progresso CHECK BETWEEN 0 AND 100 (tem CHECK aqui, diferente de metas!)
--     tipo CHECK IN (corretiva|preventiva|melhoria)
--     status acao_status (pendente|em_andamento|concluida|cancelada)
--   plano_tarefas: acao_id ON DELETE CASCADE, titulo NOT NULL
--
-- Este modulo e MUITO defendido no banco. Espera-se que os casos "proibido"
-- sejam todos barrados corretamente (varios CHECKs). Bom contraste com Metas.
--
-- ACAO-030 confirma que pontuacao_gut e calculada: cria com g=5,u=4,t=3 e
-- verifica que a pontuacao vira 60 automaticamente.
-- =========================================================

-- Trava do cercado.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plano_acoes','plano_tarefas'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Plano de Acao.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='planejamento-gestao/plano-de-acao';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo plano-de-acao nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'ACAO-001','Criar plano de acao (5W2H)','feliz','alta','aprovado','api',
   'Cadastro de acao com codigo, titulo e campos 5W2H.','Acao criada.'),
  (v_mod,'ACAO-002','Adicionar tarefas ao plano','feliz','alta','aprovado','api',
   'Vincular tarefas (plano_tarefas) a uma acao.','Tarefas vinculadas.'),
  (v_mod,'ACAO-003','Priorizacao GUT calcula a pontuacao automaticamente','feliz','alta','aprovado','api',
   'gravidade x urgencia x tendencia gera pontuacao_gut (GENERATED).','Pontuacao = produto dos tres.'),
  -- ALT / EXCECAO
  (v_mod,'ACAO-010','Titulo vazio e recusado','excecao','media','aprovado','api',
   'titulo e NOT NULL.','Recusado sem titulo.'),
  (v_mod,'ACAO-011','GUT fora de 1-5 e recusado','excecao','alta','aprovado','api',
   'gravidade/urgencia/tendencia tem CHECK BETWEEN 1 AND 5.','Recusado com gravidade=9.'),
  (v_mod,'ACAO-012','Tipo invalido e recusado','excecao','media','aprovado','api',
   'tipo so aceita corretiva/preventiva/melhoria.','Recusado com tipo fora da lista.'),
  (v_mod,'ACAO-013','Progresso fora de 0-100 e recusado','excecao','media','aprovado','api',
   'progresso TEM CHECK aqui (diferente de metas).','Recusado com progresso=150.'),
  (v_mod,'ACAO-014','Apagar a acao apaga as tarefas (CASCADE)','alternativo','alta','aprovado','api',
   'acao_id ON DELETE CASCADE.','Tarefas apagadas junto.'),
  -- PROIBIDO
  (v_mod,'ACAO-022','Acao de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Acao do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_acao(p_titulo text, p_codigo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_cod text;
BEGIN
  v_cod := COALESCE(p_codigo, 'QA-' || substr(gen_random_uuid()::text, 1, 8));
  INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo)
  VALUES (public.qa_sandbox_tenant_id(), v_cod, p_titulo, 'manual') RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao 5W2H (o que, porque, onde, prazo, como)'; r.esperado:='Acao criada';
  INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, porque, onde, prazo, como, origem_modulo)
  VALUES (v_t, 'QA-001', '[QA] Instalar guarda-corpo', 'Risco de queda', 'Mezanino',
          CURRENT_DATE + 30, 'Contratar serralheria', 'manual') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Acao 5W2H criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_acao uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao e adicionar 3 tarefas'; r.esperado:='3 tarefas vinculadas';
  v_acao := public.qa_nova_acao('[QA] Acao Com Tarefas');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo) VALUES
    (v_t, v_acao, '[QA] Cotar fornecedor'),
    (v_t, v_acao, '[QA] Aprovar orcamento'),
    (v_t, v_acao, '[QA] Executar instalacao');
  SELECT count(*) INTO v_qtd FROM public.plano_tarefas WHERE acao_id=v_acao;
  IF v_qtd = 3 THEN r.situacao:='passou'; r.obtido:='3 tarefas vinculadas a acao.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 3 tarefas, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_gut int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao com gravidade=5, urgencia=4, tendencia=3'; r.esperado:='pontuacao_gut = 60 (5x4x3), calculada sozinha';
  INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo, gravidade, urgencia, tendencia)
  VALUES (v_t, 'QA-GUT', '[QA] Acao Priorizada', 'manual', 5, 4, 3) RETURNING id INTO v_id;
  SELECT pontuacao_gut INTO v_gut FROM public.plano_acoes WHERE id=v_id;
  IF v_gut = 60 THEN r.situacao:='passou'; r.obtido:='Pontuacao GUT calculada automaticamente: 5x4x3=60.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava GUT=60, obteve %s.', v_gut); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar acao sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo) VALUES (v_t, 'QA-X', NULL, 'manual');
    r.situacao:='falhou'; r.obtido:='ACEITOU acao sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar gravidade = 9 (fora de 1-5)'; r.esperado:='Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo, gravidade)
    VALUES (v_t, 'QA-G9', '[QA] Gravidade Alta Demais', 'manual', 9);
    r.situacao:='falhou'; r.obtido:='ACEITOU gravidade = 9.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: GUT so aceita 1 a 5.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar tipo = "urgente" (fora de corretiva/preventiva/melhoria)'; r.esperado:='Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo, tipo)
    VALUES (v_t, 'QA-TIPO', '[QA] Tipo Invalido', 'manual', 'urgente');
    r.situacao:='falhou'; r.obtido:='ACEITOU tipo fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: tipo so aceita corretiva/preventiva/melhoria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar progresso = 150 (fora de 0-100)'; r.esperado:='Recusado pelo CHECK (existe aqui, ao contrario de metas)';
  BEGIN
    INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo, progresso)
    VALUES (v_t, 'QA-P150', '[QA] Progresso Absurdo', 'manual', 150);
    r.situacao:='falhou'; r.obtido:='ACEITOU progresso = 150.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: progresso so aceita 0 a 100. (Plano de Acao tem o CHECK que Metas nao tem.)';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_acao uuid; v_tar uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao com 1 tarefa'; r.esperado:='Apagar a acao apaga a tarefa junto (CASCADE)';
  v_acao := public.qa_nova_acao('[QA] Acao Que Sera Apagada');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo) VALUES (v_t, v_acao, '[QA] Tarefa Some Junto') RETURNING id INTO v_tar;
  r.passo_ordem:=2; r.passo_acao:='Apagar a acao';
  DELETE FROM public.plano_acoes WHERE id=v_acao;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a tarefa foi apagada junto';
  SELECT count(*) INTO v_sobrou FROM public.plano_tarefas WHERE id=v_tar;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='Tarefa apagada junto com a acao (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Tarefa NAO foi apagada (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_acao_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar acao no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo) VALUES (v_t1, 'QA-SEC', '[QA] Acao Secreta T1', 'manual');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.plano_acoes WHERE tenant_id=v_t2 AND titulo='[QA] Acao Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Acao do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s acao(oes) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('ACAO-001','qa_caso_acao_001'),('ACAO-002','qa_caso_acao_002'),('ACAO-003','qa_caso_acao_003'),
  ('ACAO-010','qa_caso_acao_010'),('ACAO-011','qa_caso_acao_011'),('ACAO-012','qa_caso_acao_012'),
  ('ACAO-013','qa_caso_acao_013'),('ACAO-014','qa_caso_acao_014'),('ACAO-022','qa_caso_acao_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/plano-de-acao'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
