-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 9 de 15
-- Férias
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

-- (1) ROTINAS — 46 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40001); v_id uuid; v_direito numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar período aquisitivo com 8 faltas e direito INCOERENTE de 30 dias';
  r.esperado := 'O banco deriva ou recusa: com 8 faltas, o art. 130 dá 24 dias';
  INSERT INTO public.ferias_periodos_aquisitivos
    (tenant_id, colaborador_cpf, colaborador_nome, data_admissao,
     aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados,
     fonte_faltas, dias_direito, dias_saldo, faltas_consideradas, status, origem)
  VALUES (v_t, v_cpf, '[QA-FERIAS] Oito Faltas', CURRENT_DATE - interval '2 years',
          CURRENT_DATE - interval '2 years', CURRENT_DATE - interval '1 year',
          8, 0, 'carga', 30, 30, 8, 'ativo', 'manual')
  RETURNING id INTO v_id;

  SELECT dias_direito INTO v_direito FROM public.ferias_periodos_aquisitivos WHERE id = v_id;
  IF v_direito = 24 THEN
    r.situacao := 'passou';
    r.obtido := 'O banco corrigiu o direito para 24 dias — a escala do art. 130 é garantida na escrita.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('O BANCO ACEITOU direito de %s dias com 8 faltas — o art. 130 manda 24. '
      'A função ferias_dias_por_faltas_clt existe e está correta, mas nada obriga o dado gravado a '
      'passar por ela: entrada manual ou importação grava qualquer número. Correção: trigger '
      'derivando dias_direito das faltas consideradas (com exceção auditada para validação manual).',
      v_direito);
  END IF;
  RETURN r;
EXCEPTION
  WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Incoerência recusada na escrita.'; RETURN r;
  WHEN OTHERS THEN
    r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_err text := '';
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Avaliar ferias_dias_por_faltas_clt nas fronteiras 5/6, 14/15, 23/24, 32/33';
  r.esperado := '30/24, 24/18, 18/12, 12/0 — cada fronteira no degrau certo';

  IF public.ferias_dias_por_faltas_clt(5)  <> 30 THEN v_err := v_err || ' 5->'  || public.ferias_dias_por_faltas_clt(5); END IF;
  IF public.ferias_dias_por_faltas_clt(6)  <> 24 THEN v_err := v_err || ' 6->'  || public.ferias_dias_por_faltas_clt(6); END IF;
  IF public.ferias_dias_por_faltas_clt(14) <> 24 THEN v_err := v_err || ' 14->' || public.ferias_dias_por_faltas_clt(14); END IF;
  IF public.ferias_dias_por_faltas_clt(15) <> 18 THEN v_err := v_err || ' 15->' || public.ferias_dias_por_faltas_clt(15); END IF;
  IF public.ferias_dias_por_faltas_clt(23) <> 18 THEN v_err := v_err || ' 23->' || public.ferias_dias_por_faltas_clt(23); END IF;
  IF public.ferias_dias_por_faltas_clt(24) <> 12 THEN v_err := v_err || ' 24->' || public.ferias_dias_por_faltas_clt(24); END IF;
  IF public.ferias_dias_por_faltas_clt(32) <> 12 THEN v_err := v_err || ' 32->' || public.ferias_dias_por_faltas_clt(32); END IF;
  IF public.ferias_dias_por_faltas_clt(33) <> 0  THEN v_err := v_err || ' 33->' || public.ferias_dias_por_faltas_clt(33); END IF;

  IF v_err = '' THEN
    r.situacao := 'passou';
    r.obtido := 'As oito fronteiras da escala do art. 130 caem no degrau certo.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'FRONTEIRA ERRADA na escala do art. 130:' || v_err || '. Cada erro aqui é dia de férias a mais ou a menos para alguém.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_olha boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o recálculo do período aquisitivo consulta os afastamentos?';
  r.esperado := 'Benefício previdenciário > 6 meses e licença > 30 dias zeram o aquisitivo (art. 133)';
  SELECT bool_or(p.prosrc ILIKE '%afastament%') INTO v_olha
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('ferias_recalcular_periodo', 'ferias_recalcular_empresa');
  IF NOT coalesce(v_olha, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o recálculo de férias não consulta o módulo de Afastamentos — as '
             || 'hipóteses do art. 133 (benefício previdenciário por mais de 6 meses, licença '
             || 'remunerada acima de 30 dias, paralisação > 30 dias) nunca zeram o período '
             || 'aquisitivo. Colaborador que passou 8 meses no INSS volta com o aquisitivo '
             || 'contando como se nada houvesse. Correção: cruzar afastamentos no recálculo, '
             || 'reiniciando o aquisitivo com a origem registrada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O recálculo consulta os afastamentos.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6004); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Dois Períodos', 0, CURRENT_DATE - 400);
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Dois Períodos', 0, CURRENT_DATE - 30);

  r.passo_ordem := 1;
  r.passo_acao := 'Com dois aquisitivos em aberto (um vencendo!), programar férias contra o MAIS NOVO';
  r.esperado := 'Recusado ou alertado — o período antigo é o que vira dobra se vencer';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome,
       aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Dois Períodos',
            CURRENT_DATE - 395, CURRENT_DATE - 30,
            CURRENT_DATE + 40, CURRENT_DATE + 69, 30, false, 0, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: com o período ANTIGO a caminho da dobra, o banco aceitou programação '
             || 'contra o período NOVO sem recusa nem alerta — nada prioriza a baixa do '
             || 'aquisitivo mais antigo (a programação nem referencia formalmente qual período '
             || 'baixa: os campos aquisitivo_inicio/fim são texto livre, sem FK). É o erro '
             || 'mais caro possível: programar contra o novo e deixar o velho vencer em dobro '
             || '(art. 137). Correção: vínculo formal programação → período aquisitivo + '
             || 'trava/alerta priorizando o mais antigo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A programação contra o período novo foi recusada/alertada com o antigo em aberto.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6105);
        v_ini date := CURRENT_DATE - 60; v_fim date := CURRENT_DATE - 10; v_n int;
BEGIN
  -- 1 falta injustificada + 1 dia justificado no mesmo intervalo
  PERFORM public.qa_ponto_dia(v_cpf, 'QA Art131', v_ini + 5, NULL, 'falta');
  PERFORM public.qa_ponto_dia(v_cpf, 'QA Art131', v_ini + 6, NULL, 'justificado');

  r.passo_ordem := 1;
  r.passo_acao := 'Contar as faltas do período pela fonte do Ponto (1 falta + 1 dia justificado)';
  r.esperado := 'Conta 1 — ausência amparada (art. 131) não entra na escala do art. 130';
  v_n := public.ferias_faltas_do_ponto(public.qa_sandbox_tenant_id(), v_cpf, v_ini, v_fim);

  IF v_n = 1 THEN
    r.situacao := 'passou';
    r.obtido := 'Só a falta injustificada contou; o dia justificado ficou fora da escala. '
             || 'Ressalva: isso vale quando a fonte é o Ponto — no modo carga (faltas_carga '
             || 'digitadas), a distinção depende de quem digita.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('A contagem devolveu %s (esperado 1). Somar ausência amparada à escala '
             || 'do art. 130 corta férias de quem adoeceu — o art. 131 lista o que NÃO é falta.',
             coalesce(v_n::text, 'NULL'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_006()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_dias int; v_subtrai text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Apurar o direito com 8 faltas: faixa, nunca subtração';
  r.esperado := '24 dias (faixa do art. 130) — jamais 22 (30 - 8)';
  v_dias := public.ferias_dias_por_faltas_clt(8);

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma função de férias subtrai faltas dos dias?';
  r.esperado := 'Nenhuma — o §1º veda o desconto um-a-um';
  SELECT string_agg(p.proname, ', ') INTO v_subtrai
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%- falta%' OR p.prosrc ILIKE '%-falta%');

  IF v_dias = 24 AND v_subtrai IS NULL THEN
    r.situacao := 'passou';
    r.obtido := '8 faltas renderam a faixa de 24 dias e nenhuma função subtrai faltas dos dias '
             || 'de gozo — o §1º do art. 130 está respeitado.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Violação do art. 130, §1º: faixa devolveu %s (esperado 24)%s.',
             coalesce(v_dias::text, 'NULL'),
             CASE WHEN v_subtrai IS NOT NULL
                  THEN format('; função(ões) subtraindo faltas: %s', v_subtrai) ELSE '' END);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_006()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_006 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_007()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_resq text; v_dias int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): há resquício da tabela do 130-A (tempo parcial, máx. 18 dias)?';
  r.esperado := 'Nenhum — revogada em 2017; o parcial usa a escala geral (30 dias com até 5 faltas)';
  SELECT string_agg(p.proname, ', ') INTO v_resq
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%parcial%' OR p.prosrc ILIKE '%130-A%' OR p.prosrc ILIKE '%18 dias%');
  v_dias := public.ferias_dias_por_faltas_clt(0);

  IF v_resq IS NULL AND v_dias = 30 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma tabela de tempo parcial no código e a escala geral devolve 30 dias — '
             || 'contrato parcial recebe férias inteiras, como manda a redação pós-2017 '
             || '(mesmo guarda-corpo do FERIAS-015 contra regra revogada).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Resquício de regra revogada: %s (escala geral: %s dias). A tabela do '
             || '130-A não pode voltar.', coalesce(v_resq, '—'), coalesce(v_dias::text, '?'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_007()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_007 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_008()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o marco prescricional dos períodos é calculado/vigiado?';
  r.esperado := 'Fim do concessivo + 5 anos (2 após a rescisão), com alerta antes de consumar';
  v_est := coalesce(public.qa_col_existe(NULL, '%prescri%'), public.qa_fns_com('%prescri%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: prescrição não existe no módulo — nenhum campo ou função calcula o '
             || 'marco do art. 149 (fim do concessivo + 5 anos; 2 anos após a extinção do '
             || 'contrato, CF art. 7º XXIX). Período esquecido atravessa o marco sem aviso: '
             || 'vira perda definitiva do trabalhador e evidência de desorganização na '
             || 'fiscalização. Correção: data de prescrição derivada por período, com alerta '
             || 'antecipado a RH/Jurídico.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prescrição controlada: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_008()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_008 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6010);
        v_aceitou boolean := false; v_concord text;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Fraciona OK', 0, CURRENT_DATE - 30);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar a composição LEGAL 14+11+5 (art. 134, §1º)';
  r.esperado := 'Aceita — e com a concordância do empregado registrada como evidência';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias,
       p3_inicio, p3_fim, p3_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Fraciona OK',
            CURRENT_DATE - 395, CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 43, 14,
            CURRENT_DATE + 90, CURRENT_DATE + 100, 11,
            CURRENT_DATE + 150, CURRENT_DATE + 154, 5,
            false, 0, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir onde fica registrada a CONCORDÂNCIA do empregado com o fracionamento';
  r.esperado := 'Campo/evidência de concordância — o §1º só permite fracionar com ela';
  v_concord := public.qa_col_existe('ferias_programacao', '%concord%');

  IF v_aceitou AND v_concord IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Composição legal aceita com evidência de concordância.';
  ELSIF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a composição válida 14+11+5 foi aceita, mas NÃO EXISTE campo de '
             || 'concordância do empregado — o art. 134, §1º só admite o fracionamento "desde '
             || 'que haja concordância", e sem a evidência registrada a empresa não prova o '
             || 'requisito em juízo. Correção: campo de concordância (quem, quando, como) '
             || 'obrigatório para programação fracionada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'A composição LEGAL 14+11+5 foi recusada — validação mais restritiva que a lei.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40011);
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Sem Quatorze', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar P1=10, P2=10, P3=10 (soma 30, nenhum período com 14 dias)';
  r.esperado := 'Recusado — o art. 134, §1º exige um período de ao menos 14 dias corridos';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias, p3_inicio, p3_fim, p3_dias,
       abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Sem Quatorze',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 39, 10,
            CURRENT_DATE + 90, CURRENT_DATE + 99, 10,
            CURRENT_DATE + 150, CURRENT_DATE + 159, 10,
            false, 0, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU 10+10+10: a soma fecha 30, mas nenhum período atinge os 14 dias '
      'corridos do art. 134, §1º. A regra do fracionamento não existe em nenhuma camada do banco — '
      'é o motor de regras da seção 5 do documento de requisitos, ainda a construir.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Composição sem período de 14 dias recusada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40012); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Terceiro Curto', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar P1=20, P2=7, P3=3 (terceiro período abaixo de 5 dias)';
  r.esperado := 'Recusado — todo período do fracionamento tem piso de 5 dias corridos';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias, p3_inicio, p3_fim, p3_dias,
       abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Terceiro Curto',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 49, 20,
            CURRENT_DATE + 90, CURRENT_DATE + 96, 7,
            CURRENT_DATE + 150, CURRENT_DATE + 152, 3,
            false, 0, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN check_violation THEN v_aceitou := false;
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o teto estrutural de 3 períodos';
  r.esperado := 'Não existe P4 — a estrutura limita a 3, como manda a lei';
  -- A tabela tem apenas p1/p2/p3: o teto de 3 períodos é estrutural.

  IF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'Período abaixo de 5 dias recusado; teto de 3 períodos garantido pela estrutura.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU um período de 3 dias — abaixo do piso de 5 dias corridos do art. 134, §1º. '
      'O lado bom: o teto de 3 períodos é estrutural (só existem P1/P2/P3). Falta o piso por período no motor de regras.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40013);
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Sem Saldo', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Solicitar 42 dias com saldo de 30';
  r.esperado := 'Recusado, com o saldo e o período aquisitivo na mensagem';
  BEGIN
    INSERT INTO public.ferias_solicitacoes
      (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim,
       dias_solicitados, saldo_dias, status)
    VALUES (v_t, '[QA-FERIAS] Sem Saldo', v_cpf,
            CURRENT_DATE + 30, CURRENT_DATE + 71, 42, 30, 'pendente');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU solicitação de 42 dias com saldo de 30 — a própria linha carrega '
      'as duas colunas (dias_solicitados e saldo_dias) e nada as compara. O direito do art. 130 é '
      'teto duro; a validação vive só na tela. Correção: CHECK (dias_solicitados <= saldo_dias) '
      'como rede mínima, e o motor de regras por cima.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Solicitação acima do saldo recusada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_014()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40014); v_emp uuid; v_feriado date := CURRENT_DATE + 45;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-FERIAS] Unidade Com Feriado', '11222333040014');
  PERFORM public.qa_feriado_da_unidade(v_emp, v_feriado, '[QA] Feriado Municipal');
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Vespera', 0);

  r.passo_ordem := 1;
  r.passo_acao := format('Programar início em %s — 1 dia antes do feriado da unidade (%s)', v_feriado - 1, v_feriado);
  r.esperado := 'Recusado — vedado iniciar nos 2 dias que antecedem feriado (art. 134, §3º)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, empresa_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_emp, v_cpf, '[QA-FERIAS] Vespera',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            v_feriado - 1, v_feriado + 28, 30, false, 0, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU férias iniciando na véspera de feriado da unidade — o art. 134, §3º '
      'veda o início nos 2 dias que antecedem feriado ou DSR. A fonte única de feriados por unidade '
      '(RN22, feriados_da_empresa) existe e não é consultada aqui. Correção: validação na programação '
      'usando o calendário da unidade, com sugestão da data válida mais próxima.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Véspera de feriado recusada pelo calendário da unidade.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_014()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_014 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_015()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_n int; v_lista text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): procurar trava por idade nas funções e constraints de férias';
  r.esperado := 'Nenhuma — a restrição etária do antigo art. 134, §2º foi revogada pela Lei 13.467/2017';

  SELECT count(*), string_agg(p.proname, ', ')
  INTO v_n, v_lista
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname ILIKE '%ferias%'
    AND p.proname NOT LIKE 'qa\_%'  -- as próprias rotinas de QA citam a trava no texto do diagnóstico
    AND (pg_get_functiondef(p.oid) ILIKE '%idade%'
         OR pg_get_functiondef(p.oid) ILIKE '%data_nascimento%');

  IF v_n = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'Nenhuma função de férias condiciona o gozo à idade — o sistema não carrega a trava revogada (erro comum em legados).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('POSSÍVEL TRAVA ETÁRIA em %s função(ões) de férias: %s. A obrigação de período único para menor de 18/maior de 50 foi REVOGADA pela Lei 13.467/2017 — conferir e remover se for restrição de gozo.', v_n, v_lista);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_015()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_015 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_016()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o domínio de férias conhece o estudante menor de 18?';
  r.esperado := 'Sinalização do colaborador e alerta na janela de programação (art. 136, §2º)';
  v_est := coalesce(public.qa_col_existe(NULL, '%estudante%'),
                    public.qa_fns_com('%estudante%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhum campo registra a condição de estudante — o direito do menor de '
             || '18 de fazer coincidir as férias com as escolares (art. 136, §2º) não tem como '
             || 'ser sinalizado na programação. Correção: flag de estudante no cadastro + '
             || 'alerta na programação de menor de idade fora do recesso escolar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Condição de estudante presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_016()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_016 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_017()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o cadastro registra vínculo familiar entre colaboradores?';
  r.esperado := 'Familiares na mesma empresa sinalizados para a preferência de coincidência';

  -- Evidência principal: a tabela dedicada. Não depende de nada do motor.
  v_est := CASE WHEN to_regclass('public.ferias_vinculo_familiar') IS NOT NULL
                THEN 'tabela ferias_vinculo_familiar' END;

  -- Plano B (bases antigas, em que o vínculo podia estar como coluna).
  -- Protegido: onde as auxiliares do motor não existem, seguimos sem elas.
  IF v_est IS NULL THEN
    BEGIN
      v_est := COALESCE(public.qa_col_existe(NULL, '%conjuge%'),
                        public.qa_col_existe(NULL, '%familiar%'),
                        public.qa_fns_com('%familiar%ferias%'));
    EXCEPTION WHEN undefined_function THEN
      v_est := NULL;
    END;
  END IF;

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhum campo liga colaboradores da mesma família — a preferência do '
             || 'art. 136, §1º (familiares na mesma empresa tirarem férias juntos, se não '
             || 'prejudicar o serviço) não tem como ser sinalizada na programação. É direito '
             || 'informativo, não bloqueante. Correção: vínculo familiar no cadastro + aviso '
             || 'de coincidência na programação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vínculo familiar presente: %s. A regra do art. 136, §1º é avaliada na '
                    || 'programação como informativo.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_017()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_017 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40020); v_fim date := CURRENT_DATE - interval '13 months';
BEGIN
  PERFORM public.qa_modo_ligar();
  -- aquisitivo terminou há 13 meses: o limite concessivo (12 meses) já venceu
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Concessivo Vencido', 0, v_fim::date);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar férias com o limite concessivo já vencido, sem alçada de diretoria';
  r.esperado := 'Bloqueado para perfis comuns — e, quando autorizado, com o custo da dobra exibido (art. 137)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Concessivo Vencido',
            v_fim - interval '1 year', v_fim,
            CURRENT_DATE + 30, CURRENT_DATE + 59, 30, false, 0, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU programação com o concessivo vencido, sem alçada e sem sinalizar a '
      'dobra: as férias deviam ter sido concedidas nos 12 meses seguintes ao aquisitivo (art. 134) e '
      'agora o pagamento é em dobro (art. 137). Programar sem ver o custo é assinar o passivo no '
      'escuro. Correção: bloqueio com exceção de diretoria + exibição do valor da dobra (motor da seção 5).';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Programação além do concessivo bloqueada sem alçada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o valor em dobro do concessivo vencido é calculado por alguém?';
  r.esperado := 'No dia seguinte ao vencimento, a dobra do art. 137 aparece automaticamente';
  v_fns := public.qa_fns_com('%dobro%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (par financeiro do FERIAS-020): nenhuma função calcula a dobra do art. '
             || '137 — o concessivo vencido não vira valor em lugar algum, e o passivo só '
             || 'aparece quando alguém lembra de procurar. O painel deveria exibir o dobro '
             || 'automaticamente no dia seguinte ao vencimento: passivo visível é o que dispara '
             || 'a gestão. Correção: rotina diária que identifica concessivos vencidos e '
             || 'materializa a obrigação em dobro.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dobra calculada em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe cálculo da dobra com o corte da Súmula 81?';
  r.esperado := 'Dobro APENAS sobre os dias gozados após o fim do concessivo';
  v_fns := public.qa_fns_com('%dobro%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (encadeado ao FERIAS-021): a dobra do art. 137 não é calculada em '
             || 'lugar nenhum — e quando for construída, precisa nascer com o corte da Súmula '
             || '81: férias que atravessam o vencimento dobram SÓ os dias excedentes (5 dentro '
             || 'do prazo saem simples; 25 fora saem em dobro). Dobrar o período inteiro '
             || 'superestima o passivo; ignorar o corte o esconde. Correção: cálculo dia a dia '
             || 'contra a data-limite do concessivo, com memória.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dobra presente (conferir o corte da Súmula 81): %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_024()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6124);
        v_status text;
BEGIN
  INSERT INTO public.ferias_solicitacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_inicio, data_fim, dias_solicitados, saldo_dias, status)
  VALUES (public.qa_sandbox_tenant_id(), public.qa_um_usuario(), 'QA Sobreposição', v_cpf,
          CURRENT_DATE - 10, CURRENT_DATE + 19, 30, 30, 'em_gozo');

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar afastamento por doença no meio do gozo e observar a reação';
  r.esperado := 'Sobreposição detectada: gozo suspenso/interrompido e dias restantes preservados';
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_cpf, colaborador_nome, status, data_inicio, data_fim)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Sobreposição', 'ativo',
          CURRENT_DATE, CURRENT_DATE + 30);

  SELECT status INTO v_status FROM public.ferias_solicitacoes
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND colaborador_cpf = v_cpf;

  IF v_status = 'em_gozo' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o afastamento entrou por cima das férias e NADA reagiu — a solicitação '
             || 'segue "em gozo" com o colaborador afastado por doença. Os dois institutos não '
             || 'coexistem: o gozo deveria suspender, os 20 dias restantes voltarem ao saldo e '
             || 'o eSocial ser ajustado. Sem a detecção, o colaborador "gasta" férias doente — '
             || 'e as férias não gozadas viram passivo. Correção: gatilho de afastamento '
             || 'verificando sobreposição com férias em gozo/aprovadas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('A sobreposição reagiu: solicitação passou a "%s".', v_status);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_024()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_024 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o aviso de férias (D-30) é gerado e vigiado?';
  r.esperado := 'Alerta em D-45 e aviso emitido com 30 dias, com recibo de ciência (art. 135)';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%historico%'  -- o gatilho de histórico só copia colunas
    AND p.prosrc ILIKE '%aviso_gerado%';
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o campo aviso_gerado existe na solicitação, mas NENHUMA função o '
             || 'preenche ou vigia — não há relógio do art. 135 (aviso por escrito com 30 dias '
             || 'de antecedência, mediante recibo). Sem o aviso tempestivo documentado, a '
             || 'concessão é irregular mesmo com as férias gozadas. Correção: alerta em D-45, '
             || 'emissão do aviso em D-30 via módulo de Documentos com recibo de ciência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Aviso vigiado em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6031); v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Aprovar solicitação com início em 20 dias, sem aviso emitido e sem justificativa';
  r.esperado := 'Travado — início em menos de 30 dias significa aviso fora do prazo legal';
  BEGIN
    INSERT INTO public.ferias_solicitacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_inicio, data_fim, dias_solicitados, saldo_dias, status, aviso_gerado)
    VALUES (public.qa_sandbox_tenant_id(), public.qa_um_usuario(), 'QA Aviso Curto', v_cpf,
            CURRENT_DATE + 20, CURRENT_DATE + 49, 30, 30, 'aprovado', false);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR not_null_violation THEN
    v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou solicitação APROVADA com início em 20 dias, sem aviso '
             || 'emitido e sem justificativa registrada. O art. 135 exige o aviso com 30 dias; '
             || 'a exceção operacional até pode existir, mas só com alerta aceito e '
             || 'justificativa em trilha. Correção: trava no status aprovado quando '
             || '(data_inicio - hoje) < 30 e aviso_gerado = false, com campo de justificativa '
             || 'da exceção.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A aprovação com prazo de aviso inviável foi travada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_032()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a aprovação gera a obrigação financeira (D-2) com o terço?';
  r.esperado := 'Vencimento em D-2 do início (art. 145) e terço constitucional em TODOS os cálculos';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%valor_terco%' OR p.prosrc ILIKE '%registro_financeiro_id%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a solicitação tem os campos financeiros (valor_ferias, valor_terco, '
             || 'valor_total_bruto, registro_financeiro_id), mas NENHUMA função os calcula ou '
             || 'preenche — o terço constitucional (CF art. 7º, XVII) e o vencimento em D-2 '
             || '(art. 145) dependem de alguém lembrar e digitar. Pagamento fora do D-2 gera '
             || 'dobra do valor pela Súmula 450 (discussão atual no TST, mas o prazo segue '
             || 'legal). Correção: aprovação dispara o cálculo (salário base + terço, abono '
             || 'incluído) e cria a obrigação com vencimento D-2, alertando a tesouraria.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Financeiro de férias calculado em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_032()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_032 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_033()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe motor de cálculo da remuneração de férias (médias + 1/3)?';
  r.esperado := 'Salário da época + média das variáveis (art. 142) + terço, com memória reproduzível';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%valor_ferias%' OR p.prosrc ILIKE '%valor_terco%'
         OR (p.proname ILIKE '%ferias%' AND p.prosrc ILIKE '%media%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO CENTRAL do documento de requisitos: o CÁLCULO de férias não existe no '
             || 'banco. Os campos de valor da solicitação (valor_ferias, valor_terco, '
             || 'valor_abono, valor_total_bruto) são preenchíveis à mão, sem motor de médias '
             || '(art. 142), sem terço automático, sem memória e sem alerta de rubrica '
             || 'faltante. Quem recebe hora extra habitual, comissão ou adicional leva a MÉDIA '
             || 'para as férias — calcular só o fixo paga a menos, e sem memória nada se '
             || 'audita. Correção: motor de cálculo determinístico com base parametrizável '
             || 'por rubrica e memória exportável (é o RF-004 e o RNF-001 do documento).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Motor de cálculo presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_033()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_033 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_034()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as naturezas tributáveis × indenizatórias são distinguidas?';
  r.esperado := 'Gozo + 1/3 com INSS/FGTS/IRRF (Tema 985 na patronal); abono + 1/3 fora da base (art. 144)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%ferias%'
    AND (p.prosrc ILIKE '%inss%' OR p.prosrc ILIKE '%irrf%' OR p.prosrc ILIKE '%indenizat%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe apuração de encargos de férias — nenhuma função distingue '
             || 'as duas naturezas que convivem no mesmo pagamento: férias gozadas + 1/3 '
             || 'sofrem INSS/FGTS/IRRF (o terço inclusive na patronal, Tema 985 do STF, '
             || 'modulado desde 15/09/2020); abono pecuniário + seu 1/3 são indenizatórios '
             || '(art. 144) e ficam FORA da base. Misturar erra o encargo para os dois lados. '
             || 'Depende do motor de cálculo do FERIAS-033 existir primeiro; as incidências '
             || 'nascem junto, versionadas ([VAL] contábil).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Incidências tratadas em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_034()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_034 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_035()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção adiantar_13 da programação é consumida por alguém?';
  r.esperado := 'Marcada, soma a 1ª parcela ao pagamento das férias e abate na apuração de novembro';
  v_fns := public.qa_fns_com('%adiantar_13%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o campo adiantar_13 existe na programação e NENHUMA função o lê — a '
             || 'opção é decorativa. O empregado que requer no prazo (Lei 4.749/65, art. 2º, '
             || '§2º) tem DIREITO à 1ª parcela do 13º junto com as férias; marcado o campo e '
             || 'nada acontecendo, ou o DP paga por fora (sem baixa, risco de duplicidade em '
             || 'novembro) ou o direito é ignorado. Correção: opção integrando o cálculo do '
             || 'pagamento e a baixa na apuração do 13º.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Adiantamento consumido em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_035()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_035 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6040);
        v_aceitou boolean := false; v_carimbo text;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Abono Prazo', 0, CURRENT_DATE + 60);

  r.passo_ordem := 1;
  r.passo_acao := 'Requerer abono de 10 dias (1/3 de 30) faltando 60 dias para o fim do aquisitivo';
  r.esperado := 'Aceito — prazo legal respeitado (até 15 dias antes do término, art. 143, §1º)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Abono Prazo',
            CURRENT_DATE - 305, CURRENT_DATE + 60,
            CURRENT_DATE + 90, CURRENT_DATE + 109, 20, true, 10, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Conferir o carimbo de QUANDO o abono foi requerido';
  r.esperado := 'Data do requerimento registrada — sem ela não se prova o prazo do §1º';
  v_carimbo := public.qa_col_existe('ferias_programacao', '%requer%');

  IF v_aceitou AND v_carimbo IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Abono no prazo aceito, com data de requerimento registrada.';
  ELSIF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o abono dentro do prazo foi aceito, mas a programação NÃO GUARDA a '
             || 'data do requerimento — e o prazo do art. 143, §1º (até 15 dias antes do fim '
             || 'do aquisitivo) se prova exatamente por esse carimbo. Sem ele, qualquer abono '
             || 'vira discutível. Correção: data/autor do requerimento na programação '
             || '(complementa o FERIAS-041, que já apontou a falta do limite de 1/3).';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'O abono legítimo (1/3, no prazo) foi recusado — validação mais restritiva que a lei.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(40041);
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_ferias_periodo(v_cpf, '[QA-FERIAS] Abono Guloso', 0);

  r.passo_ordem := 1;
  r.passo_acao := 'Programar abono de 15 dias num direito de 30 (limite legal: 10)';
  r.esperado := 'Recusado — o abono é de ATÉ 1/3 do período (art. 143)';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (v_t, v_cpf, '[QA-FERIAS] Abono Guloso',
            CURRENT_DATE - interval '13 months', CURRENT_DATE - 30,
            CURRENT_DATE + 30, CURRENT_DATE + 44, 15, true, 15, false, 'planejado');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU abono de 15 dias num direito de 30 — o art. 143 limita a 1/3 '
      '(10 dias; e em direito reduzido pelo art. 130 o teto acompanha). abono_dias é inteiro sem '
      'validação contra o direito. Correção: validação do 1/3 sobre o direito REAL no motor de regras.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Abono acima de 1/3 recusado.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_042()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6042); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_ferias_periodo(v_cpf, 'QA Abono Tarde', 0, CURRENT_DATE + 10);

  r.passo_ordem := 1;
  r.passo_acao := 'Requerer abono faltando só 10 dias para o fim do aquisitivo (prazo legal: 15)';
  r.esperado := 'Indisponível/recusado, com explicação do prazo — não um aceite silencioso';
  BEGIN
    INSERT INTO public.ferias_programacao
      (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
       p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
    VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Abono Tarde',
            CURRENT_DATE - 355, CURRENT_DATE + 10,
            CURRENT_DATE + 30, CURRENT_DATE + 49, 20, true, 10, false, 'planejado');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o abono requerido FORA do prazo (10 dias do fim do aquisitivo; a lei '
             || 'exige requerimento até 15 dias antes — art. 143, §1º) foi aceito sem aviso. '
             || 'O empregador não é obrigado a aceitar abono extemporâneo, e aceitá-lo sem '
             || 'saber cria expectativa e passivo. Correção: validar o prazo contra o fim do '
             || 'aquisitivo e recusar com mensagem clara (ou exigir aceite expresso do '
             || 'empregador como liberalidade).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O abono fora do prazo foi recusado.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_042()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_042 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_labels text; v_faltando text := '';
        v_esperados text[] := ARRAY['sugerido','planejado','confirmado','ciente','solicitado',
                                    'aprovado','em_gozo','concluido','cancelado'];
  e text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Conferir o enum ferias_prog_estado contra os 9 estados do ciclo (seção 4.2)';
  r.esperado := 'Todos presentes; valor fora da lista é recusado';

  SELECT string_agg(en.enumlabel, ',') INTO v_labels
  FROM pg_enum en JOIN pg_type t ON t.oid = en.enumtypid
  WHERE t.typname = 'ferias_prog_estado';

  IF v_labels IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O enum ferias_prog_estado não existe — o ciclo de estados do documento não tem contrato no banco.';
    RETURN r;
  END IF;

  FOREACH e IN ARRAY v_esperados LOOP
    IF position(e IN v_labels) = 0 THEN v_faltando := v_faltando || ' ' || e; END IF;
  END LOOP;

  r.passo_ordem := 2;
  r.passo_acao := 'Gravar programação com estado inventado';
  r.esperado := 'Recusado pelo enum';
  BEGIN
    EXECUTE format(
      'INSERT INTO public.ferias_programacao
         (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
          abono_vender, abono_dias, adiantar_13, estado)
       VALUES (%L, %L, %L, %L, %L, false, 0, false, %L::public.ferias_prog_estado)',
      public.qa_sandbox_tenant_id(), public.qa_cpf(40050), '[QA-FERIAS] Estado Inventado',
      CURRENT_DATE - interval '13 months', CURRENT_DATE - 30, 'aprovadissimo');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU estado fora da lista fechada do ciclo.';
    RETURN r;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL; -- recusado, como esperado
  END;

  IF v_faltando = '' THEN
    r.situacao := 'passou';
    r.obtido := 'Os 9 estados do ciclo existem no enum e valor inventado é recusado — o contrato da seção 4.2 está no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'Estados do ciclo AUSENTES no enum:' || v_faltando || '. O documento (4.2) define 9; o banco conhece: ' || v_labels || '.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_devolve boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cancelar férias aprovadas devolve os dias ao saldo?';
  r.esperado := 'Dias voltam ao período aquisitivo, alerta de vencimento reabre, trilha registra motivo';
  SELECT bool_or(p.prosrc ILIKE '%cancelad%' AND p.prosrc ILIKE '%saldo%') INTO v_devolve
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.proname ILIKE '%ferias%' OR p.prosrc ILIKE '%ferias_solicitacoes%');
  IF NOT coalesce(v_devolve, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função devolve os dias ao saldo quando a solicitação é '
             || 'cancelada — o status muda para "cancelado" e os dias ficam perdidos entre a '
             || 'solicitação e o período aquisitivo (que nem são formalmente ligados). O risco '
             || 'do concessivo também não reabre. Correção: cancelamento com motivo '
             || 'obrigatório que devolva os dias ao período, reabra o alerta de vencimento e '
             || 'registre quem/quando/por quê na trilha.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O cancelamento devolve o saldo.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_052()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6052); v_id uuid;
        v_mudou boolean := false;
BEGIN
  INSERT INTO public.ferias_programacao
    (tenant_id, colaborador_cpf, colaborador_nome, aquisitivo_inicio, aquisitivo_fim,
     p1_inicio, p1_fim, p1_dias, abono_vender, abono_dias, adiantar_13, estado)
  VALUES (public.qa_sandbox_tenant_id(), v_cpf, 'QA Data Firmada',
          CURRENT_DATE - 395, CURRENT_DATE - 30,
          CURRENT_DATE + 45, CURRENT_DATE + 74, 30, false, 0, false, 'confirmado')
  RETURNING id INTO v_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Alterar a data de início de uma programação CONFIRMADA, sem justificativa';
  r.esperado := 'Recusado ou exigindo justificativa — data confirmada é compromisso';
  BEGIN
    UPDATE public.ferias_programacao SET p1_inicio = CURRENT_DATE + 80, p1_fim = CURRENT_DATE + 109
    WHERE id = v_id;
    v_mudou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_mudou := false; END;

  IF v_mudou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a data de férias CONFIRMADAS mudou silenciosamente — sem justificativa '
             || 'obrigatória, sem alçada. O histórico até registra a mudança (gatilho de '
             || 'histórico existe), mas registrar não é o mesmo que exigir motivo: a alteração '
             || 'unilateral de data confirmada é a origem clássica de conflito trabalhista. '
             || 'Correção: a partir do estado confirmado, alteração de data exige campo de '
             || 'justificativa preenchido e registra o autor.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A alteração sem justificativa foi recusada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_052()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_052 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_053()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text; v_marcou boolean := false;
BEGIN
  v_cpf := public.qa_ponto_admissao('QA Em Gozo', 6053);
  INSERT INTO public.ferias_solicitacoes
    (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
     data_inicio, data_fim, dias_solicitados, saldo_dias, status)
  VALUES (public.qa_sandbox_tenant_id(), public.qa_um_usuario(), 'QA Em Gozo', v_cpf,
          CURRENT_DATE - 5, CURRENT_DATE + 10, 16, 30, 'em_gozo');

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar marcar ponto DURANTE férias em gozo';
  r.esperado := 'Recusado — férias suspendem a prestação de serviço, como o afastamento';
  BEGIN
    PERFORM public.qa_ponto_marca(v_cpf, 'QA Em Gozo', CURRENT_DATE, TIME '08:00', 'entrada');
    v_marcou := true;
  EXCEPTION WHEN OTHERS THEN v_marcou := false; END;

  IF v_marcou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o colaborador EM FÉRIAS marcou ponto normalmente. O validador de '
             || 'marcação só consulta a tabela de afastamentos — férias em gozo não bloqueiam '
             || 'nada (a ponte férias→afastamentos não existe). Trabalho registrado durante as '
             || 'férias é indício de férias não gozadas: passivo em dobro. Correção: o '
             || 'validador de marcação também consultar ferias_solicitacoes em_gozo (ou o '
             || 'início do gozo gerar afastamento automático).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A marcação durante o gozo foi recusada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_053()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_053 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_054()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe reabertura formal de cálculo de férias fechado?';
  r.esperado := 'Motivo + dupla aprovação + diferença/estorno, preservando a versão anterior';
  v_fns := coalesce(public.qa_fns_com('%ferias%reabr%'), public.qa_fns_com('%reabert%ferias%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (encadeado ao FERIAS-033): sem motor de cálculo, não há fechamento — e '
             || 'sem fechamento, não há reabertura formal. Quando o cálculo nascer, o rito '
             || 'nasce junto: cálculo pago não se edita; reabre-se com motivo e DUPLA '
             || 'aprovação, gerando DIFERENÇA (a pagar/estornar) e preservando a versão que o '
             || 'colaborador recebeu. Mesmo desenho da reabertura de competência do Ponto '
             || '(PONTO-358).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reabertura formal presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_054()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_054 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_055()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_gate text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a ciência do aviso trava a progressão da concessão?';
  r.esperado := 'Sem assinatura/recusa formal, a concessão não conclui (art. 135, mediante recibo)';
  SELECT string_agg(p.proname, ', ') INTO v_gate
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%assinatura_status%' AND p.prosrc ILIKE '%ferias%';
  IF v_gate IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a solicitação tem os campos de assinatura (assinatura_link_id, '
             || 'assinatura_status — bom sinal), mas NENHUMA função os confere: nada impede a '
             || 'concessão de avançar (em_gozo, concluído) com o aviso pendente de ciência. O '
             || 'art. 135 exige a comunicação MEDIANTE RECIBO — sem ele, a empresa fica sem a '
             || 'prova central da concessão regular. Correção: transição de estado condicionada '
             || 'à ciência (ou recusa formal registrada).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ciência verificada em: %s.', v_gate);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_055()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_055 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_056()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6156);
        v_uid uuid := public.qa_um_usuario(); v_aceitou boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    BEGIN
      INSERT INTO auth.users (id, email)
      VALUES (gen_random_uuid(), public.qa_fixture_email('FERIAS-056', 1))
      RETURNING id INTO v_uid;
    EXCEPTION WHEN OTHERS THEN
      r.situacao := 'nao_implementado';
      r.obtido := 'Sem usuário de autenticação disponível para simular o cenário.';
      RETURN r;
    END;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao := 'Gravar solicitação APROVADA onde o aprovador é o próprio solicitante';
  r.esperado := 'Recusado — segregação de funções (mesma trava que o ajuste de ponto tem)';
  BEGIN
    INSERT INTO public.ferias_solicitacoes
      (tenant_id, colaborador_id, colaborador_nome, colaborador_cpf,
       data_inicio, data_fim, dias_solicitados, saldo_dias, status,
       aprovado_por, aprovado_por_nome, data_aprovacao)
    VALUES (public.qa_sandbox_tenant_id(), v_uid, 'QA Autoaprovação', v_cpf,
            CURRENT_DATE + 40, CURRENT_DATE + 69, 30, 30, 'aprovado',
            v_uid, 'QA Autoaprovação', now());
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou férias APROVADAS PELO PRÓPRIO SOLICITANTE '
             || '(aprovado_por = colaborador_id) — não existe a trava de segregação que o '
             || 'ajuste de ponto já tem (chk_ajuste_sem_autoaprovacao, PONTO-252). Um gestor '
             || 'escolhe as próprias datas e valores sem contrapeso. Correção: CHECK '
             || '(aprovado_por IS NULL OR aprovado_por <> colaborador_id) em '
             || 'ferias_solicitacoes.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A autoaprovação foi recusada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_056()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_056 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): férias coletivas existem como fluxo próprio?';
  r.esperado := 'Até 2 períodos/ano, mínimo de 10 dias, comunicações ao MTE/sindicato/empregados (art. 139-141)';
  v_est := coalesce(public.qa_col_existe(NULL, '%coletiv%'), public.qa_fns_com('%ferias%coletiv%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: férias coletivas não existem no sistema — nem estrutura, nem fluxo. '
             || 'Empresa que parar em dezembro terá de lançar férias individuais uma a uma, '
             || 'sem os comunicados obrigatórios ao órgão do Ministério do Trabalho e ao '
             || 'sindicato com 15 dias de antecedência (art. 139, §§2º-3º) e sem o controle '
             || 'de 2 períodos/ano com mínimo de 10 dias. Correção: fluxo coletivo por '
             || 'empresa/setor gerando as programações individuais e os comunicados.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de coletivas presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_061()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os limites das coletivas (mínimo 10 dias, máx. 2 períodos) têm onde ser validados?';
  r.esperado := 'Período coletivo < 10 dias corridos bloqueado; 3º período no ano bloqueado (art. 139, §1º)';
  v_est := coalesce(public.qa_col_existe(NULL, '%coletiv%'), public.qa_fns_com('%ferias%coletiv%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem a estrutura de coletivas (FERIAS-060), os limites do art. 139, '
             || '§1º — nenhum período menor que 10 dias corridos, no máximo 2 períodos anuais '
             || '— não têm onde ser validados. Quando o fluxo nascer, estas duas travas nascem '
             || 'junto (CHECK no período e contagem anual por empresa).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (validar os limites): %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_061()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_061 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_062()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o tratamento do contratado há menos de 12 meses em coletivas existe?';
  r.esperado := 'Proporcionais ao tempo de casa, excedente como licença remunerada, aquisitivo reiniciado';
  v_est := coalesce(public.qa_col_existe(NULL, '%coletiv%'), public.qa_fns_com('%ferias%coletiv%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (encadeado ao FERIAS-060): sem o fluxo de coletivas, a regra do art. '
             || '140 para o novato não tem onde viver — quem tem 6 meses de casa goza '
             || 'PROPORCIONAIS, o excedente da parada é licença remunerada (nunca débito '
             || 'futuro), e o aquisitivo REINICIA no retorno. É a regra mais errada na prática '
             || 'das coletivas: nasce junto com o fluxo do FERIAS-060.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Tratamento presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_062()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_062 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o parâmetro de dispensa patronal do Simples é usado no cálculo?';
  r.esperado := 'Provisão distingue Anexo III (sem patronal, mantém FGTS) de Anexo IV (com patronal)';
  v_fns := public.qa_fns_com('%simples_dispensa%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o parâmetro existe (ferias_config.simples_dispensa_patronal), mas '
             || 'NENHUMA função o consome — não há cálculo de encargos de férias que distinga '
             || 'Simples Anexo III (dispensa a contribuição patronal, mantém FGTS) do Anexo IV '
             || '(recolhe). A provisão sai errada para um dos dois grupos. Correção: memória '
             || 'de cálculo dos encargos lendo o enquadramento do cadastro da empresa.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Encargos por enquadramento em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_071()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): programar demais gente do mesmo time gera alerta de cobertura?';
  r.esperado := 'Limite parametrizado (ex.: 20% simultâneos) com alerta informativo — não bloqueio';
  SELECT string_agg(p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%cobertura%'
    AND (p.prosrc ILIKE '%equipe%' OR p.prosrc ILIKE '%departamento%' OR p.prosrc ILIKE '%simultan%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe verificação de cobertura — programar 40% de um departamento '
             || 'no mesmo mês passa sem aviso. É informação de gestão (a época das férias é '
             || 'prerrogativa do empregador, art. 136), então o desenho certo é ALERTA com '
             || 'mapa de calor, nunca bloqueio. Correção: parâmetro de % máximo simultâneo por '
             || 'departamento com alerta na programação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cobertura verificada em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_071()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_071 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_080()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_infra text; v_ferias text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a concessão de férias gera o S-2230 (motivo 15)?';
  r.esperado := 'Cada período de gozo vira um evento de afastamento com datas exatas';
  SELECT string_agg(table_name, ', ') INTO v_infra
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%esocial%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ferias
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%esocial%' AND p.prosrc ILIKE '%ferias%';

  IF v_ferias IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a infraestrutura de eSocial existe (%s) mas é usada só pelos '
             || 'AFASTAMENTOS — nenhuma função liga FÉRIAS ao eSocial: a concessão não gera '
             || 'S-2230 com motivo 15. Sem o evento, o gozo não existe oficialmente para o '
             || 'governo, e folha/FGTS digital desalinham. Correção: aproveitar a '
             || 'infraestrutura existente (esocial_transmissoes) gerando o evento na '
             || 'concessão, um por período de gozo, com validação de datas antes do envio.',
             coalesce(v_infra, 'nenhuma?'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Férias ligadas ao eSocial em: %s.', v_ferias);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_080()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_080 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_081()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_trad text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a transmissão tem anti-duplicidade e tradução de rejeição?';
  r.esperado := 'Reenvio corrigido substitui/retifica (nunca duplica) e a rejeição vira instrução clara';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  v_trad := coalesce(public.qa_fns_com('%rejeic%'), public.qa_fns_com('%rejeitad%esocial%'));

  IF v_unq IS NULL AND v_trad IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: esocial_transmissoes não tem unicidade (o mesmo evento pode ser '
             || 'gravado/enviado duas vezes) e nenhuma função interpreta rejeições — o retorno '
             || 'técnico chega cru e o reenvio é por conta do operador. Duplicidade no eSocial '
             || 'é passivo criado pela própria correção. Correção: chave natural do evento '
             || '(vínculo + tipo + período) + rotina que traduz a rejeição e conduz a '
             || 'retificação, nunca um clone.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; tradução: %s).',
                       coalesce(v_unq, '—'), coalesce(v_trad, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_081()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_081 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_082()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as férias refletem nos eventos de folha (S-1200/S-1210)?';
  r.esperado := 'Rubricas de férias + 1/3 na remuneração e a data REAL do pagamento (prova do D-2)';
  v_fns := coalesce(public.qa_fns_com('%S-1200%'), public.qa_fns_com('%S-1210%'),
                    public.qa_fns_com('%detPgtoFer%'));
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os eventos de folha do eSocial (S-1200 remuneração, S-1210 '
             || 'pagamentos) não existem no banco — o dinheiro das férias, quando pago, não '
             || 'vira declaração. O S-1210 é justamente o que prova a data real do pagamento '
             || '(o D-2 do art. 145) perante o Fisco. Depende do motor de cálculo '
             || '(FERIAS-033) e da ligação com o eSocial (FERIAS-080); os três nascem '
             || 'encadeados.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Reflexo na folha presente: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_082()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_082 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_090()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o desligamento consome os períodos de férias?';
  r.esperado := 'Vencidas integrais (dobro se concessivo vencido) + proporcionais por duodécimos, ambas + 1/3';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%ferias_periodos%'
    AND (p.prosrc ILIKE '%rescis%' OR p.prosrc ILIKE '%deslig%' OR p.prosrc ILIKE '%indeniza%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o desligamento não conversa com os períodos de férias — nenhuma '
             || 'função apura vencidas + proporcionais + 1/3 na rescisão (arts. 146-148; '
             || 'Súmula 171). Colaborador desligado com período vencido sai sem a verba '
             || 'calculada e os períodos ficam abertos para sempre no módulo. Mesma lacuna do '
             || 'banco de horas na rescisão (PONTO-173): a saída do colaborador precisa '
             || 'liquidar os dois. Correção: gatilho de desligamento que fecha os períodos '
             || 'como indenizados, com memória e vínculo ao termo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Liquidação presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_090()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_090 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ferias_091()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(6191);
        v_colidiu boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Abrir o MESMO período aquisitivo do MESMO CPF em duas empresas (dois vínculos)';
  r.esperado := 'Dois relógios independentes — contratos são autônomos entre si';
  INSERT INTO public.ferias_periodos_aquisitivos
    (tenant_id, empresa_id, colaborador_cpf, colaborador_nome, data_admissao,
     aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados, fonte_faltas,
     dias_direito, dias_saldo, faltas_consideradas, status, origem)
  VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), v_cpf, 'QA Dois Vínculos F',
          CURRENT_DATE - 400, CURRENT_DATE - 395, CURRENT_DATE - 30,
          0, 0, 'carga', 30, 30, 0, 'ativo', 'sistema');
  BEGIN
    INSERT INTO public.ferias_periodos_aquisitivos
      (tenant_id, empresa_id, colaborador_cpf, colaborador_nome, data_admissao,
       aquisitivo_inicio, aquisitivo_fim, faltas_carga, dias_gozados, fonte_faltas,
       dias_direito, dias_saldo, faltas_consideradas, status, origem)
    VALUES (public.qa_sandbox_tenant_id(), gen_random_uuid(), v_cpf, 'QA Dois Vínculos F',
            CURRENT_DATE - 400, CURRENT_DATE - 395, CURRENT_DATE - 30,
            0, 0, 'carga', 30, 30, 0, 'ativo', 'sistema');
  EXCEPTION WHEN unique_violation THEN
    v_colidiu := true;
  END;

  IF v_colidiu THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO ESTRUTURAL (mesma raiz do PONTO-394): o período aquisitivo é chaveado '
             || 'por (tenant, CPF, início) — a constraint ferias_periodo_unico ignora a '
             || 'empresa/vínculo, mesmo com a coluna empresa_id existindo na tabela. Dois '
             || 'contratos do mesmo CPF admitidos na mesma época COLIDEM: o segundo vínculo '
             || 'não consegue ter o próprio relógio de férias. Correção: incluir o vínculo na '
             || 'chave (tenant, empresa, CPF, início) e propagar a segregação para programação '
             || 'e solicitações.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Cada vínculo abriu o próprio período — relógios independentes.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ferias_091()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ferias_091 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 46 casos.

-- Férias (46 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('FERIAS-001', 'Fechar o período aquisitivo calcula o direito pelo Ponto', 'feliz', 'critica', 'aprovado', 'Ao completar 12 meses de período aquisitivo, o sistema calcula os dias de direito pela escala do art. 130 usando as faltas injustificadas REAIS do módulo Ponto — com memória de cálculo auditável, sem apuração manual. Com até 5 faltas: 30 dias.', 'Colaborador com período aquisitivo completo e até 5 faltas injustificadas no Ponto.', '[{"acao": "Fechar o período aquisitivo", "ordem": 1, "resultado_esperado": "Direito de 30 dias calculado automaticamente"}, {"acao": "Abrir a memória de cálculo", "ordem": 2, "resultado_esperado": "Faltas consideradas listadas, com vínculo aos dias do Ponto"}]', 'O direito nasce do dado real, com memória auditável.', 'Documento de requisitos: seção 5 e CT-07; integração da seção 6 (Ponto). Requisitos YE-DP-FERIAS-001: RN-001/CA-001/CA-002.', 'api', 'CLT, art. 130 (escala de dias por faltas injustificadas); art. 129 (direito anual)', 'em_triagem', NULL),
    ('FERIAS-002', 'Escala do art. 130 nas quatro faixas e fronteiras', 'alternativo', 'critica', 'aprovado', 'A escala é degrau, não proporção: 6 a 14 faltas = 24 dias; 15 a 23 = 18; 24 a 32 = 12; acima de 32 = perde o direito. As fronteiras (5/6, 14/15, 23/24, 32/33) são onde sistemas erram.', 'Colaboradores de teste com 5, 6, 14, 15, 23, 24, 32 e 33 faltas injustificadas.', '[{"acao": "Fechar o aquisitivo com 5 e com 6 faltas", "ordem": 1, "resultado_esperado": "30 e 24 dias, respectivamente"}, {"acao": "Fechar com 14 e 15 faltas", "ordem": 2, "resultado_esperado": "24 e 18 dias"}, {"acao": "Fechar com 23 e 24 faltas", "ordem": 3, "resultado_esperado": "18 e 12 dias"}, {"acao": "Fechar com 32 e 33 faltas", "ordem": 4, "resultado_esperado": "12 dias e perda do direito"}]', 'Cada fronteira cai no degrau certo da lei.', 'Documento: seção 5. Falta JUSTIFICADA (art. 473, atestado aceito) não entra na contagem — pré-condição herdada de PONTO-024/132. Requisitos YE-DP-FERIAS-001: RN-001/CA-001/CA-002.', 'api', 'CLT, art. 130, I a IV', 'em_triagem', NULL),
    ('FERIAS-003', 'Afastamento longo reinicia o período aquisitivo', 'excecao', 'alta', 'aprovado', 'Benefício previdenciário por mais de 6 meses (ainda que descontínuos), licença remunerada acima de 30 dias e as demais hipóteses do art. 133 zeram o aquisitivo. O recálculo deve vir do módulo Afastamentos, com a origem registrada.', 'Colaborador com afastamento previdenciário de 7 meses no módulo Afastamentos.', '[{"acao": "Encerrar o afastamento e reprocessar o período aquisitivo", "ordem": 1, "resultado_esperado": "Nova data-base a partir do retorno, com a origem do recálculo registrada"}, {"acao": "Conferir o saldo anterior", "ordem": 2, "resultado_esperado": "Direito do período interrompido tratado conforme o art. 133 (perda), sem sumir silenciosamente — o motivo fica visível"}]', 'O reinício é automático, rastreável e explicado.', 'Documento: seção 5 e CT-08; integração da seção 6 (Afastamentos). Requisitos YE-DP-AFAST-001: o lado AFASTAMENTOS (registro, efeito e reflexo) está em AFAST-010..080.', 'api', 'CLT, art. 133, IV (benefício previdenciário por mais de 6 meses) e demais incisos', 'em_triagem', NULL),
    ('FERIAS-004', 'Dois períodos aquisitivos em aberto: baixa o mais antigo primeiro', 'excecao', 'alta', 'aprovado', 'Acúmulo de períodos é a antessala do passivo: o sistema deve priorizar a baixa do período mais antigo em toda programação e sinalizar o acúmulo ao RH — programar contra o período novo deixando o velho vencer é o erro mais caro possível.', 'Colaborador com dois períodos aquisitivos vencidos e não gozados.', '[{"acao": "Programar 15 dias de férias", "ordem": 1, "resultado_esperado": "Baixa aplicada ao período MAIS ANTIGO, com o acúmulo sinalizado"}, {"acao": "Tentar direcionar a baixa ao período mais novo", "ordem": 2, "resultado_esperado": "Recusado ou exigindo justificativa registrada — o antigo dobra primeiro"}]', 'A ordem de baixa protege do pagamento em dobro.', 'Documento: CT-17.', 'api', 'CLT, arts. 134 e 137 (o período mais antigo é o que dobra primeiro)', 'em_triagem', NULL),
    ('FERIAS-005', 'Ausência amparada por lei não reduz o saldo de férias', 'excecao', 'alta', 'aprovado', 'A escala do art. 130 conta só faltas INJUSTIFICADAS. Atestado, licença-maternidade, acidente de trabalho, ausências do art. 473 — nada disso entra na contagem que reduz os 30 dias. Um sistema que soma tudo corta férias de quem adoeceu.', 'Colaborador com 8 ausências no aquisitivo: 6 amparadas por atestado + 2 injustificadas.', '[{"acao": "Apurar o saldo do período com as 8 ausências (6 justificadas, 2 não)", "ordem": 1, "resultado_esperado": "Contam APENAS as 2 injustificadas → direito integral de 30 dias"}, {"acao": "Conferir a memória da apuração", "ordem": 2, "resultado_esperado": "As ausências amparadas listadas como não computáveis, com o amparo de cada uma"}]', 'Só falta injustificada morde o saldo.', 'Requisitos YE-DP-FERIAS-001: RN-001 / art. 131. Par do PONTO-024 (amparada não vira falta) — aqui o efeito é no SALDO de férias, via fonte_faltas.', 'api', 'CLT, art. 131 (hipóteses que não são falta); art. 130', 'em_triagem', NULL),
    ('FERIAS-006', 'Faltas não podem ser descontadas dos dias de gozo', 'negativo', 'alta', 'aprovado', 'É vedado descontar as faltas do período de férias: a punição da falta é a REDUÇÃO DA FAIXA (30→24→18...), nunca o abatimento um-a-um dos dias de gozo. Sistema que faz "30 dias menos 8 faltas = 22" aplica um desconto que a lei proíbe expressamente.', 'Colaborador com 8 faltas injustificadas (faixa de 24 dias).', '[{"acao": "Apurar o direito com 8 faltas", "ordem": 1, "resultado_esperado": "24 dias (faixa do art. 130), NUNCA 22 (30 - 8)"}, {"acao": "Tentar registrar desconto adicional de dias de gozo por causa das faltas", "ordem": 2, "resultado_esperado": "Recusado — a faixa já é a única consequência legal"}]', 'Falta muda a faixa; não vira subtração de dias.', 'Requisitos YE-DP-FERIAS-001: base legal art. 130, §1º. Complementa FERIAS-001/002 (a escala em si).', 'api', 'CLT, art. 130, §1º', 'em_triagem', NULL),
    ('FERIAS-007', 'Tempo parcial segue a tabela geral (art. 130-A revogado)', 'alternativo', 'media', 'aprovado', 'Antes da reforma, o tempo parcial tinha tabela própria (máx. 18 dias). Desde 2017, contrato a tempo parcial usa a MESMA escala do art. 130 (30 dias com até 5 faltas). Sistema que aplicar a tabela antiga corta férias com regra revogada — mesmo padrão da trava etária (FERIAS-015).', 'Colaborador com contrato de tempo parcial (25h semanais), sem faltas.', '[{"acao": "Apurar o direito do contrato a tempo parcial sem faltas", "ordem": 1, "resultado_esperado": "30 dias — a tabela geral, não os 18 da regra revogada"}, {"acao": "AUDITORIA: procurar resquício da tabela do 130-A nas funções de férias", "ordem": 2, "resultado_esperado": "Nenhum — dispositivo revogado não pode estar no código"}]', 'Tempo parcial, férias inteiras.', 'Requisitos YE-DP-FERIAS-001: base legal (linha do art. 130-A). Guarda-corpo contra regra revogada, como FERIAS-015.', 'api', 'CLT, art. 130-A (REVOGADO pela Lei 13.467/2017); art. 58-A, §7º', 'em_triagem', NULL),
    ('FERIAS-008', 'Prescrição: o relógio corre do fim do concessivo', 'excecao', 'media', 'aprovado', 'O prazo para reclamar férias conta do FIM DO PERÍODO CONCESSIVO (ou da rescisão), não do aquisitivo: 5 anos na vigência do contrato, 2 após a extinção. O sistema deve calcular o marco por período e alertar — período prescrito é passivo que virou perda definitiva do trabalhador e prova de desorganização da empresa.', 'Período com concessivo encerrado há mais de 4 anos, não gozado nem pago.', '[{"acao": "Consultar o período antigo", "ordem": 1, "resultado_esperado": "Marco prescricional calculado (fim do concessivo + 5 anos) e exibido"}, {"acao": "Aproximar-se do marco", "ordem": 2, "resultado_esperado": "Alerta a RH/Jurídico antes da consumação, com o valor em risco"}]', 'Cada período com seu marco de prescrição visível.', 'Requisitos YE-DP-FERIAS-001: base legal CF 7º XXIX / art. 149.', 'api', 'CF, art. 7º, XXIX; CLT, art. 149', 'em_triagem', NULL),
    ('FERIAS-010', 'Fracionar em 14 + 11 + 5 com concordância registrada', 'feliz', 'critica', 'aprovado', 'O fracionamento legal exige três coisas juntas: no máximo 3 períodos, um deles com pelo menos 14 dias corridos, os demais com pelo menos 5 — e a concordância do empregado registrada. A composição válida grava com a evidência da concordância.', 'Colaborador com direito integral de 30 dias.', '[{"acao": "Programar P1=14, P2=11, P3=5 com o aceite do colaborador", "ordem": 1, "resultado_esperado": "Programação aceita"}, {"acao": "Conferir o registro", "ordem": 2, "resultado_esperado": "Concordância do empregado gravada com data e identificação"}]', 'Composição válida entra, com a concordância como evidência.', 'Documento: seção 5 e CT-03.', 'api', 'CLT, art. 134, §1º (até 3 períodos; um ≥ 14 dias; demais ≥ 5 dias; concordância do empregado)', 'em_triagem', NULL),
    ('FERIAS-011', 'Fracionamento sem período de 14 dias é bloqueado', 'negativo', 'critica', 'aprovado', '10+10+10 soma 30, mas nenhum período atinge os 14 dias corridos exigidos — a soma certa não salva a composição errada.', 'Colaborador com direito integral.', '[{"acao": "Programar P1=10, P2=10, P3=10", "ordem": 1, "resultado_esperado": "Bloqueado, com mensagem apontando a exigência do período de 14 dias"}]', 'Sem um período de 14, não grava.', 'Documento: CT-02. Requisitos YE-DP-FERIAS-001: RN-004/CA-003 (fracionamento) — a concordância do empregado agora tem caso próprio de composição válida (FERIAS-010).', 'api', 'CLT, art. 134, §1º', 'em_triagem', NULL),
    ('FERIAS-012', 'Terceiro período menor que 5 dias é bloqueado', 'negativo', 'critica', 'aprovado', '20+7+3: o primeiro cumpre os 14, mas o terceiro tem 3 dias — abaixo do piso de 5 dias corridos de qualquer período.', 'Colaborador com direito integral.', '[{"acao": "Programar P1=20, P2=7, P3=3", "ordem": 1, "resultado_esperado": "Bloqueado, apontando o período inferior a 5 dias"}, {"acao": "Tentar um quarto período (7+7+8+8)", "ordem": 2, "resultado_esperado": "Bloqueado — máximo de 3 períodos"}]', 'Piso de 5 por período e teto de 3 períodos.', 'Documento: CT-04. Requisitos YE-DP-FERIAS-001: RN-004/CA-003 (fracionamento) — a concordância do empregado agora tem caso próprio de composição válida (FERIAS-010).', 'api', 'CLT, art. 134, §1º', 'em_triagem', NULL),
    ('FERIAS-013', 'Programar mais dias do que o saldo é bloqueado', 'negativo', 'critica', 'aprovado', 'Solicitar 42 dias com saldo de 30 não é arredondável: bloqueio com mensagem que informe o saldo disponível e o período aquisitivo correspondente.', 'Colaborador com saldo de 30 dias.', '[{"acao": "Solicitar 42 dias", "ordem": 1, "resultado_esperado": "Bloqueado, com o saldo disponível e o período aquisitivo na mensagem"}]', 'Saldo é limite duro.', 'Documento: CT-01.', 'api', 'CLT, arts. 129 e 130 (o direito é o teto)', 'em_triagem', NULL),
    ('FERIAS-014', 'Início nos 2 dias antes de feriado ou repouso é bloqueado', 'negativo', 'critica', 'aprovado', 'É vedado iniciar férias nos 2 dias que antecedem feriado ou DSR. Sexta-feira com repouso no domingo: bloqueada, com sugestão da data válida mais próxima — considerando o calendário de feriados DA UNIDADE (RN22), inclusive o municipal.', 'Colaborador com DSR aos domingos; feriado municipal cadastrado na tabela da unidade.', '[{"acao": "Programar início numa sexta-feira", "ordem": 1, "resultado_esperado": "Bloqueado, com sugestão da segunda-feira seguinte"}, {"acao": "Programar início na véspera do feriado municipal da unidade", "ordem": 2, "resultado_esperado": "Bloqueado — o calendário considerado é o da unidade"}, {"acao": "Programar na véspera do mesmo feriado para colaborador de OUTRA unidade (sem esse feriado)", "ordem": 3, "resultado_esperado": "Aceito — o feriado não vale lá"}]', 'A vedação usa o calendário certo de cada unidade.', 'Documento: seção 5, CT-05 e CT-06; depende da fonte única de feriados (RN22, família FER-/PONTO-131). Requisitos YE-DP-FERIAS-001: RN-005/CA-004.', 'api', 'CLT, art. 134, §3º', 'em_triagem', NULL),
    ('FERIAS-015', 'Sem trava etária: menor de 18 e maior de 50 fracionam', 'excecao', 'media', 'aprovado', 'A antiga obrigação de gozo em período único para menores de 18 e maiores de 50 anos foi REVOGADA. Sistema que ainda aplica a trava (erro comum em legados) está bloqueando direito que a lei devolveu.', 'Colaboradores de 17 e de 55 anos com direito integral.', '[{"acao": "Fracionar as férias dos dois em 14+11+5 com concordância", "ordem": 1, "resultado_esperado": "Aceito para ambos — nenhuma trava por idade"}]', 'A trava revogada não existe no sistema.', 'Documento: seção 5 (último item). Caso de proteção contra "conformidade fantasma".', 'api', 'Lei 13.467/2017 (revogação do art. 134, §2º da CLT)', 'em_triagem', NULL),
    ('FERIAS-016', 'Estudante menor de 18: coincidência com férias escolares', 'alternativo', 'media', 'aprovado', 'O empregado estudante menor de 18 anos tem direito a fazer coincidir as férias com as férias escolares. O sistema deve sinalizar o colaborador e restringir/alertar a janela de programação.', 'Colaborador de 17 anos marcado como estudante.', '[{"acao": "Programar férias fora do período de férias escolares", "ordem": 1, "resultado_esperado": "Alerta exigindo aceite justificado — a coincidência é direito do estudante"}]', 'O direito do estudante aparece na programação.', 'Documento: seção 5. O art. 136, §1º (familiares no mesmo estabelecimento) é informativo — sugerir períodos coincidentes, sem caso próprio.', 'api', 'CLT, art. 136, §2º', 'em_triagem', NULL),
    ('FERIAS-017', 'Familiares na mesma empresa podem tirar férias juntos', 'alternativo', 'baixa', 'aprovado', 'Membros da mesma família que trabalhem na mesma empresa têm direito a férias no mesmo período, se quiserem e se não prejudicar o serviço. O sistema deve reconhecer o vínculo familiar e facilitar a coincidência na programação (informativo, não bloqueante — a época segue sendo do empregador).', 'Dois colaboradores da mesma empresa marcados como familiares (cônjuges).', '[{"acao": "Programar férias de um dos familiares", "ordem": 1, "resultado_esperado": "Sistema aponta a preferência legal de coincidência com o familiar"}, {"acao": "Programar o segundo em período coincidente", "ordem": 2, "resultado_esperado": "Aceito sem atrito; a coincidência fica registrada como atendida"}]', 'A preferência familiar aparece na programação.', 'Requisitos YE-DP-FERIAS-001: art. 136, §1º (seção 4). Depende de vínculo familiar no cadastro.', 'api', 'CLT, art. 136, §1º', 'em_triagem', NULL),
    ('FERIAS-020', 'Programação além do limite concessivo exige diretoria e mostra a dobra', 'negativo', 'critica', 'aprovado', 'As férias devem ser concedidas nos 12 meses seguintes ao fim do aquisitivo. Programar além disso só com justificativa de alçada de diretoria — e com o CUSTO DA DOBRA exibido antes da decisão, porque é isso que a empresa está assinando.', 'Colaborador com limite concessivo a vencer em 20 dias e programação proposta para depois dele.', '[{"acao": "Programar início após o limite concessivo", "ordem": 1, "resultado_esperado": "Bloqueado para perfis comuns"}, {"acao": "Autorizar com alçada de diretoria", "ordem": 2, "resultado_esperado": "Grava com justificativa registrada e o valor da dobra exibido"}]', 'Estourar o prazo é decisão informada de diretoria, nunca acidente.', 'Documento: seção 5 e CT-09. Requisitos YE-DP-FERIAS-001: RN-003/RN-006/CA-009 — a Súmula 81 (dobro só dos dias excedentes) ganhou o caso FERIAS-022.', 'api', 'CLT, art. 134, caput (concessão nos 12 meses seguintes) e art. 137 (dobra)', 'em_triagem', NULL),
    ('FERIAS-021', 'Prazo vencido: o dobro aparece sozinho no painel', 'excecao', 'alta', 'aprovado', 'No dia seguinte ao vencimento do limite concessivo, o painel financeiro passa a exibir o valor em dobro — automaticamente, sem depender de alguém lembrar. O passivo visível é o que dispara a gestão.', 'Colaborador com limite concessivo vencido ontem.', '[{"acao": "Abrir o painel financeiro", "ordem": 1, "resultado_esperado": "Valor em dobro calculado e exibido para o período vencido"}, {"acao": "Conferir o alerta de vencimento", "ordem": 2, "resultado_esperado": "Ativo desde D-45, com trilha do que foi (ou não foi) feito"}]', 'Dobra vencida é passivo exposto, não surpresa de fiscalização.', 'Documento: seção 5 (informativo) e 7. Requisitos YE-DP-FERIAS-001: RN-003/RN-006/CA-009 — a Súmula 81 (dobro só dos dias excedentes) ganhou o caso FERIAS-022.', 'api', 'CLT, art. 137 (pagamento em dobro da remuneração das férias concedidas após o prazo)', 'em_triagem', NULL),
    ('FERIAS-022', 'A dobra incide só sobre os dias excedentes ao concessivo', 'alternativo', 'alta', 'aprovado', 'Se PARTE do gozo cabe dentro do concessivo e parte fica de fora, a dobra alcança apenas os dias gozados APÓS o vencimento — não o período inteiro. Dobrar tudo superestima o passivo; não dobrar nada o esconde. A Súmula 81 fixa o corte exato.', 'Concessivo vencendo em 10 dias; férias de 30 dias iniciando 5 dias antes do vencimento.', '[{"acao": "Calcular férias que atravessam o vencimento do concessivo (5 dias dentro, 25 fora)", "ordem": 1, "resultado_esperado": "Dobra sobre os 25 dias excedentes; os 5 dentro do prazo saem simples"}, {"acao": "Conferir a memória de cálculo", "ordem": 2, "resultado_esperado": "O corte no vencimento demonstrado dia a dia"}]', 'Dobra cirúrgica: só o que passou do prazo.', 'Requisitos YE-DP-FERIAS-001: RN-006 / CA-009 (Súmula 81). Refina FERIAS-020/021, que tratam o vencimento integral.', 'api', 'CLT, art. 137; Súmula 81 do TST', 'em_triagem', NULL),
    ('FERIAS-024', 'Afastamento sobreposto às férias suspende e reprograma', 'excecao', 'alta', 'aprovado', 'Colaborador afastado (ex.: auxílio-doença) na véspera ou durante as férias não está gozando férias — os dois institutos não coexistem. O sistema deve detectar a sobreposição, suspender o gozo, devolver os dias não usufruídos e reprogramar, recalculando pagamento e eSocial.', 'Férias aprovadas de 30 dias; afastamento por doença inicia no 10º dia do gozo.', '[{"acao": "Registrar o afastamento no meio das férias", "ordem": 1, "resultado_esperado": "Sobreposição detectada; os 20 dias restantes voltam ao saldo"}, {"acao": "Conferir estado e integrações", "ordem": 2, "resultado_esperado": "Gozo interrompido com evidência; recálculo sinalizado; eSocial de férias ajustado"}]', 'Doença não consome férias.', 'Requisitos YE-DP-FERIAS-001: fluxo alternativo "Afastamento durante/antes das férias" (seção 9). Conversa com FERIAS-053 (ponte com Afastamentos).', 'api', 'CLT, arts. 476 (auxílio-doença suspende) e 131; jurisprudência sobre sobreposição', 'em_triagem', NULL),
    ('FERIAS-030', 'Aviso por escrito 30 dias antes, com contagem regressiva', 'feliz', 'critica', 'aprovado', 'Cada período aprovado dispara o relógio do aviso: alerta ao RH em D-45 e emissão do aviso com 30 dias de antecedência, com recibo de ciência do colaborador (assinatura via módulo de Documentos).', 'Período de férias aprovado com início em 40 dias.', '[{"acao": "Emitir o aviso de férias", "ordem": 1, "resultado_esperado": "Documento gerado com os dados do período e enviado à assinatura"}, {"acao": "Colaborador dá ciência", "ordem": 2, "resultado_esperado": "Ciência registrada com data — evidência para fiscalização"}]', 'O aviso sai no prazo e deixa evidência.', 'Documento: seções 5 e 8; integração com Governança/Documentos. Requisitos YE-DP-FERIAS-001: CA-005/CA-008/RN-009 — as médias do art. 142 e as incidências (Tema 985) ganharam casos próprios (FERIAS-033/034).', 'api', 'CLT, art. 135 (participação por escrito com antecedência mínima de 30 dias)', 'em_triagem', NULL),
    ('FERIAS-031', 'Aprovar com início em menos de 30 dias exige justificativa', 'negativo', 'alta', 'aprovado', 'Início em 20 dias significa aviso fora do prazo legal. O status Aprovado deve ser travado sem aviso emitido em prazo hábil — a exceção só passa com alerta aceito e justificativa registrada.', 'Solicitação com início em 20 dias, sem aviso emitido.', '[{"acao": "Tentar aprovar", "ordem": 1, "resultado_esperado": "Alerta de aviso fora do prazo; aprovação só com justificativa registrada em trilha"}]', 'Prazo de aviso curto nunca passa em silêncio.', 'Documento: seção 5 e CT-12. Requisitos YE-DP-FERIAS-001: CA-005/CA-008/RN-009 — as médias do art. 142 e as incidências (Tema 985) ganharam casos próprios (FERIAS-033/034).', 'api', 'CLT, art. 135', 'em_triagem', NULL),
    ('FERIAS-032', 'Pagamento até D-2 com terço constitucional automático', 'feliz', 'critica', 'aprovado', 'A aprovação gera a obrigação financeira com vencimento em D-2 do início, alertando a tesouraria. O terço constitucional é aplicado automaticamente em TODOS os cálculos — inclusive sobre o abono pecuniário.', 'Período aprovado com remuneração base conhecida e abono requerido.', '[{"acao": "Aprovar o período", "ordem": 1, "resultado_esperado": "Obrigação financeira criada com vencimento em D-2"}, {"acao": "Conferir o cálculo", "ordem": 2, "resultado_esperado": "Terço aplicado sobre a remuneração de férias E sobre o abono"}, {"acao": "Chegar a D-2 sem baixa de pagamento", "ordem": 3, "resultado_esperado": "Alerta à tesouraria — pagamento fora do prazo gera dobra (Súmula 450 do TST)"}]', 'O dinheiro certo, na data certa, com o terço sempre dentro.', 'Documento: seções 5 e 7. Requisitos YE-DP-FERIAS-001: CA-005/CA-008/RN-009 — as médias do art. 142 e as incidências (Tema 985) ganharam casos próprios (FERIAS-033/034).', 'api', 'CLT, art. 145 (pagamento até 2 dias antes do início); CF/88, art. 7º, XVII (terço)', 'em_triagem', NULL),
    ('FERIAS-033', 'Cálculo com médias das variáveis e memória auditável', 'feliz', 'alta', 'aprovado', 'Quem recebe variáveis (horas extras, adicional noturno, comissões) leva a MÉDIA para as férias — salário fixo puro é só o começo. A base é parametrizável por rubrica, a conta gera memória reproduzível, e rubrica variável faltante ALERTA antes de fechar (não fecha com base incompleta em silêncio).', 'Colaborador com salário fixo + horas extras habituais nos últimos 12 meses.', '[{"acao": "Calcular as férias do comissionado/horista", "ordem": 1, "resultado_esperado": "Remuneração = salário da época + média das variáveis + 1/3, com memória"}, {"acao": "Recalcular com os mesmos insumos", "ordem": 2, "resultado_esperado": "Mesmo resultado — determinístico"}, {"acao": "Calcular com rubrica variável faltando na base", "ordem": 3, "resultado_esperado": "Alerta para completar a base ANTES de fechar"}]', 'Média certa, memória aberta, base incompleta não fecha calada.', 'Requisitos YE-DP-FERIAS-001: RN-007 / CA-006 / RNF-001 / cenário "Dado ausente". A composição da base é [VAL] por cliente (seção 30).', 'api', 'CLT, art. 142 e §§; CF, art. 7º, XVII', 'em_triagem', NULL),
    ('FERIAS-034', 'Incidências: férias gozadas tributam; abono é indenizatório', 'alternativo', 'alta', 'aprovado', 'Duas naturezas na mesma folha de férias: férias gozadas + 1/3 sofrem INSS/FGTS/IRRF (o terço inclusive na patronal, pelo Tema 985, observada a modulação); abono pecuniário + seu 1/3 são indenizatórios — não incidem. Misturar as naturezas erra encargo para os dois lados.', 'Cálculo com 20 dias gozados + 10 de abono.', '[{"acao": "Apurar encargos do cálculo misto (gozo + abono)", "ordem": 1, "resultado_esperado": "Incidências sobre gozo + 1/3; abono + 1/3 fora da base"}, {"acao": "Conferir a memória de encargos", "ordem": 2, "resultado_esperado": "Cada rubrica com sua natureza (tributável × indenizatória) explicitada"}]', 'Cada verba com sua natureza — nem tributo a mais, nem a menos.', 'Requisitos YE-DP-FERIAS-001: RN-010 / art. 144 / Tema 985 ([VAL] contábil — modulação 15/09/2020).', 'api', 'CLT, art. 144; STF, Tema 985 (RE 1.072.485); legislação de INSS/FGTS/IRRF', 'em_triagem', NULL),
    ('FERIAS-035', 'Adiantamento da 1ª parcela do 13º integra o pagamento', 'alternativo', 'media', 'aprovado', 'O empregado que requer em janeiro tem direito de receber a 1ª parcela do 13º junto com as férias. O campo de opção já existe na programação (adiantar_13); o caso garante que a opção produz efeito: o valor entra no pagamento das férias e baixa na apuração do 13º de novembro.', 'Programação com adiantar_13 = true, requerida no prazo.', '[{"acao": "Calcular o pagamento com a opção de adiantamento marcada", "ordem": 1, "resultado_esperado": "1ª parcela do 13º somada ao líquido das férias, destacada"}, {"acao": "Conferir a apuração do 13º no fim do ano", "ordem": 2, "resultado_esperado": "Adiantamento abatido — sem pagamento em duplicidade"}]', 'Opção marcada, valor pago, baixa registrada.', 'Requisitos YE-DP-FERIAS-001: RF-005 / seção 30 (política de adiantamento é [DAE]). O campo adiantar_13 existe; o efeito é o que se testa. Requisitos YE-DP-13-001: o lado 13º do adiantamento nas férias ganhou caso próprio (DEC13-032 — baixa na apuração e dedução na 2ª parcela).', 'api', 'Lei 4.749/1965, art. 2º, §2º (adiantamento por ocasião das férias)', 'em_triagem', NULL),
    ('FERIAS-040', 'Abono de 1/3 requerido no prazo', 'feliz', 'alta', 'aprovado', 'O colaborador converte até 1/3 do direito em abono (10 dias num direito de 30), desde que requeira até 15 dias antes do término do período aquisitivo. Os dias vendidos saem do saldo de gozo e entram no cálculo financeiro com o terço.', 'Colaborador com direito de 30 dias, a 30 dias do fim do aquisitivo.', '[{"acao": "Requerer abono de 10 dias", "ordem": 1, "resultado_esperado": "Aceito; saldo de gozo passa a 20 dias"}, {"acao": "Conferir o financeiro", "ordem": 2, "resultado_esperado": "Abono com terço no cálculo (FERIAS-032)"}]', 'Abono no prazo entra e ajusta saldo e cálculo.', 'Documento: seção 5. Requisitos YE-DP-FERIAS-001: RN-008/CA-007.', 'api', 'CLT, art. 143 e §1º (abono de até 1/3, requerido até 15 dias antes do fim do aquisitivo)', 'em_triagem', NULL),
    ('FERIAS-041', 'Abono acima de 1/3 é bloqueado', 'negativo', 'alta', 'aprovado', 'Num direito de 30 dias, o abono máximo é 10. Pedir 15 é bloqueado — e em direito reduzido pelo art. 130 (ex.: 24 dias), o teto acompanha (8 dias).', 'Colaboradores com direitos de 30 e de 24 dias.', '[{"acao": "Requerer 15 dias de abono no direito de 30", "ordem": 1, "resultado_esperado": "Bloqueado — limite de 10"}, {"acao": "Requerer 9 dias no direito de 24", "ordem": 2, "resultado_esperado": "Bloqueado — limite de 8 (1/3 do direito real)"}]', 'O terço vendável é do direito real, não do ideal.', 'Documento: CT-11. Requisitos YE-DP-FERIAS-001: RN-008/CA-007.', 'api', 'CLT, art. 143 (limite de 1/3)', 'em_triagem', NULL),
    ('FERIAS-042', 'Abono fora do prazo de 15 dias fica indisponível', 'negativo', 'media', 'aprovado', 'A 10 dias do fim do período aquisitivo, o prazo legal do requerimento (15 dias antes) já passou: a opção deve estar indisponível, com mensagem explicando o prazo — não um erro genérico depois de preenchido.', 'Colaborador a 10 dias do fim do aquisitivo.', '[{"acao": "Tentar requerer o abono", "ordem": 1, "resultado_esperado": "Opção indisponível, com a explicação do prazo de 15 dias"}]', 'Prazo vencido se explica, não se descobre no erro.', 'Documento: CT-10. Requisitos YE-DP-FERIAS-001: RN-008/CA-007.', 'api', 'CLT, art. 143, §1º', 'em_triagem', NULL),
    ('FERIAS-050', 'O ciclo completo: de Sugerido a Concluído, cada estado com seu efeito', 'feliz', 'alta', 'aprovado', 'Cada estado do ciclo (Sugerido → Planejado → Confirmado → Ciente → Solicitado → Aprovado → Em gozo → Concluído) tem efeito próprio: Sugerido entra só em provisão; Planejado sensibiliza desembolso; Solicitado dispara o relógio do aviso; Aprovado habilita documentos e financeiro; Concluído baixa o saldo e arquiva evidências.', 'Colaborador com direito integral; plano anual em montagem.', '[{"acao": "Percorrer o ciclo inteiro de um período", "ordem": 1, "resultado_esperado": "Cada transição registrada, com o efeito do estado aplicado (indicadores, relógios, documentos)"}, {"acao": "Concluir o período", "ordem": 2, "resultado_esperado": "Saldo baixado, evidências arquivadas, evento de eSocial conciliado"}]', 'O estado dirige o comportamento — nada acontece fora dele.', 'Documento: seção 4.2.', 'api', 'CLT, arts. 134, 135, 145 (os marcos que os estados materializam)', 'em_triagem', NULL),
    ('FERIAS-051', 'Cancelar período aprovado devolve tudo e deixa trilha', 'excecao', 'alta', 'aprovado', 'Cancelamento exige motivo e produz três efeitos: os dias voltam ao saldo, o alerta de vencimento do concessivo REABRE (o risco voltou), e a trilha registra quem, quando e por quê.', 'Período aprovado com aviso emitido.', '[{"acao": "Cancelar com motivo", "ordem": 1, "resultado_esperado": "Dias devolvidos ao saldo"}, {"acao": "Conferir alertas", "ordem": 2, "resultado_esperado": "Alerta de vencimento reaberto"}, {"acao": "Conferir a trilha", "ordem": 3, "resultado_esperado": "Cancelamento registrado com autor, data e motivo"}]', 'Cancelar desfaz o gozo, nunca o rastro.', 'Documento: seção 4.2 e CT-16.', 'api', 'CLT, art. 134 (o direito permanece devido)', 'em_triagem', NULL),
    ('FERIAS-052', 'Data confirmada só muda com justificativa', 'negativo', 'media', 'aprovado', 'A partir do estado Confirmado, a data é compromisso: alteração exige justificativa registrada em trilha de auditoria. Mudança silenciosa de data confirmada é a origem clássica de conflito trabalhista.', 'Período em estado Confirmado.', '[{"acao": "Alterar a data sem justificativa", "ordem": 1, "resultado_esperado": "Recusado"}, {"acao": "Alterar com justificativa", "ordem": 2, "resultado_esperado": "Aceito e registrado na trilha"}]', 'Confirmado é compromisso auditável.', 'Documento: seção 4.2.', 'api', 'CLT, art. 135 (o empregado se organiza em cima da data comunicada)', 'em_triagem', NULL),
    ('FERIAS-053', 'Em gozo bloqueia o ponto e conversa com Afastamentos', 'excecao', 'alta', 'aprovado', 'Durante o gozo, marcação de ponto é recusada com mensagem clara (espelho de PONTO-025) e o período integra com Afastamentos — o dia aparece justificado na apuração (CT-007 do Ponto), sem falta e sem saldo negativo.', 'Colaborador em gozo de férias.', '[{"acao": "Tentar marcar ponto durante o gozo", "ordem": 1, "resultado_esperado": "Recusado com mensagem explicativa, nada gravado"}, {"acao": "Apurar os dias do gozo", "ordem": 2, "resultado_esperado": "Dias justificados, saldo zero, sem falta e sem alerta"}]', 'Férias e ponto não se atropelam.', 'Documento: seções 4.2 e 6; casa com PONTO-024/025.', 'api', 'CLT, art. 130 c/c art. 74 (férias não é dia de trabalho)', 'em_triagem', NULL),
    ('FERIAS-054', 'Cálculo fechado só reabre com dupla aprovação e diferença', 'excecao', 'alta', 'aprovado', 'Erro descoberto depois do fechamento não se corrige por cima: reabertura com motivo, DUPLA aprovação, recálculo e geração de diferença/estorno — preservando a versão anterior e a trilha. Editar cálculo pago silenciosamente é reescrever recibo que o colaborador já assinou.', 'Cálculo de férias fechado e pago, com erro de média descoberto depois.', '[{"acao": "Tentar editar diretamente o cálculo fechado", "ordem": 1, "resultado_esperado": "Bloqueado"}, {"acao": "Reabrir formalmente com motivo e duas aprovações", "ordem": 2, "resultado_esperado": "Reaberto; recálculo gera a DIFERENÇA (a pagar/estornar), nunca substitui o histórico"}, {"acao": "Conferir a trilha", "ordem": 3, "resultado_esperado": "Versões, aprovadores, motivo e diferença registrados"}]', 'Fechado não se edita: reabre-se com rito e diferença.', 'Requisitos YE-DP-FERIAS-001: RF-010 / cenário "Alteração retroativa". Espelha PONTO-358 (reabertura de competência).', 'api', 'Princípio da imutabilidade do documento entregue; boa prática de auditoria (documento YE)', 'em_triagem', NULL),
    ('FERIAS-055', 'Aviso sem ciência do colaborador não conclui a concessão', 'negativo', 'alta', 'aprovado', 'O aviso de férias vale com a CIÊNCIA do colaborador (recibo/assinatura). Concessão que avança com aviso apenas "emitido" deixa a empresa sem a prova central do art. 135. O fluxo deve travar (ou exigir tratamento formal da recusa) enquanto a ciência não vier.', 'Férias aprovadas com aviso emitido e não assinado.', '[{"acao": "Tentar concluir a concessão com o aviso pendente de ciência", "ordem": 1, "resultado_esperado": "Não conclui; alerta ao responsável"}, {"acao": "Colher a ciência (ou registrar recusa formal) e concluir", "ordem": 2, "resultado_esperado": "Concessão conclui com a evidência anexada"}]', 'Aviso emitido não basta; aviso CIENTE conclui.', 'Requisitos YE-DP-FERIAS-001: cenário "Documento inválido" (seção 25). Par do PONTO-387 (espelho sem assinatura).', 'e2e', 'CLT, art. 135 (comunicação mediante recibo)', 'em_triagem', NULL),
    ('FERIAS-056', 'Ninguém aprova as próprias férias', 'negativo', 'alta', 'aprovado', 'O colaborador solicita; gestor/DP aprovam. Um gestor que também é colaborador não pode aprovar a PRÓPRIA solicitação — mesma segregação já exigida no ajuste de ponto (PONTO-252). Sem a trava, o aprovador escolhe as próprias datas e valores sem contrapeso.', 'Gestor com solicitação de férias própria pendente.', '[{"acao": "Tentar aprovar a própria solicitação", "ordem": 1, "resultado_esperado": "Recusado — outro aprovador competente deve analisar"}, {"acao": "AUDITORIA: procurar aprovações onde aprovador = solicitante", "ordem": 2, "resultado_esperado": "Nenhuma"}]', 'Quem pede não aprova.', 'Requisitos YE-DP-FERIAS-001: cenário "Permissões insuficientes" (seção 25) / matriz da seção 6. Espelha PONTO-252.', 'api', 'Segregação de funções (boa prática de controle; matriz de perfis do documento YE)', 'em_triagem', NULL),
    ('FERIAS-060', 'Coletivas: até 2 períodos de no mínimo 10 dias, com comunicações', 'feliz', 'media', 'aprovado', 'Férias coletivas podem ser concedidas em até 2 períodos anuais, nenhum inferior a 10 dias corridos, com comunicação ao órgão do Ministério do Trabalho e ao sindicato com 15 dias de antecedência — e comunicação aos empregados. O fluxo próprio gera os comunicados.', 'Setor selecionado para coletivas em janeiro (12 dias).', '[{"acao": "Programar as coletivas do setor", "ordem": 1, "resultado_esperado": "Período aceito e comunicados gerados com 15 dias de antecedência"}, {"acao": "Conferir colaborador com menos de 12 meses de casa", "ordem": 2, "resultado_esperado": "Férias proporcionais concedidas e novo período aquisitivo iniciado (art. 140)"}]', 'Coletivas com rito completo, inclusive para os novatos.', 'Documento: seção 5. Requisitos YE-DP-FERIAS-001: RN-011/CA-010 — o caso dos contratados há menos de 12 meses (art. 140) é o FERIAS-062.', 'api', 'CLT, arts. 139 a 141', 'em_triagem', NULL),
    ('FERIAS-061', 'Coletiva com período menor que 10 dias é bloqueada', 'negativo', 'media', 'aprovado', 'Período coletivo de 8 dias viola o mínimo legal de 10 dias corridos; terceiro período coletivo no ano viola o máximo de 2.', 'Setor com um período coletivo já concedido no ano.', '[{"acao": "Programar coletiva de 8 dias", "ordem": 1, "resultado_esperado": "Bloqueado — mínimo de 10 dias corridos"}, {"acao": "Programar um terceiro período no mesmo ano", "ordem": 2, "resultado_esperado": "Bloqueado — máximo de 2 períodos anuais"}]', 'Os limites das coletivas valem no cadastro.', 'Documento: seção 5. Requisitos YE-DP-FERIAS-001: RN-011/CA-010 — o caso dos contratados há menos de 12 meses (art. 140) é o FERIAS-062.', 'api', 'CLT, art. 139, §1º', 'em_triagem', NULL),
    ('FERIAS-062', 'Coletivas com menos de 12 meses de casa: proporcionais e novo aquisitivo', 'alternativo', 'media', 'aprovado', 'Na coletiva, quem ainda não completou 12 meses goza férias PROPORCIONAIS ao tempo de casa — e o período aquisitivo REINICIA na volta. Aplicar a coletiva cheia ao novato (ou descontar os dias "a mais" depois) erra dos dois lados; esquecer o reinício infla o aquisitivo seguinte.', 'Coletiva de 20 dias; colaborador com 6 meses de casa (proporcional ≈ 15 dias).', '[{"acao": "Aplicar a coletiva ao colaborador com 6 meses", "ordem": 1, "resultado_esperado": "Goza os proporcionais; o excedente é tratado como licença remunerada, não como débito"}, {"acao": "Conferir o período aquisitivo após a coletiva", "ordem": 2, "resultado_esperado": "Reiniciado a partir do retorno (art. 140)"}]', 'Novato goza proporcional e recomeça o relógio.', 'Requisitos YE-DP-FERIAS-001: RN-011 (parte final) / art. 140. Complementa FERIAS-060/061 (limites e comunicações).', 'api', 'CLT, art. 140', 'em_triagem', NULL),
    ('FERIAS-070', 'Encargos por enquadramento: Simples Anexo III x Anexo IV', 'alternativo', 'alta', 'aprovado', 'A provisão depende do enquadramento: Simples Anexo III não recolhe contribuição patronal (mantém FGTS); Anexo IV recolhe. O parâmetro vem do cadastro da empresa e a memória mostra a composição.', 'Duas empresas de teste: uma Anexo III, outra Anexo IV.', '[{"acao": "Calcular a provisão na empresa Anexo III", "ordem": 1, "resultado_esperado": "Sem contribuição patronal; FGTS mantido"}, {"acao": "Calcular na empresa Anexo IV", "ordem": 2, "resultado_esperado": "Com contribuição patronal"}]', 'O encargo segue o enquadramento, não um padrão fixo.', 'Documento: seção 7.4, CT-13 e CT-14. Confirmar parâmetros com a assessoria contábil antes da produção (ressalva do próprio documento).', 'api', 'LC 123/2006 (Simples Nacional); parametrização de encargos da seção 7.4', 'em_triagem', NULL),
    ('FERIAS-071', 'Cobertura operacional: estourar o limite da equipe gera alerta', 'alternativo', 'media', 'aprovado', 'Com limite parametrizado de 20% da equipe simultaneamente em férias, programar 40% de um departamento no mesmo mês gera alerta de cobertura com destaque no mapa de calor — informação para decidir, não bloqueio (a época é prerrogativa do empregador).', 'Departamento de 10 pessoas com limite de cobertura de 20%.', '[{"acao": "Programar 4 pessoas do departamento no mesmo mês", "ordem": 1, "resultado_esperado": "Alerta de cobertura com o estouro destacado no mapa de calor"}]', 'O RH decide vendo o buraco de cobertura, não descobrindo depois.', 'Documento: seções 4.5, 4.6 e CT-15.', 'api', 'Gestão operacional (seção 4.6 do documento); CLT, art. 136 (a época atende ao interesse do empregador)', 'em_triagem', NULL),
    ('FERIAS-080', 'Concessão gera o S-2230 com motivo 15 e datas exatas', 'feliz', 'alta', 'aprovado', 'Cada gozo concedido vira um S-2230 com o motivo 15 e as datas de início/fim EXATAS do período. Fracionou em três, são três eventos coerentes. Sem o evento, o afastamento oficial não existe para o governo; com datas erradas, a folha e o FGTS digital desalinham.', 'Férias aprovadas com fracionamento em dois períodos.', '[{"acao": "Concluir a concessão dos dois períodos", "ordem": 1, "resultado_esperado": "Dois eventos S-2230 (motivo 15), cada um com as datas do seu período"}, {"acao": "Validar antes do envio", "ordem": 2, "resultado_esperado": "Consistência de datas contra a programação aprovada; leiaute da versão vigente"}]', 'Cada período de gozo, um S-2230 fiel.', 'Requisitos YE-DP-FERIAS-001: RN-012 / CA-011 / RF-008. Leiautes são [VAL] na implementação.', 'api', 'eSocial — evento S-2230 (afastamento temporário; motivo 15 = gozo de férias)', 'em_triagem', NULL),
    ('FERIAS-081', 'Rejeição do eSocial é traduzida e o reenvio não duplica', 'excecao', 'alta', 'aprovado', 'Retorno de rejeição chega em código técnico; o DP precisa de tradução (o que houve, onde corrigir) e de reenvio SEGURO: corrigido o dado, o reenvio substitui/retifica — nunca cria evento duplicado do mesmo gozo. Duplicidade no eSocial é passivo novo criado pela própria correção.', 'Evento S-2230 rejeitado por inconsistência de data.', '[{"acao": "Receber a rejeição", "ordem": 1, "resultado_esperado": "Explicação em linguagem simples + ação sugerida (Plano de Ação)"}, {"acao": "Corrigir e reenviar", "ordem": 2, "resultado_esperado": "Evento aceito; nenhum duplicado do mesmo período no ambiente"}, {"acao": "Conferir a trilha", "ordem": 3, "resultado_esperado": "Rejeição, correção e recibo final encadeados"}]', 'Rejeição vira instrução; reenvio vira retificação, nunca clone.', 'Requisitos YE-DP-FERIAS-001: fluxo "Rejeição no eSocial" (seção 9) / cenário "Com erro" (seção 25).', 'api', 'eSocial — regras de retificação e recibos; boa prática de integração', 'em_triagem', NULL),
    ('FERIAS-082', 'Férias refletem na folha: S-1200 e S-1210 com as rubricas certas', 'feliz', 'media', 'aprovado', 'O dinheiro das férias precisa aparecer nos eventos de folha: S-1200 com as rubricas de férias e do terço na competência certa, S-1210 com o detalhamento do pagamento e a DATA REAL (que prova o D-2). Sem esse reflexo, o pagamento existiu no banco e não existiu para o Fisco.', 'Férias calculadas e pagas no prazo.', '[{"acao": "Gerar os eventos de folha da competência", "ordem": 1, "resultado_esperado": "S-1200 com rubricas de férias + 1/3 (e abono como indenizatório); S-1210 com a data real do pagamento"}, {"acao": "Conciliar com a memória de cálculo", "ordem": 2, "resultado_esperado": "Valores idênticos — sem diferença entre o pago e o declarado"}]', 'O que se pagou é o que se declarou, com a data que prova o prazo.', 'Requisitos YE-DP-FERIAS-001: RN-012 / CA-011. Naturezas conforme FERIAS-034.', 'api', 'eSocial — S-1200 (remuneração) e S-1210 (pagamentos, detPgtoFer)', 'em_triagem', NULL),
    ('FERIAS-090', 'Rescisão liquida vencidas e proporcionais com o terço', 'excecao', 'alta', 'aprovado', 'No desligamento, férias vencidas saem integrais (em dobro se o concessivo venceu) e as proporcionais por duodécimos — ambas + 1/3, natureza indenizatória. O módulo de férias deve entregar ao Desligamento o retrato exato: períodos abertos, saldos, vencimentos e valores.', 'Colaborador desligado com um período vencido não gozado + 7 meses do aquisitivo corrente.', '[{"acao": "Processar o desligamento", "ordem": 1, "resultado_esperado": "Vencidas integrais (+ dobro se concessivo vencido) e 7/12 proporcionais, tudo + 1/3"}, {"acao": "Conferir os períodos após a rescisão", "ordem": 2, "resultado_esperado": "Encerrados como indenizados, com memória e vínculo ao termo de rescisão"}]', 'Nenhum período aberto sobrevive à rescisão sem virar valor.', 'Requisitos YE-DP-FERIAS-001: arts. 146-148 / fluxo "Rescisão com férias pendentes" (seção 9). Par do PONTO-173 (banco de horas na rescisão).', 'api', 'CLT, arts. 146 a 148; Súmula 171 do TST', 'em_triagem', NULL),
    ('FERIAS-091', 'Dois vínculos do mesmo CPF: períodos e cálculos segregados', 'alternativo', 'media', 'aprovado', 'Cada contrato tem seu próprio aquisitivo, saldo, programação e cálculo — o CPF é a pessoa, o vínculo é o contrato. Períodos que se misturam entre vínculos corrompem os dois: falta de um reduz férias do outro, gozo de um consome saldo do outro.', 'Mesmo CPF com dois vínculos ativos (empresas/estabelecimentos distintos).', '[{"acao": "Apurar os períodos aquisitivos dos dois vínculos", "ordem": 1, "resultado_esperado": "Dois relógios independentes, cada um com a data de admissão do seu contrato"}, {"acao": "Registrar faltas num vínculo e gozo no outro", "ordem": 2, "resultado_esperado": "Nenhum efeito cruzado — saldo e cálculo de cada contrato intactos"}]', 'Um CPF, dois contratos, dois relógios de férias.', 'Requisitos YE-DP-FERIAS-001: cenário "Múltiplos vínculos" (seção 25). Espelha PONTO-394 — lá o achado foi estrutural (chave por CPF); aqui ferias_periodos_aquisitivos também é chaveado por CPF, mesma raiz.', 'api', 'CLT (contratos autônomos entre si)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'jornada-rotina/ferias'
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


-- (3) PONTES — 46 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('FERIAS-001', 'qa_caso_ferias_001', true),
    ('FERIAS-002', 'qa_caso_ferias_002', true),
    ('FERIAS-003', 'qa_caso_ferias_003', true),
    ('FERIAS-004', 'qa_caso_ferias_004', true),
    ('FERIAS-005', 'qa_caso_ferias_005', true),
    ('FERIAS-006', 'qa_caso_ferias_006', true),
    ('FERIAS-007', 'qa_caso_ferias_007', true),
    ('FERIAS-008', 'qa_caso_ferias_008', true),
    ('FERIAS-010', 'qa_caso_ferias_010', true),
    ('FERIAS-011', 'qa_caso_ferias_011', true),
    ('FERIAS-012', 'qa_caso_ferias_012', true),
    ('FERIAS-013', 'qa_caso_ferias_013', true),
    ('FERIAS-014', 'qa_caso_ferias_014', true),
    ('FERIAS-015', 'qa_caso_ferias_015', true),
    ('FERIAS-016', 'qa_caso_ferias_016', true),
    ('FERIAS-017', 'qa_caso_ferias_017', true),
    ('FERIAS-020', 'qa_caso_ferias_020', true),
    ('FERIAS-021', 'qa_caso_ferias_021', true),
    ('FERIAS-022', 'qa_caso_ferias_022', true),
    ('FERIAS-024', 'qa_caso_ferias_024', true),
    ('FERIAS-030', 'qa_caso_ferias_030', true),
    ('FERIAS-031', 'qa_caso_ferias_031', true),
    ('FERIAS-032', 'qa_caso_ferias_032', true),
    ('FERIAS-033', 'qa_caso_ferias_033', true),
    ('FERIAS-034', 'qa_caso_ferias_034', true),
    ('FERIAS-035', 'qa_caso_ferias_035', true),
    ('FERIAS-040', 'qa_caso_ferias_040', true),
    ('FERIAS-041', 'qa_caso_ferias_041', true),
    ('FERIAS-042', 'qa_caso_ferias_042', true),
    ('FERIAS-050', 'qa_caso_ferias_050', true),
    ('FERIAS-051', 'qa_caso_ferias_051', true),
    ('FERIAS-052', 'qa_caso_ferias_052', true),
    ('FERIAS-053', 'qa_caso_ferias_053', true),
    ('FERIAS-054', 'qa_caso_ferias_054', true),
    ('FERIAS-055', 'qa_caso_ferias_055', true),
    ('FERIAS-056', 'qa_caso_ferias_056', true),
    ('FERIAS-060', 'qa_caso_ferias_060', true),
    ('FERIAS-061', 'qa_caso_ferias_061', true),
    ('FERIAS-062', 'qa_caso_ferias_062', true),
    ('FERIAS-070', 'qa_caso_ferias_070', true),
    ('FERIAS-071', 'qa_caso_ferias_071', true),
    ('FERIAS-080', 'qa_caso_ferias_080', true),
    ('FERIAS-081', 'qa_caso_ferias_081', true),
    ('FERIAS-082', 'qa_caso_ferias_082', true),
    ('FERIAS-090', 'qa_caso_ferias_090', true),
    ('FERIAS-091', 'qa_caso_ferias_091', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 46, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('FERIAS-001'), ('FERIAS-002'), ('FERIAS-003'), ('FERIAS-004'), ('FERIAS-005'), ('FERIAS-006'), ('FERIAS-007'), ('FERIAS-008'), ('FERIAS-010'), ('FERIAS-011'), ('FERIAS-012'), ('FERIAS-013'), ('FERIAS-014'), ('FERIAS-015'), ('FERIAS-016'), ('FERIAS-017'), ('FERIAS-020'), ('FERIAS-021'), ('FERIAS-022'), ('FERIAS-024'), ('FERIAS-030'), ('FERIAS-031'), ('FERIAS-032'), ('FERIAS-033'), ('FERIAS-034'), ('FERIAS-035'), ('FERIAS-040'), ('FERIAS-041'), ('FERIAS-042'), ('FERIAS-050'), ('FERIAS-051'), ('FERIAS-052'), ('FERIAS-053'), ('FERIAS-054'), ('FERIAS-055'), ('FERIAS-056'), ('FERIAS-060'), ('FERIAS-061'), ('FERIAS-062'), ('FERIAS-070'), ('FERIAS-071'), ('FERIAS-080'), ('FERIAS-081'), ('FERIAS-082'), ('FERIAS-090'), ('FERIAS-091')),
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
