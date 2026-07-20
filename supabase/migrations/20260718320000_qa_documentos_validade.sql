-- =========================================================
-- QA — Módulo DOCUMENTOS · complemento DATA DE VALIDADE
--
-- COMPLEMENTA o modulo documentos. Correcao de uma omissao: eu havia deixado
-- a data_validade de fora. O Alexandre perguntou. Aqui estao os casos.
--
-- DESCOBERTA (medida, nao suposta) — inconsistencia entre modulos:
--   - terceiro_documentos: validade MADURA. Enum fechado (valido/a_vencer/
--     vencido/pendente) + trigger que calcula o status conforme a data.
--   - documentos (modulo geral): status e TEXT LIVRE (default 'valido'),
--     SEM enum e SEM trigger. O status NAO muda sozinho quando a validade
--     passa — depende do front ou de uma rotina que nao existe no banco.
--
-- Entao os casos aqui documentam o comportamento REAL:
--   DOC-040: guardar documento com data de validade — o campo funciona
--   DOC-041: guardar com validade JA vencida — o banco aceita, mas o status
--            continua 'valido' (NAO recalcula). Isso e um ACHADO: a validade
--            e so um dado, sem automacao no modulo geral.
--   DOC-042: o status aceita qualquer texto (sem enum) — outro ponto do achado
--
-- NOTIFICACAO de validade: investigado, NAO existe cron/rotina no banco que
-- varra 'documentos' por vencimento. Se ha aviso, e calculado no front ao
-- abrir a tela. Portanto nao e testavel por banco — fica para o Cypress.
-- =========================================================

-- (as tabelas ja tem a trava do cercado, do arquivo anterior)

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $seed$
DECLARE v_mod uuid;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path='documentos-governanca/documentos';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Modulo documentos nao encontrado.'; END IF;

  INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, nivel, objetivo, resultado_esperado)
  VALUES
  (v_mod,'DOC-040','Guardar documento com data de validade','feliz','alta','aprovado','api',
   'O campo data_validade aceita e guarda a data.','Validade persistida.'),
  (v_mod,'DOC-041','Documento com validade vencida (status nao recalcula)','excecao','alta','aprovado','api',
   'No modulo geral nao ha trigger de validade; revela se o status muda sozinho.','Revela que status fica manual.'),
  (v_mod,'DOC-042','Status de documento aceita texto livre (sem enum)','excecao','media','aprovado','api',
   'documentos.status e TEXT sem enum/check; revela ausencia de lista fechada.','Revela status sem validacao.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────

-- DOC-040: validade e guardada
CREATE OR REPLACE FUNCTION public.qa_caso_doc_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_val date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Guardar documento com validade em 31/12/2026'; r.esperado:='Data de validade persistida';
  INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, data_validade)
  VALUES (v_t, '[QA]', '[QA] aso.pdf', 'aso.pdf', 'pdf', 1024, 'application/pdf', 'qa/aso.pdf', DATE '2026-12-31')
  RETURNING id INTO v_id;
  SELECT data_validade INTO v_val FROM public.documentos WHERE id=v_id;
  IF v_val = DATE '2026-12-31' THEN r.situacao:='passou'; r.obtido:='Data de validade guardada (31/12/2026).';
  ELSE r.situacao:='falhou'; r.obtido:='Validade nao persistiu: '||COALESCE(v_val::text,'(nulo)'); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- DOC-041: validade vencida — status recalcula sozinho? (revela que NAO)
CREATE OR REPLACE FUNCTION public.qa_caso_doc_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_status text; v_val date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Guardar documento com validade JA vencida (ano passado)';
  r.esperado:='Idealmente o status viraria "vencido"; revela se ha automacao';
  INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, data_validade)
  VALUES (v_t, '[QA]', '[QA] vencido.pdf', 'vencido.pdf', 'pdf', 1024, 'application/pdf', 'qa/vencido.pdf', CURRENT_DATE - 365)
  RETURNING id INTO v_id;
  SELECT status, data_validade INTO v_status, v_val FROM public.documentos WHERE id=v_id;
  -- o documento esta vencido ha 1 ano. o status deveria refletir?
  IF v_status = 'vencido' THEN
    r.situacao:='passou'; r.obtido:='O status virou "vencido" automaticamente. Ha automacao de validade.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Documento vencido ha 1 ano mas status = "%s" (nao recalculou). No modulo geral a validade e so um dado — sem trigger/cron que marque vencidos. terceiro_documentos TEM essa automacao; aqui nao.', v_status);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- DOC-042: status aceita qualquer texto (sem enum)
CREATE OR REPLACE FUNCTION public.qa_caso_doc_042()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar guardar documento com status = "abacaxi" (valor sem sentido)';
  r.esperado:='Idealmente recusado por enum; revela se status tem lista fechada';
  BEGIN
    INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, status)
    VALUES (v_t, '[QA]', '[QA] x.pdf', 'x.pdf', 'pdf', 100, 'application/pdf', 'qa/x.pdf', 'abacaxi')
    RETURNING id INTO v_id;
    SELECT status INTO v_status FROM public.documentos WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU status = "%s". documentos.status e TEXT livre, sem enum/check. Um status invalido entra.', v_status);
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: status tem lista fechada de valores.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('DOC-040','qa_caso_doc_040'),('DOC-041','qa_caso_doc_041'),('DOC-042','qa_caso_doc_042')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar o modulo inteiro ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'documentos-governanca/documentos'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 62) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
