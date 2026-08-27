-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 10 de 15
-- Hub Contábil, Identidade Estratégica, Incidentes & Acidentes e Metas
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

-- (1) ROTINAS — 76 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cert_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cert_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cert_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cert_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cert_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cert_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cert_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cert_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cert_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hcal_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hcal_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hcal_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hcal_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hcal_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hcal_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hcal_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hcal_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hcal_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hcat_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hcat_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hcat_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hcat_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hcat_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hcat_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_htpl_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_htpl_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_htpl_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_htpl_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_htpl_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_htpl_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar contabilidade "Contabil Exemplo"'; r.esperado:='Criada';
  INSERT INTO public.hub_contabilidades (tenant_id, nome, cnpj, email_principal)
  VALUES (v_t, '[QA] Contabil Exemplo', '11222333000181', 'qa@contabil.invalid') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Contabilidade criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Abrir competencia "2026-02"'; r.esperado:='Competencia criada em preparacao';
  v_id := public.qa_nova_competencia('[QA]2026-02');
  IF v_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.hub_competencias WHERE id=v_id AND status='em_preparacao') THEN
    r.situacao:='passou'; r.obtido:='Competencia criada, status inicial em_preparacao.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou ou status inicial inesperado.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar contabilidade sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.hub_contabilidades (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU contabilidade sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hub_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hub_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hub_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Definir missao e visao do cliente'; r.esperado:='Identidade criada';
  INSERT INTO public.estrategia_cultura (tenant_id, missao, visao)
  VALUES (v_t, '[QA] Proteger vidas no trabalho', '[QA] Ser referencia em SST') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Identidade criada com missao e visao.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade com 3 valores'; r.esperado:='Os 3 valores ficam guardados na lista';
  INSERT INTO public.estrategia_cultura (tenant_id, missao, valores)
  VALUES (v_t, '[QA] Missao', '["Seguranca","Etica","Cuidado"]'::jsonb) RETURNING id INTO v_id;
  SELECT jsonb_array_length(valores) INTO v_qtd FROM public.estrategia_cultura WHERE id=v_id;
  IF v_qtd = 3 THEN r.situacao:='passou'; r.obtido:='3 valores guardados na lista.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 3 valores, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_m text;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade e depois trocar a missao'; r.esperado:='Missao nova persiste';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t, '[QA] Missao Antiga') RETURNING id INTO v_id;
  UPDATE public.estrategia_cultura SET missao='[QA] Missao Nova' WHERE id=v_id;
  SELECT missao INTO v_m FROM public.estrategia_cultura WHERE id=v_id;
  IF v_m='[QA] Missao Nova' THEN r.situacao:='passou'; r.obtido:='Missao atualizada.';
  ELSE r.situacao:='falhou'; r.obtido:='Missao='||v_m; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade so com missao (sem visao)'; r.esperado:='Aceito (campos opcionais)';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t, '[QA] So Missao') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Aceito so com missao, visao pode ficar para depois.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade com lista de valores vazia'; r.esperado:='Aceito com []';
  INSERT INTO public.estrategia_cultura (tenant_id, missao, valores) VALUES (v_t, '[QA] Missao', '[]'::jsonb) RETURNING id INTO v_id;
  SELECT jsonb_array_length(valores) INTO v_qtd FROM public.estrategia_cultura WHERE id=v_id;
  IF v_id IS NOT NULL AND v_qtd = 0 THEN r.situacao:='passou'; r.obtido:='Aceito com lista de valores vazia.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Valores=%s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_emp uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_identidade(v_t);
  -- cria uma empresa no cercado para amarrar a identidade
  v_emp := public.qa_nova_empresa('[QA] Empresa Da Identidade', '33444555000199');
  r.passo_ordem:=1; r.passo_acao:='Criar a identidade da EMPRESA'; r.esperado:='Segunda identidade para a MESMA empresa e recusada';
  INSERT INTO public.estrategia_cultura (tenant_id, empresa_id, missao)
  VALUES (v_t, v_emp, '[QA] Primeira Identidade da Empresa');
  r.passo_ordem:=2; r.passo_acao:='Tentar uma SEGUNDA identidade para a mesma empresa';
  BEGIN
    INSERT INTO public.estrategia_cultura (tenant_id, empresa_id, missao)
    VALUES (v_t, v_emp, '[QA] Segunda Identidade da Empresa');
    r.situacao:='falhou'; r.obtido:='ACEITOU duas identidades para a mesma empresa — o UNIQUE (tenant, empresa) sumiu.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: cada empresa tem uma unica identidade, como esperado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ide_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  PERFORM public.qa_limpa_identidade(v_t1);
  PERFORM public.qa_limpa_identidade(v_t2);
  r.passo_ordem:=1; r.passo_acao:='Criar identidade no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.estrategia_cultura (tenant_id, missao) VALUES (v_t1, '[QA] Missao Secreta T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.estrategia_cultura WHERE tenant_id=v_t2 AND missao='[QA] Missao Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Identidade do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s identidade(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ide_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ide_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_niveis text[]; v_ind boolean; v_obj boolean; v_min int; v_max int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar a configuracao de metas do cliente';
  r.esperado:='Quatro niveis, indicador obrigatorio, objetivo opcional, escala 0-100';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t) RETURNING id INTO v_id;
  SELECT niveis_habilitados, exigir_indicador, exigir_objetivo_estrategico, escala_min, escala_max
    INTO v_niveis, v_ind, v_obj, v_min, v_max
    FROM public.metas_configuracao WHERE id=v_id;
  IF array_length(v_niveis,1)=4 AND v_ind AND NOT v_obj AND v_min=0 AND v_max=100 THEN
    r.situacao:='passou';
    r.obtido:='Configuracao criada com os padroes: 4 niveis, indicador obrigatorio, objetivo estrategico opcional, escala 0-100.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Padroes inesperados: niveis=%s, exigir_indicador=%s, exigir_objetivo=%s, escala=%s-%s.',
                     array_length(v_niveis,1), v_ind, v_obj, v_min, v_max);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mcfg_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mcfg_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_niveis text[];
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Restringir os niveis habilitados a estrategica e individual';
  r.esperado:='A restricao persiste';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t) RETURNING id INTO v_id;
  UPDATE public.metas_configuracao
     SET niveis_habilitados = ARRAY['estrategica','individual'] WHERE id=v_id;
  SELECT niveis_habilitados INTO v_niveis FROM public.metas_configuracao WHERE id=v_id;
  IF array_length(v_niveis,1)=2 AND 'estrategica'=ANY(v_niveis) AND 'individual'=ANY(v_niveis) THEN
    r.situacao:='passou'; r.obtido:='Niveis restringidos a estrategica e individual, como configurado.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Niveis gravados: %s.', v_niveis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mcfg_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mcfg_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_obj boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Ligar a obrigatoriedade de objetivo estrategico';
  r.esperado:='A obrigatoriedade persiste';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t) RETURNING id INTO v_id;
  UPDATE public.metas_configuracao SET exigir_objetivo_estrategico = true WHERE id=v_id;
  SELECT exigir_objetivo_estrategico INTO v_obj FROM public.metas_configuracao WHERE id=v_id;
  IF v_obj THEN
    r.situacao:='passou'; r.obtido:='Obrigatoriedade de objetivo estrategico ligada e persistida.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A configuracao nao persistiu.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mcfg_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mcfg_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Criar a configuracao do cliente';
  r.esperado:='Uma segunda configuracao para o mesmo cliente e recusada';
  INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t);
  r.passo_ordem:=2; r.passo_acao:='Tentar criar uma SEGUNDA configuracao para o mesmo cliente';
  BEGIN
    INSERT INTO public.metas_configuracao (tenant_id) VALUES (v_t);
    r.situacao:='falhou'; r.obtido:='ACEITOU duas configuracoes para o mesmo cliente — regras conflitantes.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: cada cliente tem uma unica configuracao, como esperado.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mcfg_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mcfg_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_min int; v_max int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Gravar escala de avaliacao invertida (minimo 100, maximo 0)';
  r.esperado:='Idealmente recusado — o minimo nao pode exceder o maximo';
  BEGIN
    INSERT INTO public.metas_configuracao (tenant_id, escala_min, escala_max)
    VALUES (v_t, 100, 0) RETURNING id INTO v_id;
    SELECT escala_min, escala_max INTO v_min, v_max FROM public.metas_configuracao WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU escala de %s a %s (invertida). Sem CHECK de coerencia — mesmo padrao de CARGO-012 e EMP-041.', v_min, v_max);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: a escala precisa ter minimo menor que o maximo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mcfg_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mcfg_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mcfg_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid; v_obj text;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_limpa_config_metas(v_t);
  r.passo_ordem:=1; r.passo_acao:='Ligar exigir_objetivo_estrategico na configuracao do cliente';
  INSERT INTO public.metas_configuracao (tenant_id, exigir_objetivo_estrategico) VALUES (v_t, true);

  r.passo_ordem:=2;
  r.passo_acao:='Criar uma meta SEM objetivo estrategico, com a configuracao exigindo';
  r.esperado:='Idealmente recusado, ja que a configuracao do cliente exige o vinculo';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano)
    VALUES (v_t, '[QA] Meta sem objetivo estrategico', 2026) RETURNING id INTO v_meta;
    SELECT objetivo_estrategico INTO v_obj FROM public.metas WHERE id=v_meta;
    r.situacao:='falhou';
    r.obtido:='O BANCO ACEITOU meta sem objetivo estrategico mesmo com a configuracao exigindo. A parametrizacao e aplicada so pelo front — importacao e API a ignoram.';
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco aplica a parametrizacao do cliente.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mcfg_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mcfg_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; c record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MCHK] Meta Acompanhada');
  UPDATE public.metas SET valor_atual = 40, progresso = 40 WHERE id = v_meta;

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar check-in de 40 para 60, com observação e bloqueio';
  r.esperado := 'Linha com o par anterior/novo de valor e progresso';
  INSERT INTO public.metas_checkins
    (tenant_id, meta_id, valor_anterior, valor_novo, progresso_anterior, progresso_novo,
     observacao, bloqueios, realizado_por_nome)
  VALUES (v_t, v_meta, 40, 60, 40, 60,
          'Avanço no trimestre', 'Dependência do fornecedor', '[QA] Agente');

  SELECT * INTO c FROM public.metas_checkins WHERE meta_id = v_meta;
  IF c.valor_anterior = 40 AND c.valor_novo = 60
     AND c.progresso_anterior = 40 AND c.progresso_novo = 60
     AND c.observacao IS NOT NULL AND c.bloqueios IS NOT NULL THEN
    r.situacao := 'passou'; r.obtido := 'Check-in preserva o antes e o depois, com observação e bloqueio.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Check-in gravado incompleto: valor %s->%s, progresso %s->%s.',
      c.valor_anterior, c.valor_novo, c.progresso_anterior, c.progresso_novo);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mchk_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mchk_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_prog int; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MCHK] Meta Que Conclui');
  UPDATE public.metas SET valor_atual = 40, progresso = 40, status = 'em_andamento' WHERE id = v_meta;

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar check-in com progresso_novo = 100 por fora da tela';
  r.esperado := 'A meta acompanha: progresso 100, status concluída';
  INSERT INTO public.metas_checkins
    (tenant_id, meta_id, valor_anterior, valor_novo, progresso_anterior, progresso_novo)
  VALUES (v_t, v_meta, 40, 100, 40, 100);

  SELECT progresso, status::text INTO v_prog, v_status FROM public.metas WHERE id = v_meta;
  IF v_prog = 100 AND v_status = 'concluida' THEN
    r.situacao := 'passou'; r.obtido := 'Meta e histórico contam a mesma história em qualquer rota.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('CHECK-IN SEM EFEITO NA META: histórico marca 100%%, a meta segue com progresso %s e status %s. '
      'A derivação (100 = concluída) vive em dois comandos separados do front — por API o histórico anda e a meta fica. '
      'Correção sugerida: trigger em metas_checkins aplicando valor, progresso e status na meta.',
      v_prog, v_status);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mchk_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mchk_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MCHK] Progresso Absurdo');

  r.passo_ordem := 1; r.passo_acao := 'Registrar check-in com progresso_novo = 250';
  r.esperado := 'Recusado — progresso é percentual de 0 a 100';
  BEGIN
    INSERT INTO public.metas_checkins (tenant_id, meta_id, progresso_anterior, progresso_novo)
    VALUES (v_t, v_meta, 0, 250);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU check-in de 250%. progresso_novo é INTEGER sem CHECK — espelho exato '
      'do que META-012 encontrou na própria meta. Correção: CHECK BETWEEN 0 AND 100 nas duas tabelas.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusado 250.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Registrar check-in com progresso_novo = -30';
  r.esperado := 'Recusado';
  BEGIN
    INSERT INTO public.metas_checkins (tenant_id, meta_id, progresso_anterior, progresso_novo)
    VALUES (v_t, v_meta, 0, -30);
    r.situacao := 'falhou'; r.obtido := 'Recusou 250 mas ACEITOU -30.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Progresso restrito a 0-100 nos dois extremos.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mchk_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mchk_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mchk_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t2 uuid := public.qa_sandbox2_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;
  v_meta := public.qa_nova_meta('[QA-MCHK] Meta do Tenant 1');

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir check-in com tenant do cercado 2 apontando meta do cercado 1';
  r.esperado := 'Recusado — check-in e meta precisam ser do mesmo tenant';
  BEGIN
    INSERT INTO public.metas_checkins (tenant_id, meta_id, progresso_anterior, progresso_novo)
    VALUES (v_t2, v_meta, 0, 10);
    r.situacao := 'falhou';
    r.obtido := 'CHECK-IN CRUZANDO TENANTS ACEITO: o histórico da meta do cliente 1 ganhou '
      'um registro fantasma do cliente 2. A FK de meta_id não olha tenant — falta o gatilho '
      'de coerência, mesmo remédio de FER-004.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou';
    r.obtido := 'Check-in cruzando tenants recusado: ' || SQLERRM;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mchk_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mchk_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta "Reduzir acidentes em 20%"'; r.esperado:='Meta criada';
  v_id := public.qa_nova_meta('[QA] Reduzir acidentes em 20%');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Meta criada.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta e adicionar 2 key results'; r.esperado:='2 OKRs vinculados a meta';
  v_meta := public.qa_nova_meta('[QA] Meta Com OKRs');
  INSERT INTO public.meta_okrs (tenant_id, meta_id, key_result, valor_alvo) VALUES
    (v_t, v_meta, '[QA] Treinar 100% da equipe', 100),
    (v_t, v_meta, '[QA] Zerar reincidencias', 0);
  SELECT count(*) INTO v_qtd FROM public.meta_okrs WHERE meta_id=v_meta;
  IF v_qtd = 2 THEN r.situacao:='passou'; r.obtido:='2 key results vinculados a meta.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2 OKRs, achou %s.', v_qtd); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_prog int; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta e avancar progresso para 50%, status em_andamento'; r.esperado:='Progresso e status atualizados';
  v_id := public.qa_nova_meta('[QA] Meta Em Progresso');
  UPDATE public.metas SET progresso=50, status='em_andamento' WHERE id=v_id;
  SELECT progresso, status INTO v_prog, v_st FROM public.metas WHERE id=v_id;
  IF v_prog=50 AND v_st='em_andamento' THEN r.situacao:='passou'; r.obtido:='Progresso 50% e status em_andamento.';
  ELSE r.situacao:='falhou'; r.obtido:=format('progresso=%s status=%s.', v_prog, v_st); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar meta sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano) VALUES (v_t, NULL, 2026);
    r.situacao:='falhou'; r.obtido:='ACEITOU meta sem titulo.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar periodo = "quinzenal" (fora do enum)'; r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, periodo) VALUES (v_t, '[QA] Periodo Invalido', 2026, 'quinzenal');
    r.situacao:='falhou'; r.obtido:='ACEITOU periodo fora do enum.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: periodo so aceita mensal/trimestral/semestral/anual.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_prog int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar meta com progresso = 150 (fora de 0-100)';
  r.esperado:='Idealmente recusado; revela se ha CHECK de faixa';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, progresso) VALUES (v_t, '[QA] Progresso Absurdo', 2026, 150)
    RETURNING id INTO v_id;
    SELECT progresso INTO v_prog FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU progresso = %s (fora de 0-100). Nao ha CHECK de faixa em metas — validacao so no front, se houver.', v_prog);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: progresso so aceita 0 a 100.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid; v_okr uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta com 1 key result'; r.esperado:='Apagar a meta apaga o OKR junto (CASCADE)';
  v_meta := public.qa_nova_meta('[QA] Meta Que Sera Apagada');
  INSERT INTO public.meta_okrs (tenant_id, meta_id, key_result, valor_alvo)
  VALUES (v_t, v_meta, '[QA] OKR Some Junto', 100) RETURNING id INTO v_okr;
  r.passo_ordem:=2; r.passo_acao:='Apagar a meta';
  DELETE FROM public.metas WHERE id=v_meta;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o OKR foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.meta_okrs WHERE id=v_okr;
  IF v_sobrou=0 THEN r.situacao:='passou'; r.obtido:='OKR apagado junto com a meta (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('OKR NAO foi apagado (%s ainda existe).', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar meta no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.metas (tenant_id, titulo, ano) VALUES (v_t1, '[QA] Meta Secreta T1', 2026);
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.metas WHERE tenant_id=v_t2 AND titulo='[QA] Meta Secreta T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Meta do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s meta(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar meta com nivel "departamental" (fora da lista)';
  r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, nivel)
    VALUES (v_t, '[QA] Meta Nivel Invalido', 2026, 'departamental');
    r.situacao:='falhou'; r.obtido:='ACEITOU nivel fora da lista.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: nivel so aceita estrategica/unidade/setor/individual.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pai uuid; v_filha uuid; v_pai_da_filha uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar a meta estrategica (pai)';
  r.esperado:='A meta de setor referencia a estrategica como pai';
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel)
  VALUES (v_t, '[QA] Reduzir acidentes em 30%', 2026, 'estrategica') RETURNING id INTO v_pai;
  r.passo_ordem:=2; r.passo_acao:='Criar a meta de setor desdobrada dela';
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel, meta_pai_id)
  VALUES (v_t, '[QA] Reduzir acidentes na producao', 2026, 'setor', v_pai) RETURNING id INTO v_filha;
  SELECT meta_pai_id INTO v_pai_da_filha FROM public.metas WHERE id=v_filha;
  IF v_pai_da_filha = v_pai THEN
    r.situacao:='passou'; r.obtido:='Desdobramento criado: a meta de setor aponta para a estrategica.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A meta filha nao referenciou a meta pai.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_032()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pai uuid; v_filha uuid; v_existe boolean; v_pai_da_filha uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Montar o desdobramento (pai e filha)';
  r.esperado:='Apagar a pai preserva a filha, sem o vinculo';
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel)
  VALUES (v_t, '[QA] Estrategica Que Sera Apagada', 2026, 'estrategica') RETURNING id INTO v_pai;
  INSERT INTO public.metas (tenant_id, titulo, ano, nivel, meta_pai_id)
  VALUES (v_t, '[QA] Meta De Setor Sobrevivente', 2026, 'setor', v_pai) RETURNING id INTO v_filha;
  r.passo_ordem:=2; r.passo_acao:='Apagar a meta pai';
  DELETE FROM public.metas WHERE id=v_pai;
  r.passo_ordem:=3; r.passo_acao:='Conferir que a filha sobreviveu, sem meta pai';
  SELECT EXISTS(SELECT 1 FROM public.metas WHERE id=v_filha) INTO v_existe;
  SELECT meta_pai_id INTO v_pai_da_filha FROM public.metas WHERE id=v_filha;
  IF v_existe AND v_pai_da_filha IS NULL THEN
    r.situacao:='passou';
    r.obtido:='A meta de setor sobreviveu e ficou sem meta pai (SET NULL). O desdobramento nao foi destruido.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Filha existe=%s, meta_pai_id=%s.', v_existe, v_pai_da_filha);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_032()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_032 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_033()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_base numeric; v_alvo numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Criar meta com direcao maior_melhor, baseline 100 e alvo 50 (invertido)';
  r.esperado:='Idealmente alertado — com maior_melhor, o alvo deveria superar o baseline';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, indicador_direcao, valor_baseline, valor_alvo)
    VALUES (v_t, '[QA] Meta Baseline Invertido', 2026, 'maior_melhor', 100, 50)
    RETURNING id INTO v_id;
    SELECT valor_baseline, valor_alvo INTO v_base, v_alvo FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU baseline %s e alvo %s com direcao "maior e melhor" — a meta ja nasce atingida. Sem validacao entre baseline, alvo e direcao.', v_base, v_alvo);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco valida a coerencia entre baseline, alvo e direcao.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_033()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_033 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_034()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_ini date; v_fim date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta com data fim anterior a data inicio';
  r.esperado:='Idealmente recusado — periodo de vigencia impossivel';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano, data_inicio, data_fim)
    VALUES (v_t, '[QA] Meta Periodo Invertido', 2026, DATE '2026-12-31', DATE '2026-01-01')
    RETURNING id INTO v_id;
    SELECT data_inicio, data_fim INTO v_ini, v_fim FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU vigencia de %s ate %s (fim antes do inicio). Sem CHECK de coerencia entre as datas.', v_ini, v_fim);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: a data fim precisa ser posterior ao inicio.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_034()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_034 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_meta_035()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_tit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar meta com titulo formado so por espacos em branco';
  r.esperado:='Idealmente recusado — conteudo vazio mascarado';
  BEGIN
    INSERT INTO public.metas (tenant_id, titulo, ano)
    VALUES (v_t, '   ', 2026) RETURNING id INTO v_id;
    SELECT titulo INTO v_tit FROM public.metas WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU titulo com %s espacos em branco. NOT NULL nao alcanca string vazia mascarada — a meta aparece sem titulo nas listas.', length(v_tit));
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: titulo precisa ter conteudo real, nao so espacos.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_meta_035()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_meta_035 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mevd_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; e record;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MEVD] Meta Comprovada');

  r.passo_ordem := 1;
  r.passo_acao := 'Anexar evidência tipo link com título e período de referência';
  r.esperado := 'Evidência vinculada à meta, com autor';
  INSERT INTO public.metas_evidencias
    (tenant_id, meta_id, tipo, titulo, link_externo, periodo_referencia, criado_por_nome)
  VALUES (v_t, v_meta, 'link', '[QA] Relatório do trimestre',
          'https://exemplo.interno/relatorio-q1', '2026-Q1', '[QA] Agente');

  SELECT * INTO e FROM public.metas_evidencias WHERE meta_id = v_meta;
  IF e.titulo IS NOT NULL AND e.link_externo IS NOT NULL AND e.periodo_referencia = '2026-Q1' THEN
    r.situacao := 'passou'; r.obtido := 'Evidência gravada e relida por inteiro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'Evidência gravada incompleta.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mevd_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mevd_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mevd_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MEVD] Evidencia de Nada');

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir evidência sem arquivo, sem link, sem título e sem descrição';
  r.esperado := 'Recusado — evidência precisa ter ao menos um conteúdo';
  BEGIN
    INSERT INTO public.metas_evidencias (tenant_id, meta_id) VALUES (v_t, v_meta);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU evidência sem nenhum conteúdo — não evidencia nada e infla a contagem '
      'de comprovação da meta. Correção: CHECK exigindo arquivo_url, link_externo, titulo ou '
      'descricao preenchido.';
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Evidência vazia recusada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mevd_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mevd_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mevd_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MEVD] Meta Descartavel');
  INSERT INTO public.metas_evidencias (tenant_id, meta_id, tipo, titulo)
  VALUES (v_t, v_meta, 'arquivo', '[QA] Evidencia temporaria');

  r.passo_ordem := 1; r.passo_acao := 'Excluir a meta com evidência anexada';
  r.esperado := 'Meta e evidências somem juntas';
  DELETE FROM public.metas WHERE id = v_meta;
  SELECT count(*) INTO v_orfas FROM public.metas_evidencias WHERE meta_id = v_meta;
  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou as evidências junto com a meta.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s evidência(s) órfã(s).', v_orfas);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mevd_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mevd_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mind_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_tipo text; v_dir text; v_form text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar o indicador "Taxa de acidentes" no catalogo';
  r.esperado:='Tipo, direcao e formula preservados';
  INSERT INTO public.metas_indicadores (tenant_id, nome, tipo, unidade_medida, direcao, formula)
  VALUES (v_t, '[QA] Taxa de acidentes', 'quantitativo', '%', 'menor_melhor',
          '(acidentes no mes / total de colaboradores) * 100')
  RETURNING id INTO v_id;
  SELECT tipo::text, direcao::text, formula INTO v_tipo, v_dir, v_form
    FROM public.metas_indicadores WHERE id=v_id;
  IF v_tipo='quantitativo' AND v_dir='menor_melhor' AND v_form LIKE '%acidentes%' THEN
    r.situacao:='passou';
    r.obtido:='Indicador no catalogo: quantitativo, menor_melhor, com a formula preservada.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('tipo=%s, direcao=%s, formula preservada=%s.', v_tipo, v_dir, v_form IS NOT NULL);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mind_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mind_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mind_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar indicador com tipo "aproximado" (fora da lista)';
  r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas_indicadores (tenant_id, nome, tipo)
    VALUES (v_t, '[QA] Indicador Tipo Invalido', 'aproximado');
    r.situacao:='falhou'; r.obtido:='ACEITOU tipo fora da lista.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: tipo so aceita quantitativo/qualitativo/percentual/financeiro/marco/hibrido.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mind_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mind_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mind_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar indicador com direcao "crescente" (fora da lista)';
  r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.metas_indicadores (tenant_id, nome, direcao)
    VALUES (v_t, '[QA] Indicador Direcao Invalida', 'crescente');
    r.situacao:='falhou'; r.obtido:='ACEITOU direcao fora da lista.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: direcao so aceita maior_melhor/menor_melhor/igual_melhor/faixa.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mind_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mind_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mind_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar dois indicadores com o mesmo nome';
  r.esperado:='Idealmente o segundo seria recusado ou sinalizado';
  INSERT INTO public.metas_indicadores (tenant_id, nome, formula)
  VALUES (v_t, '[QA] Indicador Homonimo', 'formula A');
  BEGIN
    INSERT INTO public.metas_indicadores (tenant_id, nome, formula)
    VALUES (v_t, '[QA] Indicador Homonimo', 'formula B diferente');
    SELECT count(*) INTO v_qtd FROM public.metas_indicadores
     WHERE tenant_id=v_t AND nome='[QA] Indicador Homonimo';
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s indicadores com o mesmo nome e formulas diferentes. Sem restricao de unicidade no catalogo.', v_qtd);
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o nome do indicador e unico no catalogo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mind_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mind_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_n int; v_pesos numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Meta Compartilhada');

  r.passo_ordem := 1;
  r.passo_acao := 'Adicionar dois participantes com papéis e pesos distintos';
  r.esperado := 'Duas linhas com papel e peso de cada um';
  INSERT INTO public.metas_participantes
    (tenant_id, meta_id, participante_id, participante_nome, papel, peso)
  VALUES (v_t, v_meta, 'qa-part-1', '[QA] Ana', 'co_responsavel', 2),
         (v_t, v_meta, 'qa-part-2', '[QA] Bruno', 'contribuidor', 1);

  SELECT count(*), sum(peso) INTO v_n, v_pesos
  FROM public.metas_participantes WHERE meta_id = v_meta;
  IF v_n = 2 AND v_pesos = 3 THEN
    r.situacao := 'passou'; r.obtido := 'Dois participantes gravados com papel e peso.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s participante(s), soma de pesos %s.', v_n, v_pesos);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mpar_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mpar_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Sem Duplicata');
  INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome)
  VALUES (v_t, v_meta, 'qa-part-dup', '[QA] Carla');

  r.passo_ordem := 1; r.passo_acao := 'Inserir o mesmo participante de novo na mesma meta';
  r.esperado := 'Recusado pelo UNIQUE (meta_id, participante_id)';
  BEGIN
    INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome)
    VALUES (v_t, v_meta, 'qa-part-dup', '[QA] Carla');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU o participante duplicado — o peso dele contaria dobrado.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Duplicata recusada pelo UNIQUE.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mpar_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mpar_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Peso Estranho');

  r.passo_ordem := 1; r.passo_acao := 'Inserir participante com peso = -1';
  r.esperado := 'Recusado — peso é fator positivo';
  BEGIN
    INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome, peso)
    VALUES (v_t, v_meta, 'qa-part-neg', '[QA] Peso Negativo', -1);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU peso -1. peso é NUMERIC sem CHECK — negativo inverte a contribuição '
      'em qualquer média ponderada; zero anula sem remover. Correção: CHECK (peso > 0).';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Recusado -1.';
  END;

  r.passo_ordem := 2; r.passo_acao := 'Inserir participante com peso = 0';
  r.esperado := 'Recusado';
  BEGIN
    INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome, peso)
    VALUES (v_t, v_meta, 'qa-part-zero', '[QA] Peso Zero', 0);
    r.situacao := 'falhou'; r.obtido := 'Recusou -1 mas ACEITOU peso 0.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Só entra peso maior que zero.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mpar_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mpar_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mpar_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MPAR] Meta Descartavel');
  INSERT INTO public.metas_participantes (tenant_id, meta_id, participante_id, participante_nome)
  VALUES (v_t, v_meta, 'qa-part-casc', '[QA] Temporario');

  r.passo_ordem := 1; r.passo_acao := 'Excluir a meta compartilhada';
  r.esperado := 'Meta e participantes somem juntos';
  DELETE FROM public.metas WHERE id = v_meta;
  SELECT count(*) INTO v_orfas FROM public.metas_participantes WHERE meta_id = v_meta;
  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou os participantes junto com a meta.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s participante(s) órfão(s).', v_orfas);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mpar_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mpar_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_n int; v_just text;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Meta em Aprovacao');

  r.passo_ordem := 1;
  r.passo_acao := 'Transicionar rascunho -> em_aprovacao registrando o log';
  r.esperado := 'workflow_status atualizado e linha no log';
  UPDATE public.metas SET workflow_status = 'em_aprovacao' WHERE id = v_meta;
  INSERT INTO public.metas_workflow_log
    (tenant_id, meta_id, status_anterior, status_novo, acao, usuario_nome)
  VALUES (v_t, v_meta, 'rascunho', 'em_aprovacao', 'transicao', '[QA] Agente');

  r.passo_ordem := 2;
  r.passo_acao := 'Transicionar em_aprovacao -> ativa com justificativa';
  r.esperado := 'Segunda linha no log com a justificativa';
  UPDATE public.metas SET workflow_status = 'ativa' WHERE id = v_meta;
  INSERT INTO public.metas_workflow_log
    (tenant_id, meta_id, status_anterior, status_novo, acao, justificativa, usuario_nome)
  VALUES (v_t, v_meta, 'em_aprovacao', 'ativa', 'aprovacao', 'Meta alinhada ao ciclo 2026', '[QA] Aprovador');

  SELECT count(*) INTO v_n FROM public.metas_workflow_log WHERE meta_id = v_meta;
  SELECT justificativa INTO v_just FROM public.metas_workflow_log
  WHERE meta_id = v_meta AND status_novo = 'ativa';

  IF v_n = 2 AND v_just = 'Meta alinhada ao ciclo 2026' THEN
    r.situacao := 'passou'; r.obtido := 'Trilha completa: duas transições, justificativa preservada.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s linha(s) no log; justificativa = %s.', v_n, coalesce(v_just, 'nula'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mwkf_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mwkf_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_meta uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Status Inventado');
  r.passo_ordem := 1; r.passo_acao := 'Gravar workflow_status = aprovadissima';
  r.esperado := 'Recusado pelo enum meta_workflow_status';
  BEGIN
    EXECUTE format(
      'UPDATE public.metas SET workflow_status = %L::public.meta_workflow_status WHERE id = %L',
      'aprovadissima', v_meta);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU status fora da lista fechada.';
  EXCEPTION WHEN invalid_text_representation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: o enum é a proteção da máquina de estados.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mwkf_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mwkf_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_meta uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Ativada Sem Rastro');

  r.passo_ordem := 1;
  r.passo_acao := 'Atualizar workflow_status direto para ativa, sem passar pela tela';
  r.esperado := 'O banco registra a transição sozinho, mantendo a trilha íntegra';
  UPDATE public.metas SET workflow_status = 'ativa' WHERE id = v_meta;

  SELECT count(*) INTO v_n FROM public.metas_workflow_log WHERE meta_id = v_meta;
  IF v_n >= 1 THEN
    r.situacao := 'passou';
    r.obtido := 'O banco registrou a transição por conta própria — trilha íntegra em qualquer rota.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'A META FICOU ATIVA SEM NENHUMA LINHA DE TRILHA. O registro em '
      'metas_workflow_log é feito pelo front, num insert separado e sem checagem de erro — '
      'update por API, integração ou SQL muda o estado sem deixar rastro de quem aprovou. '
      'Correção sugerida: trigger AFTER UPDATE OF workflow_status gravando o log.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mwkf_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mwkf_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_mwkf_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_meta uuid; v_orfas int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_meta := public.qa_nova_meta('[QA-MWKF] Meta Descartavel');
  INSERT INTO public.metas_workflow_log (tenant_id, meta_id, status_anterior, status_novo, acao)
  VALUES (v_t, v_meta, 'rascunho', 'em_aprovacao', 'transicao'),
         (v_t, v_meta, 'em_aprovacao', 'ativa', 'aprovacao');

  r.passo_ordem := 1; r.passo_acao := 'Excluir a meta com duas transições na trilha';
  r.esperado := 'Meta e trilha somem juntas, sem linha órfã';
  DELETE FROM public.metas WHERE id = v_meta;
  SELECT count(*) INTO v_orfas FROM public.metas_workflow_log WHERE meta_id = v_meta;
  IF v_orfas = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou a trilha junto com a meta.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('%s linha(s) de trilha órfã(s) após excluir a meta.', v_orfas);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_mwkf_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_mwkf_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pass_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pass_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pass_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pchk_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pchk_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pchk_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pchk_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pchk_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pchk_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pdoc_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pdoc_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pdoc_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_pdoc_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_pdoc_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_pdoc_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_proc_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_proc_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_proc_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_proc_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_proc_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_proc_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_proc_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_proc_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_proc_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_proc_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_proc_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_proc_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_proc_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_proc_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_proc_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 85 casos.

-- Hub Contábil (30 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('CERT-001', 'Status da certidão é derivado da validade automaticamente', 'feliz', 'alta', 'aprovado', 'O trigger atualizar_status_certidao classifica pela data: vencida (validade no passado), a_vencer (até 30 dias) ou valida. A auditoria pediu para confirmar essa automação na prática, não só na leitura do código — é o mesmo tema do achado de terceiro_documentos.', 'Cercado disponível.', '[{"acao": "Gravar certidão com validade no passado", "ordem": 1, "resultado_esperado": "status = vencida, seja qual for o valor enviado"}, {"acao": "Gravar certidão com validade em 15 dias", "ordem": 2, "resultado_esperado": "status = a_vencer"}, {"acao": "Gravar certidão com validade em 6 meses", "ordem": 3, "resultado_esperado": "status = valida"}]', 'As três faixas de validade produzem os três status.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('CERT-010', 'Certidão emitida depois de vencer', 'negativo', 'media', 'aprovado', 'data_emissao posterior a data_validade é um documento que nasceu vencido — não existe certidão assim. Nenhum CHECK compara as duas datas.', 'Cercado disponível.', '[{"acao": "Gravar certidão com emissão 2026-12-01 e validade 2026-06-01", "ordem": 1, "resultado_esperado": "Recusado — emissão precisa anteceder a validade"}]', 'Datas incoerentes não entram.', 'Provável ACHADO. Correção: CHECK (data_emissao <= data_validade).', 'api', NULL, 'em_triagem', NULL),
    ('CERT-011', 'Certidão marcada como irregular não pode virar válida sozinha', 'excecao', 'alta', 'aprovado', 'O CHECK da tabela admite o status irregular — certidão com pendência apontada pelo órgão, mesmo dentro da validade. Mas o trigger de derivação SOBRESCREVE o status em todo insert e update, sem exceção: gravar irregular com validade futura volta como valida. O estado existe no contrato da tabela e é inalcançável na prática — e uma certidão irregular exibida como válida é exatamente o que o fiscal aponta.', 'Cercado disponível.', '[{"acao": "Gravar certidão com validade futura e status = irregular", "ordem": 1, "resultado_esperado": "O status irregular é respeitado — a derivação automática só decide entre valida, a_vencer e vencida quando ninguém marcou irregularidade"}]', 'Irregular marcado permanece irregular.', 'ACHADO DE DESENHO confirmado na leitura do trigger. Correção sugerida: o trigger preservar NEW.status = irregular (ou derivar apenas quando o status não foi informado).', 'api', NULL, 'em_triagem', NULL),
    ('HCAL-001', 'Calendário de envios: item mensal com status por competência', 'feliz', 'media', 'aprovado', 'O calendário lista o que precisa ser enviado à contabilidade todo mês (folha, guias, eventos), cada item com dia-limite. O status materializa o andamento por competência — um por item/competência, com quem concluiu e quando.', 'Cercado disponível.', '[{"acao": "Criar item de calendário com dia-limite 5", "ordem": 1, "resultado_esperado": "Item gravado"}, {"acao": "Marcar a competência corrente como concluída", "ordem": 2, "resultado_esperado": "Status gravado com autor e data"}]', 'Item e status gravados e relidos por inteiro.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('HCAL-010', 'Dia-limite fora de 1..31 é recusado', 'negativo', 'media', 'aprovado', 'O CHECK do dia-limite é a única proteção estrutural do calendário — dia 32 ou dia 0 não existe em mês nenhum. Este caso a protege contra regressão.', 'Cercado disponível.', '[{"acao": "Criar item com dia-limite 32", "ordem": 1, "resultado_esperado": "Recusado pelo CHECK"}, {"acao": "Criar item com dia-limite 0", "ordem": 2, "resultado_esperado": "Recusado"}]', 'Só entram dias de 1 a 31.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('HCAL-011', 'Uma competência, um status — a duplicata é barrada', 'negativo', 'media', 'aprovado', 'O UNIQUE (tenant, calendário, competência) impede dois status para o mesmo item no mesmo mês — sem ele, um item poderia constar concluído e pendente ao mesmo tempo.', 'Item de calendário com status na competência corrente.', '[{"acao": "Inserir segundo status para o mesmo item e competência", "ordem": 1, "resultado_esperado": "Recusado pelo UNIQUE"}]', 'A duplicata não entra.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('HCAL-012', 'Status não pode apontar calendário de outro cliente', 'negativo', 'alta', 'aprovado', 'A FK de calendario_id não olha tenant: um status do cliente A pode apontar item de calendário do cliente B — e o andamento de um cliente contaminaria o painel do outro. Mesma família de FER-004, MCHK-011 e PROC-011.', 'Cercados 1 e 2; item de calendário no cercado 2.', '[{"acao": "Inserir status no tenant 1 apontando calendário do tenant 2", "ordem": 1, "resultado_esperado": "Recusado — status e calendário do mesmo tenant"}]', 'Vínculo cruzando tenants não entra.', 'Mesmo remédio dos demais: gatilho de coerência de tenant.', 'api', NULL, 'em_triagem', NULL),
    ('HCAT-001', 'Catálogo: documento exigido por tipo de processo', 'feliz', 'media', 'aprovado', 'O catálogo parametriza qual documento cada tipo de processo exige (ex.: admissão pede contrato e ficha de registro), com obrigatoriedade, assinatura e prazo de retenção. É o que alimenta o checklist automático do processo.', 'Cercado disponível.', '[{"acao": "Cadastrar documento do catálogo para o tipo admissao, obrigatório, com retenção de 5 anos", "ordem": 1, "resultado_esperado": "Item gravado com tipo de processo, obrigatoriedade e retenção"}]', 'Catálogo gravado e relido por inteiro.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('HCAT-010', 'Obrigatoriedade e retenção sem faixa', 'negativo', 'media', 'aprovado', 'obrigatoriedade é texto livre (sem lista fechada) e prazo_retencao_anos aceita negativo. Obrigatoriedade inventada quebra o semeador de checklist em silêncio; retenção negativa é um prazo que venceu antes de existir.', 'Cercado disponível.', '[{"acao": "Cadastrar item com obrigatoriedade = talvez", "ordem": 1, "resultado_esperado": "Recusado — lista fechada (obrigatorio/opcional/condicional)"}, {"acao": "Cadastrar item com retenção de -5 anos", "ordem": 2, "resultado_esperado": "Recusado — retenção é não negativa"}]', 'Só entram obrigatoriedades previstas e retenção não negativa.', 'Provável ACHADO nos dois passos — mesma família de OBRG-020 (texto livre) e das faixas sem CHECK. Correção: CHECK de lista e CHECK (prazo_retencao_anos >= 0).', 'api', NULL, 'em_triagem', NULL),
    ('HTPL-001', 'Template de checklist global convive com o do cliente', 'feliz', 'media', 'aprovado', 'Os templates semeiam o checklist dos processos por tipo. Com tenant nulo o template é GLOBAL (vale para todos); com tenant, é do cliente. O caso grava o do cliente e confere o contrato do global por leitura — escrever configuração global de dentro de um teste contaminaria todos os clientes, e a cerca do cercado impede exatamente isso.', 'Cercado disponível.', '[{"acao": "Criar template do cliente para o tipo ferias", "ordem": 1, "resultado_esperado": "Gravado com tenant do cercado"}, {"acao": "Tentar criar template GLOBAL (tenant nulo) de dentro do teste", "ordem": 2, "resultado_esperado": "Bloqueado pela cerca do cercado — teste não escreve configuração de todos os clientes"}, {"acao": "Conferir o contrato do global por catálogo", "ordem": 3, "resultado_esperado": "tenant_id anulável — o modelo global existe"}]', 'Cliente grava; global é protegido da escrita de teste e o contrato existe.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('HTPL-010', 'Tipo do template precisa casar com os tipos de processo', 'negativo', 'media', 'aprovado', 'hub_processos.tipo é enum fechado (admissao, demissao, ferias...), mas o tipo do template é texto livre. Template com tipo inventado nunca é semeado em processo nenhum — vira configuração morta que a tela lista e o processo ignora.', 'Cercado disponível.', '[{"acao": "Criar template com tipo = processo_inventado", "ordem": 1, "resultado_esperado": "Recusado — o tipo precisa existir no enum hub_processo_tipo"}]', 'Só entram tipos que o processo reconhece.', 'Provável ACHADO. Correção: converter a coluna para o enum ou CHECK contra os rótulos do enum.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-001', 'Cadastrar uma contabilidade parceira', 'feliz', 'alta', 'aprovado', 'Verificar o cadastro de uma contabilidade parceira. Regra: a contabilidade que atende o cliente e cadastrada com nome, CNPJ e e-mail. Importa porque o Hub Contabil e a ponte entre a empresa e sua contabilidade — sem cadastrar o parceiro, nao ha com quem trocar as competencias mensais.', 'Usuario com permissao de administrar o Hub Contabil.', '[{"acao": "Abrir o cadastro de contabilidade", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Documentos e Governanca > Hub Contabil > Contabilidades > Nova", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher os dados da contabilidade", "dados": "Nome: Contabil Exemplo | CNPJ: 11.222.333/0001-81 | E-mail: contato@contabil.exemplo", "ordem": 2, "onde_na_tela": "Campos Nome, CNPJ e E-mail principal", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Contabilidade cadastrada e ativa"}]', 'A contabilidade Contabil Exemplo esta cadastrada e disponivel para receber as competencias.', 'IMPACTO SE FALHAR: sem cadastrar a contabilidade, o Hub nao tem destinatario — nao ha como enviar competencias nem organizar a troca de documentos com o escritorio contabil.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-002', 'Abrir uma competencia mensal', 'feliz', 'alta', 'aprovado', 'Verificar a abertura de uma competencia mensal. Regra: a competencia (ex.: 2026-02) e o pacote mensal que sera preparado, enviado e aprovado; nasce no status em_preparacao. Importa porque a competencia e a unidade de trabalho do Hub — todo o fluxo contabil gira em torno dela.', 'Acesso ao Hub Contabil.', '[{"acao": "Abrir o Hub e criar uma competencia", "dados": "Competencia: 2026-02", "ordem": 1, "onde_na_tela": "Hub Contabil > Competencias > Nova Competencia", "resultado_esperado": "Formulario aceita a competencia"}, {"acao": "Salvar e conferir o status inicial", "dados": "-", "ordem": 2, "onde_na_tela": "Salvar > ver a competencia criada", "resultado_esperado": "A competencia 2026-02 e criada com status em_preparacao"}]', 'A competencia 2026-02 existe, com status inicial em_preparacao, pronta para receber guias e documentos.', 'IMPACTO SE FALHAR: sem abrir competencias, o fluxo contabil mensal nao comeca — nao ha onde reunir guias e documentos do mes para enviar a contabilidade.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-003', 'Adicionar guias de imposto a uma competencia', 'feliz', 'critica', 'aprovado', 'Verificar que guias de impostos podem ser vinculadas a uma competencia. Regra: cada guia tem um tipo (INSS, FGTS, IRRF, DARF...), um valor e uma data de vencimento, e pertence a uma competencia. Importa porque as guias sao a parte mais critica do fluxo — sao os impostos que precisam ser pagos no prazo, sob pena de multa.', 'Precisa existir uma competencia aberta.', '[{"acao": "Abrir uma competencia e ir as guias", "dados": "-", "ordem": 1, "onde_na_tela": "Hub Contabil > abrir a competencia > aba Guias > Adicionar", "resultado_esperado": "Formulario de guia aberto"}, {"acao": "Adicionar duas guias de tipos diferentes", "dados": "Guia 1: INSS, R$ 1.500,00, vence em 20 dias | Guia 2: FGTS, R$ 800,00, vence em 7 dias", "ordem": 2, "onde_na_tela": "Campos Tipo, Valor e Data de vencimento", "resultado_esperado": "As duas guias sao aceitas"}, {"acao": "Conferir as guias da competencia", "dados": "-", "ordem": 3, "onde_na_tela": "aba Guias", "resultado_esperado": "As 2 guias aparecem vinculadas a competencia, com status pendente"}]', 'A competencia tem 2 guias (INSS e FGTS) vinculadas, cada uma com valor e vencimento, prontas para acompanhamento de pagamento.', 'IMPACTO SE FALHAR: sem vincular guias a competencia, os impostos do mes ficam sem controle centralizado — risco de vencimento em aberto e multa.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-004', 'Avancar o fluxo de status da competencia', 'feliz', 'alta', 'aprovado', 'Verificar que a competencia avanca pelo fluxo de status (em_preparacao para enviado, e depois para aprovado). Regra: o status controla em que etapa do processo mensal a competencia esta. Importa porque e esse fluxo que da visibilidade — saber se o mes ja foi enviado a contabilidade, se ja voltou aprovado ou se ainda esta sendo preparado.', 'Precisa existir uma competencia em preparacao.', '[{"acao": "Abrir uma competencia em preparacao", "dados": "-", "ordem": 1, "onde_na_tela": "Hub Contabil > abrir a competencia", "resultado_esperado": "Competencia com status em_preparacao"}, {"acao": "Enviar a competencia a contabilidade", "dados": "Status: enviado | Data de envio: hoje", "ordem": 2, "onde_na_tela": "Botao Enviar (ou mudar status para enviado)", "resultado_esperado": "Status muda para enviado, com a data registrada"}, {"acao": "Registrar a aprovacao da contabilidade", "dados": "Status: aprovado | Data de aprovacao: hoje", "ordem": 3, "onde_na_tela": "Botao Aprovar (ou mudar status para aprovado)", "resultado_esperado": "Status muda para aprovado"}]', 'A competencia percorre o fluxo: em_preparacao para enviado para aprovado, com as datas de cada etapa registradas.', 'IMPACTO SE FALHAR: sem o fluxo de status funcionando, perde-se a visibilidade de em que etapa cada mes esta — ninguem sabe se a competencia foi enviada, se voltou aprovada, ou se travou no meio.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-010', 'Contabilidade sem nome e recusada', 'excecao', 'media', 'aprovado', 'Verificar que uma contabilidade sem nome e recusada. Regra: nome e NOT NULL. Importa porque uma contabilidade sem nome nao pode ser identificada na hora de escolher para quem enviar as competencias.', 'Nenhuma.', '[{"acao": "Iniciar o cadastro de uma contabilidade", "dados": "-", "ordem": 1, "onde_na_tela": "Hub Contabil > Contabilidades > Nova", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o nome vazio e tentar salvar", "dados": "Nome: (vazio) | CNPJ: 11.222.333/0001-81", "ordem": 2, "onde_na_tela": "Campo Nome (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'A contabilidade sem nome e recusada.', 'IMPACTO SE FALHAR: contabilidade em branco na lista de parceiros — impossivel saber para quem se esta enviando os documentos do mes.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-011', 'Status de competencia invalido e recusado', 'excecao', 'alta', 'aprovado', 'Verificar que um status de competencia fora da lista e recusado. Regra: status so aceita os 7 valores do fluxo (em_preparacao, enviado, em_processamento, em_conferencia, aprovado, finalizado, reaberto). Importa porque um status invalido tiraria a competencia do fluxo — ela ficaria num limbo que nenhuma tela sabe tratar.', 'Acesso ao Hub Contabil.', '[{"acao": "Tentar criar (ou atualizar) uma competencia com status fora da lista", "dados": "Status: arquivado (invalido — nao esta entre os 7 do fluxo)", "ordem": 1, "onde_na_tela": "Hub Contabil > competencia > campo Status", "resultado_esperado": "O sistema DEVE recusar"}]', 'O status arquivado e recusado. So os 7 status do fluxo sao aceitos.', 'IMPACTO SE FALHAR: uma competencia com status invalido sairia do fluxo controlado — nao apareceria nos filtros corretos e ninguem saberia em que etapa ela esta.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-012', 'Tipo de guia invalido e recusado', 'excecao', 'alta', 'aprovado', 'Verificar que um tipo de guia fora da lista e recusado. Regra: tipo so aceita os tributos previstos (INSS, FGTS, IRRF, DARF, GRRF, PIS, COFINS, CSLL, ISS, contribuicao sindical, outro). Importa porque o tipo classifica o tributo — um valor livre quebraria relatorios fiscais e o acompanhamento por imposto.', 'Precisa existir uma competencia para vincular a guia.', '[{"acao": "Abrir uma competencia e tentar adicionar uma guia com tipo invalido", "dados": "Tipo: imposto_x (invalido — nao esta na lista de tributos) | Valor: 100 | Vencimento: em 10 dias", "ordem": 1, "onde_na_tela": "Hub Contabil > competencia > aba Guias > Adicionar > campo Tipo", "resultado_esperado": "O sistema DEVE recusar o tipo fora da lista"}]', 'A guia com tipo imposto_x e recusada. So os tipos de tributo previstos sao aceitos.', 'IMPACTO SE FALHAR: tipo de guia invalido quebraria relatorios fiscais e o acompanhamento por tributo — a guia nao apareceria nos totais do imposto correto.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-020', 'Competencia duplicada no mesmo cliente e recusada', 'negativo', 'alta', 'aprovado', 'Verificar que nao da para abrir a mesma competencia duas vezes no mesmo cliente. Regra: UNIQUE(tenant_id, competencia) — uma competencia 2026-02 por cliente. Importa porque duas competencias do mesmo mes dividiriam guias e documentos entre elas, e ninguem saberia qual e a oficial para enviar a contabilidade.', 'Precisa existir uma competencia ja aberta (ex.: 2026-06).', '[{"acao": "Abrir uma competencia", "dados": "Competencia: 2026-06", "ordem": 1, "onde_na_tela": "Hub Contabil > Nova Competencia", "resultado_esperado": "Competencia criada"}, {"acao": "Tentar abrir a MESMA competencia de novo", "dados": "Competencia: 2026-06 (a mesma)", "ordem": 2, "onde_na_tela": "Hub Contabil > Nova Competencia", "resultado_esperado": "O sistema DEVE recusar — ja existe"}]', 'A segunda 2026-06 e recusada. So existe uma competencia por mes em cada cliente.', 'IMPACTO SE FALHAR: duas competencias do mesmo mes dividiriam as guias e documentos — parte em uma, parte na outra. O envio a contabilidade sairia incompleto, com risco de imposto nao pago.', 'api', NULL, 'em_triagem', NULL),
    ('HUB-022', 'Dados do Hub de outro cliente sao invisiveis', 'negativo', 'critica', 'aprovado', 'Verificar que os dados do Hub de um cliente sao invisiveis para outro. Regra: isolamento multi-tenant. Importa porque o Hub contem informacao fiscal e financeira (valores de impostos, guias, competencias) — das mais sensiveis do sistema.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, abrir uma competencia", "dados": "Competencia: uma competencia identificavel do cliente A", "ordem": 1, "onde_na_tela": "Cliente A > Hub Contabil > Nova Competencia", "resultado_esperado": "Criada no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Procurar pela competencia do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Hub Contabil > Competencias", "resultado_esperado": "NAO aparece para o cliente B"}]', 'A competencia do cliente A e invisivel no cliente B. Zero vazamento de dados fiscais entre clientes.', 'IMPACTO SE FALHAR: exporia informacao fiscal e financeira (valores de impostos, guias) de um cliente a outro — das mais sensiveis do sistema, com implicacoes legais serias. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL),
    ('PASS-001', 'Criar solicitação de assinatura com token único', 'feliz', 'alta', 'aprovado', 'Cada assinatura nasce com um token aleatório único — é o segredo do link que o signatário recebe. O UNIQUE do token é a proteção contra colisão; este caso confirma a geração e a unicidade.', 'Processo com documento que requer assinatura.', '[{"acao": "Criar assinatura para o signatário", "ordem": 1, "resultado_esperado": "Token gerado automaticamente, status pendente"}, {"acao": "Tentar gravar outra assinatura com o MESMO token", "ordem": 2, "resultado_esperado": "Recusado pelo UNIQUE"}]', 'Token nasce único e a duplicata é barrada.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PCHK-001', 'Montar e concluir o checklist do processo', 'feliz', 'media', 'aprovado', 'O checklist diz o que precisa estar pronto antes de o processo seguir (documentos, conferências). Itens têm ordem, obrigatoriedade e marcação de concluído com autor.', 'Processo criado.', '[{"acao": "Adicionar dois itens, um obrigatório e um opcional", "ordem": 1, "resultado_esperado": "Itens gravados na ordem"}, {"acao": "Concluir o item obrigatório", "ordem": 2, "resultado_esperado": "concluido = true persiste"}]', 'Checklist gravado, ordenado e com conclusão persistida.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PCHK-010', 'Concluir processo com item obrigatório pendente', 'negativo', 'alta', 'aprovado', 'Se o item é obrigatório, o processo não deveria chegar a concluído com ele aberto — é a definição de obrigatório. Nenhuma camada do banco impede; se a tela impedir, API e SQL continuam passando por fora.', 'Processo com item de checklist obrigatório não concluído.', '[{"acao": "Mudar o status do processo para concluido com o item obrigatório aberto", "ordem": 1, "resultado_esperado": "Recusado — obrigatório pendente trava a conclusão"}]', 'Processo só conclui com os obrigatórios concluídos.', 'Provável ACHADO. Correção: trigger na transição para concluido conferindo o checklist obrigatório.', 'api', NULL, 'em_triagem', NULL),
    ('PDOC-001', 'Anexar documento e versionar por cima', 'feliz', 'media', 'aprovado', 'Documentos do processo têm versão: a v2 aponta a v1 por versao_anterior_id e assume eh_versao_final. É o que garante que a contabilidade sempre olha o arquivo certo.', 'Processo criado.', '[{"acao": "Anexar contrato v1 como versão final", "ordem": 1, "resultado_esperado": "Documento gravado, versao = 1"}, {"acao": "Anexar v2 apontando a v1 e marcar a v2 como final", "ordem": 2, "resultado_esperado": "Cadeia de versões íntegra, v2 final"}]', 'Versionamento grava a cadeia e a versão final.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PDOC-010', 'Versão anterior precisa ser do mesmo processo', 'negativo', 'media', 'aprovado', 'versao_anterior_id é FK para a própria tabela, sem exigir o mesmo processo_id. Uma v2 do processo A apontando documento do processo B cria uma cadeia de versões que atravessa processos — e o histórico do documento passa a contar a história errada.', 'Dois processos, cada um com um documento.', '[{"acao": "Gravar no processo A um documento cuja versão anterior é o documento do processo B", "ordem": 1, "resultado_esperado": "Recusado — a cadeia de versões não cruza processos"}]', 'Cadeia de versões confinada ao processo.', 'Provável ACHADO. Correção: trigger conferindo o processo_id da versão anterior.', 'api', NULL, 'em_triagem', NULL),
    ('PROC-001', 'Criar processo gera código sequencial automático', 'feliz', 'alta', 'aprovado', 'O processo é a unidade central do Hub. Ao criar, um trigger gera o código pelo tipo (admissão = ADM-00001, férias = FER-00001...), sequencial por cliente e por tipo. É o número que RH e contabilidade usam para se referir ao caso — não pode repetir nem saltar.', 'Cercado disponível.', '[{"acao": "Criar processo de admissão sem informar código", "ordem": 1, "resultado_esperado": "Código ADM-00001 gerado"}, {"acao": "Criar segundo processo de admissão", "ordem": 2, "resultado_esperado": "ADM-00002 — sequência avança"}, {"acao": "Criar processo de férias", "ordem": 3, "resultado_esperado": "FER-00001 — cada tipo tem a própria sequência"}]', 'Códigos sequenciais por tipo, sem repetição.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('PROC-002', 'Mudança de status do processo deixa trilha automática', 'feliz', 'alta', 'aprovado', 'Ao contrário do módulo Metas (MWKF-011), aqui a trilha É responsabilidade do banco: um trigger grava hub_processo_historico a cada mudança de status, seja qual for a rota de entrada. Este caso protege essa garantia contra regressão.', 'Processo criado em rascunho.', '[{"acao": "Mudar o status direto no banco, sem passar pela tela", "ordem": 1, "resultado_esperado": "Linha no histórico com status anterior e novo, gravada pelo trigger"}]', 'Toda mudança de status deixa trilha, por qualquer rota.', 'Referência de boa prática para a correção sugerida em MWKF-011 (Metas).', 'api', NULL, 'em_triagem', NULL),
    ('PROC-010', 'Prazo do processo anterior à data de referência', 'negativo', 'media', 'aprovado', 'data_limite antes de data_referencia é um prazo que venceu antes de o fato existir — o SLA nasce estourado. Nenhuma camada valida a coerência entre as duas datas.', 'Cercado disponível.', '[{"acao": "Criar processo com data_referencia = 2026-08-10 e data_limite = 2026-08-01", "ordem": 1, "resultado_esperado": "Recusado — o prazo não pode anteceder a referência"}]', 'Datas incoerentes não entram.', 'Provável ACHADO — mesma família de ENQ-013 (mandato CIPA) e TAC-003. Correção: CHECK (data_limite >= data_referencia).', 'api', NULL, 'em_triagem', NULL),
    ('PROC-011', 'Processo não pode apontar contabilidade de outro cliente', 'negativo', 'alta', 'aprovado', 'A FK de contabilidade_id não olha tenant: um processo do cliente A pode ser vinculado à contabilidade parceira do cliente B — e o fluxo de envio passaria a conversar com a contabilidade errada, de outro cliente.', 'Cercados 1 e 2; contabilidade cadastrada no cercado 2.', '[{"acao": "Criar processo no cercado 1 apontando contabilidade do cercado 2", "ordem": 1, "resultado_esperado": "Recusado — processo e contabilidade do mesmo tenant"}]', 'Vínculo cruzando tenants não entra.', 'Mesma família de FER-004 e MCHK-011; mesmo remédio — gatilho de coerência de tenant.', 'api', NULL, 'em_triagem', NULL),
    ('PROC-012', 'Apagar o processo leva checklist, documentos e assinaturas', 'excecao', 'media', 'aprovado', 'As filhas do processo (checklist, documentos, assinaturas) têm FK ON DELETE CASCADE. Excluir o processo não pode deixar item órfão em nenhuma delas.', 'Processo com item de checklist, documento e assinatura.', '[{"acao": "Excluir o processo", "ordem": 1, "resultado_esperado": "As três tabelas filhas zeram para esse processo"}]', 'Cascade limpo nas três filhas.', NULL, 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'documentos-governanca/hub-contabil'
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

-- Identidade Estratégica (7 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('IDE-001', 'Definir a identidade (missao e visao)', 'feliz', 'alta', 'aprovado', 'Verificar que o cliente pode definir a identidade estrategica (missao e visao) da empresa. Regra: a identidade guarda missao, visao e valores. Importa porque a identidade e a base do planejamento — orienta metas, cultura e decisoes; e o "porque a empresa existe".', 'Precisa existir uma empresa cadastrada (a identidade e por empresa).', '[{"acao": "Abrir a identidade estrategica", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Planejamento e Gestao > Identidade Estrategica", "resultado_esperado": "Tela de identidade aberta"}, {"acao": "Preencher missao e visao", "dados": "Missao: Proteger vidas no trabalho | Visao: Ser referencia em SST no Brasil", "ordem": 2, "onde_na_tela": "Campos Missao e Visao", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Identidade gravada com missao e visao"}]', 'A empresa passa a ter uma identidade com a missao e a visao definidas.', 'IMPACTO SE FALHAR: sem identidade, o planejamento estrategico perde a ancora — metas e cultura ficam sem direcao definida.', 'api', NULL, 'em_triagem', NULL),
    ('IDE-002', 'Registrar valores como lista', 'feliz', 'media', 'aprovado', 'Verificar que os valores da empresa sao guardados como uma lista. Regra: valores sao multiplos (ex.: Seguranca, Etica, Cuidado) e ficam numa lista (JSONB). Importa porque os valores orientam a cultura e o comportamento esperado — precisam ser varios, nao um so.', 'Tela de identidade disponivel.', '[{"acao": "Abrir a identidade e ir aos valores", "dados": "-", "ordem": 1, "onde_na_tela": "Identidade Estrategica > secao Valores", "resultado_esperado": "Campo de valores disponivel"}, {"acao": "Adicionar tres valores", "dados": "Valores: Seguranca, Etica, Cuidado", "ordem": 2, "onde_na_tela": "Lista de Valores > adicionar item", "resultado_esperado": "Os tres valores aparecem na lista"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "Os tres valores foram guardados"}]', 'A identidade guarda os tres valores como uma lista. Ao reabrir, os tres estao la.', 'IMPACTO SE FALHAR: se os valores nao forem guardados como lista, a empresa nao consegue registrar seus multiplos valores culturais corretamente.', 'api', NULL, 'em_triagem', NULL),
    ('IDE-003', 'Atualizar a missao existente', 'feliz', 'media', 'aprovado', 'Verificar que a missao da identidade pode ser editada. Regra: a identidade e editavel. Importa porque missao e visao sao revisadas ao longo do tempo (mudancas de estrategia) e precisam poder ser atualizadas.', 'Precisa existir uma identidade ja definida.', '[{"acao": "Abrir a identidade existente", "dados": "-", "ordem": 1, "onde_na_tela": "Identidade Estrategica", "resultado_esperado": "Missao atual exibida"}, {"acao": "Alterar a missao", "dados": "Nova missao: Proteger vidas e promover saude no trabalho", "ordem": 2, "onde_na_tela": "Campo Missao", "resultado_esperado": "Campo aceita o novo texto"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "A missao nova esta gravada"}]', 'A missao e atualizada para o novo texto e persiste.', 'IMPACTO SE FALHAR: se a edicao nao persistir, a empresa fica presa a uma missao antiga apos uma revisao estrategica.', 'api', NULL, 'em_triagem', NULL),
    ('IDE-010', 'Identidade so com missao (visao vazia) e aceita', 'alternativo', 'media', 'aprovado', 'Verificar que a identidade pode ser salva so com a missao, deixando a visao para depois. Regra: os campos sao opcionais — da para preencher aos poucos. Importa porque o cliente muitas vezes define a missao primeiro e a visao numa etapa seguinte do planejamento.', 'Precisa existir uma empresa.', '[{"acao": "Abrir a identidade", "dados": "-", "ordem": 1, "onde_na_tela": "Identidade Estrategica", "resultado_esperado": "Tela aberta"}, {"acao": "Preencher SO a missao, deixar a visao vazia", "dados": "Missao: Cuidar de quem trabalha | Visao: (vazia)", "ordem": 2, "onde_na_tela": "Campo Missao (Visao vazia)", "resultado_esperado": "Aceito sem exigir a visao"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Identidade salva so com missao"}]', 'A identidade e salva apenas com a missao. A visao pode ser preenchida depois, sem erro.', 'IMPACTO SE FALHAR: se a visao fosse obrigatoria, o cliente nao poderia salvar o progresso parcial do planejamento — teria que ter tudo pronto de uma vez.', 'api', NULL, 'em_triagem', NULL),
    ('IDE-011', 'Valores como lista vazia e aceito', 'alternativo', 'baixa', 'aprovado', 'Verificar que a identidade aceita comecar com a lista de valores vazia. Regra: a lista de valores pode iniciar vazia. Importa porque os valores podem ser definidos numa etapa posterior, sem impedir de salvar a identidade antes.', 'Precisa existir uma empresa.', '[{"acao": "Abrir a identidade", "dados": "-", "ordem": 1, "onde_na_tela": "Identidade Estrategica", "resultado_esperado": "Tela aberta"}, {"acao": "Preencher missao mas nao adicionar nenhum valor", "dados": "Missao: Missao teste | Valores: (nenhum)", "ordem": 2, "onde_na_tela": "Missao preenchida, lista de Valores vazia", "resultado_esperado": "Aceito com valores vazios"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Identidade salva com lista de valores vazia"}]', 'A identidade e salva com a lista de valores vazia, sem erro. Os valores podem ser adicionados depois.', 'IMPACTO SE FALHAR: se a lista de valores nao pudesse ser vazia, travaria salvar a identidade antes de os valores serem definidos.', 'api', NULL, 'em_triagem', NULL),
    ('IDE-020', 'Duas identidades para a MESMA empresa e proibido', 'negativo', 'alta', 'aprovado', 'Verificar que NAO da para criar duas identidades para a MESMA empresa. Regra: UNIQUE(tenant_id, empresa_id) — cada empresa tem UMA identidade. Um cliente com varias empresas tem uma identidade por empresa. Importa porque duas missoes/visoes para a mesma empresa seriam contraditorias — qual vale?', 'Precisa existir uma empresa que ja tenha uma identidade definida.', '[{"acao": "Definir a identidade de uma empresa", "dados": "Empresa: Alfa | Missao: Primeira missao", "ordem": 1, "onde_na_tela": "Empresa X > Identidade Estrategica", "resultado_esperado": "Identidade da Alfa criada"}, {"acao": "Tentar criar uma SEGUNDA identidade para a MESMA empresa Alfa", "dados": "Empresa: Alfa (a mesma) | Missao: Segunda missao", "ordem": 2, "onde_na_tela": "Alfa > tentar nova Identidade", "resultado_esperado": "O sistema DEVE recusar — a Alfa ja tem identidade"}]', 'A segunda identidade para a mesma empresa e recusada. Cada empresa tem exatamente uma identidade.', 'IMPACTO SE FALHAR: duas identidades para a mesma empresa gerariam missoes/visoes conflitantes, sem saber qual e a oficial. NOTA: esta regra mudou em mai/2026 — antes era uma identidade por CLIENTE, agora e uma por EMPRESA (cliente com varias empresas tem uma para cada). O indice unico (tenant_id, empresa_id) garante.', 'api', NULL, 'em_triagem', NULL),
    ('IDE-022', 'Identidade de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que a identidade de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque a missao, visao e valores de um cliente sao informacao estrategica que nao pode vazar para outro.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, definir uma identidade", "dados": "Missao: Missao secreta do cliente A", "ordem": 1, "onde_na_tela": "Cliente A > Identidade Estrategica", "resultado_esperado": "Identidade criada no cliente A"}, {"acao": "Entrar como cliente B e consultar a identidade", "dados": "-", "ordem": 2, "onde_na_tela": "Cliente B > Identidade Estrategica", "resultado_esperado": "A identidade do cliente A NAO aparece para o cliente B"}]', 'A identidade do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia a estrategia (missao, visao, valores) de um cliente a outro. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'planejamento-gestao/identidade-estrategica'
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

-- Incidentes & Acidentes (9 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('TELA-INC-001', 'carrega o módulo e todas as abas principais', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-002', 'aplica filtros da aba ocorrências', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-003', 'cadastra um incidente com colaborador manual', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-004', 'cadastra um acidente com CAT emitida', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-005', 'cadastra um acidente sem CAT emitida', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-006', 'abre detalhes por linha, volta e usa ações do detalhe', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-007', 'abre edição pela tabela', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-008', 'acessa a aba pirâmide, muda filtros e abre camadas', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-INC-009', 'abre o guia rápido', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/incidentes-acidentes.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'saude-seguranca/incidentes-acidentes'
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

-- Metas (39 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('MCFG-001', 'Cada cliente tem uma configuracao de metas', 'feliz', 'alta', 'aprovado', 'Verificar que a configuracao de metas e criada por cliente, com os padroes corretos. Regra: metas_configuracao tem UNIQUE(tenant_id) — uma configuracao por cliente. Ela parametriza os niveis habilitados, o que e obrigatorio e como funciona a aprovacao. Importa porque as regras do modulo Metas VARIAM entre clientes; e esta tabela que decide.', 'Nenhuma alem de ter o cliente cadastrado.', '[{"acao": "Abrir as configuracoes do modulo Metas", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Planejamento e Gestao > Metas > Configuracoes", "resultado_esperado": "Tela de parametrizacao aberta"}, {"acao": "Conferir os valores padrao", "dados": "-", "ordem": 2, "onde_na_tela": "Secoes de niveis e obrigatoriedades", "resultado_esperado": "Niveis habilitados: estrategica, unidade, setor, individual. Exigir indicador: sim. Exigir objetivo estrategico: nao. Escala de 0 a 100."}]', 'A configuracao existe com os quatro niveis habilitados, indicador obrigatorio, objetivo estrategico opcional e escala de 0 a 100.', 'IMPACTO SE FALHAR: sem configuracao, o modulo nao sabe quais niveis oferecer nem o que exigir — o cadastro de metas fica sem regra definida.', 'api', NULL, 'em_triagem', NULL),
    ('MCFG-002', 'Alterar os niveis habilitados', 'feliz', 'media', 'aprovado', 'Verificar que o cliente pode restringir quais niveis de meta sao usados. Regra: niveis_habilitados e um array; o cliente pode deixar so os que usa. Importa porque nem toda empresa trabalha com os quatro niveis — uma menor pode usar so metas individuais.', 'Precisa existir a configuracao do cliente.', '[{"acao": "Abrir as configuracoes de Metas", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Configuracoes > Niveis", "resultado_esperado": "Lista de niveis com os habilitados marcados"}, {"acao": "Desmarcar niveis que a empresa nao usa", "dados": "Deixar habilitados apenas: estrategica e individual", "ordem": 2, "onde_na_tela": "Selecao de niveis", "resultado_esperado": "Somente os dois ficam marcados"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "A restricao persistiu; ao criar uma meta, so esses dois niveis sao oferecidos"}]', 'A configuracao passa a ter apenas dois niveis habilitados, e a alteracao persiste.', 'IMPACTO SE FALHAR: o cliente seria obrigado a conviver com niveis que nao usa, poluindo o cadastro. ORIGEM: caso CT06 da especificacao (nao exibir niveis nao habilitados). NOTA: este caso verifica que a configuracao GRAVA a restricao. Se a tela realmente esconde os niveis desabilitados e teste de interface (Cypress).', 'api', NULL, 'em_triagem', NULL),
    ('MCFG-003', 'Ligar a obrigatoriedade de objetivo estrategico', 'feliz', 'alta', 'aprovado', 'Verificar que o cliente pode tornar obrigatorio o vinculo da meta com um objetivo estrategico. Regra: exigir_objetivo_estrategico vem desligado por padrao e pode ser ligado. Importa porque empresas com planejamento estrategico maduro querem que toda meta se conecte a ele; outras nao.', 'Precisa existir a configuracao do cliente.', '[{"acao": "Abrir as configuracoes de Metas", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Configuracoes > Obrigatoriedades", "resultado_esperado": "Opcao Exigir objetivo estrategico visivel, desligada"}, {"acao": "Ligar a obrigatoriedade", "dados": "Ligar", "ordem": 2, "onde_na_tela": "Toggle Exigir objetivo estrategico", "resultado_esperado": "Opcao ligada"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "A obrigatoriedade persistiu"}]', 'A configuracao passa a exigir objetivo estrategico, e a alteracao persiste.', 'IMPACTO SE FALHAR: a parametrizacao nao seria respeitada e o comportamento do cadastro ficaria fixo para todos os clientes. ORIGEM: casos CT14 e CT49 da especificacao. NOTA: este caso verifica que a configuracao GRAVA. Se o cadastro de meta realmente BLOQUEIA quando falta o vinculo e regra de aplicacao — hoje nao ha nada no banco que force isso (ver MCFG-030).', 'api', NULL, 'em_triagem', NULL),
    ('MCFG-020', 'Duas configuracoes para o mesmo cliente e proibido', 'negativo', 'alta', 'aprovado', 'Verificar que nao da para criar duas configuracoes para o mesmo cliente. Regra: UNIQUE(tenant_id). Importa porque duas configuracoes gerariam regras conflitantes — qual vale?', 'Precisa existir uma configuracao para o cliente.', '[{"acao": "Ter a configuracao do cliente criada", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Configuracoes", "resultado_esperado": "Configuracao existe"}, {"acao": "Tentar criar uma SEGUNDA configuracao para o mesmo cliente", "dados": "Nova configuracao, mesmo cliente", "ordem": 2, "onde_na_tela": "Via importacao ou API", "resultado_esperado": "O sistema DEVE recusar"}]', 'A segunda configuracao e recusada. Cada cliente tem exatamente uma.', 'IMPACTO SE FALHAR: duas configuracoes com regras diferentes para o mesmo cliente — o modulo nao saberia qual seguir, e o comportamento ficaria imprevisivel.', 'api', NULL, 'em_triagem', NULL),
    ('MCFG-021', 'Escala de avaliacao invertida', 'excecao', 'media', 'aprovado', 'Verificar se o banco aceita uma escala com minimo maior que o maximo. Regra: escala_min deve ser menor que escala_max (padrao 0 a 100). Importa porque uma escala invertida torna impossivel avaliar o atingimento — nenhum valor cabe nela.', 'Precisa existir a configuracao do cliente.', '[{"acao": "Alterar a escala de avaliacao para valores invertidos", "dados": "Escala minima: 100 | Escala maxima: 0", "ordem": 1, "onde_na_tela": "Metas > Configuracoes > Escala de avaliacao", "resultado_esperado": "Idealmente recusado — o minimo nao pode exceder o maximo"}]', 'A escala invertida deveria ser recusada. RESULTADO REAL: o banco aceita — nao ha CHECK de coerencia entre escala_min e escala_max.', 'IMPACTO: escala invertida quebra o calculo de atingimento das metas. CORRECAO SUGERIDA: ALTER TABLE metas_configuracao ADD CONSTRAINT escala_coerente CHECK (escala_min < escala_max). MESMO PADRAO dos achados CARGO-012 (faixa salarial) e EMP-041 (faixa de aprendiz) — vale corrigir os tres juntos.', 'api', NULL, 'em_triagem', NULL),
    ('MCFG-030', 'A configuracao e apenas informativa para o banco', 'excecao', 'alta', 'rascunho', 'Verificar se as obrigatoriedades definidas na configuracao sao aplicadas pelo banco. Regra esperada: com exigir_objetivo_estrategico ligado, uma meta sem objetivo deveria ser recusada. Este caso revela onde a parametrizacao e efetivamente aplicada. Importa porque uma configuracao que ninguem aplica e apenas decoracao.', 'Precisa existir a configuracao do cliente com exigir_objetivo_estrategico ligado.', '[{"acao": "Ligar a obrigatoriedade de objetivo estrategico na configuracao", "dados": "Exigir objetivo estrategico: sim", "ordem": 1, "onde_na_tela": "Metas > Configuracoes", "resultado_esperado": "Configuracao gravada"}, {"acao": "Criar uma meta SEM informar o objetivo estrategico", "dados": "Titulo: Meta sem objetivo | Ano: 2026 | Objetivo estrategico: (vazio)", "ordem": 2, "onde_na_tela": "Via importacao ou API (fora da tela, que validaria)", "resultado_esperado": "Idealmente recusado, ja que a configuracao exige"}]', 'A meta sem objetivo deveria ser recusada quando a configuracao exige. RESULTADO REAL: o banco aceita — a parametrizacao e lida e aplicada pelo front, sem nada que a garanta no banco.', 'IMPACTO: dados que entrem por importacao ou API ignoram completamente a parametrizacao do cliente. Uma empresa que exige vinculo estrategico em toda meta pode receber metas sem vinculo por esses caminhos. MESMO PADRAO dos demais achados (regra no front, ausente no banco). CORRECAO SUGERIDA: uma trigger que leia metas_configuracao e valide na gravacao. NOTA: e uma decisao de produto — validar parametrizacao no banco adiciona acoplamento; a alternativa e garantir que todo caminho de entrada passe pela mesma validacao da aplicacao.', 'api', NULL, 'decisao_de_produto', 'Analisado pelo desenvolvimento em 31/07/2026 e descartado por decisão. A regra é de organização interna, sem base legal, e o produto optou por não restringir no banco. Reabrir apenas se a decisão mudar.'),
    ('MCHK-001', 'Check-in grava o antes e o depois do progresso', 'feliz', 'alta', 'aprovado', 'O check-in é o coração do acompanhamento: registra valor_anterior/valor_novo e progresso_anterior/progresso_novo, com observação e bloqueios. É o que permite reconstruir a evolução da meta no tempo.', 'Meta com valor_atual e progresso conhecidos.', '[{"acao": "Registrar check-in com novo valor e novo progresso", "ordem": 1, "resultado_esperado": "Linha em metas_checkins com o par anterior/novo dos dois campos"}, {"acao": "Reler o histórico da meta", "ordem": 2, "resultado_esperado": "O check-in aparece com observação e autor"}]', 'O histórico preserva o antes e o depois de cada atualização.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MCHK-002', 'Check-in atualiza a meta e deriva o status do progresso', 'alternativo', 'critica', 'aprovado', 'Na tela, o check-in também atualiza a meta: valor_atual, progresso e o status derivado (100 = concluída, >0 = em andamento, 0 = não iniciada). Essa derivação vive em DOIS comandos separados do front — check-in por API atualiza o histórico mas deixa a meta para trás, e a lista mostra progresso velho com check-in novo.', 'Meta em andamento com progresso 40.', '[{"acao": "Registrar check-in com progresso_novo = 100 por fora da tela", "ordem": 1, "resultado_esperado": "Idealmente a meta acompanha: progresso 100, status concluída"}, {"acao": "Conferir a meta", "ordem": 2, "resultado_esperado": "Meta e último check-in contam a mesma história"}]', 'Meta e histórico nunca divergem, seja qual for a rota de entrada.', 'Provável ACHADO: hoje a meta fica intacta e o check-in órfão de efeito. Correção sugerida: trigger em metas_checkins aplicando valor/progresso/status na meta — a mesma regra que o front já executa, só que garantida.', 'api', NULL, 'em_triagem', NULL),
    ('MCHK-010', 'Progresso do check-in fora de 0-100', 'negativo', 'media', 'aprovado', 'progresso_novo é INTEGER sem CHECK — espelho exato do que META-012 encontrou na própria meta. Um check-in de 250% ou -30% entra e contamina o histórico e qualquer média.', 'Meta no cercado.', '[{"acao": "Registrar check-in com progresso_novo = 250", "ordem": 1, "resultado_esperado": "Recusado — progresso é percentual de 0 a 100"}, {"acao": "Registrar check-in com progresso_novo = -30", "ordem": 2, "resultado_esperado": "Recusado"}]', 'Só entra progresso entre 0 e 100.', 'Mesma correção sugerida em META-012: CHECK BETWEEN 0 AND 100, aqui e na meta.', 'api', NULL, 'em_triagem', NULL),
    ('MCHK-011', 'Check-in não pode cruzar clientes', 'negativo', 'alta', 'aprovado', 'A FK de meta_id não olha tenant: uma linha de check-in com tenant_id do cliente B apontando meta do cliente A é estruturalmente possível. A RLS esconde a linha de quem não deve ver, mas o histórico da meta fica com um registro fantasma de outro cliente.', 'Cercados 1 e 2 disponíveis; meta no cercado 1.', '[{"acao": "Inserir check-in com tenant do cercado 2 apontando a meta do cercado 1", "ordem": 1, "resultado_esperado": "Recusado — check-in e meta precisam ser do mesmo tenant"}]', 'Check-in cruzando tenants não entra.', 'Mesma família de FER-004 (feriados) e dos casos de coerência de tenant de outros módulos; mesmo remédio — trigger de coerência.', 'api', NULL, 'em_triagem', NULL),
    ('META-001', 'Criar uma meta', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de uma meta com titulo, periodo e ano. Regra: toda meta precisa de titulo e ano; o periodo define o ciclo (mensal, trimestral, semestral ou anual). Importa porque metas sao o instrumento de gestao de desempenho — sem cadastra-las, nao ha o que acompanhar nem cobrar.', 'Usuario com permissao de gestao de metas.', '[{"acao": "Abrir o cadastro de metas", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Planejamento e Gestao > Metas > Nova Meta", "resultado_esperado": "Formulario de meta aberto"}, {"acao": "Preencher titulo, periodo e ano", "dados": "Titulo: Reduzir acidentes em 20% | Periodo: trimestral | Ano: 2026", "ordem": 2, "onde_na_tela": "Campos Titulo, Periodo e Ano", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Meta criada, com status inicial nao_iniciada e progresso 0"}]', 'A meta Reduzir acidentes em 20% existe, no periodo trimestral de 2026, pronta para receber key results e acompanhamento.', 'IMPACTO SE FALHAR: sem cadastrar metas, a gestao de desempenho fica sem instrumento — nao ha o que acompanhar, medir nem cobrar ao longo do ciclo.', 'api', NULL, 'em_triagem', NULL),
    ('META-002', 'Adicionar key results (OKR) a uma meta', 'feliz', 'alta', 'aprovado', 'Verificar que key results (OKRs) podem ser vinculados a uma meta. Regra: uma meta se desdobra em resultados-chave mensuraveis, cada um com um valor-alvo. Importa porque a meta sozinha e uma intencao; sao os key results que a tornam mensuravel e acompanhavel.', 'Precisa existir uma meta cadastrada.', '[{"acao": "Abrir uma meta e ir aos key results", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > abrir a meta > aba Key Results (OKRs) > Adicionar", "resultado_esperado": "Formulario de key result aberto"}, {"acao": "Adicionar dois key results com valores-alvo", "dados": "KR1: Treinar 100% da equipe (alvo 100) | KR2: Zerar reincidencias (alvo 0)", "ordem": 2, "onde_na_tela": "Campos Key Result e Valor Alvo", "resultado_esperado": "Os dois key results sao aceitos"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > aba Key Results", "resultado_esperado": "Os 2 key results aparecem vinculados a meta"}]', 'A meta tem 2 key results vinculados, cada um com seu valor-alvo. O progresso da meta pode ser acompanhado por eles.', 'IMPACTO SE FALHAR: sem key results, a meta fica sem criterio objetivo de sucesso — vira uma intencao sem medicao, impossivel de avaliar ao fim do ciclo.', 'api', NULL, 'em_triagem', NULL),
    ('META-003', 'Avancar o progresso e mudar status', 'feliz', 'media', 'aprovado', 'Verificar que o progresso e o status de uma meta podem ser atualizados ao longo do ciclo. Regra: progresso (0 a 100) e status (nao_iniciada, em_andamento, concluida, cancelada, atrasada) evoluem conforme a meta avanca. Importa porque acompanhar o andamento e o proprio proposito da gestao de metas.', 'Precisa existir uma meta cadastrada.', '[{"acao": "Abrir uma meta", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > abrir a meta", "resultado_esperado": "Meta aberta, com progresso e status atuais"}, {"acao": "Atualizar o progresso e o status", "dados": "Progresso: 50 | Status: em_andamento", "ordem": 2, "onde_na_tela": "Campos Progresso e Status", "resultado_esperado": "Os valores sao aceitos"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "A meta mostra 50% de progresso e status em_andamento"}]', 'A meta fica com progresso 50 e status em_andamento, e os valores persistem.', 'IMPACTO SE FALHAR: sem atualizar progresso e status, o painel de metas congela — a gestao perde a visibilidade de como o ciclo esta andando.', 'api', NULL, 'em_triagem', NULL),
    ('META-010', 'Titulo vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que uma meta sem titulo e recusada. Regra: titulo e NOT NULL. Importa porque uma meta sem titulo nao comunica o que se quer atingir — aparece em branco nos paineis e nao serve para nada.', 'Nenhuma.', '[{"acao": "Abrir nova meta", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Nova Meta", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o titulo vazio e tentar salvar", "dados": "Titulo: (vazio) | Ano: 2026", "ordem": 2, "onde_na_tela": "Campo Titulo (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar — titulo e obrigatorio"}]', 'A meta sem titulo e recusada. Nenhuma meta em branco entra no sistema.', 'IMPACTO SE FALHAR: metas sem titulo poluem os paineis de acompanhamento e nao comunicam nada a quem precisa executa-las.', 'api', NULL, 'em_triagem', NULL),
    ('META-011', 'Periodo invalido e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um periodo invalido e recusado. Regra: periodo so aceita mensal, trimestral, semestral ou anual (enum). Importa porque o periodo define o ciclo de apuracao — um valor fora da lista quebraria os calculos e agrupamentos por ciclo.', 'Formulario de meta com o campo periodo.', '[{"acao": "Abrir nova meta", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Nova Meta", "resultado_esperado": "Formulario aberto"}, {"acao": "Tentar um periodo fora da lista", "dados": "Periodo: quinzenal (invalido — nao esta entre mensal/trimestral/semestral/anual)", "ordem": 2, "onde_na_tela": "Campo Periodo", "resultado_esperado": "O sistema DEVE recusar"}]', 'O periodo quinzenal e recusado. So os quatro periodos validos sao aceitos.', 'IMPACTO SE FALHAR: periodo invalido quebraria os agrupamentos e calculos por ciclo de apuracao (relatorios trimestrais, anuais).', 'api', NULL, 'em_triagem', NULL),
    ('META-012', 'Progresso fora de 0-100 (revela ausencia de CHECK)', 'excecao', 'media', 'aprovado', 'Verificar o que acontece ao informar um progresso fora da faixa 0-100 numa meta. Regra esperada: progresso e uma porcentagem, entao deveria aceitar apenas 0 a 100. Este caso revela se existe essa trava no banco. Importa porque progresso de 150% ou negativo e matematicamente sem sentido e quebra barras de progresso e medias.', 'Formulario de meta com o campo progresso.', '[{"acao": "Abrir uma meta (nova ou existente)", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Nova Meta ou abrir uma existente", "resultado_esperado": "Campo progresso disponivel"}, {"acao": "Informar um progresso absurdo", "dados": "Progresso: 150 (fora da faixa 0-100)", "ordem": 2, "onde_na_tela": "Campo Progresso", "resultado_esperado": "Idealmente o sistema DEVERIA recusar — progresso e porcentagem"}]', 'O progresso 150 deveria ser RECUSADO. ACHADO ATUAL: o banco ACEITA — nao ha CHECK de faixa nas tabelas metas e meta_okrs. Um progresso impossivel entra.', 'IMPACTO SE FALHAR (e falha hoje): progresso fora de 0-100 quebra barras de progresso na tela (barra passando de 100%), distorce medias de atingimento e relatorios de desempenho. CORRECAO SUGERIDA: adicionar CHECK (progresso BETWEEN 0 AND 100) em metas e meta_okrs. NOTA IMPORTANTE: esse CHECK JA EXISTE no modulo Plano de Acao (veja o caso ACAO-013, que passa) — a boa pratica e conhecida pela equipe, so nao foi replicada aqui. E o exemplo mais claro de inconsistencia entre modulos do sistema.', 'api', NULL, 'em_triagem', NULL),
    ('META-013', 'Apagar a meta apaga seus OKRs (CASCADE)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar uma meta apaga seus key results junto (CASCADE). Regra: meta_id ON DELETE CASCADE — um key result nao existe sem a meta a que pertence. Importa porque key results orfaos seriam metricas sem objetivo, lixo sem contexto.', 'Precisa existir uma meta com pelo menos um key result.', '[{"acao": "Criar uma meta com um key result", "dados": "Meta: Meta Teste | KR: um key result qualquer (alvo 100)", "ordem": 1, "onde_na_tela": "Metas", "resultado_esperado": "Key result pertence a meta"}, {"acao": "Apagar a meta", "dados": "-", "ordem": 2, "onde_na_tela": "Metas > abrir a meta > Excluir", "resultado_esperado": "Meta apagada"}, {"acao": "Conferir o key result", "dados": "-", "ordem": 3, "onde_na_tela": "-", "resultado_esperado": "O key result foi apagado JUNTO com a meta (nao sobra orfao)"}]', 'A meta e apagada e seus key results somem junto (CASCADE). Nenhum key result orfao sobra na base.', 'IMPACTO SE FALHAR: key results orfaos (sem meta) seriam metricas sem objetivo — lixo que aparece em consultas sem fazer sentido. O CASCADE mantem a base limpa.', 'api', NULL, 'em_triagem', NULL),
    ('META-022', 'Meta de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que uma meta de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque metas revelam prioridades estrategicas e desempenho interno — informacao sensivel que nao pode vazar entre clientes.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar uma meta", "dados": "Titulo: Meta secreta do cliente A | Ano: 2026", "ordem": 1, "onde_na_tela": "Cliente A > Metas > Nova Meta", "resultado_esperado": "Criada no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Procurar pela meta do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Metas", "resultado_esperado": "NAO aparece para o cliente B"}]', 'A meta do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia prioridades estrategicas e indicadores de desempenho de um cliente a outro. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL),
    ('META-030', 'Nivel da meta respeita a lista fechada', 'excecao', 'alta', 'aprovado', 'Verificar que o nivel da meta so aceita os valores previstos. Regra: meta_nivel aceita estrategica, unidade, setor ou individual. Importa porque o nivel define a que camada da organizacao a meta pertence e como ela e desdobrada e aprovada.', 'Nenhuma.', '[{"acao": "Tentar criar uma meta com nivel fora da lista", "dados": "Nivel: departamental (o correto seria setor)", "ordem": 1, "onde_na_tela": "Nova Meta > campo Nivel", "resultado_esperado": "O sistema DEVE recusar"}]', 'O nivel invalido e recusado. Somente os quatro niveis previstos sao aceitos.', 'IMPACTO SE FALHAR: um nivel desconhecido quebraria o desdobramento e a logica de aprovacao, que dependem de saber a que camada a meta pertence. ORIGEM: casos CT04 a CT06.', 'api', NULL, 'em_triagem', NULL),
    ('META-031', 'Desdobramento: meta filha aponta para a meta pai', 'feliz', 'alta', 'aprovado', 'Verificar que uma meta pode se desdobrar em outra, formando hierarquia. Regra: meta_pai_id referencia outra meta. Importa porque o desdobramento e o que liga a estrategia a execucao — uma meta estrategica se desdobra em metas de unidade, setor e individuais.', 'Precisa existir uma meta para servir de pai.', '[{"acao": "Criar a meta estrategica (a pai)", "dados": "Titulo: Reduzir acidentes em 30% | Nivel: estrategica", "ordem": 1, "onde_na_tela": "Nova Meta", "resultado_esperado": "Meta criada"}, {"acao": "Criar uma meta de setor desdobrada dela", "dados": "Titulo: Reduzir acidentes na producao | Nivel: setor | Meta pai: a estrategica", "ordem": 2, "onde_na_tela": "Meta estrategica > Desdobrar (ou Nova Meta > Meta pai)", "resultado_esperado": "Meta filha criada, ligada a pai"}, {"acao": "Conferir a hierarquia", "dados": "-", "ordem": 3, "onde_na_tela": "Visualizacao de desdobramento", "resultado_esperado": "A meta de setor aparece abaixo da estrategica"}]', 'A meta filha referencia a meta pai. A hierarquia de desdobramento se forma.', 'IMPACTO SE FALHAR: sem desdobramento, as metas ficam soltas e a estrategia nao se conecta a execucao. ORIGEM: caso CT44 da especificacao (meta estrategica apta a desdobramento).', 'api', NULL, 'em_triagem', NULL),
    ('META-032', 'Apagar a meta pai preserva as filhas', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar uma meta pai nao destroi as metas desdobradas dela. Regra: meta_pai_id ON DELETE SET NULL — as filhas perdem o vinculo mas sobrevivem. Importa porque cancelar uma meta estrategica nao deveria apagar todo o trabalho desdobrado nos setores.', 'Precisa existir uma meta pai com pelo menos uma filha.', '[{"acao": "Montar o desdobramento", "dados": "Meta estrategica com uma meta de setor desdobrada", "ordem": 1, "onde_na_tela": "Metas", "resultado_esperado": "Hierarquia montada"}, {"acao": "Apagar a meta estrategica (a pai)", "dados": "-", "ordem": 2, "onde_na_tela": "Meta > Excluir", "resultado_esperado": "Meta pai apagada"}, {"acao": "Conferir a meta de setor", "dados": "-", "ordem": 3, "onde_na_tela": "Metas", "resultado_esperado": "A meta de setor AINDA EXISTE, agora sem meta pai"}]', 'A meta pai e apagada e as filhas sobrevivem, sem o vinculo. O trabalho desdobrado nao se perde.', 'IMPACTO SE FALHAR: cancelar uma meta estrategica destruiria todas as metas de unidade, setor e individuais derivadas dela — perda de trabalho e de historico de desempenho.', 'api', NULL, 'em_triagem', NULL),
    ('META-033', 'Baseline maior que o valor alvo', 'excecao', 'media', 'rascunho', 'Verificar se o banco aceita um baseline incoerente com o alvo. Contexto: com direcao "maior_melhor", o alvo deveria ser MAIOR que o ponto de partida (baseline); o contrario sugere erro de digitacao. Importa porque a incoerencia distorce o calculo de atingimento.', 'Nenhuma.', '[{"acao": "Criar meta com direcao maior_melhor e valores invertidos", "dados": "Direcao: maior_melhor | Baseline: 100 | Valor alvo: 50 (menor que o baseline)", "ordem": 1, "onde_na_tela": "Nova Meta > secao Indicador", "resultado_esperado": "Idealmente alertado ou recusado"}]', 'A incoerencia deveria ser ao menos sinalizada. RESULTADO REAL: o banco aceita qualquer combinacao — nao ha validacao entre baseline, alvo e direcao.', 'IMPACTO: com baseline 100, alvo 50 e direcao "maior e melhor", a meta ja nasce atingida ou o calculo de progresso sai negativo. ORIGEM: caso EC05 da especificacao. NOTA: esta e uma regra que depende da direcao — com "menor_melhor", baseline maior que o alvo e o esperado. Por isso a validacao adequada e no front ou por trigger que considere a direcao, nao um CHECK simples.', 'api', NULL, 'decisao_de_produto', 'Analisado pelo desenvolvimento em 31/07/2026 e descartado por decisão. A regra é de organização interna, sem base legal, e o produto optou por não restringir no banco. Reabrir apenas se a decisão mudar.'),
    ('META-034', 'Data fim anterior a data inicio', 'excecao', 'alta', 'aprovado', 'Verificar se o banco aceita um periodo de vigencia invertido. Regra: data_fim deve ser igual ou posterior a data_inicio. Importa porque um periodo invertido gera meta com vigencia impossivel, quebrando calculos de prazo e alertas.', 'Nenhuma.', '[{"acao": "Criar uma meta com o periodo invertido", "dados": "Data inicio: 31/12/2026 | Data fim: 01/01/2026 (anterior ao inicio)", "ordem": 1, "onde_na_tela": "Nova Meta > campos Data Inicio e Data Fim", "resultado_esperado": "Idealmente recusado"}]', 'O periodo invertido deveria ser recusado. RESULTADO REAL: o banco aceita — nao ha CHECK entre data_inicio e data_fim.', 'IMPACTO: meta com vigencia impossivel quebra o calculo de prazo restante, os alertas de vencimento e os relatorios por periodo. ORIGEM: casos CT19 e CT20 da especificacao. CORRECAO SUGERIDA: ALTER TABLE metas ADD CONSTRAINT metas_periodo_coerente CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_inicio <= data_fim);', 'api', NULL, 'em_triagem', NULL),
    ('META-035', 'Titulo com apenas espacos em branco', 'excecao', 'media', 'aprovado', 'Verificar se o banco aceita um titulo composto so de espacos. Regra: NOT NULL impede o titulo nulo, mas nao impede a string "   ", que e vazia na pratica. Importa porque uma meta com titulo em branco aparece vazia nas listas, driblando a obrigatoriedade.', 'Nenhuma.', '[{"acao": "Criar uma meta com titulo formado so por espacos", "dados": "Titulo: (tres espacos em branco) | Ano: 2026", "ordem": 1, "onde_na_tela": "Nova Meta > campo Titulo", "resultado_esperado": "Idealmente recusado — conteudo vazio mascarado"}]', 'O titulo em branco deveria ser recusado. RESULTADO REAL: o banco aceita — NOT NULL nao alcanca strings compostas apenas de espacos.', 'IMPACTO: metas aparecem sem titulo nas listas e paineis, mesmo com a obrigatoriedade "cumprida". ORIGEM: caso EC01 da especificacao. CORRECAO SUGERIDA: CHECK (length(trim(titulo)) > 0) — vale avaliar o mesmo padrao nos demais campos de nome obrigatorios do sistema.', 'api', NULL, 'em_triagem', NULL),
    ('MEVD-001', 'Anexar evidência de atingimento à meta', 'feliz', 'media', 'aprovado', 'A evidência (arquivo ou link, com título e período de referência) é o que sustenta o número reportado no check-in. Precisa gravar vinculada à meta e reler por inteiro.', 'Meta no cercado.', '[{"acao": "Anexar evidência tipo link com título e período de referência", "ordem": 1, "resultado_esperado": "Linha em metas_evidencias vinculada à meta, com autor"}]', 'Evidência gravada e relida por inteiro.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MEVD-010', 'Evidência completamente vazia não deveria entrar', 'negativo', 'baixa', 'aprovado', 'Todos os campos de conteúdo (arquivo_url, link_externo, titulo, descricao) são anuláveis. Uma linha sem NENHUM deles é uma evidência que não evidencia nada — só infla a contagem de comprovação da meta.', 'Meta no cercado.', '[{"acao": "Inserir evidência sem arquivo, sem link, sem título e sem descrição", "ordem": 1, "resultado_esperado": "Recusado — evidência precisa ter ao menos um conteúdo"}]', 'Evidência vazia não entra.', 'Provável ACHADO: hoje entra. Correção: CHECK exigindo ao menos um campo de conteúdo preenchido.', 'api', NULL, 'em_triagem', NULL),
    ('MEVD-011', 'Apagar a meta leva as evidências junto', 'excecao', 'baixa', 'aprovado', 'FK ON DELETE CASCADE: excluir a meta remove as evidências, sem órfãos. Vale o mesmo lembrete de MWKF-012 — o material de comprovação some com a meta.', 'Meta com evidência anexada.', '[{"acao": "Excluir a meta", "ordem": 1, "resultado_esperado": "Meta e evidências somem juntas"}]', 'Cascade limpo, sem órfãos.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MIND-001', 'Cadastrar um indicador no catalogo', 'feliz', 'media', 'aprovado', 'Verificar o cadastro de um indicador reutilizavel. Regra: metas_indicadores e um catalogo de definicoes (nome, tipo, unidade, direcao, formula) que pode ser reaproveitado entre metas. Importa porque padronizar indicadores evita que cada meta invente sua propria forma de medir a mesma coisa.', 'Nenhuma alem do acesso ao modulo.', '[{"acao": "Abrir o catalogo de indicadores", "dados": "-", "ordem": 1, "onde_na_tela": "Metas > Indicadores > Novo", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher a definicao do indicador", "dados": "Nome: Taxa de acidentes | Tipo: quantitativo | Unidade: % | Direcao: menor_melhor | Formula: (acidentes no mes / total de colaboradores) * 100", "ordem": 2, "onde_na_tela": "Campos Nome, Tipo, Unidade, Direcao, Formula", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Indicador disponivel no catalogo"}]', 'O indicador Taxa de acidentes existe no catalogo, com tipo quantitativo, direcao menor_melhor e a formula preservada.', 'IMPACTO SE FALHAR: sem catalogo, cada meta define seu indicador do zero — a mesma metrica acaba medida de formas diferentes em metas diferentes, impedindo comparacao. ORIGEM: casos CT22 a CT31 e CT45 da especificacao.', 'api', NULL, 'em_triagem', NULL),
    ('MIND-010', 'Indicador com tipo invalido e recusado', 'excecao', 'media', 'aprovado', 'Verificar que o tipo do indicador respeita a lista fechada. Regra: indicador_tipo aceita quantitativo, qualitativo, percentual, financeiro, marco ou hibrido. Importa porque o tipo determina como o indicador e medido e apresentado.', 'Nenhuma.', '[{"acao": "Tentar cadastrar um indicador com tipo fora da lista", "dados": "Tipo: aproximado (nao existe na lista)", "ordem": 1, "onde_na_tela": "Metas > Indicadores > Novo > campo Tipo", "resultado_esperado": "O sistema DEVE recusar"}]', 'O tipo invalido e recusado. Somente os seis tipos previstos sao aceitos.', 'IMPACTO SE FALHAR: um tipo desconhecido quebraria a logica de medicao e apresentacao do indicador. ORIGEM: caso CT24 da especificacao.', 'api', NULL, 'em_triagem', NULL),
    ('MIND-011', 'Indicador com direcao invalida e recusado', 'excecao', 'media', 'aprovado', 'Verificar que a direcao do indicador respeita a lista fechada. Regra: indicador_direcao aceita maior_melhor, menor_melhor, igual_melhor ou faixa. Importa porque a direcao define se atingir a meta e subir ou descer o numero — errar isso inverte a avaliacao de desempenho.', 'Nenhuma.', '[{"acao": "Tentar cadastrar um indicador com direcao fora da lista", "dados": "Direcao: crescente (o correto seria maior_melhor)", "ordem": 1, "onde_na_tela": "Metas > Indicadores > Novo > campo Direcao", "resultado_esperado": "O sistema DEVE recusar"}]', 'A direcao invalida e recusada. Somente as quatro direcoes previstas sao aceitas.', 'IMPACTO SE FALHAR: uma direcao invalida deixaria o sistema sem saber se o indicador melhora subindo ou descendo — a avaliacao de atingimento sairia invertida. ORIGEM: caso CT29.', 'api', NULL, 'em_triagem', NULL),
    ('MIND-020', 'Indicadores com o mesmo nome sao aceitos', 'excecao', 'baixa', 'rascunho', 'Verificar se o catalogo permite dois indicadores com o mesmo nome no mesmo cliente. Regra esperada: o nome deveria identificar o indicador de forma unica dentro do catalogo. Importa porque dois indicadores "Taxa de acidentes" com formulas diferentes geram ambiguidade na hora de escolher qual usar.', 'Precisa existir um indicador cadastrado.', '[{"acao": "Cadastrar um indicador", "dados": "Nome: Taxa de acidentes", "ordem": 1, "onde_na_tela": "Metas > Indicadores > Novo", "resultado_esperado": "Cadastrado"}, {"acao": "Cadastrar outro com o MESMO nome", "dados": "Nome: Taxa de acidentes (repetido), formula diferente", "ordem": 2, "onde_na_tela": "Metas > Indicadores > Novo", "resultado_esperado": "Idealmente recusado ou sinalizado"}]', 'O nome duplicado deveria ser recusado ou ao menos sinalizado. RESULTADO REAL: o banco aceita — nao ha restricao de unicidade no nome do indicador.', 'IMPACTO: indicadores homonimos com definicoes diferentes causam confusao na escolha e impossibilitam comparar metas que usam "o mesmo" indicador. Prioridade baixa: o catalogo tende a ser pequeno e administrado por poucas pessoas. CORRECAO SUGERIDA (se for decisao do produto): indice unico em (tenant_id, lower(nome)) para indicadores ativos.', 'api', NULL, 'decisao_de_produto', 'Analisado pelo desenvolvimento em 31/07/2026 e descartado por decisão. A regra é de organização interna, sem base legal, e o produto optou por não restringir no banco. Reabrir apenas se a decisão mudar.'),
    ('MPAR-001', 'Compartilhar meta com participantes, papel e peso', 'feliz', 'media', 'aprovado', 'Meta compartilhada tem participantes com papel (co_responsavel, contribuidor...) e peso — que depois entra na avaliação de desempenho. O vínculo precisa gravar e reler por inteiro.', 'Meta no cercado.', '[{"acao": "Adicionar dois participantes com papéis e pesos distintos", "ordem": 1, "resultado_esperado": "Duas linhas em metas_participantes, com papel e peso de cada um"}]', 'Participantes gravados e relidos com papel e peso.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MPAR-010', 'Mesmo participante duas vezes na mesma meta é proibido', 'negativo', 'media', 'aprovado', 'UNIQUE (meta_id, participante_id) — a única proteção de negócio que a tabela tem. Duplicar participante duplicaria o peso dele na consolidação.', 'Meta com um participante.', '[{"acao": "Inserir o mesmo participante de novo na mesma meta", "ordem": 1, "resultado_esperado": "Recusado pelo UNIQUE"}]', 'A duplicata não entra.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MPAR-011', 'Peso de participante precisa ser positivo', 'negativo', 'media', 'aprovado', 'peso é NUMERIC sem CHECK. Peso zero anula a participação sem removê-la; peso negativo inverte o sentido da contribuição em qualquer média ponderada. Nenhum dos dois é um estado válido.', 'Meta no cercado.', '[{"acao": "Inserir participante com peso = -1", "ordem": 1, "resultado_esperado": "Recusado — peso é fator positivo"}, {"acao": "Inserir participante com peso = 0", "ordem": 2, "resultado_esperado": "Recusado"}]', 'Só entra peso maior que zero.', 'Provável ACHADO: hoje os dois entram. Correção: CHECK (peso > 0).', 'api', NULL, 'em_triagem', NULL),
    ('MPAR-012', 'Apagar a meta remove os participantes', 'excecao', 'baixa', 'aprovado', 'FK ON DELETE CASCADE: excluir a meta não pode deixar vínculo de participante órfão apontando para meta que não existe.', 'Meta compartilhada com participantes.', '[{"acao": "Excluir a meta", "ordem": 1, "resultado_esperado": "Meta e participantes somem juntos"}]', 'Cascade limpo, sem órfãos.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MWKF-001', 'Transição de workflow registra a trilha completa', 'feliz', 'alta', 'aprovado', 'Cada mudança de workflow_status (rascunho → em_aprovacao → ativa...) deve deixar uma linha em metas_workflow_log com status anterior, status novo, ação e autor. É a trilha que responde quem aprovou a meta e quando — sem ela, aprovação é só um campo que alguém trocou.', 'Meta em rascunho no cercado.', '[{"acao": "Mudar a meta de rascunho para em_aprovacao registrando o log", "ordem": 1, "resultado_esperado": "workflow_status atualizado e linha no log com anterior=rascunho, novo=em_aprovacao"}, {"acao": "Mudar de em_aprovacao para ativa com justificativa", "ordem": 2, "resultado_esperado": "Segunda linha no log, com a justificativa gravada"}]', 'A trilha reconta a história completa da meta, transição por transição.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MWKF-010', 'Status de workflow fora da lista fechada é recusado', 'negativo', 'media', 'aprovado', 'workflow_status é enum (rascunho, em_aprovacao, ativa, em_revisao, suspensa, encerrada, cancelada). Valor inventado não pode entrar — é a única proteção de máquina de estados que o banco tem hoje.', 'Meta no cercado.', '[{"acao": "Gravar workflow_status = aprovadissima", "ordem": 1, "resultado_esperado": "Recusado pelo enum"}]', 'Valor fora do enum não entra.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('MWKF-011', 'Mudança de workflow por fora da tela não deixa trilha', 'negativo', 'critica', 'aprovado', 'O registro em metas_workflow_log é feito pelo FRONT, num insert separado e sem checagem de erro. Um update direto em workflow_status (API, integração, SQL) muda o estado da meta sem deixar rastro nenhum — a meta aparece ativa sem nenhuma aprovação registrada. Auditoria que depende da boa vontade do cliente HTTP não é auditoria.', 'Meta em rascunho no cercado.', '[{"acao": "Atualizar workflow_status direto para ativa, sem passar pela tela", "ordem": 1, "resultado_esperado": "Idealmente o banco registra a transição sozinho (trigger), mantendo a trilha íntegra"}]', 'Toda transição deixa linha no log, independentemente da rota de entrada.', 'Provável ACHADO: hoje o update passa e o log fica vazio. Correção sugerida: trigger AFTER UPDATE OF workflow_status em metas gravando o log — o front pode continuar gravando a justificativa, mas a existência da linha deixa de ser opcional.', 'api', NULL, 'em_triagem', NULL),
    ('MWKF-012', 'Apagar a meta leva a trilha de workflow junto', 'excecao', 'media', 'aprovado', 'A FK de metas_workflow_log é ON DELETE CASCADE: excluir a meta apaga a trilha de aprovação. O caso confirma que o cascade funciona e não deixa log órfão — e registra a consequência: excluir meta é também destruir o histórico de quem a aprovou.', 'Meta com pelo menos duas transições registradas.', '[{"acao": "Excluir a meta", "ordem": 1, "resultado_esperado": "Meta e trilha somem juntas, sem linha órfã"}]', 'Cascade limpo, sem órfãos.', 'Se um dia a trilha precisar sobreviver à meta (exigência comum de auditoria), o caminho é soft-delete da meta ou log desacoplado — fica anotado para o desenvolvimento avaliar.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'planejamento-gestao/metas'
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


-- (3) PONTES — 76 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('CERT-001', 'qa_caso_cert_001', true),
    ('CERT-010', 'qa_caso_cert_010', true),
    ('CERT-011', 'qa_caso_cert_011', true),
    ('HCAL-001', 'qa_caso_hcal_001', true),
    ('HCAL-010', 'qa_caso_hcal_010', true),
    ('HCAL-011', 'qa_caso_hcal_011', true),
    ('HCAL-012', 'qa_caso_hcal_012', true),
    ('HCAT-001', 'qa_caso_hcat_001', true),
    ('HCAT-010', 'qa_caso_hcat_010', true),
    ('HTPL-001', 'qa_caso_htpl_001', true),
    ('HTPL-010', 'qa_caso_htpl_010', true),
    ('HUB-001', 'qa_caso_hub_001', true),
    ('HUB-002', 'qa_caso_hub_002', true),
    ('HUB-003', 'qa_caso_hub_003', true),
    ('HUB-004', 'qa_caso_hub_004', true),
    ('HUB-010', 'qa_caso_hub_010', true),
    ('HUB-011', 'qa_caso_hub_011', true),
    ('HUB-012', 'qa_caso_hub_012', true),
    ('HUB-020', 'qa_caso_hub_020', true),
    ('HUB-022', 'qa_caso_hub_022', true),
    ('PASS-001', 'qa_caso_pass_001', true),
    ('PCHK-001', 'qa_caso_pchk_001', true),
    ('PCHK-010', 'qa_caso_pchk_010', true),
    ('PDOC-001', 'qa_caso_pdoc_001', true),
    ('PDOC-010', 'qa_caso_pdoc_010', true),
    ('PROC-001', 'qa_caso_proc_001', true),
    ('PROC-002', 'qa_caso_proc_002', true),
    ('PROC-010', 'qa_caso_proc_010', true),
    ('PROC-011', 'qa_caso_proc_011', true),
    ('PROC-012', 'qa_caso_proc_012', true),
    ('IDE-001', 'qa_caso_ide_001', true),
    ('IDE-002', 'qa_caso_ide_002', true),
    ('IDE-003', 'qa_caso_ide_003', true),
    ('IDE-010', 'qa_caso_ide_010', true),
    ('IDE-011', 'qa_caso_ide_011', true),
    ('IDE-020', 'qa_caso_ide_020', true),
    ('IDE-022', 'qa_caso_ide_022', true),
    ('MCFG-001', 'qa_caso_mcfg_001', true),
    ('MCFG-002', 'qa_caso_mcfg_002', true),
    ('MCFG-003', 'qa_caso_mcfg_003', true),
    ('MCFG-020', 'qa_caso_mcfg_020', true),
    ('MCFG-021', 'qa_caso_mcfg_021', true),
    ('MCFG-030', 'qa_caso_mcfg_030', true),
    ('MCHK-001', 'qa_caso_mchk_001', true),
    ('MCHK-002', 'qa_caso_mchk_002', true),
    ('MCHK-010', 'qa_caso_mchk_010', true),
    ('MCHK-011', 'qa_caso_mchk_011', true),
    ('META-001', 'qa_caso_meta_001', true),
    ('META-002', 'qa_caso_meta_002', true),
    ('META-003', 'qa_caso_meta_003', true),
    ('META-010', 'qa_caso_meta_010', true),
    ('META-011', 'qa_caso_meta_011', true),
    ('META-012', 'qa_caso_meta_012', true),
    ('META-013', 'qa_caso_meta_013', true),
    ('META-022', 'qa_caso_meta_022', true),
    ('META-030', 'qa_caso_meta_030', true),
    ('META-031', 'qa_caso_meta_031', true),
    ('META-032', 'qa_caso_meta_032', true),
    ('META-033', 'qa_caso_meta_033', true),
    ('META-034', 'qa_caso_meta_034', true),
    ('META-035', 'qa_caso_meta_035', true),
    ('MEVD-001', 'qa_caso_mevd_001', true),
    ('MEVD-010', 'qa_caso_mevd_010', true),
    ('MEVD-011', 'qa_caso_mevd_011', true),
    ('MIND-001', 'qa_caso_mind_001', true),
    ('MIND-010', 'qa_caso_mind_010', true),
    ('MIND-011', 'qa_caso_mind_011', true),
    ('MIND-020', 'qa_caso_mind_020', true),
    ('MPAR-001', 'qa_caso_mpar_001', true),
    ('MPAR-010', 'qa_caso_mpar_010', true),
    ('MPAR-011', 'qa_caso_mpar_011', true),
    ('MPAR-012', 'qa_caso_mpar_012', true),
    ('MWKF-001', 'qa_caso_mwkf_001', true),
    ('MWKF-010', 'qa_caso_mwkf_010', true),
    ('MWKF-011', 'qa_caso_mwkf_011', true),
    ('MWKF-012', 'qa_caso_mwkf_012', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 85, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('CERT-001'), ('CERT-010'), ('CERT-011'), ('HCAL-001'), ('HCAL-010'), ('HCAL-011'), ('HCAL-012'), ('HCAT-001'), ('HCAT-010'), ('HTPL-001'), ('HTPL-010'), ('HUB-001'), ('HUB-002'), ('HUB-003'), ('HUB-004'), ('HUB-010'), ('HUB-011'), ('HUB-012'), ('HUB-020'), ('HUB-022'), ('IDE-001'), ('IDE-002'), ('IDE-003'), ('IDE-010'), ('IDE-011'), ('IDE-020'), ('IDE-022'), ('MCFG-001'), ('MCFG-002'), ('MCFG-003'), ('MCFG-020'), ('MCFG-021'), ('MCFG-030'), ('MCHK-001'), ('MCHK-002'), ('MCHK-010'), ('MCHK-011'), ('META-001'), ('META-002'), ('META-003'), ('META-010'), ('META-011'), ('META-012'), ('META-013'), ('META-022'), ('META-030'), ('META-031'), ('META-032'), ('META-033'), ('META-034'), ('META-035'), ('MEVD-001'), ('MEVD-010'), ('MEVD-011'), ('MIND-001'), ('MIND-010'), ('MIND-011'), ('MIND-020'), ('MPAR-001'), ('MPAR-010'), ('MPAR-011'), ('MPAR-012'), ('MWKF-001'), ('MWKF-010'), ('MWKF-011'), ('MWKF-012'), ('PASS-001'), ('PCHK-001'), ('PCHK-010'), ('PDOC-001'), ('PDOC-010'), ('PROC-001'), ('PROC-002'), ('PROC-010'), ('PROC-011'), ('PROC-012'), ('TELA-INC-001'), ('TELA-INC-002'), ('TELA-INC-003'), ('TELA-INC-004'), ('TELA-INC-005'), ('TELA-INC-006'), ('TELA-INC-007'), ('TELA-INC-008'), ('TELA-INC-009')),
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
