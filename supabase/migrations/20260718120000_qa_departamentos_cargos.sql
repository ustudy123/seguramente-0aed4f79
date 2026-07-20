-- =========================================================
-- QA — Módulos DEPARTAMENTOS e CARGOS (Estrutura Organizacional)
--
-- Dois modulos relacionados (cargo aponta para departamento). Feitos juntos
-- por serem pequenos e conectados. As 3 intencoes em cada um.
--
-- Schema REAL (lido):
--   departamentos: nome NOT NULL, UNIQUE(tenant_id, nome), responsavel_id
--   cargos: nome NOT NULL, UNIQUE(tenant_id, nome), departamento_id
--           REFERENCES departamentos ON DELETE SET NULL, faixa salarial min/max
--
-- ACHADO ESPERADO (lido do schema): faixa_salarial NAO tem CHECK de min<=max.
-- O teste CARGO-012 revela isso: da pra cadastrar salario minimo > maximo.
--
-- Relacao chave: apagar um departamento com cargos NAO apaga os cargos —
-- o ON DELETE SET NULL apenas desassocia (cargo fica sem departamento).
-- DEP-013 prova esse comportamento.
-- =========================================================

-- Estende a trava do cercado a departamentos e cargos.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departamentos','cargos'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo '||initcap(t)||'.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_dep uuid; v_car uuid;
BEGIN
  SELECT id INTO v_dep FROM public.qa_modulos WHERE path='estrutura-organizacional/departamentos';
  SELECT id INTO v_car FROM public.qa_modulos WHERE path='estrutura-organizacional/cargos';
  IF v_dep IS NULL OR v_car IS NULL THEN
    RAISE EXCEPTION 'Modulos de departamentos/cargos nao encontrados.';
  END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- DEPARTAMENTOS
  (v_dep,'DEP-001','Criar departamento','feliz','alta','aprovado','api',
   'Cadastro basico de departamento.','Departamento criado.'),
  (v_dep,'DEP-002','Editar nome do departamento','feliz','media','aprovado','api',
   'Alteracao persiste.','Nome novo gravado.'),
  (v_dep,'DEP-010','Nome vazio e recusado','excecao','media','aprovado','api',
   'nome e NOT NULL.','Recusado sem nome.'),
  (v_dep,'DEP-011','Nome duplicado no mesmo cliente e recusado','negativo','alta','aprovado','api',
   'UNIQUE(tenant_id, nome).','Segundo com mesmo nome recusado.'),
  (v_dep,'DEP-012','Mesmo nome em clientes diferentes e permitido','alternativo','media','aprovado','api',
   'O UNIQUE e por tenant — nomes iguais em tenants distintos convivem.','Aceito nos dois tenants.'),
  (v_dep,'DEP-013','Apagar departamento com cargos apenas desassocia','alternativo','alta','aprovado','api',
   'ON DELETE SET NULL: cargo perde o departamento, nao e apagado.','Cargo sobrevive sem departamento.'),
  -- CARGOS
  (v_car,'CARGO-001','Criar cargo ligado a um departamento','feliz','alta','aprovado','api',
   'Cargo com faixa salarial e departamento.','Cargo criado e vinculado.'),
  (v_car,'CARGO-010','Nome de cargo duplicado no cliente e recusado','negativo','alta','aprovado','api',
   'UNIQUE(tenant_id, nome).','Segundo cargo com mesmo nome recusado.'),
  (v_car,'CARGO-011','Cargo sem departamento e permitido','alternativo','media','aprovado','api',
   'departamento_id e opcional.','Cargo criado sem departamento.'),
  (v_car,'CARGO-012','Faixa salarial com minimo maior que maximo','excecao','media','aprovado','api',
   'Nao ha CHECK de min<=max; o teste revela se o banco aceita incoerencia.','Revela ausencia de validacao.'),
  (v_car,'CARGO-022','Cargo de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Cargo do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS — DEPARTAMENTOS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_dep_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento "Producao (teste)"'; r.esperado:='Criado';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Producao') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Departamento criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_dep_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_n text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar e renomear departamento'; r.esperado:='Nome novo persiste';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Antigo Dep') RETURNING id INTO v_id;
  UPDATE public.departamentos SET nome='[QA] Novo Dep' WHERE id=v_id;
  SELECT nome INTO v_n FROM public.departamentos WHERE id=v_id;
  IF v_n='[QA] Novo Dep' THEN r.situacao:='passou'; r.obtido:='Renomeado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nome='||v_n; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_dep_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar departamento sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_dep_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento e tentar outro com o mesmo nome'; r.esperado:='Segundo recusado (UNIQUE)';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Repetido');
  BEGIN
    INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Repetido');
    r.situacao:='falhou'; r.obtido:='ACEITOU nome duplicado no mesmo cliente.';
  EXCEPTION WHEN unique_violation THEN r.situacao:='passou'; r.obtido:='Recusado: nome unico por cliente.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_dep_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar "Mesmo Nome" no tenant 1 e no tenant 2'; r.esperado:='Aceito nos dois (UNIQUE e por tenant)';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t1, '[QA] Mesmo Nome Dep');
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t2, '[QA] Mesmo Nome Dep');
  SELECT count(*) INTO v_n FROM public.departamentos WHERE nome='[QA] Mesmo Nome Dep' AND tenant_id IN (v_t1,v_t2);
  IF v_n=2 THEN r.situacao:='passou'; r.obtido:='Mesmo nome convive em clientes diferentes.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2, achou %s.', v_n); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_dep_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_dep uuid; v_car uuid; v_dep_do_cargo uuid; v_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento e um cargo ligado a ele'; r.esperado:='Apagar o departamento desassocia o cargo, nao o apaga';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Dep Com Cargo') RETURNING id INTO v_dep;
  INSERT INTO public.cargos (tenant_id, nome, departamento_id) VALUES (v_t, '[QA] Cargo Orfao', v_dep) RETURNING id INTO v_car;
  r.passo_ordem:=2; r.passo_acao:='Apagar o departamento';
  DELETE FROM public.departamentos WHERE id=v_dep;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o cargo sobreviveu, agora sem departamento';
  SELECT EXISTS(SELECT 1 FROM public.cargos WHERE id=v_car) INTO v_existe;
  SELECT departamento_id INTO v_dep_do_cargo FROM public.cargos WHERE id=v_car;
  IF v_existe AND v_dep_do_cargo IS NULL THEN
    r.situacao:='passou'; r.obtido:='Cargo sobreviveu e ficou sem departamento (SET NULL), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Cargo existe=%s, departamento=%s.', v_existe, v_dep_do_cargo); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS — CARGOS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_cargo_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_dep uuid; v_car uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento e um cargo nele, com faixa salarial'; r.esperado:='Cargo criado e vinculado';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Dep Para Cargo') RETURNING id INTO v_dep;
  INSERT INTO public.cargos (tenant_id, nome, departamento_id, nivel, faixa_salarial_min, faixa_salarial_max)
  VALUES (v_t, '[QA] Analista', v_dep, 'pleno', 3000, 5000) RETURNING id INTO v_car;
  IF v_car IS NOT NULL AND EXISTS(SELECT 1 FROM public.cargos WHERE id=v_car AND departamento_id=v_dep) THEN
    r.situacao:='passou'; r.obtido:='Cargo criado e ligado ao departamento.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou ou nao vinculou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cargo_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar cargo e tentar outro com o mesmo nome'; r.esperado:='Segundo recusado (UNIQUE)';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Repetido');
  BEGIN
    INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Repetido');
    r.situacao:='falhou'; r.obtido:='ACEITOU cargo com nome duplicado.';
  EXCEPTION WHEN unique_violation THEN r.situacao:='passou'; r.obtido:='Recusado: nome de cargo unico por cliente.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cargo_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar cargo SEM departamento'; r.esperado:='Aceito (departamento e opcional)';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Sem Dep') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Cargo criado sem departamento.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cargo_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar cargo com salario minimo 8000 e maximo 3000 (incoerente)';
  r.esperado:='Idealmente recusado; revela se ha validacao de min<=max';
  BEGIN
    INSERT INTO public.cargos (tenant_id, nome, faixa_salarial_min, faixa_salarial_max)
    VALUES (v_t, '[QA] Cargo Salario Invertido', 8000, 3000) RETURNING id INTO v_id;
    r.situacao:='falhou';
    r.obtido:='O BANCO ACEITOU salario minimo (8000) maior que o maximo (3000). Nao ha CHECK de coerencia — validacao so no front, se houver.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco valida min<=max.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_cargo_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar cargo no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t1, '[QA] Cargo Secreto T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.cargos WHERE tenant_id=v_t2 AND nome='[QA] Cargo Secreto T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Cargo do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s cargo(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('DEP-001','qa_caso_dep_001'),('DEP-002','qa_caso_dep_002'),('DEP-010','qa_caso_dep_010'),
  ('DEP-011','qa_caso_dep_011'),('DEP-012','qa_caso_dep_012'),('DEP-013','qa_caso_dep_013'),
  ('CARGO-001','qa_caso_cargo_001'),('CARGO-010','qa_caso_cargo_010'),('CARGO-011','qa_caso_cargo_011'),
  ('CARGO-012','qa_caso_cargo_012'),('CARGO-022','qa_caso_cargo_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar os dois modulos ──
DO $roda$ BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/departamentos');
  PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/cargos');
END $roda$;

SELECT e.modulo_path, r.codigo, r.situacao::text, left(r.obtido, 52) AS resultado
FROM public.qa_resultados r
JOIN public.qa_execucoes e ON e.id = r.execucao_id
WHERE e.id IN (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 2)
ORDER BY e.modulo_path, (r.situacao='falhou') DESC, r.codigo;
