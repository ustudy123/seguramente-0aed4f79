-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 2 de 15
-- 13º Salário, Admissao (1 de 2) e Admissao (2 de 2)
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

-- (1) ROTINAS — 47 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid; v_status text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao em andamento';
  r.esperado    := 'Admissao criada, status avanca para aprovado e persiste';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status)
  VALUES (v_t, '[QA-ADM] Candidato Teste', public.qa_cpf(188),
          'qa.adm.1@sandbox.invalid', 'Analista (teste)', 'rascunho')
  RETURNING id INTO v_id;

  r.passo_ordem := 2;
  r.passo_acao  := 'Verificar que a admissao existe com o status inicial';
  PERFORM 1 FROM public.admissoes WHERE id = v_id AND status = 'rascunho';
  IF NOT FOUND THEN
    r.situacao := 'falhou'; r.obtido := 'Admissao nao encontrada apos criar.';
    RETURN r;
  END IF;

  r.passo_ordem := 3;
  r.passo_acao  := 'Avancar o status da admissao para aprovada';
  UPDATE public.admissoes SET status = 'aprovado' WHERE id = v_id;

  r.passo_ordem := 4;
  r.passo_acao  := 'Confirmar que o novo status persistiu';
  SELECT status INTO v_status FROM public.admissoes WHERE id = v_id;
  IF v_status = 'aprovado' THEN
    r.situacao := 'passou';
    r.obtido   := 'Admissao criada, avancada para aprovado e persistida.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Status esperado aprovado, obtido %s.', v_status);
  END IF;
  r.detalhe := jsonb_build_object('admissao_id', v_id);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_cpf text := public.qa_cpf(200002); v_aceitou boolean := false; v_fmt boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao concluida com CPF conhecido';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-ADM-002] Primeiro', v_cpf, 'qa.adm002a@sandbox.invalid',
          'Operador', 'concluido', CURRENT_DATE - 100);

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar segunda admissao ATIVA com o mesmo CPF';
  r.esperado    := 'Recusado — o CPF e a chave do trabalhador no eSocial';
  BEGIN
    INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
    VALUES (v_t, '[QA-ADM-002] Segundo', v_cpf, 'qa.adm002b@sandbox.invalid',
            'Operador', 'concluido', CURRENT_DATE);
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Tentar com o mesmo CPF formatado com pontuacao';
  BEGIN
    INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
    VALUES (v_t, '[QA-ADM-002] Terceiro', public.qa_cpf_formatado(v_cpf),
            'qa.adm002c@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE);
    v_fmt := true;
  EXCEPTION WHEN OTHERS THEN v_fmt := false;
  END;

  IF NOT v_aceitou AND NOT v_fmt THEN
    r.situacao := 'passou';
    r.obtido   := 'Duplicidade recusada nas duas formas.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Duplicidade de CPF ACEITA em admissoes (sem pontuacao: %s; com '
               || 'pontuacao: %s). Nao ha indice unico protegendo o CPF na tabela admissoes. '
               || 'Duas admissoes ativas para a mesma pessoa produziriam dois vinculos no '
               || 'eSocial, onde o CPF e a chave do trabalhador. Mesma raiz do COLAB-033. '
               || 'Correcao: normalizar o CPF na escrita e indice unico parcial sobre '
               || 'admissoes ativas — preservando a readmissao, que e legitima.',
               v_aceitou, v_fmt);
    r.detalhe  := jsonb_build_object('aceitou_cpf_cru', v_aceitou, 'aceitou_cpf_formatado', v_fmt);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_n int; v_duplicou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao e o checklist de documentos';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-ADM-003] Colaborador', public.qa_cpf(200003), 'qa.adm003@sandbox.invalid',
          'Operador', 'rascunho', CURRENT_DATE)
  RETURNING id INTO v_adm;

  INSERT INTO public.admissao_documentos (admissao_id, tenant_id, nome, tipo, obrigatorio)
  VALUES (v_adm, v_t, 'RG', 'identidade', true),
         (v_adm, v_t, 'CPF', 'identidade', true),
         (v_adm, v_t, 'Exame Admissional', 'saude', true);

  r.passo_ordem := 2;
  r.passo_acao  := 'Reprocessar a criacao do checklist com os mesmos nomes';
  r.esperado    := 'Recusado pelo indice unico — a lista nao dobra';
  BEGIN
    INSERT INTO public.admissao_documentos (admissao_id, tenant_id, nome, tipo, obrigatorio)
    VALUES (v_adm, v_t, 'RG', 'identidade', true);
    v_duplicou := true;
  EXCEPTION WHEN unique_violation THEN v_duplicou := false;
  END;

  SELECT count(*) INTO v_n FROM public.admissao_documentos WHERE admissao_id = v_adm;

  IF NOT v_duplicou AND v_n = 3 THEN
    r.situacao := 'passou';
    r.obtido   := 'Reprocessamento recusado pelo indice admissao_documentos_admissao_nome_uidx. '
               || 'A lista segue com 3 itens. O bug que dobrava o checklist para 18 esta '
               || 'protegido por trava real, nao por disciplina de codigo.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('O checklist duplicou: %s item(ns) apos o reprocessamento. O indice '
               || 'unico admissao_documentos_admissao_nome_uidx nao esta segurando, e o upsert '
               || 'do codigo depende dele. Sem o indice, o ON CONFLICT vira decorativo e o bug '
               || 'de lista dobrada volta.', v_n);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(7020);
        v_aceitou_100 boolean := false; v_aceitou_105 boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar contrato de experiência com primeiro período de 100 dias';
  r.esperado := 'Recusado — o art. 445, parágrafo único, limita a 90 dias somados';
  BEGIN
    INSERT INTO public.contratos_experiencia
      (tenant_id, colaborador_nome, colaborador_cpf, data_admissao,
       duracao_primeiro_periodo, data_fim_primeiro_periodo, status)
    VALUES (public.qa_sandbox_tenant_id(), 'QA Experiência 100', v_cpf,
            CURRENT_DATE, 100, CURRENT_DATE + 99, 'ativo');
    v_aceitou_100 := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou_100 := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'Gravar experiência de 60 dias prorrogada por mais 45 (105 no total)';
  r.esperado := 'Recusado — a soma período + prorrogação também respeita o teto de 90';
  BEGIN
    INSERT INTO public.contratos_experiencia
      (tenant_id, colaborador_nome, colaborador_cpf, data_admissao,
       duracao_primeiro_periodo, data_fim_primeiro_periodo,
       prorrogado, duracao_prorrogacao, data_inicio_prorrogacao, data_fim_prorrogacao, status)
    VALUES (public.qa_sandbox_tenant_id(), 'QA Experiência 105', public.qa_cpf(7021),
            CURRENT_DATE, 60, CURRENT_DATE + 59,
            true, 45, CURRENT_DATE + 60, CURRENT_DATE + 104, 'prorrogado');
    v_aceitou_105 := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou_105 := false; END;

  IF v_aceitou_100 OR v_aceitou_105 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o banco aceitou experiência fora do teto legal (100 dias '
             || 'diretos: %s; 60+45=105 com prorrogação: %s) — contratos_experiencia não tem '
             || 'NENHUM CHECK sobre as durações. Experiência acima de 90 dias descaracteriza '
             || 'o prazo: o contrato vira indeterminado por força de lei, com as verbas da '
             || 'conversão. O ponto estrutural bom: "prorrogado" é boolean — a SEGUNDA '
             || 'prorrogação não tem onde existir (art. 451 atendido por desenho). Correção: '
             || 'CHECK duracao_primeiro_periodo BETWEEN 1 AND 90 e '
             || 'CHECK (coalesce(duracao_primeiro_periodo,0) + coalesce(duracao_prorrogacao,0)) <= 90.',
             CASE WHEN v_aceitou_100 THEN 'aceito' ELSE 'recusado' END,
             CASE WHEN v_aceitou_105 THEN 'aceito' ELSE 'recusado' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Os dois contratos acima de 90 dias foram recusados; a prorrogação única já é '
             || 'estrutural (campo booleano).';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_col text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o contrato por prazo determinado tem data de término controlada?';
  r.esperado := 'Campo de fim do contrato + validação do teto de 2 anos e da prorrogação única';
  v_col := coalesce(public.qa_col_existe('admissoes', '%fim_contrato%'),
                    public.qa_col_existe('admissoes', '%data_fim%'),
                    public.qa_col_existe('admissoes', '%prazo_determinado%'));
  -- funções que tratem o TETO/prorrogação do determinado (não basta a palavra
  -- "determinado", que aparece em textos como CLT_PRAZO_INDETERMINADO)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%determinado%' AND p.prosrc ILIKE '%prorrog%'
    AND p.proname NOT ILIKE '%afastamento%';
  IF v_col IS NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a modalidade "prazo determinado" não tem onde viver — admissoes.tipo_contrato '
             || 'é texto livre e não existe campo de data de término nem função que valide o teto '
             || 'de 2 anos e a prorrogação única do art. 451 (só a EXPERIÊNCIA tem tabela própria, '
             || 'contratos_experiencia). Um determinado de 30 meses entra sem resistência e, '
             || 'vencido o prazo sem controle, o contrato segue como se indeterminado fosse — '
             || 'sem alerta de término, sem termo. Correção: estruturar prazo determinado como a '
             || 'experiência (fim, prorrogação única, alertas de vencimento).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Controle presente (campo: %s; funções: %s).',
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a modalidade intermitente tem estrutura própria?';
  r.esperado := 'Valor da hora (≥ mínimo e ≥ pares da função) e cláusulas de convocação/aceite';
  v_est := coalesce(public.qa_col_existe(NULL, '%intermitente%'),
                    public.qa_col_existe(NULL, '%valor_hora%'),
                    public.qa_fns_com('%intermitente%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o contrato intermitente não existe no banco — nenhuma coluna ou função '
             || 'trata a modalidade. O art. 452-A exige contrato ESCRITO com o valor da hora '
             || '(nunca inferior ao mínimo horário nem ao dos demais na mesma função) e o rito '
             || 'de convocação com 3 dias de antecedência. Se a empresa admitir um intermitente '
             || 'hoje, ele entra como texto livre em tipo_contrato, sem as cláusulas que '
             || 'sustentam a modalidade — e sem elas o vínculo tende à forma comum. Correção: '
             || 'estrutura mínima (valor_hora + modelo de contrato próprio) antes de ofertar a '
             || 'modalidade. Cláusulas finais são [VAL] jurídico (seção 30 do documento).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar admissão de candidato com 15 anos em contrato comum (não aprendiz)';
  r.esperado := 'Recusado — menor de 16 só entra na condição de aprendiz (a partir dos 14)';
  BEGIN
    INSERT INTO public.admissoes
      (tenant_id, nome_completo, cpf, cargo, data_nascimento, data_admissao, tipo_contrato)
    VALUES (public.qa_sandbox_tenant_id(), 'QA Menor Quinze', public.qa_cpf(7030),
            'Auxiliar', CURRENT_DATE - interval '15 years', CURRENT_DATE + 10,
            'CLT_PRAZO_INDETERMINADO');
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco aceitou admissão COMUM de um candidato de 15 anos — nada '
             || 'valida a idade na data de início contra a modalidade. A CF (art. 7º, XXXIII) '
             || 'proíbe qualquer trabalho antes dos 16, salvo aprendiz a partir dos 14: essa '
             || 'admissão é nula e expõe a empresa a autuação imediata. Correção: validação '
             || 'idade × modalidade na gravação (16+ para contrato comum; 14-15 somente '
             || 'aprendiz, com a documentação do programa), bloqueando na fonte, não na tela.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'A admissão comum do menor de 16 foi recusada na gravação.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém cruza a idade do admitido com riscos da função e turno?';
  r.esperado := 'Menor de 18 barrado em jornada noturna e em função insalubre/perigosa (CLT arts. 404/405)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%data_nascimento%'
    AND (p.prosrc ILIKE '%noturn%' OR p.prosrc ILIKE '%insalubr%' OR p.prosrc ILIKE '%perigos%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função cruza data_nascimento com risco da função ou turno — '
             || 'um colaborador de 17 anos pode ser alocado em escala noturna ou em função '
             || 'insalubre/perigosa sem nenhum aviso. A vedação é absoluta (CF art. 7º XXXIII; '
             || 'CLT arts. 404/405): não há adicional que a compense, e o SST já cadastra os '
             || 'riscos por função — falta só o cruzamento na admissão e na troca de '
             || 'função/escala. Correção: trava idade × (risco da função, período da escala) '
             || 'nos dois momentos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cruzamento presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cols text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os campos de cota de aprendiz são calculados por alguém?';
  r.esperado := 'Base × 5%..15% por estabelecimento, com o realizado atualizado pelas admissões';
  v_cols := public.qa_col_existe('empresa_cadastro', 'aprendiz%');
  v_fns := public.qa_fns_com('%aprendiz%');
  IF v_cols IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: os campos existem (%s) e NENHUMA função os calcula ou atualiza '
             || '— são decorativos, preenchidos à mão. Compare com a cota de PcD, que tem o '
             || 'gatilho recalcular_cota_pcd: a de aprendiz (art. 429, 5%% a 15%% das funções '
             || 'que demandam formação) ficou sem motor. E a admissão não marca ninguém como '
             || 'aprendiz (tipo_contrato é texto livre), então o "realizado" não tem fonte. '
             || 'Correção: espelhar o desenho da cota de PcD — cálculo por faixa no gatilho e '
             || 'realizado derivado das admissões de aprendiz ativas.', v_cols);
  ELSIF v_cols IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'Os campos de cota de aprendiz não existem mais em empresa_cadastro.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Cota de aprendiz calculada em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_emp uuid; v_pct numeric; v_pct2 numeric; v_col text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar estabelecimento com 120 ativos e cota obrigatória; depois crescer para 600';
  r.esperado := 'Percentual recalculado por faixa: 2% (100-200) e 4% (501-1000)';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, pcd_obrigatoria, total_colaboradores)
  VALUES (public.qa_sandbox_tenant_id(), 'QA Cota PcD LTDA', true, 120)
  RETURNING id INTO v_emp;
  SELECT pcd_percentual_exigido INTO v_pct FROM public.empresa_cadastro WHERE id = v_emp;

  UPDATE public.empresa_cadastro SET total_colaboradores = 600 WHERE id = v_emp;
  SELECT pcd_percentual_exigido INTO v_pct2 FROM public.empresa_cadastro WHERE id = v_emp;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a admissão marca quem é PcD/reabilitado para alimentar o realizado?';
  r.esperado := 'Campo de enquadramento PcD no cadastro do colaborador';
  v_col := coalesce(public.qa_col_existe('admissoes', '%pcd%'),
                    public.qa_col_existe('admissoes', '%deficien%'),
                    public.qa_col_existe('admissoes', '%reabilitad%'));

  IF v_pct = 2 AND v_pct2 = 4 AND v_col IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Faixas recalculadas no gatilho e enquadramento PcD presente na admissão.';
  ELSIF v_pct = 2 AND v_pct2 = 4 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade faltando): o gatilho recalcular_cota_pcd FUNCIONA — '
             || '120 ativos deram 2% e 600 deram 4%, faixas certas da Lei 8.213. Mas a admissão '
             || 'NÃO PERGUNTA se o admitido é PcD ou reabilitado (nenhum campo em admissoes): o '
             || '"realizado" (pcd_quantidade_atual) é digitado à mão e ninguém sabe QUEM compõe '
             || 'a cota — na fiscalização, a empresa precisa provar nominalmente. Correção: '
             || 'enquadramento PcD/reabilitado na admissão (dado sensível, acesso restrito) '
             || 'alimentando o realizado automaticamente.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Faixas erradas no recálculo: 120 ativos → %s%% (esperado 2), 600 → %s%% '
             || '(esperado 4). A tabela do art. 93 é 2/3/4/5%% por faixa de efetivo.',
             coalesce(v_pct::text, 'NULL'), coalesce(v_pct2::text, 'NULL'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a admissão colhe a opção de vale-transporte?';
  r.esperado := 'Opção com trajeto/linhas ou renúncia formal arquivada — nunca presunção';
  v_est := coalesce(public.qa_col_existe(NULL, '%vale_transporte%'),
                    public.qa_col_existe(NULL, '%vale\_%'),
                    public.qa_fns_com('%vale_transporte%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o vale-transporte não existe na admissão — nenhum campo registra a '
             || 'opção (trajeto, linhas) nem a renúncia. A Lei 7.418 condiciona o benefício à '
             || 'opção do empregado; sem o registro, ou se desconta de quem renunciou (desconto '
             || 'indevido) ou não se tem prova da renúncia de quem depois o reclama. O checklist '
             || 'de documentos até menciona comprovantes, mas opção/renúncia é DECLARAÇÃO, não '
             || 'anexo. Correção: etapa de benefícios na coleta com opção estruturada e termo de '
             || 'renúncia gerado e arquivado (seção 16 do documento).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Opção de VT presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_piso text; v_confere text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o salário da admissão é conferido contra o piso da CCT?';
  r.esperado := 'Piso cadastrado (folha_cct) consultado na abertura; abaixo dele, bloqueio ou justificativa';
  v_piso := public.qa_col_existe('folha_cct', 'piso_salarial');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_confere
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%piso_salarial%';
  IF v_piso IS NOT NULL AND v_confere IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o piso EXISTE no cadastro da CCT (folha_cct.piso_salarial) e NINGUÉM o '
             || 'consulta — a admissão grava qualquer salário sem olhar o instrumento coletivo '
             || 'da categoria. Salário abaixo do piso é diferença salarial devida desde o '
             || 'primeiro dia, com reflexos em tudo. E não há comparação com os pares da mesma '
             || 'função (igualdade salarial, Lei 14.611/2023 [VAL]). Correção: conferência '
             || 'salário × piso vigente na abertura (bloqueio ou justificativa formal) e alerta '
             || 'de coerência com a mediana da função.';
  ELSIF v_piso IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O campo de piso salarial não existe mais no cadastro de CCT.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Piso conferido em: %s.', v_confere);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_052()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_param text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o checklist de documentos da admissão é parametrizável?';
  r.esperado := 'Exigência extra da CCT/cargo cadastrada como parâmetro entra no checklist sem mexer em código';
  SELECT string_agg(table_name, ', ') INTO v_param
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%admissao%config%' OR table_name ILIKE '%checklist%admissao%'
         OR table_name ILIKE '%documento%exigid%' OR table_name ILIKE '%admissao%template%');
  IF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe tabela que parametrize o checklist da admissão — a lista de '
             || 'documentos obrigatórios vive fixa no código (ensure_admissao_documentos_by_token '
             || 'e a tela). Convenção que exija documento adicional, ou cargo que dispense um '
             || 'item, obriga alteração de código a cada cliente — e a exigência da CCT [RCC] '
             || 'passa batida até alguém lembrar. Correção: checklist como parâmetro por '
             || 'empresa/categoria/vigência (mesmo desenho de empresa_experiencia_config), '
             || 'consumido pela geração dos itens em admissao_documentos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Checklist parametrizável em: %s.', v_param);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_052()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_052 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_gate text; v_fin text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguma função condiciona a conclusão à assinatura do contrato?';
  r.esperado := 'Sem contrato/termos assinados (candidato e empresa), a admissão não conclui';
  -- o gate precisa viver no caminho da conclusão: gatilho da própria tabela
  -- admissoes ou a função de finalização conferindo assinatura (buscar por
  -- "admiss%+assinatura" solto pega funções de exclusão/experiência)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_gate
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid = 'public.admissoes'::regclass AND NOT t.tgisinternal
    AND p.prosrc ILIKE '%assin%';
  SELECT left(p.prosrc, 1) INTO v_fin
  FROM pg_proc p WHERE p.proname = 'finalizar_admissao_by_token'
    AND p.prosrc ILIKE '%assin%';
  IF v_gate IS NULL AND v_fin IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a conclusão da admissão não confere assinatura nenhuma — '
             || 'finalizar_admissao_by_token só troca o status, e nenhuma outra função liga '
             || 'admissão a assinatura. A infraestrutura de assinatura EXISTE no sistema (o '
             || 'termo de experiência usa experiencia_assinatura_links, com trilha), mas o '
             || 'CONTRATO da admissão não passa por ela: a admissão conclui com contrato em '
             || 'rascunho, e o arquivamento (ADM-100..) recebe documento sem assinatura. Sem o '
             || 'contrato assinado, a empresa não prova o pactuado (arts. 29/442). Correção: '
             || 'estender o fluxo de assinatura da experiência ao contrato/termos da admissão '
             || 'e condicionar a transição de status à ciência das duas partes.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Conclusão condicionada à assinatura em: %s.',
                       coalesce(v_gate, 'finalizar_admissao_by_token'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_071()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_just text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar admissão com início 30 dias no PASSADO, sem nenhuma justificativa';
  r.esperado := 'Exceção com rito: justificativa obrigatória em trilha + alerta de eSocial fora do prazo';
  BEGIN
    INSERT INTO public.admissoes
      (tenant_id, nome_completo, cpf, cargo, data_admissao)
    VALUES (public.qa_sandbox_tenant_id(), 'QA Retroativa', public.qa_cpf(7071),
            'Analista', CURRENT_DATE - 30);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;
  v_just := public.qa_col_existe('admissoes', '%justificativa%');

  IF v_aceitou AND v_just IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a admissão retroativa entrou CALADA — sem justificativa (a coluna nem '
             || 'existe), sem marcação de exceção, sem alerta. Início no passado significa, por '
             || 'definição, S-2200 fora do prazo (era devido até o dia anterior ao início) e '
             || 'possível período trabalhado sem registro — multa do art. 47 da CLT. O sistema '
             || 'pode aceitar o fato consumado, mas nunca em silêncio. Correção: justificativa '
             || 'obrigatória em trilha para data_admissao < hoje na criação + alerta crítico de '
             || 'atraso com ação no Plano de Ação.';
  ELSIF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido := 'A retroativa sem justificativa foi recusada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Retroativa aceita com campo de justificativa disponível (%s) — conferir '
                       || 'na tela a obrigatoriedade.', v_just);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_071()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_071 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_072()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_status text;
BEGIN
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, cargo, data_admissao,
     exame_admissional_data, exame_admissional_resultado)
  VALUES (public.qa_sandbox_tenant_id(), 'QA Inapto Concluído', public.qa_cpf(7072),
          'Operador', CURRENT_DATE + 5, CURRENT_DATE - 1, 'inapto')
  RETURNING id INTO v_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Concluir a admissão com ASO INAPTO registrado (e sem eSocial aceito)';
  r.esperado := 'Bloqueado — as pré-condições do CA-008 são cadastro completo, ASO apto e eSocial aceito';
  BEGIN
    UPDATE public.admissoes SET status = 'concluido' WHERE id = v_id;
  EXCEPTION WHEN check_violation OR raise_exception THEN
    r.situacao := 'passou';
    r.obtido := 'A conclusão com ASO inapto foi recusada.';
    RETURN r;
  END;
  SELECT status::text INTO v_status FROM public.admissoes WHERE id = v_id;

  IF v_status = 'concluido' THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a admissão CONCLUIU com ASO inapto e sem evento de eSocial — o gatilho '
             || 'de onboarding (auto_criar_onboarding_admissao) olha SÓ a mudança de status, '
             || 'nenhuma pré-condição. Concluída, a cadeia inteira dispara (onboarding, ponto, '
             || 'contrato de experiência) para alguém que a NR-7 proíbe de começar a trabalhar '
             || 'naquela função — e cujo vínculo não existe para o governo. Correção: transição '
             || 'para concluído condicionada a ASO apto (já há campos estruturados para isso) e, '
             || 'quando o eSocial nascer (ADM-090), ao evento aceito.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('A conclusão foi retida (status ficou "%s").', v_status);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_072()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_072 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_073()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): dados de candidato não admitido têm prazo de retenção?';
  r.esperado := 'Política de retenção + descarte/anonimização para admissões encerradas sem contratação';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_est
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%admiss%' AND (p.prosrc ILIKE '%retencao%' OR p.prosrc ILIKE '%expurg%'
         OR p.prosrc ILIKE '%anonimiz%' OR p.prosrc ILIKE '%descart%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o descarte existe no PONTO (ponto_expurgar_registros, com config de '
             || 'anos) e no catálogo do Hub (prazo_retencao_anos), mas NÃO na admissão — '
             || 'candidato reprovado ou desistente fica com CPF, documentos e até resultado de '
             || 'ASO guardados para sempre, sem base legal que o sustente (a base era a '
             || 'execução do contrato QUE NÃO HOUVE). Dado sensível de quem nunca foi '
             || 'colaborador é o pior passivo de LGPD do módulo. Correção: replicar o desenho '
             || 'do Ponto — config de prazo por tenant + rotina de expurgo/anonimização para '
             || 'admissões em reprovado/cancelado, preservando trilha sem conteúdo pessoal. '
             || 'Prazo é [VAL] jurídico (seção 30).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Retenção/descarte da admissão presente em: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_073()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_073 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_090()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_admissoes int; v_na_fila int := 0; v_logs int := 0;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Verificar se existe qualquer evento S-2200 gerado pelo sistema';
  r.esperado    := 'Um S-2200 por admissao concluida de celetista';

  SELECT count(*) INTO v_admissoes FROM public.admissoes WHERE status = 'concluido';

  IF v_admissoes = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhuma admissao concluida nesta base — nada a auditar. '
               || 'Rode novamente quando houver movimento.';
    RETURN r;
  END IF;

  IF to_regclass('public.esocial_transmissoes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.esocial_transmissoes WHERE tipo_evento ILIKE ''%2200%'''
      INTO v_na_fila;
  END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.audit_logs WHERE action ILIKE ''%2200%''' INTO v_logs;
  END IF;

  IF v_admissoes > 0 AND v_na_fila >= v_admissoes THEN
    r.situacao := 'passou';
    r.obtido   := format('%s admissao(oes) concluida(s) e %s evento(s) S-2200 na fila.',
                          v_admissoes, v_na_fila);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s admissao(oes) concluida(s); %s evento(s) S-2200 na fila de '
               || 'transmissao; %s registro(s) de log mencionando 2200. O evento S-2200 nao '
               || 'aparece em NENHUM arquivo do repositorio — a admissao nao gera evento de '
               || 'eSocial algum. Situacao pior que a do desligamento, que ao menos monta o '
               || 'S-2299 em memoria: aqui nao existe nem o objeto. E, das duas pontas do '
               || 'vinculo, esta e a de prazo mais rigido: o MOS exige o envio ate o dia '
               || 'imediatamente ANTERIOR ao inicio das atividades, e prazo perdido nao se '
               || 'corrige depois.',
               v_admissoes, v_na_fila, v_logs);
    r.detalhe  := jsonb_build_object('admissoes_concluidas', v_admissoes,
                                     'eventos_na_fila', v_na_fila, 'logs', v_logs);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_090()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_090 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_091()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_na_fila int := 0;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Verificar se o evento S-2190 (admissao preliminar) existe no sistema';
  r.esperado    := 'Disponivel para admissao sem tempo habil de S-2200 completo';

  IF to_regclass('public.esocial_transmissoes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.esocial_transmissoes WHERE tipo_evento ILIKE ''%2190%'''
      INTO v_na_fila;
  END IF;

  IF v_na_fila > 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s evento(s) S-2190 registrado(s).', v_na_fila);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Nenhum S-2190. Decorrencia direta do ADM-090: sem S-2200 nao ha admissao '
               || 'preliminar. Deixar de oferecer o caminho previsto no MOS empurra o usuario '
               || 'para o descumprimento do prazo quando a contratacao e de ultima hora. '
               || 'DEPENDE DE DECISAO DE PRODUTO: se o YourEyes nao pretende transmitir '
               || 'eSocial, este caso deve virar rascunho.';
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_091()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_091 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_092()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe consulta/registro de qualificação cadastral?';
  r.esperado := 'CPF × nome × nascimento validados contra a base do governo ANTES do S-2200';
  v_est := coalesce(public.qa_fns_com('%qualifica%'), public.qa_col_existe(NULL, '%qualificacao%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a qualificação cadastral não existe no módulo — nenhuma função ou '
             || 'campo registra a validação de CPF/nome/nascimento contra as bases do governo. '
             || 'É a causa nº 1 de rejeição do S-2200: divergência conhecida e não tratada em '
             || 'casa vira rejeição anunciada no dia do envio (a véspera do início, sem folga '
             || 'para corrigir). Encadeado ao ADM-090: quando a transmissão nascer, a '
             || 'qualificação precisa nascer ANTES dela no fluxo — na validação da admissão, '
             || 'com o campo divergente apontado em linguagem simples e o envio retido até '
             || 'corrigir.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Qualificação cadastral presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_092()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_092 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_093()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_trad text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a transmissão tem anti-duplicidade e tradução de rejeição?';
  r.esperado := 'Reenvio corrigido substitui/retifica (nunca duplica o vínculo) e a rejeição vira instrução';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  v_trad := coalesce(public.qa_fns_com('%rejeic%esocial%'), public.qa_fns_com('%esocial%rejei%'));

  IF v_unq IS NULL AND v_trad IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (par do FERIAS-081, aqui pelo S-2200): esocial_transmissoes não tem '
             || 'unicidade — o mesmo evento de admissão pode ser gravado e enviado duas vezes — '
             || 'e nenhuma função interpreta rejeições: o retorno técnico chega cru e o reenvio '
             || 'fica por conta do operador. S-2200 duplicado é vínculo duplicado no governo, '
             || 'passivo criado pela própria correção. Correção: chave natural do evento '
             || '(vínculo + tipo + competência) + rotina que traduz a rejeição em instrução e '
             || 'conduz retificação, nunca clone. Vale para a admissão herdar pronta quando o '
             || 'ADM-090 for construído.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_093()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_093 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_101()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_total int; v_sem_pasta int; v_pastas_colab int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos de admissao sem pasta_id';
  r.esperado    := 'Zero — todo documento nasce arquivado na pasta do colaborador';

  SELECT count(*) INTO v_total FROM public.documentos
  WHERE observacoes = 'Documento da admissão';

  IF v_total = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum documento de admissao sincronizado nesta base — nada a auditar.';
    RETURN r;
  END IF;

  SELECT count(*) INTO v_sem_pasta FROM public.documentos
  WHERE observacoes = 'Documento da admissão' AND pasta_id IS NULL;

  SELECT count(*) INTO v_pastas_colab FROM public.documento_pastas
  WHERE tipo = 'colaborador';

  IF v_sem_pasta = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s documento(s), todos arquivados em pasta.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de %s documento(s) de admissao estao SEM pasta_id. Existem %s '
               || 'pasta(s) de colaborador na base, ou seja, a estrutura de destino existe e '
               || 'nao e usada. O insert em public.documentos simplesmente nao informa '
               || 'pasta_id, embora a coluna exista como FK para documento_pastas. '
               || 'Correcao: resolver a pasta do colaborador no momento do arquivamento, '
               || 'criando-a se ainda nao existir.',
               v_sem_pasta, v_total, v_pastas_colab);
    r.detalhe  := jsonb_build_object('sem_pasta', v_sem_pasta, 'total', v_total,
                                     'pastas_de_colaborador_existentes', v_pastas_colab);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_101()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_101 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_102()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_total int; v_sem_dono int; v_pct numeric;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos de admissao sem colaborador_id';
  r.esperado    := 'Zero — todo documento de pessoa tem dono identificado por chave';

  SELECT count(*) INTO v_total FROM public.documentos
  WHERE observacoes = 'Documento da admissão';

  SELECT count(*) INTO v_sem_dono FROM public.documentos
  WHERE observacoes = 'Documento da admissão' AND colaborador_id IS NULL;

  IF v_total = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum documento de admissao sincronizado nesta base — nada a auditar.';
    RETURN r;
  END IF;

  v_pct := round(100.0 * v_sem_dono / v_total, 1);

  IF v_sem_dono = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s documento(s) de admissao, todos com colaborador identificado.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de %s documento(s) de admissao estao SEM colaborador_id (%s%%). '
               || 'O insert em public.documentos grava colaborador_id: null com o comentario '
               || '"Colaborador ainda nao tem profile". ColaboradorFolderView agrupa por '
               || '(colaborador_id || "sem-colaborador"), entao todos estes aparecem no balde '
               || 'avulso em vez de sob a pessoa. E o passivo que o RH ainda precisa arquivar '
               || 'a mao — exatamente o retrabalho que a premissa de arquivamento unico se '
               || 'propos a eliminar. Correcao no ADM-103.',
               v_sem_dono, v_total, v_pct);
    r.detalhe  := jsonb_build_object('documentos_admissao', v_total,
                                     'sem_colaborador_id', v_sem_dono,
                                     'percentual', v_pct);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_102()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_102 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_103()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_concluidas int; v_com_pendencia int; v_docs int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): admissoes concluidas com documentos ainda no limbo';
  r.esperado    := 'Zero — concluir a admissao fecha o ciclo de arquivamento';

  SELECT count(*) INTO v_concluidas FROM public.admissoes WHERE status = 'concluido';

  IF v_concluidas = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhuma admissao concluida nesta base — nada a auditar.';
    RETURN r;
  END IF;

  SELECT count(DISTINCT a.id), count(d.id)
    INTO v_com_pendencia, v_docs
  FROM public.admissoes a
  JOIN public.documentos d
    ON d.colaborador_cpf = a.cpf
   AND d.tenant_id = a.tenant_id
   AND d.observacoes = 'Documento da admissão'
  WHERE a.status = 'concluido'
    AND (d.colaborador_id IS NULL OR d.pasta_id IS NULL);

  IF v_com_pendencia = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s admissao(oes) concluida(s), todas com documentos reconciliados.',
                          v_concluidas);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de %s admissao(oes) CONCLUIDA(S) tem documentos sem dono ou sem '
               || 'pasta — %s documento(s) no total. A pessoa ja virou colaborador, ja tem '
               || 'profile, e os documentos dela continuam avulsos. Nao existe nenhuma rotina '
               || 'que faca essa reconciliacao: nada, em momento algum, volta para preencher '
               || 'colaborador_id e pasta_id. Correcao sugerida: reconciliacao disparada na '
               || 'conclusao da admissao, MAIS uma funcao retroativa para o passivo acima, no '
               || 'espirito da reconciliar_pastas_todas_empresas() que ja existe no produto.',
               v_com_pendencia, v_concluidas, v_docs);
    r.detalhe  := jsonb_build_object('admissoes_concluidas', v_concluidas,
                                     'com_documento_no_limbo', v_com_pendencia,
                                     'documentos_afetados', v_docs);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_103()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_103 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_105()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_total int; v_sem_versao int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos de admissao sem registro em documento_versoes';
  r.esperado    := 'Zero — toda substituicao preserva a versao anterior';

  SELECT count(*) INTO v_total FROM public.documentos
  WHERE observacoes = 'Documento da admissão';

  IF v_total = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum documento de admissao nesta base — nada a auditar.';
    RETURN r;
  END IF;

  SELECT count(*) INTO v_sem_versao FROM public.documentos d
  WHERE d.observacoes = 'Documento da admissão'
    AND NOT EXISTS (SELECT 1 FROM public.documento_versoes v WHERE v.documento_id = d.id);

  IF v_sem_versao = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s documento(s), todos com historico de versao.', v_total);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de %s documento(s) de admissao nao tem nenhum registro em '
               || 'documento_versoes. A tabela existe no schema e nao e alimentada por este '
               || 'fluxo. Como o upload usa upsert:true no storage, o reenvio SUBSTITUI o '
               || 'arquivo fisico e a versao anterior deixa de existir, sem registro de que '
               || 'existiu. Mesma classe do DESL-002: o produto guarda estado, nao historico.',
               v_sem_versao, v_total);
    r.detalhe  := jsonb_build_object('sem_versao', v_sem_versao, 'total', v_total);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_105()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_105 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_106()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_divergentes int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documento cujo tenant diverge do da admissao';
  r.esperado    := 'Zero — o documento pertence ao cliente da admissao';

  SELECT count(*) INTO v_divergentes
  FROM public.admissao_documentos ad
  JOIN public.admissoes a ON a.id = ad.admissao_id
  JOIN public.documentos d ON d.storage_path = ad.arquivo_url
  WHERE ad.arquivo_url IS NOT NULL
    AND d.tenant_id IS DISTINCT FROM a.tenant_id;

  IF v_divergentes = 0 THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhum documento com tenant divergente. A correcao que passou a usar o '
               || 'tenant da propria admissao, em vez do tenant principal do usuario, esta '
               || 'valendo.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s documento(s) gravado(s) em tenant diferente do da admissao. Sao '
               || 'documentos invisiveis para a equipe que deveria ve-los, e visiveis para '
               || 'quem nao deveria. O codigo ja foi corrigido para ler o tenant da admissao; '
               || 'estes sao residuo anterior a correcao e precisam de migracao de dados.',
               v_divergentes);
    r.detalhe  := jsonb_build_object('documentos_com_tenant_divergente', v_divergentes);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_106()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_106 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_107()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o ASO admissional existe como entidade de saúde própria?';
  r.esperado := 'Regime próprio de acesso, retenção e sigilo (NR-07/LGPD art. 11) — não anexo comum';
  v_est := coalesce(public.qa_col_existe(NULL, '%aso_admissional%'),
                    public.qa_fns_com('%aso%admissional%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o ASO admissional não existe como entidade — o único ASO do sistema é '
             || 'o de RETORNO de afastamento (afastamentos.aso_retorno_*). Na admissão, o ASO '
             || 'entraria como anexo genérico, com o mesmo tratamento de um comprovante de '
             || 'residência — mas é dado de SAÚDE: sigilo médico (NR-07), acesso restrito, '
             || 'retenção de 20 anos e LGPD art. 11. Correção: categoria própria de documento '
             || 'de saúde na admissão, com política de acesso restritiva e retenção '
             || 'diferenciada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('ASO admissional estruturado: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_107()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_107 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_108()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_enviados int; v_orfaos int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): arquivos da admissao sem registro no modulo Documentos';
  r.esperado    := 'Zero — todo arquivo enviado esta nos dois lados';

  SELECT count(*) INTO v_enviados FROM public.admissao_documentos
  WHERE arquivo_url IS NOT NULL AND btrim(arquivo_url) <> '';

  IF v_enviados = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nenhum arquivo enviado em admissoes nesta base — nada a auditar.';
    RETURN r;
  END IF;

  SELECT count(*) INTO v_orfaos FROM public.admissao_documentos ad
  WHERE ad.arquivo_url IS NOT NULL AND btrim(ad.arquivo_url) <> ''
    AND NOT EXISTS (SELECT 1 FROM public.documentos d
                    WHERE d.storage_path = ad.arquivo_url AND d.tenant_id = ad.tenant_id);

  IF v_orfaos = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s arquivo(s) enviado(s), todos com registro no modulo Documentos.', v_enviados);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s de %s arquivo(s) enviado(s) na admissao NAO tem registro '
               || 'correspondente em public.documentos. Existem no storage e no checklist da '
               || 'admissao, mas o modulo Documentos nao os conhece. A sincronizacao so passou '
               || 'a existir em determinado momento do desenvolvimento — documentos anteriores '
               || 'a isso provavelmente nunca foram sincronizados. Correcao: rotina retroativa '
               || 'que percorra admissao_documentos e crie o que falta.',
               v_orfaos, v_enviados);
    r.detalhe  := jsonb_build_object('arquivos_enviados', v_enviados, 'sem_registro', v_orfaos);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_108()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_108 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_110()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_rls boolean; v_policies int; v_tem_classificacao boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir RLS e politicas em public.documentos';
  r.esperado    := 'RLS ligada, com politicas, e classificacao propria para dado de saude';

  SELECT relrowsecurity INTO v_rls FROM pg_class WHERE oid = 'public.documentos'::regclass;
  SELECT count(*) INTO v_policies FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'documentos';

  v_tem_classificacao := public.qa_coluna_existe('documentos','sensivel')
                      OR public.qa_coluna_existe('documentos','classificacao')
                      OR public.qa_coluna_existe('documentos','categoria_acesso');

  IF NOT COALESCE(v_rls,false) OR v_policies = 0 THEN
    r.situacao := 'falhou';
    r.obtido   := format('RLS em public.documentos: %s; politicas: %s. Documento pessoal sem '
               || 'protecao de linha e acessivel a qualquer sessao autenticada.',
               COALESCE(v_rls,false), v_policies);
  ELSIF NOT v_tem_classificacao THEN
    r.situacao := 'falhou';
    r.obtido   := format('RLS ligada com %s politica(s) — a base do acesso esta protegida. '
               || 'PORÉM nao existe nenhuma coluna que classifique o documento como sensivel. '
               || 'RG, comprovante de residencia e ASO recebem o mesmo tratamento de acesso. '
               || 'A LGPD da regime proprio ao dado de saude (art. 5o, II e art. 11), e o '
               || 'ASO admissional entra no sistema como o nono item de uma lista de anexos '
               || 'genericos. Correcao: classificar o documento na origem e diferenciar a '
               || 'politica de acesso por classificacao.', v_policies);
    r.detalhe  := jsonb_build_object('rls', v_rls, 'politicas', v_policies,
                                     'tem_classificacao_de_sensibilidade', false);
  ELSE
    r.situacao := 'passou';
    r.obtido   := format('RLS ligada, %s politica(s), e existe classificacao de sensibilidade.',
                          v_policies);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_110()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_110 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_adm_111()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_docs int; v_admissoes int; v_status text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos pessoais retidos de admissoes encerradas sem efetivacao';
  r.esperado    := 'Destino definido — eliminados ou retidos com prazo e justificativa';

  -- Comparação por TEXTO: não depende de quais rótulos existem no enum hoje.
  SELECT count(DISTINCT a.id), count(ad.id) INTO v_admissoes, v_docs
  FROM public.admissoes a
  JOIN public.admissao_documentos ad ON ad.admissao_id = a.id
  WHERE a.status::text IN ('reprovado','rejeitado','cancelado','recusado')
    AND ad.arquivo_url IS NOT NULL AND btrim(ad.arquivo_url) <> '';

  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) INTO v_status
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'admissao_status';

  IF v_docs = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('Nenhum documento retido de admissao encerrada sem efetivacao. '
               || 'Rotulos existentes em admissao_status: %s.', COALESCE(v_status,'(nao encontrado)'));
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s documento(s) pessoal(is) de %s admissao(oes) encerrada(s) sem '
               || 'efetivacao continuam armazenados. A LGPD, art. 15, I e III, trata do '
               || 'termino do tratamento e o art. 16 exige eliminacao, ressalvada guarda '
               || 'obrigatoria. Nao ha prazo, responsavel nem registro de decisao sobre '
               || 'esse acervo.', v_docs, v_admissoes);
    r.detalhe  := jsonb_build_object('documentos_retidos', v_docs, 'admissoes', v_admissoes);
  END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_adm_111()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_adm_111 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou_15m boolean := false; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar cálculo de 13º com 15 meses trabalhados (impossível — o ano tem 12)';
  r.esperado := 'Recusado — avos vão de 0 a 12 e deveriam sair da data de admissão, não de digitação';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, meses_trabalhados)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-001', 'QA Avos Quinze', 15);
    v_aceitou_15m := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou_15m := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém apura os avos a partir da admissão?';
  r.esperado := 'Função que calcule 1/12 por mês com a fração de 15 dias (Lei 4.090, art. 1º)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%avos%'
         OR (p.prosrc ILIKE '%meses_trabalhados%' AND p.prosrc ILIKE '%data_admissao%'));

  IF v_aceitou_15m OR v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: os avos do 13º são um número DIGITADO — a tela (DecimoTerceiroTab) '
             || 'pede "meses trabalhados" e o banco aceitou até 15 meses (%s; folha_13_calculo não '
             || 'tem CHECK em meses_trabalhados) e nenhuma função apura os avos da data de '
             || 'admissão (%s). A Lei 4.090 manda contar 1/12 por mês com fração ≥ 15 dias: '
             || 'admitido em 10/05 são 8 avos, em 20/05 são 7 — diferença que hoje depende da '
             || 'conta de cabeça do operador. Correção: CHECK meses_trabalhados BETWEEN 0 AND 12 '
             || 'e apuração automática pela admissão (com faltas/afastamentos), digitação só como '
             || 'exceção justificada.',
             CASE WHEN v_aceitou_15m THEN '15 aceito' ELSE 'recusado' END,
             coalesce('há candidatas: ' || v_fns, 'nenhuma função'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Avos limitados e apurados por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as faltas do Ponto chegam à apuração do 13º?';
  r.esperado := 'Mês reduzido a menos de 15 dias por falta INJUSTIFICADA não conta avo; justificada não interfere';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  -- exige menção explícita ao 13º: "falta + avos" solto pega as férias
  -- (ferias_recalcular_periodo aplica o art. 130 e não toca o 13º)
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%falta%'
    AND (p.prosrc ILIKE '%decimo%' OR p.prosrc ILIKE '%13_calculo%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função liga as faltas apuradas no Ponto ao 13º — o módulo de '
             || 'jornada materializa faltas dia a dia (ponto_diario) e o 13º nem olha. Um '
             || 'colaborador com 16 faltas injustificadas num mês deveria perder aquele avo '
             || '(mês de serviço exige ≥ 15 dias trabalhados, Lei 4.090 art. 1º §1º); hoje o '
             || '13º sai integral porque os meses são digitados (ver DEC13-001). O efeito '
             || 'perverso é o inverso também: falta JUSTIFICADA não pode derrubar avo, e sem '
             || 'regra nenhuma ninguém garante os dois lados. Correção: apuração de avos '
             || 'consumindo as ocorrências do Ponto, distinguindo justificada de injustificada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Faltas refletem na apuração via: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os afastamentos entram na apuração do 13º com o efeito de cada tipo?';
  r.esperado := 'Maternidade conta na apuração patronal; auxílio-doença gera abono anual pelo INSS no período do benefício';
  v_tab := public.qa_col_existe('afastamentos', 'tipo%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%afastamento%'
    AND (p.prosrc ILIKE '%decimo%' OR p.prosrc ILIKE '%13_calculo%' OR p.prosrc ILIKE '%avos%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o módulo de afastamentos existe e é tipado (%s), mas nenhuma '
             || 'função o consulta ao apurar o 13º. Os efeitos são opostos por tipo: '
             || 'licença-maternidade INTEGRA a apuração patronal; auxílio-doença divide — '
             || 'empregador paga os avos trabalhados e o INSS paga o abono anual do período de '
             || 'benefício (Decreto 3.048, art. 120). Sem o cruzamento, ou a empresa paga 13º '
             || 'de período que é do INSS (paga a mais) ou corta período de maternidade (paga '
             || 'a menos e responde por isso). Correção: apuração por tipo de afastamento, com '
             || 'marcação para validação contábil [VAL] nos casos divididos.',
             coalesce(v_tab, 'tabela afastamentos'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Afastamentos tratados na apuração via: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_flag text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a marcação incide_13 das rubricas alimenta alguma média?';
  r.esperado := 'Rubricas com incide_13 = true compõem a média das variáveis na base do 13º';
  v_flag := public.qa_col_existe('folha_rubricas', 'incide_13');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%incide_13%';
  IF v_flag IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (metade boa, metade decorativa): a parametrização EXISTE — '
             || 'folha_rubricas.incide_13 diz exatamente quais rubricas compõem a base do 13º, '
             || 'o desenho certo do Decreto 57.155 — mas NENHUMA função a consulta: a "média de '
             || 'variáveis" do cálculo é um único número digitado na tela (media_variaveis), '
             || 'sem memória de qual rubrica entrou nem de que período. Horas extras habituais, '
             || 'adicional noturno e comissões integram a base por lei (Súmulas 45/148/253) e '
             || 'hoje dependem de o operador calcular a média fora do sistema. Correção: média '
             || 'automática dos lançamentos do ano filtrados por incide_13, com a composição '
             || 'gravada na memória de cálculo.';
  ELSIF v_flag IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O campo incide_13 não existe mais em folha_rubricas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Médias calculadas a partir de incide_13 em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): algum motor confere a completude do ano antes do fechamento?';
  r.esperado := 'Competência sem variáveis lançadas gera alerta ANTES do cálculo, não diferença depois';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%folha_alertas_prazo%';
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a tabela de alertas da folha (folha_alertas_prazo) é alimentada só '
             || 'pela TELA — nenhuma função do banco gera ou confere alerta algum, e não '
             || 'existe verificação de base incompleta em lugar nenhum. Quem não abrir a aba '
             || 'de alertas no mês certo não é avisado de nada, e um 13º calculado com '
             || 'competências sem variáveis lançadas sai menor em silêncio — diferença que '
             || 'vira passivo (seção 14 do documento pede alerta de "base de médias '
             || 'incompleta" com prioridade média antes do fechamento). Correção: rotina '
             || 'agendada (pg_cron, como as demais do projeto) conferindo lançamentos do '
             || 'ano × vínculos com variável habitual e registrando o alerta.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Alertas gerados/conferidos no banco por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_check text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o prazo legal do 13º tem lugar no controle de prazos da folha?';
  r.esperado := 'Tipos de alerta contemplando as parcelas do 13º (1ª até 30/11; 2ª até 20/12)';
  SELECT pg_get_constraintdef(c.oid) INTO v_check
  FROM pg_constraint c
  WHERE c.conrelid = 'public.folha_alertas_prazo'::regclass
    AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%tipo%';
  IF v_check IS NULL OR (v_check NOT ILIKE '%13%' AND v_check NOT ILIKE '%decimo%') THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o controle de prazos da folha não conhece o 13º — o CHECK de '
             || 'folha_alertas_prazo só admite tipos mensais (%s): não há onde registrar '
             || '"1ª parcela até 30/11" nem "2ª até 20/12", e a tela que semeia os alertas '
             || 'gera datas aproximadas mês a mês, nunca as datas da Lei 4.749. Pagar a 1ª '
             || 'parcela fora da janela (1º/02 a 30/11) é infração mesmo com o valor certo, '
             || 'e é o risco nº 1 do módulo (seção 26). Correção: tipos decimo_primeira e '
             || 'decimo_segunda no CHECK + semeadura anual das duas datas com alertas '
             || 'D-30/15/7 e D-15/7/3.', coalesce(v_check, 'constraint ausente'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazos do 13º contemplados no controle: %s.', v_check);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_feriados text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe motor de datas que antecipe prazo em dia não útil?';
  r.esperado := '20/12 em fim de semana/feriado desloca a data-alvo para o dia útil ANTERIOR';
  v_feriados := CASE WHEN to_regclass('public.feriados') IS NOT NULL THEN 'feriados' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%feriado%'
    AND (p.prosrc ILIKE '%util%' OR p.prosrc ILIKE '%antecip%')
    AND (p.prosrc ILIKE '%folha%' OR p.prosrc ILIKE '%decimo%' OR p.prosrc ILIKE '%prazo%');
  IF v_feriados IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o calendário EXISTE (tabela feriados, nacional e por município) e '
             || 'nenhum motor de prazos da folha o consulta — não há função que desloque uma '
             || 'data-alvo para o dia útil anterior. O prazo do 13º anda sempre para TRÁS '
             || '(20/12 no sábado paga-se na sexta 19; pagar na segunda 22 é atraso com multa), '
             || 'diferente de prazos tributários que às vezes prorrogam — por isso a regra '
             || 'precisa ser do prazo, não um utilitário genérico. Correção: função de data-alvo '
             || 'com antecipação consultando feriados, usada pelos alertas do DEC13-030 '
             || '(RNF-003 do documento).';
  ELSIF v_feriados IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de feriados não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Motor de antecipação presente: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_032()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_opcao text; v_fns text; v_ponte text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção adiantar_13 das férias chega ao módulo do 13º?';
  r.esperado := 'Adiantamento pago no gozo aparece na apuração anual como 1ª parcela JÁ PAGA';
  v_opcao := public.qa_col_existe('ferias_programacao', 'adiantar_13');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%adiantar_13%';
  v_ponte := coalesce(public.qa_col_existe('folha_13_calculo', '%adiant%'),
                      public.qa_col_existe('folha_13_calculo', '%ferias%'),
                      public.qa_col_existe('folha_13_calculo', '%origem%'));
  IF v_opcao IS NOT NULL AND v_fns IS NULL AND v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a opção existe SÓ do lado das férias — ferias_programacao.adiantar_13 '
             || 'é gravada e o cálculo de férias a soma no líquido (FERIAS-035 cobre esse '
             || 'lado), mas o módulo do 13º nunca fica sabendo: nenhuma função lê adiantar_13 '
             || 'e folha_13_calculo não tem campo que registre adiantamento pago fora da '
             || 'rodada (valor_primeira_parcela é digitado). Consequência prática: quem '
             || 'recebeu a 1ª parcela nas férias de julho entra na rodada de novembro e '
             || 'RECEBE DE NOVO — e a 2ª parcela deduz os 50% teóricos, não o valor real. '
             || 'Correção: baixa automática na apuração anual (origem + valor + data do '
             || 'adiantamento) e dedução pelo valor efetivamente pago.';
  ELSIF v_opcao IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O campo adiantar_13 não existe mais em ferias_programacao.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte férias→13º presente (funções: %s; campos: %s).',
                       coalesce(v_fns, '—'), coalesce(v_ponte, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_032()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_032 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_033()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou_p3 boolean := false; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar cálculo com parcela = 3 (só existem 1ª e 2ª)';
  r.esperado := 'Recusado — o 13º tem duas parcelas; "3" só faria sentido como complemento estruturado';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-033', 'QA Parcela Tres', 3);
    v_aceitou_p3 := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou_p3 := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA (somente leitura): diferença apurada depois da 2ª parcela tem tratamento?';
  r.esperado := 'Complemento/estorno com vínculo à apuração original e reflexo no eSocial';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%complemento%13%' OR p.prosrc ILIKE '%13%complemento%'
         OR (p.prosrc ILIKE '%13_calculo%' AND (p.prosrc ILIKE '%estorno%' OR p.prosrc ILIKE '%diferen%')));

  IF v_aceitou_p3 OR v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: parcela é INT sem CHECK (parcela = 3 foi %s) e não existe '
             || 'estrutura de complemento — variável lançada depois da 2ª parcela (comissão de '
             || 'dezembro, HE da virada) não tem para onde ir: ou o operador edita o cálculo '
             || 'pago (sem trilha — ver DEC13-070) ou a diferença morre esquecida, e ambos '
             || 'erram. A dedução do adiantamento também é frágil: valor_primeira_parcela é '
             || 'digitado, não lido do pagamento real. Correção: CHECK parcela IN (1,2) + '
             || 'registro de complemento/estorno vinculado à apuração original (CA-005 e '
             || 'cenário "Diferença" da seção 25).',
             CASE WHEN v_aceitou_p3 THEN 'aceita' ELSE 'recusada' END);
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Parcelas restritas e diferenças tratadas por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_033()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_033 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_vig text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar 1ª parcela com INSS retido (R$ 500) — a lei manda reter só na 2ª';
  r.esperado := 'Recusado — adiantamento não sofre INSS; a retenção acontece na quitação';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela, valor_inss, base_inss)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-040', 'QA INSS Primeira', 1, 500, 3000);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a tabela de INSS é versionada por vigência?';
  r.esperado := 'folha_tabelas_inss com vigência (RNF-002) — o ponto bom do desenho atual';
  v_vig := public.qa_col_existe('folha_tabelas_inss', 'vigencia_inicio');

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o banco aceitou 1ª parcela com INSS retido — nenhum CHECK impede '
             || 'encargo no adiantamento (parcela = 1 com valor_inss = 500 entrou). O cálculo do '
             || 'React até faz certo (1ª sem descontos, 2ª com INSS em base separada da folha '
             || 'do mês, progressão própria de faixas), mas a regra vive SÓ na tela: qualquer '
             || 'escrita direta, importação ou ajuste manual grava o ilegal sem resistência. '
             || 'O versionamento das tabelas está correto (%s). Correção: CHECK '
             || '(parcela = 2 OR (valor_inss = 0 AND valor_irrf = 0)) — a regra legal morando '
             || 'no banco, não só no formulário.',
             coalesce('vigência presente: ' || v_vig, 'vigência AUSENTE'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Encargo na 1ª parcela recusado; tabelas com vigência (%s).',
                       coalesce(v_vig, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_vig text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar 1ª parcela com IRRF retido (R$ 300) — tributação do 13º é exclusiva da 2ª';
  r.esperado := 'Recusado — o IRRF do 13º nasce na quitação, sobre o valor integral, apartado do mês';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela, valor_irrf, base_irrf)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-041', 'QA IRRF Primeira', 1, 300, 4000);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a tabela de IRRF é versionada por vigência?';
  r.esperado := 'folha_tabelas_irrf com vigência e deduções parametrizadas';
  v_vig := public.qa_col_existe('folha_tabelas_irrf', 'vigencia_inicio');

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (par do DEC13-040, aqui pelo imposto): 1ª parcela com IRRF entrou '
             || 'sem resistência — a exclusividade na fonte (RIR/2018, art. 700: apura na 2ª '
             || 'parcela sobre o valor integral, sem somar aos rendimentos do mês) existe só no '
             || 'cálculo do React. O detalhe que agrava: base_irrf digitável permite também '
             || 'somar o 13º ao salário de dezembro numa base só, mudando a faixa dos dois — o '
             || 'erro clássico. Tabelas versionadas: %s. Correção: mesmo CHECK do DEC13-040 '
             || 'cobrindo valor_irrf, e memória de cálculo registrando a base apartada.',
             coalesce(v_vig, 'vigência AUSENTE'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('IRRF na 1ª parcela recusado; tabelas com vigência (%s).',
                       coalesce(v_vig, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_042()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_comp text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar cálculo com base de FGTS MAIOR que o bruto (base 10.000 para bruto 3.000)';
  r.esperado := 'Recusado — a base do FGTS de cada parcela é fração do bruto, nunca mais que ele';
  BEGIN
    INSERT INTO public.folha_13_calculo
      (tenant_id, ano, colaborador_id, colaborador_nome, parcela,
       valor_bruto, base_fgts, valor_fgts)
    VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
            'qa-dec13-042', 'QA FGTS Inflado', 2, 3000, 10000, 800);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: o depósito de cada parcela tem competência registrada para a guia?';
  r.esperado := 'FGTS da 1ª na competência do adiantamento; da 2ª na competência da quitação';
  v_comp := coalesce(public.qa_col_existe('folha_13_calculo', '%competencia%'),
                     public.qa_col_existe('folha_13_calculo', '%data_pagamento%'));

  IF v_aceitou OR v_comp IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o cálculo do React reparte a base certa (1ª: metade; 2ª: '
             || 'diferença — 8%% exatos no total, Lei 8.036 art. 15), mas o banco não sustenta '
             || 'a regra: base_fgts inflada além do bruto foi %s e NÃO HÁ campo de competência '
             || 'nem data de pagamento em folha_13_calculo (%s) — sem eles não se monta a guia '
             || 'de cada parcela nem se prova o depósito na competência devida, que é '
             || 'exatamente o que o FGTS Digital confere. Correção: CHECK base_fgts <= '
             || 'valor_bruto + colunas de competência/data de pagamento por parcela.',
             CASE WHEN v_aceitou THEN 'aceita' ELSE 'recusada' END,
             coalesce('há: ' || v_comp, 'nenhum campo'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Base consistente e competência registrada (%s).', v_comp);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_042()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_042 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_unq text; v_anual text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a folha anual do 13º tem eventos e anti-duplicidade?';
  r.esperado := 'S-1200 (apuração anual) e S-1210 (pagamentos) gerados, com unicidade por competência';
  IF to_regclass('public.esocial_transmissoes') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela de transmissões do eSocial não existe nesta base.';
    RETURN r;
  END IF;
  SELECT string_agg(conname, ', ') INTO v_unq
  FROM pg_constraint WHERE conrelid = 'public.esocial_transmissoes'::regclass AND contype = 'u';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_anual
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%S-1200%' OR p.prosrc ILIKE '%S1200%' OR p.prosrc ILIKE '%anual%13%');

  IF v_unq IS NULL AND v_anual IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (terceiro da série ADM-093/FERIAS-081, agora pela folha ANUAL): o 13º '
             || 'não gera evento nenhum — nenhuma função monta o S-1200 da competência anual '
             || 'nem o S-1210 dos pagamentos das parcelas, e esocial_transmissoes segue sem '
             || 'unicidade (mesmo evento gravável duas vezes). A competência anual tem regra '
             || 'própria de retificação e prazo; sem os eventos, o 13º pago não existe para o '
             || 'governo — e a DCTFWeb de dezembro não fecha com a folha. Correção: geração '
             || 'dos dois eventos no fechamento (apuração e pagamento), chave natural '
             || '(vínculo + tipo + competência anual) e tradução de rejeição em instrução, '
             || 'nunca reenvio às cegas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Proteções presentes (unicidade: %s; eventos anuais: %s).',
                       coalesce(v_unq, '—'), coalesce(v_anual, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a provisão do 13º é alimentada por algum motor?';
  r.esperado := '1/12 + encargos por competência e vínculo ativo, baixada contra os pagamentos';
  v_tab := CASE WHEN to_regclass('public.folha_provisoes') IS NOT NULL THEN 'folha_provisoes' END;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%folha_provisoes%';
  IF v_tab IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a tabela existe (folha_provisoes, com tipo, encargos e reversão — '
             || 'desenho certo) e NENHUMA função a alimenta: a provisão do 13º é lançada à '
             || 'mão, quando alguém lembra. Provisão por regime de competência não é enfeite '
             || 'contábil — o custo nasce 1/12 por mês (CA-009), admissões e desligamentos a '
             || 'ajustam, e o contador precisa conciliar provisionado × pago no fim do ano '
             || '(seção 20). À mão, ela desalinha da folha no primeiro mês esquecido e o '
             || 'balancete de dezembro leva o susto do ano inteiro de uma vez. Correção: '
             || 'rotina mensal (pg_cron) provisionando por vínculo ativo e baixando contra '
             || 'os pagamentos das parcelas.';
  ELSIF v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela folha_provisoes não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Provisão alimentada por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_aceitou boolean := false; v_ponte text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'Gravar rescisão POR JUSTA CAUSA pagando 13º proporcional de R$ 1.000';
  r.esperado := 'Recusado — na dispensa por justa causa o 13º proporcional é perdido';
  BEGIN
    INSERT INTO public.folha_rescisoes
      (tenant_id, colaborador_id, colaborador_nome, tipo_rescisao,
       data_desligamento, decimo_terceiro_proporcional)
    VALUES (public.qa_sandbox_tenant_id(), 'qa-dec13-060', 'QA Justa Causa Com 13',
            'DISPENSA_COM_JUSTA_CAUSA', CURRENT_DATE, 1000);
    v_aceitou := true;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_aceitou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: a rescisão concilia com o módulo do 13º (adiantamento pago, rodada anual)?';
  r.esperado := 'Adiantamento deduzido nas verbas e vínculo desligado fora da rodada de novembro/dezembro';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ponte
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%folha_rescisoes%' AND p.prosrc ILIKE '%13_calculo%';

  IF v_aceitou OR v_ponte IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a rescisão tem o campo certo (decimo_terceiro_proporcional) e '
             || 'nenhuma regra por trás — justa causa com 13º proporcional de R$ 1.000 foi '
             || '%s (o cálculo correto vive só no React, calcularRescisao), e nenhuma função '
             || 'liga folha_rescisoes a folha_13_calculo (%s): adiantamento pago nas férias '
             || 'não é conferido nas verbas, e o desligado pode reaparecer na rodada anual. '
             || 'A exceção da culpa recíproca (50%%, Súmula 14) é o DESL-035. Correção: '
             || 'validação motivo × verba no banco e conciliação rescisão ↔ apuração anual '
             || 'do 13º nos dois sentidos.',
             CASE WHEN v_aceitou THEN 'aceito' ELSE 'recusado' END,
             coalesce('há: ' || v_ponte, 'nenhuma'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Justa causa sem 13º garantida e conciliação presente (%s).', v_ponte);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_alterou boolean := false; v_trg text;
BEGIN
  INSERT INTO public.folha_13_calculo
    (tenant_id, ano, colaborador_id, colaborador_nome, parcela,
     valor_bruto, total_liquido, status)
  VALUES (public.qa_sandbox_tenant_id(), extract(year from CURRENT_DATE)::int,
          'qa-dec13-070', 'QA Pago Editado', 2, 3000, 2500, 'pago')
  RETURNING id INTO v_id;

  r.passo_ordem := 1;
  r.passo_acao := 'Editar diretamente o valor bruto de um cálculo com status PAGO';
  r.esperado := 'Bloqueado — valor pago só muda por reabertura com motivo, dupla aprovação e diferença';
  BEGIN
    UPDATE public.folha_13_calculo SET valor_bruto = 9999 WHERE id = v_id;
    SELECT (valor_bruto = 9999) INTO v_alterou FROM public.folha_13_calculo WHERE id = v_id;
  EXCEPTION WHEN check_violation OR raise_exception THEN v_alterou := false; END;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: existe trilha de alteração na tabela do 13º?';
  r.esperado := 'Gatilho de auditoria registrando antes/depois (RNF-004: log imutável)';
  SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_trg
  FROM pg_trigger t
  -- a cerca do sandbox de QA (qa_guarda_cercado) não é trilha de auditoria
  WHERE t.tgrelid = 'public.folha_13_calculo'::regclass AND NOT t.tgisinternal
    AND t.tgname NOT ILIKE '%updated_at%' AND t.tgname NOT ILIKE 'qa\_%';

  IF v_alterou AND v_trg IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: um cálculo PAGO foi editado em silêncio — o valor bruto mudou de 3.000 '
             || 'para 9.999 sem bloqueio, sem justificativa, sem aprovação e sem trilha (o único '
             || 'gatilho da tabela é o de updated_at, que não guarda o valor anterior). Nem o '
             || 'status tem CHECK: qualquer texto vale. Recibo entregue dizendo um valor e banco '
             || 'dizendo outro é exatamente o cenário que a auditoria trabalhista procura, e a '
             || 'reabertura com rito (motivo + dupla aprovação + diferença como complemento/'
             || 'estorno) é o RF-007 do documento. Correção: trava de UPDATE para status pago/'
             || 'fechado + trilha append-only com antes/depois + fluxo de reabertura. Mesma '
             || 'disciplina do FERIAS-054.';
  ELSIF NOT v_alterou THEN
    r.situacao := 'passou';
    r.obtido := 'A edição direta do cálculo pago foi recusada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Alteração registrada em trilha (%s) — conferir se guarda antes/depois.', v_trg);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dec13_071()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_restr int; v_proprio int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de folha_13_calculo separam o próprio do alheio?';
  r.esperado := 'Colaborador lê só o próprio cálculo; folha da equipe restrita por perfil (camada RESTRICTIVE)';
  SELECT count(*) INTO v_restr
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_13_calculo'
    AND permissive = 'RESTRICTIVE';
  SELECT count(*) INTO v_proprio
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'folha_13_calculo'
    AND (qual ILIKE '%auth.uid%' OR qual ILIKE '%usuario%' OR qual ILIKE '%colaborador%uid%');

  IF v_restr = 0 AND v_proprio = 0 THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: folha_13_calculo tem UMA política, e ela é só de tenant — qualquer '
             || 'usuário autenticado da empresa, inclusive o colaborador comum, lê a folha de '
             || '13º INTEIRA: salário-base, médias e líquido de todos os colegas. Remuneração '
             || 'é dado pessoal com acesso mínimo (LGPD art. 6º VII e seção 6 do documento: '
             || 'colaborador vê só o próprio), e a tabela está FORA da camada '
             || 'perfil_restringe_leitura_* que protege as 20 tabelas sensíveis do sistema — '
             || 'a folha de férias (folha_ferias_calculo) já tem a dela, o 13º ficou sem. '
             || 'Correção: política RESTRICTIVE via perfil_permite_modulo (padrão PERFIL-003) '
             || '+ regra de "próprio registro" para o colaborador.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Camadas presentes (restritivas: %s; separação do próprio: %s políticas).',
                       v_restr, v_proprio);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dec13_071()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dec13_071 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 56 casos.

-- 13º Salário (17 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('DEC13-001', 'Avos apurados do vínculo: 1/12 por mês, fração de 15 dias conta', 'feliz', 'alta', 'aprovado', 'O 13º é 1/12 da remuneração por mês de serviço do ano, e a fração igual ou superior a 15 dias conta como mês inteiro. Os avos devem sair da DATA DE ADMISSÃO do vínculo — não de um número digitado à mão. Admitido em 20 de maio: maio tem menos de 15 dias, não conta; junho a dezembro contam — 7 avos. Admitido em 10 de maio: maio conta — 8 avos.', 'Vínculos fictícios admitidos em 10/05 e 20/05 do ano-base.', '[{"acao": "Apurar o 13º do admitido em 10/05", "ordem": 1, "resultado_esperado": "8 avos (maio conta — 22 dias trabalhados ≥ 15)"}, {"acao": "Apurar o 13º do admitido em 20/05", "ordem": 2, "resultado_esperado": "7 avos (maio com menos de 15 dias não conta)"}, {"acao": "Conferir a origem do número de meses", "ordem": 3, "resultado_esperado": "Calculado da data de admissão, não digitado livremente pelo operador"}]', 'Avos nascem do vínculo e da regra dos 15 dias — nunca de digitação.', 'Requisitos YE-DP-13-001: RN-001 / CA-001 / cenário "Admissão no ano" (seção 25). DIVERGÊNCIA VISÍVEL: calcular13 recebe mesesTrabalhados informado na tela (DecimoTerceiroTab) — sem apuração automática. Deve falhar e encaminhar.', 'e2e', 'Lei 4.090/1962, art. 1º, §§1º e 2º', 'em_triagem', NULL),
    ('DEC13-002', 'Faltas injustificadas derrubam o avo do mês que fica com menos de 15 dias', 'negativo', 'alta', 'aprovado', 'Mês em que as faltas INJUSTIFICADAS reduzem o trabalho para menos de 15 dias não gera avo. Faltas justificadas e afastamentos legais não entram nessa conta. A fonte é o Ponto — as ocorrências do módulo de jornada precisam refletir na apuração, senão o 13º sai maior do que o devido.', 'Vínculo com 16 faltas injustificadas registradas no Ponto em um mesmo mês do ano-base.', '[{"acao": "Apurar os avos do vínculo", "ordem": 1, "resultado_esperado": "O mês com 16 faltas injustificadas NÃO conta como avo"}, {"acao": "Repetir com faltas justificadas (atestado)", "ordem": 2, "resultado_esperado": "O mês conta normalmente — justificada não derruba avo"}]', 'Injustificada demais no mês, avo a menos; justificada não mexe.', 'Requisitos YE-DP-13-001: RN-001 / fluxo "Faltas injustificadas" (seção 9). Integração com Ponto/Afastamentos (seção 17).', 'e2e', 'Lei 4.090/1962, art. 1º, §1º (mês de serviço); tratamento consolidado das faltas injustificadas', 'em_triagem', NULL),
    ('DEC13-003', 'Afastamentos: maternidade integra, auxílio-doença divide com o INSS', 'alternativo', 'alta', 'aprovado', 'Afastamentos não são todos iguais: na licença-maternidade o período INTEGRA a apuração do empregador; no auxílio-doença, o empregador paga os avos trabalhados e o INSS paga o abono anual proporcional ao benefício. O sistema deve tratar cada tipo pelo seu efeito e marcar o caso para validação contábil — não apagar nem contar tudo igual.', 'Vínculos fictícios com licença-maternidade (4 meses) e auxílio-doença (5 meses) no ano-base.', '[{"acao": "Apurar o 13º da colaboradora em licença-maternidade", "ordem": 1, "resultado_esperado": "Período da licença conta na apuração patronal"}, {"acao": "Apurar o 13º do afastado por auxílio-doença", "ordem": 2, "resultado_esperado": "Avos patronais só dos meses trabalhados; período do benefício sinalizado como abono anual do INSS"}, {"acao": "Conferir a marcação do caso", "ordem": 3, "resultado_esperado": "Apuração marcada para validação contábil, com o tipo de afastamento visível"}]', 'Cada afastamento com seu efeito — e contabilidade avisada.', 'Requisitos YE-DP-13-001: RN-008 / CA (seção 24) / cenário "Afastamento" (seção 25). Classificação [OLC]/[VAL] — a divisão exata patronal×INSS é ponto de validação (seção 30). Integra com jornada-rotina/afastamentos. Requisitos YE-DP-AFAST-001: o lado AFASTAMENTOS (registro, efeito e reflexo) está em AFAST-010..080.', 'e2e', 'Lei 8.213/1991 (abono anual, art. 120 do Decreto 3.048/1999); salário-maternidade integra a apuração patronal', 'em_triagem', NULL),
    ('DEC13-020', 'Base do 13º inclui as médias das variáveis do ano', 'feliz', 'alta', 'aprovado', 'Quem recebe horas extras habituais, adicional noturno ou comissões não tem 13º só do salário fixo: as variáveis do ano entram na base pela média, conforme a parametrização de rubricas. Base composta apenas do fixo, para quem tem variável habitual, é diferença certa em reclamação.', 'Vínculo com salário fixo e horas extras habituais lançadas na folha ao longo do ano-base.', '[{"acao": "Calcular o 13º do vínculo com variáveis", "ordem": 1, "resultado_esperado": "Base = salário + média das variáveis, com memória de cálculo mostrando a composição"}, {"acao": "Conferir as rubricas que integraram", "ordem": 2, "resultado_esperado": "Somente rubricas parametrizadas como integrantes da base do 13º"}]', 'Variável habitual entra pela média — e a memória mostra o caminho.', 'Requisitos YE-DP-13-001: RN-002 / CA-002. Composição exata da base é [VAL]/[DAE] por cliente (seção 30); o que se testa é que a média EXISTE e é parametrizável (folha_rubricas).', 'e2e', 'Decreto 57.155/1965, art. 2º; Súmulas 45, 148 e 253 do TST', 'em_triagem', NULL),
    ('DEC13-021', 'Base de médias incompleta trava com alerta antes do fechamento', 'excecao', 'media', 'aprovado', 'Fechar o 13º com rubricas variáveis do ano faltando é pagar errado com hora marcada. Antes do fechamento, o sistema confere se as competências do ano têm as variáveis lançadas; faltando, alerta o DP e aponta o que completar — o fechamento com pendência exige decisão consciente, não passa em silêncio.', 'Ano-base com competências sem lançamento de rubricas variáveis para vínculo que as recebe habitualmente.', '[{"acao": "Preparar o fechamento do 13º", "ordem": 1, "resultado_esperado": "Alerta de base incompleta com as competências/rubricas faltantes"}, {"acao": "Completar os lançamentos e reprocessar", "ordem": 2, "resultado_esperado": "Alerta encerrado; médias recalculadas"}]', 'Média só fecha com o ano inteiro na mesa.', 'Requisitos YE-DP-13-001: seção 14 / cenário "Dado ausente" (seção 25) / IA "Detecção de médias incompletas" (seção 18).', 'api', 'Documento YE-DP-13-001, RF-006 e seção 14 (alerta "Base de médias incompleta")', 'em_triagem', NULL),
    ('DEC13-030', '1ª parcela: 50%, paga entre 1º de fevereiro e 30 de novembro', 'feliz', 'critica', 'aprovado', 'O adiantamento é METADE da remuneração do mês anterior, pago entre 1º/02 e 30/11. O sistema agenda a data-alvo, alerta na aproximação (D-30/15/7) e acusa o atraso — 1ª parcela paga em dezembro é infração, ainda que o valor esteja certo. FGTS incide sobre o adiantamento na competência do pagamento.', 'Ano-base com vínculos ativos e calendário carregado.', '[{"acao": "Programar a 1ª parcela dentro do prazo", "ordem": 1, "resultado_esperado": "50% da base, agendada até 30/11, com FGTS da competência"}, {"acao": "Aproximar-se de 30/11 sem pagamento", "ordem": 2, "resultado_esperado": "Alertas D-30/15/7 para DP/RH/Financeiro, com ação no Plano de Ação"}, {"acao": "Simular data de pagamento em dezembro", "ordem": 3, "resultado_esperado": "Acusado como fora do prazo legal — não passa como regular"}]', 'Metade do valor, dentro da janela legal, com o prazo vigiado.', 'Requisitos YE-DP-13-001: RN-003 / CA-003 / alerta "1ª parcela a vencer" (seção 14). DIVERGÊNCIA VISÍVEL: não há motor de prazos nem alertas do 13º hoje. Deve falhar e encaminhar.', 'api', 'Lei 4.749/1965, art. 2º', 'em_triagem', NULL),
    ('DEC13-031', '2ª parcela até 20 de dezembro, antecipando em fim de semana ou feriado', 'feliz', 'critica', 'aprovado', 'A 2ª parcela vence em 20/12 — e quando o dia 20 cai em sábado, domingo ou feriado, paga-se ANTES, não depois. O motor de datas precisa conhecer o calendário (tabela de feriados) e mover a data-alvo para o dia útil anterior, refletindo isso nos alertas (D-15/7/3).', 'Ano em que 20/12 cai em fim de semana; tabela de feriados carregada.', '[{"acao": "Consultar a data-alvo da 2ª parcela nesse ano", "ordem": 1, "resultado_esperado": "Antecipada para o último dia útil antes de 20/12"}, {"acao": "Conferir os alertas", "ordem": 2, "resultado_esperado": "D-15/7/3 contados sobre a data antecipada, prioridade crítica"}]', 'O prazo corre para trás no calendário, nunca para frente.', 'Requisitos YE-DP-13-001: RN-004 / CA-004 / cenário "Prazo vencido" (seção 25) / RNF-003. Usa a tabela feriados já existente no projeto.', 'api', 'Lei 4.749/1965, art. 1º; regra de antecipação por dia não útil', 'em_triagem', NULL),
    ('DEC13-032', 'Adiantamento nas férias: requerido em janeiro, pago no gozo, baixado na apuração', 'alternativo', 'media', 'aprovado', 'Quem requer em janeiro recebe a 1ª parcela junto das férias. O lado Férias já tem caso (FERIAS-035); aqui se testa o lado 13º: a opção registrada muda a data do adiantamento para o gozo, o valor pago nas férias aparece na apuração anual como adiantamento JÁ FEITO e a 2ª parcela deduz exatamente esse valor — sem pagar de novo em novembro.', 'Vínculo com adiantar_13 = true requerido em janeiro e férias gozadas em julho, com a 1ª parcela paga junto.', '[{"acao": "Consultar a apuração do 13º do vínculo", "ordem": 1, "resultado_esperado": "Adiantamento marcado como pago nas férias, com valor e data"}, {"acao": "Programar a rodada geral de novembro", "ordem": 2, "resultado_esperado": "Vínculo fora da rodada da 1ª parcela — já recebeu"}, {"acao": "Calcular a 2ª parcela", "ordem": 3, "resultado_esperado": "Deduzido o valor pago nas férias, não os 50% teóricos"}]', 'Pagou nas férias, baixou na apuração, deduziu na 2ª — uma vez só.', 'Requisitos YE-DP-13-001: RN-003 / CA-003 / cenário "Adiantamento nas férias" (seção 9). Par do FERIAS-035 (lado Férias). Política de adiantamento é [DAE] (seção 30).', 'e2e', 'Lei 4.749/1965, art. 2º, §2º', 'em_triagem', NULL),
    ('DEC13-033', '2ª parcela deduz o adiantamento e diferenças posteriores geram complemento', 'alternativo', 'alta', 'aprovado', 'A 2ª parcela é o total anual MENOS o adiantamento efetivamente pago. E o ano não acaba em 20/12: variável lançada depois (comissão de dezembro, HE do fim do ano) gera DIFERENÇA a apurar como complemento, com trilha própria e reflexo no eSocial — não se reabre o valor pago fingindo que nada mudou.', '1ª parcela paga; variável nova lançada após o pagamento da 2ª.', '[{"acao": "Calcular a 2ª parcela", "ordem": 1, "resultado_esperado": "Total anual menos o adiantamento real, com memória de cálculo"}, {"acao": "Lançar variável retroativa do ano", "ordem": 2, "resultado_esperado": "Diferença detectada e alerta a DP/Contador"}, {"acao": "Apurar o complemento", "ordem": 3, "resultado_esperado": "Complemento com trilha vinculada à apuração original e reflexo no eSocial"}]', 'Deduz o que foi pago; o que chegar depois vira complemento rastreado.', 'Requisitos YE-DP-13-001: CA-005 / RF-006 / cenário "Diferença" (seção 25) / alerta "Diferença após a 2ª parcela" (seção 14).', 'e2e', 'Lei 4.749/1965, arts. 1º e 2º; Decreto 57.155/1965 (recálculo com variáveis do ano)', 'em_triagem', NULL),
    ('DEC13-040', 'INSS do 13º: só na 2ª parcela, calculado em separado da folha do mês', 'feliz', 'critica', 'aprovado', 'O INSS incide sobre o 13º INTEIRO, mas só é retido na 2ª parcela — e a base do 13º é tributada SEPARADA da remuneração de dezembro, cada uma com sua progressão de faixas. Somar as duas bases numa conta só infla a alíquota e desconta INSS a mais do colaborador.', 'Vínculo com salário que, somado ao 13º, mudaria de faixa se as bases fossem somadas.', '[{"acao": "Calcular a 1ª parcela", "ordem": 1, "resultado_esperado": "Nenhum INSS retido no adiantamento"}, {"acao": "Calcular a 2ª parcela", "ordem": 2, "resultado_esperado": "INSS sobre o 13º integral, com progressão de faixas própria, separada da folha de dezembro"}, {"acao": "Conferir a tabela aplicada", "ordem": 3, "resultado_esperado": "Tabela de INSS vigente na competência (tabela versionada), não fixa em código"}]', 'Base do 13º anda sozinha na tabela — e só paga na 2ª.', 'Requisitos YE-DP-13-001: RN-005 / CA-004. Usa folha_tabelas_inss (versionada — RNF-002). Tabelas vigentes são [VAL] (seção 30). Requisitos YE-DP-FOLHA-001: o reflexo dos encargos na folha mensal ganhou família própria (FOLHA-010/011 — INSS progressivo e IRRF com redutor).', 'e2e', 'Lei 8.212/1991; Decreto 3.048/1999, art. 214, §6º (cálculo em separado); retenção na quitação da 2ª parcela', 'em_triagem', NULL),
    ('DEC13-041', 'IRRF do 13º: tributação exclusiva na fonte, apurada na 2ª parcela', 'feliz', 'critica', 'aprovado', 'O IRRF do 13º é EXCLUSIVO na fonte: apurado sobre o valor integral na quitação da 2ª parcela, com as deduções legais (dependentes, INSS do próprio 13º), e NÃO se soma aos rendimentos do mês para reajustar a tabela. Misturar o 13º com o salário de dezembro no IRRF é erro clássico que muda o imposto dos dois.', 'Vínculo com dependentes cadastrados e 13º na faixa tributável.', '[{"acao": "Calcular a 1ª parcela", "ordem": 1, "resultado_esperado": "Nenhum IRRF no adiantamento"}, {"acao": "Calcular a 2ª parcela", "ordem": 2, "resultado_esperado": "IRRF sobre o 13º integral, deduzindo INSS do 13º e dependentes, separado do IRRF do salário"}, {"acao": "Conferir o caráter exclusivo", "ordem": 3, "resultado_esperado": "Valor não compensável/somável com a tributação mensal; tabela vigente versionada"}]', 'Imposto do 13º nasce e morre na 2ª parcela, sem contaminar o mês.', 'Requisitos YE-DP-13-001: RN-007 / CA-004. Usa folha_tabelas_irrf (versionada). Tabela anual e deduções são [VAL] (seção 30). Requisitos YE-DP-FOLHA-001: o reflexo dos encargos na folha mensal ganhou família própria (FOLHA-010/011 — INSS progressivo e IRRF com redutor).', 'e2e', 'RIR/2018 (Decreto 9.580/2018), art. 700 — tributação exclusiva na fonte do 13º salário', 'em_triagem', NULL),
    ('DEC13-042', 'FGTS de 8% nas duas parcelas, cada uma na sua competência', 'feliz', 'alta', 'aprovado', 'O FGTS incide sobre AMBAS as parcelas — 8% sobre o adiantamento na competência em que foi pago e 8% sobre o restante na competência da 2ª parcela. Depositar tudo em dezembro, ou esquecer o depósito do adiantamento, deixa diferença de FGTS que o FGTS Digital denuncia.', '1ª parcela paga em novembro; 2ª em dezembro.', '[{"acao": "Conferir o FGTS da 1ª parcela", "ordem": 1, "resultado_esperado": "8% sobre os 50% pagos, na competência de novembro"}, {"acao": "Conferir o FGTS da 2ª parcela", "ordem": 2, "resultado_esperado": "8% sobre a diferença (total menos adiantamento), na competência de dezembro"}, {"acao": "Somar as duas competências", "ordem": 3, "resultado_esperado": "8% exatos sobre o 13º integral — sem falta nem duplicidade"}]', 'Oito por cento no total, repartidos pela competência de cada parcela.', 'Requisitos YE-DP-13-001: RN-006 / CA-004. calcular13 já reparte a base (1ª: metade; 2ª: diferença) — o que falta conferir é o registro por competência para a guia. Alíquota parametrizada por vínculo (aprendiz 2%).', 'e2e', 'Lei 8.036/1990, art. 15 (a remuneração inclui a gratificação de Natal)', 'em_triagem', NULL),
    ('DEC13-050', 'eSocial do 13º: S-1200 da folha anual e S-1210 dos pagamentos, sem duplicar', 'excecao', 'alta', 'aprovado', 'O 13º tem folha PRÓPRIA no eSocial: apuração anual via S-1200 e pagamentos das parcelas via S-1210, no leiaute vigente. Rejeição volta traduzida (o que houve, onde corrigir) e o reenvio retifica — nunca cria segundo evento da mesma competência anual. Sem esses eventos, o 13º pago não existe para o governo.', 'Apuração e pagamentos do 13º concluídos no ambiente de teste.', '[{"acao": "Fechar a apuração anual", "ordem": 1, "resultado_esperado": "S-1200 anual gerado no leiaute vigente"}, {"acao": "Registrar os pagamentos das parcelas", "ordem": 2, "resultado_esperado": "S-1210 correspondente, valores conciliados com as parcelas"}, {"acao": "Simular rejeição e reenviar", "ordem": 3, "resultado_esperado": "Retorno traduzido, ação sugerida, reenvio como retificação — sem evento duplicado"}]', 'Folha anual declarada, pagamentos casados, rejeição virando retificação.', 'Requisitos YE-DP-13-001: RN-010 / CA-007 / cenário "Com erro" (seção 25). DIVERGÊNCIA VISÍVEL: não há geração de S-1200/S-1210 hoje. Deve falhar e encaminhar. Mesma disciplina de ADM-093 e FERIAS-081.', 'api', 'eSocial — S-1200 (apuração anual do 13º) e S-1210 (pagamentos); regras de retificação', 'em_triagem', NULL),
    ('DEC13-051', 'Provisão do 13º atualizada a cada competência e conciliável com a folha', 'feliz', 'media', 'aprovado', 'O custo do 13º nasce mês a mês (1/12 + encargos por competência), não em dezembro. A provisão acompanha cada fato gerador — admissões, desligamentos e reajustes mexem nela — e o contador consegue conciliar o saldo provisionado com o efetivamente pago no fim do ano, com relatório exportável.', 'Ano-base com admissões e um desligamento no meio do ano.', '[{"acao": "Conferir a provisão após cada competência", "ordem": 1, "resultado_esperado": "Saldo cresce 1/12 + encargos por vínculo ativo; ajusta em admissão/desligamento"}, {"acao": "Pagar as parcelas", "ordem": 2, "resultado_esperado": "Provisão baixada contra os pagamentos"}, {"acao": "Exportar o relatório de provisão", "ordem": 3, "resultado_esperado": "Saldo conciliável com a folha e com o pago, por estabelecimento"}]', 'Provisão viva o ano inteiro — dezembro só confirma o que já estava contado.', 'Requisitos YE-DP-13-001: CA-009 / seção 20 / alerta "Provisão desatualizada" (seção 14). Existe folha_provisoes genérica; o vínculo específico com o 13º é o que se testa. Regras de conciliação são [DAE]/[VAL] (seção 30).', 'api', 'Documento YE-DP-13-001, CA-009 e RNF-007; regime de competência contábil', 'em_triagem', NULL),
    ('DEC13-060', 'Rescisão no ano-base: 13º proporcional pago, justa causa perde, adiantamento concilia', 'alternativo', 'alta', 'aprovado', 'Desligado no meio do ano, o colaborador leva o 13º proporcional aos avos trabalhados (indenizado na rescisão); na dispensa POR JUSTA CAUSA, perde a proporcional. E se a 1ª parcela já tinha sido paga (inclusive nas férias), o valor adiantado é conciliado nas verbas — na justa causa, o adiantado a maior vira desconto conforme a regra.', 'Vínculos fictícios desligados em agosto: um sem justa causa (com adiantamento pago), outro por justa causa.', '[{"acao": "Processar a rescisão sem justa causa", "ordem": 1, "resultado_esperado": "13º proporcional (8/12) nas verbas, deduzido o adiantamento pago"}, {"acao": "Processar a rescisão por justa causa", "ordem": 2, "resultado_esperado": "13º proporcional zerado, com a base legal citada"}, {"acao": "Conferir a conciliação na apuração anual", "ordem": 3, "resultado_esperado": "Vínculo desligado fora da rodada de novembro/dezembro — quitado na rescisão"}]', 'Proporcional na rescisão, nada na justa causa, adiantamento nunca em dobro.', 'Requisitos YE-DP-13-001: RN-009 / CA-006 / cenário "Rescisão" (seção 25). A família DESL cobre as verbas em geral (culpa recíproca 50% = DESL-035); aqui se testa a CONCILIAÇÃO com o módulo do 13º.', 'e2e', 'Lei 4.090/1962, art. 3º; CLT, art. 477; justa causa afasta a gratificação proporcional', 'em_triagem', NULL),
    ('DEC13-070', 'Cálculo fechado do 13º só reabre com dupla aprovação e diferença rastreada', 'excecao', 'alta', 'aprovado', 'Corrigir 13º já fechado e pago não é editar o registro: é REABRIR com motivo, dupla aprovação, recálculo e apuração da diferença (complemento ou estorno), preservando a versão original na trilha. Alteração silenciosa em valor pago é exatamente o que a auditoria trabalhista procura.', 'Cálculo de 13º fechado e pago no ambiente de teste.', '[{"acao": "Tentar editar diretamente o cálculo fechado", "ordem": 1, "resultado_esperado": "Bloqueado — só via reabertura formal"}, {"acao": "Reabrir com motivo e dupla aprovação", "ordem": 2, "resultado_esperado": "Recálculo executado; diferença apurada como complemento/estorno"}, {"acao": "Conferir a trilha", "ordem": 3, "resultado_esperado": "Versão original preservada; quem, quando, por quê e a diferença encadeados"}]', 'Fechado não se edita: reabre com rito ou não muda.', 'Requisitos YE-DP-13-001: RF-007 / cenário "Alteração retroativa" (seção 25). Mesma disciplina de FERIAS-054 (reabertura de férias).', 'api', 'Documento YE-DP-13-001, RF-007; RNF-004 (trilha imutável)', 'em_triagem', NULL),
    ('DEC13-071', 'Remuneração do 13º restrita por perfil: colaborador só vê o próprio', 'negativo', 'alta', 'aprovado', 'Valores de 13º são dado de remuneração: o colaborador consulta SÓ o próprio cálculo e recibo; a folha da equipe/empresa fica com DP, RH, financeiro e contador conforme a matriz de perfis, sempre dentro do tenant. Vazamento horizontal de remuneração entre colegas é incidente LGPD, não bug estético.', 'Colaborador comum autenticado no tenant de teste; cálculos de 13º de vários vínculos existentes.', '[{"acao": "Colaborador consulta o próprio 13º", "ordem": 1, "resultado_esperado": "Permitido — parcelas e recibo próprios"}, {"acao": "Colaborador tenta ler o cálculo de um colega", "ordem": 2, "resultado_esperado": "Bloqueado pela política de acesso (RLS)"}, {"acao": "Usuário de outro tenant tenta ler qualquer cálculo", "ordem": 3, "resultado_esperado": "Bloqueado — segregação por empresa"}]', 'Cada um vê o seu; a folha inteira é assunto de quem opera a folha.', 'Requisitos YE-DP-13-001: seção 6 / seção 22 / cenário "Permissões insuficientes" (seção 25). A tabela folha_13_calculo é sensível: conferir cobertura da camada perfil_restringe_leitura_* (rotina PERFIL-003) ou exceção documentada.', 'api', 'LGPD (Lei 13.709/2018), arts. 6º, VII e 46 — segurança e acesso mínimo; matriz de perfis do documento (seção 6)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'financeiro/decimo-terceiro'
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

-- Admissao (1 de 2) (1 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('ADM-001', 'Admissao: criar e avancar status', 'feliz', 'alta', 'aprovado', 'Verificar o ciclo basico de admissao: criar o registro e avancar o status ate a conclusao. Regra: a admissao percorre etapas ate o colaborador estar efetivamente admitido. Importa porque e o processo de entrada de pessoas na empresa — e porque este fluxo era testado pelo agente anterior escrevendo direto em dados de clientes reais; aqui ele roda no ambiente cercado, verificando a mesma coisa sem risco.', 'Empresa cadastrada no ambiente de teste.', '[{"acao": "Iniciar uma nova admissao", "dados": "Nome do candidato e dados basicos", "ordem": 1, "onde_na_tela": "Menu > RH e DP > Admissao > Nova Admissao", "resultado_esperado": "Admissao criada com status inicial"}, {"acao": "Avancar o status da admissao", "dados": "Status: avancar para a proxima etapa do fluxo", "ordem": 2, "onde_na_tela": "Admissao > acao de avancar etapa", "resultado_esperado": "O status muda e a data da transicao e registrada"}, {"acao": "Conferir o registro", "dados": "-", "ordem": 3, "onde_na_tela": "Lista de admissoes", "resultado_esperado": "A admissao aparece com o status atualizado"}]', 'A admissao e criada e avanca de status corretamente, com o registro persistindo entre as etapas.', 'IMPACTO SE FALHAR: a admissao e o processo de entrada de pessoas — se travar, ninguem e contratado pelo sistema. HISTORIA DESTE CASO: era testado pelo agente de QA anterior (ai-qa-agent, marco/2026), que escrevia DIRETO nas tabelas de clientes reais, usando IA para decidir o que verificar. Foi reescrito para rodar no cercado, de forma deterministica. O que se verifica e o mesmo; o como mudou completamente. Requisitos YE-DP-ADM-001: seção 12 (dados do registro) e RF-005 (ficha de registro).', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'rh-dp/admissao'
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

-- Admissao (2 de 2) (38 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('ADM-002', 'CPF do candidato e unico e nao duplica colaborador existente', 'negativo', 'critica', 'aprovado', 'Duas admissoes para a mesma pessoa produzem dois vinculos no eSocial.', 'Colaborador ja cadastrado.', '[{"acao": "Iniciar admissao com CPF ja existente e ativo", "ordem": 1, "resultado_esperado": "Bloqueado ou alertado antes de prosseguir"}, {"acao": "Repetir com o CPF formatado de outra forma", "ordem": 2, "resultado_esperado": "Reconhecido como a mesma pessoa"}, {"acao": "CPF de pessoa ja desligada", "ordem": 3, "resultado_esperado": "Permitido — readmissao e legitima"}]', 'A unicidade e por pessoa, e readmissao continua possivel.', 'Conecta diretamente com COLAB-033 (CPF formatado tratado como pessoa diferente) e COLAB-034, ja documentados no modulo de Colaboradores. O passo 3 e a contraprova que impede a correcao de virar trava excessiva.', 'api', 'CLT, art. 41 (unicidade do registro); MOS — o CPF e a chave do trabalhador no eSocial, e duplicidade gera inconsistencia no evento', 'em_triagem', NULL),
    ('ADM-003', 'Documentos obrigatorios sao gerados uma unica vez por admissao', 'negativo', 'alta', 'aprovado', 'Reprocessar a criacao da admissao nao pode dobrar a lista de pendencias.', 'Nenhuma.', '[{"acao": "Criar admissao", "ordem": 1, "resultado_esperado": "9 documentos obrigatorios na lista"}, {"acao": "Reprocessar o mesmo fluxo", "ordem": 2, "resultado_esperado": "Continua 9, sem duplicar"}]', 'O checklist nao duplica em reprocessamento.', 'IMPLEMENTADO e com cicatriz documentada no proprio codigo: era insert puro e dobrava a lista para 18. Hoje e upsert ancorado no indice admissao_documentos_admissao_nome_uidx. Caso de protecao — o comentario no codigo conta a historia, mas comentario nao roda. Requisitos YE-DP-ADM-001: RN-001/CA-001 (documentos obrigatórios bloqueiam o avanço).', 'api', 'Regra de produto (sem base legal): consistencia do checklist.', 'em_triagem', NULL),
    ('ADM-010', 'Cadastro rapido e admissao completa produzem colaborador equivalente', 'alternativo', 'critica', 'aprovado', 'Duas portas de entrada para o mesmo cadastro so se justificam se a saida for a mesma. Diferenca silenciosa cria duas classes de colaborador.', 'Nenhuma.', '[{"acao": "Cadastrar pela aba Ativos (rota enxuta)", "ordem": 1, "resultado_esperado": "Colaborador criado"}, {"acao": "Cadastrar outro pela aba Admissoes (rota completa)", "ordem": 2, "resultado_esperado": "Colaborador criado"}, {"acao": "Comparar os dois registros", "ordem": 3, "resultado_esperado": "Mesmas tabelas alimentadas, mesmos campos estruturais, mesmos vinculos"}, {"acao": "Conferir o que a rota enxuta NAO preenche", "ordem": 4, "resultado_esperado": "Lista conhecida e documentada, nao surpresa"}]', 'As duas rotas convergem para o mesmo registro, com diferencas conhecidas.', 'O passo 4 e o objetivo real deste caso: hoje ninguem sabe exatamente o que a rota enxuta deixa de preencher. Ate mapear isso, nao da para saber se um colaborador cadastrado rapidamente esta apto a gerar S-2200, a receber ASO ou a entrar na apuracao de ponto. | RECLASSIFICADO 01/08/2026 (api -> e2e): depende de fluxo disparado pelo React (hook de upload ou comparacao entre formularios). Rotina SQL nao consegue exercita-lo; so constataria ausencia provocada pelo proprio metodo. Cobertura pertence ao Cypress.', 'e2e', 'CLT, art. 41 — o registro exigido em lei e um so, independente da tela usada para cria-lo', 'em_triagem', NULL),
    ('ADM-011', 'Colaborador da rota enxuta pode ser completado depois sem duplicar', 'alternativo', 'critica', 'aprovado', 'Fluxo real: cadastro rapido para destravar operacao, admissao completa depois.', 'Colaborador criado pela rota enxuta.', '[{"acao": "Iniciar admissao completa para a mesma pessoa", "ordem": 1, "resultado_esperado": "O sistema reconhece o cadastro existente e o COMPLETA"}, {"acao": "Conferir a contagem de colaboradores", "ordem": 2, "resultado_esperado": "Um, nao dois"}, {"acao": "Conferir vinculos, ponto e documentos", "ordem": 3, "resultado_esperado": "Preservados — o id da pessoa nao mudou"}]', 'Completar o cadastro nao cria pessoa nova.', 'RISCO ALTO e diretamente ligado a investigacao de duplicacao de colaboradores ja feita neste sistema. O passo 3 e o mesmo cuidado do COLAB-032: se o fluxo apagar e recriar em vez de atualizar no lugar, o id muda e todo o historico vinculado fica orfao. | RECLASSIFICADO 01/08/2026 (api -> e2e): depende de fluxo disparado pelo React (hook de upload ou comparacao entre formularios). Rotina SQL nao consegue exercita-lo; so constataria ausencia provocada pelo proprio metodo. Cobertura pertence ao Cypress.', 'e2e', 'CLT, art. 41 (unicidade do registro)', 'em_triagem', NULL),
    ('ADM-012', 'Rota enxuta tambem alimenta o checklist de documentos', 'alternativo', 'media', 'aprovado', 'Se so a rota completa gera checklist, o colaborador da rota enxuta nunca tem documentacao cobrada.', 'Colaborador criado pela rota enxuta.', '[{"acao": "Conferir se ha registros em admissao_documentos", "ordem": 1, "resultado_esperado": "Checklist criado tambem por esta rota"}, {"acao": "Conferir a pendencia de documentos obrigatorios", "ordem": 2, "resultado_esperado": "Visivel em algum lugar para o RH"}]', 'As duas rotas geram a mesma exigencia documental.', 'PARCIAL: ColaboradorForm.tsx faz insert em admissao_documentos, entao alguma coisa acontece. Falta conferir se e a lista completa dos 9 obrigatorios ou um subconjunto, e se a pendencia aparece para o RH em algum painel. | RECLASSIFICADO 01/08/2026 (api -> e2e): depende de fluxo disparado pelo React (hook de upload ou comparacao entre formularios). Rotina SQL nao consegue exercita-lo; so constataria ausencia provocada pelo proprio metodo. Cobertura pertence ao Cypress. Requisitos YE-DP-ADM-001: RN-001/CA-001 (documentos obrigatórios bloqueiam o avanço).', 'e2e', 'Premissa de produto: arquivamento unico vale para as duas rotas.', 'em_triagem', NULL),
    ('ADM-020', 'Experiência: máximo de 90 dias e uma única prorrogação', 'negativo', 'alta', 'aprovado', 'O contrato de experiência não pode exceder 90 dias, contada a soma dos períodos, e só admite UMA prorrogação dentro desse teto. Sistema que aceita 100 dias, ou uma segunda prorrogação, cria contrato que a Justiça converte em prazo indeterminado — com todas as verbas da conversão.', 'Admissão em montagem com modalidade "experiência".', '[{"acao": "Configurar experiência de 100 dias", "ordem": 1, "resultado_esperado": "Recusado — limite legal de 90 dias somados"}, {"acao": "Configurar 45 + 45 dias (uma prorrogação)", "ordem": 2, "resultado_esperado": "Aceito; alerta de término agendado para o fim de cada período"}, {"acao": "Tentar registrar SEGUNDA prorrogação", "ordem": 3, "resultado_esperado": "Recusado — art. 451 admite prorrogação única"}]', '90 dias no total, prorrogação uma vez, nunca duas.', 'Requisitos YE-DP-ADM-001: RN-004 / CA-004 / cenário "Experiência" (seção 25). Alimenta os alertas de término já usados pela tela Contratos de Experiência.', 'api', 'CLT, art. 445, parágrafo único; art. 451', 'em_triagem', NULL),
    ('ADM-021', 'Prazo determinado: teto de 2 anos, inclusive com prorrogação', 'negativo', 'alta', 'aprovado', 'Contrato por prazo determinado (fora da experiência) respeita o teto de 2 anos — a soma do período original com a prorrogação única não pode passar disso. Exceder o teto ou prorrogar duas vezes descaracteriza o prazo e o vínculo vira indeterminado por força de lei.', 'Admissão com modalidade "prazo determinado".', '[{"acao": "Configurar contrato determinado de 30 meses", "ordem": 1, "resultado_esperado": "Recusado — teto legal de 2 anos"}, {"acao": "Configurar 18 meses e prorrogar por mais 6", "ordem": 2, "resultado_esperado": "Aceito (24 meses no total, prorrogação única)"}, {"acao": "Tentar prorrogar novamente", "ordem": 3, "resultado_esperado": "Recusado — descaracterizaria o prazo (art. 451)"}]', 'Dois anos é o teto; prorrogação conta dentro dele.', 'Requisitos YE-DP-ADM-001: RN-004 / base legal (arts. 445/451). Par do ADM-020, que trata a espécie "experiência".', 'api', 'CLT, art. 445, caput; art. 451', 'em_triagem', NULL),
    ('ADM-022', 'Intermitente: contrato escrito com o valor da hora garantido', 'alternativo', 'media', 'aprovado', 'A modalidade intermitente exige contrato ESCRITO com o valor da hora de trabalho, que não pode ser inferior ao mínimo horário nem ao dos demais empregados na mesma função. Sem essas cláusulas específicas, o contrato intermitente não se sustenta e o vínculo tende à forma comum.', 'Admissão com modalidade "intermitente".', '[{"acao": "Montar o contrato intermitente", "ordem": 1, "resultado_esperado": "Modelo específico com valor da hora e cláusulas de convocação/aceite"}, {"acao": "Informar valor-hora abaixo do mínimo horário ou do pago à mesma função", "ordem": 2, "resultado_esperado": "Recusado — piso do art. 452-A, §1º"}]', 'Intermitente só por escrito e com a hora no piso.', 'Requisitos YE-DP-ADM-001: base legal art. 452-A [OLC]/[VAL] / fluxo "Contrato intermitente" (seção 9). Cláusulas finais são [VAL] jurídico (seção 30).', 'api', 'CLT, art. 452-A (contrato de trabalho intermitente)', 'em_triagem', NULL),
    ('ADM-030', 'Menor de 16 anos só entra como aprendiz, a partir dos 14', 'negativo', 'alta', 'aprovado', 'É proibido qualquer trabalho a menores de 16 anos, salvo na condição de aprendiz a partir dos 14. A validação é pela idade NA DATA DE INÍCIO: candidato de 15 anos em contrato comum é admissão nula que o sistema não pode deixar passar; como aprendiz, exige a documentação própria (matrícula no programa).', 'Candidatos fictícios de 15 e 17 anos em admissão.', '[{"acao": "Admitir candidato de 15 anos em contrato comum", "ordem": 1, "resultado_esperado": "Bloqueado — só na condição de aprendiz"}, {"acao": "Admitir o mesmo candidato como aprendiz", "ordem": 2, "resultado_esperado": "Aceito, exigindo a documentação do programa de aprendizagem"}, {"acao": "Admitir candidato de 17 anos em contrato comum", "ordem": 3, "resultado_esperado": "Aceito, com as restrições de menor sinalizadas (ADM-031)"}]', 'Idade na data de início decide; 14–15 só aprendiz.', 'Requisitos YE-DP-ADM-001: RN-005 / CA-005 / cenário "Menor/aprendiz" (seção 25).', 'api', 'CF, art. 7º, XXXIII; CLT, art. 403', 'em_triagem', NULL),
    ('ADM-031', 'Menor de 18: vedado trabalho noturno, insalubre e perigoso', 'negativo', 'alta', 'aprovado', 'Admitido o menor de 18 (inclusive aprendiz), o sistema deve barrar a alocação em jornada noturna e em função/ambiente insalubre ou perigoso. A vedação é absoluta — não existe adicional que a compense — e o cruzamento é entre a idade do candidato e o cadastro de riscos da função (SST).', 'Candidato de 17 anos; função cadastrada com risco de insalubridade e escala noturna disponível.', '[{"acao": "Vincular o menor à função insalubre/perigosa", "ordem": 1, "resultado_esperado": "Bloqueado, citando a vedação constitucional"}, {"acao": "Vincular o menor a escala com período noturno", "ordem": 2, "resultado_esperado": "Bloqueado — trabalho noturno vedado ao menor"}, {"acao": "Vincular a função e turno diurnos sem riscos", "ordem": 3, "resultado_esperado": "Aceito normalmente"}]', 'Menor não vai para noite, insalubridade nem perigo — nunca.', 'Requisitos YE-DP-ADM-001: RN-005 / alerta "Menor: função vedada" (seção 14). Depende do cadastro de riscos por função (integração SST, seção 17).', 'api', 'CF, art. 7º, XXXIII; CLT, arts. 404 e 405', 'em_triagem', NULL),
    ('ADM-040', 'Cota de aprendizes: 5% a 15% das funções que demandam formação', 'alternativo', 'media', 'aprovado', 'Estabelecimentos obrigados devem manter aprendizes entre 5% e 15% dos trabalhadores em funções que demandem formação profissional. O sistema calcula a base, o mínimo e o máximo por estabelecimento, mostra o realizado × exigido e sinaliza o risco — o enquadramento (porte/atividade) é parametrizável.', 'Empresa fictícia com base de cálculo definida e nenhum aprendiz ativo.', '[{"acao": "Consultar o painel de cotas do estabelecimento", "ordem": 1, "resultado_esperado": "Base, mínimo (5%) e máximo (15%) calculados, com o realizado atual"}, {"acao": "Admitir um aprendiz", "ordem": 2, "resultado_esperado": "O realizado da cota atualiza na conclusão da admissão"}]', 'Cota calculada por estabelecimento, visível antes da autuação.', 'Requisitos YE-DP-ADM-001: RN-006 / alerta "Cota em risco" (seção 14). Enquadramento é [RCE] — parametrização por cliente (seção 30).', 'api', 'CLT, art. 429; Lei 10.097/2000', 'em_triagem', NULL),
    ('ADM-041', 'Cota de PcD: 2% a 5% a partir de 100 empregados, com recálculo', 'alternativo', 'alta', 'aprovado', 'Empresa com 100 ou mais empregados deve preencher de 2% a 5% dos cargos com reabilitados ou pessoas com deficiência, por faixa de efetivo. Quando a base muda (admissões/desligamentos), a cota é RECALCULADA e o risco sinalizado — inclusive quando um desligamento derruba a empresa abaixo do exigido.', 'Empresa fictícia com 120 empregados ativos e 2 PcD (cota exigida: 3).', '[{"acao": "Consultar a cota com 120 ativos", "ordem": 1, "resultado_esperado": "Exigido 3 (2% de 120, arredondamento para cima), realizado 2 — risco sinalizado"}, {"acao": "Alterar a base (admitir até 130 ativos)", "ordem": 2, "resultado_esperado": "Cota recalculada automaticamente; alerta atualizado"}]', 'Base mudou, cota recalcula, risco aparece — sem esperar fiscalização.', 'Requisitos YE-DP-ADM-001: RN-006 / CA-006 / cenário "Cota PcD" (seção 25). Percentuais por faixa; base de cálculo é [RCE]/[DAE] (seção 30).', 'api', 'Lei 8.213/1991, art. 93', 'em_triagem', NULL),
    ('ADM-050', 'Vale-transporte: opção colhida na admissão, renúncia por escrito', 'alternativo', 'media', 'aprovado', 'O VT depende da OPÇÃO do empregado, informando endereço e meios de transporte; quem não quer, renuncia formalmente — e a renúncia vira termo arquivado. Descontar VT de quem renunciou, ou não ter prova da renúncia de quem depois reclama o benefício, são os dois erros que o termo evita.', 'Coleta de admissão na etapa de benefícios.', '[{"acao": "Candidato opta pelo VT informando trajeto/linhas", "ordem": 1, "resultado_esperado": "Opção registrada; benefício e desconto (limite legal) preparados para a Folha"}, {"acao": "Candidato renuncia ao VT", "ordem": 2, "resultado_esperado": "Termo de renúncia gerado, assinado e arquivado em Documentos; nenhum desconto configurado"}]', 'Opção ou renúncia — sempre documentada, nunca presumida.', 'Requisitos YE-DP-ADM-001: RN-007 / seção 12 (opção de VT) / seção 16 (termos). Percentual de desconto é parametrizável [DAE]. | Requisitos YE-DP-BEN-001: a coleta da opção do VT na admissão segue aqui; a trava na adesão do benefício e o termo arquivado são o BEN-010/BEN-060.', 'api', 'Lei 7.418/1985; Decreto 10.854/2021', 'em_triagem', NULL),
    ('ADM-051', 'Salário de admissão respeita o piso e a coerência interna', 'negativo', 'alta', 'aprovado', 'Na abertura da admissão o sistema confere o salário contra o piso do instrumento coletivo vigente para a categoria/função — abaixo do piso, bloqueia ou exige justificativa formal. E aponta incoerência com os salários praticados na mesma função (igualdade salarial, Lei 14.611), antes de virar passivo.', 'Função com piso definido em instrumento coletivo vigente; colegas na mesma função com salários conhecidos.', '[{"acao": "Abrir admissão com salário abaixo do piso da categoria", "ordem": 1, "resultado_esperado": "Recusado (ou exige justificativa formal com trilha), citando o instrumento"}, {"acao": "Abrir admissão com salário destoante dos pares da função", "ordem": 2, "resultado_esperado": "Alerta de coerência salarial para RH/Compliance, com os parâmetros da comparação"}]', 'Piso é chão duro; discrepância entre pares é alerta.', 'Requisitos YE-DP-ADM-001: RF-001 (verificação de piso na abertura) / base legal Lei 14.611 [VAL]. Depende do cadastro de instrumentos coletivos (seção 17).', 'api', 'CCT/ACT da categoria (piso); CF, art. 7º, V; Lei 14.611/2023', 'em_triagem', NULL),
    ('ADM-052', 'Checklist de documentos se adapta ao instrumento coletivo', 'alternativo', 'media', 'aprovado', 'Convenções podem exigir documentos além do padrão (ex.: declaração específica, exame adicional). O checklist da coleta é uma camada parametrizável por empresa/categoria/vigência: registrada a exigência no instrumento, toda admissão daquela categoria passa a cobrá-la — sem mexer em código.', 'Instrumento coletivo vigente com exigência de documento adicional cadastrada.', '[{"acao": "Abrir admissão de colaborador da categoria coberta", "ordem": 1, "resultado_esperado": "Checklist inclui o documento adicional exigido pelo instrumento"}, {"acao": "Abrir admissão de categoria sem a exigência", "ordem": 2, "resultado_esperado": "Checklist padrão, sem o item extra"}, {"acao": "Tentar concluir a coleta sem o documento adicional", "ordem": 3, "resultado_esperado": "Bloqueado como qualquer obrigatório (mesma regra do RN-001)"}]', 'A convenção manda no checklist; o checklist obedece por parâmetro.', 'Requisitos YE-DP-ADM-001: RN-008 / cenário "Regra coletiva" (seção 25). Complementa ADM-003/012 (checklist padrão).', 'api', 'CCT/ACT da categoria (exigências admissionais) [RCC]', 'em_triagem', NULL),
    ('ADM-060', 'Exame admissional e realizado ANTES do inicio das atividades', 'excecao', 'critica', 'aprovado', 'A norma nao fixa antecedencia minima, mas e categorica quanto a ordem: primeiro o exame, depois as atividades. Admitir e examinar depois inverte a logica de prevencao.', 'Admissao com data de inicio definida.', '[{"acao": "Informar exame admissional com data POSTERIOR ao inicio das atividades", "ordem": 1, "resultado_esperado": "Bloqueado ou alertado de forma destacada"}, {"acao": "Informar exame na mesma data do inicio", "ordem": 2, "resultado_esperado": "Aceito — a norma exige anterioridade a assuncao das atividades, nao a admissao"}, {"acao": "Concluir admissao sem exame algum", "ordem": 3, "resultado_esperado": "Bloqueado — o exame e obrigatorio"}]', 'Nenhum colaborador assume atividades sem exame admissional previo.', 'GAP: o sistema trata o Exame Admissional como anexo obrigatorio da lista, sem NENHUMA data estruturada para comparar com o inicio das atividades. Nao ha como verificar a ordem cronologica exigida pelo item 7.5.8, I. Compare com o desligamento, que estrutura data, resultado, medico e CRM: a admissao, onde a exigencia e mais rigida, estrutura menos. Requisitos YE-DP-ADM-001: RN-002/CA-002 (ASO apto antes do início; inapto impede). Requisitos YE-DP-SST-001: o lado SST (documentos, periodicidade, OS/ficha, eSocial SST) está na família SST-001..080.', 'e2e', 'NR-07, item 7.5.8, I (Portaria SEPRT 6.734/2020) — "no exame admissional: ser realizado antes que o empregado assuma suas atividades"; CLT, art. 168, I', 'em_triagem', NULL),
    ('ADM-061', 'ASO admissional registra os dados exigidos pela norma', 'excecao', 'critica', 'aprovado', 'Anexar PDF nao e registrar. Sem dado estruturado nao ha como cruzar validade, aptidao ou conferir o proximo periodico.', 'Admissao com exame admissional.', '[{"acao": "Enviar apenas o PDF do ASO", "ordem": 1, "resultado_esperado": "O sistema exige tambem os dados estruturados"}, {"acao": "Conferir os campos exigidos", "ordem": 2, "resultado_esperado": "Data, conclusao de aptidao, medico responsavel e CRM"}, {"acao": "Conferir se o CPF do trabalhador consta", "ordem": 3, "resultado_esperado": "Presente — o item 7.5.19.1 passou a exigir CPF no lugar do numero de identidade"}]', 'O ASO admissional e registro estruturado, nao apenas um anexo.', 'GAP. NOTA DE FUNDAMENTACAO: no DESL-066 eu citei "itens 7.5.19 e 7.5.20" com marca de conferir. O item correto e 7.5.19.1, conforme a Portaria SEPRT 6.734/2020 — corrigido no bloco final desta migration. Requisitos YE-DP-ADM-001: RN-002/CA-002 (ASO apto antes do início; inapto impede).', 'e2e', 'NR-07, item 7.5.19.1 (Portaria SEPRT 6.734/2020) — o ASO deve conter razao social e CNPJ ou CAEPF da organizacao, nome e CPF do trabalhador, os riscos ocupacionais, a conclusao quanto a aptidao, e nome, CRM e assinatura do medico responsavel', 'em_triagem', NULL),
    ('ADM-062', 'Exames complementares anteriores sao aproveitaveis em ate 90 dias', 'alternativo', 'media', 'aprovado', 'Evitar repeticao desnecessaria de exame, dentro do que a norma autoriza.', 'Candidato com exames complementares recentes.', '[{"acao": "Informar exame complementar realizado ha 60 dias", "ordem": 1, "resultado_esperado": "Aproveitavel, a criterio medico"}, {"acao": "Informar exame realizado ha 91 dias", "ordem": 2, "resultado_esperado": "Nao aproveitavel"}, {"acao": "Conferir se ha anexos da NR com prazo proprio", "ordem": 3, "resultado_esperado": "O prazo do Anexo especifico prevalece sobre os 90 dias"}]', 'A janela de 90 dias e respeitada, com prevalencia dos prazos dos Anexos.', 'NAO IMPLEMENTADO — o sistema nao registra exames complementares separadamente. Note que a decisao e do MEDICO ("a criterio do medico responsavel"), entao o sistema deve informar a possibilidade e registrar a decisao, nunca decidir sozinho. Requisitos YE-DP-ADM-001: RN-002/CA-002 (ASO apto antes do início; inapto impede).', 'e2e', 'NR-07, item 7.5.17 — "No exame admissional, a criterio do medico responsavel, poderao ser aceitos exames complementares realizados nos 90 dias anteriores, exceto quando definidos prazos diferentes nos Anexos desta NR"', 'em_triagem', NULL),
    ('ADM-063', 'ASO com conclusao inapto impede a admissao para aquela funcao', 'excecao', 'critica', 'aprovado', 'A conclusao do ASO tem consequencia. Se nao tiver, o exame vira formalidade.', 'Admissao com ASO concluindo inapto para a funcao pretendida.', '[{"acao": "Registrar ASO com conclusao inapto", "ordem": 1, "resultado_esperado": "Admissao bloqueada para aquela funcao, com alerta"}, {"acao": "Registrar apto com restricoes", "ordem": 2, "resultado_esperado": "Permitido, com as restricoes registradas e visiveis"}, {"acao": "Conferir se as restricoes chegam ao gestor da area", "ordem": 3, "resultado_esperado": "Visiveis para quem vai alocar a pessoa"}]', 'A conclusao do ASO governa a admissao e a alocacao.', 'GAP: nao ha campo de conclusao no fluxo de admissao — logo, nao ha consequencia possivel. O passo 3 e o mais negligenciado: restricao registrada que nao chega a quem escala a pessoa e restricao que nao existe na pratica. Requisitos YE-DP-ADM-001: RN-002/CA-002 (ASO apto antes do início; inapto impede).', 'e2e', 'CLT, art. 168, caput e §5o; NR-07, item 7.5.8, I — a finalidade do exame admissional e verificar aptidao para a funcao ANTES do inicio; admitir trabalhador declarado inapto contraria a propria finalidade da norma', 'em_triagem', NULL),
    ('ADM-070', 'Contrato e termos sem assinatura não concluem a admissão', 'negativo', 'alta', 'aprovado', 'A admissão só conclui com contrato, ficha e termos ASSINADOS (candidato e empresa), cada assinatura com identidade, carimbo de tempo e integridade do documento. Concluir com assinatura pendente deixa a empresa sem a prova central do vínculo pactuado — e o arquivamento (ADM-100..) deve receber a versão assinada, não o rascunho.', 'Admissão validada com contrato gerado e não assinado.', '[{"acao": "Tentar concluir a admissão com o contrato pendente de assinatura", "ordem": 1, "resultado_esperado": "Não conclui; pendência apontada às partes que faltam assinar"}, {"acao": "Colher as assinaturas eletrônicas", "ordem": 2, "resultado_esperado": "Trilha registra signatário, data/hora e hash do documento"}, {"acao": "Concluir após assinado", "ordem": 3, "resultado_esperado": "Versão ASSINADA arquivada em Documentos na pasta do colaborador"}]', 'Sem assinatura não há conclusão; o que se arquiva é a versão assinada.', 'Requisitos YE-DP-ADM-001: RF-006 / CA-007. O modelo de assinatura (plataforma/biometria) é [VAL]/[DAE] (seção 30); a trava independe do modelo. | Requisitos YE-DP-EPI-001: o padrão de assinatura eletrônica com trilha vale também para o recibo de EPI (EPI-042).', 'e2e', 'CLT, arts. 29 e 442 (formalização); trilha de assinatura eletrônica (RNF-004)', 'em_triagem', NULL),
    ('ADM-071', 'Admissão retroativa exige justificativa e acusa o eSocial em atraso', 'excecao', 'alta', 'aprovado', 'Data de início no passado é exceção operacional, não caminho normal: o sistema aceita SOMENTE com justificativa registrada em trilha e, como o S-2200 já está fora do prazo por definição, sinaliza o atraso e o risco de multa — sem fingir que a transmissão tardia é regular.', 'Admissão com data de início anterior à data atual.', '[{"acao": "Registrar admissão com início retroativo sem justificativa", "ordem": 1, "resultado_esperado": "Recusado — justificativa obrigatória"}, {"acao": "Registrar com justificativa", "ordem": 2, "resultado_esperado": "Aceito; trilha guarda autor, justificativa e datas"}, {"acao": "Preparar o eSocial do vínculo retroativo", "ordem": 3, "resultado_esperado": "Transmissão marcada como FORA DO PRAZO, com alerta crítico e ação no Plano de Ação"}]', 'Retroativa passa com rito — e o atraso do eSocial nunca fica escondido.', 'Requisitos YE-DP-ADM-001: fluxo "Admissão retroativa" (seção 9) / RN-003. Complementa ADM-090 (o prazo em si).', 'api', 'CLT, art. 29; eSocial S-2200 (prazo: dia anterior ao início)', 'em_triagem', NULL),
    ('ADM-072', 'Conclusão ativa onboarding, Ponto, Benefícios e Folha — nas condições certas', 'feliz', 'alta', 'aprovado', 'Admissão concluída com eSocial aceito dispara a ativação integrada: onboarding iniciado, controle de ponto ativo desde o primeiro dia, benefícios conforme a opção e vínculo pronto para a Folha. As PRÉ-condições são a trava: cadastro completo, ASO apto e eSocial aceito — faltando qualquer uma, nada ativa.', 'Admissão com todas as etapas cumpridas (documentos, ASO apto, contrato assinado, S-2200 aceito).', '[{"acao": "Concluir a admissão íntegra", "ordem": 1, "resultado_esperado": "Onboarding iniciado; Ponto, Benefícios e Folha ativados a partir da data de início"}, {"acao": "Tentar ativar com o eSocial ainda pendente/rejeitado", "ordem": 2, "resultado_esperado": "Ativação retida; pendência apontada"}, {"acao": "Conferir o primeiro dia no Ponto", "ordem": 3, "resultado_esperado": "Jornada do contrato aplicada desde o início do vínculo"}]', 'Um clique de conclusão, todos os módulos alinhados — só quando tudo está pronto.', 'Requisitos YE-DP-ADM-001: RF-008 / CA-008 / cenário "Normal" (seção 25). É a ponte com PONTO/FÉRIAS (aquisitivo nasce na admissão).', 'api', 'Documento YE-DP-ADM-001, RF-008 / CA-008 (integração pós-admissão)', 'em_triagem', NULL),
    ('ADM-073', 'Candidato não admitido: dados seguem retenção e descarte da LGPD', 'excecao', 'alta', 'aprovado', 'Desistência ou reprovação encerra a admissão preservando o histórico do PROCESSO, mas os dados pessoais do candidato entram na política de retenção: prazo definido, descarte/anonimização ao fim, e dados sensíveis (ASO) com tratamento mais rígido. Guardar para sempre "porque pode servir" é exatamente o que a LGPD veda.', 'Admissão encerrada por desistência do candidato, com documentos e ASO coletados.', '[{"acao": "Encerrar a admissão por desistência", "ordem": 1, "resultado_esperado": "Processo encerrado com motivo; histórico do fluxo preservado"}, {"acao": "Consultar a situação dos dados do candidato", "ordem": 2, "resultado_esperado": "Marcados com prazo de retenção da política; descarte/anonimização agendados"}, {"acao": "Vencido o prazo, conferir os dados", "ordem": 3, "resultado_esperado": "Pessoais descartados/anonimizados; trilha registra o descarte sem expor o conteúdo"}]', 'O processo fica na história; os dados do candidato têm prazo de validade.', 'Requisitos YE-DP-ADM-001: CA-009 / RNF-003 / fluxo "Desistência" (seção 9). A política de prazos é [VAL] (seção 30). Complementa ADM-111 (documentos da admissão cancelada).', 'api', 'LGPD (Lei 13.709/2018), arts. 15 e 16; art. 11 (dados sensíveis)', 'em_triagem', NULL),
    ('ADM-090', 'Admissao gera evento S-2200 ate o dia anterior ao inicio das atividades', 'feliz', 'critica', 'rascunho', 'A admissao e o unico evento do eSocial com prazo ANTERIOR ao fato. Perder o prazo nao se corrige depois.', 'Admissao concluida de trabalhador celetista.', '[{"acao": "Concluir a admissao", "ordem": 1, "resultado_esperado": "Evento S-2200 gerado e enfileirado"}, {"acao": "Conferir a data limite calculada", "ordem": 2, "resultado_esperado": "Dia imediatamente anterior ao inicio das atividades"}, {"acao": "Admissao cuja data de inicio ja passou", "ordem": 3, "resultado_esperado": "Alerta de prazo perdido, com destaque"}]', 'O evento e gerado e o prazo anterior ao inicio e controlado.', 'GAP TOTAL: S-2200 nao aparece em NENHUM arquivo do repositorio. A admissao nao gera evento de eSocial algum. Situacao pior que a do desligamento, que ao menos monta o S-2299 em memoria. Aqui nao existe nem o objeto. E, das duas pontas do vinculo, esta e a de prazo mais rigido: o desligamento tem 10 dias depois, a admissao tem que ser ANTES. Requisitos YE-DP-ADM-001: RN-003/CA-003 (S-2200 até o dia anterior; S-2190 em contingência) — a retroativa ganhou caso próprio (ADM-071) e a qualificação/rejeição também (ADM-092/093).', 'api', 'Manual de Orientacao do eSocial (MOS), evento S-2200 — Cadastramento Inicial do Vinculo e Admissao/Ingresso de Trabalhador, cujo prazo de envio e ate o dia imediatamente anterior ao do inicio das atividades; Decreto 8.373/2014; CLT, art. 41 (registro de empregados)', 'fora_de_escopo', 'O produto transmite ao eSocial apenas os eventos de SST. Admissão (S-2200), admissão preliminar (S-2190) e desligamento (S-2299 e S-2399) são feitos por fora, pela contabilidade ou pelo sistema de folha do cliente. Retorno do desenvolvimento em 31/07/2026. Se o escopo mudar, devolver para aprovado — a fundamentação legal segue válida e não foi apagada.'),
    ('ADM-091', 'Admissao preliminar usa o evento S-2190 quando cabivel', 'alternativo', 'media', 'rascunho', 'Existe caminho previsto para a admissao de ultima hora. Nao oferece-lo empurra o usuario para o descumprimento do prazo.', 'Admissao com inicio iminente e cadastro incompleto.', '[{"acao": "Iniciar admissao para comeco no dia seguinte, sem dados completos", "ordem": 1, "resultado_esperado": "O sistema oferece a admissao preliminar"}, {"acao": "Conferir o prazo de complementacao", "ordem": 2, "resultado_esperado": "Controlado e cobravel"}]', 'A admissao preliminar e oferecida e sua complementacao e cobrada.', 'GAP TOTAL, decorrente do ADM-090. Depende da decisao de produto sobre integracao com eSocial: se o produto nao pretende transmitir, este caso vira rascunho. Se pretende, o S-2190 e parte necessaria do conjunto. Requisitos YE-DP-ADM-001: RN-003/CA-003 (S-2200 até o dia anterior; S-2190 em contingência) — a retroativa ganhou caso próprio (ADM-071) e a qualificação/rejeição também (ADM-092/093).', 'api', 'MOS, evento S-2190 — Admissao Preliminar, utilizavel quando nao ha tempo habil para o envio do S-2200 completo antes do inicio das atividades, com posterior complementacao', 'fora_de_escopo', 'O produto transmite ao eSocial apenas os eventos de SST. Admissão (S-2200), admissão preliminar (S-2190) e desligamento (S-2299 e S-2399) são feitos por fora, pela contabilidade ou pelo sistema de folha do cliente. Retorno do desenvolvimento em 31/07/2026. Se o escopo mudar, devolver para aprovado — a fundamentação legal segue válida e não foi apagada.'),
    ('ADM-092', 'Divergência de qualificação cadastral é resolvida antes do envio', 'excecao', 'alta', 'aprovado', 'CPF, nome e nascimento precisam bater com as bases do governo ANTES do S-2200 — divergência conhecida e não tratada é rejeição anunciada. A consulta de qualificação roda na validação da admissão, aponta o campo divergente em linguagem simples e trava o envio até a correção.', 'Candidato fictício com data de nascimento divergente da base cadastral simulada.', '[{"acao": "Rodar a validação de qualificação cadastral", "ordem": 1, "resultado_esperado": "Divergência detectada, com o campo e a orientação de correção"}, {"acao": "Tentar transmitir o S-2200 com a divergência aberta", "ordem": 2, "resultado_esperado": "Retido — corrige-se antes, não depois da rejeição"}, {"acao": "Corrigir o dado e revalidar", "ordem": 3, "resultado_esperado": "Qualificação OK; transmissão liberada"}]', 'Divergência se resolve em casa, antes de virar rejeição no governo.', 'Requisitos YE-DP-ADM-001: fluxo "Dados divergentes" (seção 9) / RF-007 / alerta da seção 14. Complementa ADM-002 (unicidade do CPF).', 'api', 'eSocial — qualificação cadastral (CPF × CNIS/dados cadastrais)', 'em_triagem', NULL),
    ('ADM-093', 'Rejeição do eSocial é traduzida e o reenvio não duplica o vínculo', 'excecao', 'alta', 'aprovado', 'Retorno de rejeição do S-2200 chega em código técnico; o DP precisa da tradução (o que houve, onde corrigir, ação sugerida) e de reenvio SEGURO: corrigido o dado, o reenvio substitui/retifica — nunca cria segundo evento de admissão do mesmo vínculo. Duplicidade de S-2200 é passivo novo criado pela própria correção.', 'Evento S-2200 rejeitado por inconsistência de dado cadastral.', '[{"acao": "Receber a rejeição", "ordem": 1, "resultado_esperado": "Explicação em linguagem simples + ação sugerida (Plano de Ação)"}, {"acao": "Corrigir e reenviar", "ordem": 2, "resultado_esperado": "Evento aceito; nenhum duplicado do mesmo vínculo no ambiente"}, {"acao": "Conferir a trilha", "ordem": 3, "resultado_esperado": "Rejeição, correção e recibo final encadeados"}]', 'Rejeição vira instrução; reenvio vira retificação, nunca clone.', 'Requisitos YE-DP-ADM-001: cenário "Com erro" (seção 25) / RF-007 / fila de reprocessamento (RNF-008). Espelha FERIAS-081 (mesma disciplina no S-2230).', 'api', 'eSocial — regras de retificação e recibos; boa prática de integração', 'em_triagem', NULL),
    ('ADM-100', 'Documento enviado na admissao chega ao modulo Documentos', 'feliz', 'critica', 'aprovado', 'Primeiro degrau da premissa: o arquivo nao pode ficar so na admissao.', 'Admissao aberta com a lista de documentos obrigatorios gerada.', '[{"acao": "Enviar o RG na aba Admissoes", "ordem": 1, "resultado_esperado": "Registro criado em admissao_documentos com status enviado"}, {"acao": "Consultar public.documentos pelo storage_path", "ordem": 2, "resultado_esperado": "Existe registro correspondente no modulo Documentos"}, {"acao": "Conferir nome_original, tamanho e mime_type", "ordem": 3, "resultado_esperado": "Coerentes com o arquivo enviado"}]', 'O documento existe nos dois lugares, com metadados coerentes.', 'IMPLEMENTADO. A sincronizacao existe em useAdmissoes.ts. Este caso protege o que ja funciona: uma refatoracao que remova o bloco de sincronizacao quebraria a premissa inteira em silencio. | RECLASSIFICADO 01/08/2026 (api -> e2e): depende de fluxo disparado pelo React (hook de upload ou comparacao entre formularios). Rotina SQL nao consegue exercita-lo; so constataria ausencia provocada pelo proprio metodo. Cobertura pertence ao Cypress.', 'e2e', 'Premissa de produto (sem base legal): arquivamento unico no modulo Documentos. A guarda em si tem fundamento — CLT, art. 41 (registro de empregados) e CLT, art. 630, §4o (exibicao a fiscalizacao).', 'em_triagem', NULL),
    ('ADM-101', 'Documento da admissao e arquivado na PASTA do colaborador', 'excecao', 'critica', 'aprovado', 'Coracao da premissa. Chegar ao modulo sem chegar a pasta nao resolve o problema que a premissa se propos a resolver.', 'Documento enviado na aba Admissoes.', '[{"acao": "Consultar o registro em public.documentos", "ordem": 1, "resultado_esperado": "pasta_id preenchido"}, {"acao": "Conferir a qual pasta aponta", "ordem": 2, "resultado_esperado": "Pasta do tipo colaborador correspondente aquela pessoa"}, {"acao": "Abrir o modulo Documentos na visao por colaborador", "ordem": 3, "resultado_esperado": "O documento aparece sob o nome do colaborador, nao em avulsos"}]', 'O documento nasce arquivado no lugar certo, sem intervencao do RH.', 'DIVERGENCIA CONFIRMADA: o insert em documentos NAO informa pasta_id, embora a coluna exista como FK para documento_pastas. O documento chega ao modulo sem pasta. Deve falhar.', 'api', 'Premissa de produto: documento referente a colaborador vai para a pasta especifica daquele colaborador. Sem base legal — e regra de organizacao interna, cujo proposito declarado e eliminar retrabalho do RH.', 'aguardando_construcao', 'Funcionalidade ainda não construída. A fundamentação legal está registrada no caso e serve como especificação. Falha esperada até a entrega.'),
    ('ADM-102', 'Documento da admissao e vinculado ao colaborador', 'excecao', 'critica', 'aprovado', 'Sem vinculo estruturado, localizar os documentos de uma pessoa depende de busca por texto — e o RH volta a manter controle proprio.', 'Documento enviado na aba Admissoes.', '[{"acao": "Consultar colaborador_id no registro de documentos", "ordem": 1, "resultado_esperado": "Preenchido"}, {"acao": "Agrupar documentos por colaborador na tela", "ordem": 2, "resultado_esperado": "O documento aparece sob a pessoa certa"}, {"acao": "Contar documentos sem colaborador_id no tenant", "ordem": 3, "resultado_esperado": "Zero"}]', 'Todo documento de pessoa tem dono identificado por chave, nao por texto.', 'DIVERGENCIA CONFIRMADA E DELIBERADA: o codigo grava colaborador_id: null com o comentario "Colaborador ainda nao tem profile". A justificativa e real — na admissao a pessoa ainda nao virou profile. Mas a consequencia e que ColaboradorFolderView agrupa por (colaborador_id || "sem-colaborador") e TODO documento de admissao cai no balde "sem-colaborador". O problema nao e o null no momento do upload; e nao existir o passo seguinte — ver ADM-103.', 'api', 'Premissa de produto: identificacao do documento com o titular. Apoia a guarda exigida pela CLT, art. 41, paragrafo unico, e o direito de acesso do titular previsto na LGPD, Lei 13.709/2018, art. 18, II.', 'aguardando_construcao', 'Funcionalidade ainda não construída. A fundamentação legal está registrada no caso e serve como especificação. Falha esperada até a entrega.'),
    ('ADM-103', 'Concluida a admissao, os documentos sao reconciliados com o colaborador', 'excecao', 'critica', 'aprovado', 'O null do ADM-102 so e aceitavel se houver um momento em que ele deixa de ser null. Esse momento e a conclusao da admissao, quando o profile nasce.', 'Admissao com documentos enviados, avancada ate a conclusao.', '[{"acao": "Concluir a admissao e criar o colaborador", "ordem": 1, "resultado_esperado": "Profile criado"}, {"acao": "Reconsultar os documentos daquela admissao", "ordem": 2, "resultado_esperado": "colaborador_id preenchido com o novo profile"}, {"acao": "Conferir pasta_id", "ordem": 3, "resultado_esperado": "Apontando para a pasta do colaborador, criada se ainda nao existia"}, {"acao": "Abrir a pasta do colaborador no modulo Documentos", "ordem": 4, "resultado_esperado": "Os 9 documentos da admissao estao la"}]', 'A conclusao da admissao fecha o ciclo e arquiva tudo no lugar definitivo.', 'GAP TOTAL: nao existe nenhuma reconciliacao. Nada, em momento algum, volta para preencher colaborador_id ou pasta_id dos documentos ja enviados. E o passo que faltou para a premissa se cumprir — e sem ele, o RH continua tendo que arquivar a mao, que e exatamente o retrabalho que a premissa queria eliminar. Correcao sugerida: rotina disparada na conclusao da admissao, mais uma funcao de reconciliacao retroativa para o passivo ja acumulado, no espirito da reconciliar_pastas_todas_empresas() que ja existe no produto.', 'api', 'Premissa de produto: arquivamento unico e definitivo. Apoia CLT, art. 41 (manutencao do registro) e LGPD, art. 6o, I (finalidade).', 'aguardando_construcao', 'Funcionalidade ainda não construída. A fundamentação legal está registrada no caso e serve como especificação. Falha esperada até a entrega.'),
    ('ADM-104', 'Reenvio de documento atualiza o registro no modulo Documentos', 'excecao', 'alta', 'aprovado', 'A premissa fala em ultima versao. Se o arquivo muda e o registro nao, o modulo Documentos passa a descrever um arquivo que nao existe mais.', 'Documento ja enviado uma vez.', '[{"acao": "Reenviar o mesmo documento com arquivo diferente (outro nome, outro tamanho)", "ordem": 1, "resultado_esperado": "Arquivo substituido no storage"}, {"acao": "Consultar o registro em documentos", "ordem": 2, "resultado_esperado": "nome_original, tamanho e mime_type ATUALIZADOS"}, {"acao": "Conferir a data de atualizacao", "ordem": 3, "resultado_esperado": "Refletindo o reenvio"}]', 'O registro descreve sempre o arquivo que esta la.', 'DIVERGENCIA CONFIRMADA: o storage usa upsert:true e substitui o arquivo, mas o insert em documentos e protegido por "if (!existingDoc)" — encontrando registro com o mesmo storage_path, ele nao insere NEM atualiza. O resultado e um registro que descreve o arquivo antigo apontando para um arquivo novo. Metadado e arquivo divergem, e nada avisa. | RECLASSIFICADO 01/08/2026 (api -> e2e): depende de fluxo disparado pelo React (hook de upload ou comparacao entre formularios). Rotina SQL nao consegue exercita-lo; so constataria ausencia provocada pelo proprio metodo. Cobertura pertence ao Cypress.', 'e2e', 'Premissa de produto: arquivar a ULTIMA versao. Documento desatualizado apresentado a fiscalizacao equivale a documento ausente — CLT, art. 630, §4o.', 'em_triagem', NULL),
    ('ADM-105', 'Substituicao de documento preserva a versao anterior', 'alternativo', 'alta', 'aprovado', 'Reenvio destrutivo impede reconstituir o que foi apresentado e quando.', 'Documento ja enviado.', '[{"acao": "Reenviar o documento", "ordem": 1, "resultado_esperado": "Nova versao registrada em documento_versoes"}, {"acao": "Consultar o historico do documento", "ordem": 2, "resultado_esperado": "Versao anterior recuperavel, com autor e data"}, {"acao": "Conferir o arquivo antigo no storage", "ordem": 3, "resultado_esperado": "Ainda acessivel ou explicitamente descartado com registro"}]', 'Existe trilha de versoes, nao apenas o estado atual.', 'GAP: documento_versoes existe no schema mas nao e alimentada por este fluxo. O upsert:true no storage sobrescreve o arquivo fisico — a versao anterior deixa de existir, sem registro de que existiu. Mesma classe do DESL-002, onde o segundo desligamento apaga o primeiro: o produto guarda ESTADO, nao HISTORICO, em mais de um lugar.', 'api', 'Premissa de produto: guardar a ultima versao NAO implica destruir as anteriores. Apoia CLT, art. 41 e o dever de comprovacao historica; a tabela documento_versoes existe justamente para isso.', 'em_triagem', NULL),
    ('ADM-106', 'Documento arquivado herda o tenant da admissao, nao o do usuario', 'excecao', 'critica', 'aprovado', 'Gestor vinculado a mais de um cliente pode ter tenant principal diferente do tenant da admissao que esta operando.', 'Usuario com vinculo em dois tenants.', '[{"acao": "Operar uma admissao do tenant B estando com tenant principal A", "ordem": 1, "resultado_esperado": "Documento gravado com tenant_id do B"}, {"acao": "Conferir a visibilidade para a equipe do tenant B", "ordem": 2, "resultado_esperado": "Documento visivel para quem deve ve-lo"}, {"acao": "Conferir que nao vazou para o tenant A", "ordem": 3, "resultado_esperado": "Invisivel no A"}]', 'O documento pertence ao cliente da admissao, sempre.', 'IMPLEMENTADO, e com cicatriz: o codigo busca o tenant_id na propria admissao em vez de usar o do usuario, com comentario dizendo que usar o tenant errado "gravava docs invisiveis para a equipe". Ou seja, ja aconteceu. Caso de protecao para um bug ja corrigido.', 'api', 'LGPD, Lei 13.709/2018, arts. 46 e 47 — seguranca e prevencao de acesso indevido; regra de isolamento multi-tenant do produto.', 'em_triagem', NULL),
    ('ADM-107', 'ASO admissional e arquivado como documento de saude, nao como anexo generico', 'excecao', 'critica', 'aprovado', 'ASO nao pode ter o mesmo tratamento de um comprovante de residencia. O regime de acesso, retencao e sigilo e diferente por norma e por lei.', 'Admissao com Exame Admissional enviado.', '[{"acao": "Enviar o Exame Admissional", "ordem": 1, "resultado_esperado": "Arquivado com classificacao de documento de saude ocupacional"}, {"acao": "Conferir a pasta de destino", "ordem": 2, "resultado_esperado": "Pasta de saude ocupacional do colaborador, distinta dos documentos pessoais"}, {"acao": "Conferir quem consegue abrir", "ordem": 3, "resultado_esperado": "Acesso restrito conforme o papel, diferente do acesso a RG e CPF"}]', 'Dado de saude e arquivado e protegido conforme sua natureza.', 'GAP: "Exame Admissional" e apenas o nono item de uma lista de anexos genericos, com tipo "saude" mas sem tratamento diferente de destino nem de acesso. Some-se a isso o ADM-101 e o ADM-102: ele nao vai nem para pasta nem para dono. Documento medico sensivel termina num balde compartilhado chamado "sem-colaborador". Requisitos YE-DP-ADM-001: matriz de perfis (seção 6) — Recrutamento não vê laudo clínico detalhado.', 'api', 'NR-07, item 7.5.19.1 (conteudo do ASO) e item 7.6 (guarda dos registros do PCMSO); LGPD, Lei 13.709/2018, art. 5o, II — dado referente a saude e dado pessoal SENSIVEL, com regime de tratamento e acesso proprio', 'em_triagem', NULL),
    ('ADM-108', 'Nao ha documento orfao entre storage e modulo Documentos', 'excecao', 'alta', 'aprovado', 'Arquivo em storage sem registro correspondente nao tem dono, prazo de retencao nem quem responda por ele.', 'Base com admissoes em varios estagios.', '[{"acao": "Contar registros em admissao_documentos com arquivo_url preenchido", "ordem": 1, "resultado_esperado": "Numero conhecido"}, {"acao": "Contar registros correspondentes em public.documentos", "ordem": 2, "resultado_esperado": "Mesmo numero"}, {"acao": "Listar as diferencas", "ordem": 3, "resultado_esperado": "Nenhuma"}]', 'Todo arquivo enviado tem registro nos dois lados.', 'AUDITORIA. Mede o passivo real: quantos documentos ja enviados nao chegaram ao modulo. A sincronizacao so passou a existir em determinado momento do desenvolvimento; documentos anteriores a isso provavelmente nunca foram sincronizados e ninguem sabe quantos sao.', 'api', 'LGPD, Lei 13.709/2018, arts. 15 e 16 — termino do tratamento e eliminacao dos dados quando cessa a finalidade; art. 37 — registro das operacoes', 'em_triagem', NULL),
    ('ADM-110', 'Documento pessoal e acessivel apenas por quem tem funcao para isso', 'negativo', 'critica', 'aprovado', 'RG, CPF, certidao e ASO nao tem o mesmo publico interno.', 'Documentos de admissao arquivados.', '[{"acao": "Acessar como usuario sem papel de RH", "ordem": 1, "resultado_esperado": "Sem acesso aos documentos pessoais"}, {"acao": "Acessar o ASO como usuario de RH sem funcao de saude ocupacional", "ordem": 2, "resultado_esperado": "Acesso restrito ou negado, por ser dado sensivel"}, {"acao": "Tentar abrir por URL assinada compartilhada", "ordem": 3, "resultado_esperado": "Expira e nao concede acesso permanente"}]', 'O acesso segue a necessidade da funcao, com regime proprio para saude.', 'O bucket e privado e o acesso e por URL assinada, o que atende o passo 3. Os passos 1 e 2 dependem da RLS de public.documentos e precisam ser verificados — em especial a distincao entre documento comum e documento de saude, que hoje nao existe como classificacao. Requisitos YE-DP-ADM-001: matriz de perfis (seção 6) — Recrutamento não vê laudo clínico detalhado.', 'api', 'LGPD, Lei 13.709/2018, art. 6o, III (necessidade) e art. 46 (seguranca); documento de saude e dado sensivel — art. 5o, II e art. 11', 'em_triagem', NULL),
    ('ADM-111', 'Admissao cancelada nao deixa documentos pessoais para tras', 'excecao', 'alta', 'aprovado', 'Candidato que nao foi admitido teve documentos pessoais coletados para uma finalidade que deixou de existir.', 'Admissao com documentos enviados e depois cancelada.', '[{"acao": "Cancelar a admissao", "ordem": 1, "resultado_esperado": "O sistema define o destino dos documentos ja enviados"}, {"acao": "Conferir storage e modulo Documentos", "ordem": 2, "resultado_esperado": "Eliminados, ou retidos com prazo e justificativa registrados"}, {"acao": "Conferir se ha registro da operacao", "ordem": 3, "resultado_esperado": "Registrado, conforme art. 37"}]', 'O termino da finalidade tem consequencia definida e auditavel.', 'GAP PROVAVEL, e amplificado pelo ADM-102: como o documento fica sem colaborador_id e sem pasta, nao ha nem como localizar o conjunto de documentos de uma admissao cancelada para elimina-lo. A falta de vinculo deixa de ser inconveniencia de organizacao e vira obstaculo ao cumprimento da LGPD. Requisitos YE-DP-ADM-001: CA-009 — a retenção/descarte LGPD do candidato não admitido ganhou caso próprio (ADM-073).', 'api', 'LGPD, Lei 13.709/2018, art. 15, I e III (termino do tratamento) e art. 16 (eliminacao apos o termino), ressalvadas as hipoteses de guarda obrigatoria', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/colaboradores/admissao'
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


-- (3) PONTES — 47 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('DEC13-001', 'qa_caso_dec13_001', true),
    ('DEC13-002', 'qa_caso_dec13_002', true),
    ('DEC13-003', 'qa_caso_dec13_003', true),
    ('DEC13-020', 'qa_caso_dec13_020', true),
    ('DEC13-021', 'qa_caso_dec13_021', true),
    ('DEC13-030', 'qa_caso_dec13_030', true),
    ('DEC13-031', 'qa_caso_dec13_031', true),
    ('DEC13-032', 'qa_caso_dec13_032', true),
    ('DEC13-033', 'qa_caso_dec13_033', true),
    ('DEC13-040', 'qa_caso_dec13_040', true),
    ('DEC13-041', 'qa_caso_dec13_041', true),
    ('DEC13-042', 'qa_caso_dec13_042', true),
    ('DEC13-050', 'qa_caso_dec13_050', true),
    ('DEC13-051', 'qa_caso_dec13_051', true),
    ('DEC13-060', 'qa_caso_dec13_060', true),
    ('DEC13-070', 'qa_caso_dec13_070', true),
    ('DEC13-071', 'qa_caso_dec13_071', true),
    ('ADM-001', 'qa_caso_adm_001', true),
    ('ADM-002', 'qa_caso_adm_002', true),
    ('ADM-003', 'qa_caso_adm_003', true),
    ('ADM-020', 'qa_caso_adm_020', true),
    ('ADM-021', 'qa_caso_adm_021', true),
    ('ADM-022', 'qa_caso_adm_022', true),
    ('ADM-030', 'qa_caso_adm_030', true),
    ('ADM-031', 'qa_caso_adm_031', true),
    ('ADM-040', 'qa_caso_adm_040', true),
    ('ADM-041', 'qa_caso_adm_041', true),
    ('ADM-050', 'qa_caso_adm_050', true),
    ('ADM-051', 'qa_caso_adm_051', true),
    ('ADM-052', 'qa_caso_adm_052', true),
    ('ADM-070', 'qa_caso_adm_070', true),
    ('ADM-071', 'qa_caso_adm_071', true),
    ('ADM-072', 'qa_caso_adm_072', true),
    ('ADM-073', 'qa_caso_adm_073', true),
    ('ADM-090', 'qa_caso_adm_090', true),
    ('ADM-091', 'qa_caso_adm_091', true),
    ('ADM-092', 'qa_caso_adm_092', true),
    ('ADM-093', 'qa_caso_adm_093', true),
    ('ADM-101', 'qa_caso_adm_101', true),
    ('ADM-102', 'qa_caso_adm_102', true),
    ('ADM-103', 'qa_caso_adm_103', true),
    ('ADM-105', 'qa_caso_adm_105', true),
    ('ADM-106', 'qa_caso_adm_106', true),
    ('ADM-107', 'qa_caso_adm_107', true),
    ('ADM-108', 'qa_caso_adm_108', true),
    ('ADM-110', 'qa_caso_adm_110', true),
    ('ADM-111', 'qa_caso_adm_111', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 56, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('ADM-001'), ('ADM-002'), ('ADM-003'), ('ADM-010'), ('ADM-011'), ('ADM-012'), ('ADM-020'), ('ADM-021'), ('ADM-022'), ('ADM-030'), ('ADM-031'), ('ADM-040'), ('ADM-041'), ('ADM-050'), ('ADM-051'), ('ADM-052'), ('ADM-060'), ('ADM-061'), ('ADM-062'), ('ADM-063'), ('ADM-070'), ('ADM-071'), ('ADM-072'), ('ADM-073'), ('ADM-090'), ('ADM-091'), ('ADM-092'), ('ADM-093'), ('ADM-100'), ('ADM-101'), ('ADM-102'), ('ADM-103'), ('ADM-104'), ('ADM-105'), ('ADM-106'), ('ADM-107'), ('ADM-108'), ('ADM-110'), ('ADM-111'), ('DEC13-001'), ('DEC13-002'), ('DEC13-003'), ('DEC13-020'), ('DEC13-021'), ('DEC13-030'), ('DEC13-031'), ('DEC13-032'), ('DEC13-033'), ('DEC13-040'), ('DEC13-041'), ('DEC13-042'), ('DEC13-050'), ('DEC13-051'), ('DEC13-060'), ('DEC13-070'), ('DEC13-071')),
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
