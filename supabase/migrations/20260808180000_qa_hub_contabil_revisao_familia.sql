-- =========================================================
-- QA — Hub Contábil: revisão da família contra a auditoria (07/08)
--
-- ORIGEM: a auditoria de 18/07 apontou o Hub Contábil com 18 tabelas e
-- só 3 testadas (hub_contabilidades, hub_competencias, hub_guias — a
-- família HUB-001..022). A unidade central de trabalho do módulo, o
-- PROCESSO (hub_processos e filhas), e as CERTIDÕES com validade nunca
-- tiveram caso.
--
-- O QUE A LEITURA DO SCHEMA MOSTROU — e que muda o tom desta revisão:
-- diferente de Metas, aqui o banco JÁ GARANTE bastante coisa. O código
-- do processo é gerado por trigger (ADM-00001, sequencial por tenant e
-- tipo), a mudança de status grava hub_processo_historico por trigger,
-- o token de assinatura tem UNIQUE, e o status da certidão é derivado
-- da validade por trigger. Os casos felizes confirmam essas garantias.
--
-- MAS a mesma leitura revelou um defeito de desenho: o trigger
-- atualizar_status_certidao SOBRESCREVE o status em todo INSERT/UPDATE,
-- sem exceção — o CHECK da tabela admite 'irregular', e o trigger torna
-- esse estado INALCANÇÁVEL (grava 'irregular', o trigger troca por
-- 'valida' se a validade está no futuro). Certidão irregular com data
-- boa é exatamente o caso que o fiscal aponta. CERT-011 pega isso.
--
-- FICAM DE FORA, com registro do porquê (critério da auditoria):
--   hub_calendario_*, hub_catalogo_documentos, hub_checklist_templates:
--     padrão conhecido (CRUD + tenant), ganho moderado — próxima leva.
--   hub_historico, hub_processo_historico, hub_processo_comentarios,
--   hub_config, hub_notificacao_config: log e apoio sem regra própria.
--   (hub_processo_historico É exercitado aqui, mas pelo ângulo da regra:
--    a trilha automática do processo, em PROC-002.)
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE. Onde o sistema diverge do caso,
-- a rotina falha de propósito e o achado vai para o relatório.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- DOCUMENTAÇÃO
-- ─────────────────────────────────────────────────────────
DO $doc$
DECLARE v_mod uuid; v_antes int; v_depois int;
BEGIN
  SELECT id INTO v_mod FROM public.qa_modulos WHERE path = 'documentos-governanca/hub-contabil';
  IF v_mod IS NULL THEN RAISE EXCEPTION 'Módulo documentos-governanca/hub-contabil não encontrado.'; END IF;

  SELECT count(*) INTO v_antes FROM public.qa_casos_teste WHERE modulo_id = v_mod;

  INSERT INTO public.qa_casos_teste
    (modulo_id, codigo, titulo, tipo, prioridade, status, nivel,
     objetivo, pre_condicoes, passos, resultado_esperado, observacoes)
  VALUES

  -- ══════════ PROCESSOS ══════════

  (v_mod, 'PROC-001', 'Criar processo gera código sequencial automático',
   'feliz', 'alta', 'aprovado', 'api',
   'O processo é a unidade central do Hub. Ao criar, um trigger gera o código pelo tipo (admissão = ADM-00001, férias = FER-00001...), sequencial por cliente e por tipo. É o número que RH e contabilidade usam para se referir ao caso — não pode repetir nem saltar.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar processo de admissão sem informar código","resultado_esperado":"Código ADM-00001 gerado"},
     {"ordem":2,"acao":"Criar segundo processo de admissão","resultado_esperado":"ADM-00002 — sequência avança"},
     {"ordem":3,"acao":"Criar processo de férias","resultado_esperado":"FER-00001 — cada tipo tem a própria sequência"}]'::jsonb,
   'Códigos sequenciais por tipo, sem repetição.',
   NULL),

  (v_mod, 'PROC-002', 'Mudança de status do processo deixa trilha automática',
   'feliz', 'alta', 'aprovado', 'api',
   'Ao contrário do módulo Metas (MWKF-011), aqui a trilha É responsabilidade do banco: um trigger grava hub_processo_historico a cada mudança de status, seja qual for a rota de entrada. Este caso protege essa garantia contra regressão.',
   'Processo criado em rascunho.',
   '[{"ordem":1,"acao":"Mudar o status direto no banco, sem passar pela tela","resultado_esperado":"Linha no histórico com status anterior e novo, gravada pelo trigger"}]'::jsonb,
   'Toda mudança de status deixa trilha, por qualquer rota.',
   'Referência de boa prática para a correção sugerida em MWKF-011 (Metas).'),

  (v_mod, 'PROC-010', 'Prazo do processo anterior à data de referência',
   'negativo', 'media', 'aprovado', 'api',
   'data_limite antes de data_referencia é um prazo que venceu antes de o fato existir — o SLA nasce estourado. Nenhuma camada valida a coerência entre as duas datas.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar processo com data_referencia = 2026-08-10 e data_limite = 2026-08-01","resultado_esperado":"Recusado — o prazo não pode anteceder a referência"}]'::jsonb,
   'Datas incoerentes não entram.',
   'Provável ACHADO — mesma família de ENQ-013 (mandato CIPA) e TAC-003. Correção: CHECK (data_limite >= data_referencia).'),

  (v_mod, 'PROC-011', 'Processo não pode apontar contabilidade de outro cliente',
   'negativo', 'alta', 'aprovado', 'api',
   'A FK de contabilidade_id não olha tenant: um processo do cliente A pode ser vinculado à contabilidade parceira do cliente B — e o fluxo de envio passaria a conversar com a contabilidade errada, de outro cliente.',
   'Cercados 1 e 2; contabilidade cadastrada no cercado 2.',
   '[{"ordem":1,"acao":"Criar processo no cercado 1 apontando contabilidade do cercado 2","resultado_esperado":"Recusado — processo e contabilidade do mesmo tenant"}]'::jsonb,
   'Vínculo cruzando tenants não entra.',
   'Mesma família de FER-004 e MCHK-011; mesmo remédio — gatilho de coerência de tenant.'),

  (v_mod, 'PROC-012', 'Apagar o processo leva checklist, documentos e assinaturas',
   'excecao', 'media', 'aprovado', 'api',
   'As filhas do processo (checklist, documentos, assinaturas) têm FK ON DELETE CASCADE. Excluir o processo não pode deixar item órfão em nenhuma delas.',
   'Processo com item de checklist, documento e assinatura.',
   '[{"ordem":1,"acao":"Excluir o processo","resultado_esperado":"As três tabelas filhas zeram para esse processo"}]'::jsonb,
   'Cascade limpo nas três filhas.',
   NULL),

  -- ══════════ CHECKLIST DO PROCESSO ══════════

  (v_mod, 'PCHK-001', 'Montar e concluir o checklist do processo',
   'feliz', 'media', 'aprovado', 'api',
   'O checklist diz o que precisa estar pronto antes de o processo seguir (documentos, conferências). Itens têm ordem, obrigatoriedade e marcação de concluído com autor.',
   'Processo criado.',
   '[{"ordem":1,"acao":"Adicionar dois itens, um obrigatório e um opcional","resultado_esperado":"Itens gravados na ordem"},
     {"ordem":2,"acao":"Concluir o item obrigatório","resultado_esperado":"concluido = true persiste"}]'::jsonb,
   'Checklist gravado, ordenado e com conclusão persistida.',
   NULL),

  (v_mod, 'PCHK-010', 'Concluir processo com item obrigatório pendente',
   'negativo', 'alta', 'aprovado', 'api',
   'Se o item é obrigatório, o processo não deveria chegar a concluído com ele aberto — é a definição de obrigatório. Nenhuma camada do banco impede; se a tela impedir, API e SQL continuam passando por fora.',
   'Processo com item de checklist obrigatório não concluído.',
   '[{"ordem":1,"acao":"Mudar o status do processo para concluido com o item obrigatório aberto","resultado_esperado":"Recusado — obrigatório pendente trava a conclusão"}]'::jsonb,
   'Processo só conclui com os obrigatórios concluídos.',
   'Provável ACHADO. Correção: trigger na transição para concluido conferindo o checklist obrigatório.'),

  -- ══════════ DOCUMENTOS DO PROCESSO ══════════

  (v_mod, 'PDOC-001', 'Anexar documento e versionar por cima',
   'feliz', 'media', 'aprovado', 'api',
   'Documentos do processo têm versão: a v2 aponta a v1 por versao_anterior_id e assume eh_versao_final. É o que garante que a contabilidade sempre olha o arquivo certo.',
   'Processo criado.',
   '[{"ordem":1,"acao":"Anexar contrato v1 como versão final","resultado_esperado":"Documento gravado, versao = 1"},
     {"ordem":2,"acao":"Anexar v2 apontando a v1 e marcar a v2 como final","resultado_esperado":"Cadeia de versões íntegra, v2 final"}]'::jsonb,
   'Versionamento grava a cadeia e a versão final.',
   NULL),

  (v_mod, 'PDOC-010', 'Versão anterior precisa ser do mesmo processo',
   'negativo', 'media', 'aprovado', 'api',
   'versao_anterior_id é FK para a própria tabela, sem exigir o mesmo processo_id. Uma v2 do processo A apontando documento do processo B cria uma cadeia de versões que atravessa processos — e o histórico do documento passa a contar a história errada.',
   'Dois processos, cada um com um documento.',
   '[{"ordem":1,"acao":"Gravar no processo A um documento cuja versão anterior é o documento do processo B","resultado_esperado":"Recusado — a cadeia de versões não cruza processos"}]'::jsonb,
   'Cadeia de versões confinada ao processo.',
   'Provável ACHADO. Correção: trigger conferindo o processo_id da versão anterior.'),

  -- ══════════ ASSINATURAS ══════════

  (v_mod, 'PASS-001', 'Criar solicitação de assinatura com token único',
   'feliz', 'alta', 'aprovado', 'api',
   'Cada assinatura nasce com um token aleatório único — é o segredo do link que o signatário recebe. O UNIQUE do token é a proteção contra colisão; este caso confirma a geração e a unicidade.',
   'Processo com documento que requer assinatura.',
   '[{"ordem":1,"acao":"Criar assinatura para o signatário","resultado_esperado":"Token gerado automaticamente, status pendente"},
     {"ordem":2,"acao":"Tentar gravar outra assinatura com o MESMO token","resultado_esperado":"Recusado pelo UNIQUE"}]'::jsonb,
   'Token nasce único e a duplicata é barrada.',
   NULL),

  -- ══════════ CERTIDÕES ══════════

  (v_mod, 'CERT-001', 'Status da certidão é derivado da validade automaticamente',
   'feliz', 'alta', 'aprovado', 'api',
   'O trigger atualizar_status_certidao classifica pela data: vencida (validade no passado), a_vencer (até 30 dias) ou valida. A auditoria pediu para confirmar essa automação na prática, não só na leitura do código — é o mesmo tema do achado de terceiro_documentos.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Gravar certidão com validade no passado","resultado_esperado":"status = vencida, seja qual for o valor enviado"},
     {"ordem":2,"acao":"Gravar certidão com validade em 15 dias","resultado_esperado":"status = a_vencer"},
     {"ordem":3,"acao":"Gravar certidão com validade em 6 meses","resultado_esperado":"status = valida"}]'::jsonb,
   'As três faixas de validade produzem os três status.',
   NULL),

  (v_mod, 'CERT-010', 'Certidão emitida depois de vencer',
   'negativo', 'media', 'aprovado', 'api',
   'data_emissao posterior a data_validade é um documento que nasceu vencido — não existe certidão assim. Nenhum CHECK compara as duas datas.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Gravar certidão com emissão 2026-12-01 e validade 2026-06-01","resultado_esperado":"Recusado — emissão precisa anteceder a validade"}]'::jsonb,
   'Datas incoerentes não entram.',
   'Provável ACHADO. Correção: CHECK (data_emissao <= data_validade).'),

  (v_mod, 'CERT-011', 'Certidão marcada como irregular não pode virar válida sozinha',
   'excecao', 'alta', 'aprovado', 'api',
   'O CHECK da tabela admite o status irregular — certidão com pendência apontada pelo órgão, mesmo dentro da validade. Mas o trigger de derivação SOBRESCREVE o status em todo insert e update, sem exceção: gravar irregular com validade futura volta como valida. O estado existe no contrato da tabela e é inalcançável na prática — e uma certidão irregular exibida como válida é exatamente o que o fiscal aponta.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Gravar certidão com validade futura e status = irregular","resultado_esperado":"O status irregular é respeitado — a derivação automática só decide entre valida, a_vencer e vencida quando ninguém marcou irregularidade"}]'::jsonb,
   'Irregular marcado permanece irregular.',
   'ACHADO DE DESENHO confirmado na leitura do trigger. Correção sugerida: o trigger preservar NEW.status = irregular (ou derivar apenas quando o status não foi informado).')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE 'Revisão Hub Contábil 07/08: módulo tinha % casos, agora tem % (+%).',
    v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS EXECUTÁVEIS
-- ─────────────────────────────────────────────────────────

-- Helper: processo no cercado.
CREATE OR REPLACE FUNCTION public.qa_novo_hub_processo(
  p_titulo text, p_tipo public.hub_processo_tipo DEFAULT 'admissao'
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.hub_processos (tenant_id, tipo, titulo)
  VALUES (public.qa_sandbox_tenant_id(), p_tipo, p_titulo)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ══ PROC-001: código sequencial ══
CREATE OR REPLACE FUNCTION public.qa_caso_proc_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_p1 uuid; v_p2 uuid; v_p3 uuid;
        v_c1 text; v_c2 text; v_c3 text; v_n1 int; v_n2 int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1; r.passo_acao := 'Criar dois processos de admissão e um de férias sem código';
  r.esperado := 'ADM sequencial próprio; FER começa sequência própria';
  v_p1 := public.qa_novo_hub_processo('[QA-PROC] Admissao 1', 'admissao');
  v_p2 := public.qa_novo_hub_processo('[QA-PROC] Admissao 2', 'admissao');
  v_p3 := public.qa_novo_hub_processo('[QA-PROC] Ferias 1', 'ferias');

  SELECT codigo INTO v_c1 FROM public.hub_processos WHERE id = v_p1;
  SELECT codigo INTO v_c2 FROM public.hub_processos WHERE id = v_p2;
  SELECT codigo INTO v_c3 FROM public.hub_processos WHERE id = v_p3;

  v_n1 := CAST(substring(v_c1 FROM '[0-9]+$') AS int);
  v_n2 := CAST(substring(v_c2 FROM '[0-9]+$') AS int);

  IF v_c1 LIKE 'ADM-%' AND v_c2 LIKE 'ADM-%' AND v_n2 = v_n1 + 1
     AND v_c3 LIKE 'FER-%' THEN
    r.situacao := 'passou';
    r.obtido := format('Códigos gerados: %s, %s (sequência ADM) e %s (sequência FER própria).', v_c1, v_c2, v_c3);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Códigos fora do padrão: %s, %s, %s.', coalesce(v_c1,'nulo'), coalesce(v_c2,'nulo'), coalesce(v_c3,'nulo'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PROC-002: trilha automática de status ══
CREATE OR REPLACE FUNCTION public.qa_caso_proc_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_p uuid; v_n int; v_ant text; v_novo text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_p := public.qa_novo_hub_processo('[QA-PROC] Com Trilha');

  r.passo_ordem := 1;
  r.passo_acao := 'Mudar o status direto no banco, sem passar pela tela';
  r.esperado := 'Trigger grava hub_processo_historico com anterior e novo';
  UPDATE public.hub_processos SET status = 'aguardando_documentos' WHERE id = v_p;

  SELECT count(*) INTO v_n FROM public.hub_processo_historico WHERE processo_id = v_p;
  SELECT status_anterior, status_novo INTO v_ant, v_novo
  FROM public.hub_processo_historico WHERE processo_id = v_p
  ORDER BY created_at DESC LIMIT 1;

  IF v_n >= 1 AND v_ant = 'rascunho' AND v_novo = 'aguardando_documentos' THEN
    r.situacao := 'passou';
    r.obtido := 'O banco registrou a transição por conta própria — a garantia que falta em Metas (MWKF-011) existe aqui.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('REGRESSÃO: mudança de status sem trilha automática (%s linha(s); última %s -> %s).',
      v_n, coalesce(v_ant, 'nula'), coalesce(v_novo, 'nula'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PROC-010: prazo antes da referência ══
CREATE OR REPLACE FUNCTION public.qa_caso_proc_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Criar processo com data_limite anterior à data_referencia';
  r.esperado := 'Recusado — o prazo não pode anteceder a referência';
  BEGIN
    INSERT INTO public.hub_processos (tenant_id, tipo, titulo, data_referencia, data_limite)
    VALUES (public.qa_sandbox_tenant_id(), 'solicitacao_geral', '[QA-PROC] Prazo Invertido',
            DATE '2026-08-10', DATE '2026-08-01');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU processo com prazo anterior à referência — o SLA nasce estourado. '
      'Mesma família de ENQ-013 e TAC-003. Correção: CHECK (data_limite >= data_referencia).';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Datas incoerentes recusadas.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PROC-011: contabilidade de outro tenant ══
CREATE OR REPLACE FUNCTION public.qa_caso_proc_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t2 uuid := public.qa_sandbox2_tenant_id(); v_cont uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;

  INSERT INTO public.hub_contabilidades (tenant_id, nome)
  VALUES (v_t2, '[QA-PROC] Contabilidade do Cliente B') RETURNING id INTO v_cont;

  r.passo_ordem := 1;
  r.passo_acao := 'Criar processo no cercado 1 apontando a contabilidade do cercado 2';
  r.esperado := 'Recusado — processo e contabilidade do mesmo tenant';
  BEGIN
    INSERT INTO public.hub_processos (tenant_id, tipo, titulo, contabilidade_id)
    VALUES (public.qa_sandbox_tenant_id(), 'solicitacao_geral', '[QA-PROC] Cruzado', v_cont);
    r.situacao := 'falhou';
    r.obtido := 'PROCESSO VINCULADO À CONTABILIDADE DE OUTRO CLIENTE: a FK de contabilidade_id '
      'não olha tenant, e o fluxo de envio conversaria com a contabilidade errada. '
      'Mesmo remédio de FER-004 e MCHK-011 — gatilho de coerência de tenant.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Vínculo cruzando tenants recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PROC-012: cascade das filhas ══
CREATE OR REPLACE FUNCTION public.qa_caso_proc_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_p uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_p := public.qa_novo_hub_processo('[QA-PROC] Descartavel');
  INSERT INTO public.hub_processo_checklist (tenant_id, processo_id, item)
  VALUES (v_t, v_p, '[QA] Conferir documentos');
  INSERT INTO public.hub_processo_documentos (tenant_id, processo_id, nome)
  VALUES (v_t, v_p, '[QA] Contrato');
  INSERT INTO public.hub_processo_assinaturas (tenant_id, processo_id, signatario_nome)
  VALUES (v_t, v_p, '[QA] Signatario');

  r.passo_ordem := 1; r.passo_acao := 'Excluir o processo com as três filhas povoadas';
  r.esperado := 'Checklist, documentos e assinaturas zeram juntos';
  DELETE FROM public.hub_processos WHERE id = v_p;

  SELECT (SELECT count(*) FROM public.hub_processo_checklist WHERE processo_id = v_p)
       + (SELECT count(*) FROM public.hub_processo_documentos WHERE processo_id = v_p)
       + (SELECT count(*) FROM public.hub_processo_assinaturas WHERE processo_id = v_p)
  INTO v_orfas;

  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpo nas três filhas.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s registro(s) órfão(s) após excluir o processo.', v_orfas);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PCHK-001: checklist ══
CREATE OR REPLACE FUNCTION public.qa_caso_pchk_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_p uuid; v_item uuid; v_ok boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_p := public.qa_novo_hub_processo('[QA-PCHK] Com Checklist');

  r.passo_ordem := 1; r.passo_acao := 'Adicionar item obrigatório e item opcional';
  r.esperado := 'Itens gravados na ordem';
  INSERT INTO public.hub_processo_checklist (tenant_id, processo_id, item, obrigatorio, ordem)
  VALUES (v_t, v_p, '[QA] Contrato assinado', true, 1)
  RETURNING id INTO v_item;
  INSERT INTO public.hub_processo_checklist (tenant_id, processo_id, item, obrigatorio, ordem)
  VALUES (v_t, v_p, '[QA] Foto 3x4', false, 2);

  r.passo_ordem := 2; r.passo_acao := 'Concluir o item obrigatório';
  r.esperado := 'concluido = true persiste';
  UPDATE public.hub_processo_checklist SET concluido = true WHERE id = v_item;
  SELECT concluido INTO v_ok FROM public.hub_processo_checklist WHERE id = v_item;

  IF v_ok THEN
    r.situacao := 'passou'; r.obtido := 'Checklist gravado, ordenado e com conclusão persistida.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'A conclusão do item não persistiu.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PCHK-010: concluir com obrigatório pendente ══
CREATE OR REPLACE FUNCTION public.qa_caso_pchk_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_p uuid; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_p := public.qa_novo_hub_processo('[QA-PCHK] Conclusao Precoce');
  INSERT INTO public.hub_processo_checklist (tenant_id, processo_id, item, obrigatorio, concluido)
  VALUES (v_t, v_p, '[QA] Documento obrigatorio pendente', true, false);

  r.passo_ordem := 1;
  r.passo_acao := 'Mudar o status do processo para concluido com item obrigatório aberto';
  r.esperado := 'Recusado — obrigatório pendente trava a conclusão';
  BEGIN
    UPDATE public.hub_processos SET status = 'concluido' WHERE id = v_p;
    SELECT status::text INTO v_status FROM public.hub_processos WHERE id = v_p;
    IF v_status = 'concluido' THEN
      r.situacao := 'falhou';
      r.obtido := 'O PROCESSO CONCLUIU COM ITEM OBRIGATÓRIO ABERTO — obrigatório sem consequência '
        'é só um adjetivo. Correção: trigger na transição para concluido conferindo o checklist.';
    ELSE
      r.situacao := 'passou'; r.obtido := 'Conclusão travada pelo checklist obrigatório.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Conclusão recusada: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PDOC-001: versionamento ══
CREATE OR REPLACE FUNCTION public.qa_caso_pdoc_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_p uuid; v_v1 uuid; v_v2 uuid; d record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_p := public.qa_novo_hub_processo('[QA-PDOC] Com Versoes');

  r.passo_ordem := 1; r.passo_acao := 'Anexar contrato v1 como versão final';
  r.esperado := 'Documento gravado, versao = 1';
  INSERT INTO public.hub_processo_documentos
    (tenant_id, processo_id, tipo, nome, versao, eh_versao_final)
  VALUES (v_t, v_p, 'contrato', '[QA] Contrato v1', 1, true)
  RETURNING id INTO v_v1;

  r.passo_ordem := 2; r.passo_acao := 'Anexar v2 apontando a v1, v2 vira a final';
  r.esperado := 'Cadeia de versões íntegra';
  INSERT INTO public.hub_processo_documentos
    (tenant_id, processo_id, tipo, nome, versao, versao_anterior_id, eh_versao_final)
  VALUES (v_t, v_p, 'contrato', '[QA] Contrato v2', 2, v_v1, true)
  RETURNING id INTO v_v2;
  UPDATE public.hub_processo_documentos SET eh_versao_final = false WHERE id = v_v1;

  SELECT * INTO d FROM public.hub_processo_documentos WHERE id = v_v2;
  IF d.versao = 2 AND d.versao_anterior_id = v_v1 AND d.eh_versao_final THEN
    r.situacao := 'passou'; r.obtido := 'Cadeia v1 -> v2 gravada; v2 é a versão final.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'A cadeia de versões não persistiu como esperado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PDOC-010: versão anterior de outro processo ══
CREATE OR REPLACE FUNCTION public.qa_caso_pdoc_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pa uuid; v_pb uuid; v_doc_b uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_pa := public.qa_novo_hub_processo('[QA-PDOC] Processo A');
  v_pb := public.qa_novo_hub_processo('[QA-PDOC] Processo B');
  INSERT INTO public.hub_processo_documentos (tenant_id, processo_id, nome)
  VALUES (v_t, v_pb, '[QA] Documento do B') RETURNING id INTO v_doc_b;

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar no processo A um documento com versão anterior do processo B';
  r.esperado := 'Recusado — a cadeia de versões não cruza processos';
  BEGIN
    INSERT INTO public.hub_processo_documentos
      (tenant_id, processo_id, nome, versao, versao_anterior_id)
    VALUES (v_t, v_pa, '[QA] v2 orfa de contexto', 2, v_doc_b);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU cadeia de versões cruzando processos: a v2 do processo A aponta '
      'documento do processo B, e o histórico do documento passa a contar a história errada. '
      'Correção: trigger conferindo que versao_anterior_id pertence ao mesmo processo.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Cadeia cruzando processos recusada: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ PASS-001: token único ══
CREATE OR REPLACE FUNCTION public.qa_caso_pass_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_p uuid; v_token text; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_p := public.qa_novo_hub_processo('[QA-PASS] Para Assinar');

  r.passo_ordem := 1; r.passo_acao := 'Criar assinatura para o signatário';
  r.esperado := 'Token gerado automaticamente, status pendente';
  INSERT INTO public.hub_processo_assinaturas (tenant_id, processo_id, signatario_nome)
  VALUES (v_t, v_p, '[QA] Maria Signataria')
  RETURNING token, status::text INTO v_token, v_status;

  IF v_token IS NULL OR length(v_token) < 32 OR v_status <> 'pendente' THEN
    r.situacao := 'falhou';
    r.obtido := format('Token/status fora do esperado (token %s, status %s).',
      coalesce(left(v_token, 12) || '...', 'nulo'), v_status);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Tentar gravar outra assinatura com o MESMO token';
  r.esperado := 'Recusado pelo UNIQUE';
  BEGIN
    INSERT INTO public.hub_processo_assinaturas (tenant_id, processo_id, signatario_nome, token)
    VALUES (v_t, v_p, '[QA] Clone', v_token);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU token duplicado — dois links de assinatura com o mesmo segredo.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Token nasce único e a duplicata é barrada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ CERT-001: derivação do status ══
CREATE OR REPLACE FUNCTION public.qa_caso_cert_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_s1 text; v_s2 text; v_s3 text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar certidões com validade no passado, em 15 dias e em 6 meses';
  r.esperado := 'Status derivados: vencida, a_vencer, valida';

  INSERT INTO public.hub_certidoes (tenant_id, tipo, orgao_emissor, data_emissao, data_validade)
  VALUES (v_t, 'fgts', '[QA] Caixa', CURRENT_DATE - 200, CURRENT_DATE - 10)
  RETURNING status INTO v_s1;

  INSERT INTO public.hub_certidoes (tenant_id, tipo, orgao_emissor, data_emissao, data_validade)
  VALUES (v_t, 'cndt', '[QA] TST', CURRENT_DATE - 30, CURRENT_DATE + 15)
  RETURNING status INTO v_s2;

  INSERT INTO public.hub_certidoes (tenant_id, tipo, orgao_emissor, data_emissao, data_validade)
  VALUES (v_t, 'receita_federal', '[QA] RFB', CURRENT_DATE - 30, CURRENT_DATE + 180)
  RETURNING status INTO v_s3;

  IF v_s1 = 'vencida' AND v_s2 = 'a_vencer' AND v_s3 = 'valida' THEN
    r.situacao := 'passou';
    r.obtido := 'A automação classifica as três faixas corretamente — confirmada na prática, como a auditoria pediu.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Derivação errada: passado=%s (esperado vencida), 15 dias=%s (a_vencer), 6 meses=%s (valida).',
      v_s1, v_s2, v_s3);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ CERT-010: emissão depois da validade ══
CREATE OR REPLACE FUNCTION public.qa_caso_cert_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar certidão com emissão posterior à validade';
  r.esperado := 'Recusado — emissão precisa anteceder a validade';
  BEGIN
    INSERT INTO public.hub_certidoes (tenant_id, tipo, orgao_emissor, data_emissao, data_validade)
    VALUES (public.qa_sandbox_tenant_id(), 'estadual', '[QA] Sefaz',
            CURRENT_DATE + 120, CURRENT_DATE + 30);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU certidão emitida depois de vencer — documento que nasceu vencido não existe. '
      'Correção: CHECK (data_emissao <= data_validade).';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Datas incoerentes recusadas.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ CERT-011: irregular inalcançável ══
CREATE OR REPLACE FUNCTION public.qa_caso_cert_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar certidão com validade futura e status = irregular';
  r.esperado := 'O status irregular marcado é respeitado';
  INSERT INTO public.hub_certidoes (tenant_id, tipo, orgao_emissor, data_emissao, data_validade, status)
  VALUES (public.qa_sandbox_tenant_id(), 'previdenciaria', '[QA] INSS',
          CURRENT_DATE - 10, CURRENT_DATE + 180, 'irregular')
  RETURNING status INTO v_status;

  IF v_status = 'irregular' THEN
    r.situacao := 'passou'; r.obtido := 'Irregular marcado permaneceu irregular.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('CERTIDÃO IRREGULAR VIROU %s SOZINHA: o trigger de derivação sobrescreve o status '
      'em todo insert/update, sem exceção — o estado irregular existe no CHECK da tabela e é inalcançável '
      'na prática. Certidão com pendência exibida como válida é o que o fiscal aponta. Correção: o trigger '
      'preservar o irregular informado.', upper(v_status));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('PROC-001', 'qa_caso_proc_001', true),
  ('PROC-002', 'qa_caso_proc_002', true),
  ('PROC-010', 'qa_caso_proc_010', true),
  ('PROC-011', 'qa_caso_proc_011', true),
  ('PROC-012', 'qa_caso_proc_012', true),
  ('PCHK-001', 'qa_caso_pchk_001', true),
  ('PCHK-010', 'qa_caso_pchk_010', true),
  ('PDOC-001', 'qa_caso_pdoc_001', true),
  ('PDOC-010', 'qa_caso_pdoc_010', true),
  ('PASS-001', 'qa_caso_pass_001', true),
  ('CERT-001', 'qa_caso_cert_001', true),
  ('CERT-010', 'qa_caso_cert_010', true),
  ('CERT-011', 'qa_caso_cert_011', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'documentos-governanca/hub-contabil');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
