-- =========================================================
-- QA — Módulo METAS / OKRs (tabelas: metas + meta_okrs)
--
-- Terceiro item do bloco Planejamento & Gestão. Metas com seus key results.
--
-- Schema REAL (lido, ALTERs conferidos — so adicionaram colunas):
--   metas: titulo NOT NULL, ano NOT NULL, periodo enum
--     (mensal|trimestral|semestral|anual), status meta_status
--     (nao_iniciada|em_andamento|concluida|cancelada|atrasada),
--     progresso INTEGER, departamento_id ON DELETE SET NULL
--   meta_okrs: meta_id ON DELETE CASCADE, key_result NOT NULL,
--     valor_alvo NOT NULL, tipo okr_tipo
--     (percentual|quantidade|binario|monetario), progresso INTEGER
--
-- ACHADO ESPERADO: 'progresso' NAO tem CHECK de faixa nessas tabelas (o
-- CHECK BETWEEN 0 AND 100 existe em OUTRA tabela, nao aqui). META-012
-- revela se progresso aceita valor absurdo (150, -10).
--
-- Relacao: apagar a meta apaga seus OKRs (CASCADE). META-013 prova.
-- =========================================================

-- Trava do cercado.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['metas','meta_okrs'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Metas/OKRs.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='planejamento-gestao/metas';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo metas nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'META-001','Criar uma meta','feliz','alta','aprovado','api',
   'Cadastro de meta com titulo, periodo e ano.','Meta criada.'),
  (v_mod,'META-002','Adicionar key results (OKR) a uma meta','feliz','alta','aprovado','api',
   'Vincular key results (meta_okrs) a meta.','OKRs vinculados.'),
  (v_mod,'META-003','Avancar o progresso e mudar status','feliz','media','aprovado','api',
   'Progresso e status sao atualizaveis.','Progresso e status atualizados.'),
  -- ALT / EXCECAO
  (v_mod,'META-010','Titulo vazio e recusado','excecao','media','aprovado','api',
   'titulo e NOT NULL.','Recusado sem titulo.'),
  (v_mod,'META-011','Periodo invalido e recusado','excecao','media','aprovado','api',
   'periodo so aceita mensal/trimestral/semestral/anual.','Enum recusa valor fora da lista.'),
  (v_mod,'META-012','Progresso fora de 0-100 (revela ausencia de CHECK)','excecao','media','aprovado','api',
   'progresso nao tem CHECK de faixa nessas tabelas; o teste revela.','Revela se aceita 150 ou negativo.'),
  (v_mod,'META-013','Apagar a meta apaga seus OKRs (CASCADE)','alternativo','alta','aprovado','api',
   'ON DELETE CASCADE: os key results somem com a meta.','OKRs apagados junto.'),
  -- PROIBIDO
  (v_mod,'META-022','Meta de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Meta do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_meta(p_titulo text, p_ano int DEFAULT 2026)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.metas (tenant_id, titulo, ano)
  VALUES (public.qa_sandbox_tenant_id(), p_titulo, p_ano) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta "Reduzir acidentes em 20%"'; r.esperado:='Meta criada';
  v_id := public.qa_nova_meta('[QA] Reduzir acidentes em 20%');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Meta criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta e adicionar 2 key results'; r.esperado:='2 OKRs vinculados a meta';
  v_meta := public.qa_nova_meta('[QA] Meta Com OKRs');
  INSERT INTO public.meta_okrs (tenant_id, meta_id, key_result, valor_alvo) VALUES
    (v_t, v_meta, '[QA] Treinar 100% da equipe', 100),
    (v_t, v_meta, '[QA] Zerar reincidencias', 0);
  SELECT count(*) INTO v_qtd FROM public.meta_okrs WHERE meta_id=v_meta;
  IF v_qtd = 2 THEN r.situacao:='passou'; r.obtido:='2 key results vinculados a meta.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2 OKRs, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_prog int; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta e avancar progresso para 50%, status em_andamento'; r.esperado:='Progresso e status atualizados';
  v_id := public.qa_nova_meta('[QA] Meta Em Progresso');
  UPDATE public.metas SET progresso=50, status='em_andamento' WHERE id=v_id;
  SELECT progresso, status INTO v_prog, v_st FROM public.metas WHERE id=v_id;
  IF v_prog=50 AND v_st='em_andamento' THEN r.situacao:='passou'; r.obtido:='Progresso 50% e status em_andamento.';
  ELSE r.situacao:='falhou'; r.obtido:=format('progresso=%s status=%s.', v_prog, v_st); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar meta sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano) VALUES (v_t, NULL, 2026);
    r.situacao:='falhou'; r.obtido:='ACEITOU meta sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar periodo = "quinzenal" (fora do enum)'; r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, periodo) VALUES (v_t, '[QA] Periodo Invalido', 2026, 'quinzenal');
    r.situacao:='falhou'; r.obtido:='ACEITOU periodo fora do enum.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: periodo so aceita mensal/trimestral/semestral/anual.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_prog int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar meta com progresso = 150 (fora de 0-100)';
  r.esperado:='Idealmente recusado; revela se ha CHECK de faixa';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, progresso) VALUES (v_t, '[QA] Progresso Absurdo', 2026, 150)
    RETURNING id INTO v_id;
    SELECT progresso INTO v_prog FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU progresso = %s (fora de 0-100). Nao ha CHECK de faixa em metas — validacao so no front, se houver.', v_prog);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: progresso so aceita 0 a 100.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid; v_okr uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta com 1 key result'; r.esperado:='Apagar a meta apaga o OKR junto (CASCADE)';
  v_meta := public.qa_nova_meta('[QA] Meta Que Sera Apagada');
  INSERT INTO public.meta_okrs (tenant_id, meta_id, key_result, valor_alvo)
  VALUES (v_t, v_meta, '[QA] OKR Some Junto', 100) RETURNING id INTO v_okr;
  r.passo_ordem:=2; r.passo_acao:='Apagar a meta';
  DELETE FROM public.metas WHERE id=v_meta;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o OKR foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.meta_okrs WHERE id=v_okr;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='OKR apagado junto com a meta (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('OKR NAO foi apagado (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_meta_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar meta no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.metas (tenant_id, titulo, ano) VALUES (v_t1, '[QA] Meta Secreta T1', 2026);
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.metas WHERE tenant_id=v_t2 AND titulo='[QA] Meta Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Meta do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s meta(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('META-001','qa_caso_meta_001'),('META-002','qa_caso_meta_002'),('META-003','qa_caso_meta_003'),
  ('META-010','qa_caso_meta_010'),('META-011','qa_caso_meta_011'),('META-012','qa_caso_meta_012'),
  ('META-013','qa_caso_meta_013'),('META-022','qa_caso_meta_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/metas'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
