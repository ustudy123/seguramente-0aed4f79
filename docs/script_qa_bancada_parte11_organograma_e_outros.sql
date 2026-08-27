-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 11 de 15
-- Organograma, Perfis de Acesso, Planejamento Estratégico e Plano de Ação
--
-- POR QUE ESTA TRILHA EXISTE
-- A bancada de testes tem tres camadas: a ROTINA (uma funcao), o CASO
-- DOCUMENTADO (linha em qa_casos_teste) e a PONTE que liga uma a outra
-- (qa_implementacoes). Rotina e estrutura; caso e ponte sao dados. As tres
-- nasceram em migrations, que so alcancam o ambiente de teste — nunca a
-- producao. Resultado medido: a producao documenta 568 casos e executa 268,
-- enquanto o projeto documenta 822 e executa 565.
--
-- Esta trilha leva as tres camadas para a producao. A homologacao herda na
-- proxima copia (as tabelas do motor de QA sao copiadas de la na integra).
--
-- GARANTIAS
--   - Idempotente: rodar duas vezes nao duplica nem quebra.
--   - NAO altera nenhuma regra de negocio. So a bancada que as verifica.
--   - Modulo resolvido pelo CAMINHO, nao pelo identificador interno (os
--     identificadores diferem entre ambientes).
--   - A ponte so e criada quando a rotina existe de fato no destino.
--   - Cada rotina entra em bloco proprio: falha de uma vira NOTICE, nao
--     aborta o arquivo.
--   - O cercado (tenant isolado onde os testes rodam) JA existe na producao —
--     esta trilha nao mexe nele, nem em dado de cliente.
-- Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) ROTINAS — 45 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar acao sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.plano_acoes (tenant_id, codigo, titulo, origem_modulo) VALUES (v_t, 'QA-X', NULL, 'manual');
    r.situacao:='falhou'; r.obtido:='ACEITOU acao sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_014()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_014()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_014 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_acao_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_acao_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_acao_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar analise "Novo mercado 2026"'; r.esperado:='Matriz criada';
  v_id := public.qa_novo_oceano('[QA] Novo Mercado 2026');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Matriz Oceano Azul criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar Oceano sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.estrategia_oceano_azul (tenant_id, titulo) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU Oceano sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_014()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_014()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_014 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_oceano_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_oceano_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_oceano_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_org_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar no "Diretoria"'; r.esperado:='No criado';
  v_id := public.qa_novo_no_org('[QA] Diretoria');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='No do organograma criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_org_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_org_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_org_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_pai uuid; v_filho uuid; v_parent uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar no "Gerencia" e sob ele "Coordenacao"'; r.esperado:='Coordenacao tem Gerencia como pai';
  v_pai := public.qa_novo_no_org('[QA] Gerencia');
  v_filho := public.qa_novo_no_org('[QA] Coordenacao', v_pai);
  SELECT parent_id INTO v_parent FROM public.estrategia_organograma WHERE id=v_filho;
  IF v_parent = v_pai THEN r.situacao:='passou'; r.obtido:='Hierarquia de 2 niveis montada (filho aponta para o pai).';
  ELSE r.situacao:='falhou'; r.obtido:='parent_id do filho nao aponta para o pai.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_org_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_org_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_org_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_cargo uuid; v_no uuid; v_cargo_do_no uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar um cargo e um no do organograma ligado a ele'; r.esperado:='No referencia o cargo';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Para Organo') RETURNING id INTO v_cargo;
  INSERT INTO public.estrategia_organograma (tenant_id, titulo, cargo_id)
  VALUES (v_t, '[QA] No Com Cargo', v_cargo) RETURNING id INTO v_no;
  SELECT cargo_id INTO v_cargo_do_no FROM public.estrategia_organograma WHERE id=v_no;
  IF v_cargo_do_no = v_cargo THEN r.situacao:='passou'; r.obtido:='No vinculado ao cargo do cadastro.';
  ELSE r.situacao:='falhou'; r.obtido:='No nao referenciou o cargo.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_org_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_org_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_org_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar no sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.estrategia_organograma (tenant_id, titulo) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU no sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_org_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_org_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_org_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_avo uuid; v_pai uuid; v_neto uuid; v_existe boolean; v_novo_parent uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Montar 3 niveis: Avo -> Pai -> Neto'; r.esperado:='Apagar o Pai (meio) promove o Neto, nao o apaga';
  v_avo := public.qa_novo_no_org('[QA] Avo');
  v_pai := public.qa_novo_no_org('[QA] Pai Do Meio', v_avo);
  v_neto := public.qa_novo_no_org('[QA] Neto', v_pai);
  r.passo_ordem:=2; r.passo_acao:='Apagar o no do meio (Pai)';
  DELETE FROM public.estrategia_organograma WHERE id=v_pai;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o Neto sobreviveu, agora sem pai';
  SELECT EXISTS(SELECT 1 FROM public.estrategia_organograma WHERE id=v_neto) INTO v_existe;
  SELECT parent_id INTO v_novo_parent FROM public.estrategia_organograma WHERE id=v_neto;
  IF v_existe AND v_novo_parent IS NULL THEN
    r.situacao:='passou'; r.obtido:='Neto sobreviveu e ficou sem pai (SET NULL). A subarvore nao foi apagada.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Neto existe=%s, parent=%s.', v_existe, v_novo_parent); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_org_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_org_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_org_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar no no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.estrategia_organograma (tenant_id, titulo) VALUES (v_t1, '[QA] No Secreto T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.estrategia_organograma WHERE tenant_id=v_t2 AND titulo='[QA] No Secreto T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='No do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s no(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_org_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_org_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_faltando text;
  v_erradas text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): políticas perfil_restringe_leitura_* no catálogo';
  r.esperado    := '20 tabelas sensíveis com política RESTRICTIVE de SELECT';

  SELECT string_agg(t.tabela, ', ' ORDER BY t.tabela) INTO v_faltando
  FROM (VALUES
    -- 08/08, primeira leva
    ('atestados'), ('eventos_saude'), ('documentos'), ('admissao_documentos'),
    ('psicossocial_entrevistas'), ('psicossocial_entrevistas_mensagens'),
    ('psicossocial_alertas'),
    -- 08/08, complemento
    ('afastamentos_saude'), ('alertas_saude'),
    ('psicossocial_entrevistas_evidencias'), ('psicossocial_participacoes'),
    -- 13/08, o questionário — respostas individuais e convites com CPF
    ('questionario_psicossocial_respostas'), ('questionario_psicossocial_convites'),
    -- 14/08, o módulo Férias — salário-base e valores por pessoa
    ('ferias_periodos_aquisitivos'), ('ferias_programacao'), ('ferias_solicitacoes'),
    ('folha_ferias_calculo'), ('ferias_assinatura_links'), ('ferias_historico'),
    ('ferias_vinculo_familiar')
  ) AS t(tabela)
  WHERE to_regclass('public.' || t.tabela) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t.tabela
        AND p.policyname LIKE 'perfil_restringe_leitura_%'
    );

  -- Existir não basta: precisa ser RESTRICTIVE e valer para SELECT.
  SELECT string_agg(p.tablename || ' (' || p.permissive || '/' || p.cmd || ')', ', ')
    INTO v_erradas
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.policyname LIKE 'perfil_restringe_leitura_%'
    AND (p.permissive <> 'RESTRICTIVE' OR p.cmd NOT IN ('SELECT', 'ALL'));

  IF v_faltando IS NULL AND v_erradas IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Camada restritiva presente e correta nas 20 tabelas sensíveis.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A camada de perfil regrediu. '
      || COALESCE('Sem política: ' || v_faltando || '. ', '')
      || COALESCE('Política com forma errada: ' || v_erradas || '. ', '')
      || 'Sem ela, qualquer usuário autenticado do cliente volta a alcançar, pela API, '
      || 'dados de saúde, documentos e salário de todos os colegas.';
    r.detalhe := jsonb_build_object('sem_politica', v_faltando, 'forma_errada', v_erradas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_perfil_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_perfil_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_faltando text := '';
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): funções do controle por perfil';
  r.esperado    := 'perfil_permite_modulo, cpf_do_usuario_logado e perfil_padrao_colaborador presentes';

  IF to_regprocedure('public.perfil_permite_modulo(uuid, text[])') IS NULL THEN
    v_faltando := v_faltando || 'perfil_permite_modulo ';
  END IF;
  IF to_regprocedure('public.cpf_do_usuario_logado()') IS NULL THEN
    v_faltando := v_faltando || 'cpf_do_usuario_logado ';
  END IF;
  IF to_regprocedure('public.perfil_padrao_colaborador(uuid)') IS NULL THEN
    v_faltando := v_faltando || 'perfil_padrao_colaborador ';
  END IF;

  IF v_faltando = '' THEN
    r.situacao := 'passou';
    r.obtido   := 'As três funções existem.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Função(ões) ausente(s): ' || v_faltando
      || '— as políticas restritivas dependem delas; sem a função, a política que a chama '
      || 'passa a NEGAR tudo (efeito visível) ou foi derrubada junto (efeito silencioso).';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_perfil_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_perfil_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): tabelas de padrão sensível sem a camada de perfil';
  r.esperado    := 'Nenhuma tabela sensível descoberta sem política perfil_restringe_leitura_*';

  SELECT string_agg(x.table_name, ', ' ORDER BY x.table_name) INTO v_lista
  FROM (
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name AND pc.relkind = 'r'
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND (c.table_name LIKE 'atestado%'
        OR c.table_name LIKE '%\_saude%'
        OR c.table_name LIKE '%psicossocial%'
        -- ACRESCENTADO EM 14/08: o módulo Férias guarda salário-base e
        -- valores apurados por pessoa. Ficou fora da camada desde o
        -- início porque não casava com nenhum padrão vigiado.
        OR c.table_name LIKE 'ferias%'
        OR c.table_name LIKE 'folha\_ferias%'
        OR c.table_name IN ('documentos', 'admissao_documentos'))
      AND c.table_name NOT IN (
        -- EXCEÇÕES DOCUMENTADAS (triagem de 08/08/2026):
        'psicossocial_dimensoes',            -- catálogo de dimensões, sem dado pessoal
        'psicossocial_ghe',                  -- grupos homogêneos, organizacional
        'psicossocial_ghe_cargos',           -- relação GHE x cargo, organizacional
        'psicossocial_consentimentos',       -- registro anônimo por hash de sessão
        'psicossocial_evidencias',           -- evidência de risco organizacional, sem pessoa
        'psicossocial_indice_confiabilidade',-- índice agregado (contagens), sem pessoa
        'psicossocial_inventario_riscos',    -- inventário organizacional de riscos
        'psicossocial_plano_acao',           -- plano de ação por GHE, organizacional
        'psicossocial_responsavel_tecnico',  -- dados do RT do programa (profissional que
                                             -- assina o documento, não trabalhador avaliado)
        'psicossocial_riscos',               -- catálogo de riscos ("nome" é o nome do risco)
        'questionario_psicossocial_campanhas',-- desenho do ciclo; não guarda pessoa
        -- ACRESCENTADA EM 14/08, com a entrada do módulo Férias:
        'ferias_config'                       -- percentuais de encargo da EMPRESA
                                              -- (INSS patronal, RAT/FAP, FGTS);
                                              -- parâmetro, não pessoa
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = c.table_name
          AND p.policyname LIKE 'perfil_restringe_leitura_%'
      )
  ) x;

  IF v_lista IS NULL THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhuma tabela de padrão sensível sem a camada de perfil.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Tabela(s) de padrão sensível SEM a camada de perfil: ' || v_lista
      || '. Se a tabela guarda dado pessoal identificável, aplicar a política '
      || 'perfil_restringe_leitura_<tabela>; se for organizacional, adicionar à lista de '
      || 'exceções desta rotina com justificativa.';
    r.detalhe := jsonb_build_object('tabelas', v_lista);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_perfil_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_perfil_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  c RECORD;
  v_uid uuid;
  v_tenant uuid;
  v_variante text;
  v_claims_antes text;
  v_amplo boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'FUNCIONAL (somente leitura): simular usuário sem acesso amplo à saúde e avaliar a função de permissão';
  r.esperado    := 'perfil_permite_modulo(tenant, atestados) = false para o usuário simulado';

  -- 1º estágio: ATIVO com vínculo cujo perfil não tem saúde ampla.
  FOR c IN
    SELECT ub.auth_user_id, ub.tenant_id
    FROM public.usuarios_base ub
    WHERE ub.auth_user_id IS NOT NULL
      AND COALESCE(ub.status::text, 'ativo') = 'ativo'
      AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
      AND EXISTS (
        SELECT 1 FROM public.usuario_perfil_vinculos v
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.usuario_perfil_vinculos v
        JOIN public.perfil_permissoes pp
          ON pp.perfil_id = v.perfil_id
         AND COALESCE(pp.ativo, true) = true
         AND pp.modulo IN ('atestados', 'sst')
         AND COALESCE(pp.escopo::text, '') <> 'proprio_usuario'
        WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
      )
    LIMIT 200
  LOOP
    IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
       AND NOT public.is_superadmin(c.auth_user_id) THEN
      v_uid := c.auth_user_id; v_tenant := c.tenant_id;
      v_variante := 'perfil_restrito';
      EXIT;
    END IF;
  END LOOP;

  -- 2º estágio: ATIVO comum sem vínculo de perfil (negado por padrão).
  IF v_uid IS NULL THEN
    FOR c IN
      SELECT ub.auth_user_id, ub.tenant_id
      FROM public.usuarios_base ub
      WHERE ub.auth_user_id IS NOT NULL
        AND COALESCE(ub.status::text, 'ativo') = 'ativo'
        AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_perfil_vinculos v
          WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
        )
      LIMIT 200
    LOOP
      IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
         AND NOT public.is_superadmin(c.auth_user_id) THEN
        v_uid := c.auth_user_id; v_tenant := c.tenant_id;
        v_variante := 'sem_perfil';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- 3º estágio: colaborador de convite pendente/rascunho, sem vínculo.
  -- É a população real de colaboradores hoje (raio-X de 10/08/2026):
  -- a conta existe e a função de permissão já precisa negá-la — quando
  -- a pessoa ativar, a resposta tem que ser a mesma.
  IF v_uid IS NULL THEN
    FOR c IN
      SELECT ub.auth_user_id, ub.tenant_id
      FROM public.usuarios_base ub
      WHERE ub.auth_user_id IS NOT NULL
        AND COALESCE(ub.status::text, 'ativo') <> 'ativo'
        AND COALESCE(ub.tipo_usuario::text, '') NOT IN ('administrador', 'gestor')
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_perfil_vinculos v
          WHERE v.usuario_id = ub.id AND COALESCE(v.ativo, true) = true
        )
      LIMIT 200
    LOOP
      IF NOT public.has_minimum_role(c.auth_user_id, 'manager'::public.app_role)
         AND NOT public.is_superadmin(c.auth_user_id) THEN
        v_uid := c.auth_user_id; v_tenant := c.tenant_id;
        v_variante := 'convite_pendente';
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF v_uid IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Não há usuário sem acesso de gestão para simular — em nenhum status. A base é '
               || '100% administradores/gestores/papéis de gestão. Nada a negar — nada a testar.';
    RETURN r;
  END IF;

  v_claims_antes := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', v_uid, 'role', 'authenticated')::text,
                     true);

  BEGIN
    v_amplo := public.perfil_permite_modulo(v_tenant, 'atestados');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);
    RAISE;
  END;

  PERFORM set_config('request.jwt.claims', COALESCE(v_claims_antes, ''), true);

  IF v_amplo IS FALSE THEN
    r.situacao := 'passou';
    r.obtido   := CASE v_variante
      WHEN 'perfil_restrito' THEN
        'Usuário com perfil restrito (sem saúde em escopo amplo) negado para acesso amplo a atestados, como devido.'
      WHEN 'sem_perfil' THEN
        'Usuário ativo sem vínculo de perfil negado para acesso amplo a atestados (negado por padrão), como devido.'
      ELSE
        'Colaborador com convite pendente negado para acesso amplo a atestados, como devido. '
        || 'Quando colaboradores ativarem a conta (ou receberem perfil), a rotina passa a testá-los automaticamente.'
    END;
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Um usuário que NÃO deveria ter acesso amplo a atestados obteve acesso pela função '
               || 'de permissão (variante: ' || v_variante || '). A camada restritiva está deixando passar.';
  END IF;
  r.detalhe := jsonb_build_object('variante', v_variante, 'auth_user_id', v_uid, 'tenant_id', v_tenant);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_perfil_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_perfil_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_perfil_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_qtd int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): gatilhos do perfil padrão';
  r.esperado    := 'trigger_vincular_perfil_padrao e trigger_substituir_perfil_padrao habilitados';

  SELECT count(*) INTO v_qtd
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE t.tgname IN ('trigger_vincular_perfil_padrao', 'trigger_substituir_perfil_padrao')
    AND t.tgenabled <> 'D';

  IF v_qtd = 2 THEN
    r.situacao := 'passou';
    r.obtido   := 'Os dois gatilhos do perfil padrão estão habilitados.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de 2 gatilho(s) habilitado(s). Sem eles, usuário criado sem perfil '
               || 'volta ao limbo (entra e não vê nada) e o perfil automático deixa de ceder '
               || 'lugar ao perfil escolhido pelo RH.', v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_perfil_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_perfil_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_plev_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_plev_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_plev_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_plev_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_plev_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_plev_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_plpa_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_plpa_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_plpa_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltf_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltf_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltf_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltf_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltf_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltf_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltf_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltf_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltf_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltm_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltm_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltm_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltm_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltm_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltm_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltp_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltp_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltp_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pltp_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pltp_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pltp_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar analise SWOT "Planejamento 2026"'; r.esperado:='Matriz criada';
  v_id := public.qa_nova_swot('[QA] Planejamento 2026');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Matriz SWOT criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar SWOT sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.estrategia_swot (tenant_id, titulo) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU SWOT sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_swot_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_swot_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_swot_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 64 casos.

-- Organograma (6 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('ORG-001', 'Criar um no do organograma', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de um no do organograma (um cargo ou funcao na estrutura). Regra: um no tem um titulo e representa uma posicao na hierarquia. Importa porque o organograma desenha quem responde a quem — base para entender a cadeia de comando e responsabilidades de SST (quem e responsavel por cada area).', 'Usuario com permissao de editar a estrutura organizacional.', '[{"acao": "Abrir o organograma", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Estrutura Organizacional > Organograma", "resultado_esperado": "Tela do organograma exibida"}, {"acao": "Adicionar um no", "dados": "Titulo: Diretor Geral", "ordem": 2, "onde_na_tela": "Botao Adicionar No (ou Novo Cargo na estrutura)", "resultado_esperado": "Campo aceita o titulo"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Confirmar/Salvar", "resultado_esperado": "O no Diretor Geral aparece no organograma"}]', 'O no Diretor Geral existe no organograma do cliente.', 'IMPACTO SE FALHAR: sem criar nos, nao ha como desenhar a estrutura hierarquica — a cadeia de comando e as responsabilidades por area ficam indefinidas.', 'api', NULL, 'em_triagem', NULL),
    ('ORG-002', 'Montar hierarquia (no pai e no filho)', 'feliz', 'alta', 'aprovado', 'Verificar que um no pode apontar para outro como PAI, formando a hierarquia. Regra: parent_id liga um no ao seu superior — assim se monta a arvore (ex.: Gerente responde ao Diretor). Importa porque a relacao pai-filho e o que transforma uma lista de cargos em um organograma de verdade.', 'Precisa existir pelo menos um no para servir de pai.', '[{"acao": "Criar o no superior (o pai)", "dados": "Titulo: Diretor", "ordem": 1, "onde_na_tela": "Organograma > Adicionar No", "resultado_esperado": "No Diretor criado"}, {"acao": "Criar um no subordinado, indicando o Diretor como pai", "dados": "Titulo: Gerente | Superior: Diretor", "ordem": 2, "onde_na_tela": "Adicionar No > campo Superior/Pai", "resultado_esperado": "O Gerente e criado abaixo do Diretor"}, {"acao": "Conferir a hierarquia", "dados": "-", "ordem": 3, "onde_na_tela": "Visualizacao do organograma", "resultado_esperado": "O Gerente aparece ligado abaixo do Diretor na arvore"}]', 'O no Gerente tem o Diretor como pai. O organograma mostra a ligacao hierarquica entre eles.', 'IMPACTO SE FALHAR: sem a relacao pai-filho, os cargos existem soltos, sem hierarquia — o organograma nao representa a cadeia de comando real.', 'api', NULL, 'em_triagem', NULL),
    ('ORG-003', 'Ligar um no a um cargo existente', 'feliz', 'media', 'aprovado', 'Verificar que um no do organograma pode referenciar um cargo existente do cadastro. Regra: o no pode se ligar a um cargo ja cadastrado, conectando a estrutura visual ao cadastro de cargos. Importa porque evita redigitar — o organograma reaproveita os cargos que ja existem, mantendo tudo consistente.', 'Precisa existir um cargo cadastrado no modulo de Cargos.', '[{"acao": "Adicionar um no ao organograma", "dados": "Titulo: Analista", "ordem": 1, "onde_na_tela": "Organograma > Adicionar No", "resultado_esperado": "No criado"}, {"acao": "Ligar o no a um cargo existente", "dados": "Cargo: Analista de RH (um cargo ja cadastrado)", "ordem": 2, "onde_na_tela": "Propriedades do no > campo Cargo", "resultado_esperado": "O no passa a referenciar o cargo"}, {"acao": "Conferir a ligacao", "dados": "-", "ordem": 3, "onde_na_tela": "Propriedades do no", "resultado_esperado": "O no aparece vinculado ao cargo Analista de RH"}]', 'O no do organograma esta ligado ao cargo Analista de RH do cadastro. A estrutura visual e o cadastro de cargos ficam conectados.', 'IMPACTO SE FALHAR: se o no nao pudesse referenciar um cargo, o organograma viraria uma estrutura paralela desconectada do cadastro — duas fontes de verdade que divergem.', 'api', NULL, 'em_triagem', NULL),
    ('ORG-010', 'Titulo vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um no sem titulo e recusado. Regra: titulo e NOT NULL. Importa porque um no sem titulo aparece em branco no organograma e nao representa nenhuma posicao identificavel.', 'Nenhuma.', '[{"acao": "Abrir o organograma e adicionar um no", "dados": "-", "ordem": 1, "onde_na_tela": "Organograma > Adicionar No", "resultado_esperado": "Formulario do no aberto"}, {"acao": "Deixar o titulo vazio e tentar salvar", "dados": "Titulo: (vazio)", "ordem": 2, "onde_na_tela": "Campo Titulo (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar — titulo e obrigatorio"}]', 'O no sem titulo e recusado. Nenhum no em branco entra no organograma.', 'IMPACTO SE FALHAR: nos em branco poluem o organograma e nao representam posicao nenhuma — a estrutura fica com caixas vazias sem sentido.', 'api', NULL, 'em_triagem', NULL),
    ('ORG-013', 'Apagar no do meio promove os filhos (nao apaga a subarvore)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar um no do MEIO da hierarquia promove os filhos, em vez de destruir toda a subarvore. Regra: parent_id ON DELETE SET NULL — quando o pai e apagado, os filhos perdem o pai (viram raiz ou orfaos) mas SOBREVIVEM. Importa porque apagar um cargo intermediario (ex.: um nivel de gerencia extinto) nao deveria apagar todos os subordinados abaixo dele.', 'Precisa existir uma hierarquia de 3 niveis: avo > pai > filho (para apagar o pai do meio e ver o que acontece com o filho).', '[{"acao": "Montar uma hierarquia de 3 niveis", "dados": "Diretor (topo) > Gerente (meio) > Analista (base), cada um filho do anterior", "ordem": 1, "onde_na_tela": "Organograma", "resultado_esperado": "Arvore de 3 niveis montada"}, {"acao": "Apagar o no do MEIO (o Gerente)", "dados": "-", "ordem": 2, "onde_na_tela": "Organograma > no Gerente > Excluir", "resultado_esperado": "O Gerente e apagado"}, {"acao": "Conferir o que aconteceu com o Analista (o filho)", "dados": "-", "ordem": 3, "onde_na_tela": "Organograma", "resultado_esperado": "O Analista AINDA EXISTE, agora sem o Gerente como pai (foi promovido/desassociado, nao apagado)"}]', 'O no do meio (Gerente) e apagado, mas o filho (Analista) sobrevive, agora sem aquele pai. A subarvore nao foi destruida — os filhos foram promovidos (SET NULL).', 'IMPACTO SE FALHAR: se apagar um no do meio apagasse toda a subarvore, remover um nivel de gerencia extinto destruiria todos os cargos subordinados — perda catastrofica da estrutura. O SET NULL preserva os filhos, apenas os desconecta do pai removido.', 'api', NULL, 'em_triagem', NULL),
    ('ORG-022', 'No de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que um no do organograma de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque o organograma revela a estrutura interna e a cadeia de comando de um cliente — informacao estrategica que nao pode vazar.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar um no no organograma", "dados": "Titulo: Cargo Secreto do A", "ordem": 1, "onde_na_tela": "Cliente A > Organograma > Adicionar No", "resultado_esperado": "No criado no cliente A"}, {"acao": "Entrar como cliente B e procurar esse no", "dados": "Procurar pelo titulo do no do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Organograma", "resultado_esperado": "O no do cliente A NAO aparece para o cliente B"}]', 'O no do cliente A e invisivel no cliente B. A estrutura organizacional de um cliente nao vaza para outro.', 'IMPACTO SE FALHAR: exporia a estrutura interna e a hierarquia de um cliente a outro — informacao estrategica sensivel. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/organograma'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();

-- Perfis de Acesso (5 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('PERFIL-001', 'Camada restritiva de leitura presente nas tabelas sensíveis', 'feliz', 'critica', 'aprovado', 'Garantir que as políticas perfil_restringe_leitura_* continuam existindo, como RESTRICTIVE e sobre SELECT, nas tabelas de dado sensível. É o alarme contra regressão da correção de 08/08.', 'Camada aplicada pelo script de 08/08/2026.', '[{"acao": "Varredura do catálogo (pg_policies)", "ordem": 1, "resultado_esperado": "As 7 tabelas sensíveis com política perfil_restringe_leitura_* RESTRICTIVE em SELECT"}]', 'Todas as políticas presentes.', NULL, 'api', 'LGPD, arts. 46 e 47 (medidas de segurança); art. 11 (dado de saúde)', 'em_triagem', NULL),
    ('PERFIL-002', 'Funções de apoio do controle por perfil existem', 'feliz', 'critica', 'aprovado', 'perfil_permite_modulo, cpf_do_usuario_logado e perfil_padrao_colaborador precisam existir: as políticas dependem delas.', 'Correções de 08/08/2026 aplicadas.', '[{"acao": "Consultar o catálogo de funções", "ordem": 1, "resultado_esperado": "As três funções presentes"}]', 'Três funções presentes.', NULL, 'api', 'LGPD, arts. 46 e 47', 'em_triagem', NULL),
    ('PERFIL-003', 'Tabela sensível nova sem a camada de perfil é acusada', 'negativo', 'alta', 'aprovado', 'Detectar tabela de saúde/psicossocial/documento criada DEPOIS da camada e que ficou sem a política restritiva. É a regressão silenciosa mais provável: mesa nova, ninguém lembra da camada.', 'Nenhuma.', '[{"acao": "Varredura por padrão de nome (atestad%, %saude%, psicossocial%, documento%) com tenant_id e RLS", "ordem": 1, "resultado_esperado": "Todas com política perfil_restringe_leitura_* ou na lista de exceções documentadas"}]', 'Nenhuma tabela sensível descoberta sem camada.', NULL, 'api', 'LGPD, art. 46 (proteção desde a concepção)', 'em_triagem', NULL),
    ('PERFIL-004', 'Perfil restrito não obtém acesso amplo pela função de permissão', 'negativo', 'critica', 'aprovado', 'Teste funcional: simula (na transação, sem escrever nada) um usuário sem acesso amplo à saúde e verifica que perfil_permite_modulo nega. Busca em três estágios: ativo com perfil restrito; ativo sem vínculo de perfil; colaborador com convite pendente sem vínculo.', 'Existir ao menos um usuário (em qualquer status) que não seja administrador/gestor nem tenha papel de gestão.', '[{"acao": "Escolher usuário: com perfil restrito; na falta, sem vínculo de perfil", "ordem": 1, "resultado_esperado": "Um usuário simulável encontrado"}, {"acao": "Simular claims e avaliar perfil_permite_modulo(tenant, atestados)", "ordem": 2, "resultado_esperado": "false"}]', 'Função nega acesso amplo ao perfil restrito.', NULL, 'api', 'LGPD, arts. 46 e 47; art. 11', 'em_triagem', NULL),
    ('PERFIL-005', 'Perfil padrão automático ativo para cadastro sem perfil', 'feliz', 'alta', 'aprovado', 'Os dois gatilhos do perfil padrão (vincular no cadastro sem perfil; substituir quando um perfil de verdade chega) precisam estar habilitados.', 'Correção de 08/08/2026 aplicada.', '[{"acao": "Consultar pg_trigger", "ordem": 1, "resultado_esperado": "trigger_vincular_perfil_padrao e trigger_substituir_perfil_padrao habilitados"}]', 'Dois gatilhos habilitados.', NULL, 'api', 'LGPD, art. 6º, III (necessidade)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'seguranca-acesso/perfis'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();

-- Planejamento Estratégico (34 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('OCEANO-001', 'Criar uma analise Oceano Azul', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de uma analise Oceano Azul. Regra: a matriz Oceano Azul tem um titulo e organiza acoes nos 4 quadrantes ERRC. Importa porque o Oceano Azul e a ferramenta de estrategia para criar novos espacos de mercado — complementa a SWOT.', 'Usuario com acesso ao planejamento estrategico.', '[{"acao": "Abrir o planejamento estrategico e criar uma analise Oceano Azul", "dados": "-", "ordem": 1, "onde_na_tela": "Planejamento Estrategico > Nova Analise Oceano Azul", "resultado_esperado": "Formulario aberto"}, {"acao": "Dar um titulo", "dados": "Titulo: Novo Mercado 2026", "ordem": 2, "onde_na_tela": "Campo Titulo", "resultado_esperado": "Campo aceito"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Matriz Oceano Azul criada"}]', 'A analise Oceano Azul Novo Mercado 2026 existe e esta pronta para receber itens.', 'IMPACTO SE FALHAR: sem a analise Oceano Azul, o cliente perde a ferramenta de estrategia para criar diferenciacao e novos espacos de mercado.', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-002', 'Adicionar itens nos 4 quadrantes ERRC', 'feliz', 'alta', 'aprovado', 'Verificar que os itens dos 4 quadrantes ERRC (Eliminar, Reduzir, Elevar, Criar) sao guardados. Regra: cada item pertence a um dos quatro quadrantes da matriz ERRC — a essencia do metodo Oceano Azul. Importa porque e o ERRC que estrutura a estrategia de diferenciacao (o que eliminar, reduzir, elevar e criar em relacao ao mercado).', 'Precisa existir uma matriz Oceano Azul criada.', '[{"acao": "Abrir a matriz e adicionar um item em cada quadrante ERRC", "dados": "Eliminar: Burocracia excessiva | Reduzir: Custo operacional | Elevar: Qualidade do atendimento | Criar: Servico inovador", "ordem": 1, "onde_na_tela": "Oceano Azul > adicionar item em cada quadrante", "resultado_esperado": "Os quatro itens sao adicionados nos quadrantes certos"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 2, "onde_na_tela": "Salvar > visualizar a matriz", "resultado_esperado": "Os 4 itens aparecem, um em cada quadrante ERRC"}]', 'A matriz Oceano Azul tem 4 itens, um em cada quadrante ERRC (eliminar, reduzir, elevar, criar).', 'IMPACTO SE FALHAR: se os quadrantes nao forem guardados corretamente, a matriz ERRC fica incompleta — a estrategia de diferenciacao perde a estrutura.', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-003', 'Oceano Azul nascido de uma SWOT', 'feliz', 'media', 'aprovado', 'Verificar que uma analise Oceano Azul pode NASCER de uma SWOT (referenciar a SWOT de origem). Regra: o Oceano pode apontar para uma SWOT via swot_id. Importa porque as duas ferramentas se conectam — o Oceano Azul aprofunda o diagnostico da SWOT, e essa ligacao mantem a linha de raciocinio estrategico.', 'Precisa existir uma SWOT para servir de origem.', '[{"acao": "Ter uma SWOT ja criada", "dados": "SWOT: Analise de origem", "ordem": 1, "onde_na_tela": "Planejamento Estrategico", "resultado_esperado": "SWOT existe"}, {"acao": "Criar um Oceano Azul indicando essa SWOT como origem", "dados": "Titulo: Oceano da Analise | SWOT de origem: Analise de origem", "ordem": 2, "onde_na_tela": "Nova Analise Oceano Azul > campo SWOT de origem", "resultado_esperado": "O Oceano e criado vinculado a SWOT"}, {"acao": "Conferir o vinculo", "dados": "-", "ordem": 3, "onde_na_tela": "Propriedades do Oceano", "resultado_esperado": "O Oceano aparece ligado a SWOT de origem"}]', 'O Oceano Azul referencia a SWOT de origem. As duas analises ficam conectadas.', 'IMPACTO SE FALHAR: sem o vinculo, o Oceano Azul viraria uma analise isolada, perdendo a conexao com o diagnostico da SWOT que o originou.', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-010', 'Titulo vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um Oceano Azul sem titulo e recusado. Regra: titulo e NOT NULL. Importa porque uma analise sem titulo nao pode ser identificada.', 'Nenhuma.', '[{"acao": "Iniciar uma nova analise Oceano Azul", "dados": "-", "ordem": 1, "onde_na_tela": "Planejamento Estrategico > Nova Analise Oceano Azul", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o titulo vazio e tentar salvar", "dados": "Titulo: (vazio)", "ordem": 2, "onde_na_tela": "Campo Titulo (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'O Oceano sem titulo e recusado. Nenhuma analise sem titulo e criada.', 'IMPACTO SE FALHAR: analises sem titulo ficam indistinguiveis numa lista.', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-011', 'Item com quadrante invalido e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um item do Oceano com quadrante invalido e recusado. Regra: quadrante so aceita eliminar, reduzir, elevar ou criar (enum ERRC). Importa porque um quadrante fora desses quebraria a estrutura da matriz ERRC.', 'Precisa existir uma matriz Oceano Azul.', '[{"acao": "Abrir uma matriz e tentar adicionar item com quadrante invalido", "dados": "Quadrante: manter (invalido — nao e ERRC) | Descricao: item invalido", "ordem": 1, "onde_na_tela": "Oceano Azul > adicionar item", "resultado_esperado": "O sistema DEVE recusar"}]', 'O item com quadrante manter e recusado. So os 4 quadrantes ERRC sao aceitos.', 'IMPACTO SE FALHAR: um quadrante invalido quebraria a estrutura ERRC — o item nao saberia em qual coluna aparecer.', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-013', 'Apagar a SWOT de origem desassocia o Oceano (SET NULL)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar a SWOT de origem apenas DESASSOCIA o Oceano, sem apaga-lo. Regra: swot_id ON DELETE SET NULL — o Oceano sobrevive sem a SWOT. Importa porque apagar a SWOT de origem nao deveria destruir a analise Oceano Azul que ja evoluiu por conta propria.', 'Precisa existir um Oceano Azul vinculado a uma SWOT de origem.', '[{"acao": "Ter um Oceano ligado a uma SWOT", "dados": "SWOT: Origem | Oceano: Oceano Orfao, ligado a Origem", "ordem": 1, "onde_na_tela": "Planejamento Estrategico", "resultado_esperado": "Oceano vinculado a SWOT"}, {"acao": "Apagar a SWOT de origem", "dados": "-", "ordem": 2, "onde_na_tela": "SWOT Origem > Excluir", "resultado_esperado": "SWOT apagada"}, {"acao": "Conferir o Oceano", "dados": "-", "ordem": 3, "onde_na_tela": "Oceano Orfao", "resultado_esperado": "O Oceano AINDA EXISTE, agora sem a SWOT de origem (desassociado, nao apagado)"}]', 'A SWOT de origem e apagada, mas o Oceano Azul sobrevive, agora sem vinculo. A analise nao foi destruida (SET NULL).', 'IMPACTO SE FALHAR: se apagar a SWOT apagasse o Oceano junto, perder-se-ia uma analise que ja tinha valor proprio. O SET NULL preserva o Oceano, so remove o vinculo.', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-014', 'Apagar a matriz Oceano apaga seus itens (CASCADE)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar a matriz Oceano apaga seus itens junto (CASCADE). Regra: oceano_id ON DELETE CASCADE — os itens nao existem sem a matriz. Importa porque um item ERRC solto, sem a matriz, seria lixo sem contexto.', 'Precisa existir um Oceano Azul com pelo menos um item.', '[{"acao": "Criar um Oceano com um item", "dados": "Oceano: Matriz Teste | Item: um item em Criar", "ordem": 1, "onde_na_tela": "Planejamento Estrategico", "resultado_esperado": "Item pertence a matriz"}, {"acao": "Apagar a matriz Oceano", "dados": "-", "ordem": 2, "onde_na_tela": "Oceano > Excluir", "resultado_esperado": "Matriz apagada"}, {"acao": "Conferir o item", "dados": "-", "ordem": 3, "onde_na_tela": "-", "resultado_esperado": "O item foi apagado JUNTO com a matriz"}]', 'A matriz Oceano e apagada e seus itens somem junto (CASCADE). Nenhum item orfao sobra.', 'IMPACTO SE FALHAR: itens ERRC orfaos seriam lixo sem contexto. O CASCADE mantem a limpeza. (Note o contraste com OCEANO-013: a SWOT de origem e SET NULL, mas os itens da propria matriz sao CASCADE — logicas diferentes para relacoes diferentes.)', 'api', NULL, 'em_triagem', NULL),
    ('OCEANO-022', 'Oceano de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que um Oceano Azul de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque a estrategia de diferenciacao de um cliente e sensivel e nao pode vazar.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar um Oceano Azul", "dados": "Titulo: Oceano secreto do cliente A", "ordem": 1, "onde_na_tela": "Cliente A > Planejamento Estrategico > Nova Analise Oceano Azul", "resultado_esperado": "Criado no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Procurar pelo Oceano do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Planejamento Estrategico", "resultado_esperado": "NAO aparece para o cliente B"}]', 'O Oceano do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia a estrategia de diferenciacao de um cliente a outro. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-001', 'Criar uma analise SWOT', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de uma analise SWOT. Regra: a matriz SWOT tem um titulo e reune forcas, fraquezas, oportunidades e ameacas. Importa porque a SWOT e a ferramenta base do diagnostico estrategico — orienta o planejamento a partir do cenario atual.', 'Usuario com acesso ao planejamento estrategico.', '[{"acao": "Abrir o planejamento estrategico e criar uma SWOT", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Planejamento e Gestao > Planejamento Estrategico > Nova Analise SWOT", "resultado_esperado": "Formulario de SWOT aberto"}, {"acao": "Dar um titulo a analise", "dados": "Titulo: Planejamento 2026", "ordem": 2, "onde_na_tela": "Campo Titulo", "resultado_esperado": "Campo aceito"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Matriz SWOT criada"}]', 'A analise SWOT Planejamento 2026 existe e esta pronta para receber itens.', 'IMPACTO SE FALHAR: sem criar a SWOT, nao ha diagnostico estrategico estruturado — o planejamento perde a ferramenta base de analise de cenario.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-002', 'Adicionar os 4 tipos de item (F/F/O/A)', 'feliz', 'alta', 'aprovado', 'Verificar que os 4 tipos de item da SWOT (forca, fraqueza, oportunidade, ameaca) sao guardados. Regra: cada item tem um tipo entre esses quatro, formando a matriz. Importa porque a SWOT so faz sentido com os quatro quadrantes preenchidos — e a essencia da ferramenta.', 'Precisa existir uma matriz SWOT criada.', '[{"acao": "Abrir a SWOT e adicionar um item de cada tipo", "dados": "Forca: Equipe qualificada | Fraqueza: Processos manuais | Oportunidade: Novo mercado | Ameaca: Concorrencia", "ordem": 1, "onde_na_tela": "SWOT > adicionar item em cada quadrante", "resultado_esperado": "Os quatro itens sao adicionados nos quadrantes certos"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 2, "onde_na_tela": "Salvar > visualizar a matriz", "resultado_esperado": "Os 4 itens aparecem, um em cada quadrante"}]', 'A SWOT tem 4 itens, um de cada tipo (forca, fraqueza, oportunidade, ameaca), nos quadrantes corretos.', 'IMPACTO SE FALHAR: se os tipos nao forem guardados corretamente, a matriz SWOT fica incompleta ou com itens no quadrante errado — o diagnostico perde o sentido.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-003', 'Editar o titulo da analise', 'feliz', 'media', 'aprovado', 'Verificar que o titulo de uma SWOT pode ser editado. Regra: a matriz e editavel. Importa porque analises sao renomeadas e revisadas ao longo do planejamento.', 'Precisa existir uma SWOT criada.', '[{"acao": "Abrir uma SWOT existente", "dados": "-", "ordem": 1, "onde_na_tela": "Planejamento Estrategico > abrir a SWOT", "resultado_esperado": "Titulo atual exibido"}, {"acao": "Alterar o titulo", "dados": "Novo titulo: Planejamento 2026 - Revisado", "ordem": 2, "onde_na_tela": "Campo Titulo", "resultado_esperado": "Campo aceita"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "O titulo novo esta gravado"}]', 'O titulo da SWOT e atualizado e persiste.', 'IMPACTO SE FALHAR: analises ficariam com titulos desatualizados apos revisoes.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-010', 'Titulo vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que uma SWOT sem titulo e recusada. Regra: titulo e NOT NULL. Importa porque uma analise sem titulo nao pode ser identificada entre varias.', 'Nenhuma.', '[{"acao": "Iniciar uma nova SWOT", "dados": "-", "ordem": 1, "onde_na_tela": "Planejamento Estrategico > Nova Analise SWOT", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o titulo vazio e tentar salvar", "dados": "Titulo: (vazio)", "ordem": 2, "onde_na_tela": "Campo Titulo (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'A SWOT sem titulo e recusada. Nenhuma analise sem titulo e criada.', 'IMPACTO SE FALHAR: analises sem titulo ficam indistinguiveis numa lista de varias SWOTs.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-011', 'Item com tipo invalido e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um item de SWOT com tipo invalido e recusado. Regra: tipo so aceita forca, fraqueza, oportunidade ou ameaca (enum). Importa porque um tipo fora desses quebraria a organizacao da matriz em quadrantes.', 'Precisa existir uma matriz SWOT.', '[{"acao": "Abrir uma SWOT e tentar adicionar um item com tipo invalido", "dados": "Tipo: neutro (invalido — nao e um dos 4) | Descricao: item invalido", "ordem": 1, "onde_na_tela": "SWOT > adicionar item", "resultado_esperado": "O sistema DEVE recusar o tipo fora da lista"}]', 'O item com tipo neutro e recusado. So os 4 tipos validos sao aceitos.', 'IMPACTO SE FALHAR: um tipo invalido quebraria a organizacao da matriz em quadrantes — o item nao saberia onde aparecer.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-013', 'Apagar a matriz apaga os itens (CASCADE)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar a matriz SWOT apaga seus itens junto (CASCADE). Regra: ON DELETE CASCADE — os itens nao existem sem a matriz. Importa porque um item de SWOT solto, sem a matriz a que pertence, seria lixo sem contexto.', 'Precisa existir uma SWOT com pelo menos um item.', '[{"acao": "Criar uma SWOT com um item", "dados": "SWOT: Analise Teste | Item: uma forca qualquer", "ordem": 1, "onde_na_tela": "Planejamento Estrategico", "resultado_esperado": "Item pertence a matriz"}, {"acao": "Apagar a matriz SWOT", "dados": "-", "ordem": 2, "onde_na_tela": "SWOT > Excluir analise", "resultado_esperado": "Matriz apagada"}, {"acao": "Conferir o item", "dados": "-", "ordem": 3, "onde_na_tela": "-", "resultado_esperado": "O item foi apagado JUNTO com a matriz (nao sobra orfao)"}]', 'A matriz SWOT e apagada e seus itens somem junto (CASCADE). Nenhum item orfao sobra.', 'IMPACTO SE FALHAR: itens de SWOT orfaos (sem matriz) seriam lixo sem contexto na base. O CASCADE mantem a limpeza.', 'api', NULL, 'em_triagem', NULL),
    ('SWOT-022', 'SWOT de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que uma SWOT de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque o diagnostico estrategico (forcas, fraquezas) de um cliente e altamente sensivel e nao pode vazar.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar uma SWOT", "dados": "Titulo: SWOT secreta do cliente A", "ordem": 1, "onde_na_tela": "Cliente A > Planejamento Estrategico > Nova SWOT", "resultado_esperado": "Criada no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Procurar pela SWOT do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Planejamento Estrategico", "resultado_esperado": "NAO aparece para o cliente B"}]', 'A SWOT do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia o diagnostico estrategico (forcas, fraquezas, ameacas) de um cliente a outro — informacao muito sensivel. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-001', 'CT-SWOT-001 — Listar SWOTs do escopo', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-002', 'CT-SWOT-002 — Estado vazio', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-003', 'CT-SWOT-003 — Troca de escopo', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-004', 'CT-SWOT-004 — Abrir SWOT clicando no card', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-005', 'CT-SWOT-010 — Criar SWOT (caminho feliz)', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-006', 'CT-SWOT-011 — Título obrigatório', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-007', 'CT-SWOT-012 — Período inválido (formato)', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-008', 'CT-SWOT-013 — Fechar modal com dados preenchidos', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-009', 'CT-SWOT-014 — Duplo clique no Criar Análise', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-010', 'CT-SWOT-020 — Adicionar item em Força', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-011', 'CT-SWOT-021 — Adicionar item em cada quadrante', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-012', 'CT-SWOT-022 — Campos obrigatórios para item (descrição vazia)', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-013', 'CT-SWOT-023 — Limites de texto (BVA)', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-014', 'CT-SWOT-024 — Excluir item', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-015', 'CT-SWOT-025 — Excluir SWOT', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-016', 'CT-SWOT-026 — Voltar da tela de detalhe', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-017', 'CT-SWOT-027 — Concorrência: adicionar itens em sequência rápida', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-018', 'CT-SWOT-028 — Concorrência: exclusão de item já removido (graceful)', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-SWOT-019', 'CT-SWOT-029 — Resiliência: UI não trava após operações', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/swot.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'planejamento-gestao/planejamento-estrategico'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();

-- Plano de Ação (19 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('ACAO-001', 'Criar plano de acao (5W2H)', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de uma acao no formato 5W2H (o que, por que, onde, quando, quem, como, quanto). Regra: uma acao tem codigo, titulo e os campos do 5W2H. Importa porque o plano de acao e o instrumento que transforma um problema identificado em execucao concreta — e a saida pratica de auditorias, inspecoes e analises de risco.', 'Usuario com permissao de criar acoes.', '[{"acao": "Abrir o cadastro de acao", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Planejamento e Gestao > Plano de Acao > Nova Acao", "resultado_esperado": "Formulario 5W2H aberto"}, {"acao": "Preencher os campos do 5W2H", "dados": "O que: Instalar guarda-corpo | Por que: Risco de queda | Onde: Mezanino | Quando: daqui a 30 dias | Como: Contratar serralheria", "ordem": 2, "onde_na_tela": "Campos O que (titulo), Por que, Onde, Quando (prazo), Como", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Acao criada com status pendente e progresso 0"}]', 'A acao Instalar guarda-corpo existe, com os campos 5W2H preenchidos, pronta para ser executada e acompanhada.', 'IMPACTO SE FALHAR: sem criar acoes, os problemas identificados em auditorias e inspecoes nao viram execucao — o sistema aponta riscos mas nada e feito a respeito.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-002', 'Adicionar tarefas ao plano', 'feliz', 'alta', 'aprovado', 'Verificar que tarefas podem ser vinculadas a uma acao. Regra: uma acao se desdobra em tarefas menores, cada uma com seu responsavel. Importa porque acoes complexas precisam ser quebradas em passos executaveis — e assim que a execucao realmente acontece.', 'Precisa existir uma acao cadastrada.', '[{"acao": "Abrir uma acao e ir as tarefas", "dados": "-", "ordem": 1, "onde_na_tela": "Plano de Acao > abrir a acao > aba Tarefas > Adicionar", "resultado_esperado": "Formulario de tarefa aberto"}, {"acao": "Adicionar tres tarefas", "dados": "T1: Cotar fornecedor | T2: Aprovar orcamento | T3: Executar instalacao", "ordem": 2, "onde_na_tela": "Campo Titulo da tarefa", "resultado_esperado": "As tres tarefas sao aceitas"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > aba Tarefas", "resultado_esperado": "As 3 tarefas aparecem vinculadas a acao"}]', 'A acao tem 3 tarefas vinculadas, formando o roteiro de execucao.', 'IMPACTO SE FALHAR: sem tarefas, acoes complexas ficam como um bloco unico sem passos claros — dificulta a delegacao e o acompanhamento da execucao.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-003', 'Priorizacao GUT calcula a pontuacao automaticamente', 'feliz', 'alta', 'aprovado', 'Verificar que a pontuacao GUT e calculada automaticamente pelo sistema (gravidade x urgencia x tendencia). Regra: pontuacao_gut e uma coluna GENERATED — o proprio banco multiplica os tres fatores, ninguem digita o resultado. Importa porque a priorizacao GUT define a ordem de execucao das acoes; se o calculo pudesse ser digitado errado, a fila de prioridade ficaria distorcida.', 'Formulario de acao com os campos de priorizacao GUT.', '[{"acao": "Abrir nova acao e ir a priorizacao GUT", "dados": "-", "ordem": 1, "onde_na_tela": "Nova Acao > secao Priorizacao (GUT)", "resultado_esperado": "Campos Gravidade, Urgencia e Tendencia disponiveis"}, {"acao": "Informar os tres fatores", "dados": "Gravidade: 5 | Urgencia: 4 | Tendencia: 3", "ordem": 2, "onde_na_tela": "Campos Gravidade, Urgencia, Tendencia", "resultado_esperado": "Os tres valores sao aceitos"}, {"acao": "Salvar e conferir a pontuacao", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > ver a pontuacao GUT da acao", "resultado_esperado": "A pontuacao aparece como 60 (5 x 4 x 3), calculada automaticamente"}]', 'A pontuacao GUT da acao e 60, resultado de 5 x 4 x 3, calculada pelo sistema sem digitacao manual.', 'IMPACTO SE FALHAR: se a pontuacao nao fosse calculada automaticamente, um valor digitado errado distorceria a fila de prioridade — acoes criticas poderiam ficar atras de acoes menores. A coluna GENERATED garante o calculo correto sempre.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-010', 'Titulo vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que uma acao sem titulo e recusada. Regra: titulo e NOT NULL — e o "o que" do 5W2H. Importa porque uma acao sem titulo nao diz o que precisa ser feito.', 'Nenhuma.', '[{"acao": "Abrir nova acao", "dados": "-", "ordem": 1, "onde_na_tela": "Plano de Acao > Nova Acao", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o titulo (o que) vazio e tentar salvar", "dados": "Titulo: (vazio)", "ordem": 2, "onde_na_tela": "Campo O que / Titulo (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'A acao sem titulo e recusada. Nenhuma acao em branco entra no plano.', 'IMPACTO SE FALHAR: acoes sem titulo aparecem em branco no plano e ninguem sabe o que deve ser executado.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-011', 'GUT fora de 1-5 e recusado', 'excecao', 'alta', 'aprovado', 'Verificar que valores de GUT fora da faixa 1-5 sao recusados. Regra: gravidade, urgencia e tendencia sao notas de 1 a 5 (CHECK BETWEEN 1 AND 5). Importa porque a escala GUT e padronizada; um valor fora dela distorceria a pontuacao (que multiplica os tres) e quebraria a comparabilidade entre acoes.', 'Formulario de acao com os campos GUT.', '[{"acao": "Abrir nova acao e ir a priorizacao GUT", "dados": "-", "ordem": 1, "onde_na_tela": "Nova Acao > secao Priorizacao (GUT)", "resultado_esperado": "Campos GUT disponiveis"}, {"acao": "Tentar uma gravidade fora da escala", "dados": "Gravidade: 9 (fora da escala 1-5)", "ordem": 2, "onde_na_tela": "Campo Gravidade", "resultado_esperado": "O sistema DEVE recusar — a escala GUT vai de 1 a 5"}]', 'A gravidade 9 e recusada. So notas de 1 a 5 sao aceitas nos tres fatores GUT.', 'IMPACTO SE FALHAR: uma nota fora da escala distorceria a pontuacao GUT (que multiplica os tres fatores) e quebraria a comparabilidade da fila de prioridades.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-012', 'Tipo invalido e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um tipo de acao invalido e recusado. Regra: tipo so aceita corretiva, preventiva ou melhoria. Importa porque o tipo classifica a natureza da acao — corrigir algo que deu errado, prevenir um risco ou melhorar o que ja funciona — e orienta relatorios de gestao.', 'Formulario de acao com o campo tipo.', '[{"acao": "Abrir nova acao", "dados": "-", "ordem": 1, "onde_na_tela": "Plano de Acao > Nova Acao > campo Tipo", "resultado_esperado": "Campo tipo disponivel"}, {"acao": "Tentar um tipo fora da lista", "dados": "Tipo: urgente (invalido — nao e corretiva/preventiva/melhoria)", "ordem": 2, "onde_na_tela": "Campo Tipo", "resultado_esperado": "O sistema DEVE recusar"}]', 'O tipo urgente e recusado. So corretiva, preventiva ou melhoria sao aceitos.', 'IMPACTO SE FALHAR: tipo invalido quebraria os relatorios que classificam acoes por natureza (quantas sao corretivas vs preventivas — indicador de maturidade em SST).', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-013', 'Progresso fora de 0-100 e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um progresso fora da faixa 0-100 e recusado numa acao. Regra: progresso e porcentagem e tem CHECK BETWEEN 0 AND 100 nesta tabela. Importa porque progresso impossivel quebraria barras e medias — e este modulo TEM a protecao no banco.', 'Formulario de acao com o campo progresso.', '[{"acao": "Abrir uma acao (nova ou existente)", "dados": "-", "ordem": 1, "onde_na_tela": "Plano de Acao > Nova Acao ou abrir uma existente", "resultado_esperado": "Campo progresso disponivel"}, {"acao": "Tentar um progresso absurdo", "dados": "Progresso: 150 (fora da faixa 0-100)", "ordem": 2, "onde_na_tela": "Campo Progresso", "resultado_esperado": "O sistema DEVE recusar — progresso e porcentagem"}]', 'O progresso 150 e RECUSADO. O banco tem CHECK (progresso BETWEEN 0 AND 100) nesta tabela e ele funciona.', 'IMPACTO SE FALHAR: progresso impossivel quebraria barras de progresso e medias de execucao do plano. CONTRASTE IMPORTANTE: este caso PASSA (o CHECK existe aqui), mas o caso equivalente em Metas (META-012) FALHA — la o mesmo CHECK nao foi aplicado. Mesma regra, dois modulos, comportamentos opostos: evidencia de que a equipe conhece a boa pratica (esta implementada aqui) mas nao a replicou de forma consistente.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-014', 'Apagar a acao apaga as tarefas (CASCADE)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar uma acao apaga suas tarefas junto (CASCADE). Regra: acao_id ON DELETE CASCADE — uma tarefa nao existe sem a acao a que pertence. Importa porque tarefas orfas seriam passos sem objetivo, lixo sem contexto.', 'Precisa existir uma acao com pelo menos uma tarefa.', '[{"acao": "Criar uma acao com uma tarefa", "dados": "Acao: Acao Teste | Tarefa: uma tarefa qualquer", "ordem": 1, "onde_na_tela": "Plano de Acao", "resultado_esperado": "Tarefa pertence a acao"}, {"acao": "Apagar a acao", "dados": "-", "ordem": 2, "onde_na_tela": "Plano de Acao > abrir a acao > Excluir", "resultado_esperado": "Acao apagada"}, {"acao": "Conferir a tarefa", "dados": "-", "ordem": 3, "onde_na_tela": "-", "resultado_esperado": "A tarefa foi apagada JUNTO com a acao (nao sobra orfa)"}]', 'A acao e apagada e suas tarefas somem junto (CASCADE). Nenhuma tarefa orfa sobra.', 'IMPACTO SE FALHAR: tarefas orfas seriam passos de execucao sem acao a que pertencem — apareceriam em listas de pendencias sem fazer sentido. O CASCADE mantem a limpeza.', 'api', NULL, 'em_triagem', NULL),
    ('ACAO-022', 'Acao de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que uma acao de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque o plano de acao revela os problemas identificados e as pendencias de SST de um cliente — informacao sensivel, inclusive do ponto de vista legal.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar uma acao", "dados": "Titulo: Acao secreta do cliente A", "ordem": 1, "onde_na_tela": "Cliente A > Plano de Acao > Nova Acao", "resultado_esperado": "Criada no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Procurar pela acao do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Plano de Acao", "resultado_esperado": "NAO aparece para o cliente B"}]', 'A acao do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia os problemas de SST identificados e as pendencias de um cliente a outro — informacao sensivel com implicacoes legais. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL),
    ('PLEV-001', 'Anexar evidência à ação e à tarefa', 'feliz', 'media', 'aprovado', 'A evidência comprova a execução — pode pertencer só à ação ou descer ao detalhe da tarefa. Precisa gravar com título e reler vinculada ao lugar certo.', 'Ação com uma tarefa.', '[{"acao": "Anexar evidência à ação", "ordem": 1, "resultado_esperado": "Gravada com titulo, sem tarefa"}, {"acao": "Anexar evidência à tarefa", "ordem": 2, "resultado_esperado": "Gravada apontando ação e tarefa"}]', 'Evidência gravada no nível certo, com título.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PLEV-010', 'Evidência com tarefa de outra ação é recusada', 'negativo', 'media', 'aprovado', 'acao_id e tarefa_id são FKs independentes: nada exige que a tarefa apontada pertença à ação apontada. Uma evidência da ação A "comprovando" tarefa da ação B contamina os dois relatórios.', 'Duas ações, a segunda com uma tarefa.', '[{"acao": "Gravar evidência com acao_id da A e tarefa_id da B", "ordem": 1, "resultado_esperado": "Recusado — a tarefa precisa pertencer à ação"}]', 'Evidência coerente entre ação e tarefa.', 'Provável ACHADO. Correção: trigger conferindo plano_tarefas.acao_id = NEW.acao_id.', 'api', NULL, 'em_triagem', NULL),
    ('PLPA-001', 'Adicionar participantes à ação, sem duplicata', 'feliz', 'media', 'aprovado', 'A ação compartilhada tem participantes com tipo de envolvimento (co-responsável, consulta, validação, apoio). O UNIQUE (acao_id, usuario_id) impede a mesma pessoa duas vezes — as duas coisas num caso só.', 'Ação criada; usuário disponível para o vínculo.', '[{"acao": "Adicionar um participante co-responsável", "ordem": 1, "resultado_esperado": "Vínculo gravado com o tipo"}, {"acao": "Adicionar a mesma pessoa de novo", "ordem": 2, "resultado_esperado": "Recusado pelo UNIQUE"}]', 'Participante entra uma única vez, com o tipo registrado.', 'O campo tipo é texto livre — mesmo padrão já documentado em OBRG-020; não gera caso próprio.', 'api', NULL, 'em_triagem', NULL),
    ('PLTF-001', 'Concluir tarefas atualiza a ação sozinho', 'feliz', 'critica', 'aprovado', 'O trigger atualizar_progresso_acao é o motor do módulo: a cada tarefa concluída, recalcula o progresso da ação (concluídas/total), deriva o status e carimba a data de conclusão quando fecha. É a garantia que falta em Metas (MCHK-002) e que aqui EXISTE — este caso a protege contra regressão.', 'Ação com duas tarefas não iniciadas.', '[{"acao": "Concluir a primeira tarefa", "ordem": 1, "resultado_esperado": "Ação vai a 50% e status em_andamento, sem nenhum comando extra"}, {"acao": "Concluir a segunda", "ordem": 2, "resultado_esperado": "Ação a 100%, status concluida, data_conclusao preenchida"}]', 'A ação acompanha as tarefas por conta própria, em qualquer rota de entrada.', 'Referência de boa prática para a correção sugerida em MCHK-002 (Metas).', 'api', NULL, 'em_triagem', NULL),
    ('PLTF-010', 'Dependência circular entre tarefas é recusada', 'negativo', 'alta', 'aprovado', 'depende_de é FK para a própria tabela, sem checagem de ciclo. A depende de B e B depende de A trava as duas para sempre — nenhuma pode começar porque a outra não terminou. Qualquer tela de ordenação por dependência entra em loop.', 'Ação com duas tarefas.', '[{"acao": "Fazer a tarefa A depender da B", "ordem": 1, "resultado_esperado": "Aceito — dependência simples é legítima"}, {"acao": "Fazer a B depender da A", "ordem": 2, "resultado_esperado": "Recusado — fecharia o ciclo"}]', 'Ciclo de dependência não entra.', 'Provável ACHADO. Correção: trigger que percorre a cadeia de depende_de antes de gravar.', 'api', NULL, 'em_triagem', NULL),
    ('PLTF-011', 'Tarefa não pode depender de tarefa de outra ação', 'negativo', 'media', 'aprovado', 'A FK de depende_de não exige a mesma acao_id. Uma tarefa presa a outra de ação diferente cria um acoplamento invisível: a ação A não anda porque algo na ação B não terminou, e nenhuma tela mostra o porquê.', 'Duas ações, cada uma com uma tarefa.', '[{"acao": "Fazer a tarefa da ação A depender da tarefa da ação B", "ordem": 1, "resultado_esperado": "Recusado — dependência confinada à ação"}]', 'Dependência não cruza ações.', 'Mesma família de PDOC-010 (Hub). Correção: trigger conferindo a acao_id da dependência.', 'api', NULL, 'em_triagem', NULL),
    ('PLTM-001', 'Apontar tempo trabalhado na tarefa', 'feliz', 'baixa', 'aprovado', 'O apontamento registra quem trabalhou, em quê, de quando a quando e a duração. Alimenta o tempo_gasto e qualquer análise de esforço do plano.', 'Ação com tarefa; usuário disponível.', '[{"acao": "Registrar apontamento com início, fim e duração", "ordem": 1, "resultado_esperado": "Linha gravada com os três campos e a descrição"}]', 'Apontamento gravado por inteiro.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PLTM-010', 'Apontamento com fim antes do início', 'negativo', 'media', 'aprovado', 'Nem inicio/fim nem duracao_minutos têm CHECK. Fim antes do início (ou duração negativa) cria tempo negativo que, somado, REDUZ o esforço total do plano.', 'Ação criada; usuário disponível.', '[{"acao": "Registrar apontamento com fim uma hora antes do início e duração -60", "ordem": 1, "resultado_esperado": "Recusado — intervalo incoerente não é tempo trabalhado"}]', 'Só entra intervalo coerente e duração positiva.', 'Provável ACHADO — mesma família de ENQ-013, TAC-003, PROC-010 e CERT-010. Correção: CHECK (fim IS NULL OR fim >= inicio) e CHECK (duracao_minutos IS NULL OR duracao_minutos >= 0).', 'api', NULL, 'em_triagem', NULL),
    ('PLTP-001', 'Criar template de ação reutilizável', 'feliz', 'baixa', 'aprovado', 'O template guarda em JSONB a estrutura de uma ação padrão (título, tarefas) para instanciar depois. Precisa gravar com nome e estrutura e reler íntegro.', 'Cercado disponível.', '[{"acao": "Criar template com nome e estrutura de ação com duas tarefas", "ordem": 1, "resultado_esperado": "Template gravado; a estrutura relida bate com a gravada"}]', 'Template gravado e relido por inteiro.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PLTP-010', 'Template sem estrutura de ação não deveria entrar', 'negativo', 'baixa', 'aprovado', 'acao_template é JSONB NOT NULL, mas qualquer JSON serve — inclusive um escalar ou um objeto vazio. Template sem estrutura instanciável é um botão que não faz nada na tela de criar a partir de template.', 'Cercado disponível.', '[{"acao": "Criar template com acao_template = {} (objeto vazio)", "ordem": 1, "resultado_esperado": "Recusado — a estrutura precisa ter ao menos o título da ação"}]', 'Só entra template com estrutura mínima.', 'Provável ACHADO — mesma natureza de TAC-004 e MEVD-010: JSONB sem contrato. Correção: CHECK (acao_template ? ''titulo'') ou validação estruturada.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'planejamento-gestao/plano-de-acao'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();


-- (3) PONTES — 45 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('ORG-001', 'qa_caso_org_001', true),
    ('ORG-002', 'qa_caso_org_002', true),
    ('ORG-003', 'qa_caso_org_003', true),
    ('ORG-010', 'qa_caso_org_010', true),
    ('ORG-013', 'qa_caso_org_013', true),
    ('ORG-022', 'qa_caso_org_022', true),
    ('PERFIL-001', 'qa_caso_perfil_001', true),
    ('PERFIL-002', 'qa_caso_perfil_002', true),
    ('PERFIL-003', 'qa_caso_perfil_003', true),
    ('PERFIL-004', 'qa_caso_perfil_004', true),
    ('PERFIL-005', 'qa_caso_perfil_005', true),
    ('OCEANO-001', 'qa_caso_oceano_001', true),
    ('OCEANO-002', 'qa_caso_oceano_002', true),
    ('OCEANO-003', 'qa_caso_oceano_003', true),
    ('OCEANO-010', 'qa_caso_oceano_010', true),
    ('OCEANO-011', 'qa_caso_oceano_011', true),
    ('OCEANO-013', 'qa_caso_oceano_013', true),
    ('OCEANO-014', 'qa_caso_oceano_014', true),
    ('OCEANO-022', 'qa_caso_oceano_022', true),
    ('SWOT-001', 'qa_caso_swot_001', true),
    ('SWOT-002', 'qa_caso_swot_002', true),
    ('SWOT-003', 'qa_caso_swot_003', true),
    ('SWOT-010', 'qa_caso_swot_010', true),
    ('SWOT-011', 'qa_caso_swot_011', true),
    ('SWOT-013', 'qa_caso_swot_013', true),
    ('SWOT-022', 'qa_caso_swot_022', true),
    ('ACAO-001', 'qa_caso_acao_001', true),
    ('ACAO-002', 'qa_caso_acao_002', true),
    ('ACAO-003', 'qa_caso_acao_003', true),
    ('ACAO-010', 'qa_caso_acao_010', true),
    ('ACAO-011', 'qa_caso_acao_011', true),
    ('ACAO-012', 'qa_caso_acao_012', true),
    ('ACAO-013', 'qa_caso_acao_013', true),
    ('ACAO-014', 'qa_caso_acao_014', true),
    ('ACAO-022', 'qa_caso_acao_022', true),
    ('PLEV-001', 'qa_caso_plev_001', true),
    ('PLEV-010', 'qa_caso_plev_010', true),
    ('PLPA-001', 'qa_caso_plpa_001', true),
    ('PLTF-001', 'qa_caso_pltf_001', true),
    ('PLTF-010', 'qa_caso_pltf_010', true),
    ('PLTF-011', 'qa_caso_pltf_011', true),
    ('PLTM-001', 'qa_caso_pltm_001', true),
    ('PLTM-010', 'qa_caso_pltm_010', true),
    ('PLTP-001', 'qa_caso_pltp_001', true),
    ('PLTP-010', 'qa_caso_pltp_010', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 64, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('ACAO-001'), ('ACAO-002'), ('ACAO-003'), ('ACAO-010'), ('ACAO-011'), ('ACAO-012'), ('ACAO-013'), ('ACAO-014'), ('ACAO-022'), ('OCEANO-001'), ('OCEANO-002'), ('OCEANO-003'), ('OCEANO-010'), ('OCEANO-011'), ('OCEANO-013'), ('OCEANO-014'), ('OCEANO-022'), ('ORG-001'), ('ORG-002'), ('ORG-003'), ('ORG-010'), ('ORG-013'), ('ORG-022'), ('PERFIL-001'), ('PERFIL-002'), ('PERFIL-003'), ('PERFIL-004'), ('PERFIL-005'), ('PLEV-001'), ('PLEV-010'), ('PLPA-001'), ('PLTF-001'), ('PLTF-010'), ('PLTF-011'), ('PLTM-001'), ('PLTM-010'), ('PLTP-001'), ('PLTP-010'), ('SWOT-001'), ('SWOT-002'), ('SWOT-003'), ('SWOT-010'), ('SWOT-011'), ('SWOT-013'), ('SWOT-022'), ('TELA-SWOT-001'), ('TELA-SWOT-002'), ('TELA-SWOT-003'), ('TELA-SWOT-004'), ('TELA-SWOT-005'), ('TELA-SWOT-006'), ('TELA-SWOT-007'), ('TELA-SWOT-008'), ('TELA-SWOT-009'), ('TELA-SWOT-010'), ('TELA-SWOT-011'), ('TELA-SWOT-012'), ('TELA-SWOT-013'), ('TELA-SWOT-014'), ('TELA-SWOT-015'), ('TELA-SWOT-016'), ('TELA-SWOT-017'), ('TELA-SWOT-018'), ('TELA-SWOT-019')),
x AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM alvo) AS esperados,
    (SELECT count(*) FROM alvo a JOIN public.qa_casos_teste c ON c.codigo = a.codigo) AS casos_no_alvo,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_casos_teste c ON c.codigo = a.codigo
       JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NOT NULL) AS com_rotina,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_implementacoes i ON i.codigo = a.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NULL) AS ponte_orfa
)
SELECT esperados, casos_no_alvo, com_rotina, ponte_orfa,
       CASE WHEN casos_no_alvo = esperados AND ponte_orfa = 0
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
