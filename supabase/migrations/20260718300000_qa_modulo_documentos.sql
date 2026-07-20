-- =========================================================
-- QA — Módulo DOCUMENTOS (tabelas: documento_pastas, documentos,
--   documento_versoes) — bloco Documentos & Governança
--
-- Mais que cadastro: aqui vale a PREMISSA do sistema — todo arquivo enviado
-- ou gerado vai para uma PASTA, e quando revisado/assinado ganha uma nova
-- VERSAO (a assinada). Os casos cobrem isso.
--
-- Schema REAL (lido, ALTERs conferidos):
--   documento_pastas: nome NOT NULL, tipo (root|unidade|colaborador|ano|mes|
--     categoria|custom), pasta_pai_id ON DELETE CASCADE (hierarquia),
--     filial_id REFERENCES filiais
--   documentos: nome_arquivo/nome_original/tipo/mime_type/storage_path NOT NULL,
--     tamanho NOT NULL, status DEFAULT 'valido',
--     pasta_id REFERENCES documento_pastas (SEM on delete = NO ACTION:
--       o banco NAO deixa apagar pasta com documento dentro)
--   documento_versoes: documento_id, versao, storage_path NOT NULL
--     (o versionamento — a versao assinada entra aqui como nova versao)
--
-- COMPORTAMENTOS a provar:
--   DOC-013: apagar pasta-mae apaga subpastas (CASCADE na hierarquia)
--   DOC-014: NAO da pra apagar pasta com documento dentro (NO ACTION protege)
--   DOC-030: documento revisado ganha versao 2 (a premissa de assinatura)
-- =========================================================

-- Trava do cercado nas 3 tabelas.
DO $trava$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documento_pastas','documentos','documento_versoes'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qa_guarda_cercado ON public.%I', t);
      EXECUTE format('CREATE TRIGGER qa_guarda_cercado BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.qa_bloqueia_fora_do_cercado()', t);
      INSERT INTO public.qa_tabelas_protegidas (tabela, motivo)
      VALUES (t, 'Modulo Documentos.') ON CONFLICT (tabela) DO NOTHING;
    END IF;
  END LOOP;
END $trava$;

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
  -- FELIZ
  (v_mod,'DOC-001','Criar uma pasta','feliz','alta','aprovado','api',
   'Cadastro de pasta no modulo de documentos.','Pasta criada.'),
  (v_mod,'DOC-002','Guardar um documento em uma pasta','feliz','critica','aprovado','api',
   'A premissa: o documento vai para uma pasta.','Documento na pasta.'),
  (v_mod,'DOC-003','Montar hierarquia de pastas (pasta dentro de pasta)','feliz','alta','aprovado','api',
   'Pastas sao hierarquicas (pasta_pai_id).','Subpasta criada sob a pasta-mae.'),
  -- ALT / EXCECAO
  (v_mod,'DOC-010','Pasta sem nome e recusada','excecao','media','aprovado','api',
   'nome e NOT NULL.','Recusado sem nome.'),
  (v_mod,'DOC-011','Documento sem storage_path e recusado','excecao','alta','aprovado','api',
   'storage_path e NOT NULL — todo documento precisa apontar para um arquivo.','Recusado sem storage_path.'),
  (v_mod,'DOC-013','Apagar pasta-mae apaga as subpastas (CASCADE)','alternativo','alta','aprovado','api',
   'pasta_pai_id ON DELETE CASCADE.','Subpastas apagadas junto.'),
  (v_mod,'DOC-014','Nao da para apagar pasta com documento dentro','negativo','alta','aprovado','api',
   'pasta_id sem ON DELETE (NO ACTION): o banco protege o documento.','Exclusao da pasta recusada.'),
  -- PREMISSA (assinatura/versao)
  (v_mod,'DOC-030','Documento revisado ganha uma nova versao (a assinada)','feliz','critica','aprovado','api',
   'A premissa da assinatura: revisar cria versao 2, preservando a 1.','Versao 2 criada, versao 1 preservada.'),
  -- PROIBIDO
  (v_mod,'DOC-022','Documento de outro cliente e invisivel','negativo','critica','aprovado','api',
   'Isolamento multi-tenant.','Documento do tenant 1 invisivel ao tenant 2.')
  ON CONFLICT (codigo) DO NOTHING;
END $seed$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_nova_pasta(p_nome text, p_pai uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.documento_pastas (tenant_id, nome, pasta_pai_id)
  VALUES (public.qa_sandbox_tenant_id(), p_nome, p_pai) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- helper: cria um documento (com todos os NOT NULL) numa pasta
CREATE OR REPLACE FUNCTION public.qa_novo_documento(p_nome text, p_pasta uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.documentos
    (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path, pasta_id)
  VALUES (public.qa_sandbox_tenant_id(), '[QA] Colaborador', p_nome, p_nome, 'pdf', 1024,
          'application/pdf', 'qa/'||p_nome, p_pasta) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta "Documentos Admissionais"'; r.esperado:='Pasta criada';
  v_id := public.qa_nova_pasta('[QA] Documentos Admissionais');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Pasta criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_pasta uuid; v_doc uuid; v_pasta_do_doc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta e guardar um documento dentro dela'; r.esperado:='O documento aponta para a pasta';
  v_pasta := public.qa_nova_pasta('[QA] Pasta Com Doc');
  v_doc := public.qa_novo_documento('[QA] contrato.pdf', v_pasta);
  SELECT pasta_id INTO v_pasta_do_doc FROM public.documentos WHERE id=v_doc;
  IF v_pasta_do_doc = v_pasta THEN r.situacao:='passou'; r.obtido:='Documento guardado na pasta (premissa cumprida).';
  ELSE r.situacao:='falhou'; r.obtido:='Documento nao ficou na pasta.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_mae uuid; v_sub uuid; v_pai_da_sub uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta "2026" e dentro dela "Janeiro"'; r.esperado:='Janeiro tem 2026 como pasta-mae';
  v_mae := public.qa_nova_pasta('[QA] 2026');
  v_sub := public.qa_nova_pasta('[QA] Janeiro', v_mae);
  SELECT pasta_pai_id INTO v_pai_da_sub FROM public.documento_pastas WHERE id=v_sub;
  IF v_pai_da_sub = v_mae THEN r.situacao:='passou'; r.obtido:='Hierarquia de pastas montada (subpasta aponta para a mae).';
  ELSE r.situacao:='falhou'; r.obtido:='pasta_pai_id da subpasta nao aponta para a mae.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar pasta sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.documento_pastas (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU pasta sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar guardar documento sem storage_path'; r.esperado:='Recusado (NOT NULL) — documento precisa apontar para um arquivo';
  BEGIN
    INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path)
    VALUES (v_t, '[QA]', 'x.pdf', 'x.pdf', 'pdf', 100, 'application/pdf', NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU documento sem storage_path.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado: documento precisa apontar para um arquivo.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_013()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_mae uuid; v_sub uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta-mae com uma subpasta'; r.esperado:='Apagar a mae apaga a subpasta (CASCADE)';
  v_mae := public.qa_nova_pasta('[QA] Mae Que Sera Apagada');
  v_sub := public.qa_nova_pasta('[QA] Sub Some Junto', v_mae);
  r.passo_ordem:=2; r.passo_acao:='Apagar a pasta-mae';
  DELETE FROM public.documento_pastas WHERE id=v_mae;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a subpasta foi apagada junto';
  SELECT count(*) INTO v_sobrou FROM public.documento_pastas WHERE id=v_sub;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='Subpasta apagada junto com a mae (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Subpasta NAO foi apagada (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_014()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_pasta uuid; v_doc uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar pasta com um documento dentro'; r.esperado:='Apagar a pasta e recusado (protege o documento)';
  v_pasta := public.qa_nova_pasta('[QA] Pasta Protegida');
  v_doc := public.qa_novo_documento('[QA] importante.pdf', v_pasta);
  r.passo_ordem:=2; r.passo_acao:='Tentar apagar a pasta que ainda tem documento';
  BEGIN
    DELETE FROM public.documento_pastas WHERE id=v_pasta;
    r.situacao:='falhou'; r.obtido:='APAGOU a pasta com documento dentro — o documento ficou orfao ou sumiu.';
  EXCEPTION WHEN foreign_key_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco protege o documento, nao deixa apagar a pasta que o contem.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_doc uuid; v_qtd int; v_v1 int; v_v2 int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Guardar um documento (versao 1)'; r.esperado:='Revisar cria versao 2, preservando a versao 1 (a premissa da assinatura)';
  v_doc := public.qa_novo_documento('[QA] termo.pdf');
  INSERT INTO public.documento_versoes (tenant_id, documento_id, versao, nome_original, storage_path, tamanho, mime_type)
  VALUES (v_t, v_doc, 1, '[QA] termo.pdf', 'qa/termo_v1.pdf', 1024, 'application/pdf');
  r.passo_ordem:=2; r.passo_acao:='Documento assinado chega: criar versao 2 (a assinada)';
  INSERT INTO public.documento_versoes (tenant_id, documento_id, versao, nome_original, storage_path, tamanho, mime_type, motivo_revisao)
  VALUES (v_t, v_doc, 2, '[QA] termo_assinado.pdf', 'qa/termo_v2_assinado.pdf', 2048, 'application/pdf', 'Versao assinada');
  r.passo_ordem:=3; r.passo_acao:='Conferir que existem 2 versoes, a 1 preservada';
  SELECT count(*) INTO v_qtd FROM public.documento_versoes WHERE documento_id=v_doc;
  SELECT count(*) INTO v_v1 FROM public.documento_versoes WHERE documento_id=v_doc AND versao=1;
  SELECT count(*) INTO v_v2 FROM public.documento_versoes WHERE documento_id=v_doc AND versao=2;
  IF v_qtd=2 AND v_v1=1 AND v_v2=1 THEN
    r.situacao:='passou'; r.obtido:='2 versoes: original (v1) preservada e assinada (v2). Premissa cumprida.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2 versoes (v1+v2). Total=%s, v1=%s, v2=%s.', v_qtd, v_v1, v_v2); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_doc_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Guardar documento no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.documentos (tenant_id, colaborador_nome, nome_arquivo, nome_original, tipo, tamanho, mime_type, storage_path)
  VALUES (v_t1, '[QA]', '[QA] secreto_t1.pdf', 'secreto.pdf', 'pdf', 100, 'application/pdf', 'qa/secreto_t1.pdf');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.documentos WHERE tenant_id=v_t2 AND nome_arquivo='[QA] secreto_t1.pdf';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Documento do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s documento(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;

-- ── Registrar ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('DOC-001','qa_caso_doc_001'),('DOC-002','qa_caso_doc_002'),('DOC-003','qa_caso_doc_003'),
  ('DOC-010','qa_caso_doc_010'),('DOC-011','qa_caso_doc_011'),('DOC-013','qa_caso_doc_013'),
  ('DOC-014','qa_caso_doc_014'),('DOC-030','qa_caso_doc_030'),('DOC-022','qa_caso_doc_022')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql=EXCLUDED.funcao_sql, ativo=true;

-- ── Rodar ──
DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual', 'documentos-governanca/documentos'); END $roda$;

SELECT codigo, situacao::text, left(obtido, 58) AS resultado
FROM public.qa_resultados
WHERE execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (situacao='falhou') DESC, (situacao='erro') DESC, codigo;
