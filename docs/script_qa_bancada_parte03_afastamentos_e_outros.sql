-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 3 de 15
-- Afastamentos, Atestados, Benefícios e Cargos
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

-- (1) ROTINAS — 37 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_id uuid;
  v_st text;
  v_n  int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Registrar afastamento cujo período de término já passou';
  r.esperado    := 'Não permanece ativo — encerra pelo gatilho ou pela rotina';

  v_id := public.qa_afast_legado('QA Vencido', CURRENT_DATE - 40);
  UPDATE public.afastamentos SET data_fim = CURRENT_DATE - 10 WHERE id = v_id;

  SELECT public.afastamento_encerrar_vencidos() INTO v_n;
  SELECT status::text INTO v_st FROM public.afastamentos WHERE id = v_id;

  IF v_st <> 'encerrado' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: afastamento com término em %s continua como "%s". Enquanto '
             || 'contar como ativo, ele infla a régua dos 15 dias e o absenteísmo, e mantém o '
             || 'colaborador impedido de bater ponto — o RH só sai disso apagando o registro.',
             to_char(CURRENT_DATE - 10, 'DD/MM/YYYY'), v_st);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Rodar a rotina de encerramento de novo';
  r.esperado    := 'Nada muda — ela roda todo dia e precisa ser inócua quando não há o que fazer';
  SELECT public.afastamento_encerrar_vencidos() INTO v_n;

  IF v_n <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('A rotina não é idempotente: na segunda execução ainda encerrou %s '
                    || 'registro(s).', v_n);
    RETURN r;
  END IF;

  r.situacao := 'passou';
  r.obtido := 'Vencido não fica ativo, e rodar a rotina de novo não mexe em nada.';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_recusou boolean := false;
  v_msg text;
  v_id uuid;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Tentar criar afastamento comum sem data de término';
  r.esperado    := 'Recusado, com mensagem que diz o que fazer';

  BEGIN
    v_id := public.qa_afast_novo('QA Sem Fim', CURRENT_DATE - 5, NULL);
  EXCEPTION WHEN OTHERS THEN
    v_recusou := true;
    v_msg := SQLERRM;
  END;

  IF NOT v_recusou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou afastamento comum SEM data de término. A trava do '
             || 'ponto lê fim ausente como 31/12/9999 — o colaborador fica impedido de bater '
             || 'ponto para sempre, e o RH só resolve apagando o afastamento (perdendo o '
             || 'histórico de saúde ocupacional junto).';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Criar afastamento de prazo indeterminado sem data de término';
  r.esperado    := 'Aceito — benefício do INSS não tem previsão de retorno';

  BEGIN
    v_id := public.qa_afast_novo('QA Prazo Indeterminado', CURRENT_DATE - 5, NULL, true);
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'falhou';
    r.obtido := format('A guarda passou do ponto: recusou até o caso legítimo (prazo '
                    || 'indeterminado / benefício do INSS), que não tem data de retorno por '
                    || 'natureza. Mensagem: %s', left(SQLERRM, 120));
    RETURN r;
  END;

  r.situacao := 'passou';
  r.obtido := format('Comum sem fim recusado ("%s") e prazo indeterminado aceito.',
                     left(v_msg, 80));
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_id uuid;
  v_st text;
  v_fim date;
  v_existe boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Informar a data de término de um afastamento legado já vencido';
  r.esperado    := 'Encerra na hora, sem esperar a rotina da madrugada';

  v_id := public.qa_afast_legado('QA Legado', CURRENT_DATE - 60);

  -- Confere que o cenário é mesmo o legado: ativo e sem data de término.
  SELECT status::text, data_fim INTO v_st, v_fim
    FROM public.afastamentos WHERE id = v_id;
  IF v_st <> 'ativo' OR v_fim IS NOT NULL THEN
    r.situacao := 'erro';
    r.obtido := format('Não foi possível montar o cenário legado (situação %s, término %s).',
                       v_st, coalesce(v_fim::text, 'nenhum'));
    RETURN r;
  END IF;

  UPDATE public.afastamentos SET data_fim = CURRENT_DATE - 50 WHERE id = v_id;
  SELECT status::text INTO v_st FROM public.afastamentos WHERE id = v_id;

  IF v_st <> 'encerrado' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: informar a data de término deixou o registro como "%s". Sem '
             || 'encerramento imediato, o RH continua sem caminho de saída a não ser apagar o '
             || 'afastamento — que é justamente o que estamos tentando evitar.', v_st);
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir que o registro continua existindo';
  r.esperado    := 'Histórico preservado, nada apagado';
  SELECT EXISTS (SELECT 1 FROM public.afastamentos WHERE id = v_id) INTO v_existe;

  IF NOT v_existe THEN
    r.situacao := 'falhou';
    r.obtido := 'O encerramento apagou o registro. Afastamento é histórico de saúde '
             || 'ocupacional: encerra, não some.';
    RETURN r;
  END IF;

  r.situacao := 'passou';
  r.obtido := 'Ao informar a data de término o afastamento encerrou na hora, e o registro '
           || 'continua na base para consulta e para o eSocial.';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_param text; v_cod text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cada tipo de afastamento carrega efeito legal e código da Tabela 18?';
  r.esperado := 'Parametrização por tipo: interrupção × suspensão + código do eSocial, com vigência';
  SELECT string_agg(table_name, ', ') INTO v_param
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%afastamento%tipo%' OR table_name ILIKE '%afastamento%efeito%'
         OR table_name ILIKE '%afastamento%config%');
  v_cod := coalesce(public.qa_col_existe('afastamentos', '%tabela_18%'),
                    public.qa_col_existe('afastamentos', '%codigo_esocial%'),
                    public.qa_col_existe(NULL, '%tabela18%'));

  IF v_param IS NULL AND v_cod IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o tipo do afastamento é só um NOME — o enum '
             || 'afastamento_tipo_principal tem um catálogo rico (18 tipos), mas nenhuma '
             || 'tabela parametriza o EFEITO legal de cada um (interrupção mantém salário '
             || 'e tempo; suspensão não) nem o código da Tabela 18 do eSocial que o S-2230 '
             || 'exige. As consequências ficam por conta de quem lê o nome do tipo: a '
             || 'inteligência trata alguns casos por lista fixa em código (acidentes, '
             || 'maternidade), e o resto não tem efeito definido em lugar nenhum. Correção: '
             || 'tabela de tipos com efeito (interrupção/suspensão), efeito no FGTS/tempo, '
             || 'código da Tabela 18 e vigência — a matriz por cliente é [VAL] (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Parametrização presente (tabelas: %s; código: %s).',
                       coalesce(v_param, '—'), coalesce(v_cod, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cpf text := public.qa_cpf(9111); v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar dois afastamentos ATIVOS sobrepostos para o mesmo colaborador';
  r.esperado := 'O segundo é recusado — sobreposição é prorrogação ou é erro, nunca registro paralelo';
  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
  VALUES (v_t, '[QA-AFAST-011] Sobreposto', v_cpf, CURRENT_DATE - 20, CURRENT_DATE + 10, 'ativo');
  BEGIN
    INSERT INTO public.afastamentos
      (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
    VALUES (v_t, '[QA-AFAST-011] Sobreposto', v_cpf, CURRENT_DATE - 5, CURRENT_DATE + 20, 'ativo');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception OR exclusion_violation THEN
    v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou dois afastamentos ATIVOS sobrepostos do mesmo CPF — '
             || 'não há constraint de exclusão nem validação de período. Com dois registros '
             || 'vigentes, o Ponto não sabe qual regra aplicar, a folha pode suspender duas '
             || 'vezes (ou nenhuma) e o eSocial recebe S-2230 conflitantes do mesmo vínculo. '
             || 'A inteligência até ACUMULA dias por CID, mas não impede o paralelismo. '
             || 'Correção: EXCLUDE USING gist (colaborador × daterange) para status ativos, '
             || 'com a prorrogação como caminho explícito (UPDATE do fim, com trilha).';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A sobreposição foi recusada na gravação.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_pend int; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar doença comum de 20 dias e conferir o que a inteligência produz';
  r.esperado := 'Pendência de INSS/S-2230 criada E status virado para aguardando_inss (Lei 8.213, art. 60)';
  v_id := public.qa_afast_tipado('[QA-AFAST-020] Doenca 20d', 9120,
                                 CURRENT_DATE - 20, CURRENT_DATE, 'doenca_comum');
  SELECT count(*) INTO v_pend FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia IN ('inss', 's2230');
  SELECT status_geral_new::text INTO v_status FROM public.afastamentos WHERE id = v_id;

  IF v_pend > 0 AND v_status = 'aguardando_inss' THEN
    r.situacao := 'passou';
    r.obtido := format('Regra viva: %s pendência(s) criada(s) e status %s.', v_pend, v_status);
  ELSIF v_pend > 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (regressão parcial na reescrita de 24/07): as PENDÊNCIAS dos '
             || '15 dias nasceram (%s: avaliar INSS + S-2230), mas o afastamento NÃO virou '
             || 'para aguardando_inss — ficou "%s". A versão de 23/07 fazia a virada no '
             || 'próprio registro (era o que habilitava o bloco de benefício INSS na tela); '
             || 'a reescrita de 24/07 moveu a inteligência para gatilho AFTER, que não '
             || 'altera a própria linha, e a virada se perdeu. Sem ela, o DP depende de ler '
             || 'a pendência — e a tela que filtra por status não mostra o caso. Correção: '
             || 'devolver a mudança de status ao gatilho BEFORE (afastamento_campos_before).',
             v_pend, coalesce(v_status, 'NULL'));
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (regressão da reescrita de 24/07): doença ÚNICA de 20 dias '
             || 'entrou sem pendência de INSS/S-2230 e com status "%s". A versão de 23/07 '
             || 'disparava a regra para afastamento único > 15 dias mesmo sem CID e virava '
             || 'o status para aguardando_inss; a versão viva só dispara pela ACUMULAÇÃO '
             || '(exige CID em afastamentos_saude + colaborador vinculado — que o '
             || 'formulário de atestado nem sempre preenche) e não muda status nenhum. '
             || 'Resultado: o caso mais comum — um atestado longo — passa em silêncio, a '
             || 'folha paga dias do INSS e o S-2230 do 16º dia perde o prazo. Correção: '
             || 'restaurar o ramo do afastamento único (basta dias_totais > 15) e a virada '
             || 'de status no gatilho BEFORE.',
             coalesce(v_status, 'NULL'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_acum text; v_prazo text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a acumulação por CID em 60 dias existe e produz o efeito completo?';
  r.esperado := 'Recaída soma os dias (sem novos 15 da empresa) e o S-2230 sai no 1º dia';
  SELECT left(p.prosrc, 1) INTO v_acum
  FROM pg_proc p WHERE p.proname = 'processar_inteligencia_afastamento'
    AND p.prosrc ILIKE '%60%' AND p.prosrc ILIKE '%cid%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_prazo
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%recaida%' AND p.prosrc ILIKE '%prazo%';

  IF v_acum IS NOT NULL AND v_prazo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade ausente): a ACUMULAÇÃO existe — a inteligência '
             || 'soma os dias de afastamentos com o mesmo CID em 60 dias e dispara a '
             || 'pendência de INSS quando o acumulado passa de 15 (a empresa não paga novos '
             || '15 dias, correto) — mas ela depende de o formulário preencher CID e '
             || 'colaborador vinculado, e a RECAÍDA não muda o PRAZO do S-2230: na recaída '
             || 'o evento vai no 1º DIA, não no 16º nem no dia 15 do mês seguinte, e '
             || 'nenhuma função trata esse relógio. Recaída identificada com prazo errado '
             || 'ainda é multa. Correção: prazo diferenciado na pendência de S-2230 quando '
             || 'a origem é acumulação por CID + garantir CID/vínculo obrigatórios no '
             || 'fluxo de atestado. Regra exata da recaída é [VAL] (seção 30).';
  ELSIF v_acum IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A acumulação por CID em 60 dias não existe mais na inteligência do afastamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Acumulação viva e prazo de recaída tratado (%s).', v_prazo);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o afastamento registrado vira lançamento de folha?';
  r.esperado := '15 dias pagos em rubrica própria; suspensão do 16º; origem rastreável — sem redigitação';
  -- exige que a função ESCREVA na folha — "afastamento + folha" solto pega as
  -- funções de exclusão de colaborador, que só CONTAM vínculos nas tabelas
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamento%'
    AND (p.prosrc ILIKE '%INSERT INTO%folha_lancamentos%'
         OR p.prosrc ILIKE '%INSERT INTO%folha_itens%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o afastamento não chega à folha — nenhuma função gera lançamento a '
             || 'partir do afastamento registrado: os 15 dias pela empresa, a suspensão do '
             || '16º e a divisão da competência que atravessa a virada dependem de o DP '
             || 'REDIGITAR na folha o que o afastamento já sabe. É o primeiro elo do "erro '
             || 'em cadeia" que o documento descreve: registrado aqui, esquecido lá, a '
             || 'folha paga salário integral de quem está no INSS. Par do FOLHA-080 (visto '
             || 'do lado da folha). Correção: geração de lançamentos por competência a '
             || 'partir dos afastamentos vigentes, com origem rastreável e rubrica própria.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_cat int; v_prazo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar acidente típico e conferir a pendência de CAT e o prazo dela';
  r.esperado := 'Pendência de CAT criada com prazo no 1º dia útil seguinte (art. 22 da Lei 8.213)';
  v_id := public.qa_afast_tipado('[QA-AFAST-030] Acidente', 9130,
                                 CURRENT_DATE, CURRENT_DATE + 10, 'acidente_tipico');
  SELECT count(*) INTO v_cat FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia = 'cat';
  -- a COLUNA prazo existe; o que importa é se a inteligência a PREENCHE
  SELECT max(prazo)::text INTO v_prazo FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia = 'cat';

  IF v_cat > 0 AND v_prazo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade sem relógio): o acidente DISPAROU a pendência de '
             || 'CAT (marcadores cat_obrigatoria/cat_pendente e pendências de CAT e S-2210 — '
             || 'a inteligência funciona), mas o PRAZO ficou vazio: a coluna '
             || 'afastamentos_pendencias.prazo existe e a inteligência não a preenche — o '
             || '"1º dia útil seguinte", o prazo mais curto do DP, vira prioridade textual '
             || 'sem relógio. Acidente na sexta dá CAT até segunda; sem o cálculo pelo '
             || 'calendário (tabela feriados), ninguém escala o alerta a tempo e a multa do '
             || 'art. 22 chega junto com a fiscalização. Correção: preencher prazo = 1º dia '
             || 'útil seguinte (imediato em óbito) na criação da pendência, com escalada '
             || 'crítica na aproximação.';
  ELSIF v_cat = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o acidente típico NÃO gerou pendência de CAT — a regra da '
             || 'inteligência não disparou. Conferir o gatilho.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('CAT disparada com prazo controlado (%s).', v_prazo);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_marc int; v_fim date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar acidente com data de retorno e conferir a estabilidade gravada';
  r.esperado := 'data_fim_estabilidade = retorno + 12 meses (art. 118) — o registro que a Rescisão lê';
  v_id := public.qa_afast_tipado('[QA-AFAST-031] Estabilidade', 9131,
                                 CURRENT_DATE - 40, CURRENT_DATE - 5, 'acidente_tipico');
  SELECT count(*) INTO v_marc FROM public.afastamentos_marcadores
  WHERE afastamento_id = v_id AND marcador = 'estabilidade_provisoria';
  SELECT data_fim_estabilidade INTO v_fim FROM public.afastamentos WHERE id = v_id;

  IF v_fim = (CURRENT_DATE - 5 + interval '12 months')::date THEN
    r.situacao := 'passou';
    r.obtido := format('Estabilidade gravada até %s (retorno + 12 meses); marcador: %s.',
                       v_fim, v_marc);
  ELSIF v_marc > 0 AND v_fim IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (regressão na reescrita de 24/07): o MARCADOR de estabilidade nasceu, '
             || 'mas data_fim_estabilidade ficou NULA — a versão de 23/07 gravava retorno + '
             || '12 meses no próprio registro (era esse campo que o mapa de estabilidades e '
             || 'a Rescisão liam); o gatilho AFTER de 24/07 não altera a própria linha e a '
             || 'gravação se perdeu. Sem a data, a estabilidade existe como etiqueta sem '
             || 'vencimento: o DESL-071 bloqueia dispensa lendo este campo, e o falso '
             || 'negativo do DESL-077 volta por outra porta. Correção: gravar '
             || 'data_fim_estabilidade no gatilho BEFORE (afastamento_campos_before), '
             || 'com expiração conferível.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (regressão da reescrita de 24/07): o acidente encerrado não '
             || 'criou estabilidade NENHUMA (marcador: %s; data_fim_estabilidade: %s). Duas '
             || 'perdas na mesma reescrita: a Regra 9 da inteligência trocou a lista de '
             || 'tipos — acidente_tipico/trajeto e doenca_ocupacional SAÍRAM (ficaram só '
             || 'b91, maternidade e sindical), justamente os casos do art. 118 — e a '
             || 'gravação de data_fim_estabilidade (retorno + 12 meses, versão de 23/07) '
             || 'desapareceu: a coluna ficou órfã. O DESL-071 bloqueia dispensa lendo esse '
             || 'campo; vazio, o falso negativo do DESL-077 volta por outra porta. '
             || 'Correção: devolver os tipos acidentários à Regra 9 e gravar '
             || 'data_fim_estabilidade no gatilho BEFORE (AFTER não altera a própria linha).',
             v_marc, coalesce(v_fim::text, 'NULL'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_032()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o efeito do afastamento no FGTS existe em algum lugar?';
  r.esperado := 'Acidente e serviço militar mantêm o depósito (art. 15, §5º); demais suspendem';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_est
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamento%' AND p.prosrc ILIKE '%fgts%';

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o FGTS do afastado não é tratado em lugar nenhum — nenhuma função '
             || 'cruza afastamento com FGTS. A regra tem dois lados que erram em direções '
             || 'opostas: no acidente de trabalho (e serviço militar) o depósito de 8% '
             || 'CONTINUA o afastamento inteiro (art. 15, §5º — não depositar é dívida que '
             || 'o FGTS Digital denuncia); na doença comum a partir do 16º e na licença '
             || 'sem remuneração, SUSPENDE (depositar é custo indevido). O efeito por tipo '
             || 'pertence à matriz do AFAST-010 e ao reflexo na folha do AFAST-022 — este '
             || 'caso garante que o FGTS não fique de fora dela. Efeitos exatos por tipo '
             || 'são [VAL] (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Efeito no FGTS tratado por: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_032()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_032 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_adesao text; v_gest text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os prazos da licença e a estabilidade gestante têm estrutura?';
  r.esperado := '120 (+60 Empresa Cidadã) / 5 (+15) dias parametrizados pela adesão; estabilidade gestante com vencimento';
  v_adesao := coalesce(public.qa_col_existe('empresa_cadastro', '%cidada%'),
                       public.qa_col_existe(NULL, '%empresa_cidada%'));
  v_gest := coalesce(public.qa_fns_com('%gestante%'),
                     public.qa_col_existe(NULL, '%estabilidade_gestante%'));

  IF v_adesao IS NULL AND v_gest IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a maternidade existe só como TIPO — licenca_maternidade está no '
             || 'enum e ganha marcador de estabilidade provisória, mas: (1) a adesão ao '
             || 'Empresa Cidadã não é cadastrada em lugar nenhum, então o sistema não sabe '
             || 'se a licença é de 120 ou 180 dias (nem 5 ou 20 na paternidade); (2) a '
             || 'estabilidade GESTANTE (confirmação da gravidez até 5 meses pós-parto — '
             || 'ADCT art. 10) não tem estrutura própria: o vencimento dela não é "fim da '
             || 'licença + 12 meses" como no acidente, é "parto + 5 meses", e nenhum campo '
             || 'ou função a calcula. A Rescisão bloqueia gestante (DESL-070) lendo o quê? '
             || 'Correção: adesão ao programa no cadastro da empresa (com vigência) + '
             || 'estabilidade tipada com regra de vencimento própria por espécie.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente (adesão: %s; gestante: %s).',
                       coalesce(v_adesao, '—'), coalesce(v_gest, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_param text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as hipóteses do art. 473 existem com seus prazos?';
  r.esperado := 'Catálogo por hipótese (falecimento 2d, casamento 3d, doação de sangue 1/ano...) com limite conferido';
  SELECT string_agg(table_name, ', ') INTO v_param
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%falta%justificada%' OR table_name ILIKE '%473%'
         OR table_name ILIKE '%hipotese%');

  IF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o art. 473 inteiro virou UM tipo genérico — falta_justificada_legal '
             || '— sem as hipóteses nem os prazos de cada uma: 2 dias por falecimento, 3 '
             || 'por casamento, 1 por ano para doar sangue, juízo pelo tempo necessário, '
             || 'pré-natal... Sem o catálogo, ninguém confere o LIMITE (4 dias de '
             || '"falecimento" passam como justificados quando 2 deveriam virar falta '
             || 'comum) nem o teto anual da doação de sangue. A decisão fica com o '
             || 'operador, caso a caso, sem trilha do enquadramento. Correção: catálogo de '
             || 'hipóteses (inciso, dias, frequência) parametrizável — CCTs ampliam '
             || 'hipóteses [RCC] — com o excedente tratado como falta comum e alertado.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Catálogo de hipóteses presente: %s.', v_param);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar suspensão disciplinar de 45 dias corridos';
  r.esperado := 'Recusada — o art. 474 limita a 30 dias; acima disso a lei converte em rescisão injusta';
  BEGIN
    v_id := public.qa_afast_tipado('[QA-AFAST-051] Suspensao 45d', 9151,
                                   CURRENT_DATE, CURRENT_DATE + 44, 'suspensao_disciplinar');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a suspensão disciplinar de 45 dias entrou sem resistência — nenhuma '
             || 'validação compara a duração com o teto do art. 474 quando o tipo é '
             || 'suspensao_disciplinar. O 31º dia não é "punição longa": é rescisão injusta '
             || 'por força de lei — o empregado pode se considerar dispensado com todas as '
             || 'verbas, e foi o próprio sistema que documentou a prova. Correção: validação '
             || 'tipo × duração na gravação (teto de 30 dias corridos), com alerta ao '
             || 'jurídico se alguém tentar.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A suspensão acima de 30 dias foi recusada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_pend text; v_prazo text; v_ger text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o S-2230 tem a tabela de prazos e a geração do evento?';
  r.esperado := 'Prazo por motivo/duração (dia 15; 16º dia; 1º dia na recaída; término) + evento gerado';
  SELECT left(p.prosrc, 1) INTO v_pend
  FROM pg_proc p WHERE p.proname = 'processar_inteligencia_afastamento'
    AND p.prosrc ILIKE '%s2230%';
  -- a coluna prazo existe; conta apenas se alguma função a PREENCHE
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_prazo
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamentos_pendencias%' AND p.prosrc ILIKE '%prazo%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ger
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%S-2230%' AND p.prosrc ILIKE '%esocial_transmissoes%');

  IF v_pend IS NOT NULL AND (v_prazo IS NULL OR v_ger IS NULL) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (o lembrete existe, o relógio e o evento não): a inteligência cria a '
             || 'pendência de S-2230 na doença longa — mas (1) a pendência não tem '
             || 'data-limite, e o prazo do S-2230 é uma TABELA: dia 15 do mês seguinte na '
             || 'regra geral, 16º DIA do afastamento na doença > 15 dias, 1º dia na '
             || 'recaída, dia 15 seguinte no término — cada motivo com seu relógio; e (2) '
             || 'nenhuma função GERA o evento para esocial_transmissoes — o afastamento '
             || 'não existe para o governo, mesmo vazio dos S-1200/S-2299 (FOLHA-060, '
             || 'DESL-091). Correção: data-limite por motivo/duração na pendência + '
             || 'geração do S-2230 (afastamento e término) na fila com anti-duplicidade '
             || '(série ADM-093..DESL-094). Prazos vigentes são [VAL].';
  ELSIF v_pend IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A pendência de S-2230 sumiu da inteligência do afastamento.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazos e geração presentes (prazo: %s; geração: %s).',
                       coalesce(v_prazo, '—'), coalesce(v_ger, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_pend int; v_encerrou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar afastamento de 45 dias e conferir a exigência de ASO de retorno';
  r.esperado := 'Pendência de ASO criada e o encerramento condicionado ao exame (NR-7)';
  v_id := public.qa_afast_tipado('[QA-AFAST-070] Longo 45d', 9170,
                                 CURRENT_DATE - 45, CURRENT_DATE, 'doenca_comum');
  SELECT count(*) INTO v_pend FROM public.afastamentos_pendencias
  WHERE afastamento_id = v_id AND tipo_pendencia = 'aso_retorno';

  r.passo_ordem := 2;
  r.passo_acao := 'Encerrar o afastamento SEM registrar o ASO de retorno';
  r.esperado := 'Retido — retorno de afastamento ≥ 30 dias só se completa com o exame';
  BEGIN
    UPDATE public.afastamentos SET status = 'encerrado' WHERE id = v_id;
    v_encerrou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_encerrou := false; END;

  IF v_pend > 0 AND v_encerrou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (a pendência existe, a trava não): o afastamento de 45 dias GEROU a '
             || 'pendência de ASO de retorno (a inteligência acertou — NR-7 exige o exame '
             || 'antes da retomada em afastamento ≥ 30 dias), mas o ENCERRAMENTO passou '
             || 'direto com a pendência aberta: nada condiciona o fim do afastamento ao '
             || 'exame. Encerrado, o Ponto volta a cobrar marcação e a pessoa volta ao '
             || 'posto sem o crivo médico — exatamente o que a norma quis impedir (e um '
             || 'risco real se o afastamento foi psiquiátrico ou acidentário). Correção: '
             || 'encerramento retido enquanto houver pendência de aso_retorno aberta, com '
             || 'exceção justificada em trilha (alta administrativa) para não travar '
             || 'operação legítima.';
  ELSIF v_pend = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o afastamento de 45 dias NÃO gerou pendência de ASO de retorno — '
             || 'a regra dos 30 dias da inteligência não disparou. Conferir o gatilho.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Pendência criada e encerramento retido até o ASO.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_afast_080()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_atest int; v_saude int; v_log text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o CID está restrito e o acesso a ele é logado?';
  r.esperado := 'Camada de perfil sobre atestados/afastamentos_saude + log específico de acesso ao CID';
  SELECT count(*) INTO v_atest FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'atestados'
    AND policyname ILIKE 'perfil_restringe%';
  SELECT count(*) INTO v_saude FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'afastamentos_saude'
    AND policyname ILIKE 'perfil_restringe%';
  -- "cid" solto casa com "cidade" (gerar_estrutura_padrao_pastas) — exige a
  -- coluna clínica de verdade no corpo da função
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_log
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%cid_principal%' OR p.prosrc ILIKE '%cid_codigo%')
    AND (p.prosrc ILIKE '%log%' OR p.prosrc ILIKE '%acesso%' OR p.prosrc ILIKE '%audit%');

  IF v_atest > 0 AND v_saude > 0 AND v_log IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (a porta tem tranca, mas ninguém anota quem entrou): as DUAS '
             || 'tabelas com CID estão na camada de perfil (atestados: %s política(s); '
             || 'afastamentos_saude: %s) — a restrição de leitura existe e é das melhores '
             || 'do sistema. O que falta é o LOG ESPECÍFICO de acesso ao CID que o '
             || 'documento exige (seção 22: "log de acesso específico ao CID"; seção 29: '
             || '"cofre do CID"): nenhuma função registra QUEM consultou o diagnóstico de '
             || 'QUEM e quando. Para dado sensível do art. 11 da LGPD, a trilha de acesso '
             || 'é parte da conformidade — numa investigação de vazamento, hoje não há o '
             || 'que consultar. Correção: leitura do CID via função SECURITY DEFINER que '
             || 'registra o acesso (leitor, titular, registro, hora) em tabela append-only.',
             v_atest, v_saude);
  ELSIF v_atest = 0 OR v_saude = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO GRAVE: tabela com CID fora da camada de perfil (atestados: %s; '
             || 'afastamentos_saude: %s políticas) — diagnóstico legível além do SST.',
             v_atest, v_saude);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Restrição e log presentes (log: %s).', v_log);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_afast_080()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_afast_080 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ate_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Registrar atestado medico';
  r.esperado    := 'Atestado criado e recuperavel';
  INSERT INTO public.atestados (tenant_id, colaborador_nome, tipo, data_emissao,
                                profissional_nome, profissional_registro)
  VALUES (v_t, '[QA-ATE] Colaborador', 'assistencial', CURRENT_DATE,
          '[QA] Dr. Teste', 'CRM-QA-0000')
  RETURNING id INTO v_id;

  r.passo_ordem := 2;
  r.passo_acao  := 'Verificar que o atestado foi gravado';
  PERFORM 1 FROM public.atestados WHERE id = v_id;
  IF FOUND THEN
    r.situacao := 'passou';
    r.obtido   := 'Atestado registrado e recuperado.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Atestado nao encontrado apos criar.';
  END IF;
  r.detalhe := jsonb_build_object('atestado_id', v_id);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ate_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ate_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém lê regras_cargo/vinculo/unidade na adesão?';
  r.esperado := 'Elegibilidade conferida ao aderir — cargo fora da regra é bloqueado/sinalizado';
  v_col := public.qa_col_existe('beneficios_tipos', 'regras_cargo');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%regras_cargo%' OR p.prosrc ILIKE '%regras_vinculo%'
         OR p.prosrc ILIKE '%regras_unidade%');

  IF v_col IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: as regras de elegibilidade estão cadastradas (regras_cargo, '
             || 'regras_vinculo, regras_unidade em beneficios_tipos) e NENHUMA função as '
             || 'lê — a adesão em beneficios_colaboradores aceita qualquer colaborador em '
             || 'qualquer benefício, e a regra vira anotação. Conceder fora da regra é '
             || 'custo sem controle e diferenciação sem critério (risco de equiparação); '
             || 'negar o que a CCT garante é passivo. Correção: validação de elegibilidade '
             || 'na adesão (gatilho ou função de adesão), com sinalização para o DP '
             || 'decidir a exceção documentada.';
  ELSIF v_col IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'As colunas de regras de elegibilidade não existem mais em beneficios_tipos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Elegibilidade aplicada por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_tipo uuid; v_status text; v_termo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar adesão de VT SEM termo de opção e ver se algo protesta';
  r.esperado := 'Bloqueio ou pendência de termo — o VT é optativo (Lei 7.418/85)';
  INSERT INTO public.beneficios_tipos (tenant_id, nome, categoria)
  VALUES (v_t, 'QA — Vale-transporte', 'transporte')
  RETURNING id INTO v_tipo;
  INSERT INTO public.beneficios_colaboradores
    (tenant_id, beneficio_tipo_id, colaborador_id, colaborador_nome, colaborador_cpf,
     valor, valor_desconto, data_inicio, status)
  VALUES (v_t, v_tipo, gen_random_uuid(), 'QA Colaborador Ben Dez', public.qa_cpf(70),
          220.00, 90.00, CURRENT_DATE, 'ativo');
  SELECT bc.status INTO v_status FROM public.beneficios_colaboradores bc
  WHERE bc.tenant_id = v_t AND bc.beneficio_tipo_id = v_tipo LIMIT 1;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a adesão tem onde ancorar o termo de opção/recusa?';
  r.esperado := 'Vínculo com o termo assinado (documento) na adesão';
  v_termo := coalesce(public.qa_col_existe('beneficios_colaboradores', '%termo%'),
                      public.qa_col_existe('beneficios_colaboradores', '%documento%'),
                      public.qa_col_existe('beneficios_colaboradores', '%arquivo%'));

  IF v_status = 'ativo' AND v_termo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a adesão de VT nasceu ATIVA, com desconto, sem termo de opção — e '
             || 'pior: não existe sequer COLUNA para ancorar o termo (ou a recusa) em '
             || 'beneficios_colaboradores. O VT é optativo por lei: descontar de quem não '
             || 'optou é desconto ilegal; conceder sem opção documentada perde a prova da '
             || 'natureza não salarial. A coleta na admissão existe (ADM-050) mas não se '
             || 'conecta ao benefício. Correção: vínculo obrigatório da adesão com o termo '
             || '(assinado, no módulo Documentos — padrão ADM-070); sem termo, adesão '
             || 'pendente, sem concessão nem desconto; recusa registrada com reopção '
             || 'possível.';
  ELSIF v_status IS DISTINCT FROM 'ativo' THEN
    r.situacao := 'passou';
    r.obtido := format('A adesão sem termo não se consumou (status: %s).', coalesce(v_status, 'NULL'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Há ancoragem para o termo (%s) — a sonda fina fica com a rotina de tela.', v_termo);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pct numeric; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar VT com desconto de 15% no catálogo e ver se o teto legal segura';
  r.esperado := 'Percentual acima de 6% recusado ou limitado (Lei 7.418/85)';
  INSERT INTO public.beneficios_tipos
    (tenant_id, nome, categoria, tipo_desconto, percentual_desconto)
  VALUES (v_t, 'QA — VT quinze por cento', 'transporte', 'percentual', 15);
  SELECT bt.percentual_desconto INTO v_pct FROM public.beneficios_tipos bt
  WHERE bt.tenant_id = v_t AND bt.nome = 'QA — VT quinze por cento';

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe motor que calcule o MENOR entre 6% do salário e o custo real?';
  r.esperado := 'Cálculo com os dois tetos e memória; home office dispensa o VT';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%beneficio%'
    AND (p.prosrc ILIKE '%0.06%' OR p.prosrc ILIKE '%salario%basico%');

  IF v_pct = 15 AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o catálogo aceitou VT com desconto de 15% — nenhum CHECK ou '
             || 'gatilho conhece o teto legal de 6%, e não existe motor que calcule o '
             || 'desconto correto (o MENOR entre 6% do salário básico e o custo real do '
             || 'transporte): beneficios_colaboradores guarda valor e valor_desconto '
             || 'digitados à mão. Passe barato deve descontar menos que 6%; reajuste '
             || 'salarial deve recalcular o teto — nada disso tem onde acontecer. O limite '
             || 'genérico na folha (FOLHA-030) não substitui a conta do benefício. '
             || 'Correção: teto de 6% validado no catálogo para a categoria transporte + '
             || 'motor de cálculo por competência (salário básico × 6% vs. custo, '
             || 'proporcional aos dias — BEN-050), com memória.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Teto tratado (percentual gravado: %s; motor: %s).',
                       coalesce(v_pct::text, 'recusado'), coalesce(v_fns, 'na gravação'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_pct numeric; v_param text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar VR com desconto de 50% do valor e ver se o limite do PAT segura';
  r.esperado := 'Participação do trabalhador limitada (PAT/CCT) — 50% não passa em silêncio';
  INSERT INTO public.beneficios_tipos
    (tenant_id, nome, categoria, tipo_desconto, percentual_desconto)
  VALUES (v_t, 'QA — VR cinquenta por cento', 'alimentacao', 'percentual', 50);
  SELECT bt.percentual_desconto INTO v_pct FROM public.beneficios_tipos bt
  WHERE bt.tenant_id = v_t AND bt.nome = 'QA — VR cinquenta por cento';

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe parâmetro de limite do PAT/CCT em algum lugar?';
  r.esperado := 'Teto parametrizado e versionado, aplicado na competência';
  v_param := coalesce(public.qa_col_existe(NULL, '%limite%pat%'),
                      public.qa_col_existe('beneficios_tipos', '%limite%'),
                      public.qa_col_existe('beneficios_tipos', '%teto%'));

  IF v_pct = 50 AND v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o VR aceitou desconto de 50% e não existe NENHUM parâmetro de '
             || 'limite (nem coluna de teto no catálogo, nem tabela de parâmetros do '
             || 'PAT): a participação do trabalhador — que o PAT limita como condição do '
             || 'benefício fiscal — é o que o operador digitar. Desconto acima do limite '
             || 'descaracteriza o VR (vira salário, com INSS/FGTS retroativos) e derruba '
             || 'o incentivo; a Lei 14.442/22 ainda veda rebate ao empregador, e o '
             || 'sistema não tem onde registrar essa vedação por fornecedora. Correção: '
             || 'teto parametrizado [VAL] por PAT/CCT, versionado por competência, '
             || 'validado no catálogo e na aplicação do desconto.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Limite tratado (percentual: %s; parâmetro: %s).',
                       coalesce(v_pct::text, 'recusado'), coalesce(v_param, 'na gravação'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a adesão vira rubrica na Folha com incidência parametrizada?';
  r.esperado := 'Rubricas (desconto + patronal) geradas por competência, com incidência e memória';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    -- vínculo genérico/limpeza citam a tabela sem ser motor de benefício
    AND p.proname NOT IN ('colaborador_tem_vinculos', 'excluir_colaborador_forcado')
    AND p.prosrc ILIKE '%beneficios_colaboradores%'
    AND (p.prosrc ILIKE '%folha%' OR p.prosrc ILIKE '%rubrica%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe ponte entre os benefícios e a Folha — nenhuma função '
             || 'lê beneficios_colaboradores para gerar rubricas de desconto/patronal na '
             || 'competência: o desconto vive parado no cadastro e entra na folha na mão, '
             || 'a cada mês, para cada colaborador. Sem o motor de incidências por '
             || 'benefício (RF-009), a natureza de cada rubrica (VT/VR não integram; '
             || 'utilidade do art. 458 pode integrar) fica na memória do operador — e '
             || 'benefício mal classificado vira salário com passivo previdenciário '
             || 'retroativo. A infraestrutura do outro lado existe (folha_rubricas, '
             || 'folha_itens, memória da família FOLHA). Correção: geração automática das '
             || 'rubricas por competência a partir das adesões ativas, com incidência '
             || 'parametrizada e versionada e memória de cálculo (padrão FOLHA-080).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte com a Folha presente: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de dependentes de benefício?';
  r.esperado := 'Dependentes com idade/parentesco/documentação validados, refletindo na operadora e no IRRF';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%dependente%');

  IF v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a estrutura de dependentes NÃO EXISTE — nenhuma tabela de '
             || 'dependentes no banco. Sem ela, o plano de saúde familiar não tem onde '
             || 'registrar as vidas (a fatura da operadora cobra por dependente e o '
             || 'sistema não sabe quantos são — a conciliação do BEN-042 nasce cega), o '
             || 'IRRF do titular não reflete os dependentes, e a regra de elegibilidade '
             || '(idade-limite, parentesco, documentação — RN-007) não tem onde morar. '
             || 'Correção: tabela de dependentes por titular (nome, nascimento, '
             || 'parentesco, documento, benefícios vinculados), com validação de regra na '
             || 'inclusão, alerta de idade a vencer e reflexo nas movimentações da '
             || 'operadora e no IRRF.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de dependentes presente: %s.', v_tab);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a rescisão calcula a manutenção do plano (arts. 30/31)?';
  r.esperado := 'Elegibilidade, período (1/3; mín. 6, máx. 24 meses), prazo de 30 dias e custo integral tratados';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%manutencao%plano%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%art%30%plano%' OR p.prosrc ILIKE '%manutencao%plano%'
         OR (p.prosrc ILIKE '%9656%'));

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os arts. 30/31 da Lei 9.656/98 não existem no sistema — nenhuma '
             || 'tabela ou função trata a manutenção do plano do demitido sem justa causa '
             || '(1/3 do tempo de contribuição, mínimo 6 e máximo 24 meses, custo '
             || 'integral) nem do aposentado (10+ anos: vitalício), e ninguém controla o '
             || 'PRAZO DE 30 DIAS da opção — o mais perigoso do pós-rescisão: perder a '
             || 'comunicação é ação judicial quase certa, com reintegração ao plano e '
             || 'danos. O desligamento da casa é rico em pendências (família DESL) e não '
             || 'tem este item. Correção: na rescisão sem justa causa de titular '
             || 'contributário, calcular elegibilidade/período/custo, gerar a comunicação '
             || 'com prazo controlado e registrar a opção do ex-empregado (termo no '
             || 'módulo Documentos).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Manutenção tratada (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_042()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existem operadoras, movimentações e faturas com conciliação?';
  r.esperado := 'Fatura importada, comparada (vidas/valores/coparticipação) e paga só depois de conciliada';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%operadora%' OR table_name ILIKE '%fatura%'
         OR table_name ILIKE 'beneficios%movim%');

  IF v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o lado das operadoras não existe — sem cadastro de '
             || 'operadoras/planos (tabelas de preço por faixa etária, coparticipação), '
             || 'sem movimentações de inclusão/alteração/exclusão (o RF-012) e sem '
             || 'faturas: a conciliação mensal (vidas cobradas × vidas ativas, '
             || 'coparticipação por uso) não tem onde acontecer, e a fatura é paga na '
             || 'confiança. Vida fantasma de ex-colaborador cobrada por meses é o custo '
             || 'invisível clássico dos benefícios — exatamente o que a RN-013 manda '
             || 'bloquear ("fatura só é paga após conciliação"). Correção: estrutura '
             || 'operadora/plano/movimentação/fatura com conciliação obrigatória, glosa '
             || 'registrada e ação no Plano de Ação por divergência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de operadoras/faturas presente: %s.', v_tab);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_042()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_042 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o benefício consome os dias efetivos do Ponto?';
  r.esperado := 'VT/VR proporcionais aos dias trabalhados; afastamento ajusta a concessão';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    -- vínculo genérico/limpeza citam a tabela sem ser motor de benefício
    AND p.proname NOT IN ('colaborador_tem_vinculos', 'excluir_colaborador_forcado')
    AND p.prosrc ILIKE '%beneficios_colaboradores%'
    AND (p.prosrc ILIKE '%ponto%' OR p.prosrc ILIKE '%dias%'
         OR p.prosrc ILIKE '%afastament%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o benefício não conversa com o Ponto — beneficios_colaboradores '
             || 'guarda valor e desconto FIXOS e nenhuma função os ajusta pelos dias '
             || 'efetivos da competência: colaborador afastado há dois meses segue com VT '
             || 'e VR cheios (custo indevido) ou tem o benefício cortado na mão (erro '
             || 'para o outro lado). O Ponto já apura os dias por colaborador '
             || '(ponto_saldo_dias_competencia_bruto, usada por férias) — o dado existe, '
             || 'o consumo não. Correção: apuração mensal do benefício proporcional aos '
             || 'dias efetivos (RN-011), com a regra de afastamento parametrizada por '
             || 'benefício/CCT e memória de cálculo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proporcionalidade presente: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cct text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a camada CCT alcança os benefícios?';
  r.esperado := 'Benefício/valor de CCT aplicados pela vigência, com tabela versionada';
  SELECT string_agg(table_name, ', ') INTO v_cct
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%cct%' OR table_name ILIKE '%convenc%')
    AND table_name NOT ILIKE 'psicossocial%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%beneficio%'
    AND (p.prosrc ILIKE '%cct%' OR p.prosrc ILIKE '%convenc%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (a camada existe, não chega aqui): a parametrização por '
             || 'instrumento coletivo já é realidade no ponto e na folha (%s — com '
             || 'vigência por competência, PONTO-386), mas NADA a liga aos benefícios: '
             || 'cesta básica, VR mínimo e seguro de vida instituídos pela convenção da '
             || 'categoria não têm onde ser parametrizados por vigência — beneficios_'
             || 'tipos é um catálogo plano, sem instrumento nem versão. CCT nova exige '
             || 'reconfiguração manual, e a anterior se perde (competência antiga fica '
             || 'sem prova do valor da época). Correção: vínculo benefício × instrumento '
             || 'coletivo × vigência, versionado, aplicado pela data — o padrão que '
             || 'ponto_cct_config/folha_cct já praticam.',
             coalesce(v_cct, 'ponto_cct_config, folha_cct'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('CCT alcança os benefícios por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a adesão gera termo e o arquiva no módulo Documentos?';
  r.esperado := 'Termo assinado com trilha, vinculado à adesão e arquivado com metadados';
  v_col := coalesce(public.qa_col_existe('beneficios_colaboradores', '%termo%'),
                    public.qa_col_existe('beneficios_colaboradores', '%documento%'),
                    public.qa_col_existe('beneficios_colaboradores', '%assinatura%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT IN ('colaborador_tem_vinculos', 'excluir_colaborador_forcado')
    AND p.prosrc ILIKE '%beneficio%'
    AND (p.prosrc ILIKE '%termo%' OR p.prosrc ILIKE '%assinatura%');

  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a adesão não gera termo — sem coluna de vínculo com documento em '
             || 'beneficios_colaboradores e sem função que gere/colha/arquive o termo de '
             || 'opção ou adesão. O padrão da casa existe e é maduro (assinatura com '
             || 'trilha em ADM-070/DESL-082; guarda com metadados no módulo Documentos) — '
             || 'os benefícios ficaram fora dele. Sem termo: a opção do VT não se prova '
             || '(BEN-010), as condições do plano e os dependentes aceitos não se provam, '
             || 'e a manutenção dos arts. 30/31 (BEN-040) não tem onde registrar a opção '
             || 'do ex-empregado. Correção: termo gerado na adesão/recusa, assinado com '
             || 'trilha e arquivado no Documentos, com o id do documento na adesão '
             || '(RN-012).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Termo tratado (vínculo: %s; funções: %s).',
                       coalesce(v_col, '—'), coalesce(v_fns, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe estrutura de PLR (acordo, apuração, limite de 2/ano)?';
  r.esperado := 'PLR só é isenta com acordo prévio válido; IR em tabela própria; máx. 2 pagamentos/ano';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ILIKE '%plr%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%plr%';

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a PLR não existe no sistema — sem tabela de programa/acordo, sem '
             || 'apuração, sem controle dos dois pagamentos anuais e do IR em tabela '
             || 'própria. O risco é específico: pagamento rotulado de PLR sem acordo '
             || 'prévio válido (comissão paritária + sindicato, Lei 10.101/2000) é '
             || 'salário disfarçado — INSS, FGTS e reflexos retroativos sobre cada '
             || 'centavo, e é a Receita quem cobra. Enquanto a empresa não tiver '
             || 'programa, tudo bem não ter estrutura; o perigo é pagar "PLR" pela folha '
             || 'sem o cinto. Correção (quando houver programa): registro do acordo como '
             || 'condição do pagamento isento, limite de 2/ano e IR próprio (RF-014).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de PLR presente (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_071()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe controle de consignado e margem consignável?';
  r.esperado := 'Desconto de consignado validado contra a margem; excedente bloqueado';
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND (table_name ILIKE '%consign%' OR table_name ILIKE '%margem%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%consign%' OR p.prosrc ILIKE '%margem_consign%');

  IF v_tab IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: consignado e margem consignável não existem no sistema — sem '
             || 'cadastro de convênios, sem cálculo de margem sobre a remuneração '
             || 'disponível, sem trava de desconto. Se um convênio de consignado for '
             || 'operado hoje, o desconto entra na folha como lançamento manual sem teto: '
             || 'acima da margem é ilegal (Lei 10.820/2003) e derruba o líquido do '
             || 'colaborador abaixo do vital — e salário reduzido por afastamento exige '
             || 'recálculo da margem que ninguém fará à mão. Correção (quando houver '
             || 'convênio): margem consignável parametrizada [VAL], validação de cada '
             || 'contrato contra ela e bloqueio do excedente com alerta (RF-015).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Consignado tratado (tabelas: %s; funções: %s).',
                       coalesce(v_tab, '—'), coalesce(v_fns, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_071()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_071 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ben_080()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aberta int; v_perfil int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): quem consegue LER as adesões de benefícios?';
  r.esperado := 'Leitura restrita por perfil (LGPD art. 11) — plano de saúde é dado de saúde por inferência';
  SELECT count(*) INTO v_aberta FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'beneficios_colaboradores'
    AND cmd = 'SELECT' AND policyname ILIKE '%tenant%';
  SELECT count(*) INTO v_perfil FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'beneficios_colaboradores'
    AND policyname ILIKE '%perfil%';

  IF v_aberta > 0 AND v_perfil = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: beneficios_colaboradores tem leitura aberta ao tenant '
             || '("Usuários podem ver benefícios do tenant") e NENHUMA política '
             || 'perfil_restringe_leitura_* — qualquer usuário lista quem tem plano de '
             || 'saúde, valores e descontos de todos os colegas. Adesão a plano é dado '
             || 'de saúde por inferência (LGPD art. 11), e a camada de perfil da casa já '
             || 'protege ~20 tabelas sensíveis (atestados, eventos_saude, '
             || 'folha_rescisoes...) — os benefícios ficaram fora. Mesma família do '
             || 'FOLHA-090 (salários) e do EPI-041 (biometria). Correção: política '
             || 'RESTRICTIVE por perfil na tabela, com o colaborador vendo apenas as '
             || 'próprias adesões, e log de consulta quando a estrutura de saúde '
             || 'crescer (dependentes, coparticipação).';
  ELSIF v_aberta = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'A leitura aberta ao tenant não existe mais — política revista.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Camada de perfil presente (%s política(s)).', v_perfil);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ben_080()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ben_080 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cargo_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_dep uuid; v_car uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento e um cargo nele, com faixa salarial'; r.esperado:='Cargo criado e vinculado';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Dep Para Cargo') RETURNING id INTO v_dep;
  INSERT INTO public.cargos (tenant_id, nome, departamento_id, nivel, faixa_salarial_min, faixa_salarial_max)
  VALUES (v_t, '[QA] Analista', v_dep, 'pleno', 3000, 5000) RETURNING id INTO v_car;
  IF v_car IS NOT NULL AND EXISTS(SELECT 1 FROM public.cargos WHERE id=v_car AND departamento_id=v_dep) THEN
    r.situacao:='passou'; r.obtido:='Cargo criado e ligado ao departamento.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou ou nao vinculou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cargo_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cargo_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cargo_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar cargo e tentar outro com o mesmo nome'; r.esperado:='Segundo recusado (UNIQUE)';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Repetido');
  BEGIN
    INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Repetido');
    r.situacao:='falhou'; r.obtido:='ACEITOU cargo com nome duplicado.';
  EXCEPTION WHEN unique_violation THEN r.situacao:='passou'; r.obtido:='Recusado: nome de cargo unico por cliente.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cargo_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cargo_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cargo_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar cargo SEM departamento'; r.esperado:='Aceito (departamento e opcional)';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Cargo Sem Dep') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Cargo criado sem departamento.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cargo_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cargo_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cargo_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar cargo com salario minimo 8000 e maximo 3000 (incoerente)';
  r.esperado:='Idealmente recusado; revela se ha validacao de min<=max';
  BEGIN
    INSERT INTO public.cargos (tenant_id, nome, faixa_salarial_min, faixa_salarial_max)
    VALUES (v_t, '[QA] Cargo Salario Invertido', 8000, 3000) RETURNING id INTO v_id;
    r.situacao:='falhou';
    r.obtido:='O BANCO ACEITOU salario minimo (8000) maior que o maximo (3000). Nao ha CHECK de coerencia — validacao so no front, se houver.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o banco valida min<=max.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cargo_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cargo_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cargo_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar cargo no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t1, '[QA] Cargo Secreto T1');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.cargos WHERE tenant_id=v_t2 AND nome='[QA] Cargo Secreto T1';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Cargo do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s cargo(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cargo_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cargo_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 38 casos.

-- Afastamentos (17 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('AFAST-001', 'Afastamento com período vencido é encerrado, não fica ativo para sempre', 'feliz', 'critica', 'aprovado', 'Um afastamento cujo período de término já passou não pode continuar contando como ativo. Enquanto conta, ele infla a régua dos 15 dias, o absenteísmo e os painéis de FAP/RAT, e mantém o colaborador impedido de bater ponto.', 'Afastamento com data de término anterior a hoje.', '[{"acao": "Registrar afastamento já vencido e rodar a rotina de encerramento", "ordem": 1, "resultado_esperado": "Situação passa a encerrado"}, {"acao": "Rodar a rotina de novo", "ordem": 2, "resultado_esperado": "Nada muda — rodar duas vezes é seguro"}]', 'Vencido vira encerrado; a rotina é idempotente.', 'Achado de 13/08/2026: nenhum trecho do sistema mudava a situação para encerrado. Dos 9 afastamentos abertos na produção, 5 tinham o período vencido e seguiam ativos.', 'api', 'Portaria MTP 671/2021 (fidedignidade do registro); eSocial S-2230', 'em_triagem', NULL),
    ('AFAST-002', 'Afastamento novo sem data de término é recusado (salvo INSS)', 'negativo', 'critica', 'aprovado', 'Afastamento sem data de fim é lido pela trava do ponto como término em 31/12/9999 — o colaborador fica impedido de bater ponto por tempo indefinido. Só é legítimo sem fim quando não há previsão de retorno: benefício do INSS, prazo indeterminado ou licença previdenciária.', 'Nenhuma.', '[{"acao": "Tentar criar afastamento comum sem data de término", "ordem": 1, "resultado_esperado": "Recusado, com mensagem que diz o que fazer"}, {"acao": "Criar afastamento de prazo indeterminado sem data de término", "ordem": 2, "resultado_esperado": "Aceito — é o caso legítimo"}]', 'Comum sem fim é recusado; prazo indeterminado é aceito.', 'A origem do defeito estava no formulário do atestado: a data de término só era calculada quando a unidade era dias e a quantidade maior que zero. Atestado em horas ou com zero dias gerava afastamento eterno.', 'api', 'CLT art. 60 da Lei 8.213/91 (benefício); Portaria MTP 671/2021', 'em_triagem', NULL),
    ('AFAST-003', 'Preencher a data de término encerra o afastamento na hora', 'feliz', 'alta', 'aprovado', 'O RH precisa de um caminho de saída que não seja apagar o registro. Ao informar a data de término de um afastamento que já acabou, ele deve encerrar imediatamente, sem esperar a rotina da madrugada — e sem perder o histórico.', 'Afastamento antigo sem data de término (registro legado).', '[{"acao": "Informar a data de término de um afastamento legado já vencido", "ordem": 1, "resultado_esperado": "Encerra na hora"}, {"acao": "Conferir que o registro continua existindo", "ordem": 2, "resultado_esperado": "Histórico preservado, nada apagado"}]', 'Encerra na hora e preserva o registro.', 'Antes desta correção o RH excluía o afastamento para liberar a batida — perdendo o histórico de saúde ocupacional junto.', 'api', 'Portaria MTP 671/2021', 'em_triagem', NULL),
    ('AFAST-010', 'Cada tipo de afastamento tem efeito legal e código da Tabela 18 definidos', 'feliz', 'alta', 'aprovado', 'O tipo do afastamento decide TUDO: interrupção mantém salário e tempo de serviço; suspensão não paga e (em regra) não conta. E cada tipo precisa do código da Tabela 18 do eSocial para o S-2230 sair certo. O sistema já classifica por um catálogo rico de tipos — o que falta conferir é se cada tipo carrega o EFEITO legal parametrizado e o código do eSocial, em vez de deixar as consequências por conta de quem lê o nome.', 'Catálogo de tipos de afastamento carregado (enum afastamento_tipo_principal).', '[{"acao": "Conferir o catálogo de tipos", "ordem": 1, "resultado_esperado": "Cada tipo com efeito legal (interrupção/suspensão) e código da Tabela 18 parametrizados, com vigência"}, {"acao": "Registrar afastamento de tipo com efeito interrupção", "ordem": 2, "resultado_esperado": "Folha mantém pagamento; tempo de serviço corre"}, {"acao": "Registrar tipo com efeito suspensão", "ordem": 3, "resultado_esperado": "Pagamento suspenso; efeito em FGTS/tempo conforme a matriz"}]', 'O tipo carrega a lei consigo — efeito e código, nunca só o nome.', 'Requisitos YE-DP-AFAST-001: RF-001/RF-002 / RNF-004 / seção 30 (matriz de efeitos por cliente é [VAL]). O enum de tipos existe (afastamento_tipo_principal); a matriz de efeitos e o mapeamento à Tabela 18, não.', 'api', 'CLT (interrupção × suspensão do contrato); eSocial — S-2230 e Tabela 18 (motivos de afastamento)', 'em_triagem', NULL),
    ('AFAST-011', 'Períodos de afastamento do mesmo colaborador não se sobrepõem', 'negativo', 'alta', 'aprovado', 'Dois afastamentos ativos sobrepostos para a mesma pessoa são um bug com juros: o Ponto não sabe qual regra aplicar, a Folha pode suspender duas vezes (ou nenhuma) e o eSocial recebe eventos conflitantes. O registro novo que invade período de afastamento ativo deve ser recusado — ou tratado explicitamente como prorrogação/retificação do existente, nunca como registro paralelo.', 'Colaborador fictício com afastamento ativo de 1º a 30 do mês.', '[{"acao": "Registrar segundo afastamento começando no dia 15 do mesmo período", "ordem": 1, "resultado_esperado": "Recusado — sobreposição apontada, com oferta de prorrogar/retificar o existente"}, {"acao": "Registrar afastamento que começa após o fim do primeiro", "ordem": 2, "resultado_esperado": "Aceito normalmente"}]', 'Um período por vez: o que invade é prorrogação ou é erro.', 'Requisitos YE-DP-AFAST-001: seção 13 (sobreposição) / RNF-001 (reflexos sem duplicidade). Complementa AFAST-001..003 (datas e encerramento).', 'api', 'Consistência do registro (seção 13: datas coerentes e sobreposição); reflexos idempotentes (RNF-001)', 'em_triagem', NULL),
    ('AFAST-020', 'Doença acima de 15 dias: empresa paga 15, INSS assume do 16º', 'feliz', 'critica', 'aprovado', 'Na incapacidade por doença, a empresa paga os 15 PRIMEIROS dias e o INSS assume do 16º em diante. O sistema deve virar o afastamento para o estado de encaminhamento ao INSS ao cruzar os 15 dias — automaticamente, não quando alguém lembra — e alertar o DP no 15º dia. A regra já vive no banco (inteligência do afastamento); o caso a exercita e a protege de regressão.', 'Afastamento por doença com duração superior a 15 dias no ambiente de teste.', '[{"acao": "Registrar afastamento de doença com 20 dias", "ordem": 1, "resultado_esperado": "Ao cruzar os 15 dias, status muda para aguardando_inss automaticamente"}, {"acao": "Conferir o alerta", "ordem": 2, "resultado_esperado": "DP alertado no 15º dia para encaminhar ao INSS"}, {"acao": "Registrar afastamento de 10 dias", "ordem": 3, "resultado_esperado": "Permanece por conta da empresa, sem encaminhamento"}]', 'Quinze dias da empresa, o resto do INSS — e a virada é automática.', 'Requisitos YE-DP-AFAST-001: RN-001 / CA-001 / cenário "Longo (INSS)" (seção 25). PONTO BOM: processar_inteligencia_afastamento já implementa a virada para aguardando_inss — o caso protege a regra de regressão. | Requisitos YE-DP-ESC-001 (RN-010): segue dono da régua empresa 15 dias / INSS 16º; a ponte a partir do ATESTADO é o ESC-010.', 'api', 'Lei 8.213/1991, art. 60, §3º', 'em_triagem', NULL),
    ('AFAST-021', 'Recaída da mesma doença em 60 dias reabre o benefício sem novos 15 dias', 'alternativo', 'alta', 'aprovado', 'Afastou por lombalgia, voltou, e em 40 dias afastou de novo pela MESMA doença: é recaída — o benefício anterior reabre, a empresa NÃO paga novos 15 dias e o S-2230 vai no 1º dia. Tratar recaída como afastamento novo faz a empresa pagar quinze dias que são do INSS, repetidamente. A acumulação por CID em 60 dias já existe na inteligência; o caso confere o efeito completo.', 'Colaborador com afastamento encerrado há menos de 60 dias e novo atestado com o mesmo CID.', '[{"acao": "Registrar o novo afastamento com o mesmo CID dentro de 60 dias", "ordem": 1, "resultado_esperado": "Reconhecido como recaída — dias acumulados com o afastamento anterior"}, {"acao": "Conferir a responsabilidade", "ordem": 2, "resultado_esperado": "Sem novos 15 dias da empresa; encaminhamento ao INSS conforme o acumulado"}, {"acao": "Novo atestado com CID diferente", "ordem": 3, "resultado_esperado": "Afastamento novo — contagem própria de 15 dias"}]', 'Mesma doença em 60 dias soma; doença nova zera.', 'Requisitos YE-DP-AFAST-001: RN-001 (exceção) / cenário "Recaída" (seção 25). A acumulação por CID existe (processar_inteligencia_afastamento); a regra exata da recaída é [VAL] (seção 30). Depende do CID — que o formulário de atestado precisa alimentar.', 'api', 'Lei 8.213/1991 e regulamento (recaída dentro de 60 dias da cessação: mesmo benefício); eSocial — S-2230 no 1º dia na recaída', 'em_triagem', NULL),
    ('AFAST-022', 'O afastamento chega à folha: 15 dias pagos, suspensão do 16º', 'feliz', 'critica', 'aprovado', 'Registrar o afastamento é metade do trabalho; a outra metade é a FOLHA obedecer: os 15 primeiros dias de doença entram como remuneração normal (rubrica própria), do 16º em diante o salário suspende, e a competência que atravessa a virada divide os dias. Se a folha não consome o afastamento, o DP ajusta na mão — e o erro em cadeia que o documento descreve começa exatamente aí.', 'Afastamento de 40 dias atravessando duas competências; folha das competências processada.', '[{"acao": "Processar a folha da competência do início", "ordem": 1, "resultado_esperado": "15 dias pagos pela empresa em rubrica própria; dias seguintes suspensos"}, {"acao": "Processar a competência seguinte", "ordem": 2, "resultado_esperado": "Período INSS integralmente suspenso na folha"}, {"acao": "Conferir a origem do lançamento", "ordem": 3, "resultado_esperado": "Gerado do afastamento registrado (origem rastreável), não redigitado"}]', 'O afastamento registrado vira folha certa — sem redigitação.', 'Requisitos YE-DP-AFAST-001: RN-001 (impacto Folha) / CA-001. Par do FOLHA-080 (lado folha): aqui se testa que o AFASTAMENTO dispara o reflexo. DIVERGÊNCIA VISÍVEL: nenhuma função liga afastamentos a folha_lancamentos. Deve falhar e encaminhar.', 'api', 'Lei 8.213/1991, art. 60 (responsabilidade da empresa); CLT (efeitos da suspensão no salário)', 'em_triagem', NULL),
    ('AFAST-030', 'Acidente de trabalho: CAT preparada até o 1º dia útil seguinte', 'excecao', 'critica', 'aprovado', 'A CAT tem o prazo mais curto do DP: 1º dia útil seguinte ao acidente (imediata no óbito). Registrado um afastamento acidentário, o sistema prepara a CAT (S-2210), projeta o prazo pelo calendário (acidente na sexta → CAT até segunda) e escala o alerta como crítico — CAT fora do prazo é multa e enfraquece a defesa da empresa em tudo que vier depois.', 'Afastamento com tipo acidentário (acidente_tipico/trajeto) registrado no ambiente de teste.', '[{"acao": "Registrar o afastamento acidentário", "ordem": 1, "resultado_esperado": "Pendência de CAT criada com prazo no 1º dia útil seguinte (calendário consultado)"}, {"acao": "Deixar o prazo se aproximar sem emissão", "ordem": 2, "resultado_esperado": "Alerta crítico a SST/DP; ação no Plano de Ação"}, {"acao": "Emitir e anexar a CAT", "ordem": 3, "resultado_esperado": "S-2210 preparado; CAT arquivada na pasta do colaborador com recibo"}]', 'Acidente hoje, CAT amanhã — o prazo mais curto do DP é vigiado como tal.', 'Requisitos YE-DP-AFAST-001: RN-002 / CA-002 / cenário "Prazo vencido" (seção 25). A inteligência já cria tarefa de CAT; o que se confere é o PRAZO no 1º dia útil (calendário) e a escalada. Integra com eventos_sst (cat_tipo/cat_data_emissao). Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.', 'api', 'Lei 8.213/1991, art. 22 (CAT até o 1º dia útil seguinte; imediata em óbito); eSocial — S-2210', 'em_triagem', NULL),
    ('AFAST-031', 'Acidente cria a estabilidade de 12 meses que a Rescisão enxerga', 'feliz', 'alta', 'aprovado', 'A estabilidade acidentária nasce AQUI: cessado o auxílio-doença acidentário, correm 12 meses em que a dispensa imotivada é vedada. O afastamento acidentário encerrado deve gravar o fim da estabilidade (data da alta + 12 meses) — e é esse registro que o módulo de Rescisão consulta (DESL-071) para bloquear a dispensa. Sem a criação automática, o bloqueio de lá não tem o que ler (o falso negativo do DESL-077).', 'Afastamento acidentário com benefício encerrado (alta) no ambiente de teste.', '[{"acao": "Encerrar o afastamento acidentário", "ordem": 1, "resultado_esperado": "data_fim_estabilidade gravada = alta + 12 meses"}, {"acao": "Consultar o mapa de estabilidades", "ordem": 2, "resultado_esperado": "Estabilidade ativa listada com o vencimento"}, {"acao": "Vencido o período", "ordem": 3, "resultado_esperado": "Estabilidade expira e a dispensa volta a ser possível"}]', 'A alta liga o relógio dos 12 meses — e a Rescisão lê este registro.', 'Requisitos YE-DP-AFAST-001: RN-002/RN-006 / CA-002/CA-003. PONTO BOM: data_fim_estabilidade existe e a inteligência a alimenta (migration de 23/07) — o caso protege a regra e confere a ponta da expiração. O lado Rescisão é DESL-071/077.', 'api', 'Lei 8.213/1991, art. 118 (estabilidade de 12 meses após a cessação do auxílio acidentário)', 'em_triagem', NULL),
    ('AFAST-032', 'FGTS mantido no acidente e no serviço militar; suspenso nos demais', 'alternativo', 'media', 'aprovado', 'O FGTS não para em dois afastamentos: acidente de trabalho e serviço militar — nesses, o depósito de 8% continua o afastamento inteiro. Nos demais (doença comum a partir do 16º, licença sem remuneração), suspende. Errar para menos é dívida de FGTS que o FGTS Digital denuncia; errar para mais é custo indevido. O efeito por tipo precisa estar na matriz do AFAST-010 e chegar à folha.', 'Afastamentos de tipos distintos (acidentário, doença comum longa, licença não remunerada).', '[{"acao": "Conferir o FGTS do afastado por acidente", "ordem": 1, "resultado_esperado": "Depósito de 8% mantido em todas as competências do afastamento"}, {"acao": "Conferir doença comum a partir do 16º dia", "ordem": 2, "resultado_esperado": "Depósito suspenso no período INSS"}, {"acao": "Conferir licença não remunerada", "ordem": 3, "resultado_esperado": "Depósito suspenso"}]', 'Acidente e quartel mantêm o FGTS; o resto suspende — por tipo, nunca por lembrança.', 'Requisitos YE-DP-AFAST-001: RN-005 / CA-005. Depende da matriz de efeitos (AFAST-010) e do reflexo na folha (AFAST-022). Efeitos por tipo são [VAL] (seção 30).', 'api', 'Lei 8.036/1990, art. 15, §5º', 'em_triagem', NULL),
    ('AFAST-040', 'Maternidade: 120 dias (+60 Empresa Cidadã), estabilidade gestante criada', 'feliz', 'alta', 'aprovado', 'A licença-maternidade é de 120 dias — 180 se a empresa aderiu ao Empresa Cidadã — e caminha junto com a estabilidade da gestante (confirmação da gravidez até 5 meses após o parto), que a Rescisão precisa enxergar. A paternidade é de 5 dias (+15 na adesão). A adesão ao programa é parâmetro da EMPRESA: sem ela cadastrada, o sistema nem sabe qual prazo aplicar.', 'Empresa fictícia com e sem adesão ao Empresa Cidadã; licenças registradas.', '[{"acao": "Registrar licença-maternidade em empresa sem adesão", "ordem": 1, "resultado_esperado": "120 dias projetados; estabilidade gestante criada (até 5 meses pós-parto)"}, {"acao": "Registrar em empresa aderente ao Empresa Cidadã", "ordem": 2, "resultado_esperado": "180 dias (120+60), citando a adesão parametrizada"}, {"acao": "Registrar licença-paternidade", "ordem": 3, "resultado_esperado": "5 dias (+15 na adesão), sem desconto"}]', 'O prazo vem da lei e da adesão; a estabilidade nasce junto com a licença.', 'Requisitos YE-DP-AFAST-001: RN-006 / CA-006 / cenário "Maternidade" (seção 25). O tipo licenca_maternidade existe no enum; a adesão ao Empresa Cidadã e a estabilidade gestante estruturada, não. O lado Rescisão é DESL-070. Salário-maternidade (pagamento/compensação) é [VAL].', 'api', 'CLT, art. 392; Lei 8.213/1991, art. 71; ADCT, art. 10, II, "b" e §1º; Lei 11.770/2008 (Empresa Cidadã)', 'em_triagem', NULL),
    ('AFAST-050', 'Faltas do art. 473: hipóteses com prazos próprios, sem desconto e com DSR', 'alternativo', 'alta', 'aprovado', 'O art. 473 é uma LISTA com prazos: 2 dias por falecimento de familiar próximo, 3 por casamento, 1 por ano para doar sangue, comparecimento a juízo pelo tempo necessário, acompanhamento de pré-natal... Dentro da hipótese e do prazo, não há desconto e o DSR fica preservado; o que EXCEDER vira falta comum. Um tipo genérico "falta justificada" sem as hipóteses parametrizadas deixa a decisão (e o erro) para o operador.', 'Catálogo de faltas justificadas; registros de hipóteses distintas no ambiente de teste.', '[{"acao": "Registrar 2 dias por falecimento (art. 473, I)", "ordem": 1, "resultado_esperado": "Sem desconto; DSR preservado; hipótese e prazo citados"}, {"acao": "Registrar 4 dias pelo mesmo motivo", "ordem": 2, "resultado_esperado": "2 dias justificados; os 2 excedentes tratados como falta comum (com alerta)"}, {"acao": "Registrar segunda doação de sangue no mesmo ano", "ordem": 3, "resultado_esperado": "Recusada como justificada — limite de 1/ano; vira falta comum se mantida"}]', 'Cada hipótese com seu prazo; o excedente não pega carona na justificativa.', 'Requisitos YE-DP-AFAST-001: RN-009 / CA-010 / cenário "Falta justificada" (seção 25). O enum tem só falta_justificada_legal genérico — as hipóteses/prazos do 473 não existem parametrizados. Hipóteses ampliadas por CCT são [RCC]. | Requisitos YE-DP-ESC-001 (RN-009): segue dono do rol e prazos do art. 473; a exigência do documento comprobatório é o ESC-012.', 'api', 'CLT, art. 473 (falecimento 2 dias; casamento 3; paternidade; doação de sangue 1/ano; alistamento 2; juízo; pré-natal — cada hipótese com seu prazo)', 'em_triagem', NULL),
    ('AFAST-051', 'Suspensão disciplinar limitada a 30 dias', 'negativo', 'media', 'aprovado', 'A suspensão disciplinar tem teto DURO: 30 dias consecutivos. No 31º dia, a lei converte a punição em rescisão injusta — o empregado pode considerar-se dispendido com todas as verbas. Suspensão de 45 dias gravada sem resistência é o sistema ajudando a empresa a criar o passivo. O registro deve recusar (ou travar em 30 com alerta) qualquer suspensão disciplinar acima do limite.', 'Registro de suspensão disciplinar no ambiente de teste.', '[{"acao": "Registrar suspensão disciplinar de 45 dias", "ordem": 1, "resultado_esperado": "Recusada — teto legal de 30 dias consecutivos (art. 474)"}, {"acao": "Registrar suspensão de 15 dias", "ordem": 2, "resultado_esperado": "Aceita; salário suspenso no período; evidência arquivada"}]', 'Trinta dias é punição; trinta e um é rescisão que a empresa não queria.', 'Requisitos YE-DP-AFAST-001: base legal art. 474 / cenário "Suspensão disciplinar" (seção 9). O tipo suspensao_disciplinar existe no enum; o teto, não.', 'api', 'CLT, art. 474 — suspensão superior a 30 dias consecutivos importa rescisão injusta do contrato', 'em_triagem', NULL),
    ('AFAST-060', 'S-2230 no prazo do motivo: dia 15, 16º dia na doença longa, 1º dia na recaída', 'excecao', 'alta', 'aprovado', 'O S-2230 não tem UM prazo — tem uma tabela deles: regra geral até o dia 15 do mês seguinte; doença que passa de 15 dias, até o 16º dia do afastamento; recaída, no 1º dia; término, até o dia 15 após o retorno. O motor de prazos precisa escolher o prazo pelo MOTIVO e pela DURAÇÃO, projetar a data-limite e vigiar — a inteligência já cria a tarefa de S-2230 na doença longa; falta o relógio completo.', 'Afastamentos de motivos/durações distintos registrados no ambiente de teste.', '[{"acao": "Registrar doença de 20 dias", "ordem": 1, "resultado_esperado": "Prazo do S-2230 projetado para o 16º dia do afastamento"}, {"acao": "Registrar afastamento curto de outro motivo", "ordem": 2, "resultado_esperado": "Prazo projetado para o dia 15 do mês seguinte"}, {"acao": "Registrar recaída", "ordem": 3, "resultado_esperado": "Prazo no 1º dia — alerta imediato"}, {"acao": "Encerrar um afastamento", "ordem": 4, "resultado_esperado": "Prazo do evento de término projetado (dia 15 seguinte)"}]', 'O prazo certo depende do motivo — e o sistema escolhe sozinho.', 'Requisitos YE-DP-AFAST-001: RN-008 / CA-007 / RNF-003. PARCIAL: a tarefa de S-2230 nasce na doença longa (inteligência); a tabela completa de prazos e a geração do evento, não. Prazos vigentes são [VAL] (seção 30). Anti-duplicidade/rejeição é a série ADM-093..DESL-094.', 'api', 'eSocial — S-2230, prazos por motivo/duração (regra geral: dia 15 do mês seguinte; doença > 15 dias: até o 16º dia; recaída: 1º dia; término: dia 15 seguinte)', 'em_triagem', NULL),
    ('AFAST-070', 'Retorno de afastamento longo exige ASO antes de reativar as obrigações', 'feliz', 'alta', 'aprovado', 'Voltou de afastamento longo, o primeiro compromisso é o ASO de retorno — ANTES de retomar a função. O encerramento do afastamento deve exigir o exame (a pendência já existe: aso_retorno_pendente), e enquanto ele não vem, o retorno não se completa: reativar ponto e obrigações com ASO pendente é colocar para trabalhar alguém que a NR-7 mandou examinar primeiro.', 'Afastamento de 45 dias por doença sendo encerrado no ambiente de teste.', '[{"acao": "Encerrar o afastamento longo", "ordem": 1, "resultado_esperado": "aso_retorno_pendente marcado; retorno condicionado ao exame"}, {"acao": "Tentar completar o retorno sem ASO", "ordem": 2, "resultado_esperado": "Pendência mantida com alerta a SST/DP — não conclui em silêncio"}, {"acao": "Registrar o ASO de retorno apto", "ordem": 3, "resultado_esperado": "Pendência baixada; ponto e obrigações reativados; término no eSocial"}]', 'Afastamento longo só termina de verdade depois do médico.', 'Requisitos YE-DP-AFAST-001: RN-007 / CA-008 / cenário "Normal" (seção 25). PONTO BOM: aso_retorno_pendente existe e a inteligência o marca — o caso confere se a pendência TRAVA o retorno ou só decora o registro. O lado exame demissional é DESL-060..067. Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.', 'api', 'NR-7 (exame de retorno ao trabalho antes da retomada, após afastamento ≥ 30 dias por doença/acidente/parto)', 'em_triagem', NULL),
    ('AFAST-080', 'CID restrito ao SST, com log próprio de acesso; gestor vê o afastamento, não o diagnóstico', 'negativo', 'critica', 'aprovado', 'O afastamento é público interno (a equipe precisa saber quem está fora e até quando); o DIAGNÓSTICO não é. O CID e o atestado ficam restritos ao SST/medicina, o gestor enxerga período e status sem o motivo clínico, e cada acesso ao CID gera log PRÓPRIO — a matriz do documento é explícita, e o "cofre do CID" (seção 29) é a evolução natural. A camada de perfil já protege atestados; o caso confere o conjunto: restrição + separação gestor/SST + log de acesso.', 'Atestados com CID no tenant de teste; usuários de perfis distintos (gestor, SST, DP).', '[{"acao": "Gestor consulta o afastamento de alguém da equipe", "ordem": 1, "resultado_esperado": "Vê período, tipo e status — SEM o CID/diagnóstico"}, {"acao": "SST consulta o mesmo registro", "ordem": 2, "resultado_esperado": "Vê o CID; o acesso entra em log específico (quem, quando, qual registro)"}, {"acao": "Perfil sem o módulo de saúde tenta ler atestados", "ordem": 3, "resultado_esperado": "Bloqueado pela camada perfil_restringe_leitura_atestados"}, {"acao": "Exportar relatório de afastamentos", "ordem": 4, "resultado_esperado": "CID protegido na exportação (seção 21)"}]', 'Todo mundo sabe que afastou; só a medicina sabe do quê — e fica registrado quem olhou.', 'Requisitos YE-DP-AFAST-001: CA-009 / RNF-002 / seção 22 / cenário "Permissões (CID)" (seção 25). PONTO BOM: perfil_restringe_leitura_atestados existe (uma das 20 tabelas protegidas). O que falta conferir: log específico de acesso ao CID e a separação gestor × SST dentro do mesmo tenant. Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080. | Requisitos YE-DP-ESC-001 (RN-013): o sigilo do CID com log de acesso vale também para os atestados do fluxo de abono — a folha usa período e validade, nunca o diagnóstico.', 'api', 'LGPD (Lei 13.709/2018), arts. 11 (dado de saúde é sensível) e 46; matriz de perfis do documento (seção 6)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'jornada-rotina/afastamentos'
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

-- Atestados (1 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('ATE-001', 'Atestado: registrar e recuperar', 'feliz', 'alta', 'aprovado', 'Verificar que um atestado medico e registrado e pode ser recuperado. Regra: o atestado guarda o afastamento do colaborador com seus dados. Importa porque atestados alimentam o controle de absenteismo, o eSocial e, em caso de acidente, a emissao de CAT — perder um registro desses tem consequencia legal.', 'Colaborador cadastrado no ambiente de teste.', '[{"acao": "Registrar um atestado para o colaborador", "dados": "Colaborador, data de inicio, quantidade de dias e CID (se houver)", "ordem": 1, "onde_na_tela": "Menu > Saude Ocupacional > Atestados > Novo", "resultado_esperado": "Atestado registrado"}, {"acao": "Recuperar o atestado registrado", "dados": "-", "ordem": 2, "onde_na_tela": "Atestados > lista ou busca", "resultado_esperado": "O atestado aparece com os dados informados, integros"}]', 'O atestado e gravado e recuperado com os mesmos dados. Nada se perde entre gravar e consultar.', 'IMPACTO SE FALHAR: atestados alimentam absenteismo, eSocial e a emissao de CAT em caso de acidente. Um registro perdido ou corrompido tem consequencia legal e previdenciaria. HISTORIA DESTE CASO: como o ADM-001, vem do agente de marco que testava em dados de clientes reais. Reescrito para o cercado. | Requisitos YE-DP-ESC-001: o registro básico segue aqui; a família ESC cobre encaminhamento >15 dias (ESC-010) e sobreposição (ESC-011).', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'saude-ocupacional/atestados'
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

-- Benefícios (15 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('BEN-001', 'Elegibilidade por cargo/vínculo/unidade é aplicada, não decorativa', 'feliz', 'alta', 'aprovado', 'O catálogo define QUEM pode receber cada benefício (cargo, vínculo, unidade, CCT) — e essa regra precisa ser aplicada na adesão: conceder benefício a quem não é elegível cria diferenciação sem critério (risco de equiparação) e custo sem controle; negar a quem a CCT garante é passivo direto.', 'Tipos de benefício com regras de elegibilidade cadastradas no ambiente de teste.', '[{"acao": "Cadastrar benefício restrito a um cargo", "ordem": 1, "resultado_esperado": "Regra registrada no catálogo"}, {"acao": "Tentar aderir colaborador de cargo não elegível", "ordem": 2, "resultado_esperado": "Bloqueio ou sinalização — a regra é conferida na adesão"}, {"acao": "Aderir colaborador elegível", "ordem": 3, "resultado_esperado": "Adesão registrada normalmente"}]', 'Regra de elegibilidade cadastrada é regra conferida na porta.', 'Requisitos YE-DP-BEN-001: RF-003. beneficios_tipos tem regras_cargo/regras_vinculo/regras_unidade — a sonda confere se alguém as LÊ.', 'api', 'CLT art. 458 c/c documento YE-DP-BEN-001, RF-003 (elegibilidade por cargo, porte, estabelecimento e CCT)', 'em_triagem', NULL),
    ('BEN-010', 'VT sem termo de opção: não concede, não desconta', 'negativo', 'critica', 'aprovado', 'O VT é OPTATIVO: sem o termo de opção (ou com renúncia registrada) não há concessão nem desconto — descontar 6% de quem não optou é desconto ilegal; conceder sem opção documentada perde a prova da natureza não salarial. A adesão de VT precisa carregar o vínculo com o termo assinado.', 'Fluxo de adesão a benefícios operante no ambiente de teste.', '[{"acao": "Registrar adesão de VT SEM termo de opção", "ordem": 1, "resultado_esperado": "Bloqueio ou pendência de termo — nunca adesão consumada em silêncio"}, {"acao": "Registrar a recusa do colaborador", "ordem": 2, "resultado_esperado": "Não opção documentada; sem concessão nem desconto; reopção possível"}, {"acao": "Anexar o termo e concluir a adesão", "ordem": 3, "resultado_esperado": "Adesão ativa com o termo vinculado (módulo Documentos)"}]', 'A opção do VT é documento — sem ele, nem vale, nem desconto.', 'Requisitos YE-DP-BEN-001: RN-001 / CA-001. A COLETA da opção na admissão é o ADM-050; aqui a cobrança é a trava na adesão do benefício — a sonda confere se existe sequer onde guardar o vínculo com o termo.', 'api', 'Lei 7.418/85 e Dec. 95.247/87 (VT mediante opção do empregado)', 'em_triagem', NULL),
    ('BEN-011', 'Desconto do VT: o menor entre 6% do salário básico e o custo real', 'feliz', 'critica', 'aprovado', 'A conta do VT tem dois tetos: o desconto é o MENOR entre 6% do salário básico e o custo real do transporte — passe barato desconta menos que 6%; passe caro desconta 6% e o empregador arca com o excedente. O reajuste salarial recalcula o teto na competência seguinte. Home office dispensa o VT.', 'Colaboradores com salários e custos de transporte distintos no ambiente de teste.', '[{"acao": "Calcular VT com custo ABAIXO de 6% do salário", "ordem": 1, "resultado_esperado": "Desconto = custo real (não os 6% cheios)"}, {"acao": "Calcular VT com custo ACIMA de 6%", "ordem": 2, "resultado_esperado": "Desconto = 6% do salário básico; excedente do empregador"}, {"acao": "Cadastrar desconto de VT acima de 6% no catálogo", "ordem": 3, "resultado_esperado": "Recusado ou limitado ao teto legal"}]', 'Seis por cento é teto, não tarifa — e o custo real pode ser menor.', 'Requisitos YE-DP-BEN-001: RN-001 / CA-002 / CA-011. O limite na FOLHA é o FOLHA-030; aqui a cobrança é o motor de cálculo do benefício e a trava no catálogo (percentual_desconto aceita qualquer número?).', 'api', 'Lei 7.418/85, art. 4º, parágrafo único (desconto de até 6% do salário básico, limitado ao custo)', 'em_triagem', NULL),
    ('BEN-012', 'VR/VA: desconto limitado (PAT/CCT), uso exclusivo e sem rebate ao empregador', 'negativo', 'alta', 'aprovado', 'O VR/VA no PAT tem três cercas: a participação do trabalhador é LIMITADA (parâmetro do PAT/CCT), o uso é exclusivo para alimentação, e é VEDADO o rebate/cashback ao empregador na contratação da fornecedora (Lei 14.442/22 — multa de até R$ 50 mil). Desconto acima do limite descaracteriza o benefício e derruba o incentivo fiscal.', 'Benefício de alimentação configurado no ambiente de teste.', '[{"acao": "Cadastrar VR com desconto acima do limite do PAT/CCT", "ordem": 1, "resultado_esperado": "Recusado ou limitado ao teto parametrizado"}, {"acao": "Aplicar o desconto na competência", "ordem": 2, "resultado_esperado": "Dentro do limite, com memória de cálculo"}, {"acao": "Conferir o contrato da fornecedora", "ordem": 3, "resultado_esperado": "Sem cláusula de rebate/desconto ao empregador — vedação registrada"}]', 'O VR alimenta o trabalhador — não o caixa da empresa.', 'Requisitos YE-DP-BEN-001: RN-003 / CA-003. O limite de desconto do PAT é parâmetro [VAL]; a sonda confere se existe teto parametrizado ou se o percentual é livre.', 'api', 'Lei 6.321/76 + Dec. 10.854/21 (PAT); Lei 14.442/22 (uso exclusivo; vedação de rebates; multas de R$ 5 mil a R$ 50 mil)', 'em_triagem', NULL),
    ('BEN-020', 'Benefício chega à Folha por rubrica com a incidência parametrizada', 'feliz', 'critica', 'aprovado', 'Cada benefício tem natureza própria: VT e VR (no PAT) não integram a remuneração; benefício mal configurado VIRA salário e gera passivo previdenciário retroativo. O caminho correto: a adesão gera rubricas (desconto do empregado, parcela patronal) com a incidência parametrizada por benefício e competência, e memória de cálculo — nada de lançamento manual solto na folha.', 'Adesões ativas e fechamento de folha no ambiente de teste.', '[{"acao": "Fechar a competência com adesões ativas", "ordem": 1, "resultado_esperado": "Rubricas de benefício geradas na folha automaticamente (desconto + patronal)"}, {"acao": "Conferir a incidência de cada rubrica", "ordem": 2, "resultado_esperado": "INSS/FGTS/IRRF conforme a natureza parametrizada do benefício, com memória"}, {"acao": "Alterar a parametrização de incidência", "ordem": 3, "resultado_esperado": "Vale para competências futuras; as fechadas preservam a regra da época"}]', 'Benefício sem rubrica automática é desconto manual esperando errar.', 'Requisitos YE-DP-BEN-001: RN-002/RN-004 / CA-004. A sonda confere se existe QUALQUER ponte beneficios_colaboradores → folha — hoje o desconto parece viver só no cadastro.', 'api', 'CLT art. 458; legislação de custeio (INSS/FGTS/IRRF); documento YE-DP-BEN-001, RF-009/RF-010', 'em_triagem', NULL),
    ('BEN-030', 'Dependente entra com regra conferida: idade, parentesco, documento', 'negativo', 'alta', 'aprovado', 'Dependente é cadastro com consequência dupla: vai para a OPERADORA (vidas e fatura) e reflete no IRRF do titular. A inclusão exige regra conferida — idade-limite, grau de parentesco, documentação — antes de enviar à operadora; dependente fora da regra descoberto na fatura é custo indevido e glosa retroativa.', 'Estrutura de dependentes por titular no ambiente de teste.', '[{"acao": "Incluir dependente válido (filho, com certidão)", "ordem": 1, "resultado_esperado": "Aceito; refletido no plano e no IRRF quando cabível"}, {"acao": "Tentar incluir dependente fora da regra (idade estourada, sem documento)", "ordem": 2, "resultado_esperado": "Bloqueio ou pendência de comprovação — não segue à operadora"}, {"acao": "Dependente atinge a idade-limite", "ordem": 3, "resultado_esperado": "Alerta de vencimento antes da exclusão/ajuste"}]', 'Dependente é vida na fatura e linha no IRRF — entra só com prova.', 'Requisitos YE-DP-BEN-001: RF-005 / RN-007 / CA-006. A sonda confere se a estrutura de dependentes sequer existe no banco.', 'api', 'Lei 9.656/98 (dependentes no plano); RIR/IRRF (dependentes na tributação); documento YE-DP-BEN-001, RF-005/RN-007', 'em_triagem', NULL),
    ('BEN-040', 'Rescisão com plano de saúde: manutenção dos arts. 30/31 calculada e comunicada', 'alternativo', 'critica', 'aprovado', 'Demitido sem justa causa que CONTRIBUIU para o plano tem direito de mantê-lo — por 1/3 do tempo de contribuição (mínimo 6, máximo 24 meses), assumindo o custo integral, com opção em ATÉ 30 DIAS da comunicação; aposentado com 10+ anos, vitalício. Perder o prazo de comunicar é a ação judicial mais previsível do pós-rescisão: o sistema deve calcular a elegibilidade, o prazo e o custo, e registrar a opção do ex-empregado.', 'Desligamento de colaborador com plano de saúde contributário no ambiente de teste.', '[{"acao": "Iniciar rescisão sem justa causa de titular que contribuía", "ordem": 1, "resultado_esperado": "Elegibilidade dos arts. 30/31 verificada; período de manutenção calculado"}, {"acao": "Comunicar o ex-empregado", "ordem": 2, "resultado_esperado": "Prazo de 30 dias controlado; custo integral informado; termo gerado"}, {"acao": "Registrar a opção (manter/recusar)", "ordem": 3, "resultado_esperado": "Decisão arquivada; vidas na operadora ajustadas conforme a escolha"}]', 'O plano não morre com o contrato — morre com o prazo de opção perdido.', 'Requisitos YE-DP-BEN-001: RN-005/RN-006 / CA-005 / RF-013. Nada disso existe hoje — a sonda confere. A baixa das demais verbas é a família DESL.', 'api', 'Lei 9.656/98, arts. 30 e 31 + RN ANS (manutenção: 1/3 do tempo, mín. 6 e máx. 24 meses; aposentado 10+ anos: vitalício; opção em 30 dias, custo integral)', 'em_triagem', NULL),
    ('BEN-042', 'Fatura da operadora só é paga depois de conciliada: vidas, valores, coparticipação', 'negativo', 'alta', 'aprovado', 'A fatura mensal da operadora é conferida contra a base: vidas ativas × cobradas, mensalidades por faixa, coparticipação por uso. Divergência (vida fantasma de ex-colaborador, dependente excluído ainda cobrado, coparticipação atípica) BLOQUEIA o pagamento automático e vira glosa com ação de conciliação. Pagar fatura às cegas é assinar custo indevido todo mês.', 'Estrutura de operadoras, movimentações e faturas no ambiente de teste.', '[{"acao": "Importar fatura com as mesmas vidas do sistema", "ordem": 1, "resultado_esperado": "Conciliada; liberada para pagamento"}, {"acao": "Importar fatura com vida a mais (ex-colaborador)", "ordem": 2, "resultado_esperado": "Divergência apontada; pagamento bloqueado; glosa sugerida"}, {"acao": "Registrar a glosa e o acerto", "ordem": 3, "resultado_esperado": "Trilha da conciliação completa, com ação no Plano de Ação"}]', 'Fatura confere primeiro, paga depois — nunca o contrário.', 'Requisitos YE-DP-BEN-001: RF-002/RF-011/RF-012 / RN-013. Não há estrutura de operadoras, movimentações nem faturas hoje — a sonda confere.', 'api', 'Documento YE-DP-BEN-001, RN-013 / CA-007 (fatura paga só após conciliação; divergência gera glosa)', 'em_triagem', NULL),
    ('BEN-050', 'VT/VR proporcionais aos dias efetivos — o Ponto alimenta o benefício', 'feliz', 'alta', 'aprovado', 'VT e VR são concedidos por dia EFETIVO: férias, afastamentos e faltas reduzem a concessão do período (e o desconto correspondente). O Ponto já sabe os dias de cada colaborador na competência — o benefício deve consumir esse dado, não repetir um valor fixo todo mês enquanto o colaborador está afastado há sessenta dias.', 'Colaborador com afastamento parcial na competência no ambiente de teste.', '[{"acao": "Apurar VT/VR de colaborador que trabalhou o mês inteiro", "ordem": 1, "resultado_esperado": "Concessão cheia pelos dias úteis efetivos"}, {"acao": "Apurar com 10 dias de afastamento no mês", "ordem": 2, "resultado_esperado": "Concessão e desconto proporcionais aos dias efetivos"}, {"acao": "Conferir a memória", "ordem": 3, "resultado_esperado": "Dias vindos do Ponto, rastreáveis na memória de cálculo"}]', 'Benefício de ir trabalhar acompanha os dias em que se trabalhou.', 'Requisitos YE-DP-BEN-001: RN-011 / RF-018. beneficios_colaboradores guarda valor fixo — a sonda confere se algo consome os dias do Ponto.', 'api', 'Dec. 95.247/87 (VT por deslocamento efetivo); documento YE-DP-BEN-001, RN-011 / RF-018', 'em_triagem', NULL),
    ('BEN-051', 'Benefício instituído por CCT entra pela vigência, com tabela versionada', 'feliz', 'media', 'aprovado', 'A CCT institui e reajusta benefícios (cesta, VR mínimo, seguro de vida obrigatório) por categoria e vigência. O módulo precisa da camada de parametrização por instrumento: benefício/valor valem A PARTIR da vigência da convenção, a tabela anterior fica versionada, e a troca de CCT não reescreve competências fechadas.', 'Instrumento coletivo com benefício instituído no ambiente de teste.', '[{"acao": "Registrar CCT nova com VR mínimo maior", "ordem": 1, "resultado_esperado": "Valor novo aplicado a partir da vigência"}, {"acao": "Consultar competência anterior à vigência", "ordem": 2, "resultado_esperado": "Valor antigo preservado (tabela versionada)"}, {"acao": "Conferir colaboradores de outra categoria", "ordem": 3, "resultado_esperado": "Não afetados — a CCT vale por categoria"}]', 'A convenção manda no benefício — a partir da data dela, para a categoria dela.', 'Requisitos YE-DP-BEN-001: RN-010 / CA-009. A camada CCT existe para ponto/folha (ponto_cct_config, folha_cct) — a sonda confere se alcança os benefícios.', 'api', 'CF art. 7º, XXVI (reconhecimento das convenções coletivas); documento YE-DP-BEN-001, RN-010 / CA-009', 'em_triagem', NULL),
    ('BEN-060', 'Toda adesão gera termo assinado, arquivado no módulo Documentos', 'feliz', 'alta', 'aprovado', 'O termo é a prova do benefício: da opção (ou recusa) do VT, da adesão ao VR/plano com as condições e dependentes, da manutenção dos arts. 30/31. Cada adesão gera o termo, colhe a assinatura com trilha (o padrão da casa) e arquiva no módulo Documentos com metadados — adesão sem termo é benefício sem defesa na fiscalização.', 'Fluxo de adesão operante no ambiente de teste.', '[{"acao": "Concluir uma adesão", "ordem": 1, "resultado_esperado": "Termo gerado e assinatura colhida com trilha"}, {"acao": "Buscar o termo na pasta do colaborador", "ordem": 2, "resultado_esperado": "Arquivado no módulo Documentos, com metadados e versão"}, {"acao": "Registrar uma recusa (VT)", "ordem": 3, "resultado_esperado": "Termo de recusa igualmente arquivado — a não opção também é prova"}]', 'Adesão sem termo arquivado é aposta; com termo, é gestão.', 'Requisitos YE-DP-BEN-001: RN-012 / CA-010. O padrão de assinatura existe (ADM-070/DESL-082); a sonda confere se a adesão tem onde ancorar o termo.', 'api', 'Lei 7.418/85 (opção do VT por escrito); MP 2.200-2/2001 (assinatura eletrônica); documento YE-DP-BEN-001, RN-012 / RF-017', 'em_triagem', NULL),
    ('BEN-070', 'PLR sem acordo válido não é tratada como PLR isenta', 'negativo', 'media', 'aprovado', 'A isenção de encargos da PLR é condicionada: acordo PRÉVIO negociado (comissão paritária com sindicato), no máximo dois pagamentos por ano, IR em tabela exclusiva. Pagamento rotulado de PLR sem acordo válido é salário disfarçado — INSS, FGTS e reflexos retroativos. O sistema deve exigir o acordo antes de tratar o pagamento como PLR.', 'Programa de PLR configurado no ambiente de teste.', '[{"acao": "Registrar pagamento de PLR SEM acordo arquivado", "ordem": 1, "resultado_esperado": "Risco de perda da isenção sinalizado — não passa como PLR isenta em silêncio"}, {"acao": "Arquivar o acordo (comissão + sindicato) e pagar", "ordem": 2, "resultado_esperado": "PLR com IR próprio e sem integração salarial"}, {"acao": "Tentar o terceiro pagamento no ano", "ordem": 3, "resultado_esperado": "Bloqueio/alerta — o limite é de dois por ano"}]', 'PLR sem acordo é salário com outro nome — e a Receita sabe.', 'Requisitos YE-DP-BEN-001: RN-008 / CA-012 / RF-014. Estrutura de PLR não existe hoje — a sonda confere.', 'api', 'Lei 10.101/2000 (PLR: negociação prévia com comissão paritária + sindicato; máx. 2 pagamentos/ano; IR em tabela própria; não integra salário)', 'em_triagem', NULL),
    ('BEN-071', 'Consignado desconta só até a margem consignável', 'negativo', 'media', 'aprovado', 'O desconto de consignado em folha tem teto legal: a margem consignável sobre a remuneração disponível. Descontar acima da margem é ilegal e deixa o líquido do colaborador abaixo do mínimo vital — o sistema precisa conhecer a margem, validar cada novo contrato contra ela e bloquear o desconto excedente.', 'Convênio de consignado configurado no ambiente de teste.', '[{"acao": "Registrar consignado dentro da margem", "ordem": 1, "resultado_esperado": "Desconto aplicado em folha normalmente"}, {"acao": "Tentar novo contrato que estoura a margem", "ordem": 2, "resultado_esperado": "Bloqueado ou limitado ao teto, com alerta ao DP"}, {"acao": "Salário reduzido (afastamento)", "ordem": 3, "resultado_esperado": "Margem recalculada; desconto ajustado"}]', 'A margem é o limite do bolso — o sistema segura a caneta.', 'Requisitos YE-DP-BEN-001: RN-009 / CA-008 / RF-015. Estrutura de consignado/margem não existe hoje — a sonda confere.', 'api', 'Lei 10.820/2003 (empréstimo consignado; margem consignável)', 'em_triagem', NULL),
    ('BEN-080', 'Adesão a plano de saúde é dado sensível: leitura restrita e logada', 'negativo', 'critica', 'aprovado', 'A lista de quem tem plano de saúde, com dependentes e valores, é dado de saúde por inferência — e o tráfego com a operadora leva ainda mais (faixas, coparticipação por uso). O acesso deve ser o mínimo necessário (a camada de perfil da casa), com log de consulta; o gestor vê custo agregado, não a vida de cada um.', 'Adesões de saúde registradas no ambiente de teste.', '[{"acao": "Consultar adesões como usuário comum do tenant", "ordem": 1, "resultado_esperado": "Leitura restrita por perfil — não é vitrine do tenant inteiro"}, {"acao": "Acessar como perfil autorizado", "ordem": 2, "resultado_esperado": "Funciona e fica logado (quem, quando, o quê)"}, {"acao": "Conferir o tráfego com a operadora", "ordem": 3, "resultado_esperado": "Mínimo indispensável, por canal seguro, sem diagnóstico"}]', 'Quem tem plano, quem depende de quem — isso é saúde, e saúde é sigilo.', 'Requisitos YE-DP-BEN-001: RN-014 / seção 22. beneficios_colaboradores tem leitura aberta ao tenant ("Usuários podem ver benefícios do tenant") sem política perfil_restringe_leitura_* — mesma família do FOLHA-090/EPI-041; a sonda confere.', 'api', 'LGPD art. 5º, II e art. 11 (dado de saúde); documento YE-DP-BEN-001, RN-014 / seção 22', 'em_triagem', NULL),
    ('BEN-090', 'Portal do colaborador: optar, aderir, simular desconto e ver carteirinha', 'feliz', 'media', 'aprovado', 'O autoatendimento fecha o ciclo: o colaborador vê os benefícios elegíveis, simula o impacto no líquido antes de optar, adere com assinatura, inclui dependentes com upload de documentos e consulta descontos e carteirinhas — cada um vendo apenas o que é seu. Menos fila no DP, mais prova documental.', 'Portal do colaborador com benefícios habilitados no ambiente de teste.', '[{"acao": "Abrir o portal → benefícios", "ordem": 1, "resultado_esperado": "Elegíveis listados com simulação de desconto no líquido"}, {"acao": "Aderir e assinar", "ordem": 2, "resultado_esperado": "Termo assinado; adesão pendente/ativa conforme o fluxo"}, {"acao": "Consultar descontos e carteirinha", "ordem": 3, "resultado_esperado": "Somente os próprios dados; histórico visível"}]', 'O benefício se explica sozinho no portal — e deixa prova ao aderir.', 'Requisitos YE-DP-BEN-001: RF-019. Caso de tela (Cypress).', 'e2e', 'Documento YE-DP-BEN-001, RF-019 (autoatendimento no Portal/App)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'jornada-rotina/beneficios'
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

-- Cargos (5 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('CARGO-001', 'Criar cargo ligado a um departamento', 'feliz', 'alta', 'aprovado', 'Verificar a criacao de um cargo ligado a um departamento, com faixa salarial. Regra: um cargo tem nome, pode ter faixa salarial e pode pertencer a um departamento. Importa porque cargos definem funcoes e faixas de remuneracao — base para folha e organograma.', 'Precisa existir um departamento para ligar o cargo (embora o vinculo seja opcional).', '[{"acao": "Abrir novo cargo", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Estrutura Organizacional > Cargos > Novo Cargo", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher nome, faixa salarial e departamento", "dados": "Nome: Analista de RH | Min: 3000 | Max: 5000 | Departamento: Recursos Humanos", "ordem": 2, "onde_na_tela": "Campos Nome, Salario Minimo, Salario Maximo, Departamento", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Cargo criado, ligado ao departamento, com a faixa salarial"}]', 'O cargo Analista de RH existe, ligado a Recursos Humanos, com faixa de 3000 a 5000.', 'IMPACTO SE FALHAR: sem cadastrar cargos, nao ha como definir funcoes e faixas salariais — a estrutura de remuneracao e o organograma ficam incompletos.', 'api', NULL, 'em_triagem', NULL),
    ('CARGO-010', 'Nome de cargo duplicado no cliente e recusado', 'negativo', 'alta', 'aprovado', 'Verificar que um nome de cargo duplicado no mesmo cliente e recusado. Regra: UNIQUE(tenant_id, nome) — o nome do cargo e unico no cliente. Importa porque dois cargos "Gerente" iguais confundem alocacao e relatorios de funcao.', 'Precisa existir um cargo com um nome conhecido.', '[{"acao": "Criar um cargo", "dados": "Nome: Gerente", "ordem": 1, "onde_na_tela": "Novo Cargo", "resultado_esperado": "Criado"}, {"acao": "Tentar criar OUTRO cargo com o mesmo nome", "dados": "Nome: Gerente (repetido)", "ordem": 2, "onde_na_tela": "Novo Cargo", "resultado_esperado": "O sistema DEVE recusar"}]', 'O segundo Gerente e recusado. So um cargo com esse nome no cliente.', 'IMPACTO SE FALHAR: cargos de nome repetido tornam ambiguo qual funcao uma pessoa ocupa, confundindo folha e relatorios de cargo.', 'api', NULL, 'em_triagem', NULL),
    ('CARGO-011', 'Cargo sem departamento e permitido', 'alternativo', 'media', 'aprovado', 'Verificar que um cargo pode existir sem departamento. Regra: departamento_id e opcional no cargo. Importa porque nem todo cargo se encaixa numa area (ex.: cargos transversais) ou o departamento ainda nao foi definido.', 'Nenhuma.', '[{"acao": "Abrir novo cargo", "dados": "-", "ordem": 1, "onde_na_tela": "Cargos > Novo Cargo", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher so o nome, deixar departamento em branco", "dados": "Nome: Consultor Externo | Departamento: (nenhum)", "ordem": 2, "onde_na_tela": "Campo Nome (Departamento vazio)", "resultado_esperado": "Aceito sem departamento"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Cargo criado sem departamento"}]', 'O cargo Consultor Externo e criado sem departamento associado, sem erro.', 'IMPACTO SE FALHAR: se o departamento fosse obrigatorio, cargos transversais ou ainda nao alocados nao poderiam ser cadastrados — trava desnecessaria.', 'api', NULL, 'em_triagem', NULL),
    ('CARGO-012', 'Faixa salarial com minimo maior que maximo', 'excecao', 'media', 'aprovado', 'Verificar o que acontece ao informar faixa salarial com minimo MAIOR que o maximo. Regra esperada: o minimo deveria ser <= maximo. Este caso revela se o banco tem essa validacao de coerencia. Importa porque uma faixa invertida (min 8000, max 3000) e um dado sem sentido que distorce relatorios de remuneracao.', 'Formulario de cargo com os campos de salario.', '[{"acao": "Abrir novo cargo", "dados": "-", "ordem": 1, "onde_na_tela": "Cargos > Novo Cargo", "resultado_esperado": "Formulario aberto"}, {"acao": "Informar faixa salarial INVERTIDA", "dados": "Nome: Cargo Invertido | Salario Minimo: 8000 | Salario Maximo: 3000 (min > max, incoerente)", "ordem": 2, "onde_na_tela": "Campos Salario Minimo e Salario Maximo", "resultado_esperado": "Idealmente o sistema DEVERIA recusar (min nao pode ser maior que max)"}]', 'A faixa invertida deveria ser RECUSADA. ACHADO ATUAL: o banco ACEITA min > max — nao ha CHECK de coerencia entre salario minimo e maximo. Um cargo com faixa sem sentido entra.', 'IMPACTO SE FALHAR (e falha hoje): faixa salarial invertida distorce relatorios de remuneracao e faixas por cargo — calculos que assumem min<=max dao resultado errado. CORRECAO SUGERIDA: adicionar CHECK (salario_min IS NULL OR salario_max IS NULL OR salario_min <= salario_max) na tabela de cargos.', 'api', NULL, 'em_triagem', NULL),
    ('CARGO-022', 'Cargo de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que um cargo de um cliente e invisivel para outro cliente. Regra: isolamento multi-tenant vale para cargos. Importa porque a estrutura de cargos e faixas salariais de um cliente e informacao sensivel que nao pode vazar para outro.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar um cargo", "dados": "Nome: Cargo Secreto do A | faixa 5000-9000", "ordem": 1, "onde_na_tela": "Cliente A > Novo Cargo", "resultado_esperado": "Criado no cliente A"}, {"acao": "Entrar como cliente B e procurar esse cargo", "dados": "Buscar pelo nome do cargo do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Cargos > busca", "resultado_esperado": "O cargo do cliente A NAO aparece para o cliente B"}]', 'O cargo do cliente A e invisivel no cliente B. Zero vazamento de estrutura de cargos e salarios entre clientes.', 'IMPACTO SE FALHAR: exporia a estrutura de cargos e faixas salariais de um cliente para outro — informacao estrategica e sensivel. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/cargos'
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


-- (3) PONTES — 37 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('AFAST-001', 'qa_caso_afast_001', true),
    ('AFAST-002', 'qa_caso_afast_002', true),
    ('AFAST-003', 'qa_caso_afast_003', true),
    ('AFAST-010', 'qa_caso_afast_010', true),
    ('AFAST-011', 'qa_caso_afast_011', true),
    ('AFAST-020', 'qa_caso_afast_020', true),
    ('AFAST-021', 'qa_caso_afast_021', true),
    ('AFAST-022', 'qa_caso_afast_022', true),
    ('AFAST-030', 'qa_caso_afast_030', true),
    ('AFAST-031', 'qa_caso_afast_031', true),
    ('AFAST-032', 'qa_caso_afast_032', true),
    ('AFAST-040', 'qa_caso_afast_040', true),
    ('AFAST-050', 'qa_caso_afast_050', true),
    ('AFAST-051', 'qa_caso_afast_051', true),
    ('AFAST-060', 'qa_caso_afast_060', true),
    ('AFAST-070', 'qa_caso_afast_070', true),
    ('AFAST-080', 'qa_caso_afast_080', true),
    ('ATE-001', 'qa_caso_ate_001', true),
    ('BEN-001', 'qa_caso_ben_001', true),
    ('BEN-010', 'qa_caso_ben_010', true),
    ('BEN-011', 'qa_caso_ben_011', true),
    ('BEN-012', 'qa_caso_ben_012', true),
    ('BEN-020', 'qa_caso_ben_020', true),
    ('BEN-030', 'qa_caso_ben_030', true),
    ('BEN-040', 'qa_caso_ben_040', true),
    ('BEN-042', 'qa_caso_ben_042', true),
    ('BEN-050', 'qa_caso_ben_050', true),
    ('BEN-051', 'qa_caso_ben_051', true),
    ('BEN-060', 'qa_caso_ben_060', true),
    ('BEN-070', 'qa_caso_ben_070', true),
    ('BEN-071', 'qa_caso_ben_071', true),
    ('BEN-080', 'qa_caso_ben_080', true),
    ('CARGO-001', 'qa_caso_cargo_001', true),
    ('CARGO-010', 'qa_caso_cargo_010', true),
    ('CARGO-011', 'qa_caso_cargo_011', true),
    ('CARGO-012', 'qa_caso_cargo_012', true),
    ('CARGO-022', 'qa_caso_cargo_022', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 38, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('AFAST-001'), ('AFAST-002'), ('AFAST-003'), ('AFAST-010'), ('AFAST-011'), ('AFAST-020'), ('AFAST-021'), ('AFAST-022'), ('AFAST-030'), ('AFAST-031'), ('AFAST-032'), ('AFAST-040'), ('AFAST-050'), ('AFAST-051'), ('AFAST-060'), ('AFAST-070'), ('AFAST-080'), ('ATE-001'), ('BEN-001'), ('BEN-010'), ('BEN-011'), ('BEN-012'), ('BEN-020'), ('BEN-030'), ('BEN-040'), ('BEN-042'), ('BEN-050'), ('BEN-051'), ('BEN-060'), ('BEN-070'), ('BEN-071'), ('BEN-080'), ('BEN-090'), ('CARGO-001'), ('CARGO-010'), ('CARGO-011'), ('CARGO-012'), ('CARGO-022')),
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
