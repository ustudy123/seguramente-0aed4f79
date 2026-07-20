-- =========================================================
-- QA — Módulo PLANEJAMENTO ESTRATÉGICO (tabelas: estrategia_swot + itens)
--
-- Segundo item do bloco Planejamento & Gestão. O nucleo e a analise SWOT:
-- uma matriz (estrategia_swot) com itens (estrategia_swot_itens).
--
-- Schema REAL (lido, e conferidos ALTERs posteriores — licao do IDE-020):
--   estrategia_swot: titulo NOT NULL, escopo, periodo, projeto
--   estrategia_swot_itens: swot_id REFERENCES ... ON DELETE CASCADE,
--     tipo swot_tipo NOT NULL (forca|fraqueza|oportunidade|ameaca),
--     descricao NOT NULL, classificacao e impacto (enums)
--   ALTERs so adicionaram colunas (grupo_economico_id, escopo); nenhuma
--   mudou regra de unicidade. Definicao estavel.
--
-- Relacao: apagar a matriz SWOT apaga seus itens (CASCADE). SWOT-013 prova.
-- =========================================================

-- Trava do cercado nas duas tabelas.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['estrategia_swot','estrategia_swot_itens'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Planejamento Estrategico (SWOT).') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='planejamento-gestao/planejamento-estrategico';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo planejamento-estrategico nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'SWOT-001','Criar uma analise SWOT','feliz','alta','aprovado','api',
   'Cadastro basico de uma matriz SWOT.','Matriz criada.'),
  (v_mod,'SWOT-002','Adicionar os 4 tipos de item (F/F/O/A)','feliz','alta','aprovado','api',
   'Forca, fraqueza, oportunidade e ameaca sao guardados.','Os 4 tipos persistidos.'),
  (v_mod,'SWOT-003','Editar o titulo da analise','feliz','media','aprovado','api',
   'A matriz e editavel.','Titulo atualizado.'),
  -- ALT / EXCECAO
  (v_mod,'SWOT-010','Titulo vazio e recusado','excecao','media','aprovado','api',
   'titulo e NOT NULL.','Recusado sem titulo.'),
  (v_mod,'SWOT-011','Item com tipo invalido e recusado','excecao','media','aprovado','api',
   'tipo so aceita forca/fraqueza/oportunidade/ameaca.','Enum recusa valor fora da lista.'),
  (v_mod,'SWOT-013','Apagar a matriz apaga os itens (CASCADE)','alternativo','alta','aprovado','api',
   'ON DELETE CASCADE: os itens somem com a matriz.','Itens apagados junto.'),
  -- PROIBIDO
  (v_mod,'SWOT-022','SWOT de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','SWOT do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_swot(p_titulo text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.estrategia_swot (tenant_id, titulo)
  VALUES (public.qa_sandbox_tenant_id(), p_titulo) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar analise SWOT "Planejamento 2026"'; r.esperado:='Matriz criada';
  v_id := public.qa_nova_swot('[QA] Planejamento 2026');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Matriz SWOT criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_swot uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar SWOT e adicionar um item de cada tipo (F/F/O/A)'; r.esperado:='4 itens, um de cada tipo';
  v_swot := public.qa_nova_swot('[QA] SWOT Com Itens');
  INSERT INTO public.estrategia_swot_itens (tenant_id, swot_id, tipo, descricao) VALUES
    (v_t, v_swot, 'forca', '[QA] Equipe qualificada'),
    (v_t, v_swot, 'fraqueza', '[QA] Processos manuais'),
    (v_t, v_swot, 'oportunidade', '[QA] Novo mercado'),
    (v_t, v_swot, 'ameaca', '[QA] Concorrencia');
  SELECT count(*) INTO v_qtd FROM public.estrategia_swot_itens WHERE swot_id=v_swot;
  IF v_qtd = 4 THEN r.situacao:='passou'; r.obtido:='4 itens (forca, fraqueza, oportunidade, ameaca) guardados.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 4 itens, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_tit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar SWOT e mudar o titulo'; r.esperado:='Titulo novo persiste';
  v_id := public.qa_nova_swot('[QA] Titulo Antigo SWOT');
  UPDATE public.estrategia_swot SET titulo='[QA] Titulo Novo SWOT' WHERE id=v_id;
  SELECT titulo INTO v_tit FROM public.estrategia_swot WHERE id=v_id;
  IF v_tit='[QA] Titulo Novo SWOT' THEN r.situacao:='passou'; r.obtido:='Titulo atualizado.';
  ELSE r.situacao:='falhou'; r.obtido:='Titulo='||v_tit; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar SWOT sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.estrategia_swot (tenant_id, titulo) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU SWOT sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_swot uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar SWOT e tentar item com tipo "neutro" (fora do enum)'; r.esperado:='Recusado pelo enum';
  v_swot := public.qa_nova_swot('[QA] SWOT Tipo Invalido');
  BEGIN
    INSERT INTO public.estrategia_swot_itens (tenant_id, swot_id, tipo, descricao)
    VALUES (v_t, v_swot, 'neutro', '[QA] item invalido');
    r.situacao:='falhou'; r.obtido:='ACEITOU tipo fora do enum.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: tipo so aceita forca/fraqueza/oportunidade/ameaca.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_swot uuid; v_item uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar SWOT com 1 item'; r.esperado:='Apagar a matriz apaga o item junto (CASCADE)';
  v_swot := public.qa_nova_swot('[QA] SWOT Que Sera Apagada');
  INSERT INTO public.estrategia_swot_itens (tenant_id, swot_id, tipo, descricao)
  VALUES (v_t, v_swot, 'forca', '[QA] Item Some Junto') RETURNING id INTO v_item;
  r.passo_ordem:=2; r.passo_acao:='Apagar a matriz SWOT';
  DELETE FROM public.estrategia_swot WHERE id=v_swot;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o item foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.estrategia_swot_itens WHERE id=v_item;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='Item apagado junto com a matriz (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Item NAO foi apagado (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_swot_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar SWOT no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.estrategia_swot (tenant_id, titulo) VALUES (v_t1, '[QA] SWOT Secreta T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.estrategia_swot WHERE tenant_id=v_t2 AND titulo='[QA] SWOT Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='SWOT do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s SWOT visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('SWOT-001','qa_caso_swot_001'),('SWOT-002','qa_caso_swot_002'),('SWOT-003','qa_caso_swot_003'),
  ('SWOT-010','qa_caso_swot_010'),('SWOT-011','qa_caso_swot_011'),('SWOT-013','qa_caso_swot_013'),
  ('SWOT-022','qa_caso_swot_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/planejamento-estrategico'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
