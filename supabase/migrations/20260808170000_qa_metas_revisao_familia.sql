-- =========================================================
-- QA — Metas: revisão da família contra a auditoria de cobertura (07/08)
--
-- ORIGEM: a auditoria de 18/07 apontou o módulo Metas como o de maior
-- lacuna (12 tabelas na família, 2 testadas). As famílias META, MCFG e
-- MIND cobriram a meta em si, a configuração e o catálogo de
-- indicadores. Ficaram sem NENHUM caso as quatro tabelas que carregam a
-- operação do dia a dia:
--
--   metas_workflow_log   -> trilha de aprovação (rascunho → ativa → ...)
--   metas_checkins       -> histórico de progresso e a atualização da meta
--   metas_participantes  -> metas compartilhadas, papel e peso
--   metas_evidencias     -> comprovação do atingimento
--
-- O PADRÃO ESTRUTURAL, visto na leitura de useMetasModule.ts: o banco
-- garante pouco (enums, FKs com CASCADE, UNIQUE de participante) e TODA
-- a mecânica vive no front — a transição de workflow grava o log num
-- insert sem checagem de erro, o check-in deriva status e valor da meta
-- em dois comandos separados, o peso do participante não tem faixa.
-- Dado que entre por API ou SQL direto não passa por nada disso. As
-- rotinas abaixo testam o comportamento CORRETO; onde o sistema hoje
-- diverge, a rotina FALHA de propósito e o achado vai para o relatório.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE NESTA MIGRATION.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'planejamento-gestao/metas';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo planejamento-gestao/metas não encontrado.'; END IF;

  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ WORKFLOW DE APROVAÇÃO ══════════

  (v_mod, 'MWKF-001', 'Transição de workflow registra a trilha completa',
   'feliz', 'alta', 'aprovado', 'api',
   'Cada mudança de workflow_status (rascunho → em_aprovacao → ativa...) deve deixar uma linha em metas_workflow_log com status anterior, status novo, ação e autor. É a trilha que responde quem aprovou a meta e quando — sem ela, aprovação é só um campo que alguém trocou.',
   'Meta em rascunho no cercado.',
   '[{"ordem":1,"acao":"Mudar a meta de rascunho para em_aprovacao registrando o log","resultado_esperado":"workflow_status atualizado e linha no log com anterior=rascunho, novo=em_aprovacao"},
     {"ordem":2,"acao":"Mudar de em_aprovacao para ativa com justificativa","resultado_esperado":"Segunda linha no log, com a justificativa gravada"}]'::jsonb,
   'A trilha reconta a história completa da meta, transição por transição.',
   NULL),

  (v_mod, 'MWKF-010', 'Status de workflow fora da lista fechada é recusado',
   'negativo', 'media', 'aprovado', 'api',
   'workflow_status é enum (rascunho, em_aprovacao, ativa, em_revisao, suspensa, encerrada, cancelada). Valor inventado não pode entrar — é a única proteção de máquina de estados que o banco tem hoje.',
   'Meta no cercado.',
   '[{"ordem":1,"acao":"Gravar workflow_status = aprovadissima","resultado_esperado":"Recusado pelo enum"}]'::jsonb,
   'Valor fora do enum não entra.',
   NULL),

  (v_mod, 'MWKF-011', 'Mudança de workflow por fora da tela não deixa trilha',
   'negativo', 'critica', 'aprovado', 'api',
   'O registro em metas_workflow_log é feito pelo FRONT, num insert separado e sem checagem de erro. Um update direto em workflow_status (API, integração, SQL) muda o estado da meta sem deixar rastro nenhum — a meta aparece ativa sem nenhuma aprovação registrada. Auditoria que depende da boa vontade do cliente HTTP não é auditoria.',
   'Meta em rascunho no cercado.',
   '[{"ordem":1,"acao":"Atualizar workflow_status direto para ativa, sem passar pela tela","resultado_esperado":"Idealmente o banco registra a transição sozinho (trigger), mantendo a trilha íntegra"}]'::jsonb,
   'Toda transição deixa linha no log, independentemente da rota de entrada.',
   'Provável ACHADO: hoje o update passa e o log fica vazio. Correção sugerida: trigger AFTER UPDATE OF workflow_status em metas gravando o log — o front pode continuar gravando a justificativa, mas a existência da linha deixa de ser opcional.'),

  (v_mod, 'MWKF-012', 'Apagar a meta leva a trilha de workflow junto',
   'excecao', 'media', 'aprovado', 'api',
   'A FK de metas_workflow_log é ON DELETE CASCADE: excluir a meta apaga a trilha de aprovação. O caso confirma que o cascade funciona e não deixa log órfão — e registra a consequência: excluir meta é também destruir o histórico de quem a aprovou.',
   'Meta com pelo menos duas transições registradas.',
   '[{"ordem":1,"acao":"Excluir a meta","resultado_esperado":"Meta e trilha somem juntas, sem linha órfã"}]'::jsonb,
   'Cascade limpo, sem órfãos.',
   'Se um dia a trilha precisar sobreviver à meta (exigência comum de auditoria), o caminho é soft-delete da meta ou log desacoplado — fica anotado para o desenvolvimento avaliar.'),

  -- ══════════ CHECK-INS DE PROGRESSO ══════════

  (v_mod, 'MCHK-001', 'Check-in grava o antes e o depois do progresso',
   'feliz', 'alta', 'aprovado', 'api',
   'O check-in é o coração do acompanhamento: registra valor_anterior/valor_novo e progresso_anterior/progresso_novo, com observação e bloqueios. É o que permite reconstruir a evolução da meta no tempo.',
   'Meta com valor_atual e progresso conhecidos.',
   '[{"ordem":1,"acao":"Registrar check-in com novo valor e novo progresso","resultado_esperado":"Linha em metas_checkins com o par anterior/novo dos dois campos"},
     {"ordem":2,"acao":"Reler o histórico da meta","resultado_esperado":"O check-in aparece com observação e autor"}]'::jsonb,
   'O histórico preserva o antes e o depois de cada atualização.',
   NULL),

  (v_mod, 'MCHK-002', 'Check-in atualiza a meta e deriva o status do progresso',
   'alternativo', 'critica', 'aprovado', 'api',
   'Na tela, o check-in também atualiza a meta: valor_atual, progresso e o status derivado (100 = concluída, >0 = em andamento, 0 = não iniciada). Essa derivação vive em DOIS comandos separados do front — check-in por API atualiza o histórico mas deixa a meta para trás, e a lista mostra progresso velho com check-in novo.',
   'Meta em andamento com progresso 40.',
   '[{"ordem":1,"acao":"Registrar check-in com progresso_novo = 100 por fora da tela","resultado_esperado":"Idealmente a meta acompanha: progresso 100, status concluída"},
     {"ordem":2,"acao":"Conferir a meta","resultado_esperado":"Meta e último check-in contam a mesma história"}]'::jsonb,
   'Meta e histórico nunca divergem, seja qual for a rota de entrada.',
   'Provável ACHADO: hoje a meta fica intacta e o check-in órfão de efeito. Correção sugerida: trigger em metas_checkins aplicando valor/progresso/status na meta — a mesma regra que o front já executa, só que garantida.'),

  (v_mod, 'MCHK-010', 'Progresso do check-in fora de 0-100',
   'negativo', 'media', 'aprovado', 'api',
   'progresso_novo é INTEGER sem CHECK — espelho exato do que META-012 encontrou na própria meta. Um check-in de 250% ou -30% entra e contamina o histórico e qualquer média.',
   'Meta no cercado.',
   '[{"ordem":1,"acao":"Registrar check-in com progresso_novo = 250","resultado_esperado":"Recusado — progresso é percentual de 0 a 100"},
     {"ordem":2,"acao":"Registrar check-in com progresso_novo = -30","resultado_esperado":"Recusado"}]'::jsonb,
   'Só entra progresso entre 0 e 100.',
   'Mesma correção sugerida em META-012: CHECK BETWEEN 0 AND 100, aqui e na meta.'),

  (v_mod, 'MCHK-011', 'Check-in não pode cruzar clientes',
   'negativo', 'alta', 'aprovado', 'api',
   'A FK de meta_id não olha tenant: uma linha de check-in com tenant_id do cliente B apontando meta do cliente A é estruturalmente possível. A RLS esconde a linha de quem não deve ver, mas o histórico da meta fica com um registro fantasma de outro cliente.',
   'Cercados 1 e 2 disponíveis; meta no cercado 1.',
   '[{"ordem":1,"acao":"Inserir check-in com tenant do cercado 2 apontando a meta do cercado 1","resultado_esperado":"Recusado — check-in e meta precisam ser do mesmo tenant"}]'::jsonb,
   'Check-in cruzando tenants não entra.',
   'Mesma família de FER-004 (feriados) e dos casos de coerência de tenant de outros módulos; mesmo remédio — trigger de coerência.'),

  -- ══════════ PARTICIPANTES (METAS COMPARTILHADAS) ══════════

  (v_mod, 'MPAR-001', 'Compartilhar meta com participantes, papel e peso',
   'feliz', 'media', 'aprovado', 'api',
   'Meta compartilhada tem participantes com papel (co_responsavel, contribuidor...) e peso — que depois entra na avaliação de desempenho. O vínculo precisa gravar e reler por inteiro.',
   'Meta no cercado.',
   '[{"ordem":1,"acao":"Adicionar dois participantes com papéis e pesos distintos","resultado_esperado":"Duas linhas em metas_participantes, com papel e peso de cada um"}]'::jsonb,
   'Participantes gravados e relidos com papel e peso.',
   NULL),

  (v_mod, 'MPAR-010', 'Mesmo participante duas vezes na mesma meta é proibido',
   'negativo', 'media', 'aprovado', 'api',
   'UNIQUE (meta_id, participante_id) — a única proteção de negócio que a tabela tem. Duplicar participante duplicaria o peso dele na consolidação.',
   'Meta com um participante.',
   '[{"ordem":1,"acao":"Inserir o mesmo participante de novo na mesma meta","resultado_esperado":"Recusado pelo UNIQUE"}]'::jsonb,
   'A duplicata não entra.',
   NULL),

  (v_mod, 'MPAR-011', 'Peso de participante precisa ser positivo',
   'negativo', 'media', 'aprovado', 'api',
   'peso é NUMERIC sem CHECK. Peso zero anula a participação sem removê-la; peso negativo inverte o sentido da contribuição em qualquer média ponderada. Nenhum dos dois é um estado válido.',
   'Meta no cercado.',
   '[{"ordem":1,"acao":"Inserir participante com peso = -1","resultado_esperado":"Recusado — peso é fator positivo"},
     {"ordem":2,"acao":"Inserir participante com peso = 0","resultado_esperado":"Recusado"}]'::jsonb,
   'Só entra peso maior que zero.',
   'Provável ACHADO: hoje os dois entram. Correção: CHECK (peso > 0).'),

  (v_mod, 'MPAR-012', 'Apagar a meta remove os participantes',
   'excecao', 'baixa', 'aprovado', 'api',
   'FK ON DELETE CASCADE: excluir a meta não pode deixar vínculo de participante órfão apontando para meta que não existe.',
   'Meta compartilhada com participantes.',
   '[{"ordem":1,"acao":"Excluir a meta","resultado_esperado":"Meta e participantes somem juntos"}]'::jsonb,
   'Cascade limpo, sem órfãos.',
   NULL),

  -- ══════════ EVIDÊNCIAS ══════════

  (v_mod, 'MEVD-001', 'Anexar evidência de atingimento à meta',
   'feliz', 'media', 'aprovado', 'api',
   'A evidência (arquivo ou link, com título e período de referência) é o que sustenta o número reportado no check-in. Precisa gravar vinculada à meta e reler por inteiro.',
   'Meta no cercado.',
   '[{"ordem":1,"acao":"Anexar evidência tipo link com título e período de referência","resultado_esperado":"Linha em metas_evidencias vinculada à meta, com autor"}]'::jsonb,
   'Evidência gravada e relida por inteiro.',
   NULL),

  (v_mod, 'MEVD-010', 'Evidência completamente vazia não deveria entrar',
   'negativo', 'baixa', 'aprovado', 'api',
   'Todos os campos de conteúdo (arquivo_url, link_externo, titulo, descricao) são anuláveis. Uma linha sem NENHUM deles é uma evidência que não evidencia nada — só infla a contagem de comprovação da meta.',
   'Meta no cercado.',
   '[{"ordem":1,"acao":"Inserir evidência sem arquivo, sem link, sem título e sem descrição","resultado_esperado":"Recusado — evidência precisa ter ao menos um conteúdo"}]'::jsonb,
   'Evidência vazia não entra.',
   'Provável ACHADO: hoje entra. Correção: CHECK exigindo ao menos um campo de conteúdo preenchido.'),

  (v_mod, 'MEVD-011', 'Apagar a meta leva as evidências junto',
   'excecao', 'baixa', 'aprovado', 'api',
   'FK ON DELETE CASCADE: excluir a meta remove as evidências, sem órfãos. Vale o mesmo lembrete de MWKF-012 — o material de comprovação some com a meta.',
   'Meta com evidência anexada.',
   '[{"ordem":1,"acao":"Excluir a meta","resultado_esperado":"Meta e evidências somem juntas"}]'::jsonb,
   'Cascade limpo, sem órfãos.',
   NULL)

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Revisão Metas 07/08: módulo tinha % casos, agora tem % (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS EXECUTÁVEIS
-- ─────────────────────────────────────────────────────────

-- ══ MWKF-001: transição registra a trilha ══
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_n int; v_just text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Meta em Aprovacao');

  r.passo_ordem := 1;
  r.passo_acao := 'Transicionar rascunho -> em_aprovacao registrando o log';
  r.esperado := 'workflow_status atualizado e linha no log';
  UPDATE public.metas SET workflow_status = 'em_aprovacao' WHERE id = v_meta;
  INSERT INTO public.metas_workflow_log
    (tenant_id, meta_id, status_anterior, status_novo, acao, usuario_nome)
  VALUES (v_t, v_meta, 'rascunho', 'em_aprovacao', 'transicao', '[QA] Agente');

  r.passo_ordem := 2;
  r.passo_acao := 'Transicionar em_aprovacao -> ativa com justificativa';
  r.esperado := 'Segunda linha no log com a justificativa';
  UPDATE public.metas SET workflow_status = 'ativa' WHERE id = v_meta;
  INSERT INTO public.metas_workflow_log
    (tenant_id, meta_id, status_anterior, status_novo, acao, justificativa, usuario_nome)
  VALUES (v_t, v_meta, 'em_aprovacao', 'ativa', 'aprovacao', 'Meta alinhada ao ciclo 2026', '[QA] Aprovador');

  SELECT count(*) INTO v_n FROM public.metas_workflow_log WHERE meta_id = v_meta;
  SELECT justificativa INTO v_just FROM public.metas_workflow_log
  WHERE meta_id = v_meta AND status_novo = 'ativa';

  IF v_n = 2 AND v_just = 'Meta alinhada ao ciclo 2026' THEN
    r.situacao := 'passou'; r.obtido := 'Trilha completa: duas transições, justificativa preservada.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s linha(s) no log; justificativa = %s.', v_n, coalesce(v_just, 'nula'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MWKF-010: status fora do enum ══
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Status Inventado');
  r.passo_ordem := 1; r.passo_acao := 'Gravar workflow_status = aprovadissima';
  r.esperado := 'Recusado pelo enum meta_workflow_status';
  BEGIN
    EXECUTE format(
      'UPDATE public.metas SET workflow_status = %L::public.meta_workflow_status WHERE id = %L',
      'aprovadissima', v_meta);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU status fora da lista fechada.';
  EXCEPTION WHEN invalid_text_representation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: o enum é a proteção da máquina de estados.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MWKF-011: mudança por fora da tela não deixa trilha ══
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_meta uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Ativada Sem Rastro');

  r.passo_ordem := 1;
  r.passo_acao := 'Atualizar workflow_status direto para ativa, sem passar pela tela';
  r.esperado := 'O banco registra a transição sozinho, mantendo a trilha íntegra';
  UPDATE public.metas SET workflow_status = 'ativa' WHERE id = v_meta;

  SELECT count(*) INTO v_n FROM public.metas_workflow_log WHERE meta_id = v_meta;
  IF v_n >= 1 THEN
    r.situacao := 'passou';
    r.obtido := 'O banco registrou a transição por conta própria — trilha íntegra em qualquer rota.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'A META FICOU ATIVA SEM NENHUMA LINHA DE TRILHA. O registro em '
      'metas_workflow_log é feito pelo front, num insert separado e sem checagem de erro — '
      'update por API, integração ou SQL muda o estado sem deixar rastro de quem aprovou. '
      'Correção sugerida: trigger AFTER UPDATE OF workflow_status gravando o log.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MWKF-012: cascade da trilha ══
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Meta Descartavel');
  INSERT INTO public.metas_workflow_log (tenant_id, meta_id, status_anterior, status_novo, acao)
  VALUES (v_t, v_meta, 'rascunho', 'em_aprovacao', 'transicao'),
         (v_t, v_meta, 'em_aprovacao', 'ativa', 'aprovacao');

  r.passo_ordem := 1; r.passo_acao := 'Excluir a meta com duas transições na trilha';
  r.esperado := 'Meta e trilha somem juntas, sem linha órfã';
  DELETE FROM public.metas WHERE id = v_meta;
  SELECT count(*) INTO v_orfas FROM public.metas_workflow_log WHERE meta_id = v_meta;
  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou a trilha junto com a meta.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s linha(s) de trilha órfã(s) após excluir a meta.', v_orfas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MCHK-001: check-in grava antes e depois ══
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; c record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MCHK] Meta Acompanhada');
  UPDATE public.metas SET valor_atual = 40, progresso = 40 WHERE id = v_meta;

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar check-in de 40 para 60, com observação e bloqueio';
  r.esperado := 'Linha com o par anterior/novo de valor e progresso';
  INSERT INTO public.metas_checkins
    (tenant_id, meta_id, valor_anterior, valor_novo, progresso_anterior, progresso_novo,
     observacao, bloqueios, realizado_por_nome)
  VALUES (v_t, v_meta, 40, 60, 40, 60,
          'Avanço no trimestre', 'Dependência do fornecedor', '[QA] Agente');

  SELECT * INTO c FROM public.metas_checkins WHERE meta_id = v_meta;
  IF c.valor_anterior = 40 AND c.valor_novo = 60
     AND c.progresso_anterior = 40 AND c.progresso_novo = 60
     AND c.observacao IS NOT NULL AND c.bloqueios IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'Check-in preserva o antes e o depois, com observação e bloqueio.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Check-in gravado incompleto: valor %s->%s, progresso %s->%s.',
      c.valor_anterior, c.valor_novo, c.progresso_anterior, c.progresso_novo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MCHK-002: check-in deriva o estado da meta ══
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_prog int; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MCHK] Meta Que Conclui');
  UPDATE public.metas SET valor_atual = 40, progresso = 40, status = 'em_andamento' WHERE id = v_meta;

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar check-in com progresso_novo = 100 por fora da tela';
  r.esperado := 'A meta acompanha: progresso 100, status concluída';
  INSERT INTO public.metas_checkins
    (tenant_id, meta_id, valor_anterior, valor_novo, progresso_anterior, progresso_novo)
  VALUES (v_t, v_meta, 40, 100, 40, 100);

  SELECT progresso, status::text INTO v_prog, v_status FROM public.metas WHERE id = v_meta;
  IF v_prog = 100 AND v_status = 'concluida' THEN
    r.situacao := 'passou'; r.obtido := 'Meta e histórico contam a mesma história em qualquer rota.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('CHECK-IN SEM EFEITO NA META: histórico marca 100%%, a meta segue com progresso %s e status %s. '
      'A derivação (100 = concluída) vive em dois comandos separados do front — por API o histórico anda e a meta fica. '
      'Correção sugerida: trigger em metas_checkins aplicando valor, progresso e status na meta.',
      v_prog, v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MCHK-010: progresso fora de 0-100 ══
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MCHK] Progresso Absurdo');

  r.passo_ordem := 1; r.passo_acao := 'Registrar check-in com progresso_novo = 250';
  r.esperado := 'Recusado — progresso é percentual de 0 a 100';
  BEGIN
    INSERT INTO public.metas_checkins (tenant_id, meta_id, progresso_anterior, progresso_novo)
    VALUES (v_t, v_meta, 0, 250);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU check-in de 250%. progresso_novo é INTEGER sem CHECK — espelho exato '
      'do que META-012 encontrou na própria meta. Correção: CHECK BETWEEN 0 AND 100 nas duas tabelas.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusado 250.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Registrar check-in com progresso_novo = -30';
  r.esperado := 'Recusado';
  BEGIN
    INSERT INTO public.metas_checkins (tenant_id, meta_id, progresso_anterior, progresso_novo)
    VALUES (v_t, v_meta, 0, -30);
    r.situacao := 'falhou'; r.obtido := 'Recusou 250 mas ACEITOU -30.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Progresso restrito a 0-100 nos dois extremos.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MCHK-011: check-in cruzando tenants ══
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t2 uuid := public.qa_sandbox2_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;
  v_meta := public.qa_nova_meta('[QA-MCHK] Meta do Tenant 1');

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir check-in com tenant do cercado 2 apontando meta do cercado 1';
  r.esperado := 'Recusado — check-in e meta precisam ser do mesmo tenant';
  BEGIN
    INSERT INTO public.metas_checkins (tenant_id, meta_id, progresso_anterior, progresso_novo)
    VALUES (v_t2, v_meta, 0, 10);
    r.situacao := 'falhou';
    r.obtido := 'CHECK-IN CRUZANDO TENANTS ACEITO: o histórico da meta do cliente 1 ganhou '
      'um registro fantasma do cliente 2. A FK de meta_id não olha tenant — falta o gatilho '
      'de coerência, mesmo remédio de FER-004.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou';
    r.obtido := 'Check-in cruzando tenants recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MPAR-001: participantes com papel e peso ══
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_n int; v_pesos numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Meta Compartilhada');

  r.passo_ordem := 1;
  r.passo_acao := 'Adicionar dois participantes com papéis e pesos distintos';
  r.esperado := 'Duas linhas com papel e peso de cada um';
  INSERT INTO public.metas_participantes
    (tenant_id, meta_id, participante_id, participante_nome, papel, peso)
  VALUES (v_t, v_meta, 'qa-part-1', '[QA] Ana', 'co_responsavel', 2),
         (v_t, v_meta, 'qa-part-2', '[QA] Bruno', 'contribuidor', 1);

  SELECT count(*), sum(peso) INTO v_n, v_pesos
  FROM public.metas_participantes WHERE meta_id = v_meta;
  IF v_n = 2 AND v_pesos = 3 THEN
    r.situacao := 'passou'; r.obtido := 'Dois participantes gravados com papel e peso.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s participante(s), soma de pesos %s.', v_n, v_pesos);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MPAR-010: participante duplicado ══
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Sem Duplicata');
  INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome)
  VALUES (v_t, v_meta, 'qa-part-dup', '[QA] Carla');

  r.passo_ordem := 1; r.passo_acao := 'Inserir o mesmo participante de novo na mesma meta';
  r.esperado := 'Recusado pelo UNIQUE (meta_id, participante_id)';
  BEGIN
    INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome)
    VALUES (v_t, v_meta, 'qa-part-dup', '[QA] Carla');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU o participante duplicado — o peso dele contaria dobrado.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Duplicata recusada pelo UNIQUE.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MPAR-011: peso não positivo ══
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Peso Estranho');

  r.passo_ordem := 1; r.passo_acao := 'Inserir participante com peso = -1';
  r.esperado := 'Recusado — peso é fator positivo';
  BEGIN
    INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome, peso)
    VALUES (v_t, v_meta, 'qa-part-neg', '[QA] Peso Negativo', -1);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU peso -1. peso é NUMERIC sem CHECK — negativo inverte a contribuição '
      'em qualquer média ponderada; zero anula sem remover. Correção: CHECK (peso > 0).';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusado -1.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Inserir participante com peso = 0';
  r.esperado := 'Recusado';
  BEGIN
    INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome, peso)
    VALUES (v_t, v_meta, 'qa-part-zero', '[QA] Peso Zero', 0);
    r.situacao := 'falhou'; r.obtido := 'Recusou -1 mas ACEITOU peso 0.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Só entra peso maior que zero.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MPAR-012: cascade dos participantes ══
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Meta Descartavel');
  INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome)
  VALUES (v_t, v_meta, 'qa-part-casc', '[QA] Temporario');

  r.passo_ordem := 1; r.passo_acao := 'Excluir a meta compartilhada';
  r.esperado := 'Meta e participantes somem juntos';
  DELETE FROM public.metas WHERE id = v_meta;
  SELECT count(*) INTO v_orfas FROM public.metas_participantes WHERE meta_id = v_meta;
  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou os participantes junto com a meta.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s participante(s) órfão(s).', v_orfas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MEVD-001: anexar evidência ══
CREATE OR REPLACE FUNCTION public.qa_caso_mevd_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; e record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MEVD] Meta Comprovada');

  r.passo_ordem := 1;
  r.passo_acao := 'Anexar evidência tipo link com título e período de referência';
  r.esperado := 'Evidência vinculada à meta, com autor';
  INSERT INTO public.metas_evidencias
    (tenant_id, meta_id, tipo, titulo, link_externo, periodo_referencia, criado_por_nome)
  VALUES (v_t, v_meta, 'link', '[QA] Relatório do trimestre',
          'https://exemplo.interno/relatorio-q1', '2026-Q1', '[QA] Agente');

  SELECT * INTO e FROM public.metas_evidencias WHERE meta_id = v_meta;
  IF e.titulo IS NOT NULL AND e.link_externo IS NOT NULL AND e.periodo_referencia = '2026-Q1' THEN
    r.situacao := 'passou'; r.obtido := 'Evidência gravada e relida por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'Evidência gravada incompleta.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MEVD-010: evidência vazia ══
CREATE OR REPLACE FUNCTION public.qa_caso_mevd_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MEVD] Evidencia de Nada');

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir evidência sem arquivo, sem link, sem título e sem descrição';
  r.esperado := 'Recusado — evidência precisa ter ao menos um conteúdo';
  BEGIN
    INSERT INTO public.metas_evidencias (tenant_id, meta_id) VALUES (v_t, v_meta);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU evidência sem nenhum conteúdo — não evidencia nada e infla a contagem '
      'de comprovação da meta. Correção: CHECK exigindo arquivo_url, link_externo, titulo ou '
      'descricao preenchido.';
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Evidência vazia recusada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ MEVD-011: cascade das evidências ══
CREATE OR REPLACE FUNCTION public.qa_caso_mevd_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MEVD] Meta Descartavel');
  INSERT INTO public.metas_evidencias (tenant_id, meta_id, tipo, titulo)
  VALUES (v_t, v_meta, 'arquivo', '[QA] Evidencia temporaria');

  r.passo_ordem := 1; r.passo_acao := 'Excluir a meta com evidência anexada';
  r.esperado := 'Meta e evidências somem juntas';
  DELETE FROM public.metas WHERE id = v_meta;
  SELECT count(*) INTO v_orfas FROM public.metas_evidencias WHERE meta_id = v_meta;
  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou as evidências junto com a meta.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s evidência(s) órfã(s).', v_orfas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('MWKF-001', 'qa_caso_mwkf_001', true),
  ('MWKF-010', 'qa_caso_mwkf_010', true),
  ('MWKF-011', 'qa_caso_mwkf_011', true),
  ('MWKF-012', 'qa_caso_mwkf_012', true),
  ('MCHK-001', 'qa_caso_mchk_001', true),
  ('MCHK-002', 'qa_caso_mchk_002', true),
  ('MCHK-010', 'qa_caso_mchk_010', true),
  ('MCHK-011', 'qa_caso_mchk_011', true),
  ('MPAR-001', 'qa_caso_mpar_001', true),
  ('MPAR-010', 'qa_caso_mpar_010', true),
  ('MPAR-011', 'qa_caso_mpar_011', true),
  ('MPAR-012', 'qa_caso_mpar_012', true),
  ('MEVD-001', 'qa_caso_mevd_001', true),
  ('MEVD-010', 'qa_caso_mevd_010', true),
  ('MEVD-011', 'qa_caso_mevd_011', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/metas');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
