-- =========================================================
-- QA — Desligamento: rotinas dos casos de banco (31/07/2026)
--
-- OBJETIVO: produzir o relatorio de falhas para encaminhar ao desenvolvimento.
-- Falha aqui e achado, nao defeito de teste. Cada rotina diz, na propria
-- mensagem, qual dispositivo legal foi contrariado e qual a correcao sugerida.
--
-- DESCOBERTA DE ARQUITETURA feita ao ler o codigo para escrever estas rotinas,
-- e que muda o peso de tres casos:
--
--   1) O desligamento NAO E UM EVENTO. E um UPDATE na propria linha de
--      public.admissoes, com status = 'desligado' e mais 18 colunas. Nao existe
--      tabela de desligamentos. Consequencia direta: um segundo desligamento
--      nao "duplica" — ele SOBRESCREVE o primeiro, e o dado original
--      desaparece sem trilha. O DESL-002 passa a testar perda de historico,
--      nao apenas duplicidade.
--
--   2) O PROTOCOLO NAO E PERSISTIDO. Ele e montado no componente, exibido em
--      toast e embutido no texto livre da descricao enviada ao Hub Contabil.
--      Nenhuma coluna de admissoes o guarda. O DESL-101 era "protocolo nao e
--      unico"; o achado real e mais grave: nao ha o que consultar.
--
--   3) O EVENTO S-2299 NAO CHEGA A FILA DE TRANSMISSAO. gerarEventoS2299 e
--      funcao pura em src/lib/folha/integracoes-fiscais.ts: monta o objeto e
--      devolve. O componente grava em audit_logs uma linha dizendo
--      "esocial_s2299_gerado" e manda o objeto para console.log. A tabela
--      public.esocial_transmissoes existe e e alimentada por OUTRA tela
--      (EsocialTransmissao.tsx) e por edge function propria. O objeto gerado
--      no desligamento nunca chega la. Ou a outra tela reconstroi o evento a
--      partir da admissao — e ai o audit_log e so ruido —, ou a obrigacao
--      acessoria simplesmente nao e cumprida por esse caminho. Precisa de
--      resposta do time, e o DESL-091 passa a medir isso.
--
-- Observado tambem: a geracao das verbas rescisorias tambem e nao bloqueante,
-- com toast.warning. Sao DUAS integracoes que podem falhar sem impedir o
-- desligamento — o eSocial em silencio, o Financeiro com aviso.
--
-- TRES CASOS RECLASSIFICADOS (erro meu na migration anterior): DESL-090, 092 e
-- 100 nasceram como 'api', mas verificam orquestracao que so o navegador
-- dispara. Nenhuma rotina SQL invoca o formulario React. Viram 'e2e'.
--
-- ROTINAS DE AUDITORIA: DESL-065, 091 e 104 nao criam nada. Elas LEEM a base
-- real, contam inconsistencias e nao escrevem uma linha. E uma categoria
-- diferente do resto do motor, que trabalha por fixture dentro do cercado.
-- Marcadas como tal na propria mensagem para nao confundir leitura.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) Reclassificacao e correcao de achado
-- ─────────────────────────────────────────────────────────
DO $ajusta$
DECLARE v_n int;
BEGIN
  UPDATE public.qa_casos_teste
  SET nivel = 'e2e',
      observacoes = observacoes || ' | RECLASSIFICADO 31/07/2026 (api -> e2e): '
        || 'verifica orquestracao disparada pelo formulario React. Nenhuma rotina '
        || 'SQL consegue invocar o fluxo; so consegue constatar que ele nao rodou, '
        || 'o que seria falha do metodo e nao do sistema. Cobertura pertence ao Cypress.'
  WHERE codigo IN ('DESL-090','DESL-092','DESL-100') AND nivel = 'api';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Reclassificados para e2e: %.', v_n;

  UPDATE public.qa_casos_teste
  SET titulo = 'Protocolo de desligamento e persistido e rastreavel',
      observacoes = observacoes || ' | CORRIGIDO 31/07/2026 apos leitura do codigo: '
        || 'o achado e maior que o documentado. O protocolo nao e apenas nao-unico — '
        || 'ele NAO E GRAVADO. Nao existe coluna para ele em admissoes. O valor e '
        || 'montado no componente, exibido em toast e embutido no texto livre da '
        || 'descricao enviada ao Hub Contabil. Nao ha campo consultavel: para '
        || 'localizar um desligamento pelo protocolo seria preciso busca textual '
        || 'na descricao de outro modulo. Rastreabilidade prometida ao usuario e '
        || 'nao entregue.'
  WHERE codigo = 'DESL-101';

  UPDATE public.qa_casos_teste
  SET observacoes = observacoes || ' | APROFUNDADO 31/07/2026: o evento nao chega a '
        || 'public.esocial_transmissoes. gerarEventoS2299 e funcao pura, sem escrita. '
        || 'O componente grava em audit_logs a acao esocial_s2299_gerado e manda o '
        || 'objeto para console.log. A fila de transmissao e alimentada por outra tela '
        || 'e por edge function propria. PERGUNTA PARA O TIME: a tela de transmissao '
        || 'reconstroi o S-2299 a partir da admissao desligada? Se sim, o audit_log '
        || 'do desligamento e ruido e induz a erro. Se nao, a obrigacao acessoria nao '
        || 'e cumprida por este caminho.'
  WHERE codigo = 'DESL-091';
END $ajusta$;

-- ─────────────────────────────────────────────────────────
-- 2) Helper: existe coluna? (usado pelos casos de schema)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_coluna_existe(p_tabela text, p_coluna text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_tabela AND column_name = p_coluna);
$$;

-- ─────────────────────────────────────────────────────────
-- 3) Rotinas de cercado
-- ─────────────────────────────────────────────────────────

-- DESL-001 — caminho feliz.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_status text; v_data date; v_motivo text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao concluida e ativa';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-001] Colaborador', '99900100001',
          'qa.desl001@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 800)
  RETURNING id INTO v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Registrar desligamento com dados validos';
  r.esperado    := 'Persistido, com status desligado';
  UPDATE public.admissoes SET
    status = 'desligado',
    data_desligamento = CURRENT_DATE,
    motivo_desligamento = 'sem_justa_causa',
    dias_aviso_previo = 36,
    tipo_aviso_previo = 'indenizado',
    multa_fgts = true,
    seguro_desemprego_elegivel = true
  WHERE id = v_adm;

  r.passo_ordem := 3;
  r.passo_acao  := 'Reler o registro';
  SELECT status::text, data_desligamento, motivo_desligamento
    INTO v_status, v_data, v_motivo
  FROM public.admissoes WHERE id = v_adm;

  IF v_status = 'desligado' AND v_data = CURRENT_DATE AND v_motivo = 'sem_justa_causa' THEN
    r.situacao := 'passou';
    r.obtido   := 'Desligamento gravado e status atualizado corretamente.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Releitura divergente: status=%s, data=%s, motivo=%s.',
                          v_status, v_data, v_motivo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-002 — segundo desligamento SOBRESCREVE o primeiro.
-- Base: CLT art. 477 c/c art. 442 — extinto o contrato, nao ha vinculo a extinguir.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_aceitou boolean := false;
  v_motivo_final text; v_data_final date;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao e registrar o primeiro desligamento';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-002] Colaborador', '99900100002',
          'qa.desl002@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 900)
  RETURNING id INTO v_adm;

  UPDATE public.admissoes SET
    status = 'desligado', data_desligamento = CURRENT_DATE - 30,
    motivo_desligamento = 'pedido_demissao'
  WHERE id = v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar registrar um SEGUNDO desligamento, com outro motivo e outra data';
  r.esperado    := 'Recusado — o contrato ja esta extinto';
  BEGIN
    UPDATE public.admissoes SET
      data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se o desligamento original sobreviveu';
  SELECT motivo_desligamento, data_desligamento INTO v_motivo_final, v_data_final
  FROM public.admissoes WHERE id = v_adm;

  IF NOT v_aceitou THEN
    r.situacao := 'passou';
    r.obtido   := 'Segundo desligamento recusado pelo banco.';
  ELSIF v_motivo_final = 'pedido_demissao' THEN
    r.situacao := 'falhou';
    r.obtido   := 'A segunda gravacao foi aceita, ainda que o motivo original tenha '
               || 'permanecido. Nao ha trava de duplicidade no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('ACEITOU E SOBRESCREVEU. O desligamento original (pedido_demissao '
               || 'em %s) foi substituido por %s em %s, sem trilha. Como o desligamento e '
               || 'um UPDATE na propria linha de admissoes e nao um evento, a segunda '
               || 'gravacao APAGA a primeira: motivo, data, verbas e ASO do desligamento '
               || 'original deixam de existir. Nao ha como auditar o que foi alterado, '
               || 'nem por quem. Correcao sugerida: indice unico parcial impedindo '
               || 'reescrita de admissao ja desligada, e tabela de eventos de '
               || 'desligamento com historico, em vez de colunas na admissao.',
               (CURRENT_DATE - 30), v_motivo_final, v_data_final);
    r.detalhe  := jsonb_build_object('motivo_original','pedido_demissao',
                                     'motivo_apos_segunda_gravacao', v_motivo_final,
                                     'historico_preservado', false);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-003 — afastamento ativo (contrato suspenso).
-- Base: CLT art. 476 e art. 471; Sumula 371 do TST.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_cpf text := '99900100003'; v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar colaborador com afastamento ATIVO e sem data de retorno';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-003] Colaborador', v_cpf,
          'qa.desl003@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 1000)
  RETURNING id INTO v_adm;

  INSERT INTO public.afastamentos
    (tenant_id, colaborador_nome, colaborador_cpf, data_inicio, data_fim, status)
  VALUES (v_t, '[QA-DESL-003] Colaborador', v_cpf, CURRENT_DATE - 60, NULL, 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar dispensa sem justa causa com o contrato suspenso';
  r.esperado    := 'Recusado — CLT art. 476: durante o auxilio-doenca o contrato esta suspenso';
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU dispensa imotivada com afastamento ativo e sem retorno formal. '
               || 'O contrato suspenso (CLT art. 476) nao admite dispensa imotivada — o '
               || 'ato e ineficaz e a discussao vira reintegracao. A tela consulta '
               || 'afastamentos, mas o banco nao impede a gravacao por nenhuma outra rota. '
               || 'Correcao sugerida: trigger que recuse desligamento imotivado havendo '
               || 'afastamento ativo, liberando falecimento e termino de contrato a termo.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco. A suspensao do contrato e respeitada na escrita.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-004 — contrato ainda nao iniciado.
-- Base: CLT arts. 442 e 443.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_004()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_aceitou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar admissao com inicio no futuro';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-004] Colaborador', '99900100004',
          'qa.desl004@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE + 30)
  RETURNING id INTO v_adm;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar desligar hoje, antes do inicio do contrato';
  r.esperado    := 'Recusado — sem prestacao iniciada nao ha contrato em curso';
  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa'
    WHERE id = v_adm;
    v_aceitou := true;
  EXCEPTION WHEN OTHERS THEN v_aceitou := false;
  END;

  IF v_aceitou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU desligamento com data anterior a propria admissao — contrato '
               || 'com duracao negativa. Nada no banco impede. A validacao existe apenas '
               || 'na tela (RNDES02). Correcao sugerida: CHECK garantindo '
               || 'data_desligamento >= data_admissao. Para desistencia antes do inicio o '
               || 'evento correto e cancelamento de admissao, nao desligamento — sao '
               || 'eventos distintos no eSocial.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-006 — isolamento entre clientes na autoria do desligamento.
-- Base: LGPD arts. 46 e 47.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_006()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_alheio uuid; v_gravou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Localizar um usuario de OUTRO tenant';
  SELECT id INTO v_alheio FROM public.usuarios_base
  WHERE tenant_id IS DISTINCT FROM v_t LIMIT 1;

  IF v_alheio IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nao existe usuario fora do cercado nesta base — o isolamento entre '
               || 'clientes nao pode ser exercitado aqui.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar admissao no cercado e desliga-la atribuindo a autoria ao usuario alheio';
  r.esperado    := 'Recusado — a autoria do desligamento nao atravessa a fronteira do cliente';
  INSERT INTO public.admissoes
    (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-DESL-006] Colaborador', '99900100006',
          'qa.desl006@sandbox.invalid', 'Operador', 'concluido', CURRENT_DATE - 500)
  RETURNING id INTO v_adm;

  BEGIN
    UPDATE public.admissoes SET
      status = 'desligado', data_desligamento = CURRENT_DATE,
      motivo_desligamento = 'sem_justa_causa', desligado_por = v_alheio
    WHERE id = v_adm;
    v_gravou := EXISTS (SELECT 1 FROM public.admissoes
                        WHERE id = v_adm AND desligado_por = v_alheio);
  EXCEPTION WHEN OTHERS THEN v_gravou := false;
  END;

  IF v_gravou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU registrar como autor do desligamento um usuario de OUTRO '
               || 'cliente. desligado_por nao valida tenant. A RLS protege a leitura, mas '
               || 'a escrita cruza a fronteira — mesma classe do gap HIER-006 no modulo '
               || 'Empresa. Desligamento e dado pessoal e a autoria compoe a trilha de '
               || 'auditoria: autoria errada compromete a prova. Correcao sugerida: '
               || 'trigger validando que desligado_por pertence ao mesmo tenant da admissao.';
    r.detalhe  := jsonb_build_object('admissao_no_cercado', v_adm, 'autor_de_outro_tenant', v_alheio);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado. A autoria respeita a fronteira entre clientes.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-072 — nao ha onde registrar dirigente sindical.
-- Base: CF art. 8o, VIII; CLT art. 543, §3o; Sumula 369 do TST.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_072()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_achou text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Procurar no schema qualquer campo que registre mandato ou candidatura sindical';
  r.esperado    := 'Existe onde registrar a condicao de dirigente sindical';

  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_achou
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (column_name ~* '(^|_)sindical(_|$)' OR column_name ~* '(^|_)dirigente(_|$)'
         OR column_name ~* 'mandato_sindic')
    AND column_name NOT ILIKE '%sindicato\_homolog%';

  IF v_achou IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := 'NAO EXISTE nenhum campo no banco para registrar que um colaborador e '
               || 'dirigente sindical ou candidato. Sem o dado, a estabilidade do art. 543, '
               || '§3o da CLT e do art. 8o, VIII da CF nao tem como ser verificada, e o '
               || 'sistema permite a dispensa. AGRAVANTE: a tela libera qualquer '
               || 'estabilidade quando o motivo e justa causa — para dirigente sindical '
               || 'isso e incorreto, porque o §3o exige falta grave APURADA EM INQUERITO '
               || 'JUDICIAL (arts. 494 e 853). Correcao: campo de mandato sindical com '
               || 'inicio e fim, verificacao ate 1 ano apos o termino, e exigencia de '
               || 'referencia ao inquerito para dispensa por falta grave. '
               || '(O campo sindicato_homologacao foi excluido da busca: e do bloco de '
               || 'homologacao, nao de estabilidade.)';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Existe onde registrar: ' || v_achou;
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-073 — nao ha onde registrar composicao da CIPA.
-- Base: ADCT art. 10, II, "a"; Sumula 339 do TST (alcanca o suplente).
CREATE OR REPLACE FUNCTION public.qa_caso_desl_073()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_composicao text; v_mandato boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Conferir se a empresa ja controla mandato da CIPA';
  v_mandato := public.qa_coluna_existe('empresa_cadastro','cipa_data_mandato_fim');

  r.passo_ordem := 2;
  r.passo_acao  := 'Procurar a composicao NOMINAL da CIPA ligada ao colaborador';
  r.esperado    := 'Existe onde registrar quem sao os membros, titulares e suplentes';

  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_composicao
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name ~* '(^|_)cipa(_|$)'
         OR (column_name ~* '(^|_)cipa(_|$)' AND column_name NOT ILIKE 'cipa\_%'));

  IF v_composicao IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := format('NAO EXISTE composicao nominal da CIPA no banco. A empresa %s '
               || 'controla o mandato (datas), mas nao ha vinculo entre a comissao e os '
               || 'colaboradores que a compoem. Sem isso, a estabilidade do ADCT art. 10, '
               || 'II, "a" nao pode ser verificada no desligamento. ATENCAO a Sumula 339, '
               || 'I do TST: a garantia alcanca tambem o SUPLENTE — a estrutura precisa '
               || 'distinguir titular de suplente sem excluir nenhum dos dois da protecao. '
               || 'Este e o gap de estabilidade mais barato de fechar, porque metade do '
               || 'caminho ja existe.',
               CASE WHEN v_mandato THEN 'JA' ELSE 'NAO' END);
    r.detalhe  := jsonb_build_object('mandato_controlado', v_mandato, 'composicao_nominal', false);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Composicao encontrada: ' || v_composicao;
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-101 — o protocolo nao e persistido.
-- Regra de produto (sem base legal): rastreabilidade do evento rescisorio.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_101()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_coluna text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Procurar a coluna que guarda o protocolo do desligamento';
  r.esperado    := 'Existe campo proprio, consultavel e unico';

  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_coluna
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name ILIKE '%protocolo%'
    AND table_name IN ('admissoes','folha_rescisoes');

  IF v_coluna IS NULL THEN
    r.situacao := 'falhou';
    r.obtido   := 'O PROTOCOLO NAO E GRAVADO. Ele e montado no componente no formato '
               || 'DESL-{aaaammdd}-{8 primeiros caracteres do id da admissao}, exibido em '
               || 'toast e embutido no texto livre da descricao enviada ao Hub Contabil. '
               || 'Nenhuma coluna de admissoes ou folha_rescisoes o guarda. Consequencia: '
               || 'o numero e prometido ao usuario como rastreio e nao pode ser consultado '
               || '— localizar um desligamento por ele exigiria busca textual na descricao '
               || 'de outro modulo. Alem disso, sendo deterministico por admissao e dia, '
               || 'nao distingue tentativas. Correcao: coluna propria com restricao de '
               || 'unicidade, gerada no banco.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Protocolo persistido em: ' || v_coluna;
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- 4) Rotinas de AUDITORIA — somente leitura sobre a base real
-- ─────────────────────────────────────────────────────────

-- DESL-065 — prazo de 10 dias do exame demissional (NR-07, item 7.5.11).
CREATE OR REPLACE FUNCTION public.qa_caso_desl_065()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_desligados int; v_sem_exame int; v_fora_prazo int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): medir o cumprimento do prazo de 10 dias';
  r.esperado    := 'Todo desligamento com exame obrigatorio tem exame dentro de 10 dias';

  SELECT count(*) INTO v_desligados FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL;

  SELECT count(*) INTO v_sem_exame FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL
    AND data_exame_demissional IS NULL;

  SELECT count(*) INTO v_fora_prazo FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL
    AND data_exame_demissional IS NOT NULL
    AND data_exame_demissional > data_desligamento + 10;

  IF v_sem_exame = 0 AND v_fora_prazo = 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s desligamento(s) analisado(s), todos com exame dentro do prazo.', v_desligados);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('De %s desligamento(s): %s SEM data de exame demissional e %s com '
               || 'exame alem dos 10 dias do termino. A NR-07, item 7.5.11, exige o exame '
               || 'clinico em ate 10 dias contados do termino do contrato. O sistema nao '
               || 'controla esse prazo em lugar nenhum — nao ha alerta, painel nem '
               || 'pendencia. Parte dos "sem data" pode ser dispensa legitima pelo exame '
               || 'anterior, mas o sistema tambem nao registra a dispensa, entao os dois '
               || 'casos ficam indistinguiveis. Correcao: gravar se houve dispensa e sua '
               || 'justificativa, e controlar o prazo dos demais. Observar que este prazo '
               || 'e da NR-07 e NAO se confunde com os 10 dias do art. 477, §6o da CLT: '
               || 'coincidem no numero, mas sao normas e penalidades diferentes.',
               v_desligados, v_sem_exame, v_fora_prazo);
    r.detalhe  := jsonb_build_object('desligamentos', v_desligados,
                                     'sem_exame', v_sem_exame, 'fora_do_prazo', v_fora_prazo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-091 — desligamentos sem evento na fila de transmissao.
-- Base: Decreto 8.373/2014 e MOS.
CREATE OR REPLACE FUNCTION public.qa_caso_desl_091()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_desligados int; v_com_log int; v_fila_existe boolean; v_na_fila int := 0;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): contar desligamentos e eventos correspondentes';
  r.esperado    := 'Todo desligamento celetista tem S-2299 na fila de transmissao';

  SELECT count(*) INTO v_desligados FROM public.admissoes
  WHERE status = 'desligado' AND data_desligamento IS NOT NULL;

  SELECT count(*) INTO v_com_log FROM public.audit_logs
  WHERE action = 'esocial_s2299_gerado';

  v_fila_existe := to_regclass('public.esocial_transmissoes') IS NOT NULL;
  IF v_fila_existe THEN
    EXECUTE 'SELECT count(*) FROM public.esocial_transmissoes WHERE tipo_evento ILIKE ''%2299%'''
      INTO v_na_fila;
  END IF;

  IF v_desligados = 0 THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nao ha desligamento registrado nesta base — nada a auditar. '
               || 'Rode novamente quando houver movimento.';
    RETURN r;
  END IF;

  IF v_na_fila >= v_desligados THEN
    r.situacao := 'passou';
    r.obtido   := format('%s desligamento(s) e %s evento(s) S-2299 na fila.', v_desligados, v_na_fila);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s desligamento(s) registrado(s); %s linha(s) de audit_log dizendo '
               || '"esocial_s2299_gerado"; %s evento(s) S-2299 na fila de transmissao. '
               || 'gerarEventoS2299 e funcao pura: monta o objeto e devolve, sem gravar. '
               || 'O componente registra o audit_log e manda o objeto para console.log. '
               || 'A fila esocial_transmissoes e alimentada por outra tela e por edge '
               || 'function propria — o evento gerado no desligamento nunca chega la. '
               || 'Somado a isso, a geracao esta dentro de try marcado como nao bloqueante: '
               || 'o desligamento persiste e o usuario ve sucesso mesmo se falhar. '
               || 'PERGUNTA PARA O TIME antes de corrigir: a tela de transmissao reconstroi '
               || 'o S-2299 a partir da admissao desligada? Se sim, o audit_log e ruido que '
               || 'induz a erro. Se nao, a obrigacao acessoria do Decreto 8.373/2014 nao e '
               || 'cumprida por este caminho.',
               v_desligados, v_com_log, v_na_fila);
    r.detalhe  := jsonb_build_object('desligamentos', v_desligados,
                                     'audit_logs_dizendo_gerado', v_com_log,
                                     'eventos_na_fila', v_na_fila,
                                     'fila_existe', v_fila_existe);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- DESL-104 — dados de ASO capturados em desligamento que nunca se concluiu.
-- Base: LGPD arts. 15 e 16; art. 5o, II (dado pessoal sensivel).
CREATE OR REPLACE FUNCTION public.qa_caso_desl_104()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_orfaos int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): dados medicos gravados sem desligamento concluido';
  r.esperado    := 'Nenhum — dado de saude so se justifica com a finalidade que o originou';

  SELECT count(*) INTO v_orfaos FROM public.admissoes
  WHERE status <> 'desligado'
    AND (data_exame_demissional IS NOT NULL
         OR resultado_exame_demissional IS NOT NULL
         OR medico_exame_demissional IS NOT NULL);

  IF v_orfaos = 0 THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhum dado de exame demissional em admissao nao desligada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s admissao(oes) com dados de exame demissional preenchidos mas '
               || 'SEM desligamento concluido. O ASO sobe e os campos sao gravados antes da '
               || 'confirmacao; se a transacao nao se completa, o dado medico permanece sem '
               || 'a finalidade que o justificava. Resultado de exame ocupacional e dado '
               || 'pessoal SENSIVEL (LGPD, art. 5o, II), e os arts. 15 e 16 exigem '
               || 'eliminacao ao termino do tratamento. Sem desligamento nao ha tratamento '
               || 'em curso, e nao ha prazo nem responsavel definidos para esse residuo. '
               || 'Mesma classe do vazamento de pastas fechado em 30/07/2026, com '
               || 'sensibilidade maior.', v_orfaos);
    r.detalhe  := jsonb_build_object('admissoes_com_dado_medico_orfao', v_orfaos);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- 5) Ligar caso <-> rotina
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('DESL-001','qa_caso_desl_001',true), ('DESL-002','qa_caso_desl_002',true),
  ('DESL-003','qa_caso_desl_003',true), ('DESL-004','qa_caso_desl_004',true),
  ('DESL-006','qa_caso_desl_006',true), ('DESL-065','qa_caso_desl_065',true),
  ('DESL-072','qa_caso_desl_072',true), ('DESL-073','qa_caso_desl_073',true),
  ('DESL-091','qa_caso_desl_091',true), ('DESL-101','qa_caso_desl_101',true),
  ('DESL-104','qa_caso_desl_104',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- ─────────────────────────────────────────────────────────
-- 6) Conferencia, execucao e RELATORIO DE FALHAS
-- ─────────────────────────────────────────────────────────
DO $confere$
DECLARE v_orfaos text;
BEGIN
  SELECT string_agg(ct.codigo, ', ' ORDER BY ct.codigo) INTO v_orfaos
  FROM public.qa_casos_teste ct
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
  WHERE m.path = 'estrutura-organizacional/colaboradores/desligamento'
    AND ct.status = 'aprovado' AND ct.nivel = 'api' AND i.funcao_sql IS NULL;

  IF v_orfaos IS NULL THEN
    RAISE NOTICE 'OK: todo caso api aprovado de Desligamento tem rotina.';
  ELSE
    RAISE WARNING 'Ainda sem rotina: %', v_orfaos;
  END IF;
END $confere$;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual','estrutura-organizacional/colaboradores/desligamento');
END $roda$;

-- RELATORIO PARA O DESENVOLVIMENTO
SELECT r.codigo,
       ct.prioridade::text AS prioridade,
       r.situacao::text    AS situacao,
       ct.titulo,
       ct.base_legal,
       r.obtido            AS achado_e_correcao_sugerida
FROM public.qa_resultados r
JOIN public.qa_casos_teste ct ON ct.codigo = r.codigo
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND r.situacao IN ('falhou','erro')
ORDER BY CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2
                            WHEN 'media' THEN 3 ELSE 4 END, r.codigo;

SELECT * FROM public.qa_verifica_vazamento();
