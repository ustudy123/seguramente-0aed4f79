-- =========================================================
-- QA — Hub Contábil: 2ª leva — calendário, catálogo e templates (11/08)
--
-- Fecha o que o cabeçalho da revisão de 08/08 (20260808180000) deixou
-- registrado como "próxima leva": as tabelas de apoio com regra própria
-- que ainda não tinham nenhum caso.
--
--   hub_calendario_envios / hub_calendario_status -> o calendário de
--     obrigações mensais da contabilidade (dia-limite 1..31, um status
--     por competência)
--   hub_catalogo_documentos -> o catálogo que diz qual documento cada
--     tipo de processo exige, com obrigatoriedade e retenção
--   hub_checklist_templates -> os modelos que semeiam o checklist dos
--     processos (globais, com tenant nulo, ou do cliente)
--
-- O padrão de leitura se repete: o banco protege parte (CHECK do
-- dia-limite, UNIQUE da competência) e deixa buracos conhecidos da
-- casa — vínculo sem coerência de tenant e listas fechadas que vivem
-- só como texto livre. Onde o sistema diverge do caso, a rotina falha
-- de propósito e o achado vai para o relatório.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE.
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

  (v_mod, 'HCAL-001', 'Calendário de envios: item mensal com status por competência',
   'feliz', 'media', 'aprovado', 'api',
   'O calendário lista o que precisa ser enviado à contabilidade todo mês (folha, guias, eventos), cada item com dia-limite. O status materializa o andamento por competência — um por item/competência, com quem concluiu e quando.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar item de calendário com dia-limite 5","resultado_esperado":"Item gravado"},
     {"ordem":2,"acao":"Marcar a competência corrente como concluída","resultado_esperado":"Status gravado com autor e data"}]'::jsonb,
   'Item e status gravados e relidos por inteiro.',
   NULL),

  (v_mod, 'HCAL-010', 'Dia-limite fora de 1..31 é recusado',
   'negativo', 'media', 'aprovado', 'api',
   'O CHECK do dia-limite é a única proteção estrutural do calendário — dia 32 ou dia 0 não existe em mês nenhum. Este caso a protege contra regressão.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar item com dia-limite 32","resultado_esperado":"Recusado pelo CHECK"},
     {"ordem":2,"acao":"Criar item com dia-limite 0","resultado_esperado":"Recusado"}]'::jsonb,
   'Só entram dias de 1 a 31.',
   NULL),

  (v_mod, 'HCAL-011', 'Uma competência, um status — a duplicata é barrada',
   'negativo', 'media', 'aprovado', 'api',
   'O UNIQUE (tenant, calendário, competência) impede dois status para o mesmo item no mesmo mês — sem ele, um item poderia constar concluído e pendente ao mesmo tempo.',
   'Item de calendário com status na competência corrente.',
   '[{"ordem":1,"acao":"Inserir segundo status para o mesmo item e competência","resultado_esperado":"Recusado pelo UNIQUE"}]'::jsonb,
   'A duplicata não entra.',
   NULL),

  (v_mod, 'HCAL-012', 'Status não pode apontar calendário de outro cliente',
   'negativo', 'alta', 'aprovado', 'api',
   'A FK de calendario_id não olha tenant: um status do cliente A pode apontar item de calendário do cliente B — e o andamento de um cliente contaminaria o painel do outro. Mesma família de FER-004, MCHK-011 e PROC-011.',
   'Cercados 1 e 2; item de calendário no cercado 2.',
   '[{"ordem":1,"acao":"Inserir status no tenant 1 apontando calendário do tenant 2","resultado_esperado":"Recusado — status e calendário do mesmo tenant"}]'::jsonb,
   'Vínculo cruzando tenants não entra.',
   'Mesmo remédio dos demais: gatilho de coerência de tenant.'),

  (v_mod, 'HCAT-001', 'Catálogo: documento exigido por tipo de processo',
   'feliz', 'media', 'aprovado', 'api',
   'O catálogo parametriza qual documento cada tipo de processo exige (ex.: admissão pede contrato e ficha de registro), com obrigatoriedade, assinatura e prazo de retenção. É o que alimenta o checklist automático do processo.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Cadastrar documento do catálogo para o tipo admissao, obrigatório, com retenção de 5 anos","resultado_esperado":"Item gravado com tipo de processo, obrigatoriedade e retenção"}]'::jsonb,
   'Catálogo gravado e relido por inteiro.',
   NULL),

  (v_mod, 'HCAT-010', 'Obrigatoriedade e retenção sem faixa',
   'negativo', 'media', 'aprovado', 'api',
   'obrigatoriedade é texto livre (sem lista fechada) e prazo_retencao_anos aceita negativo. Obrigatoriedade inventada quebra o semeador de checklist em silêncio; retenção negativa é um prazo que venceu antes de existir.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Cadastrar item com obrigatoriedade = talvez","resultado_esperado":"Recusado — lista fechada (obrigatorio/opcional/condicional)"},
     {"ordem":2,"acao":"Cadastrar item com retenção de -5 anos","resultado_esperado":"Recusado — retenção é não negativa"}]'::jsonb,
   'Só entram obrigatoriedades previstas e retenção não negativa.',
   'Provável ACHADO nos dois passos — mesma família de OBRG-020 (texto livre) e das faixas sem CHECK. Correção: CHECK de lista e CHECK (prazo_retencao_anos >= 0).'),

  (v_mod, 'HTPL-001', 'Template de checklist global convive com o do cliente',
   'feliz', 'media', 'aprovado', 'api',
   'Os templates semeiam o checklist dos processos por tipo. Com tenant nulo o template é GLOBAL (vale para todos); com tenant, é do cliente. O caso grava o do cliente e confere o contrato do global por leitura — escrever configuração global de dentro de um teste contaminaria todos os clientes, e a cerca do cercado impede exatamente isso.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar template do cliente para o tipo ferias","resultado_esperado":"Gravado com tenant do cercado"},
     {"ordem":2,"acao":"Tentar criar template GLOBAL (tenant nulo) de dentro do teste","resultado_esperado":"Bloqueado pela cerca do cercado — teste não escreve configuração de todos os clientes"},
     {"ordem":3,"acao":"Conferir o contrato do global por catálogo","resultado_esperado":"tenant_id anulável — o modelo global existe"}]'::jsonb,
   'Cliente grava; global é protegido da escrita de teste e o contrato existe.',
   NULL),

  (v_mod, 'HTPL-010', 'Tipo do template precisa casar com os tipos de processo',
   'negativo', 'media', 'aprovado', 'api',
   'hub_processos.tipo é enum fechado (admissao, demissao, ferias...), mas o tipo do template é texto livre. Template com tipo inventado nunca é semeado em processo nenhum — vira configuração morta que a tela lista e o processo ignora.',
   'Cercado disponível.',
   '[{"ordem":1,"acao":"Criar template com tipo = processo_inventado","resultado_esperado":"Recusado — o tipo precisa existir no enum hub_processo_tipo"}]'::jsonb,
   'Só entram tipos que o processo reconhece.',
   'Provável ACHADO. Correção: converter a coluna para o enum ou CHECK contra os rótulos do enum.')

  ON CONFLICT (codigo) DO NOTHING;

  SELECT count(*) INTO v_depois FROM public.qa_casos_teste WHERE modulo_id = v_mod;
  RAISE NOTICE '2ª leva Hub: módulo tinha % casos, agora tem % (+%).', v_antes, v_depois, v_depois - v_antes;
END $doc$;

-- ─────────────────────────────────────────────────────────
-- ROTINAS
-- ─────────────────────────────────────────────────────────

-- ══ HCAL-001 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cal uuid; s record; v_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar item de calendário com dia-limite 5';
  r.esperado := 'Item gravado';
  INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
  VALUES (v_t, '[QA-HCAL] Enviar espelhos de ponto', 'envio', 'folha', 5)
  RETURNING id INTO v_cal;

  r.passo_ordem := 2; r.passo_acao := 'Marcar a competência corrente como concluída';
  r.esperado := 'Status gravado com autor e data';
  INSERT INTO public.hub_calendario_status
    (tenant_id, calendario_id, competencia, status, concluido_por, concluido_em)
  VALUES (v_t, v_cal, v_comp, 'concluido', '[QA] Agente', now());

  SELECT * INTO s FROM public.hub_calendario_status
  WHERE calendario_id = v_cal AND competencia = v_comp;
  IF s.status = 'concluido' AND s.concluido_por IS NOT NULL AND s.concluido_em IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'Item e status gravados por inteiro, com autor e data.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'O status não persistiu como gravado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAL-010 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar item com dia-limite 32';
  r.esperado := 'Recusado pelo CHECK (1..31)';
  BEGIN
    INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
    VALUES (v_t, '[QA-HCAL] Dia 32', 'envio', 'folha', 32);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU dia-limite 32 — dia que não existe em mês nenhum.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusado 32.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Criar item com dia-limite 0';
  r.esperado := 'Recusado';
  BEGIN
    INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
    VALUES (v_t, '[QA-HCAL] Dia 0', 'envio', 'folha', 0);
    r.situacao := 'falhou'; r.obtido := 'Recusou 32 mas ACEITOU 0.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Só entram dias de 1 a 31 — o CHECK segue de pé.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAL-011 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cal uuid; v_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  PERFORM public.qa_modo_ligar();
  INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
  VALUES (v_t, '[QA-HCAL] Sem Duplicata', 'envio', 'guias', 10) RETURNING id INTO v_cal;
  INSERT INTO public.hub_calendario_status (tenant_id, calendario_id, competencia, status)
  VALUES (v_t, v_cal, v_comp, 'pendente');

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segundo status para o mesmo item e competência';
  r.esperado := 'Recusado pelo UNIQUE (tenant, calendário, competência)';
  BEGIN
    INSERT INTO public.hub_calendario_status (tenant_id, calendario_id, competencia, status)
    VALUES (v_t, v_cal, v_comp, 'concluido');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU dois status para a mesma competência — o item pode constar concluído e pendente ao mesmo tempo.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Uma competência, um status — duplicata barrada pelo UNIQUE.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAL-012 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_cal_t2 uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;
  INSERT INTO public.hub_calendario_envios (tenant_id, titulo, tipo, categoria, dia_limite)
  VALUES (v_t2, '[QA-HCAL] Calendario do Cliente B', 'envio', 'folha', 15) RETURNING id INTO v_cal_t2;

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir status no tenant 1 apontando calendário do tenant 2';
  r.esperado := 'Recusado — status e calendário do mesmo tenant';
  BEGIN
    INSERT INTO public.hub_calendario_status (tenant_id, calendario_id, competencia, status)
    VALUES (v_t1, v_cal_t2, to_char(CURRENT_DATE, 'YYYY-MM'), 'pendente');
    r.situacao := 'falhou';
    r.obtido := 'STATUS CRUZANDO TENANTS ACEITO: o andamento do cliente A ficou preso a item de calendário do cliente B. Mesma família de FER-004, MCHK-011 e PROC-011 — mesmo remédio, gatilho de coerência de tenant.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou'; r.obtido := 'Vínculo cruzando tenants recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAT-001 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcat_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); c record;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar documento do catálogo para o tipo admissao, obrigatório, retenção de 5 anos';
  r.esperado := 'Item gravado com tipo de processo, obrigatoriedade e retenção';
  INSERT INTO public.hub_catalogo_documentos
    (tenant_id, nome, processo_tipo, obrigatoriedade, requer_assinatura, prazo_retencao_anos, ordem)
  VALUES (v_t, '[QA-HCAT] Contrato de Trabalho', 'admissao', 'obrigatorio', true, 5, 1)
  RETURNING * INTO c;

  IF c.processo_tipo::text = 'admissao' AND c.obrigatoriedade = 'obrigatorio' AND c.prazo_retencao_anos = 5 THEN
    r.situacao := 'passou'; r.obtido := 'Catálogo gravado e relido por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'O item do catálogo não persistiu como gravado.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HCAT-010 ══
CREATE OR REPLACE FUNCTION public.qa_caso_hcat_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_livre boolean := false; v_neg boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1; r.passo_acao := 'Cadastrar item com obrigatoriedade = talvez';
  r.esperado := 'Recusado — lista fechada (obrigatorio/opcional/condicional)';
  BEGIN
    INSERT INTO public.hub_catalogo_documentos (tenant_id, nome, processo_tipo, obrigatoriedade, ordem)
    VALUES (v_t, '[QA-HCAT] Obrigatoriedade Livre', 'admissao', 'talvez', 90);
    v_livre := true;
  EXCEPTION WHEN check_violation THEN v_livre := false;
  END;

  r.passo_ordem := 2; r.passo_acao := 'Cadastrar item com retenção de -5 anos';
  r.esperado := 'Recusado — retenção é não negativa';
  BEGIN
    INSERT INTO public.hub_catalogo_documentos (tenant_id, nome, processo_tipo, obrigatoriedade, prazo_retencao_anos, ordem)
    VALUES (v_t, '[QA-HCAT] Retencao Negativa', 'admissao', 'obrigatorio', -5, 91);
    v_neg := true;
  EXCEPTION WHEN check_violation THEN v_neg := false;
  END;

  IF NOT v_livre AND NOT v_neg THEN
    r.situacao := 'passou'; r.obtido := 'Obrigatoriedade fora da lista e retenção negativa recusadas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACEITOU o que não devia (obrigatoriedade livre: %s; retenção negativa: %s). '
      || 'Obrigatoriedade é texto sem lista fechada — valor inventado quebra o semeador de checklist '
      || 'em silêncio; retenção negativa é prazo que venceu antes de existir. Correção: CHECK de '
      || 'lista (obrigatorio/opcional/condicional) e CHECK (prazo_retencao_anos >= 0).', v_livre, v_neg);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HTPL-001 ══
CREATE OR REPLACE FUNCTION public.qa_caso_htpl_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cliente uuid; v_global_bloqueado boolean := false; v_anulavel boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Criar template do cliente para o tipo ferias';
  r.esperado := 'Gravado com tenant do cercado';
  INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, obrigatorio, ordem)
  VALUES (v_t, 'ferias', '[QA-HTPL] Conferencia interna do cliente', false, 91)
  RETURNING id INTO v_cliente;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar criar template GLOBAL (tenant nulo) de dentro do teste';
  r.esperado := 'Bloqueado pela cerca do cercado';
  BEGIN
    INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, obrigatorio, ordem)
    VALUES (NULL, 'ferias', '[QA-HTPL] Global indevido', true, 90);
    v_global_bloqueado := false;
  EXCEPTION WHEN OTHERS THEN
    v_global_bloqueado := true;
  END;

  r.passo_ordem := 3;
  r.passo_acao := 'Conferir o contrato do global por catálogo';
  r.esperado := 'tenant_id anulável — o modelo global existe';
  SELECT (is_nullable = 'YES') INTO v_anulavel
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hub_checklist_templates'
    AND column_name = 'tenant_id';

  IF v_cliente IS NOT NULL AND v_global_bloqueado AND COALESCE(v_anulavel, false) THEN
    r.situacao := 'passou';
    r.obtido := 'Template do cliente gravado; a cerca impediu o teste de escrever configuração global (proteção correta); o contrato global (tenant nulo) existe no schema.';
  ELSIF NOT v_global_bloqueado THEN
    r.situacao := 'falhou';
    r.obtido := 'O TESTE CONSEGUIU ESCREVER TEMPLATE GLOBAL: uma rotina de QA gravou configuração que vale para TODOS os clientes — a cerca do cercado não cobre escrita com tenant nulo nesta tabela.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Template do cliente: %s; tenant_id anulável: %s.', v_cliente IS NOT NULL, v_anulavel);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ HTPL-010 ══
CREATE OR REPLACE FUNCTION public.qa_caso_htpl_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar template com tipo = processo_inventado';
  r.esperado := 'Recusado — o tipo precisa existir no enum hub_processo_tipo';
  BEGIN
    INSERT INTO public.hub_checklist_templates (tenant_id, tipo, item, obrigatorio, ordem)
    VALUES (v_t, 'processo_inventado', '[QA-HTPL] Item orfao', true, 95);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU template com tipo que nenhum processo reconhece — configuração morta que a '
      || 'tela lista e o semeador de checklist nunca usa. hub_processos.tipo é enum fechado; o tipo '
      || 'do template é texto livre. Correção: converter a coluna para o enum ou CHECK contra os rótulos.';
  EXCEPTION WHEN check_violation OR invalid_text_representation THEN
    r.situacao := 'passou'; r.obtido := 'Tipo fora do enum recusado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina e rodar a bateria do módulo
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('HCAL-001', 'qa_caso_hcal_001', true),
  ('HCAL-010', 'qa_caso_hcal_010', true),
  ('HCAL-011', 'qa_caso_hcal_011', true),
  ('HCAL-012', 'qa_caso_hcal_012', true),
  ('HCAT-001', 'qa_caso_hcat_001', true),
  ('HCAT-010', 'qa_caso_hcat_010', true),
  ('HTPL-001', 'qa_caso_htpl_001', true),
  ('HTPL-010', 'qa_caso_htpl_010', true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'documentos-governanca/hub-contabil');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bateria não rodou agora (%). As rotinas ficam registradas e entram na próxima execução agendada.', SQLERRM;
END $roda$;
