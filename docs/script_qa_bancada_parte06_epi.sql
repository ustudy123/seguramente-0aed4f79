-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 6 de 15
-- EPI
--
-- POR QUE ESTA TRILHA EXISTE
-- A bancada de testes tem tres camadas: a ROTINA (uma funcao), o CASO
-- DOCUMENTADO (linha em qa_casos_teste) e a PONTE que liga uma a outra
-- (qa_implementacoes). Rotina e estrutura; caso e ponte sao dados. As tres
-- nasceram em migrations, que so alcancam o ambiente de teste — nunca a
-- producao. Resultado medido: a producao documenta 568 casos e executa 268,
-- enquanto o projeto documenta 822 e executa 565.
--
-- Esta trilha leva as tres camadas para a producao. A homologacao herda na
-- proxima copia (as tabelas do motor de QA sao copiadas de la na integra).
--
-- GARANTIAS
--   - Idempotente: rodar duas vezes nao duplica nem quebra.
--   - NAO altera nenhuma regra de negocio. So a bancada que as verifica.
--   - Modulo resolvido pelo CAMINHO, nao pelo identificador interno (os
--     identificadores diferem entre ambientes).
--   - A ponte so e criada quando a rotina existe de fato no destino.
--   - Cada rotina entra em bloco proprio: falha de uma vira NOTICE, nao
--     aborta o arquivo.
--   - O cercado (tenant isolado onde os testes rodam) JA existe na producao —
--     esta trilha nao mexe nele, nem em dado de cliente.
-- Roda inteiro em UMA transacao.
-- ============================================================================

SET lock_timeout = '10s';

-- (1) ROTINAS — 15 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_tipo uuid; v_epi uuid; v_antes int; v_depois int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar tipo de EPI e um item com estoque 100';
  r.esperado    := 'Apos entregar 2 unidades, o estoque cai para 98';

  INSERT INTO public.epi_tipos (tenant_id, nome)
  VALUES (v_t, '[QA-EPI] Luva Teste')
  RETURNING id INTO v_tipo;

  INSERT INTO public.epis (tenant_id, tipo_id, ca, quantidade_estoque, quantidade_minima)
  VALUES (v_t, v_tipo, 'CA-QA-0000', 100, 10)
  RETURNING id INTO v_epi;

  r.passo_ordem := 2;
  r.passo_acao  := 'Ler o estoque inicial';
  SELECT quantidade_estoque INTO v_antes FROM public.epis WHERE id = v_epi;

  r.passo_ordem := 3;
  r.passo_acao  := 'Registrar entrega de 2 unidades';
  INSERT INTO public.epi_entregas (tenant_id, epi_id, colaborador_nome, colaborador_cpf,
                                   quantidade, data_entrega, status)
  VALUES (v_t, v_epi, '[QA-EPI] Colaborador', public.qa_cpf(269), 2, CURRENT_DATE, 'ativa');

  r.passo_ordem := 4;
  r.passo_acao  := 'Verificar se o estoque baixou de 100 para 98';
  SELECT quantidade_estoque INTO v_depois FROM public.epis WHERE id = v_epi;

  IF v_depois = v_antes - 2 THEN
    r.situacao := 'passou';
    r.obtido   := format('Estoque baixou de %s para %s. Trigger de entrega funciona.', v_antes, v_depois);
  ELSIF v_depois = v_antes THEN
    r.situacao := 'falhou';
    r.obtido   := format('Estoque continuou em %s. A entrega NAO baixou o estoque — trigger ausente ou quebrada.', v_depois);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Estoque foi de %s para %s (esperado %s).', v_antes, v_depois, v_antes - 2);
  END IF;
  r.detalhe := jsonb_build_object('epi_id', v_epi, 'antes', v_antes, 'depois', v_depois);
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_042()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_042()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_042 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_043()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_043()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_043 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_044()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_044()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_044 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_epi_052()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_epi_052()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_epi_052 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 65 casos.

-- EPI (65 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('EPI-001', 'EPI: entrega baixa o estoque', 'feliz', 'alta', 'aprovado', 'Verificar que entregar um EPI a um colaborador decrementa o estoque. Regra: a entrega e uma saida — o saldo disponivel diminui na mesma quantidade entregue. Importa por dois motivos: o estoque precisa refletir a realidade para que ninguem fique sem equipamento, e a ficha de entrega de EPI e prova legal de que a empresa forneceu a protecao exigida (NR-06). Estoque errado significa ou falta de EPI no chao de fabrica, ou registro que nao corresponde ao que foi entregue.', 'Tipo de EPI cadastrado com saldo em estoque, e um colaborador para receber.', '[{"acao": "Conferir o saldo atual do EPI em estoque", "dados": "Anotar o saldo antes da entrega (ex.: 10 unidades)", "ordem": 1, "onde_na_tela": "Menu > Saude Ocupacional > EPI > Estoque", "resultado_esperado": "Saldo inicial visivel"}, {"acao": "Registrar a entrega do EPI ao colaborador", "dados": "Colaborador: um do cadastro | EPI: o mesmo conferido | Quantidade: 2", "ordem": 2, "onde_na_tela": "EPI > Entregas > Nova Entrega", "resultado_esperado": "Entrega registrada com data e responsavel"}, {"acao": "Conferir o saldo apos a entrega", "dados": "-", "ordem": 3, "onde_na_tela": "EPI > Estoque", "resultado_esperado": "Saldo diminuido na quantidade entregue (10 - 2 = 8)"}]', 'A entrega e registrada e o estoque cai exatamente na quantidade entregue. O saldo apos a operacao e igual ao saldo anterior menos a quantidade.', 'IMPACTO SE FALHAR: se o estoque nao baixar, o sistema mostra equipamento que nao existe mais — e alguem que precisa de protecao pode nao encontrar. Se baixar errado, o inventario diverge do fisico. Alem disso, a ficha de entrega e prova legal de fornecimento de EPI (NR-06): em fiscalizacao ou acao trabalhista, ela e o que demonstra que a empresa cumpriu sua obrigacao. HISTORIA DESTE CASO: vem do agente de marco, que testava esse fluxo escrevendo em estoque de clientes reais — ou seja, o teste antigo podia alterar saldos de verdade. Reescrito para o cercado. Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080. | Requisitos YE-DP-EPI-001: a família EPI ganhou 16 casos novos (EPI-010..060) — este caso segue dono da baixa de estoque na entrega; a regra nova RN-005 (baixa só após assinatura) é o EPI-043.', 'api', NULL, 'em_triagem', NULL),
    ('EPI-010', 'Catálogo por CA: buscar o CA preenche o cadastro e traz a validade oficial', 'feliz', 'alta', 'aprovado', 'O CA é a identidade do EPI: informado o número, o sistema busca os dados oficiais (equipamento, fabricante, validade do certificado) e preenche o cadastro — digitação manual só como exceção. Cadastro digitado errado é ficha de entrega errada, e ficha errada não prova proteção em juízo.', 'Catálogo de tipos de EPI disponível no ambiente de teste.', '[{"acao": "Informar um número de CA no cadastro do tipo", "ordem": 1, "resultado_esperado": "Dados do CA (equipamento, fabricante, validade) trazidos automaticamente da base oficial"}, {"acao": "Informar CA inexistente", "ordem": 2, "resultado_esperado": "Cadastro apontado como não confirmado — não passa como válido em silêncio"}, {"acao": "Salvar o tipo", "ordem": 3, "resultado_esperado": "ca_numero e ca_validade gravados e rastreáveis"}]', 'CA digitado vira CA conferido — a fonte é a base oficial.', 'Requisitos YE-DP-EPI-001: RF-001/RF-002 (busca CAEPI). epi_tipos já tem ca_numero e ca_validade; a BUSCA automática, a sonda confere.', 'api', 'NR-6 (todo EPI comercializado precisa de CA válido; consulta pública CAEPI)', 'em_triagem', NULL),
    ('EPI-011', 'Validade do CA é vigiada: aviso antes de vencer, alerta no vencido', 'negativo', 'critica', 'aprovado', 'Um CA vence e ninguém percebe: todo o estoque daquele tipo vira sucata jurídica de uma vez. O catálogo precisa vigiar ca_validade — avisar com antecedência ([VAL]) que o CA vai vencer, e marcar o tipo vencido de forma visível. A trava na ENTREGA é o SST-011; aqui o caso cobra o radar no CATÁLOGO, antes de chegar ao balcão.', 'Tipo de EPI com CA próximo do vencimento no ambiente de teste.', '[{"acao": "Cadastrar tipo com CA vencendo em 30 dias", "ordem": 1, "resultado_esperado": "Alerta de renovação/recompra disparado com antecedência"}, {"acao": "Deixar o CA vencer", "ordem": 2, "resultado_esperado": "Tipo sinalizado VENCIDO no catálogo e nos painéis — nunca silêncio"}, {"acao": "Atualizar o CA (renovação)", "ordem": 3, "resultado_esperado": "Nova validade registrada com histórico da anterior"}]', 'CA vencido no catálogo é recall — o sistema avisa antes.', 'Requisitos YE-DP-EPI-001: RN-002 / RF-003. ca_validade existe em epi_tipos; a sonda do SST-011 já constatou que NADA a confere — aqui a cobrança é o monitoramento proativo.', 'api', 'NR-6 (EPI só protege juridicamente com CA válido na data da entrega)', 'em_triagem', NULL),
    ('EPI-020', 'Estoque por tamanho e por local nunca fica negativo', 'negativo', 'critica', 'aprovado', 'O estoque é por combinação tipo × tamanho × local — e a regra de ouro é que nenhuma saída pode deixar saldo negativo: entregar o que não existe é ficha de papel sem lastro físico. A baixa deve conferir o saldo da combinação exata (bota 42 do almoxarifado A, não "botas em geral").', 'Estoque por tamanho/local com saldos conhecidos no ambiente de teste.', '[{"acao": "Tentar entregar quantidade maior que o saldo do tamanho/local", "ordem": 1, "resultado_esperado": "Operação bloqueada — saldo insuficiente apontado"}, {"acao": "Entregar dentro do saldo", "ordem": 2, "resultado_esperado": "Baixa na combinação exata (tipo, tamanho, local), com movimentação registrada"}, {"acao": "Conferir o saldo após concorrência (duas entregas simultâneas)", "ordem": 3, "resultado_esperado": "Controle otimista impede baixa dupla — saldo jamais negativo"}]', 'Saldo negativo não existe no mundo físico — nem no sistema.', 'Requisitos YE-DP-EPI-001: RN-003 / RF-006. O trigger atualizar_estoque_epi subtrai SEM conferir saldo e não há CHECK >= 0 — a sonda testa se o negativo passa.', 'api', 'Documento YE-DP-EPI-001, RN-003 (saldo negativo é proibido; estoque por unidade, tamanho e local)', 'em_triagem', NULL),
    ('EPI-021', 'Saída respeita o FEFO: vence primeiro, sai primeiro', 'feliz', 'media', 'aprovado', 'EPIs têm validade própria (além do CA): luvas ressecam, filtros saturam. A saída deve priorizar o lote que vence primeiro (FEFO), senão o estoque novo sai enquanto o antigo apodrece na prateleira — e vira perda ou, pior, entrega de item vencido.', 'Dois lotes do mesmo tipo/tamanho com validades diferentes no ambiente de teste.', '[{"acao": "Registrar entrega sem escolher lote", "ordem": 1, "resultado_esperado": "O lote de validade mais próxima é sugerido/baixado primeiro"}, {"acao": "Forçar lote mais novo com o antigo ainda válido", "ordem": 2, "resultado_esperado": "Aviso de quebra de FEFO — decisão consciente, registrada"}, {"acao": "Conferir o relatório de validade do estoque", "ordem": 3, "resultado_esperado": "Lotes ordenados por vencimento, com os críticos destacados"}]', 'A prateleira gira pelo vencimento, não pela chegada.', 'Requisitos YE-DP-EPI-001: RN-004. epis.data_validade existe por item; ordenação FEFO na saída, a sonda confere.', 'api', 'Documento YE-DP-EPI-001, RN-004 (FEFO — first expire, first out)', 'em_triagem', NULL),
    ('EPI-022', 'Estoque mínimo atingido vira reposição no Plano de Ação', 'feliz', 'alta', 'aprovado', 'Estoque mínimo é parâmetro, não decoração: quando o saldo de um tipo/tamanho/local cruza o mínimo, o sistema abre a ação de reposição no módulo Plano de Ação — com o item, o saldo e o local. Ficar sem EPI em estoque é parar a operação (sem EPI o colaborador não pode trabalhar, NR-6).', 'Tipo com estoque_minimo definido e saldo próximo do limite no ambiente de teste.', '[{"acao": "Baixar o saldo até cruzar o mínimo", "ordem": 1, "resultado_esperado": "Ação de reposição criada no Plano de Ação com item, saldo e local"}, {"acao": "Cruzar o mínimo de novo com ação aberta", "ordem": 2, "resultado_esperado": "Sem duplicar — a ação existente é referenciada"}, {"acao": "Registrar a entrada da compra", "ordem": 3, "resultado_esperado": "Saldo recomposto; ação concluída com evidência"}]', 'O mínimo é o gatilho de compra — automático e sem duplicar.', 'Requisitos YE-DP-EPI-001: RF-018 / RN-006. estoque_minimo (epi_tipos) e quantidade_minima (epi_estoque_local) existem; a PONTE com o Plano de Ação, a sonda confere.', 'api', 'Documento YE-DP-EPI-001, RF-018 (reposição/compra disparada via Plano de Ação)', 'em_triagem', NULL),
    ('EPI-030', 'Entrada por NF: chave íntegra, sem nota duplicada, itens conciliados com o estoque', 'feliz', 'alta', 'aprovado', 'A entrada de estoque nasce da NF: importado o XML, os itens são conciliados com o catálogo (qual item da nota é qual tipo/tamanho do estoque) e a entrada movimenta o saldo. A chave de acesso tem 44 dígitos e é única — a mesma nota lançada duas vezes dobra o estoque no papel.', 'NF de compra de EPIs disponível para lançamento no ambiente de teste.', '[{"acao": "Importar a NF (XML)", "ordem": 1, "resultado_esperado": "Cabeçalho (chave 44 dígitos, fornecedor, emissão) e itens carregados para conciliação"}, {"acao": "Tentar importar a MESMA chave de novo", "ordem": 2, "resultado_esperado": "Bloqueado — nota já lançada, sem dobrar estoque"}, {"acao": "Concluir a conciliação dos itens", "ordem": 3, "resultado_esperado": "Entradas geradas por tipo/tamanho/local, movimentação amarrada à NF"}]', 'Uma nota, uma entrada — com a chave como trava.', 'Requisitos YE-DP-EPI-001: RF-007/RF-008. epi_notas_fiscais (chave_acesso) e epi_nf_itens (movimentacao_id) existem; unicidade da chave e validação dos 44 dígitos, a sonda confere.', 'api', 'Documento YE-DP-EPI-001, RF-007/RF-008 (entrada por XML de NF-e; chave de acesso de 44 dígitos)', 'em_triagem', NULL),
    ('EPI-031', 'DANFE por foto/OCR com baixa confiança para na revisão humana', 'alternativo', 'media', 'aprovado', 'Nem toda entrada chega em XML: a foto do DANFE passa por OCR/IA, e o que a máquina leu com baixa confiança NÃO entra direto no estoque — para na mesa de um humano. Quantidade lida errada vira estoque fantasma; a revisão é o cinto de segurança da importação.', 'Tela de entrada por imagem de DANFE no ambiente de teste.', '[{"acao": "Enviar foto de DANFE legível", "ordem": 1, "resultado_esperado": "Itens extraídos com nível de confiança visível por campo"}, {"acao": "Enviar imagem ruim (baixa confiança)", "ordem": 2, "resultado_esperado": "Entrada retida para revisão humana antes de movimentar estoque"}, {"acao": "Revisar, corrigir e aprovar", "ordem": 3, "resultado_esperado": "Entrada efetivada com o revisor registrado na trilha"}]', 'O que a máquina não leu com certeza, um humano confirma.', 'Requisitos YE-DP-EPI-001: RF-009 / cenário "Nota por foto" (seção de cenários). Hoje epi_notas_fiscais.origem só aceita xml|manual — o fluxo OCR não existe. Caso de tela (Cypress).', 'e2e', 'Documento YE-DP-EPI-001, RF-009 (OCR de DANFE com nível de confiança e revisão)', 'em_triagem', NULL),
    ('EPI-040', 'Item vencido não sai do almoxarifado', 'negativo', 'critica', 'aprovado', 'Além do CA (SST-011), o ITEM tem validade própria — e item vencido no estoque não pode ser entregue: a entrega deve ser bloqueada, o lote sinalizado para descarte/segregação. Entregar protetor vencido é igual a não entregar, com a agravante de parecer que entregou.', 'Lote de EPI com data_validade vencida no estoque de teste.', '[{"acao": "Tentar registrar entrega de lote vencido", "ordem": 1, "resultado_esperado": "Bloqueada — validade do item é condição da saída"}, {"acao": "Conferir o painel de estoque", "ordem": 2, "resultado_esperado": "Lote vencido segregado/sinalizado para descarte, fora do saldo entregável"}, {"acao": "Entregar de lote válido", "ordem": 3, "resultado_esperado": "Sai normalmente, respeitando o FEFO (EPI-021)"}]', 'Vencido não veste ninguém — sai do saldo entregável, não do almoxarifado.', 'Requisitos YE-DP-EPI-001: RN-001 / CA de bloqueio de vencidos. epis.data_validade e epi_entregas.data_validade existem; a TRAVA na entrega, a sonda confere.', 'api', 'NR-6 (EPI em condições de uso; item vencido não protege)', 'em_triagem', NULL),
    ('EPI-041', 'Biometria facial da entrega é dado sensível: acesso mínimo, base legal e log', 'negativo', 'critica', 'aprovado', 'A entrega com leitura facial guarda dado biométrico — a categoria mais sensível da LGPD. Isso exige: base legal documentada, acesso restrito (nem todo usuário do tenant pode ler o material biométrico), registro de quem consultou, e um FLUXO ALTERNATIVO digno para quem não consente (a recusa não pode impedir o colaborador de receber o EPI).', 'Entregas com verificação facial registradas no ambiente de teste.', '[{"acao": "Consultar uma entrega como usuário comum do tenant", "ordem": 1, "resultado_esperado": "Dados biométricos (liveness, foto) NÃO expostos — camada de perfil restringe"}, {"acao": "Acessar como perfil autorizado", "ordem": 2, "resultado_esperado": "Acesso funciona e fica LOGADO (quem, quando, qual registro)"}, {"acao": "Registrar entrega de colaborador que não consente com a biometria", "ordem": 3, "resultado_esperado": "Fluxo alternativo (assinatura sem face) disponível — EPI entregue do mesmo jeito"}]', 'Rosto é dado sensível: pouca gente vê, tudo fica logado, e ninguém fica sem EPI por recusar.', 'Requisitos YE-DP-EPI-001: RNF de privacidade / RIPD. epi_entregas guarda liveness_data e foto_entrega_url, e a leitura é aberta ao tenant ("Usuários podem ver entregas de EPI do seu tenant") SEM política perfil_restringe_leitura_* — a sonda confere a lacuna (mesma família do FOLHA-090).', 'api', 'LGPD art. 5º, II (biometria = dado sensível) e art. 11 (tratamento restrito); documento YE-DP-EPI-001, RNF de privacidade (template protegido, RIPD, fluxo alternativo)', 'em_triagem', NULL),
    ('EPI-042', 'Recibo de entrega com assinatura eletrônica avançada e trilha completa', 'feliz', 'alta', 'aprovado', 'A ficha/recibo de EPI é prova documental: a assinatura eletrônica avançada precisa da trilha que a sustenta em juízo — quem assinou, quando (carimbo de tempo), de onde (IP, dispositivo) e a integridade do documento (hash). Sem a trilha, a assinatura vira imagem colada num PDF.', 'Entrega registrada aguardando assinatura no ambiente de teste.', '[{"acao": "Colher a assinatura do colaborador na entrega", "ordem": 1, "resultado_esperado": "Assinatura gravada com signed_at, IP e dispositivo"}, {"acao": "Conferir a evidência", "ordem": 2, "resultado_esperado": "Trilha completa recuperável (hash/carimbo/identificação) — padrão de ADM-070/DESL-082"}, {"acao": "Emitir a ficha de EPI do colaborador", "ordem": 3, "resultado_esperado": "Histórico completo de entregas com as assinaturas, pronto para fiscalização"}]', 'Assinatura que não se prova é papel em branco.', 'Requisitos YE-DP-EPI-001: RN-011 / RF-013. epi_entregas já tem assinatura_url, ip_address, user_agent e signed_at — a sonda confere se a trilha é obrigatória ou opcional. Assinatura qualificada ICP-Brasil é opcional no documento.', 'api', 'Lei 14.063/2020 (assinatura avançada); MP 2.200-2/2001, art. 10, §2º (validade entre as partes); STJ REsp 2.159.442/PR (validade probatória)', 'em_triagem', NULL),
    ('EPI-043', 'A baixa de estoque só acontece DEPOIS da assinatura — antes é reserva', 'negativo', 'alta', 'aprovado', 'A regra de ouro do fluxo: registrar a entrega RESERVA o item; a baixa definitiva só ocorre com a assinatura do colaborador. Entrega não assinada em prazo é estornada — o item volta ao saldo. Baixar antes de assinar cria o pior dos mundos: estoque sem item e ficha sem prova.', 'Fluxo de entrega com etapa de assinatura no ambiente de teste.', '[{"acao": "Registrar a entrega (antes da assinatura)", "ordem": 1, "resultado_esperado": "Item RESERVADO — saldo disponível reduzido, baixa definitiva pendente"}, {"acao": "Colher a assinatura", "ordem": 2, "resultado_esperado": "Baixa definitiva efetivada, movimentação amarrada à entrega assinada"}, {"acao": "Deixar a assinatura expirar", "ordem": 3, "resultado_esperado": "Reserva estornada — item de volta ao saldo, entrega cancelada com rastro"}]', 'Sem assinatura não há baixa — há reserva com prazo.', 'Requisitos YE-DP-EPI-001: RN-005. HOJE o trigger atualizar_estoque_epi baixa no INSERT da entrega, ANTES de qualquer assinatura (signed_at nem existia no fluxo do trigger) — a sonda documenta a divergência.', 'api', 'Documento YE-DP-EPI-001, RN-005 (baixa condicionada à assinatura; reserva e estorno)', 'em_triagem', NULL),
    ('EPI-044', 'Ficha e recibo assinados moram no módulo Documentos, pelo prazo da casa', 'feliz', 'media', 'aprovado', 'A ficha de EPI assinada não fica solta num bucket: ela é arquivada no módulo Documentos, na pasta do colaborador, e respeita o prazo de guarda configurado (parâmetro da casa — a obrigação trabalhista pede guarda longa). Documento que a fiscalização pede e ninguém acha é documento que não existe.', 'Entrega assinada com ficha emitida no ambiente de teste.', '[{"acao": "Concluir uma entrega assinada", "ordem": 1, "resultado_esperado": "Ficha/recibo arquivado no módulo Documentos, pasta do colaborador"}, {"acao": "Buscar a ficha pela pasta do colaborador", "ordem": 2, "resultado_esperado": "Documento localizável com metadados (tipo, data, assinatura)"}, {"acao": "Conferir a política de guarda", "ordem": 3, "resultado_esperado": "Prazo de guarda parametrizado aplicado — nada é descartado antes"}]', 'A ficha tem endereço fixo: a pasta do colaborador no módulo Documentos.', 'Requisitos YE-DP-EPI-001: RN-012 / RF-014. A estrutura de pastas por colaborador existe (gerar_estrutura_padrao_pastas); a ponte entrega→Documentos, a sonda confere.', 'api', 'Documento YE-DP-EPI-001, RN-012 (guarda nativa no módulo Documentos; prazo de guarda é parâmetro [VAL])', 'em_triagem', NULL),
    ('EPI-050', 'Troca periódica: o EPI tem vida útil e o sistema cobra a substituição', 'feliz', 'media', 'aprovado', 'Cada tipo de EPI tem periodicidade de troca (vida útil): entregue hoje, o sistema calcula quando vence o uso e cobra a substituição — sem esperar o colaborador pedir. Protetor auricular com a espuma vencida protege tanto quanto nenhum; a troca proativa é a diferença entre gestão e almoxarifado.', 'Tipo com periodicidade_troca_dias definida e entrega registrada no ambiente de teste.', '[{"acao": "Registrar entrega de tipo com troca a cada 180 dias", "ordem": 1, "resultado_esperado": "Data prevista de troca calculada na entrega"}, {"acao": "Aproximar-se do vencimento do uso", "ordem": 2, "resultado_esperado": "Substituição pendente apontada (colaborador × item), com antecedência [VAL]"}, {"acao": "Registrar a troca", "ordem": 3, "resultado_esperado": "Novo ciclo iniciado; item anterior recolhido/baixado com rastro"}]', 'EPI não é vitalício — o sistema conta os dias de uso.', 'Requisitos YE-DP-EPI-001: RF-016 (regra configurável por cliente [RCC]). periodicidade_troca_dias existe em epi_tipos e data_devolucao_prevista em epi_entregas; o MOTOR que vigia e cobra, a sonda confere.', 'api', 'NR-6 (substituir imediatamente quando danificado ou extraviado; vida útil conforme fabricante); documento YE-DP-EPI-001, RF-016 [RCC]', 'em_triagem', NULL),
    ('EPI-051', 'Kit de admissão: função de risco gera a entrega inicial automaticamente', 'feliz', 'media', 'aprovado', 'Admitido para função com riscos, o colaborador precisa do kit ANTES do primeiro dia de exposição: o sistema deriva da função (PGR/ficha por função) os EPIs exigidos e abre a entrega inicial como pendência da admissão — ninguém começa a trabalhar desprotegido porque o RH esqueceu o capacete.', 'Função com EPIs exigidos mapeados; admissão em andamento no ambiente de teste.', '[{"acao": "Concluir admissão em função com EPIs exigidos", "ordem": 1, "resultado_esperado": "Kit inicial gerado como pendência de entrega (tipos e tamanhos a colher)"}, {"acao": "Registrar as entregas do kit", "ordem": 2, "resultado_esperado": "Pendência baixada; fichas assinadas por item"}, {"acao": "Tentar ativar colaborador com kit pendente", "ordem": 3, "resultado_esperado": "Pendência visível no painel — exposição sem EPI nunca passa em silêncio"}]', 'Função de risco admite com o kit na mão — automático, não de memória.', 'Requisitos YE-DP-EPI-001: RF-020. epi_tipos.obrigatorio_para_funcoes existe; a geração automática do kit na admissão, a sonda confere. A ficha por função é o SST-011.', 'api', 'NR-6 c/c NR-1 (fornecimento antes do início da exposição); documento YE-DP-EPI-001, RF-020', 'em_triagem', NULL),
    ('EPI-052', 'Rescisão e afastamento cobram a devolução dos EPIs — sem reter direitos', 'alternativo', 'alta', 'aprovado', 'No desligamento (e no afastamento longo), os EPIs em posse do colaborador entram num checklist de devolução: o que volta é recebido e reintegrado/descartado, o que não volta é registrado. O equilíbrio é fino: a empresa cobra a devolução, mas a pendência NÃO pode reter verbas rescisórias nem travar a homologação — desconto só nos limites da lei (CLT art. 462, com acordo).', 'Colaborador com EPIs ativos entrando em desligamento no ambiente de teste.', '[{"acao": "Iniciar o desligamento", "ordem": 1, "resultado_esperado": "Checklist de devolução gerado com os EPIs em posse (entregas ativas)"}, {"acao": "Registrar devolução parcial", "ordem": 2, "resultado_esperado": "Devolvidos reintegrados/descartados conforme estado; não devolvidos registrados"}, {"acao": "Concluir a rescisão com pendência de devolução", "ordem": 3, "resultado_esperado": "Rescisão SEGUE (verbas e prazos intactos); pendência documentada para tratativa"}]', 'A empresa cobra o capacete de volta — mas nunca segurando o acerto.', 'Requisitos YE-DP-EPI-001: RN-014 / RF-015. epi_entregas tem data_devolucao_prevista/efetiva e o trigger devolve ao saldo no status devolvido; o CHECKLIST no desligamento/afastamento, a sonda confere. Prazos da rescisão são o DESL-030s.', 'api', 'Documento YE-DP-EPI-001, RN-014 (checklist de devolução; a pendência NÃO impede verbas nem homologação)', 'em_triagem', NULL),
    ('EPI-060', 'Modo offline no almoxarifado: registra sem rede, sincroniza sem duplicar', 'alternativo', 'media', 'aprovado', 'O balcão do almoxarifado nem sempre tem rede — e a entrega não pode esperar o wi-fi. O registro offline guarda a operação localmente (com a assinatura) e sincroniza quando a rede volta, sem duplicar movimentação nem perder assinatura. Conflito de saldo na sincronização é apontado, não engolido.', 'Ponto de entrega operando sem conexão no ambiente de teste.', '[{"acao": "Registrar entrega sem rede", "ordem": 1, "resultado_esperado": "Operação guardada localmente com assinatura colhida"}, {"acao": "Restabelecer a conexão", "ordem": 2, "resultado_esperado": "Sincronização automática — movimentação única, sem duplicar"}, {"acao": "Sincronizar com saldo divergente", "ordem": 3, "resultado_esperado": "Conflito apontado para conciliação humana — saldo jamais negativo"}]', 'Sem rede a entrega acontece; com rede ela se acerta — uma vez só.', 'Requisitos YE-DP-EPI-001: RNF de operação offline. Caso de tela/PWA (Cypress) — o motor confere apenas os efeitos (unicidade de movimentação).', 'e2e', 'Documento YE-DP-EPI-001, RNF de disponibilidade (operação offline no ponto de entrega)', 'em_triagem', NULL),
    ('TELA-EPI-001', 'CT-01: Cadastrar tipo de EPI com todos os campos obrigatórios', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-002', 'CT-02: Bloquear cadastro de EPI sem CA', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-003', 'CT-03: Bloquear cadastro de EPI com validade de CA inválida', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-004', 'CT-04: Permitir cadastro com categoria padrão', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-005', 'CT-05: Permitir cadastro com categoria personalizada', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-006', 'CT-06: Registrar entrada manual no estoque', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-007', 'CT-07: Registrar entrada por importação de XML NF-e', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-008', 'CT-08: Validar composição do local em dois níveis', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-009', 'CT-09: Registrar entrega de EPI ao colaborador (wizard visível)', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-010', 'CT-10: Wizard de entrega possui etapa de assinatura', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-011', 'CT-11: Aba de histórico existe e registra movimentações', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-012', 'CT-12: Sistema valida saldo antes da entrega', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-013', 'CT-13: Sistema bloqueia entrega com CA vencido', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-014', 'CT-14: Botão/modal de devolução existe na lista de entregas', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-015', 'CT-15: Modal de devolução oferece destino Manutenção', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-016', 'CT-16: Modal de devolução oferece destino Descarte', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-017', 'CT-17: Devolução exige campo de observação', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-018', 'CT-18: Aba de alertas exibe alertas de CA vencido', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-019', 'CT-19: Aba de alertas detecta estoque baixo', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-020', 'CT-20: Alertas incluem EPIs próximos do vencimento', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-021', 'CT-21: Alertas incluem atraso de troca', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-022', 'CT-22: Dashboard de saldo por local é exibido', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-023', 'CT-23: Formulário de transferência está disponível', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-024', 'CT-24: Aba Matriz de proteção é acessível', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-025', 'CT-25: Matriz identifica pendências de EPI', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-026', 'CT-26: Wizard de entrega acessa dados da matriz', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-027', 'CT-27: Histórico de movimentações possui dados tabulares', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-028', 'CT-28: Aba de auditoria IA está acessível', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-029', 'CT-29: Wizard gera comprovante com assinatura', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-030', 'CT-30: Rastreabilidade via histórico de movimentações', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-031', 'CT-31: Matriz evidencia gaps de fornecimento por função', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-032', 'CT-32: Entrega valida CA e rastreabilidade', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-033', 'CT-33: Registro formal de entrega com aceite documentado', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-034', 'CT-34: Periodicidade de troca gera alertas', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-035', 'CT-35: Matriz exibe EPIs obrigatórios por função', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-036', 'CT-36: CA duplicado é bloqueado no cadastro', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-037', 'CT-37: Entrada com quantidade inválida é bloqueada', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-038', 'CT-38: Entrega com quantidade zero é bloqueada', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-039', 'CT-39: Colaborador inativo é bloqueado na entrega', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-040', 'CT-40: Devolução só disponível para entregas ativas', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-041', 'CT-41: Destino Estoque requer estado compatível', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-042', 'CT-42: Toda alteração de saldo gera movimentação', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-043', 'CT-43: Sistema trata EPIs sem estoque mínimo configurado', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-044', 'CT-44: Sistema sinaliza funções sem matriz definida', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-045', 'CT-45: XML inválido é rejeitado na importação', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-046', 'CT-46: Entrega incompleta não gera baixa no estoque', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-047', 'CT-47: Controle de concorrência impede saldo negativo', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-EPI-048', 'CT-48: Alerta preventivo sem bloqueio para EPI próximo do vencimento', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/epi.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'saude-ocupacional/epi'
ON CONFLICT (codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      tipo = EXCLUDED.tipo,
      prioridade = EXCLUDED.prioridade,
      status = EXCLUDED.status,
      objetivo = EXCLUDED.objetivo,
      pre_condicoes = EXCLUDED.pre_condicoes,
      passos = EXCLUDED.passos,
      resultado_esperado = EXCLUDED.resultado_esperado,
      observacoes = EXCLUDED.observacoes,
      nivel = EXCLUDED.nivel,
      base_legal = EXCLUDED.base_legal,
      modulo_id = EXCLUDED.modulo_id,
      disposicao = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao ELSE qa_casos_teste.disposicao END,
      disposicao_motivo = CASE WHEN qa_casos_teste.disposicao = 'em_triagem' THEN EXCLUDED.disposicao_motivo ELSE qa_casos_teste.disposicao_motivo END,
      updated_at = now();


-- (3) PONTES — 15 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('EPI-001', 'qa_caso_epi_001', true),
    ('EPI-010', 'qa_caso_epi_010', true),
    ('EPI-011', 'qa_caso_epi_011', true),
    ('EPI-020', 'qa_caso_epi_020', true),
    ('EPI-021', 'qa_caso_epi_021', true),
    ('EPI-022', 'qa_caso_epi_022', true),
    ('EPI-030', 'qa_caso_epi_030', true),
    ('EPI-040', 'qa_caso_epi_040', true),
    ('EPI-041', 'qa_caso_epi_041', true),
    ('EPI-042', 'qa_caso_epi_042', true),
    ('EPI-043', 'qa_caso_epi_043', true),
    ('EPI-044', 'qa_caso_epi_044', true),
    ('EPI-050', 'qa_caso_epi_050', true),
    ('EPI-051', 'qa_caso_epi_051', true),
    ('EPI-052', 'qa_caso_epi_052', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 65, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('EPI-001'), ('EPI-010'), ('EPI-011'), ('EPI-020'), ('EPI-021'), ('EPI-022'), ('EPI-030'), ('EPI-031'), ('EPI-040'), ('EPI-041'), ('EPI-042'), ('EPI-043'), ('EPI-044'), ('EPI-050'), ('EPI-051'), ('EPI-052'), ('EPI-060'), ('TELA-EPI-001'), ('TELA-EPI-002'), ('TELA-EPI-003'), ('TELA-EPI-004'), ('TELA-EPI-005'), ('TELA-EPI-006'), ('TELA-EPI-007'), ('TELA-EPI-008'), ('TELA-EPI-009'), ('TELA-EPI-010'), ('TELA-EPI-011'), ('TELA-EPI-012'), ('TELA-EPI-013'), ('TELA-EPI-014'), ('TELA-EPI-015'), ('TELA-EPI-016'), ('TELA-EPI-017'), ('TELA-EPI-018'), ('TELA-EPI-019'), ('TELA-EPI-020'), ('TELA-EPI-021'), ('TELA-EPI-022'), ('TELA-EPI-023'), ('TELA-EPI-024'), ('TELA-EPI-025'), ('TELA-EPI-026'), ('TELA-EPI-027'), ('TELA-EPI-028'), ('TELA-EPI-029'), ('TELA-EPI-030'), ('TELA-EPI-031'), ('TELA-EPI-032'), ('TELA-EPI-033'), ('TELA-EPI-034'), ('TELA-EPI-035'), ('TELA-EPI-036'), ('TELA-EPI-037'), ('TELA-EPI-038'), ('TELA-EPI-039'), ('TELA-EPI-040'), ('TELA-EPI-041'), ('TELA-EPI-042'), ('TELA-EPI-043'), ('TELA-EPI-044'), ('TELA-EPI-045'), ('TELA-EPI-046'), ('TELA-EPI-047'), ('TELA-EPI-048')),
x AS MATERIALIZED (
  SELECT
    (SELECT count(*) FROM alvo) AS esperados,
    (SELECT count(*) FROM alvo a JOIN public.qa_casos_teste c ON c.codigo = a.codigo) AS casos_no_alvo,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_casos_teste c ON c.codigo = a.codigo
       JOIN public.qa_implementacoes i ON i.codigo = c.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NOT NULL) AS com_rotina,
    (SELECT count(*) FROM alvo a
       JOIN public.qa_implementacoes i ON i.codigo = a.codigo AND i.ativo
      WHERE to_regprocedure('public.' || i.funcao_sql || '()') IS NULL) AS ponte_orfa
)
SELECT esperados, casos_no_alvo, com_rotina, ponte_orfa,
       CASE WHEN casos_no_alvo = esperados AND ponte_orfa = 0
            THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico
FROM x;
