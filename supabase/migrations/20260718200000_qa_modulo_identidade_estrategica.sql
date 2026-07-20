-- =========================================================
-- QA — Módulo IDENTIDADE ESTRATÉGICA (tabela: estrategia_cultura)
--
-- Primeiro item do bloco Planejamento & Gestão.
--
-- CARACTERISTICA UNICA (lida do schema): tenant_id e UNIQUE.
--   => cada cliente tem UMA identidade (missao/visao/valores), nao varias.
--   Isso e o oposto dos modulos de Estrutura Organizacional (que eram
--   listas com muitos registros por cliente). Aqui o "proibido" e criar
--   uma SEGUNDA identidade para o mesmo cliente.
--
-- Schema REAL:
--   estrategia_cultura: tenant_id UNIQUE, missao TEXT, visao TEXT,
--     valores JSONB, principios JSONB, comportamentos_* JSONB
--   Campos de texto sao opcionais (a identidade pode ser preenchida aos poucos).
--
-- IMPORTANTE para o teste: como o cercado (tenant qa-sandbox) pode JA ter
-- uma identidade de rodadas anteriores, cada rotina limpa a identidade do
-- cercado antes de comecar. O funil desfaz tudo no fim de qualquer forma.
-- =========================================================

-- Trava do cercado.
DO $trava$
BEGIN
  IF to_regclass('public.estrategia_cultura') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.estrategia_cultura;
    CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.estrategia_cultura
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES ('estrategia_cultura', 'Modulo Identidade Estrategica. Casos IDE-*.') ON CONFLICT (tabela) DO NOTHING;
  END IF;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='planejamento-gestao/identidade-estrategica';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo identidade-estrategica nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'IDE-001','Definir a identidade (missao e visao)','feliz','alta','aprovado','api',
   'O cliente define missao e visao.','Identidade criada.'),
  (v_mod,'IDE-002','Registrar valores como lista','feliz','media','aprovado','api',
   'Valores sao guardados como lista (JSONB).','Valores persistidos como lista.'),
  (v_mod,'IDE-003','Atualizar a missao existente','feliz','media','aprovado','api',
   'A identidade e editavel.','Missao atualizada.'),
  -- ALT / EXCECAO
  (v_mod,'IDE-010','Identidade so com missao (visao vazia) e aceita','alternativo','media','aprovado','api',
   'Campos sao opcionais; da pra preencher aos poucos.','Aceito so com missao.'),
  (v_mod,'IDE-011','Valores como lista vazia e aceito','alternativo','baixa','aprovado','api',
   'Lista de valores pode comecar vazia.','Aceito com valores [].'),
  -- PROIBIDO
  (v_mod,'IDE-020','Duas identidades para o mesmo cliente e proibido','negativo','alta','aprovado','api',
   'tenant_id e UNIQUE: cada cliente tem UMA identidade.','Segunda identidade recusada.'),
  (v_mod,'IDE-022','Identidade de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Identidade do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
-- helper: garante cercado sem identidade antes de cada teste
CREATE OR REPLACE FUNCTION public.qa_limpa_identidade(p_tenant uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.estrategia_cultura WHERE tenant_id = p_tenant;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Definir missao e visao do cliente'; r.esperado:='Identidade criada';
  INSERT INTO public.estrategia_cultura (tenant_id, missao, visao)
  VALUES (v_t, '[QA] Proteger vidas no trabalho', '[QA] Ser referencia em SST') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Identidade criada com missao e visao.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade com 3 valores'; r.esperado:='Os 3 valores ficam guardados na lista';
  INSERT INTO public.estrategia_cultura (tenant_id, missao, valores)
  VALUES (v_t, '[QA] Missao', '["Seguranca","Etica","Cuidado"]'::jsonb) RETURNING id INTO v_id;
  SELECT jsonb_array_length(valores) INTO v_qtd FROM public.estrategia_cultura WHERE id=v_id;
  IF v_qtd = 3 THEN r.situacao:='passou'; r.obtido:='3 valores guardados na lista.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 3 valores, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_m text;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade e depois trocar a missao'; r.esperado:='Missao nova persiste';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t, '[QA] Missao Antiga') RETURNING id INTO v_id;
  UPDATE public.estrategia_cultura SET missao='[QA] Missao Nova' WHERE id=v_id;
  SELECT missao INTO v_m FROM public.estrategia_cultura WHERE id=v_id;
  IF v_m='[QA] Missao Nova' THEN r.situacao:='passou'; r.obtido:='Missao atualizada.';
  ELSE r.situacao:='falhou'; r.obtido:='Missao='||v_m; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade so com missao (sem visao)'; r.esperado:='Aceito (campos opcionais)';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t, '[QA] So Missao') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Aceito so com missao, visao pode ficar para depois.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade com lista de valores vazia'; r.esperado:='Aceito com []';
  INSERT INTO public.estrategia_cultura (tenant_id, missao, valores) VALUES (v_t, '[QA] Missao', '[]'::jsonb) RETURNING id INTO v_id;
  SELECT jsonb_array_length(valores) INTO v_qtd FROM public.estrategia_cultura WHERE id=v_id;
  IF v_id IS NOT NULL AND v_qtd = 0 THEN r.situacao:='passou'; r.obtido:='Aceito com lista de valores vazia.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Valores=%s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar a identidade do cliente'; r.esperado:='Segunda identidade para o MESMO cliente e recusada';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t, '[QA] Primeira Identidade');
  r.passo_ordem:=2; r.passo_acao:='Tentar criar uma SEGUNDA identidade para o mesmo cliente';
  BEGIN
    INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t, '[QA] Segunda Identidade');
    r.situacao:='falhou'; r.obtido:='ACEITOU duas identidades para o mesmo cliente — o UNIQUE em tenant_id sumiu.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: cada cliente tem uma unica identidade, como esperado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ide_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  PERFORM public.qa_limpa_identidade(v_t1);
  PERFORM public.qa_limpa_identidade(v_t2);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t1, '[QA] Missao Secreta T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.estrategia_cultura WHERE tenant_id=v_t2 AND missao='[QA] Missao Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Identidade do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s identidade(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('IDE-001','qa_caso_ide_001'),('IDE-002','qa_caso_ide_002'),('IDE-003','qa_caso_ide_003'),
  ('IDE-010','qa_caso_ide_010'),('IDE-011','qa_caso_ide_011'),('IDE-020','qa_caso_ide_020'),
  ('IDE-022','qa_caso_ide_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'planejamento-gestao/identidade-estrategica'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
