-- =========================================================
-- QA — Admissao: rotinas dos casos de banco (01/08/2026)
--
-- O centro desta migration sao as AUDITORIAS SOMENTE LEITURA do bloco de
-- arquivamento. Elas nao criam nada: leem a base real e devolvem o passivo
-- acumulado. E esse numero — quantos documentos ja estao hoje sem pasta e
-- sem dono — que sustenta a priorizacao do ADM-103.
--
-- MARCADOR USADO PELAS AUDITORIAS: o proprio fluxo de admissao grava
-- observacoes = 'Documento da admissão' ao inserir em public.documentos.
-- As auditorias usam esse marcador para nao contar documentos de outras
-- origens (SST, metas, terceiros), onde colaborador_id nulo pode ser
-- legitimo. Se o texto do marcador mudar no codigo, estas rotinas param de
-- enxergar — anotado aqui de proposito, porque acoplamento a texto livre e
-- fragil e deveria virar uma coluna de origem.
--
-- CINCO CASOS RECLASSIFICADOS para e2e, corrigindo excesso meu de 'api':
--   ADM-100 e ADM-104 dependem do hook de upload em TypeScript. Uma rotina
--   SQL que insira direto em admissao_documentos nao dispara a sincronizacao,
--   entao constataria ausencia causada pelo proprio metodo de teste.
--   ADM-010, ADM-011 e ADM-012 comparam comportamento entre dois formularios
--   React. Nenhuma rotina SQL abre formulario.
-- =========================================================

DO $recl$
DECLARE v_n int;
BEGIN
  UPDATE public.qa_casos_teste
  SET nivel = 'e2e',
      observacoes = observacoes || ' | RECLASSIFICADO 01/08/2026 (api -> e2e): '
        || 'depende de fluxo disparado pelo React (hook de upload ou comparacao entre '
        || 'formularios). Rotina SQL nao consegue exercita-lo; so constataria ausencia '
        || 'provocada pelo proprio metodo. Cobertura pertence ao Cypress.'
  WHERE codigo IN ('ADM-100','ADM-104','ADM-010','ADM-011','ADM-012') AND nivel = 'api';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Reclassificados para e2e: %.', v_n;
END $recl$;

-- ─────────────────────────────────────────────────────────
-- AUDITORIAS — somente leitura sobre a base real
-- ─────────────────────────────────────────────────────────

-- ADM-102 — documentos de admissao sem dono. O numero-chave.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_102()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ADM-101 — documentos de admissao fora de qualquer pasta.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_101()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ADM-103 — admissoes concluidas cujos documentos nunca foram reconciliados.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_103()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ADM-105 — documentos sem nenhuma versao registrada.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_105()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ADM-108 — arquivo enviado na admissao que nunca chegou ao modulo Documentos.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_108()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ADM-106 — documento gravado em tenant diferente do da admissao.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_106()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ADM-111 — documentos pessoais de admissoes que nao se concluiram.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_111()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_docs int; v_admissoes int;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao  := 'AUDITORIA (somente leitura): documentos pessoais retidos de admissoes nao concluidas';
  r.esperado    := 'Destino definido — eliminados ou retidos com prazo e justificativa';

  SELECT count(DISTINCT a.id), count(ad.id) INTO v_admissoes, v_docs
  FROM public.admissoes a
  JOIN public.admissao_documentos ad ON ad.admissao_id = a.id
  WHERE a.status IN ('reprovado','rejeitado')
    AND ad.arquivo_url IS NOT NULL AND btrim(ad.arquivo_url) <> '';

  IF v_docs = 0 THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhum documento retido de admissao reprovada ou rejeitada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('%s documento(s) pessoal(is) de %s admissao(oes) reprovada(s) ou '
               || 'rejeitada(s) continuam armazenados. A finalidade que autorizou a coleta '
               || 'deixou de existir (LGPD, art. 15, I e III), e o art. 16 exige eliminacao '
               || 'apos o termino do tratamento, ressalvada guarda obrigatoria. Nao ha no '
               || 'sistema prazo, responsavel nem registro de decisao sobre esse acervo. '
               || 'AGRAVANTE: como o ADM-102 mostra que esses documentos ficam sem '
               || 'colaborador_id e sem pasta, nao ha nem como localizar o conjunto de uma '
               || 'admissao especifica para elimina-lo. A falta de vinculo deixa de ser '
               || 'problema de organizacao e vira obstaculo ao cumprimento da lei.',
               v_docs, v_admissoes);
    r.detalhe  := jsonb_build_object('documentos_retidos', v_docs, 'admissoes', v_admissoes);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- eSOCIAL — verificacao de existencia
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qa_caso_adm_090()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_adm_091()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ─────────────────────────────────────────────────────────
-- CERCADO — rotinas que criam fixture
-- ─────────────────────────────────────────────────────────

-- ADM-002 — CPF duplicado entre admissoes.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_cpf text := '99900200002'; v_aceitou boolean := false; v_fmt boolean := false;
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
    VALUES (v_t, '[QA-ADM-002] Terceiro', '999.002.000-02', 'qa.adm002c@sandbox.invalid',
            'Operador', 'concluido', CURRENT_DATE);
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
               || 'eSocial, onde o CPF e a chave do trabalhador. Mesma raiz do COLAB-033, ja '
               || 'documentado: a comparacao e sobre a string crua, entao pontuacao diferente '
               || 'vira pessoa diferente. Correcao: normalizar o CPF na escrita e indice unico '
               || 'parcial sobre admissoes ativas — preservando a readmissao, que e legitima.',
               v_aceitou, v_fmt);
    r.detalhe  := jsonb_build_object('aceitou_cpf_cru', v_aceitou, 'aceitou_cpf_formatado', v_fmt);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ADM-003 — o checklist nao duplica (protege o indice unico ja instalado).
CREATE OR REPLACE FUNCTION public.qa_caso_adm_003()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_adm uuid; v_n int; v_duplicou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar admissao e o checklist de documentos';
  INSERT INTO public.admissoes (tenant_id, nome_completo, cpf, email, cargo, status, data_admissao)
  VALUES (v_t, '[QA-ADM-003] Colaborador', '99900200003', 'qa.adm003@sandbox.invalid',
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
END $$;

-- ADM-110 — a protecao de acesso aos documentos esta ligada.
CREATE OR REPLACE FUNCTION public.qa_caso_adm_110()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ─────────────────────────────────────────────────────────
-- Ligar caso <-> rotina
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('ADM-002','qa_caso_adm_002',true), ('ADM-003','qa_caso_adm_003',true),
  ('ADM-090','qa_caso_adm_090',true), ('ADM-091','qa_caso_adm_091',true),
  ('ADM-101','qa_caso_adm_101',true), ('ADM-102','qa_caso_adm_102',true),
  ('ADM-103','qa_caso_adm_103',true), ('ADM-105','qa_caso_adm_105',true),
  ('ADM-106','qa_caso_adm_106',true), ('ADM-108','qa_caso_adm_108',true),
  ('ADM-110','qa_caso_adm_110',true), ('ADM-111','qa_caso_adm_111',true)
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

DO $confere$
DECLARE v_orfaos text;
BEGIN
  SELECT string_agg(ct.codigo, ', ' ORDER BY ct.codigo) INTO v_orfaos
  FROM public.qa_casos_teste ct
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
  WHERE m.path = 'estrutura-organizacional/colaboradores/admissao'
    AND ct.status = 'aprovado' AND ct.nivel = 'api' AND i.funcao_sql IS NULL;
  IF v_orfaos IS NULL THEN
    RAISE NOTICE 'OK: todo caso api aprovado de Admissao tem rotina.';
  ELSE
    RAISE WARNING 'Ainda sem rotina: %', v_orfaos;
  END IF;
END $confere$;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual','estrutura-organizacional/colaboradores/admissao');
END $roda$;

-- RELATORIO PARA O DESENVOLVIMENTO
SELECT r.codigo, ct.prioridade::text AS prioridade, r.situacao::text AS situacao,
       ct.titulo, ct.base_legal, r.obtido AS achado_e_correcao_sugerida
FROM public.qa_resultados r
JOIN public.qa_casos_teste ct ON ct.codigo = r.codigo
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND r.situacao IN ('falhou','erro')
ORDER BY CASE ct.prioridade WHEN 'critica' THEN 1 WHEN 'alta' THEN 2
                            WHEN 'media' THEN 3 ELSE 4 END, r.codigo;

SELECT * FROM public.qa_verifica_vazamento();
