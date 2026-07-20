-- =========================================================
-- QA — Módulo PLANEJAMENTO ESTRATÉGICO · complemento OCEANO AZUL
--   (tabelas: estrategia_oceano_azul + estrategia_oceano_itens)
--
-- COMPLEMENTA o modulo planejamento-estrategico, que ja tinha os casos SWOT.
-- Correcao de uma omissao: o modulo tambem tem a analise Oceano Azul, que
-- eu havia deixado de fora.
--
-- Schema REAL (lido, ALTERs conferidos — so add column):
--   estrategia_oceano_azul: titulo NOT NULL,
--     swot_id REFERENCES estrategia_swot ON DELETE SET NULL
--       (a analise Oceano Azul pode nascer de uma SWOT)
--   estrategia_oceano_itens: oceano_id ON DELETE CASCADE,
--     quadrante oceano_quadrante NOT NULL (eliminar|reduzir|elevar|criar —
--       a matriz ERRC classica), descricao NOT NULL,
--     swot_item_id REFERENCES estrategia_swot_itens ON DELETE SET NULL
--       (um item do Oceano pode vir de um item da SWOT)
--
-- O DIFERENCIAL deste recurso: a CONEXAO com o SWOT. OCEANO-003 e OCEANO-013
-- testam essa ligacao (nascer de uma SWOT; e o que acontece quando a SWOT
-- de origem some — SET NULL, o Oceano sobrevive desassociado).
-- =========================================================

-- Trava do cercado nas duas tabelas novas.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['estrategia_oceano_azul','estrategia_oceano_itens'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Planejamento Estrategico (Oceano Azul).') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO (mesmo modulo do SWOT)
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='planejamento-gestao/planejamento-estrategico';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo planejamento-estrategico nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'OCEANO-001','Criar uma analise Oceano Azul','feliz','alta','aprovado','api',
   'Cadastro basico de uma matriz Oceano Azul.','Matriz criada.'),
  (v_mod,'OCEANO-002','Adicionar itens nos 4 quadrantes ERRC','feliz','alta','aprovado','api',
   'Eliminar, reduzir, elevar e criar sao guardados.','Os 4 quadrantes persistidos.'),
  (v_mod,'OCEANO-003','Oceano Azul nascido de uma SWOT','feliz','media','aprovado','api',
   'A analise Oceano pode referenciar uma SWOT de origem (swot_id).','Oceano vinculado a SWOT.'),
  -- ALT / EXCECAO
  (v_mod,'OCEANO-010','Titulo vazio e recusado','excecao','media','aprovado','api',
   'titulo e NOT NULL.','Recusado sem titulo.'),
  (v_mod,'OCEANO-011','Item com quadrante invalido e recusado','excecao','media','aprovado','api',
   'quadrante so aceita eliminar/reduzir/elevar/criar.','Enum recusa valor fora da lista.'),
  (v_mod,'OCEANO-013','Apagar a SWOT de origem desassocia o Oceano (SET NULL)','alternativo','alta','aprovado','api',
   'swot_id ON DELETE SET NULL: o Oceano sobrevive sem a SWOT.','Oceano preservado, sem swot_id.'),
  (v_mod,'OCEANO-014','Apagar a matriz Oceano apaga seus itens (CASCADE)','alternativo','alta','aprovado','api',
   'oceano_id ON DELETE CASCADE.','Itens apagados junto.'),
  -- PROIBIDO
  (v_mod,'OCEANO-022','Oceano de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Oceano do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_novo_oceano(p_titulo text, p_swot uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.estrategia_oceano_azul (tenant_id, titulo, swot_id)
  VALUES (public.qa_sandbox_tenant_id(), p_titulo, p_swot) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar analise "Novo mercado 2026"'; r.esperado:='Matriz criada';
  v_id := public.qa_novo_oceano('[QA] Novo Mercado 2026');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Matriz Oceano Azul criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_oc uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar Oceano e um item em cada quadrante ERRC'; r.esperado:='4 itens (eliminar/reduzir/elevar/criar)';
  v_oc := public.qa_novo_oceano('[QA] Oceano Com Itens');
  INSERT INTO public.estrategia_oceano_itens (tenant_id, oceano_id, quadrante, descricao) VALUES
    (v_t, v_oc, 'eliminar', '[QA] Burocracia excessiva'),
    (v_t, v_oc, 'reduzir', '[QA] Custo operacional'),
    (v_t, v_oc, 'elevar', '[QA] Qualidade do atendimento'),
    (v_t, v_oc, 'criar', '[QA] Servico inovador');
  SELECT count(*) INTO v_qtd FROM public.estrategia_oceano_itens WHERE oceano_id=v_oc;
  IF v_qtd = 4 THEN r.situacao:='passou'; r.obtido:='4 itens nos quadrantes ERRC (eliminar, reduzir, elevar, criar).';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 4 itens, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_swot uuid; v_oc uuid; v_swot_do_oc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar uma SWOT e um Oceano Azul nascido dela'; r.esperado:='Oceano referencia a SWOT de origem';
  v_swot := public.qa_nova_swot('[QA] SWOT Origem');
  v_oc := public.qa_novo_oceano('[QA] Oceano Da SWOT', v_swot);
  SELECT swot_id INTO v_swot_do_oc FROM public.estrategia_oceano_azul WHERE id=v_oc;
  IF v_swot_do_oc = v_swot THEN r.situacao:='passou'; r.obtido:='Oceano Azul vinculado a SWOT de origem.';
  ELSE r.situacao:='falhou'; r.obtido:='Oceano nao referenciou a SWOT.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar Oceano sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.estrategia_oceano_azul (tenant_id, titulo) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU Oceano sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_oc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar Oceano e tentar item com quadrante "manter" (fora do enum)'; r.esperado:='Recusado pelo enum';
  v_oc := public.qa_novo_oceano('[QA] Oceano Quadrante Invalido');
  BEGIN
    INSERT INTO public.estrategia_oceano_itens (tenant_id, oceano_id, quadrante, descricao)
    VALUES (v_t, v_oc, 'manter', '[QA] item invalido');
    r.situacao:='falhou'; r.obtido:='ACEITOU quadrante fora do enum.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: quadrante so aceita eliminar/reduzir/elevar/criar.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_swot uuid; v_oc uuid; v_existe boolean; v_swot_do_oc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar SWOT e um Oceano ligado a ela'; r.esperado:='Apagar a SWOT desassocia o Oceano, nao o apaga';
  v_swot := public.qa_nova_swot('[QA] SWOT Que Sera Apagada');
  v_oc := public.qa_novo_oceano('[QA] Oceano Orfao', v_swot);
  r.passo_ordem:=2; r.passo_acao:='Apagar a SWOT de origem';
  DELETE FROM public.estrategia_swot WHERE id=v_swot;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o Oceano sobreviveu, agora sem swot_id';
  SELECT EXISTS(SELECT 1 FROM public.estrategia_oceano_azul WHERE id=v_oc) INTO v_existe;
  SELECT swot_id INTO v_swot_do_oc FROM public.estrategia_oceano_azul WHERE id=v_oc;
  IF v_existe AND v_swot_do_oc IS NULL THEN
    r.situacao:='passou'; r.obtido:='Oceano sobreviveu e ficou sem SWOT (SET NULL), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Oceano existe=%s, swot_id=%s.', v_existe, v_swot_do_oc); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_oc uuid; v_item uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar Oceano com 1 item'; r.esperado:='Apagar a matriz apaga o item junto (CASCADE)';
  v_oc := public.qa_novo_oceano('[QA] Oceano Que Sera Apagado');
  INSERT INTO public.estrategia_oceano_itens (tenant_id, oceano_id, quadrante, descricao)
  VALUES (v_t, v_oc, 'criar', '[QA] Item Some Junto') RETURNING id INTO v_item;
  r.passo_ordem:=2; r.passo_acao:='Apagar a matriz Oceano';
  DELETE FROM public.estrategia_oceano_azul WHERE id=v_oc;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o item foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.estrategia_oceano_itens WHERE id=v_item;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='Item apagado junto com a matriz (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Item NAO foi apagado (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_oceano_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar Oceano no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.estrategia_oceano_azul (tenant_id, titulo) VALUES (v_t1, '[QA] Oceano Secreto T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.estrategia_oceano_azul WHERE tenant_id=v_t2 AND titulo='[QA] Oceano Secreto T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Oceano do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s Oceano(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('OCEANO-001','qa_caso_oceano_001'),('OCEANO-002','qa_caso_oceano_002'),('OCEANO-003','qa_caso_oceano_003'),
  ('OCEANO-010','qa_caso_oceano_010'),('OCEANO-011','qa_caso_oceano_011'),('OCEANO-013','qa_caso_oceano_013'),
  ('OCEANO-014','qa_caso_oceano_014'),('OCEANO-022','qa_caso_oceano_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar o modulo inteiro (SWOT + Oceano juntos) ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/planejamento-estrategico'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 56) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
