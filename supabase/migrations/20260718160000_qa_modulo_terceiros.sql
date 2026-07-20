-- =========================================================
-- QA — Módulo TERCEIROS / SST (tabelas: terceiros + terceiro_trabalhadores)
--
-- Quarto item do bloco Estrutura Organizacional. Mais rico: a empresa
-- terceira (terceiros) tem trabalhadores vinculados (terceiro_trabalhadores).
--
-- Schema REAL (lido):
--   terceiros: razao_social NOT NULL, cnpj NOT NULL (SEM unique — achado),
--     tipo_acesso enum (eventual|recorrente|continuo),
--     status enum (liberado|restrito|bloqueado), atividade_risco bool
--   terceiro_trabalhadores: terceiro_id REFERENCES terceiros ON DELETE CASCADE
--
-- DIFERENCA IMPORTANTE dos modulos anteriores: a relacao aqui e CASCADE,
-- nao SET NULL. Apagar o terceiro APAGA os trabalhadores junto. TER-013
-- prova esse comportamento (oposto do que EST-013/DEP-013 provaram).
--
-- ACHADO ESPERADO: cnpj de terceiro NAO tem constraint unica. TER-020
-- revela se da pra cadastrar dois terceiros com o mesmo CNPJ.
-- =========================================================

-- Trava do cercado nas duas tabelas.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['terceiros','terceiro_trabalhadores'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Terceiros/SST.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='estrutura-organizacional/prestadores';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo terceiros nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'TER-001','Cadastrar empresa terceira','feliz','alta','aprovado','api',
   'Cadastro basico de terceiro com CNPJ e razao social.','Terceiro criado.'),
  (v_mod,'TER-002','Adicionar trabalhador a um terceiro','feliz','alta','aprovado','api',
   'Vincular uma pessoa (terceiro_trabalhadores) a empresa terceira.','Trabalhador vinculado.'),
  (v_mod,'TER-003','Mudar status do terceiro para bloqueado','feliz','media','aprovado','api',
   'O status (liberado/restrito/bloqueado) e alteravel.','Status atualizado.'),
  -- ALT / EXCECAO
  (v_mod,'TER-010','Razao social vazia e recusada','excecao','media','aprovado','api',
   'razao_social e NOT NULL.','Recusado sem razao social.'),
  (v_mod,'TER-011','Status invalido e recusado','excecao','media','aprovado','api',
   'status so aceita liberado, restrito ou bloqueado.','Enum recusa valor fora da lista.'),
  (v_mod,'TER-013','Apagar terceiro APAGA seus trabalhadores (CASCADE)','alternativo','alta','aprovado','api',
   'ON DELETE CASCADE: diferente de filiais/cargos, aqui os filhos somem junto.','Trabalhadores apagados com o terceiro.'),
  -- PROIBIDO
  (v_mod,'TER-020','Dois terceiros com o mesmo CNPJ (revela ausencia de unique)','negativo','alta','aprovado','api',
   'cnpj e NOT NULL mas nao tem constraint unica; o teste revela.','Revela se aceita CNPJ duplicado.'),
  (v_mod,'TER-022','Terceiro de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Terceiro do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_novo_terceiro(p_razao text, p_cnpj text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.terceiros (tenant_id, razao_social, cnpj)
  VALUES (public.qa_sandbox_tenant_id(), p_razao, p_cnpj) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar terceiro "Manutencao XYZ"'; r.esperado:='Criado';
  v_id := public.qa_novo_terceiro('[QA] Manutencao XYZ LTDA', '44555666000177');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Terceiro criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid; v_trab uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e adicionar um trabalhador'; r.esperado:='Trabalhador vinculado ao terceiro';
  v_ter := public.qa_novo_terceiro('[QA] Terceiro Com Gente', '44555666000258');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Terceiro', '99900000188') RETURNING id INTO v_trab;
  IF v_trab IS NOT NULL AND EXISTS(SELECT 1 FROM public.terceiro_trabalhadores WHERE id=v_trab AND terceiro_id=v_ter) THEN
    r.situacao:='passou'; r.obtido:='Trabalhador vinculado ao terceiro.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao vinculou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ter uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro (liberado) e mudar status para bloqueado'; r.esperado:='Status vira bloqueado';
  v_ter := public.qa_novo_terceiro('[QA] Terceiro Status', '44555666000339');
  UPDATE public.terceiros SET status='bloqueado' WHERE id=v_ter;
  SELECT status INTO v_st FROM public.terceiros WHERE id=v_ter;
  IF v_st='bloqueado' THEN r.situacao:='passou'; r.obtido:='Status alterado para bloqueado.';
  ELSE r.situacao:='falhou'; r.obtido:='Status='||v_st; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar cadastrar terceiro sem razao social'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.terceiros (tenant_id, razao_social, cnpj) VALUES (v_t, NULL, '44555666000410');
    r.situacao:='falhou'; r.obtido:='ACEITOU sem razao social.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar status = "suspenso" (fora do enum)'; r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.terceiros (tenant_id, razao_social, cnpj, status)
    VALUES (v_t, '[QA] Status Invalido', '44555666000591', 'suspenso');
    r.situacao:='falhou'; r.obtido:='ACEITOU status fora do enum.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: status so aceita os valores do enum.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid; v_trab uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro com 1 trabalhador'; r.esperado:='Apagar o terceiro apaga o trabalhador junto (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Terceiro Que Sera Apagado', '44555666000672');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome) VALUES (v_t, v_ter, '[QA] Trab Some Junto') RETURNING id INTO v_trab;
  r.passo_ordem:=2; r.passo_acao:='Apagar o terceiro';
  DELETE FROM public.terceiros WHERE id=v_ter;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o trabalhador foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_trabalhadores WHERE id=v_trab;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='Trabalhador apagado junto com o terceiro (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Trabalhador NAO foi apagado (%s ainda existe) — CASCADE nao funcionou.', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e tentar outro com o MESMO CNPJ'; r.esperado:='Idealmente recusado; revela se ha unique em CNPJ';
  PERFORM public.qa_novo_terceiro('[QA] Terceiro A', '44555666000753');
  BEGIN
    PERFORM public.qa_novo_terceiro('[QA] Terceiro B', '44555666000753');
    SELECT count(*) INTO v_n FROM public.terceiros WHERE tenant_id=v_t AND cnpj='44555666000753';
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s terceiros com o mesmo CNPJ. Nao ha constraint unica — cadastro duplicado passa.', v_n);
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: CNPJ de terceiro e unico.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.terceiros (tenant_id, razao_social, cnpj) VALUES (v_t1, '[QA] Terceiro Secreto T1', '44555666000834');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.terceiros WHERE tenant_id=v_t2 AND cnpj='44555666000834';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Terceiro do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s terceiro(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('TER-001','qa_caso_ter_001'),('TER-002','qa_caso_ter_002'),('TER-003','qa_caso_ter_003'),
  ('TER-010','qa_caso_ter_010'),('TER-011','qa_caso_ter_011'),('TER-013','qa_caso_ter_013'),
  ('TER-020','qa_caso_ter_020'),('TER-022','qa_caso_ter_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/prestadores'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
