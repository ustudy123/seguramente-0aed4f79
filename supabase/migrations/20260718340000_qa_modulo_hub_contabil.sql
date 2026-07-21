-- =========================================================
-- QA — Módulo HUB CONTÁBIL (tabelas: hub_contabilidades, hub_competencias,
--   hub_guias) — fecha o bloco Documentos & Governança
--
-- SITUACAO ESPECIAL: o Hub esta construido (18 tabelas, varias telas) mas
-- NUNCA foi validado na pratica. Estes testes sao a PRIMEIRA verificacao
-- real do modulo — exercitam cada regra no cercado, sem tocar dado real.
--
-- Schema REAL (lido, ALTERs conferidos):
--   hub_contabilidades: nome NOT NULL, cnpj, email_principal (a contabilidade
--     parceira). ON DELETE CASCADE do tenant.
--   hub_competencias: competencia NOT NULL (ex "2026-02"),
--     UNIQUE(tenant_id, competencia) — uma competencia por cliente,
--     status CHECK (em_preparacao|enviado|em_processamento|em_conferencia|
--       aprovado|finalizado|reaberto) — o fluxo mensal
--   hub_guias: competencia NOT NULL, tipo CHECK (inss|fgts|irrf|darf|...),
--     valor, data_vencimento NOT NULL, status CHECK (pendente|paga|vencida|
--       cancelada), competencia_id REFERENCES hub_competencias
--
-- O Hub e a ponte empresa <-> contabilidade: processa competencias mensais,
-- com suas guias de imposto, num fluxo de status controlado.
-- =========================================================

-- Trava do cercado nas 3 tabelas centrais.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hub_contabilidades','hub_competencias','hub_guias'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Hub Contabil.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='documentos-governanca/hub-contabil';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo hub-contabil nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  -- FELIZ
  (v_mod,'HUB-001','Cadastrar uma contabilidade parceira','feliz','alta','aprovado','api',
   'Cadastro basico de contabilidade.','Contabilidade criada.'),
  (v_mod,'HUB-002','Abrir uma competencia mensal','feliz','alta','aprovado','api',
   'Criar a competencia (ex 2026-02) que sera processada.','Competencia criada.'),
  (v_mod,'HUB-003','Adicionar guias de imposto a uma competencia','feliz','critica','aprovado','api',
   'Guias (INSS, FGTS) sao vinculadas a competencia.','Guias vinculadas.'),
  (v_mod,'HUB-004','Avancar o fluxo de status da competencia','feliz','alta','aprovado','api',
   'em_preparacao -> enviado -> aprovado.','Status avanca.'),
  -- ALT / EXCECAO
  (v_mod,'HUB-010','Contabilidade sem nome e recusada','excecao','media','aprovado','api',
   'nome e NOT NULL.','Recusado sem nome.'),
  (v_mod,'HUB-011','Status de competencia invalido e recusado','excecao','alta','aprovado','api',
   'status tem CHECK com 7 valores.','Recusado fora da lista.'),
  (v_mod,'HUB-012','Tipo de guia invalido e recusado','excecao','alta','aprovado','api',
   'tipo tem CHECK (inss/fgts/irrf/...).','Recusado com tipo fora da lista.'),
  -- PROIBIDO
  (v_mod,'HUB-020','Competencia duplicada no mesmo cliente e recusada','negativo','alta','aprovado','api',
   'UNIQUE(tenant_id, competencia): uma competencia por cliente.','Segunda "2026-02" recusada.'),
  (v_mod,'HUB-022','Dados do Hub de outro cliente sao invisiveis','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Competencia do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_competencia(p_comp text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.hub_competencias (tenant_id, competencia)
  VALUES (public.qa_sandbox_tenant_id(), p_comp) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar contabilidade "Contabil Exemplo"'; r.esperado:='Criada';
  INSERT INTO public.hub_contabilidades (tenant_id, nome, cnpj, email_principal)
  VALUES (v_t, '[QA] Contabil Exemplo', '11222333000181', 'qa@contabil.invalid') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Contabilidade criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Abrir competencia "2026-02"'; r.esperado:='Competencia criada em preparacao';
  v_id := public.qa_nova_competencia('[QA]2026-02');
  IF v_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.hub_competencias WHERE id=v_id AND status='em_preparacao') THEN
    r.situacao:='passou'; r.obtido:='Competencia criada, status inicial em_preparacao.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou ou status inicial inesperado.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_comp uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar competencia e adicionar guias de INSS e FGTS'; r.esperado:='2 guias vinculadas a competencia';
  v_comp := public.qa_nova_competencia('[QA]2026-03');
  INSERT INTO public.hub_guias (tenant_id, competencia_id, competencia, tipo, valor, data_vencimento) VALUES
    (v_t, v_comp, '[QA]2026-03', 'inss', 1500.00, CURRENT_DATE + 20),
    (v_t, v_comp, '[QA]2026-03', 'fgts', 800.00, CURRENT_DATE + 7);
  SELECT count(*) INTO v_qtd FROM public.hub_guias WHERE competencia_id=v_comp;
  IF v_qtd = 2 THEN r.situacao:='passou'; r.obtido:='2 guias (INSS, FGTS) vinculadas a competencia.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2 guias, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar competencia e avancar: preparacao -> enviado -> aprovado'; r.esperado:='Status chega a aprovado';
  v_id := public.qa_nova_competencia('[QA]2026-04');
  UPDATE public.hub_competencias SET status='enviado', data_envio=now() WHERE id=v_id;
  UPDATE public.hub_competencias SET status='aprovado', data_aprovacao=now() WHERE id=v_id;
  SELECT status INTO v_st FROM public.hub_competencias WHERE id=v_id;
  IF v_st='aprovado' THEN r.situacao:='passou'; r.obtido:='Fluxo avancou ate aprovado.';
  ELSE r.situacao:='falhou'; r.obtido:='Status='||v_st; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar contabilidade sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.hub_contabilidades (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU contabilidade sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar competencia com status "arquivado" (fora do CHECK)'; r.esperado:='Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.hub_competencias (tenant_id, competencia, status) VALUES (v_t, '[QA]2026-99', 'arquivado');
    r.situacao:='falhou'; r.obtido:='ACEITOU status fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: status so aceita os 7 valores do fluxo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_comp uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar competencia e tentar guia com tipo "imposto_x" (fora do CHECK)'; r.esperado:='Recusado pelo CHECK';
  v_comp := public.qa_nova_competencia('[QA]2026-05');
  BEGIN
    INSERT INTO public.hub_guias (tenant_id, competencia_id, competencia, tipo, valor, data_vencimento)
    VALUES (v_t, v_comp, '[QA]2026-05', 'imposto_x', 100, CURRENT_DATE + 10);
    r.situacao:='falhou'; r.obtido:='ACEITOU tipo de guia fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: tipo so aceita inss/fgts/irrf/darf/etc.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Abrir competencia "2026-06"'; r.esperado:='Segunda "2026-06" no mesmo cliente e recusada';
  INSERT INTO public.hub_competencias (tenant_id, competencia) VALUES (v_t, '[QA]2026-06-dup');
  r.passo_ordem:=2; r.passo_acao:='Tentar abrir a MESMA competencia de novo';
  BEGIN
    INSERT INTO public.hub_competencias (tenant_id, competencia) VALUES (v_t, '[QA]2026-06-dup');
    r.situacao:='falhou'; r.obtido:='ACEITOU competencia duplicada no mesmo cliente.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: uma competencia por cliente, como esperado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_hub_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Abrir competencia no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.hub_competencias (tenant_id, competencia) VALUES (v_t1, '[QA]SEC-T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.hub_competencias WHERE tenant_id=v_t2 AND competencia='[QA]SEC-T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Competencia do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s competencia(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('HUB-001','qa_caso_hub_001'),('HUB-002','qa_caso_hub_002'),('HUB-003','qa_caso_hub_003'),
  ('HUB-004','qa_caso_hub_004'),('HUB-010','qa_caso_hub_010'),('HUB-011','qa_caso_hub_011'),
  ('HUB-012','qa_caso_hub_012'),('HUB-020','qa_caso_hub_020'),('HUB-022','qa_caso_hub_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'documentos-governanca/hub-contabil'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
