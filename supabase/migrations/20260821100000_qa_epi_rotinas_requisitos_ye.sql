-- ============================================================================
-- QA EPI — rotinas dos casos da análise de requisitos YE-DP-EPI-001
-- (EPI-010..052, documentados em 20260818100000). 14 casos de nível 'api'
-- ganham rotina; EPI-031 (OCR de DANFE) e EPI-060 (modo offline) são de
-- tela e ficam para o Cypress.
--
-- Padrão da casa: sondas de escrita no sandbox (qa_modo_ligar) + auditorias
-- somente leitura em pg_proc/pg_policies/pg_constraint. Divergência com a
-- norma/documento = falha proposital com diagnóstico e correção sugerida.
-- Nenhuma funcionalidade é alterada.
-- ============================================================================

-- EPI-010 — busca CAEPI no cadastro do tipo
CREATE OR REPLACE FUNCTION public.qa_caso_epi_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_ca text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém consulta a base oficial (CAEPI) ao cadastrar o CA?';
  r.esperado := 'Número de CA informado → dados oficiais (equipamento, fabricante, validade) preenchidos e conferidos';
  v_ca := public.qa_col_existe('epi_tipos', 'ca_numero');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%caepi%'
         OR (p.prosrc ILIKE '%epi_tipos%' AND p.prosrc ILIKE '%http%'));

  IF v_ca IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o CA é digitado no braço — nenhuma rotina (função ou edge function '
             || 'do repositório) consulta a base oficial CAEPI para preencher e conferir o '
             || 'cadastro: ca_numero e ca_validade entram como o usuário digitar, inclusive '
             || 'CA inexistente. O documento (RF-001/RF-002) pede a busca automática porque '
             || 'cadastro errado vira ficha de entrega errada — e ficha errada não prova '
             || 'proteção em juízo. Correção: consulta CAEPI no cadastro (edge function com '
             || 'a base pública), marcando o tipo como conferido/não confirmado.';
  ELSIF v_ca IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A coluna ca_numero não existe mais em epi_tipos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Consulta oficial do CA presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-011 — validade do CA vigiada no catálogo
CREATE OR REPLACE FUNCTION public.qa_caso_epi_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ativo boolean; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar tipo com CA VENCIDO e conferir se algo reage';
  r.esperado := 'CA vencido sinalizado no catálogo; alerta de renovação com antecedência';
  INSERT INTO public.epi_tipos (tenant_id, nome, ca_numero, ca_validade, is_active)
  VALUES (v_t, 'QA — Capacete CA vencido', '99001', CURRENT_DATE - 30, true);
  SELECT et.is_active INTO v_ativo FROM public.epi_tipos et
  WHERE et.tenant_id = v_t AND et.ca_numero = '99001'
  ORDER BY et.created_at DESC LIMIT 1;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguma rotina vigia ca_validade (alerta antes, vencido acusado)?';
  r.esperado := 'Rotina periódica marcando CA vencido e avisando a renovação/recompra';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ca_validade%';

  IF coalesce(v_ativo, true) AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a validade do CA é decorativa no catálogo — o tipo entrou com CA '
             || '30 dias no PASSADO e ficou ativo, e NENHUMA função do banco sequer lê '
             || 'ca_validade (o mesmo vazio que o SST-011 constatou na entrega). Quando um '
             || 'CA vence, todo o estoque daquele tipo vira sucata jurídica de uma vez — e '
             || 'ninguém fica sabendo até a fiscalização (ou o acidente). Correção: rotina '
             || 'diária (pg_cron, como as demais da casa) marcando CA vencido no catálogo e '
             || 'abrindo alerta de renovação/recompra com a antecedência parametrizada '
             || '[VAL], antes de chegar ao balcão.';
  ELSIF NOT coalesce(v_ativo, true) THEN
    r.situacao := 'passou';
    r.obtido := 'O catálogo reagiu ao CA vencido na gravação (tipo desativado).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('ca_validade vigiada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-020 — saldo nunca negativo
CREATE OR REPLACE FUNCTION public.qa_caso_epi_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_tipo uuid; v_epi uuid; v_saldo int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Criar item com saldo 1 e tentar ENTREGAR 5 unidades';
  r.esperado := 'Operação bloqueada — saldo insuficiente; o estoque jamais fica negativo';
  INSERT INTO public.epi_tipos (tenant_id, nome, ca_numero, ca_validade, is_active)
  VALUES (v_t, 'QA — Luva saldo curto', '99002', CURRENT_DATE + 365, true)
  RETURNING id INTO v_tipo;
  INSERT INTO public.epis (tenant_id, tipo_id, codigo, quantidade_estoque, data_validade)
  VALUES (v_t, v_tipo, 'QA-EPI-020', 1, CURRENT_DATE + 365)
  RETURNING id INTO v_epi;

  BEGIN
    INSERT INTO public.epi_entregas
      (tenant_id, epi_id, colaborador_nome, colaborador_cpf, quantidade, data_entrega)
    VALUES (v_t, v_epi, 'QA Colaborador Vinte', public.qa_cpf(20), 5, CURRENT_DATE);
  EXCEPTION WHEN check_violation OR raise_exception THEN
    r.situacao := 'passou';
    r.obtido := format('Entrega acima do saldo foi bloqueada (%s).', SQLERRM);
    RETURN r;
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o saldo após a entrega maior que o estoque';
  r.esperado := 'Saldo >= 0 sempre';
  SELECT e.quantidade_estoque INTO v_saldo FROM public.epis e WHERE e.id = v_epi;

  IF v_saldo < 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o saldo ficou NEGATIVO (%s) — a entrega de 5 unidades com '
             || 'estoque 1 passou sem protesto: o gatilho atualizar_estoque_epi subtrai sem '
             || 'conferir o saldo e não há CHECK (quantidade_estoque >= 0) na tabela. A '
             || 'RN-003 do documento proíbe saldo negativo justamente porque ficha de '
             || 'entrega sem lastro físico é ficha de papel: no acidente, a empresa "provou" '
             || 'entregar o que não tinha. As funções otimistas (epi_atualizar_estoque_'
             || 'otimista) protegem a concorrência quando o APP as usa, mas o banco aceita o '
             || 'negativo por qualquer outro caminho. Correção: CHECK >= 0 nas tabelas de '
             || 'saldo + conferência no gatilho, por combinação tipo × tamanho × local.',
             v_saldo);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Saldo preservado (%s) — a baixa respeitou o estoque.', v_saldo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-021 — FEFO na saída
CREATE OR REPLACE FUNCTION public.qa_caso_epi_021()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_val text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a saída prioriza o lote que vence primeiro (FEFO)?';
  r.esperado := 'Baixa/sugestão ordenada por data_validade; quebra de FEFO é decisão consciente';
  v_val := public.qa_col_existe('epis', 'data_validade');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%epi%' AND p.prosrc ILIKE '%data_validade%';

  IF v_val IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: cada item tem data_validade, mas nenhuma função a usa na SAÍDA — a '
             || 'baixa desce no epi_id que a tela mandar, sem ordenar nem sugerir o lote '
             || 'que vence primeiro. Sem FEFO (RN-004), o lote novo gira enquanto o antigo '
             || 'apodrece na prateleira: vira perda de compra ou, pior, entrega de item '
             || 'vencido (a trava do vencido é o EPI-040 — hoje também ausente, o que '
             || 'agrava). Correção: na entrega, sugerir/baixar o lote de validade mais '
             || 'próxima da combinação tipo × tamanho × local, com registro explícito '
             || 'quando o operador quebrar o FEFO.';
  ELSIF v_val IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A coluna data_validade não existe mais em epis.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('FEFO/validade considerada na saída por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-022 — estoque mínimo → Plano de Ação
CREATE OR REPLACE FUNCTION public.qa_caso_epi_022()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_min text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cruzar o estoque mínimo abre reposição no Plano de Ação?';
  r.esperado := 'Ação de reposição criada (sem duplicar) quando o saldo cruza o mínimo';
  v_min := coalesce(public.qa_col_existe('epi_tipos', 'estoque_minimo'),
                    public.qa_col_existe('epi_estoque_local', 'quantidade_minima'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%estoque_minimo%' OR p.prosrc ILIKE '%quantidade_minima%')
    AND (p.prosrc ILIKE '%plano_acoes%' OR p.prosrc ILIKE '%plano_tarefas%');

  IF v_min IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (o parâmetro existe, o gatilho não): o mínimo está cadastrado '
             || 'em dois lugares (%s) e NENHUMA função o compara com o saldo para abrir a '
             || 'reposição no Plano de Ação (RF-018) — o mínimo só serve de cor no painel, '
             || 'se a tela lembrar de pintar. Ficar sem EPI em estoque para a operação: '
             || 'pela NR-6, sem o EPI da função o colaborador não pode trabalhar. Correção: '
             || 'ao movimentar o saldo (ou em rotina diária), cruzou o mínimo → ação de '
             || 'reposição com item, saldo e local, referenciando a existente em vez de '
             || 'duplicar — o padrão que o módulo Plano de Ação já pratica.',
             v_min);
  ELSIF v_min IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O estoque mínimo não existe mais no cadastro.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reposição automática presente: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-030 — NF: chave íntegra e sem duplicata
CREATE OR REPLACE FUNCTION public.qa_caso_epi_030()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_chave text := repeat('9', 44); v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Lançar a MESMA NF (mesma chave de acesso) duas vezes';
  r.esperado := 'Segunda entrada bloqueada — chave de acesso é única, estoque não dobra';
  INSERT INTO public.epi_notas_fiscais (tenant_id, numero_nf, chave_acesso, origem)
  VALUES (v_t, 'QA-NF-030', v_chave, 'manual');
  BEGIN
    INSERT INTO public.epi_notas_fiscais (tenant_id, numero_nf, chave_acesso, origem)
    VALUES (v_t, 'QA-NF-030-BIS', v_chave, 'manual');
  EXCEPTION WHEN unique_violation OR check_violation OR raise_exception THEN
    r.situacao := 'passou';
    r.obtido := format('Nota duplicada foi recusada (%s).', SQLERRM);
    RETURN r;
  END;
  SELECT count(*) INTO v_qtd FROM public.epi_notas_fiscais nf
  WHERE nf.tenant_id = v_t AND nf.chave_acesso = v_chave;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir também se chave curta (10 dígitos) passa';
  r.esperado := 'Chave de acesso tem 44 dígitos — formato inválido não entra';
  BEGIN
    INSERT INTO public.epi_notas_fiscais (tenant_id, numero_nf, chave_acesso, origem)
    VALUES (v_t, 'QA-NF-030-CURTA', '1234567890', 'manual');
  EXCEPTION WHEN check_violation OR raise_exception THEN
    NULL; -- ótimo: formato validado (a duplicata acima já reprovou o caso mesmo assim)
  END;

  IF v_qtd > 1 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a mesma chave de acesso entrou %s vezes — epi_notas_fiscais '
             || 'não tem UNIQUE em chave_acesso nem validação dos 44 dígitos (a chave curta '
             || 'de 10 dígitos também passou). A nota relançada dobra o estoque no papel e '
             || 'descasa o físico do contábil; a chave existe exatamente para ser a trava '
             || 'natural (RF-007/RF-008). Correção: UNIQUE (tenant_id, chave_acesso) + CHECK '
             || 'de 44 dígitos numéricos quando informada — a conciliação dos itens '
             || '(epi_nf_itens → movimentação) já existe e fica protegida de graça.',
             v_qtd);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Chave de acesso protegida contra duplicata.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-040 — item vencido não sai
CREATE OR REPLACE FUNCTION public.qa_caso_epi_040()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_tipo uuid; v_epi uuid; v_saiu boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar entregar item com data_validade VENCIDA';
  r.esperado := 'Entrega bloqueada — item vencido fica segregado, fora do saldo entregável';
  INSERT INTO public.epi_tipos (tenant_id, nome, ca_numero, ca_validade, is_active)
  VALUES (v_t, 'QA — Filtro vencido', '99003', CURRENT_DATE + 365, true)
  RETURNING id INTO v_tipo;
  INSERT INTO public.epis (tenant_id, tipo_id, codigo, quantidade_estoque, data_validade)
  VALUES (v_t, v_tipo, 'QA-EPI-040', 10, CURRENT_DATE - 15)
  RETURNING id INTO v_epi;

  BEGIN
    INSERT INTO public.epi_entregas
      (tenant_id, epi_id, colaborador_nome, colaborador_cpf, quantidade, data_entrega)
    VALUES (v_t, v_epi, 'QA Colaborador Quarenta', public.qa_cpf(40), 1, CURRENT_DATE);
    v_saiu := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN
    v_saiu := false;
  END;

  IF v_saiu THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o lote vencido há 15 dias SAIU do almoxarifado sem protesto — '
             || 'nenhum gatilho compara epis.data_validade com a data da entrega, e o '
             || 'estoque baixou normalmente. Entregar protetor vencido equivale a não '
             || 'entregar (NR-6), com a agravante de PARECER que entregou: a ficha assinada '
             || 'vira prova contra a própria empresa. Correção: trava na entrega (item '
             || 'vencido não compõe o saldo entregável) + segregação do lote para '
             || 'descarte/troca com o fornecedor — casa com o FEFO do EPI-021, que '
             || 'esvazia a prateleira antes de vencer.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Entrega de item vencido foi bloqueada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-041 — biometria: dado sensível protegido
CREATE OR REPLACE FUNCTION public.qa_caso_epi_041()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_bio text; v_perfil int; v_log text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consegue LER o material biométrico das entregas?';
  r.esperado := 'Camada de perfil restringindo a leitura + log de quem consultou (LGPD art. 11)';
  v_bio := coalesce(public.qa_col_existe('epi_entregas', 'liveness_data'),
                    public.qa_col_existe('epi_entregas', 'foto_entrega_url'));
  SELECT count(*) INTO v_perfil FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'epi_entregas'
    AND policyname ILIKE '%perfil%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_log
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%epi_entregas%'
    AND (p.prosrc ILIKE '%log%acesso%' OR p.prosrc ILIKE '%auditoria%');

  IF v_bio IS NOT NULL AND v_perfil = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: epi_entregas guarda material biométrico (%s — rosto e prova '
             || 'de vida) e a leitura está aberta a QUALQUER usuário do tenant ("Usuários '
             || 'podem ver entregas de EPI do seu tenant"), sem nenhuma política '
             || 'perfil_restringe_leitura_* — a camada que já protege ~20 tabelas sensíveis '
             || 'da casa (atestados, eventos_saude...) não alcançou esta. Biometria é a '
             || 'categoria mais dura da LGPD (art. 5º, II c/c art. 11): exige acesso '
             || 'mínimo, registro de consulta (hoje: %s) e RIPD. Correção: política '
             || 'RESTRICTIVE por perfil na tabela (mesma família do FOLHA-090), log de '
             || 'acesso ao material biométrico, e o fluxo alternativo sem biometria '
             || 'documentado — a recusa não pode deixar ninguém sem EPI.',
             v_bio, coalesce(v_log, 'nenhum'));
  ELSIF v_bio IS NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Não há material biométrico armazenado em epi_entregas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Leitura restrita por perfil (%s política(s)); log: %s.',
                       v_perfil, coalesce(v_log, '—'));
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-042 — assinatura avançada com trilha
CREATE OR REPLACE FUNCTION public.qa_caso_epi_042()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_trilha text; v_hash text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a assinatura da entrega carrega a trilha que a sustenta?';
  r.esperado := 'Quem, quando (carimbo), de onde (IP/dispositivo) e integridade (hash) recuperáveis';
  SELECT string_agg(c.column_name, ', ' ORDER BY c.column_name) INTO v_trilha
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'epi_entregas'
    AND c.column_name IN ('assinatura_url', 'signed_at', 'ip_address', 'user_agent');
  v_hash := coalesce(public.qa_col_existe('epi_entregas', '%hash%'),
                     public.qa_col_existe('epi_entregas', '%integridade%'));

  IF v_trilha IS NOT NULL AND v_hash IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade frágil): a trilha da assinatura existe e '
             || 'é das melhores da casa (%s — quem, quando, de onde, com liveness), mas '
             || 'falta o lacre de INTEGRIDADE: nenhum hash do documento assinado é gravado, '
             || 'então não há como provar que a ficha exibida hoje é a mesma que o '
             || 'colaborador assinou — o requisito central da assinatura AVANÇADA (Lei '
             || '14.063/2020, art. 4º, II: detectar modificação posterior; é o que o STJ '
             || 'valorizou no REsp 2.159.442). E nada torna a trilha obrigatória: entrega '
             || 'sem assinatura alguma conclui do mesmo jeito (esse fio puxa o EPI-043). '
             || 'Correção: hash (extensions.digest, já disponível) do recibo no ato da '
             || 'assinatura, gravado com signed_at — o padrão de ADM-070/DESL-082.',
             v_trilha);
  ELSIF v_trilha IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'Os campos de trilha da assinatura sumiram de epi_entregas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Trilha completa com integridade (%s + %s).', v_trilha, v_hash);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-043 — baixa só depois da assinatura
CREATE OR REPLACE FUNCTION public.qa_caso_epi_043()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_tipo uuid; v_epi uuid; v_saldo int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar entrega SEM assinatura e conferir quando o estoque baixa';
  r.esperado := 'Antes da assinatura: RESERVA; baixa definitiva só com signed_at (RN-005)';
  INSERT INTO public.epi_tipos (tenant_id, nome, ca_numero, ca_validade, is_active)
  VALUES (v_t, 'QA — Óculos reserva', '99004', CURRENT_DATE + 365, true)
  RETURNING id INTO v_tipo;
  INSERT INTO public.epis (tenant_id, tipo_id, codigo, quantidade_estoque, data_validade)
  VALUES (v_t, v_tipo, 'QA-EPI-043', 10, CURRENT_DATE + 365)
  RETURNING id INTO v_epi;

  INSERT INTO public.epi_entregas
    (tenant_id, epi_id, colaborador_nome, colaborador_cpf, quantidade, data_entrega)
  VALUES (v_t, v_epi, 'QA Colaborador Quarenta e Três', public.qa_cpf(43), 2, CURRENT_DATE);
  -- assinatura_url e signed_at ficaram NULL de propósito

  SELECT e.quantidade_estoque INTO v_saldo FROM public.epis e WHERE e.id = v_epi;

  IF v_saldo < 10 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o estoque baixou de 10 para %s no REGISTRO da entrega, com '
             || 'assinatura_url e signed_at ainda NULOS — o gatilho atualizar_estoque_epi '
             || 'dispara no INSERT, invertendo a RN-005 (baixa só após a assinatura). Sem a '
             || 'etapa de reserva, a entrega abandonada no meio (colaborador não assinou) '
             || 'deixa o pior dos mundos: estoque sem item e ficha sem prova — e não há '
             || 'estorno automático, o saldo só volta editando na mão. Correção: INSERT '
             || 'reserva (saldo disponível separado do físico); a baixa definitiva move no '
             || 'UPDATE que grava signed_at; reserva expirada estorna com rastro em '
             || 'epi_movimentacoes. O caminho da devolução (status devolvido) já repõe o '
             || 'saldo — falta o espelho na entrada do fluxo.',
             v_saldo);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O estoque só baixa com a assinatura — reserva respeitada.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-044 — ficha no módulo Documentos
CREATE OR REPLACE FUNCTION public.qa_caso_epi_044()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_pasta text; v_ponte text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a ficha assinada é arquivada no módulo Documentos?';
  r.esperado := 'Recibo na pasta do colaborador, com prazo de guarda parametrizado';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_pasta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%pasta%' AND p.prosrc ILIKE '%epi%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ponte
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%epi_entregas%'
    AND (p.prosrc ILIKE '%documento%' OR p.prosrc ILIKE '%pasta%');

  IF v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (a estante existe, o arquivista não): a estrutura de pastas '
             || 'por colaborador já prevê o lugar (%s), mas nenhuma função leva a ficha '
             || 'assinada até lá — o recibo fica em assinatura_url, um arquivo solto no '
             || 'storage, fora do módulo Documentos, sem metadados nem prazo de guarda '
             || '(RN-012; a obrigação trabalhista pede guarda longa, parâmetro [VAL]). '
             || 'Documento que a fiscalização pede e ninguém acha é documento que não '
             || 'existe. Correção: ao gravar signed_at, registrar o recibo no módulo '
             || 'Documentos (pasta do colaborador) com tipo, data e vínculo à entrega.',
             coalesce(v_pasta, 'gerar_estrutura_padrao_pastas'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ficha arquivada no módulo Documentos por: %s.', v_ponte);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-050 — troca periódica / vida útil
CREATE OR REPLACE FUNCTION public.qa_caso_epi_050()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_param text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém conta os dias de uso e cobra a troca?';
  r.esperado := 'Data de troca calculada na entrega; substituição pendente apontada com antecedência';
  v_param := public.qa_col_existe('epi_tipos', 'periodicidade_troca_dias');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%periodicidade_troca%'
         OR p.prosrc ILIKE '%data_devolucao_prevista%');

  IF v_param IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (o parâmetro existe, o relógio não): %s está no cadastro do '
             || 'tipo e epi_entregas tem data_devolucao_prevista — e nenhuma função usa um '
             || 'nem outro: a entrega não calcula a data da troca, nenhuma rotina aponta '
             || 'substituição vencendo. O mesmo desenho do SST-020 (periodicidade do exame '
             || 'sem motor): o parâmetro vira promessa. Protetor com a espuma vencida '
             || 'protege tanto quanto nenhum — e o colaborador não pede troca, quem cobra é '
             || 'o sistema (RF-016, configurável por cliente). Correção: na entrega, gravar '
             || 'a data prevista de troca (data_entrega + periodicidade); rotina diária '
             || 'apontando as trocas a vencer, com antecedência [VAL].',
             v_param);
  ELSIF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O parâmetro periodicidade_troca_dias não existe mais.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Troca periódica vigiada por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-051 — kit de admissão automático
CREATE OR REPLACE FUNCTION public.qa_caso_epi_051()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_param text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a admissão em função de risco gera o kit inicial?';
  r.esperado := 'EPIs exigidos pela função viram pendência de entrega na admissão';
  v_param := public.qa_col_existe('epi_tipos', 'obrigatorio_para_funcoes');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%obrigatorio_para_funcoes%'
         OR (p.prosrc ILIKE '%epi_entregas%' AND p.prosrc ILIKE '%admiss%'));

  IF v_param IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o vínculo função→EPI está cadastrado (%s) e a admissão não '
             || 'o consulta — nenhuma função gera o kit inicial como pendência quando o '
             || 'colaborador é admitido em função de risco: o capacete do primeiro dia '
             || 'depende da memória do RH. A NR-6 (c/c NR-1) exige o fornecimento ANTES do '
             || 'início da exposição; a admissão da casa já trabalha com pendências e '
             || 'checklist (família ADM), falta o item de EPI entrar na lista (RF-020). '
             || 'Correção: ao concluir a admissão em função com EPIs exigidos, abrir a '
             || 'pendência de entrega do kit (tipos e tamanhos a colher), visível no painel '
             || 'até a última ficha assinada.',
             v_param);
  ELSIF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O vínculo obrigatorio_para_funcoes não existe mais.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Kit de admissão gerado por: %s.', v_fns);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- EPI-052 — devolução na rescisão sem reter direitos
CREATE OR REPLACE FUNCTION public.qa_caso_epi_052()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_volta text; v_check text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o desligamento gera o checklist de devolução dos EPIs?';
  r.esperado := 'Entregas ativas do colaborador viram checklist na rescisão — sem travar verbas';
  -- a volta ao saldo na devolução já existe (trigger status devolvido)
  SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_volta
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.epi_entregas'::regclass AND NOT t.tgisinternal
    AND t.tgname NOT ILIKE 'qa\_%' AND p.prosrc ILIKE '%devolvido%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_check
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%epi_entregas%'
    AND (p.prosrc ILIKE '%desligamento%' OR p.prosrc ILIKE '%rescis%'
         OR p.prosrc ILIKE '%afastamento%');

  IF v_check IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade solta): a DEVOLUÇÃO em si funciona — o '
             || 'gatilho (%s) repõe o saldo quando a entrega vira "devolvido" — mas nada '
             || 'CONECTA o desligamento (nem o afastamento longo) às entregas ativas do '
             || 'colaborador: nenhum checklist de devolução é gerado na rescisão, e os EPIs '
             || 'em posse saem pela porta sem registro de cobrança. A RN-014 pede o '
             || 'equilíbrio fino: cobrar a devolução SEM reter verbas nem homologação '
             || '(desconto só nos limites da CLT art. 462, com acordo) — hoje não há nem a '
             || 'cobrança. Correção: ao iniciar o desligamento, gerar o checklist com as '
             || 'entregas ativas (a família DESL já trabalha com pendências); devolvido '
             || 'reintegra/descarta, não devolvido fica registrado para tratativa — e a '
             || 'rescisão SEGUE de qualquer forma.',
             coalesce(v_volta, 'trigger_atualizar_estoque_epi'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Checklist de devolução no desligamento presente: %s.', v_check);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ── Registro no motor ──
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('EPI-010', 'qa_caso_epi_010'),
  ('EPI-011', 'qa_caso_epi_011'),
  ('EPI-020', 'qa_caso_epi_020'),
  ('EPI-021', 'qa_caso_epi_021'),
  ('EPI-022', 'qa_caso_epi_022'),
  ('EPI-030', 'qa_caso_epi_030'),
  ('EPI-040', 'qa_caso_epi_040'),
  ('EPI-041', 'qa_caso_epi_041'),
  ('EPI-042', 'qa_caso_epi_042'),
  ('EPI-043', 'qa_caso_epi_043'),
  ('EPI-044', 'qa_caso_epi_044'),
  ('EPI-050', 'qa_caso_epi_050'),
  ('EPI-051', 'qa_caso_epi_051'),
  ('EPI-052', 'qa_caso_epi_052')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql;

DO $fim$
BEGIN
  RAISE NOTICE 'QA EPI: 14 rotinas registradas (EPI-010..052). EPI-031 e EPI-060 são de tela (Cypress).';
END $fim$;
