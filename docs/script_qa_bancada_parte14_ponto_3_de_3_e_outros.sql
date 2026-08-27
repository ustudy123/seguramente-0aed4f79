-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 14 de 15
-- Ponto (3 de 3), Prestadores de Serviços e Psicossocial
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

-- (1) ROTINAS — 27 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_392()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe geração de dossiê de fiscalização?';
  r.esperado := 'Rotina que reúna AFD, AEJ, comprovantes, espelhos e trilha num pacote com índice e hashes';

  v_fns := coalesce(public.qa_fns_com('%dossie%'), public.qa_fns_com('%fiscaliza%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe o dossiê de fiscalização. Diante do Auditor-Fiscal, o DP '
             || 'teria de caçar peça por peça — e as principais nem existem ainda (AFD fora do '
             || 'leiaute, AEJ ausente, comprovante só como boolean; ver PONTO-210/211/380). O '
             || '"modo fiscalização em um clique" do documento depende primeiro dessas peças, '
             || 'depois do empacotador com índice e verificação de assinaturas.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dossiê presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_392()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_392 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_393()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): peças do ponto se arquivam sozinhas no módulo Documentos?';
  r.esperado := 'Funções do ponto gravando no repositório de documentos, com classificação e vínculo';

  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname ILIKE '%ponto%'
    AND (p.prosrc ILIKE '%documentos_empresa%' OR p.prosrc ILIKE '%storage.objects%'
         OR p.prosrc ILIKE '%documentos_funcionario%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma função do ponto arquiva peça alguma no módulo Documentos — '
             || 'espelhos, extratos e arquivos ficam soltos nas tabelas do ponto (quando '
             || 'existem), sem a classificação por pasta e o vínculo previstos na seção 16 do '
             || 'documento de requisitos. Correção: ao gerar cada peça, gravar a referência no '
             || 'repositório de documentos com pasta, metadados e vínculo, sem upload manual.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Arquivamento automático presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_393()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_393 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_394()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cpf text := public.qa_cpf(3941);
  v_ea uuid; v_eb uuid;
  v_data date := CURRENT_DATE - 3;
  v_linhas_dois int;
  v_cpf_uni text := public.qa_cpf(3942);
  v_data_uni date := CURRENT_DATE - 4;
  v_linhas_uni int;
BEGIN
  v_ea := public.qa_nova_empresa('QA Vinculo A ' || v_cpf, '11.222.333/0001-81', true);
  v_eb := public.qa_nova_empresa('QA Vinculo B ' || v_cpf, '11.444.777/0001-61', true);

  r.passo_ordem := 1;
  r.passo_acao := 'Registrar o MESMO dia do MESMO CPF em dois vinculos (duas empresas)';
  r.esperado := 'Cada vinculo tem a sua linha de apuracao — contratos autonomos';
  PERFORM public.qa_ponto_dia(v_cpf, 'QA Dois Vinculos', v_data, v_ea);
  PERFORM public.qa_ponto_dia(v_cpf, 'QA Dois Vinculos', v_data, v_eb);

  SELECT count(*) INTO v_linhas_dois
  FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf AND data = v_data;

  r.passo_ordem := 2;
  r.passo_acao := 'Nao-regressao: um unico vinculo, marcacoes + abono, no mesmo dia';
  r.esperado := 'Uma unica linha — a empresa na chave nao parte o dia de quem tem um vinculo';
  -- admissao com empresa unica; consolidacao deriva a empresa do cadastro
  PERFORM public.qa_ponto_admissao('QA Um Vinculo', 3942, v_ea);
  PERFORM public.qa_ponto_marca(v_cpf_uni, 'QA Um Vinculo', v_data_uni, TIME '08:00', 'entrada');
  PERFORM public.qa_ponto_marca(v_cpf_uni, 'QA Um Vinculo', v_data_uni, TIME '17:00', 'saida');
  PERFORM public.consolidar_ponto_diario_manual(v_t, v_cpf_uni, v_data_uni);
  -- uma segunda escrita no mesmo dia (abono) nao pode criar uma segunda linha
  PERFORM public.consolidar_ponto_diario_manual(v_t, v_cpf_uni, v_data_uni);

  SELECT count(*) INTO v_linhas_uni
  FROM public.ponto_diario
  WHERE tenant_id = v_t AND colaborador_cpf = v_cpf_uni AND data = v_data_uni;

  IF v_linhas_dois = 2 AND v_linhas_uni = 1 THEN
    r.situacao := 'passou';
    r.obtido := 'Dois vinculos do mesmo CPF apuraram o mesmo dia em linhas separadas (2), e o '
             || 'colaborador de um unico vinculo manteve uma linha (1) apos duas escritas no '
             || 'mesmo dia. A empresa entrou na chave sem partir o dia de quem tem um vinculo.';
  ELSIF v_linhas_dois < 2 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO ESTRUTURAL: dois vinculos do mesmo CPF no mesmo dia produziram %s '
             || 'linha(s), nao 2 — a apuracao continua chaveada de um jeito que impede o segundo '
             || 'contrato. O documento de requisitos exige apuracao e arquivos POR VINCULO.',
             v_linhas_dois);
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('REGRESSAO: um colaborador de UNICO vinculo ficou com %s linhas no mesmo '
             || 'dia. A empresa na chave partiu o dia de quem tem um vinculo so — o gatilho de '
             || 'reconciliacao nao esta fundindo as escritas.', v_linhas_uni);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_394()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_394 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_395()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cpf text := public.qa_cpf(3951);
  v_ea uuid; v_eb uuid;
  v_corte date := CURRENT_DATE - 30;
  v_antes uuid; v_depois uuid;
  v_sobrepos boolean := false;
  v_encerrou boolean := false;
BEGIN
  IF to_regclass('public.ponto_lotacao_historico') IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nao existe historico de lotacao — a empresa do colaborador e um '
             || 'atributo solto em cada linha, sem vigencia nem data de corte. Numa '
             || 'transferencia real o AFD de cada estabelecimento sai misturado.';
    RETURN r;
  END IF;

  v_ea := public.qa_nova_empresa('QA Lotacao Origem ' || v_cpf, '11.222.333/0001-81', true);
  v_eb := public.qa_nova_empresa('QA Lotacao Destino ' || v_cpf, '11.444.777/0001-61', true);

  r.passo_ordem := 1;
  r.passo_acao := 'Transferir o colaborador e conferir se a origem foi encerrada na vespera';
  r.esperado := 'Periodo de origem fechado no dia anterior; destino aberto na data do corte';

  INSERT INTO public.ponto_lotacao_historico
    (tenant_id, colaborador_cpf, colaborador_nome, empresa_id, data_inicio, motivo)
  VALUES (v_t, v_cpf, 'QA Lotacao', v_ea, CURRENT_DATE - 120, 'admissao');

  PERFORM public.ponto_transferir_lotacao(v_t, v_cpf, v_eb, v_corte, 'QA: transferencia');

  SELECT EXISTS (
    SELECT 1 FROM public.ponto_lotacao_historico
    WHERE tenant_id = v_t AND colaborador_cpf = v_cpf
      AND empresa_id = v_ea AND data_fim = v_corte - 1
  ) INTO v_encerrou;

  r.passo_ordem := 2;
  r.passo_acao := 'Perguntar onde o colaborador estava antes e depois do corte';
  r.esperado := 'Antes do corte responde a origem; depois responde o destino';
  v_antes  := public.ponto_lotacao_do_dia(v_t, v_cpf, v_corte - 10);
  v_depois := public.ponto_lotacao_do_dia(v_t, v_cpf, v_corte + 10);

  r.passo_ordem := 3;
  r.passo_acao := 'Tentar abrir um periodo que se sobrepoe a outro';
  r.esperado := 'Recusado — uma pessoa esta lotada num estabelecimento por vez';
  BEGIN
    INSERT INTO public.ponto_lotacao_historico
      (tenant_id, colaborador_cpf, colaborador_nome, empresa_id, data_inicio, data_fim, motivo)
    VALUES (v_t, v_cpf, 'QA Lotacao', v_ea, v_corte + 1, v_corte + 5, 'ajuste');
    v_sobrepos := true;
  EXCEPTION WHEN OTHERS THEN v_sobrepos := false; END;

  IF v_encerrou AND v_antes = v_ea AND v_depois = v_eb AND NOT v_sobrepos THEN
    r.situacao := 'passou';
    r.obtido := 'Transferencia encerrou a origem na vespera e abriu o destino na data do corte. '
             || 'A consulta por data responde o estabelecimento certo de cada lado, e periodo '
             || 'sobreposto foi recusado — o AFD de cada estabelecimento sai sem mistura.';
  ELSIF NOT v_encerrou THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a transferencia nao encerrou o periodo de origem na vespera. Sem data '
             || 'de corte, os dois estabelecimentos reivindicam o mesmo dia.';
  ELSIF v_antes IS DISTINCT FROM v_ea OR v_depois IS DISTINCT FROM v_eb THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a consulta de lotacao por data devolveu o estabelecimento errado — '
             || 'a apuracao e os arquivos leriam a lotacao trocada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o banco ACEITOU periodos de lotacao sobrepostos. "Onde ele estava no '
             || 'dia 10" passa a ter duas respostas e o arquivo sai duplicado.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_395()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_395 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_396()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_propria boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): as políticas de leitura restringem ao PRÓPRIO colaborador?';
  r.esperado := 'Política de SELECT em ponto_marcacoes/ponto_espelhos filtrando pelo CPF/usuário do leitor';

  SELECT bool_or(qual ILIKE '%cpf%' OR qual ILIKE '%auth.uid%' OR qual ILIKE '%proprio%')
    INTO v_propria
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('ponto_marcacoes', 'ponto_espelhos')
    AND cmd IN ('SELECT', 'ALL');

  IF NOT coalesce(v_propria, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: nenhuma política de leitura de ponto_marcacoes ou ponto_espelhos '
             || 'restringe ao próprio colaborador — os filtros existentes param no tenant e no '
             || 'vínculo de empresa. Traduzindo: um colaborador comum, pela API, lê as marcações '
             || 'e espelhos DOS COLEGAS da empresa inteira (horários, atrasos, geolocalização). '
             || 'Dado de jornada é dado pessoal (LGPD): o titular vê o seu; gestor/DP veem '
             || 'conforme o papel. Correção: política que limite o perfil colaborador ao '
             || 'próprio CPF, mantendo o acesso amplo apenas para papéis de gestão.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'Leitura restrita ao próprio colaborador (com exceção controlada por papel).';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_396()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_396 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_397()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): visualização de dado sensível e exportação deixam rastro?';
  r.esperado := 'Registro de QUEM viu selfie/geolocalização e QUEM exportou dados, em log imutável';

  v_fns := coalesce(public.qa_fns_com('%log%selfie%'), public.qa_fns_com('%acesso%sensivel%'),
                    public.qa_fns_com('%log%exporta%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a trilha de auditoria só captura escrita (INSERT/UPDATE/DELETE, via '
             || 'gatilhos) — visualizar a selfie ou a geolocalização de uma marcação e exportar '
             || 'relatórios de ponto não deixam rastro algum. A LGPD (arts. 11 e 46) pede '
             || 'registro do tratamento de dado sensível; num vazamento, seria impossível saber '
             || 'quem acessou o quê. Correção: registrar o acesso no ponto de entrega (função '
             || 'RPC/edge que serve o dado sensível loga antes de servir; exportações gravam '
             || 'escopo e destinatário).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Trilha de acesso presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_397()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_397 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ponto_398()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text; v_status text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): exportação para a folha tem fila e reenvio?';
  r.esperado := 'Falha na entrega enfileira e reenvia sem perda nem duplicidade';

  v_fns := coalesce(public.qa_fns_com('%exportacoes_folha%'), '');
  v_status := public.qa_col_existe('ponto_exportacoes_folha', 'status');

  IF v_fns = '' THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: a exportação para a folha é um registro passivo '
             || '(ponto_exportacoes_folha tem %s), mas nenhuma função do banco a processa — '
             || 'sem fila, sem reenvio, sem confirmação de recebimento. Se a geração falha no '
             || 'meio, o operador refaz na mão e ninguém garante ausência de duplicidade. '
             || 'Correção: estados explícitos (pendente/enviado/confirmado/falha) + rotina de '
             || 'reenvio idempotente.', coalesce('coluna ' || v_status, 'nem coluna de status'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Processamento da exportação presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ponto_398()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ponto_398 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento com validade daqui a 180 dias';
  r.esperado:='Status atribuido automaticamente: valido';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc Valido', '11222333000181');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PGR', '[QA] PGR 2026', CURRENT_DATE + 180);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='valido' THEN
    r.situacao:='passou'; r.obtido:='Status "valido" atribuido sozinho pela trigger (validade a 180 dias).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava status "valido", obteve "%s". A automacao nao classificou corretamente.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento com validade daqui a 15 dias';
  r.esperado:='Status atribuido automaticamente: a_vencer (janela de 30 dias)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc A Vencer', '11222333000262');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO Joao', CURRENT_DATE + 15);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='a_vencer' THEN
    r.situacao:='passou'; r.obtido:='Status "a_vencer" atribuido sozinho — o alerta previo de 30 dias funciona.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava "a_vencer", obteve "%s". A janela de alerta nao esta funcionando.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento com validade de um ano atras';
  r.esperado:='Status atribuido automaticamente: vencido';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc Vencido', '11222333000343');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PCMSO', '[QA] PCMSO 2025', CURRENT_DATE - 365);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='vencido' THEN
    r.situacao:='passou';
    r.obtido:='Status "vencido" reconhecido sozinho. E esta automacao que falta no modulo geral de documentos (DOC-041).';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava "vencido", obteve "%s". A referencia usada no relatorio da equipe NAO se sustenta.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Anexar documento sem data de validade';
  r.esperado:='Status atribuido automaticamente: pendente';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Doc Pendente', '11222333000424');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'Contrato', '[QA] Contrato de prestacao', NULL);
  SELECT status::text INTO v_st FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_st='pendente' THEN
    r.situacao:='passou'; r.obtido:='Status "pendente" para documento sem validade — distingue de "em dia".';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava "pendente", obteve "%s".', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_antes text; v_depois text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar documento vencido';
  r.esperado:='Ao renovar a validade, o status volta a valido sozinho';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Renovacao', '11222333000505');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PGR', '[QA] PGR a renovar', CURRENT_DATE - 30);
  SELECT status::text INTO v_antes FROM public.terceiro_documentos WHERE id=v_doc;

  r.passo_ordem:=2; r.passo_acao:='Renovar: estender a validade para daqui a 1 ano';
  UPDATE public.terceiro_documentos SET data_validade = CURRENT_DATE + 365 WHERE id = v_doc;

  r.passo_ordem:=3; r.passo_acao:='Conferir se o status acompanhou a renovacao';
  SELECT status::text INTO v_depois FROM public.terceiro_documentos WHERE id=v_doc;

  IF v_antes='vencido' AND v_depois='valido' THEN
    r.situacao:='passou';
    r.obtido:='Status foi de "vencido" para "valido" ao renovar. A automacao vale tambem na edicao.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava vencido -> valido. Obteve "%s" -> "%s". A trigger pode nao estar rodando no UPDATE.', v_antes, v_depois);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar anexar documento sem tipo'; r.esperado:='Recusado (NOT NULL)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Sem Tipo', '11222333000686');
  BEGIN
    INSERT INTO public.terceiro_documentos (tenant_id, terceiro_id, tipo, nome)
    VALUES (v_t, v_ter, NULL, '[QA] doc sem tipo');
    r.situacao:='falhou'; r.obtido:='ACEITOU documento sem tipo.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado com not_null_violation, como deveria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_doc uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro com um documento';
  r.esperado:='Apagar o terceiro apaga o documento (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Cascade Doc', '11222333000767');
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'PGR', '[QA] PGR some junto', CURRENT_DATE + 90);
  r.passo_ordem:=2; r.passo_acao:='Apagar o terceiro';
  DELETE FROM public.terceiros WHERE id=v_ter;
  r.passo_ordem:=3; r.passo_acao:='Conferir se o documento foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='Documento apagado junto com o terceiro (CASCADE).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Documento NAO foi apagado (%s ainda existe).', v_sobrou);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_014()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_doc uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar trabalhador com um ASO pessoal';
  r.esperado:='Apagar o trabalhador apaga o ASO (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Cascade Trab', '11222333000848');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Jose Terceirizado', public.qa_cpf(701492)) RETURNING id INTO v_trab;
  v_doc := public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO do Jose', CURRENT_DATE + 90, v_trab);
  r.passo_ordem:=2; r.passo_acao:='Apagar o trabalhador';
  DELETE FROM public.terceiro_trabalhadores WHERE id=v_trab;
  r.passo_ordem:=3; r.passo_acao:='Conferir se o ASO foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_documentos WHERE id=v_doc;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='ASO apagado junto com o trabalhador (CASCADE).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('ASO NAO foi apagado (%s ainda existe).', v_sobrou);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_014()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_014 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_tdoc_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_ter uuid; v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Anexar documento no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Isolamento', '11222333000929');
  PERFORM public.qa_novo_doc_terceiro(v_ter, 'ASO', '[QA] ASO Secreto T1', CURRENT_DATE + 90);
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.terceiro_documentos
   WHERE tenant_id=v_t2 AND nome='[QA] ASO Secreto T1';
  IF v_vis=0 THEN
    r.situacao:='passou'; r.obtido:='Documento do tenant 1 invisivel ao tenant 2.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s documento(s) visiveis.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_tdoc_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_tdoc_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar terceiro "Manutencao XYZ"'; r.esperado:='Criado';
  v_id := public.qa_novo_terceiro('[QA] Manutencao XYZ LTDA', '44555666000177');
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Terceiro criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid; v_trab uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e adicionar um trabalhador'; r.esperado:='Trabalhador vinculado ao terceiro';
  v_ter := public.qa_novo_terceiro('[QA] Terceiro Com Gente', '44555666000258');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Terceiro', public.qa_cpf(188)) RETURNING id INTO v_trab;
  IF v_trab IS NOT NULL AND EXISTS(SELECT 1 FROM public.terceiro_trabalhadores WHERE id=v_trab AND terceiro_id=v_ter) THEN
    r.situacao:='passou'; r.obtido:='Trabalhador vinculado ao terceiro.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao vinculou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ter uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro (liberado) e mudar status para bloqueado'; r.esperado:='Status vira bloqueado';
  v_ter := public.qa_novo_terceiro('[QA] Terceiro Status', '44555666000339');
  UPDATE public.terceiros SET status='bloqueado' WHERE id=v_ter;
  SELECT status INTO v_st FROM public.terceiros WHERE id=v_ter;
  IF v_st='bloqueado' THEN r.situacao:='passou'; r.obtido:='Status alterado para bloqueado.';
  ELSE r.situacao:='falhou'; r.obtido:='Status='||v_st; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar cadastrar terceiro sem razao social'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.terceiros (tenant_id, razao_social, cnpj) VALUES (v_t, NULL, '44555666000410');
    r.situacao:='falhou'; r.obtido:='ACEITOU sem razao social.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar status = "suspenso" (fora do enum)'; r.esperado:='Recusado pelo enum';
  BEGIN
    INSERT INTO public.terceiros (tenant_id, razao_social, cnpj, status)
    VALUES (v_t, '[QA] Status Invalido', '44555666000591', 'suspenso');
    r.situacao:='falhou'; r.obtido:='ACEITOU status fora do enum.';
  EXCEPTION WHEN invalid_text_representation OR check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: status so aceita os valores do enum.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid; v_trab uuid; v_sobrou int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro com 1 trabalhador'; r.esperado:='Apagar o terceiro apaga o trabalhador junto (CASCADE)';
  v_ter := public.qa_novo_terceiro('[QA] Terceiro Que Sera Apagado', '44555666000672');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome) VALUES (v_t, v_ter, '[QA] Trab Some Junto') RETURNING id INTO v_trab;
  r.passo_ordem:=2; r.passo_acao:='Apagar o terceiro';
  DELETE FROM public.terceiros WHERE id=v_ter;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o trabalhador foi apagado junto';
  SELECT count(*) INTO v_sobrou FROM public.terceiro_trabalhadores WHERE id=v_trab;
  IF v_sobrou=0 THEN
    r.situacao:='passou'; r.obtido:='Trabalhador apagado junto com o terceiro (CASCADE), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Trabalhador NAO foi apagado (%s ainda existe) — CASCADE nao funcionou.', v_sobrou); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e tentar outro com o MESMO CNPJ'; r.esperado:='Idealmente recusado; revela se ha unique em CNPJ';
  PERFORM public.qa_novo_terceiro('[QA] Terceiro A', '44555666000753');
  BEGIN
    PERFORM public.qa_novo_terceiro('[QA] Terceiro B', '44555666000753');
    SELECT count(*) INTO v_n FROM public.terceiros WHERE tenant_id=v_t AND cnpj='44555666000753';
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s terceiros com o mesmo CNPJ. Nao ha constraint unica — cadastro duplicado passa.', v_n);
  EXCEPTION WHEN unique_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: CNPJ de terceiro e unico.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ter_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.terceiros (tenant_id, razao_social, cnpj) VALUES (v_t1, '[QA] Terceiro Secreto T1', '44555666000834');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.terceiros WHERE tenant_id=v_t2 AND cnpj='44555666000834';
  IF v_vis=0 THEN r.situacao:='passou'; r.obtido:='Terceiro do tenant 1 invisivel ao tenant 2.';
  ELSE r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s terceiro(s) visiveis.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ter_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ter_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ttre_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_tre uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar treinamento NR-35 com validade vencida';
  r.esperado:='Status vencido, pela mesma automacao dos documentos';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treinamento', '11333444000181');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Altura', public.qa_cpf(701509)) RETURNING id INTO v_trab;
  INSERT INTO public.terceiro_treinamentos
    (tenant_id, terceiro_id, trabalhador_id, tipo, data_validade)
  VALUES (v_t, v_ter, v_trab, 'NR-35', CURRENT_DATE - 365) RETURNING id INTO v_tre;
  SELECT status::text INTO v_st FROM public.terceiro_treinamentos WHERE id=v_tre;
  IF v_st='vencido' THEN
    r.situacao:='passou';
    r.obtido:='Treinamento NR-35 vencido classificado sozinho — a mesma trigger vale para treinamentos.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava "vencido", obteve "%s". Trabalhador com NR-35 vencida apareceria apto.', v_st);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ttre_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ttre_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ttre_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_ter uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar registrar treinamento sem trabalhador';
  r.esperado:='Recusado — treinamento e individual (trabalhador_id NOT NULL)';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treino Sem Dono', '11333444000262');
  BEGIN
    -- data_validade informada de proposito: sem ela, a trigger quebra antes
    -- de o NOT NULL ser verificado (ver o achado no caso TTRE-011)
    INSERT INTO public.terceiro_treinamentos
      (tenant_id, terceiro_id, trabalhador_id, tipo, data_validade)
    VALUES (v_t, v_ter, NULL, 'NR-10', CURRENT_DATE + 90);
    r.situacao:='falhou'; r.obtido:='ACEITOU treinamento sem trabalhador — nao daria para saber quem esta apto.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: treinamento exige trabalhador, como deve ser (e individual).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ttre_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ttre_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_ttre_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_ter uuid; v_trab uuid; v_tre uuid; v_st text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar terceiro e trabalhador';
  v_ter := public.qa_novo_terceiro('[QA] Prestadora Treino Sem Validade', '11333444000343');
  INSERT INTO public.terceiro_trabalhadores (tenant_id, terceiro_id, nome, cpf)
  VALUES (v_t, v_ter, '[QA] Trabalhador Integracao', public.qa_cpf(701510)) RETURNING id INTO v_trab;

  r.passo_ordem:=2;
  r.passo_acao:='Registrar treinamento SEM data de validade (ex.: integracao, sem prazo)';
  r.esperado:='Deveria salvar com status "pendente", como acontece com documentos (TDOC-004)';
  BEGIN
    INSERT INTO public.terceiro_treinamentos (tenant_id, terceiro_id, trabalhador_id, tipo)
    VALUES (v_t, v_ter, v_trab, 'Integracao') RETURNING id INTO v_tre;
    SELECT status::text INTO v_st FROM public.terceiro_treinamentos WHERE id=v_tre;
    IF v_st = 'pendente' THEN
      r.situacao:='passou';
      r.obtido:='Treinamento sem validade salvo com status "pendente", como esperado.';
    ELSE
      r.situacao:='falhou';
      r.obtido:=format('Salvou, mas com status "%s" em vez de "pendente".', v_st);
    END IF;
  EXCEPTION WHEN undefined_column OR others THEN
    IF SQLERRM LIKE '%arquivo_url%' THEN
      r.situacao:='falhou';
      r.obtido:='ERRO DE BANCO ao salvar treinamento sem validade: a funcao atualizar_status_terceiro_doc acessa NEW.arquivo_url, coluna que nao existe em terceiro_treinamentos (la e certificado_url). Treinamentos sem prazo nao podem ser cadastrados.';
      r.erro_tecnico:=SQLERRM;
    ELSE
      r.situacao:='erro'; r.obtido:='Quebrou por outro motivo'; r.erro_tecnico:=SQLERRM;
    END IF;
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_ttre_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_ttre_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 77 casos.

-- Ponto (3 de 3) (7 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('PONTO-392', 'Dossiê de fiscalização sai íntegro, assinado e com índice', 'feliz', 'alta', 'aprovado', 'Diante de fiscalização ou litígio, o DP/Jurídico gera em uma operação o dossiê do período/trabalhador: AFD, AEJ, comprovantes, espelhos assinados, trilha de ajustes e memórias — cada peça com integridade e assinatura verificadas, e um índice com os hashes.', 'Período com dados completos (marcações, espelhos, arquivos).', '[{"acao": "Gerar o dossiê de um trabalhador/período", "ordem": 1, "resultado_esperado": "Pacote com todas as peças, índice de conteúdo e hashes"}, {"acao": "Verificar as assinaturas das peças", "ordem": 2, "resultado_esperado": "Todas válidas; peça com problema é apontada antes da entrega"}]', 'Fiscalização atendida em um clique, sem caça a arquivos.', 'Requisitos YE-DP-PONTO-001: RF-012 / CA-011 / seção 29 ("modo fiscalização em um clique").', 'e2e', 'Portaria MTE 671/2021 (apresentação ao Auditor-Fiscal); Súmula 338 TST (dever de exibição)', 'em_triagem', NULL),
    ('PONTO-393', 'Toda peça do ponto se arquiva sozinha no módulo Documentos', 'feliz', 'media', 'aprovado', 'Comprovantes, AFD, AEJ, espelhos, memórias, extratos de banco e logs são salvos automaticamente no módulo Documentos, classificados na pasta certa (seção 16 do documento) e vinculados a empresa/funcionário/competência — sem upload manual, sem cópia solta.', 'Competência processada de ponta a ponta.', '[{"acao": "Percorrer as pastas de Documentos após o fechamento", "ordem": 1, "resultado_esperado": "Cada peça na pasta prevista (Funcionário › Ponto › ..., Processo › Ponto › ...) com metadados e vínculos"}, {"acao": "Conferir duplicidade", "ordem": 2, "resultado_esperado": "Uma peça, um registro — sem cópias divergentes"}]', 'Gerou, arquivou, classificou — sozinho.', 'Requisitos YE-DP-PONTO-001: CA-014 / seção 16 (tabela de documentos e pastas).', 'e2e', 'Boa prática de guarda documental (prazos legais de guarda — Portaria 671/2021)', 'em_triagem', NULL),
    ('PONTO-394', 'Dois vínculos do mesmo trabalhador apuram separados', 'alternativo', 'alta', 'aprovado', 'Um CPF pode ter dois vínculos (duas empresas do grupo, ou dois estabelecimentos). Marcações, apuração, banco de horas e arquivos legais são POR VÍNCULO — nada se mistura. Consolidação só em visão gerencial, nunca na apuração.', 'Mesmo CPF com dois vínculos ativos em estabelecimentos distintos.', '[{"acao": "Marcar ponto nos dois vínculos no mesmo dia", "ordem": 1, "resultado_esperado": "Cada marcação no seu vínculo, sem vazamento"}, {"acao": "Apurar e gerar arquivos", "ordem": 2, "resultado_esperado": "Espelhos, AFD/AEJ e banco segregados por vínculo/estabelecimento"}]', 'Um CPF, dois contratos, duas contas separadas.', 'Requisitos YE-DP-PONTO-001: cenário "Múltiplos vínculos" das seções 9 e 25. Difere de PONTO-250 (fronteira entre TENANTS): aqui é dentro do mesmo cliente.', 'api', 'CLT (contratos autônomos entre si); Portaria MTE 671/2021 (arquivos por empregador)', 'em_triagem', NULL),
    ('PONTO-395', 'Transferência de estabelecimento preserva o histórico e a continuidade', 'alternativo', 'media', 'aprovado', 'Transferido o colaborador, o ponto encerra no estabelecimento de origem e reinicia no destino — na data certa, sem buraco e sem sobreposição. O histórico anterior permanece consultável e entra nos arquivos do estabelecimento onde foi gerado.', 'Colaborador transferido no meio da competência.', '[{"acao": "Efetivar a transferência com data de corte", "ordem": 1, "resultado_esperado": "Origem encerra no dia D-1, destino inicia no dia D"}, {"acao": "Apurar a competência da transferência", "ordem": 2, "resultado_esperado": "Cada trecho apurado no seu estabelecimento; total do mês íntegro"}, {"acao": "Gerar AFD/AEJ de cada estabelecimento", "ordem": 3, "resultado_esperado": "Marcações no arquivo do estabelecimento onde ocorreram"}]', 'Mudou de casa, não de história.', 'Requisitos YE-DP-PONTO-001: cenário "Transferência de estabelecimento" da seção 9.', 'api', 'CLT, art. 469 (transferência); Portaria MTE 671/2021 (arquivos por estabelecimento)', 'em_triagem', NULL),
    ('PONTO-396', 'Colaborador acessa os próprios dados de ponto', 'feliz', 'media', 'aprovado', 'O titular acessa o que é dele: comprovantes, espelhos, extrato de banco de horas e as próprias marcações — sem depender de pedir ao RH. Correção de dado se faz pelo ajuste rastreável, nunca por edição livre.', 'Colaborador logado no portal.', '[{"acao": "Abrir comprovantes, espelhos e extrato de banco próprios", "ordem": 1, "resultado_esperado": "Tudo acessível, somente os PRÓPRIOS dados"}, {"acao": "Tentar acessar dados de um colega", "ordem": 2, "resultado_esperado": "Negado"}, {"acao": "Pedir correção de uma marcação", "ordem": 3, "resultado_esperado": "Cai no fluxo de ajuste com justificativa — não em edição direta"}]', 'Transparência para o dono do dado; porta fechada para o resto.', 'Requisitos YE-DP-PONTO-001: seção 22 (direitos do titular). Par com PONTO-362 (enumeração bloqueada).', 'e2e', 'LGPD, art. 18 (direitos do titular); Portaria MTE 671/2021 (comprovante ao trabalhador)', 'em_triagem', NULL),
    ('PONTO-397', 'Acesso a dado sensível e exportação ficam na trilha de auditoria', 'excecao', 'alta', 'aprovado', 'Quem visualizou biometria/selfie/geolocalização e quem exportou dados de ponto (AFD, AEJ, relatórios) fica registrado em log imutável: usuário, data/hora, o que acessou e por quê. Sem esse rastro, vazamento vira mistério insolúvel.', 'Usuário gestor com acesso a dados de marcação.', '[{"acao": "Visualizar a selfie/geolocalização de uma marcação", "ordem": 1, "resultado_esperado": "Acesso registrado no log (quem, quando, o quê)"}, {"acao": "Exportar um relatório de marcações", "ordem": 2, "resultado_esperado": "Exportação registrada com escopo e destinatário"}, {"acao": "Tentar apagar a entrada do log", "ordem": 3, "resultado_esperado": "Impossível — log é append-only"}]', 'Dado sensível visto = visita registrada.', 'Requisitos YE-DP-PONTO-001: seção 23 ("acessos a dados sensíveis e exportações") / RNF-007.', 'api', 'LGPD, arts. 11 e 46 (dados sensíveis; registros de tratamento)', 'em_triagem', NULL),
    ('PONTO-398', 'Folha indisponível no fechamento: pacote enfileira e reenvia sem perda', 'excecao', 'media', 'aprovado', 'Se a integração com a Folha está fora do ar na hora do fechamento, o pacote de eventos entra em fila e reenvia sozinho quando voltar — sem perder evento, sem duplicar no reenvio e sem travar o fechamento já concluído.', 'Competência fechada com integração de folha indisponível.', '[{"acao": "Fechar a competência com a folha fora do ar", "ordem": 1, "resultado_esperado": "Fechamento conclui; pacote enfileirado com alerta do pendente"}, {"acao": "Restabelecer a integração", "ordem": 2, "resultado_esperado": "Reenvio automático; recebimento confirmado"}, {"acao": "Conferir os eventos entregues", "ordem": 3, "resultado_esperado": "Completos e sem duplicidade"}]', 'A fila segura; ninguém digita de novo.', 'Requisitos YE-DP-PONTO-001: RNF-014 / cenário "Integração indisponível" da seção 25.', 'api', 'Boa prática de contingência (documento YE: RNF-014)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'jornada-rotina/ponto'
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

-- Prestadores de Serviços (20 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('TDOC-001', 'Documento com validade distante fica valido', 'feliz', 'alta', 'aprovado', 'Verificar que um documento com validade a mais de 30 dias recebe status "valido" automaticamente. Regra: a trigger atualizar_status_terceiro_doc classifica o documento pela data, sem ninguem informar o status. Importa porque e essa automacao que mantem o painel de conformidade dos terceiros confiavel sem trabalho manual.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Abrir um terceiro e anexar um documento com validade distante", "dados": "Tipo: PGR | Nome: PGR 2026 | Data de validade: daqui a 180 dias", "ordem": 1, "onde_na_tela": "Terceiros > abrir o terceiro > aba Documentos > Adicionar", "resultado_esperado": "Documento salvo"}, {"acao": "Conferir o status atribuido", "dados": "-", "ordem": 2, "onde_na_tela": "Lista de documentos do terceiro", "resultado_esperado": "Status: valido — atribuido automaticamente, sem ninguem escolher"}]', 'O documento fica com status "valido". O status nao foi informado no cadastro — a trigger o calculou a partir da data de validade.', 'IMPACTO SE FALHAR: sem a classificacao automatica, o painel de conformidade dependeria de alguem atualizar o status manualmente documento por documento — na pratica, ficaria desatualizado.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-002', 'Documento proximo do vencimento vira "a vencer"', 'feliz', 'alta', 'aprovado', 'Verificar que um documento com validade proxima recebe status "a_vencer" automaticamente. Regra: a faixa de alerta e de 60 dias antes do vencimento (a versao inicial usava 30 dias; foi ampliada para 60). Importa porque e esse status que permite agir ANTES de o documento vencer — renovar a tempo, cobrar o prestador.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Anexar um documento com validade proxima", "dados": "Tipo: ASO | Nome: ASO Joao | Data de validade: daqui a 15 dias", "ordem": 1, "onde_na_tela": "Terceiro > Documentos > Adicionar", "resultado_esperado": "Documento salvo"}, {"acao": "Conferir o status", "dados": "-", "ordem": 2, "onde_na_tela": "Lista de documentos", "resultado_esperado": "Status: a_vencer — a janela de alerta e de 60 dias"}]', 'O documento fica com status "a_vencer", porque a validade cai dentro da janela de 60 dias.', 'IMPACTO SE FALHAR: sem o aviso previo, os documentos so seriam percebidos depois de vencidos — o prestador ficaria irregular antes de alguem notar. A janela de 60 dias e o que da tempo de reagir (renovar exames, cobrar certidoes).', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-003', 'Documento vencido vira "vencido" sozinho', 'feliz', 'critica', 'aprovado', 'Verificar que um documento com validade no passado recebe status "vencido" automaticamente. ESTE E O CASO QUE JUSTIFICA A REFERENCIA: e exatamente o comportamento que falta no modulo geral de documentos (achado DOC-041, onde um documento vencido ha um ano permanece "valido"). Importa porque documento vencido exibido como valido da falsa conformidade.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Anexar um documento ja vencido", "dados": "Tipo: PCMSO | Nome: PCMSO 2025 | Data de validade: um ano atras", "ordem": 1, "onde_na_tela": "Terceiro > Documentos > Adicionar", "resultado_esperado": "Documento salvo"}, {"acao": "Conferir o status", "dados": "-", "ordem": 2, "onde_na_tela": "Lista de documentos", "resultado_esperado": "Status: vencido — reconhecido automaticamente"}]', 'O documento fica com status "vencido". O banco reconheceu sozinho que a data ja passou.', 'IMPACTO SE FALHAR: cairia no mesmo problema do modulo geral de documentos (DOC-041) — o prestador apareceria regular com documentacao vencida. CONTRASTE: este caso PASSANDO e a evidencia de que a solucao para o DOC-041 ja existe no sistema e so precisa ser replicada.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-004', 'Documento sem validade fica pendente', 'alternativo', 'media', 'aprovado', 'Verificar que um documento sem data de validade recebe status "pendente". Regra: sem data nao da para classificar; o documento fica marcado como pendente de informacao. Importa porque distingue "documento sem prazo definido" de "documento em dia" — sao situacoes diferentes.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Anexar um documento sem informar validade", "dados": "Tipo: Contrato | Nome: Contrato de prestacao | Data de validade: (em branco)", "ordem": 1, "onde_na_tela": "Terceiro > Documentos > Adicionar", "resultado_esperado": "Documento salvo"}, {"acao": "Conferir o status", "dados": "-", "ordem": 2, "onde_na_tela": "Lista de documentos", "resultado_esperado": "Status: pendente — falta a informacao de validade"}]', 'O documento fica com status "pendente", sinalizando que a data de validade nao foi informada.', 'IMPACTO SE FALHAR: um documento sem prazo apareceria como valido, escondendo que falta informacao. O status pendente e o que permite cobrar o dado que falta.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-005', 'Alterar a data de validade recalcula o status', 'feliz', 'critica', 'aprovado', 'Verificar que o status acompanha a mudanca da data, nao apenas a criacao. Regra: a trigger roda em INSERT E UPDATE. Importa porque a renovacao de um documento e uma edicao — ao anexar a versao nova com validade estendida, o status precisa voltar de "vencido" para "valido" sozinho.', 'Precisa existir um documento de terceiro ja vencido.', '[{"acao": "Ter um documento vencido", "dados": "Documento com validade no ano passado, status vencido", "ordem": 1, "onde_na_tela": "Terceiro > Documentos", "resultado_esperado": "Status: vencido"}, {"acao": "Renovar o documento, estendendo a validade", "dados": "Nova data de validade: daqui a 1 ano", "ordem": 2, "onde_na_tela": "Documento > Editar > Data de validade", "resultado_esperado": "Ao salvar, o status deveria voltar sozinho para valido"}, {"acao": "Conferir o status apos a renovacao", "dados": "-", "ordem": 3, "onde_na_tela": "Lista de documentos", "resultado_esperado": "Status: valido — recalculado na edicao"}]', 'Apos estender a validade, o status volta a "valido" automaticamente. A automacao vale tanto na criacao quanto na edicao.', 'IMPACTO SE FALHAR: se a trigger so valesse no INSERT, um documento renovado continuaria marcado como vencido para sempre — o prestador apareceria irregular mesmo com a documentacao em dia, e alguem teria que corrigir o status na mao.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-010', 'Documento de terceiro sem tipo e recusado', 'excecao', 'media', 'aprovado', 'Verificar que tipo e nome sao obrigatorios. Regra: ambos sao NOT NULL. Importa porque um documento sem tipo nao pode ser cobrado nem classificado — o sistema nao sabe se e um PGR, um ASO ou um contrato.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Tentar anexar um documento sem informar o tipo", "dados": "Tipo: (vazio) | Nome: documento qualquer", "ordem": 1, "onde_na_tela": "Terceiro > Documentos > Adicionar", "resultado_esperado": "O sistema DEVE recusar"}]', 'O documento sem tipo e recusado.', 'IMPACTO SE FALHAR: documentos sem tipo nao entram nas cobrancas de documentacao obrigatoria — o sistema nao sabe que categoria conferir.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-013', 'Apagar o terceiro apaga seus documentos', 'alternativo', 'alta', 'aprovado', 'Verificar que os documentos somem junto com a empresa terceira (CASCADE). Regra: terceiro_id ON DELETE CASCADE. Importa porque documentos orfaos, sem a empresa a que pertencem, seriam lixo sem contexto na base.', 'Precisa existir um terceiro com pelo menos um documento.', '[{"acao": "Criar terceiro com um documento", "dados": "Terceiro: Prestadora X | Documento: PGR", "ordem": 1, "onde_na_tela": "Terceiros", "resultado_esperado": "Documento vinculado ao terceiro"}, {"acao": "Apagar o terceiro", "dados": "-", "ordem": 2, "onde_na_tela": "Terceiros > Excluir", "resultado_esperado": "Terceiro apagado"}, {"acao": "Conferir o documento", "dados": "-", "ordem": 3, "onde_na_tela": "-", "resultado_esperado": "O documento foi apagado junto"}]', 'O terceiro e apagado e seus documentos somem junto. Nenhum documento orfao sobra.', 'IMPACTO SE FALHAR: documentos apontando para um terceiro inexistente poluiriam a base e poderiam aparecer em consultas sem contexto.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-014', 'Apagar o trabalhador apaga seus documentos pessoais', 'alternativo', 'media', 'aprovado', 'Verificar que documentos vinculados a um trabalhador especifico (ex.: ASO individual) somem com ele. Regra: trabalhador_id ON DELETE CASCADE. Importa porque um ASO pertence a uma pessoa; sem ela, o documento perde o sentido.', 'Precisa existir um trabalhador de terceiro com um documento pessoal.', '[{"acao": "Criar trabalhador com um ASO pessoal", "dados": "Trabalhador: Jose | Documento: ASO vinculado a ele", "ordem": 1, "onde_na_tela": "Terceiro > Trabalhadores + Documentos", "resultado_esperado": "ASO vinculado ao trabalhador"}, {"acao": "Apagar o trabalhador", "dados": "-", "ordem": 2, "onde_na_tela": "Terceiro > Trabalhadores > Excluir", "resultado_esperado": "Trabalhador apagado"}, {"acao": "Conferir o ASO", "dados": "-", "ordem": 3, "onde_na_tela": "-", "resultado_esperado": "O ASO foi apagado junto"}]', 'O trabalhador e apagado e seus documentos pessoais somem junto.', 'IMPACTO SE FALHAR: exames e certificados de uma pessoa que nao esta mais cadastrada continuariam na base, sem dono.', 'api', NULL, 'em_triagem', NULL),
    ('TDOC-022', 'Documento de terceiro de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar o isolamento multi-tenant nos documentos de terceiros. Importa porque estes documentos contem dados de saude (ASO), contratos e informacoes de empresas parceiras.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, anexar um documento a um terceiro", "dados": "Documento identificavel do cliente A", "ordem": 1, "onde_na_tela": "Cliente A > Terceiros > Documentos", "resultado_esperado": "Criado no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Buscar o documento do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Terceiros", "resultado_esperado": "NAO aparece"}]', 'O documento do cliente A e invisivel no cliente B.', 'IMPACTO SE FALHAR: vazamento de dados de saude (ASO) e contratos entre clientes — incidente grave de LGPD.', 'api', NULL, 'em_triagem', NULL),
    ('TER-001', 'Cadastrar empresa terceira', 'feliz', 'alta', 'aprovado', 'Verificar o cadastro basico de uma empresa terceira (prestadora). Regra: um terceiro tem CNPJ e razao social. Importa porque terceiros sao empresas que prestam servico ao cliente, com seus proprios trabalhadores que precisam de controle de acesso, documentos e treinamentos de SST.', 'Usuario com permissao de administrar terceiros.', '[{"acao": "Abrir cadastro de terceiro", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Estrutura Organizacional > Prestadores/Terceiros > Novo", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher razao social e CNPJ", "dados": "Razao: Prestadora de Servicos Ltda | CNPJ: 11.222.333/0001-81", "ordem": 2, "onde_na_tela": "Campos Razao Social e CNPJ", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Terceiro criado e aparece na lista"}]', 'O terceiro Prestadora de Servicos Ltda existe com o CNPJ informado.', 'IMPACTO SE FALHAR: sem cadastrar terceiros, nao ha como controlar acesso, documentos e treinamentos das empresas que prestam servico — risco de SST com pessoal terceirizado.', 'api', NULL, 'em_triagem', NULL),
    ('TER-002', 'Adicionar trabalhador a um terceiro', 'feliz', 'alta', 'aprovado', 'Verificar que um trabalhador pode ser vinculado a uma empresa terceira. Regra: terceiro_trabalhadores liga uma pessoa ao terceiro. Importa porque sao esses trabalhadores que efetivamente entram no cliente — precisam de documentos e treinamentos validos para acessar as instalacoes.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Abrir um terceiro e ir a aba de trabalhadores", "dados": "-", "ordem": 1, "onde_na_tela": "Terceiros > abrir o terceiro > aba Trabalhadores > Adicionar", "resultado_esperado": "Formulario de trabalhador aberto"}, {"acao": "Preencher os dados do trabalhador", "dados": "Nome: Jose Terceirizado | CPF: 529.982.247-25", "ordem": 2, "onde_na_tela": "Campos Nome e CPF do trabalhador", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Trabalhador vinculado ao terceiro"}]', 'O trabalhador Jose Terceirizado esta vinculado a empresa terceira e aparece na lista de trabalhadores dela.', 'IMPACTO SE FALHAR: sem vincular trabalhadores ao terceiro, nao ha como controlar quem da terceirizada acessa o cliente nem exigir documentos/treinamentos dessas pessoas.', 'api', NULL, 'em_triagem', NULL),
    ('TER-003', 'Mudar status do terceiro para bloqueado', 'feliz', 'media', 'aprovado', 'Verificar que o status de um terceiro pode ser mudado para bloqueado. Regra: o status (liberado/restrito/bloqueado) controla o acesso do terceiro e e alteravel. Importa porque bloquear um terceiro (ex.: documentacao vencida) impede o acesso das pessoas dele — mecanismo de seguranca.', 'Precisa existir um terceiro cadastrado.', '[{"acao": "Abrir um terceiro", "dados": "-", "ordem": 1, "onde_na_tela": "Terceiros > abrir o terceiro", "resultado_esperado": "Ficha do terceiro aberta, com status atual"}, {"acao": "Mudar o status para bloqueado", "dados": "Status: de liberado para bloqueado", "ordem": 2, "onde_na_tela": "Campo Status", "resultado_esperado": "O status muda para bloqueado"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "O terceiro esta bloqueado"}]', 'O terceiro fica com status bloqueado e persiste. O bloqueio pode entao impedir o acesso das pessoas dele.', 'IMPACTO SE FALHAR: se o status nao mudar, nao da para bloquear um terceiro com pendencia — pessoas de uma terceirizada irregular continuariam acessando o cliente.', 'api', NULL, 'em_triagem', NULL),
    ('TER-010', 'Razao social vazia e recusada', 'excecao', 'media', 'aprovado', 'Verificar que um terceiro sem razao social e recusado. Regra: razao_social e NOT NULL. Importa porque um terceiro sem razao social nao tem identificacao — nao da para saber que empresa e.', 'Nenhuma.', '[{"acao": "Abrir novo terceiro", "dados": "-", "ordem": 1, "onde_na_tela": "Terceiros > Novo", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar a razao social vazia e tentar salvar", "dados": "Razao: (vazio) | CNPJ: 11.222.333/0001-81", "ordem": 2, "onde_na_tela": "Campo Razao Social (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar"}]', 'O cadastro e recusado. Nenhum terceiro sem razao social e criado.', 'IMPACTO SE FALHAR: terceiro sem razao social aparece em branco e nao da para identificar a empresa prestadora nos controles de acesso e documentos.', 'api', NULL, 'em_triagem', NULL),
    ('TER-011', 'Status invalido e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um status de terceiro invalido e recusado. Regra: status so aceita liberado, restrito ou bloqueado. Importa porque um status livre quebraria a logica de controle de acesso que depende desses tres estados.', 'Formulario de terceiro com o campo status.', '[{"acao": "Abrir novo terceiro (ou editar um)", "dados": "-", "ordem": 1, "onde_na_tela": "Terceiros > Novo/Editar > campo Status", "resultado_esperado": "Campo status disponivel"}, {"acao": "Tentar um status fora da lista", "dados": "Status: pendente (valor invalido — nao existe)", "ordem": 2, "onde_na_tela": "Campo Status", "resultado_esperado": "O sistema DEVE recusar"}]', 'O status invalido e recusado. So liberado, restrito ou bloqueado sao aceitos.', 'IMPACTO SE FALHAR: status invalido quebra a logica de controle de acesso do terceiro (que decide quem entra conforme liberado/restrito/bloqueado).', 'api', NULL, 'em_triagem', NULL),
    ('TER-013', 'Apagar terceiro APAGA seus trabalhadores (CASCADE)', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar um terceiro APAGA seus trabalhadores junto (CASCADE). Regra: ON DELETE CASCADE — ao contrario de filiais e cargos (que sobrevivem desassociados), o trabalhador de um terceiro nao faz sentido sem o terceiro. Importa porque um trabalhador terceirizado so existe no sistema pela relacao com a empresa dele.', 'Precisa existir um terceiro com pelo menos um trabalhador vinculado.', '[{"acao": "Criar terceiro com um trabalhador", "dados": "Terceiro: Prestadora X | Trabalhador: Pedro, vinculado a Prestadora X", "ordem": 1, "onde_na_tela": "Terceiros", "resultado_esperado": "Trabalhador pertence ao terceiro"}, {"acao": "Apagar o terceiro Prestadora X", "dados": "-", "ordem": 2, "onde_na_tela": "Terceiros > Prestadora X > Excluir", "resultado_esperado": "Terceiro apagado"}, {"acao": "Conferir o trabalhador Pedro", "dados": "-", "ordem": 3, "onde_na_tela": "Buscar o trabalhador", "resultado_esperado": "O trabalhador Pedro foi apagado JUNTO com o terceiro (nao sobra orfao)"}]', 'O terceiro e apagado e seus trabalhadores somem junto (CASCADE). Nenhum trabalhador orfao sobra.', 'IMPACTO SE FALHAR: se os trabalhadores nao fossem apagados, sobrariam registros orfaos apontando para um terceiro inexistente — lixo na base. CONTRASTE com EST-013 (filial e SET NULL): aqui CASCADE faz sentido porque trabalhador de terceiro nao existe sozinho.', 'api', NULL, 'em_triagem', NULL),
    ('TER-020', 'Dois terceiros com o mesmo CNPJ (revela ausencia de unique)', 'negativo', 'alta', 'aprovado', 'Verificar o que acontece ao cadastrar dois terceiros com o mesmo CNPJ no mesmo cliente. Regra esperada: o CNPJ deveria ser unico por cliente. Este caso revela se ha essa constraint. Importa porque a mesma empresa terceira cadastrada duas vezes duplica controles de acesso, documentos e treinamentos.', 'Precisa existir um terceiro com um CNPJ conhecido.', '[{"acao": "Cadastrar um terceiro com um CNPJ", "dados": "Razao: Primeira Prestadora | CNPJ: 11.444.777/0001-61", "ordem": 1, "onde_na_tela": "Novo Terceiro", "resultado_esperado": "Criado"}, {"acao": "Tentar cadastrar OUTRO terceiro com o MESMO CNPJ", "dados": "Razao: Segunda Prestadora | CNPJ: 11.444.777/0001-61 (mesmo)", "ordem": 2, "onde_na_tela": "Novo Terceiro", "resultado_esperado": "Idealmente o sistema DEVERIA recusar o CNPJ duplicado"}]', 'O CNPJ duplicado deveria ser RECUSADO. ACHADO ATUAL: o banco ACEITA — cnpj e NOT NULL mas nao tem constraint unica. A mesma empresa terceira pode entrar duas vezes.', 'IMPACTO SE FALHAR (e falha hoje): terceiro duplicado divide controles de acesso, documentos e treinamentos entre dois cadastros da mesma empresa — pode liberar acesso por um enquanto o outro esta bloqueado. CORRECAO SUGERIDA: indice unico por (tenant_id, cnpj normalizado), como ja existe em empresa_cadastro.', 'api', NULL, 'em_triagem', NULL),
    ('TER-022', 'Terceiro de outro cliente e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que um terceiro de um cliente e invisivel para outro. Regra: isolamento multi-tenant. Importa porque a lista de prestadores de um cliente e informacao comercial sensivel que nao pode vazar.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, cadastrar um terceiro", "dados": "Razao: Prestadora Secreta do A | CNPJ: 11.222.333/0001-81", "ordem": 1, "onde_na_tela": "Cliente A > Novo Terceiro", "resultado_esperado": "Criado no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Buscar pela razao ou CNPJ do terceiro do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Terceiros > busca", "resultado_esperado": "NAO aparece para o cliente B"}]', 'O terceiro do cliente A e invisivel no cliente B. Zero vazamento.', 'IMPACTO SE FALHAR: exporia a lista de prestadores (relacoes comerciais) de um cliente a outro. Protecao RLS por tenant.', 'api', NULL, 'em_triagem', NULL),
    ('TTRE-001', 'Treinamento de terceiro tambem tem validade automatica', 'feliz', 'alta', 'aprovado', 'Verificar que a mesma automacao de validade vale para os treinamentos de SST dos trabalhadores terceirizados. Regra: a funcao atualizar_status_terceiro_doc e aplicada tambem em terceiro_treinamentos. Importa porque treinamento de NR vencido significa que a pessoa NAO pode executar aquela atividade — e uma trava de seguranca, nao so um documento.', 'Precisa existir um trabalhador de terceiro cadastrado.', '[{"acao": "Registrar um treinamento com validade vencida", "dados": "Tipo: NR-35 (trabalho em altura) | Validade: um ano atras", "ordem": 1, "onde_na_tela": "Terceiro > Trabalhadores > Treinamentos > Adicionar", "resultado_esperado": "Treinamento salvo"}, {"acao": "Conferir o status", "dados": "-", "ordem": 2, "onde_na_tela": "Lista de treinamentos do trabalhador", "resultado_esperado": "Status: vencido — a mesma automacao dos documentos"}]', 'O treinamento vencido e classificado como "vencido" automaticamente, pela mesma trigger dos documentos.', 'IMPACTO SE FALHAR: um trabalhador com NR-35 vencida apareceria apto a trabalhar em altura. Alem do risco de acidente, e responsabilidade legal da contratante permitir o acesso.', 'api', NULL, 'em_triagem', NULL),
    ('TTRE-010', 'Treinamento exige vinculo com trabalhador', 'excecao', 'media', 'aprovado', 'Verificar que um treinamento precisa estar ligado a uma pessoa. Regra: trabalhador_id e NOT NULL em treinamentos (diferente de documentos, onde e opcional). Importa porque treinamento e sempre individual — nao existe "a empresa fez NR-35", quem faz e a pessoa.', 'Precisa existir uma empresa terceira cadastrada.', '[{"acao": "Tentar registrar um treinamento sem indicar o trabalhador", "dados": "Tipo: NR-10 | Trabalhador: (nenhum)", "ordem": 1, "onde_na_tela": "Terceiro > Treinamentos > Adicionar", "resultado_esperado": "O sistema DEVE recusar — treinamento e individual"}]', 'O treinamento sem trabalhador e recusado. A diferenca em relacao aos documentos (onde o trabalhador e opcional) esta correta: documento pode ser da empresa, treinamento e da pessoa.', 'IMPACTO SE FALHAR: um treinamento sem dono nao serve para liberar ninguem — e nao daria para saber quem esta apto a executar a atividade.', 'api', NULL, 'em_triagem', NULL),
    ('TTRE-011', 'Treinamento sem data de validade quebra o cadastro', 'excecao', 'critica', 'aprovado', 'Verificar se e possivel registrar um treinamento de terceiro sem informar data de validade. Regra esperada: a data e opcional (o campo aceita nulo), e o status deveria ficar "pendente". Importa porque ha treinamentos que legitimamente nao tem prazo — integracao, ordem de servico, orientacoes internas. Este caso revela um erro de banco que impede o cadastro.', 'Precisa existir um terceiro com um trabalhador cadastrado.', '[{"acao": "Abrir os treinamentos de um trabalhador terceirizado", "dados": "-", "ordem": 1, "onde_na_tela": "Terceiros > abrir o terceiro > Trabalhadores > abrir o trabalhador > aba Treinamentos > Adicionar", "resultado_esperado": "Formulario de treinamento aberto"}, {"acao": "Preencher o treinamento SEM informar data de validade", "dados": "Tipo: Integracao | Data de validade: (deixar em branco) | Certificado: (nenhum)", "ordem": 2, "onde_na_tela": "Campos Tipo e Data de Validade", "resultado_esperado": "Deveria salvar normalmente, com status pendente"}, {"acao": "Tentar salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Deveria gravar. RESULTADO REAL: erro de banco, o treinamento nao e salvo"}]', 'O treinamento deveria ser salvo com status "pendente" (mesmo comportamento de um documento sem validade, caso TDOC-004). RESULTADO REAL: erro de banco — record "new" has no field "arquivo_url". O cadastro e impossivel.', 'IMPACTO (falha hoje, e impede o uso): nao da para registrar nenhum treinamento sem data de validade. Treinamentos sem prazo (integracao, ordem de servico) nao podem ser cadastrados, e o usuario recebe um erro tecnico sem explicacao. CAUSA: a funcao atualizar_status_terceiro_doc() serve as duas tabelas de terceiros, mas acessa NEW.arquivo_url — coluna que existe em terceiro_documentos e NAO existe em terceiro_treinamentos (la o campo se chama certificado_url). O acesso so acontece no ramo "data_validade IS NULL", por isso o problema fica latente: treinamento COM validade funciona. CORRECAO SUGERIDA: separar em duas funcoes, ou tornar o acesso ao campo condicional. A opcao mais simples e criar uma funcao propria para treinamentos usando certificado_url no lugar de arquivo_url, e trocar a trigger auto_status_terceiro_treinamentos para usa-la.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/prestadores'
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

-- Psicossocial (50 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('TELA-PSICO-001', 'TC-01: Criar campanha psicossocial com dados válidos', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-002', 'TC-02: Assistente de seleção de instrumento é exibido', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-003', 'TC-03: Bloquear criação sem Setor + Função', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-004', 'TC-04: Autocomplete de Setor + Função funciona', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-005', 'TC-05: Cadastrar novo Setor/Função inexistente', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-006', 'TC-06: Múltiplos pares Setor + Função', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-007', 'TC-07: Distribuição gera link, QR Code e mensagens', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-008', 'TC-08: Acesso ao questionário sem login', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-009', 'TC-09: Tela de verificação WhatsApp é exibida', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-010', 'TC-10: Código WhatsApp inválido é rejeitado', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-011', 'TC-11: Duplicidade de respostas é bloqueada', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-012', 'TC-12: Anonimato das respostas', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-013', 'TC-13: Resultados exibidos com 5+ respondentes', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-014', 'TC-14: Agrupamento automático por privacidade', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-015', 'TC-15: Mensagem de dados insuficientes para confidencialidade', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-016', 'TC-16: Cálculo de IPS ao encerrar campanha', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-017', 'TC-17: Classificação IPS por faixas', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-018', 'TC-18: Gráfico radar e análise interpretativa', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-019', 'TC-19: Exportação de relatório PDF', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-020', 'TC-20: Integração com GRO', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-021', 'TC-21: Vínculo risco x Setor + Função no GRO', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-022', 'TC-22: Plano 5W2H para risco Alto — 60 dias', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-023', 'TC-23: Plano 5W2H para risco Crítico — 30 dias', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-024', 'TC-24: Bloquear arquivamento de risco Alto sem plano', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-025', 'TC-25: Bloquear arquivamento de risco Crítico sem plano', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-026', 'TC-26: Recomendação de AET quando IPS < 65', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-027', 'TC-27: AET obrigatória quando IPS < 50', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-028', 'TC-28: Recomendação AET por múltiplos fatores críticos', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-029', 'TC-29: AET por recorrência de riscos', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-030', 'TC-30: Dados psicossociais no módulo Ergonomia', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-031', 'TC-31: Reavaliação exigida após ação concluída', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-032', 'TC-32: Histórico de evolução do IPS', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-033', 'TC-33: Inventário PGR consolidado', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-034', 'TC-34: Exportação PDF do inventário PGR', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-035', 'TC-35: Bloquear data fim anterior à data início', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-036', 'TC-36: Campanha expirada sem respostas não gera erro', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-037', 'TC-37: Grupo com 5 respondentes — resultado exibido', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-038', 'TC-38: Fallback para nível setor com 4 respondentes na função', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-039', 'TC-39: Empresa pequena — agrupamento seguro', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-040', 'TC-40: Link inativo após encerramento da campanha', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-041', 'TC-41: Erro controlado na falha de envio WhatsApp', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-042', 'TC-42: Encerramento manual antecipado permitido', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-043', 'TC-43: Impedir duplicidade de pares Setor + Função', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-044', 'TC-44: Risco Alto/Crítico sem 5W2H é defeito crítico', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-045', 'TC-45: IPS 65 classificado como Estável', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-046', 'TC-46: IPS 50 classificado como Atenção', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-047', 'TC-47: PDF mantém acentuação e caracteres especiais', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-048', 'TC-48: Acesso negado para usuário sem permissão', 'negativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-049', 'TC-EXTRA: Guia Rápido abre e fecha corretamente', 'alternativo', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL),
    ('TELA-PSICO-050', 'TC-EXTRA: Tabs do dashboard carregam sem erro', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/psicossocial.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'saude-seguranca/psicossocial'
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


-- (3) PONTES — 27 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('PONTO-392', 'qa_caso_ponto_392', true),
    ('PONTO-393', 'qa_caso_ponto_393', true),
    ('PONTO-394', 'qa_caso_ponto_394', true),
    ('PONTO-395', 'qa_caso_ponto_395', true),
    ('PONTO-396', 'qa_caso_ponto_396', true),
    ('PONTO-397', 'qa_caso_ponto_397', true),
    ('PONTO-398', 'qa_caso_ponto_398', true),
    ('TDOC-001', 'qa_caso_tdoc_001', true),
    ('TDOC-002', 'qa_caso_tdoc_002', true),
    ('TDOC-003', 'qa_caso_tdoc_003', true),
    ('TDOC-004', 'qa_caso_tdoc_004', true),
    ('TDOC-005', 'qa_caso_tdoc_005', true),
    ('TDOC-010', 'qa_caso_tdoc_010', true),
    ('TDOC-013', 'qa_caso_tdoc_013', true),
    ('TDOC-014', 'qa_caso_tdoc_014', true),
    ('TDOC-022', 'qa_caso_tdoc_022', true),
    ('TER-001', 'qa_caso_ter_001', true),
    ('TER-002', 'qa_caso_ter_002', true),
    ('TER-003', 'qa_caso_ter_003', true),
    ('TER-010', 'qa_caso_ter_010', true),
    ('TER-011', 'qa_caso_ter_011', true),
    ('TER-013', 'qa_caso_ter_013', true),
    ('TER-020', 'qa_caso_ter_020', true),
    ('TER-022', 'qa_caso_ter_022', true),
    ('TTRE-001', 'qa_caso_ttre_001', true),
    ('TTRE-010', 'qa_caso_ttre_010', true),
    ('TTRE-011', 'qa_caso_ttre_011', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 77, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('PONTO-392'), ('PONTO-393'), ('PONTO-394'), ('PONTO-395'), ('PONTO-396'), ('PONTO-397'), ('PONTO-398'), ('TDOC-001'), ('TDOC-002'), ('TDOC-003'), ('TDOC-004'), ('TDOC-005'), ('TDOC-010'), ('TDOC-013'), ('TDOC-014'), ('TDOC-022'), ('TELA-PSICO-001'), ('TELA-PSICO-002'), ('TELA-PSICO-003'), ('TELA-PSICO-004'), ('TELA-PSICO-005'), ('TELA-PSICO-006'), ('TELA-PSICO-007'), ('TELA-PSICO-008'), ('TELA-PSICO-009'), ('TELA-PSICO-010'), ('TELA-PSICO-011'), ('TELA-PSICO-012'), ('TELA-PSICO-013'), ('TELA-PSICO-014'), ('TELA-PSICO-015'), ('TELA-PSICO-016'), ('TELA-PSICO-017'), ('TELA-PSICO-018'), ('TELA-PSICO-019'), ('TELA-PSICO-020'), ('TELA-PSICO-021'), ('TELA-PSICO-022'), ('TELA-PSICO-023'), ('TELA-PSICO-024'), ('TELA-PSICO-025'), ('TELA-PSICO-026'), ('TELA-PSICO-027'), ('TELA-PSICO-028'), ('TELA-PSICO-029'), ('TELA-PSICO-030'), ('TELA-PSICO-031'), ('TELA-PSICO-032'), ('TELA-PSICO-033'), ('TELA-PSICO-034'), ('TELA-PSICO-035'), ('TELA-PSICO-036'), ('TELA-PSICO-037'), ('TELA-PSICO-038'), ('TELA-PSICO-039'), ('TELA-PSICO-040'), ('TELA-PSICO-041'), ('TELA-PSICO-042'), ('TELA-PSICO-043'), ('TELA-PSICO-044'), ('TELA-PSICO-045'), ('TELA-PSICO-046'), ('TELA-PSICO-047'), ('TELA-PSICO-048'), ('TELA-PSICO-049'), ('TELA-PSICO-050'), ('TER-001'), ('TER-002'), ('TER-003'), ('TER-010'), ('TER-011'), ('TER-013'), ('TER-020'), ('TER-022'), ('TTRE-001'), ('TTRE-010'), ('TTRE-011')),
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
