-- =========================================================
-- QA — Plano de Ação: revisão da família contra a auditoria (07/08)
--
-- ORIGEM: última parada da fila da auditoria de 18/07 (8 tabelas, 6 sem
-- teste). A família ACAO-001..022 cobriu a ação 5W2H, tarefas básicas,
-- GUT e isolamento. Ficaram sem caso: o MOTOR do módulo (o trigger que
-- deriva progresso e status da ação a partir das tarefas), a
-- dependência entre tarefas, e as quatro tabelas de apoio com regra
-- própria — participantes, evidências, apontamento de tempo e
-- templates.
--
-- O QUE A LEITURA DO SCHEMA MOSTROU: como no Hub, o banco aqui garante
-- bastante — GUT com CHECK 1-5, progresso 0-100, código automático e,
-- principalmente, atualizar_progresso_acao(): concluir tarefas
-- recalcula progresso, status (concluída/atrasada/pausada/em
-- andamento) e data de conclusão da ação, tudo por trigger. É o
-- coração do módulo e nenhum caso o protege contra regressão.
--
-- As lacunas são as de sempre nas bordas: dependência de tarefa sem
-- checagem de ciclo nem de ação, evidência que pode apontar tarefa de
-- outra ação, apontamento de tempo sem coerência início/fim, template
-- JSONB sem contrato.
--
-- FICAM DE FORA, com registro do porquê: plano_historico e
-- plano_comentarios (log/apoio, padrão já exercitado em dezenas de
-- casos — critério da auditoria, seção 4); o tipo texto-livre do
-- participante (mesmo padrão já documentado em OBRG-020, repetir não
-- soma).
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE. Onde o sistema diverge do caso,
-- a rotina falha de propósito e o achado vai para o relatório.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'planejamento-gestao/plano-de-acao';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo planejamento-gestao/plano-de-acao não encontrado.'; END IF;

  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ TAREFAS: O MOTOR DE PROGRESSO ══════════

  (v_mod, 'PLTF-001', 'Concluir tarefas atualiza a ação sozinho',
   'feliz', 'critica', 'aprovado', 'api',
   'O trigger atualizar_progresso_acao é o motor do módulo: a cada tarefa concluída, recalcula o progresso da ação (concluídas/total), deriva o status e carimba a data de conclusão quando fecha. É a garantia que falta em Metas (MCHK-002) e que aqui EXISTE — este caso a protege contra regressão.',
   'Ação com duas tarefas não iniciadas.',
   '[{"ordem":1,"acao":"Concluir a primeira tarefa","resultado_esperado":"Ação vai a 50% e status em_andamento, sem nenhum comando extra"},
     {"ordem":2,"acao":"Concluir a segunda","resultado_esperado":"Ação a 100%, status concluida, data_conclusao preenchida"}]'::jsonb,
   'A ação acompanha as tarefas por conta própria, em qualquer rota de entrada.',
   'Referência de boa prática para a correção sugerida em MCHK-002 (Metas).'),

  (v_mod, 'PLTF-010', 'Dependência circular entre tarefas é recusada',
   'negativo', 'alta', 'aprovado', 'api',
   'depende_de é FK para a própria tabela, sem checagem de ciclo. A depende de B e B depende de A trava as duas para sempre — nenhuma pode começar porque a outra não terminou. Qualquer tela de ordenação por dependência entra em loop.',
   'Ação com duas tarefas.',
   '[{"ordem":1,"acao":"Fazer a tarefa A depender da B","resultado_esperado":"Aceito — dependência simples é legítima"},
     {"ordem":2,"acao":"Fazer a B depender da A","resultado_esperado":"Recusado — fecharia o ciclo"}]'::jsonb,
   'Ciclo de dependência não entra.',
   'Provável ACHADO. Correção: trigger que percorre a cadeia de depende_de antes de gravar.'),

  (v_mod, 'PLTF-011', 'Tarefa não pode depender de tarefa de outra ação',
   'negativo', 'media', 'aprovado', 'api',
   'A FK de depende_de não exige a mesma acao_id. Uma tarefa presa a outra de ação diferente cria um acoplamento invisível: a ação A não anda porque algo na ação B não terminou, e nenhuma tela mostra o porquê.',
   'Duas ações, cada uma com uma tarefa.',
   '[{"ordem":1,"acao":"Fazer a tarefa da ação A depender da tarefa da ação B","resultado_esperado":"Recusado — dependência confinada à ação"}]'::jsonb,
   'Dependência não cruza ações.',
   'Mesma família de PDOC-010 (Hub). Correção: trigger conferindo a acao_id da dependência.'),

  -- ══════════ PARTICIPANTES ══════════

  (v_mod, 'PLPA-001', 'Adicionar participantes à ação, sem duplicata',
   'feliz', 'media', 'aprovado', 'api',
   'A ação compartilhada tem participantes com tipo de envolvimento (co-responsável, consulta, validação, apoio). O UNIQUE (acao_id, usuario_id) impede a mesma pessoa duas vezes — as duas coisas num caso só.',
   'Ação criada; usuário disponível para o vínculo.',
   '[{"ordem":1,"acao":"Adicionar um participante co-responsável","resultado_esperado":"Vínculo gravado com o tipo"},
     {"ordem":2,"acao":"Adicionar a mesma pessoa de novo","resultado_esperado":"Recusado pelo UNIQUE"}]'::jsonb,
   'Participante entra uma única vez, com o tipo registrado.',
   'O campo tipo é texto livre — mesmo padrão já documentado em OBRG-020; não gera caso próprio.'),

  -- ══════════ EVIDÊNCIAS ══════════

  (v_mod, 'PLEV-001', 'Anexar evidência à ação e à tarefa',
   'feliz', 'media', 'aprovado', 'api',
   'A evidência comprova a execução — pode pertencer só à ação ou descer ao detalhe da tarefa. Precisa gravar com título e reler vinculada ao lugar certo.',
   'Ação com uma tarefa.',
   '[{"ordem":1,"acao":"Anexar evidência à ação","resultado_esperado":"Gravada com titulo, sem tarefa"},
     {"ordem":2,"acao":"Anexar evidência à tarefa","resultado_esperado":"Gravada apontando ação e tarefa"}]'::jsonb,
   'Evidência gravada no nível certo, com título.',
   NULL),

  (v_mod, 'PLEV-010', 'Evidência com tarefa de outra ação é recusada',
   'negativo', 'media', 'aprovado', 'api',
   'acao_id e tarefa_id são FKs independentes: nada exige que a tarefa apontada pertença à ação apontada. Uma evidência da ação A "comprovando" tarefa da ação B contamina os dois relatórios.',
   'Duas ações, a segunda com uma tarefa.',
   '[{"ordem":1,"acao":"Gravar evidência com acao_id da A e tarefa_id da B","resultado_esperado":"Recusado — a tarefa precisa pertencer à ação"}]'::jsonb,
   'Evidência coerente entre ação e tarefa.',
   'Provável ACHADO. Correção: trigger conferindo plano_tarefas.acao_id = NEW.acao_id.'),

  -- ══════════ APONTAMENTO DE TEMPO ══════════

  (v_mod, 'PLTM-001', 'Apontar tempo trabalhado na tarefa',
   'feliz', 'baixa', 'aprovado', 'api',
   'O apontamento registra quem trabalhou, em quê, de quando a quando e a duração. Alimenta o tempo_gasto e qualquer análise de esforço do plano.',
   'Ação com tarefa; usuário disponível.',
   '[{"ordem":1,"acao":"Registrar apontamento com início, fim e duração","resultado_esperado":"Linha gravada com os três campos e a descrição"}]'::jsonb,
   'Apontamento gravado por inteiro.',
   NULL),

  (v_mod, 'PLTM-010', 'Apontamento com fim antes do início',
   'negativo', 'media', 'aprovado', 'api',
   'Nem inicio/fim nem duracao_minutos têm CHECK. Fim antes do início (ou duração negativa) cria tempo negativo que, somado, REDUZ o esforço total do plano.',
   'Ação criada; usuário disponível.',
   '[{"ordem":1,"acao":"Registrar apontamento com fim uma hora antes do início e duração -60","resultado_esperado":"Recusado — intervalo incoerente não é tempo trabalhado"}]'::jsonb,
   'Só entra intervalo coerente e duração positiva.',
   'Provável ACHADO — mesma família de ENQ-013, TAC-003, PROC-010 e CERT-010. Correção: CHECK (fim IS NULL OR fim >= inicio) e CHECK (duracao_minutos IS NULL OR duracao_minutos >= 0).'),

  -- ══════════ TEMPLATES ══════════

  (v_mod, 'PLTP-001', 'Criar template de ação reutilizável',
   'feliz', 'baixa', 'aprovado', 'api',
   'O template guarda em JSONB a estrutura de uma ação padrão (título, tarefas) para instanciar depois. Precisa gravar com nome e estrutura e reler íntegro.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar template com nome e estrutura de ação com duas tarefas","resultado_esperado":"Template gravado; a estrutura relida bate com a gravada"}]'::jsonb,
   'Template gravado e relido por inteiro.',
   NULL),

  (v_mod, 'PLTP-010', 'Template sem estrutura de ação não deveria entrar',
   'negativo', 'baixa', 'aprovado', 'api',
   'acao_template é JSONB NOT NULL, mas qualquer JSON serve — inclusive um escalar ou um objeto vazio. Template sem estrutura instanciável é um botão que não faz nada na tela de criar a partir de template.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar template com acao_template = {} (objeto vazio)","resultado_esperado":"Recusado — a estrutura precisa ter ao menos o título da ação"}]'::jsonb,
   'Só entra template com estrutura mínima.',
   'Provável ACHADO — mesma natureza de TAC-004 e MEVD-010: JSONB sem contrato. Correção: CHECK (acao_template ? ''titulo'') ou validação estruturada.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Revisão Plano de Ação 07/08: módulo tinha % casos, agora tem % (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS EXECUTÁVEIS
-- ─────────────────────────────────────────────────────────

-- Helper: um usuário real para FKs em auth.users (participantes, tempo).
-- O cercado roda no mesmo banco; qualquer usuário serve, os dados são
-- descartados com a bateria.
CREATE OR REPLACE FUNCTION public.qa_um_usuario()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM auth.users ORDER BY created_at LIMIT 1
$$;

-- ══ PLTF-001: motor de progresso ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltf_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao uuid; v_t1 uuid; v_t2 uuid; a record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_acao := public.qa_nova_acao('[QA-PLTF] Acao Motorizada');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Tarefa 1') RETURNING id INTO v_t1;
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Tarefa 2') RETURNING id INTO v_t2;

  r.passo_ordem := 1; r.passo_acao := 'Concluir a primeira tarefa';
  r.esperado := 'Ação a 50%, status em_andamento, sem comando extra';
  UPDATE public.plano_tarefas SET status = 'concluida' WHERE id = v_t1;
  SELECT progresso, status::text AS st INTO a FROM public.plano_acoes WHERE id = v_acao;
  IF a.progresso <> 50 OR a.st <> 'em_andamento' THEN
    r.situacao := 'falhou';
    r.obtido := format('REGRESSÃO NO MOTOR: após 1 de 2 tarefas, ação com progresso %s e status %s (esperado 50 / em_andamento).', a.progresso, a.st);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Concluir a segunda tarefa';
  r.esperado := 'Ação a 100%, concluida, com data de conclusão';
  UPDATE public.plano_tarefas SET status = 'concluida' WHERE id = v_t2;
  SELECT progresso, status::text AS st, data_conclusao INTO a FROM public.plano_acoes WHERE id = v_acao;
  IF a.progresso = 100 AND a.st = 'concluida' AND a.data_conclusao IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'O trigger derivou progresso, status e data de conclusão — a garantia que falta em Metas existe aqui.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Após concluir tudo: progresso %s, status %s, data_conclusao %s.', a.progresso, a.st, a.data_conclusao);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLTF-010: dependência circular ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltf_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao uuid; v_a uuid; v_b uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_acao := public.qa_nova_acao('[QA-PLTF] Acao Circular');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Tarefa A') RETURNING id INTO v_a;
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Tarefa B') RETURNING id INTO v_b;

  r.passo_ordem := 1; r.passo_acao := 'Fazer A depender de B';
  r.esperado := 'Aceito — dependência simples é legítima';
  UPDATE public.plano_tarefas SET depende_de = v_b WHERE id = v_a;

  r.passo_ordem := 2; r.passo_acao := 'Fazer B depender de A (fecharia o ciclo)';
  r.esperado := 'Recusado';
  BEGIN
    UPDATE public.plano_tarefas SET depende_de = v_a WHERE id = v_b;
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU o ciclo A<->B: as duas tarefas ficam travadas para sempre — nenhuma pode '
      'começar porque a outra não terminou. Correção: trigger percorrendo a cadeia de depende_de.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Ciclo recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLTF-011: dependência cruzando ações ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltf_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao_a uuid; v_acao_b uuid; v_ta uuid; v_tb uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_acao_a := public.qa_nova_acao('[QA-PLTF] Acao A');
  v_acao_b := public.qa_nova_acao('[QA-PLTF] Acao B');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao_a, '[QA] Tarefa da A') RETURNING id INTO v_ta;
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao_b, '[QA] Tarefa da B') RETURNING id INTO v_tb;

  r.passo_ordem := 1;
  r.passo_acao := 'Fazer a tarefa da ação A depender da tarefa da ação B';
  r.esperado := 'Recusado — dependência confinada à ação';
  BEGIN
    UPDATE public.plano_tarefas SET depende_de = v_tb WHERE id = v_ta;
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU dependência cruzando ações: a ação A não anda porque algo na ação B não '
      'terminou, e nenhuma tela mostra o porquê. Mesma família de PDOC-010. Correção: trigger '
      'conferindo a acao_id da dependência.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Dependência cruzando ações recusada: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLPA-001: participantes sem duplicata ══
CREATE OR REPLACE FUNCTION public.qa_caso_plpa_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao uuid; v_user uuid := public.qa_um_usuario();
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_user IS NULL THEN
    r.situacao := 'erro'; r.obtido := 'Nenhum usuário em auth.users para o vínculo.'; RETURN r;
  END IF;
  v_acao := public.qa_nova_acao('[QA-PLPA] Acao Compartilhada');

  r.passo_ordem := 1; r.passo_acao := 'Adicionar participante co-responsável';
  r.esperado := 'Vínculo gravado com o tipo';
  INSERT INTO public.plano_participantes (tenant_id, acao_id, usuario_id, usuario_nome, tipo)
  VALUES (v_t, v_acao, v_user, '[QA] Participante', 'co_responsavel');

  r.passo_ordem := 2; r.passo_acao := 'Adicionar a mesma pessoa de novo';
  r.esperado := 'Recusado pelo UNIQUE (acao_id, usuario_id)';
  BEGIN
    INSERT INTO public.plano_participantes (tenant_id, acao_id, usuario_id, usuario_nome, tipo)
    VALUES (v_t, v_acao, v_user, '[QA] Participante Clone', 'apoio');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU a mesma pessoa duas vezes na mesma ação.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Participante entra uma vez; duplicata barrada pelo UNIQUE.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLEV-001: evidência na ação e na tarefa ══
CREATE OR REPLACE FUNCTION public.qa_caso_plev_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao uuid; v_tarefa uuid; v_n_acao int; v_n_tarefa int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_acao := public.qa_nova_acao('[QA-PLEV] Acao Comprovada');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Tarefa Comprovada') RETURNING id INTO v_tarefa;

  r.passo_ordem := 1; r.passo_acao := 'Anexar evidência à ação e outra à tarefa';
  r.esperado := 'Cada uma gravada no nível certo';
  INSERT INTO public.plano_evidencias (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Foto do antes e depois');
  INSERT INTO public.plano_evidencias (tenant_id, acao_id, tarefa_id, titulo)
  VALUES (v_t, v_acao, v_tarefa, '[QA] Nota fiscal da instalacao');

  SELECT count(*) FILTER (WHERE tarefa_id IS NULL),
         count(*) FILTER (WHERE tarefa_id = v_tarefa)
  INTO v_n_acao, v_n_tarefa
  FROM public.plano_evidencias WHERE acao_id = v_acao;

  IF v_n_acao = 1 AND v_n_tarefa = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Uma evidência no nível da ação, uma no da tarefa.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('Evidências fora do nível: %s na ação, %s na tarefa.', v_n_acao, v_n_tarefa);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLEV-010: evidência com tarefa de outra ação ══
CREATE OR REPLACE FUNCTION public.qa_caso_plev_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao_a uuid; v_acao_b uuid; v_tarefa_b uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_acao_a := public.qa_nova_acao('[QA-PLEV] Acao A');
  v_acao_b := public.qa_nova_acao('[QA-PLEV] Acao B');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao_b, '[QA] Tarefa da B') RETURNING id INTO v_tarefa_b;

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar evidência com acao_id da A e tarefa_id da B';
  r.esperado := 'Recusado — a tarefa precisa pertencer à ação';
  BEGIN
    INSERT INTO public.plano_evidencias (tenant_id, acao_id, tarefa_id, titulo)
    VALUES (v_t, v_acao_a, v_tarefa_b, '[QA] Comprovante perdido');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU evidência da ação A apontando tarefa da ação B — os relatórios das duas '
      'ações ficam contaminados. Correção: trigger conferindo plano_tarefas.acao_id = NEW.acao_id.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Evidência incoerente recusada: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLTM-001: apontar tempo ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltm_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao uuid; v_tarefa uuid; v_user uuid := public.qa_um_usuario(); tt record;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_user IS NULL THEN
    r.situacao := 'erro'; r.obtido := 'Nenhum usuário em auth.users para o vínculo.'; RETURN r;
  END IF;
  v_acao := public.qa_nova_acao('[QA-PLTM] Acao Cronometrada');
  INSERT INTO public.plano_tarefas (tenant_id, acao_id, titulo)
  VALUES (v_t, v_acao, '[QA] Tarefa Cronometrada') RETURNING id INTO v_tarefa;

  r.passo_ordem := 1; r.passo_acao := 'Registrar apontamento com início, fim e duração';
  r.esperado := 'Linha gravada com os três campos e a descrição';
  INSERT INTO public.plano_tempo
    (tenant_id, acao_id, tarefa_id, usuario_id, usuario_nome, inicio, fim, duracao_minutos, descricao)
  VALUES (v_t, v_acao, v_tarefa, v_user, '[QA] Executor',
          now() - interval '90 minutes', now() - interval '30 minutes', 60,
          'Instalacao do equipamento');

  SELECT * INTO tt FROM public.plano_tempo WHERE tarefa_id = v_tarefa;
  IF tt.fim > tt.inicio AND tt.duracao_minutos = 60 AND tt.descricao IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'Apontamento gravado por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'Apontamento gravado incompleto.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLTM-010: fim antes do início ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltm_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_acao uuid; v_user uuid := public.qa_um_usuario();
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_user IS NULL THEN
    r.situacao := 'erro'; r.obtido := 'Nenhum usuário em auth.users para o vínculo.'; RETURN r;
  END IF;
  v_acao := public.qa_nova_acao('[QA-PLTM] Tempo Negativo');

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar apontamento com fim uma hora antes do início e duração -60';
  r.esperado := 'Recusado — intervalo incoerente não é tempo trabalhado';
  BEGIN
    INSERT INTO public.plano_tempo
      (tenant_id, acao_id, usuario_id, usuario_nome, inicio, fim, duracao_minutos)
    VALUES (v_t, v_acao, v_user, '[QA] Viajante do Tempo',
            now(), now() - interval '60 minutes', -60);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU apontamento com fim antes do início e duração -60: tempo negativo que, '
      'somado, REDUZ o esforço total do plano. Mesma família de ENQ-013/TAC-003/PROC-010/CERT-010. '
      'Correção: CHECK (fim >= inicio) e CHECK (duracao_minutos >= 0).';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Intervalo incoerente recusado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLTP-001: template reutilizável ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltp_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_id uuid; v_lido jsonb;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Criar template com estrutura de ação e duas tarefas';
  r.esperado := 'Template gravado; a estrutura relida bate com a gravada';
  INSERT INTO public.plano_templates (tenant_id, nome, acao_template)
  VALUES (v_t, '[QA] Template Inspecao NR-12',
          jsonb_build_object(
            'titulo', 'Inspecao de seguranca em maquinas',
            'tipo', 'preventiva',
            'tarefas', jsonb_build_array(
              jsonb_build_object('titulo', 'Checklist NR-12'),
              jsonb_build_object('titulo', 'Emitir relatorio'))))
  RETURNING id INTO v_id;

  SELECT acao_template INTO v_lido FROM public.plano_templates WHERE id = v_id;
  IF v_lido->>'titulo' = 'Inspecao de seguranca em maquinas'
     AND jsonb_array_length(v_lido->'tarefas') = 2 THEN
    r.situacao := 'passou'; r.obtido := 'Template gravado e relido por inteiro, com as duas tarefas.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('Estrutura relida: %s', left(v_lido::text, 120));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PLTP-010: template vazio ══
CREATE OR REPLACE FUNCTION public.qa_caso_pltp_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Criar template com acao_template = {} (objeto vazio)';
  r.esperado := 'Recusado — a estrutura precisa ter ao menos o título da ação';
  BEGIN
    INSERT INTO public.plano_templates (tenant_id, nome, acao_template)
    VALUES (public.qa_sandbox_tenant_id(), '[QA] Template de Nada', '{}'::jsonb);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU template sem estrutura nenhuma — o botão de criar a partir dele não tem o '
      'que instanciar. Mesma natureza de TAC-004 e MEVD-010: JSONB sem contrato. '
      'Correção: CHECK exigindo ao menos a chave titulo.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Template vazio recusado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PLTF-001', 'qa_caso_pltf_001', true),
  ('PLTF-010', 'qa_caso_pltf_010', true),
  ('PLTF-011', 'qa_caso_pltf_011', true),
  ('PLPA-001', 'qa_caso_plpa_001', true),
  ('PLEV-001', 'qa_caso_plev_001', true),
  ('PLEV-010', 'qa_caso_plev_010', true),
  ('PLTM-001', 'qa_caso_pltm_001', true),
  ('PLTM-010', 'qa_caso_pltm_010', true),
  ('PLTP-001', 'qa_caso_pltp_001', true),
  ('PLTP-010', 'qa_caso_pltp_010', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/plano-de-acao');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
