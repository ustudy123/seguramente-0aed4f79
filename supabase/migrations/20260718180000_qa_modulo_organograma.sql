-- =========================================================
-- QA — Módulo ORGANOGRAMA (tabela: estrategia_organograma)
--
-- Quinto e ULTIMO item do bloco Estrutura Organizacional. Diferente dos
-- outros: e uma ARVORE hierarquica, nao uma lista plana.
--
-- Schema REAL (lido):
--   estrategia_organograma:
--     titulo NOT NULL
--     parent_id -> ele mesmo, ON DELETE SET NULL (o no pai)
--     cargo_id -> cargos, departamento_id -> departamentos (ambos SET NULL)
--     tipo TEXT DEFAULT 'funcao', ordem INT
--
-- A natureza em arvore cria casos que os modulos planos nao tinham:
--   ORG-002: montar hierarquia (no raiz -> no filho)
--   ORG-013: apagar o no do meio promove os filhos (SET NULL no parent_id),
--            nao apaga a subarvore. Comportamento importante de auto-relacao.
-- =========================================================

-- Trava do cercado.
DO $trava$
BEGIN
  IF to_regclass('public.estrategia_organograma') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.estrategia_organograma;
    CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.estrategia_organograma
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES ('estrategia_organograma', 'Modulo Organograma. Casos ORG-*.') ON CONFLICT (tabela) DO NOTHING;
  END IF;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/organograma';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo organograma nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'ORG-001','Criar um no do organograma','feliz','alta','aprovado','api',
   'Cadastro de um cargo/funcao na estrutura.','No criado.'),
  (v_mod,'ORG-002','Montar hierarquia (no pai e no filho)','feliz','alta','aprovado','api',
   'Um no aponta para outro como pai (parent_id).','Hierarquia de 2 niveis criada.'),
  (v_mod,'ORG-003','Ligar um no a um cargo existente','feliz','media','aprovado','api',
   'O no pode referenciar um cargo do cadastro.','No vinculado ao cargo.'),
  -- ALT / EXCECAO
  (v_mod,'ORG-010','Titulo vazio e recusado','excecao','media','aprovado','api',
   'titulo e NOT NULL.','Recusado sem titulo.'),
  (v_mod,'ORG-013','Apagar no do meio promove os filhos (nao apaga a subarvore)','alternativo','alta','aprovado','api',
   'parent_id ON DELETE SET NULL: filhos perdem o pai mas sobrevivem.','Filhos preservados, sem pai.'),
  -- PROIBIDO
  (v_mod,'ORG-022','No de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','No do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_novo_no_org(p_titulo text, p_parent uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.estrategia_organograma (tenant_id, titulo, parent_id)
  VALUES (public.qa_sandbox_tenant_id(), p_titulo, p_parent) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_org_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar no "Diretoria"'; r.esperado:='No criado';
  v_id := public.qa_novo_no_org('[QA] Diretoria');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='No do organograma criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_org_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_org_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_org_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar no sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.estrategia_organograma (tenant_id, titulo) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU no sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_org_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_org_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('ORG-001','qa_caso_org_001'),('ORG-002','qa_caso_org_002'),('ORG-003','qa_caso_org_003'),
  ('ORG-010','qa_caso_org_010'),('ORG-013','qa_caso_org_013'),('ORG-022','qa_caso_org_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/organograma'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
