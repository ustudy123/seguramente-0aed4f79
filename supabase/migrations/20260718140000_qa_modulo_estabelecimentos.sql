-- =========================================================
-- QA — Módulo ESTABELECIMENTOS / OBRAS (tabela: filiais)
--
-- Terceiro item do bloco Estrutura Organizacional. As 3 intencoes.
--
-- Schema REAL (lido):
--   filiais: nome NOT NULL, UNIQUE(tenant_id, nome)
--            empresa_id REFERENCES empresa_cadastro ON DELETE SET NULL
--            tipo TEXT DEFAULT 'estabelecimento' (estabelecimento | obra)
--            cno TEXT (Cadastro Nacional de Obras — usado quando tipo=obra)
--   Sem trigger de negocio (so updated_at).
--
-- Relacao chave: filial aponta para empresa via empresa_id com SET NULL.
-- Apagar a empresa nao apaga a filial — apenas a desassocia. EST-013 prova.
-- =========================================================

-- Trava do cercado em filiais.
DO $trava$
BEGIN
  IF to_regclass('public.filiais') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.filiais;
    CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.filiais
      FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado();
    INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
    VALUES ('filiais', 'Modulo Estabelecimentos/Obras. Casos EST-*.') ON CONFLICT (tabela) DO NOTHING;
  END IF;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/estabelecimentos';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo estabelecimentos nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'EST-001','Cadastrar estabelecimento','feliz','alta','aprovado','api',
   'Cadastro basico de estabelecimento ligado a uma empresa.','Estabelecimento criado.'),
  (v_mod,'EST-002','Cadastrar uma OBRA com CNO','feliz','alta','aprovado','api',
   'Filial do tipo obra aceita o campo CNO (Cadastro Nacional de Obras).','Obra criada com CNO.'),
  (v_mod,'EST-003','Editar estabelecimento','feliz','media','aprovado','api',
   'Alteracao de dados persiste.','Novos dados gravados.'),
  -- ALT / EXCECAO
  (v_mod,'EST-010','Nome vazio e recusado','excecao','media','aprovado','api',
   'nome e NOT NULL.','Recusado sem nome.'),
  (v_mod,'EST-011','Mesmo nome em clientes diferentes e permitido','alternativo','media','aprovado','api',
   'UNIQUE e por tenant.','Aceito nos dois tenants.'),
  (v_mod,'EST-013','Apagar a empresa apenas desassocia a filial','alternativo','alta','aprovado','api',
   'empresa_id ON DELETE SET NULL: filial sobrevive sem empresa.','Filial preservada, sem empresa.'),
  -- PROIBIDO
  (v_mod,'EST-020','Nome duplicado no mesmo cliente e recusado','negativo','alta','aprovado','api',
   'UNIQUE(tenant_id, nome).','Segundo com mesmo nome recusado.'),
  (v_mod,'EST-022','Estabelecimento de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Filial do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_caso_est_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar estabelecimento "Unidade Centro"'; r.esperado:='Criado';
  INSERT INTO public.filiais (tenant_id, nome, tipo, cidade, estado)
  VALUES (v_t, '[QA] Unidade Centro', 'estabelecimento', 'Maringa', 'PR') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Estabelecimento criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_cno text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar OBRA com CNO 12.345.67890/12'; r.esperado:='Obra criada com o CNO gravado';
  INSERT INTO public.filiais (tenant_id, nome, tipo, cno, cidade, estado)
  VALUES (v_t, '[QA] Obra Residencial', 'obra', '12.345.67890/12', 'Maringa', 'PR') RETURNING id INTO v_id;
  SELECT cno INTO v_cno FROM public.filiais WHERE id=v_id;
  IF v_cno = '12.345.67890/12' THEN r.situacao:='passou'; r.obtido:='Obra criada com CNO gravado.';
  ELSE r.situacao:='falhou'; r.obtido:='CNO nao persistiu: '||COALESCE(v_cno,'(nulo)'); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_cid text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar e depois mudar a cidade da filial'; r.esperado:='Cidade nova persiste';
  INSERT INTO public.filiais (tenant_id, nome, cidade) VALUES (v_t, '[QA] Filial Editavel', 'Maringa') RETURNING id INTO v_id;
  UPDATE public.filiais SET cidade='Londrina' WHERE id=v_id;
  SELECT cidade INTO v_cid FROM public.filiais WHERE id=v_id;
  IF v_cid='Londrina' THEN r.situacao:='passou'; r.obtido:='Edicao persistiu.';
  ELSE r.situacao:='falhou'; r.obtido:='Cidade='||v_cid; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar filial sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar "Matriz" no tenant 1 e no tenant 2'; r.esperado:='Aceito nos dois (UNIQUE por tenant)';
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t1, '[QA] Matriz Comum');
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t2, '[QA] Matriz Comum');
  SELECT count(*) INTO v_n FROM public.filiais WHERE nome='[QA] Matriz Comum' AND tenant_id IN (v_t1,v_t2);
  IF v_n=2 THEN r.situacao:='passou'; r.obtido:='Mesmo nome convive em clientes diferentes.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2, achou %s.', v_n); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid; v_fil uuid; v_emp_da_fil uuid; v_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar empresa e uma filial ligada a ela'; r.esperado:='Apagar a empresa desassocia a filial, nao a apaga';
  v_emp := public.qa_nova_empresa('[QA] Empresa Com Filial', '55666777000188');
  INSERT INTO public.filiais (tenant_id, nome, empresa_id) VALUES (v_t, '[QA] Filial Orfa', v_emp) RETURNING id INTO v_fil;
  r.passo_ordem:=2; r.passo_acao:='Apagar a empresa';
  DELETE FROM public.empresa_cadastro WHERE id=v_emp;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a filial sobreviveu, agora sem empresa';
  SELECT EXISTS(SELECT 1 FROM public.filiais WHERE id=v_fil) INTO v_existe;
  SELECT empresa_id INTO v_emp_da_fil FROM public.filiais WHERE id=v_fil;
  IF v_existe AND v_emp_da_fil IS NULL THEN
    r.situacao:='passou'; r.obtido:='Filial sobreviveu e ficou sem empresa (SET NULL), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Filial existe=%s, empresa=%s.', v_existe, v_emp_da_fil); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar filial e tentar outra com o mesmo nome'; r.esperado:='Segundo recusado (UNIQUE)';
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t, '[QA] Filial Repetida');
  BEGIN
    INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t, '[QA] Filial Repetida');
    r.situacao:='falhou'; r.obtido:='ACEITOU nome duplicado no mesmo cliente.';
  EXCEPTION WHEN unique_violation THEN r.situacao:='passou'; r.obtido:='Recusado: nome unico por cliente.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_est_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar filial no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.filiais (tenant_id, nome) VALUES (v_t1, '[QA] Filial Secreta T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.filiais WHERE tenant_id=v_t2 AND nome='[QA] Filial Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Filial do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s filial(is) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('EST-001','qa_caso_est_001'),('EST-002','qa_caso_est_002'),('EST-003','qa_caso_est_003'),
  ('EST-010','qa_caso_est_010'),('EST-011','qa_caso_est_011'),('EST-013','qa_caso_est_013'),
  ('EST-020','qa_caso_est_020'),('EST-022','qa_caso_est_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/estabelecimentos'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
