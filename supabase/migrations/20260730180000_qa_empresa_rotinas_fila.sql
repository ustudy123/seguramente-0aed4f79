-- =========================================================
-- QA — Empresa: rotinas da fila de banco (30/07/2026)
--
-- Contexto: a fila de casos aprovados de nivel api sem rotina voltou com 14
-- itens, todos documentados nesta mesma data. Nenhum caso antigo apareceu —
-- a documentacao anterior do modulo, embora incompleta, estava 100%
-- implementada. A divida nunca foi de rotina, era de documentacao.
--
-- Esta migration faz tres coisas:
--
--   1) RECLASSIFICA 6 casos REGRA de 'api' para 'e2e'.
--      Erro meu na migration das 14h. Classifiquei REGRA-007/008/009/012/
--      013/014 como 'api' seguindo o precedente de REGRA-001..006 — e o
--      precedente e que esta torto. A geracao de obrigacoes vive INTEIRA em
--      OBRIGACOES_TEMPLATES (TypeScript) e so materializa registro quando
--      alguem clica em "Gerar Obrigacoes" na aba. Nao existe funcao nem
--      trigger que gere obrigacao no banco. Uma rotina SQL nunca consegue
--      DISPARAR a geracao; so consegue constatar que nao aconteceu.
--      Escrever as 6 produziria seis falhas identicas apontando para o
--      mesmo fato arquitetural que REGRA-001..006 ja registram — o mesmo
--      sinal seis vezes mais alto, nao seis sinais.
--      REGRA-001 a 006 ficam INTOCADAS de proposito: sao anteriores e
--      mexer nelas mudaria placar historico. Decisao em aberto.
--
--   2) CORRIGE a helper qa_obrigacao_existe, que recebe p_empresa e nunca
--      o usa — filtra so por tenant e subcategoria. Hoje nao causa dano
--      porque o funil desfaz cada rotina, mas e trava decorativa: mesma
--      classe do ON CONFLICT DO NOTHING sem indice unico, ja encontrado
--      duas vezes neste sistema. Parametro que nao e usado e promessa que
--      nao e cumprida.
--
--   3) ESCREVE AS 8 ROTINAS restantes, todas de comportamento real de banco.
--
-- EXPECTATIVA DE PLACAR, dita antes de rodar: tres devem FALHAR e cinco
-- devem passar. HIER-006 e HIER-005 porque matriz_id e FK simples, sem
-- checagem de tenant e sem protecao de ciclo. PORTE-005 provavelmente
-- passa, mas com um achado no passo 3 (ver comentario da rotina).
-- Falha aqui e deteccao, nao defeito.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) Reclassificacao das REGRA novas
-- ─────────────────────────────────────────────────────────
DO $recl$
DECLARE v_n int;
BEGIN
  UPDATE public.qa_casos_teste
  SET nivel = 'e2e',
      observacoes = observacoes || ' | RECLASSIFICADO 30/07/2026 (api -> e2e): '
        || 'a geracao de obrigacoes vive em OBRIGACOES_TEMPLATES (TypeScript) '
        || 'e depende do clique em "Gerar Obrigacoes". Nao ha funcao nem '
        || 'trigger que produza obrigacao no banco, entao nenhuma rotina SQL '
        || 'consegue disparar a regra — so constatar a ausencia. A cobertura '
        || 'pertence ao Cypress. Se um dia a geracao migrar para o banco '
        || '(trigger ou funcao), estes casos voltam para api e ganham rotina.'
  WHERE codigo IN ('REGRA-007','REGRA-008','REGRA-009',
                   'REGRA-012','REGRA-013','REGRA-014')
    AND nivel = 'api';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Reclassificados para e2e: % casos.', v_n;
END $recl$;

-- ─────────────────────────────────────────────────────────
-- 2) Helper: passar a usar o parametro que sempre recebeu
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_obrigacao_existe(
  p_empresa uuid, p_subcategoria text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_existe boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.empresa_obrigacoes
     WHERE tenant_id    = public.qa_sandbox_tenant_id()
       AND empresa_id   = p_empresa          -- <— o parametro passa a valer
       AND subcategoria = p_subcategoria
       AND origem       = 'cadastro_empresa'
  ) INTO v_existe;
  RETURN v_existe;
END $$;

COMMENT ON FUNCTION public.qa_obrigacao_existe(uuid, text) IS
  'Confere se a obrigacao de uma subcategoria existe PARA AQUELA EMPRESA. '
  'Ate 30/07/2026 o parametro p_empresa era ignorado e a busca pegava '
  'qualquer obrigacao do tenant — o funil mascarava o efeito.';

-- ─────────────────────────────────────────────────────────
-- 3) Rotinas
-- ─────────────────────────────────────────────────────────

-- EMP-023 — duplicata INATIVA do mesmo CNPJ e permitida.
-- Caso de protecao: garante que uma correcao futura da trigger nao passe a
-- barrar mais do que a regra pede e quebre o fluxo de desativar/recadastrar.
CREATE OR REPLACE FUNCTION public.qa_caso_emp_023()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cnpj text := '11555666000301';
  v_e1 uuid; v_e2 uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar empresa ATIVA com CNPJ ' || v_cnpj;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-023] Empresa Ativa', v_cnpj, true) RETURNING id INTO v_e1;

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar segunda empresa com o MESMO CNPJ, porem INATIVA';
  r.esperado    := 'ACEITO — a trigger so age sobre registro ativo';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
    VALUES (v_t, '[QA-EMP-023] Empresa Inativa', v_cnpj, false) RETURNING id INTO v_e2;
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'falhou';
    r.obtido   := 'RECUSOU a duplicata inativa. A trava ficou mais restritiva que a '
               || 'regra: desativar e recadastrar deixa de funcionar, e esse e o '
               || 'caminho que o proprio sistema recomenda para resolver CNPJ repetido.';
    r.erro_tecnico := SQLERRM;
    RETURN r;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Contar registros com este CNPJ no cercado';
  SELECT count(*) INTO v_n FROM public.empresa_cadastro
  WHERE tenant_id = v_t AND cnpj = v_cnpj;

  r.passo_ordem := 4;
  r.passo_acao  := 'Tentar ATIVAR a segunda enquanto a primeira segue ativa';
  r.esperado    := 'Recusado — a exclusividade e da ativacao, nao do cadastro';
  BEGIN
    UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_e2;
    r.situacao := 'falhou';
    r.obtido   := format('Historico convive (%s registros), MAS a ativacao da segunda '
               || 'foi aceita. As duas estao ativas com o mesmo CNPJ — a regra do '
               || 'EMP-020 nao esta valendo no UPDATE de ativo.', v_n);
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou';
    r.obtido   := format('Duplicata inativa aceita (%s registros com o CNPJ) e a '
               || 'ativacao da segunda foi recusada. Historico convive, so a '
               || 'ativacao e exclusiva.', v_n);
  END;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- EMP-024 — desativar preserva vinculos e dados.
-- Importa porque desativar e a saida recomendada para resolver CNPJ
-- duplicado (EMP-020). Se destruisse vinculo, o caminho sugerido pelo
-- proprio sistema causaria perda de historico.
CREATE OR REPLACE FUNCTION public.qa_caso_emp_024()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pessoa uuid;
  v_antes int; v_depois int; v_reativada boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('EMP-024');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar empresa ativa com um colaborador vinculado';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-024] Empresa Com Vinculo', '11555666000302', true)
  RETURNING id INTO v_emp;

  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-EMP-024] Colaborador', public.qa_fixture_email('EMP-024', 1),
          '99900002401', 'colaborador', 'ativo')
  RETURNING id INTO v_pessoa;

  INSERT INTO public.usuario_vinculos
    (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_pessoa, v_emp, 'colaborador', 'ativo');

  SELECT count(*) INTO v_antes FROM public.usuario_vinculos WHERE empresa_id = v_emp;

  r.passo_ordem := 2;
  r.passo_acao  := 'Desativar a empresa';
  r.esperado    := 'Aceito, sem destruir nada';
  UPDATE public.empresa_cadastro SET ativo = false WHERE id = v_emp;

  r.passo_ordem := 3;
  r.passo_acao  := 'Reconferir os vinculos';
  SELECT count(*) INTO v_depois FROM public.usuario_vinculos WHERE empresa_id = v_emp;

  IF v_depois <> v_antes THEN
    r.situacao := 'falhou';
    r.obtido   := format('Desativar a empresa alterou os vinculos: %s antes, %s depois. '
               || 'Desativacao esta destruindo dado — e ela e o caminho recomendado '
               || 'para resolver CNPJ duplicado.', v_antes, v_depois);
    PERFORM public.qa_fixture_limpar('EMP-024');
    RETURN r;
  END IF;

  r.passo_ordem := 4;
  r.passo_acao  := 'Reativar a empresa';
  r.esperado    := 'Volta ao estado anterior sem perda';
  UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_emp;
  SELECT ativo INTO v_reativada FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_reativada AND v_depois = v_antes THEN
    r.situacao := 'passou';
    r.obtido   := format('Desativacao reversivel: %s vinculo(s) intacto(s) durante todo '
               || 'o ciclo e empresa reativada sem perda.', v_antes);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A empresa nao voltou ao estado ativo apos a reativacao.';
  END IF;

  PERFORM public.qa_fixture_limpar('EMP-024');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- EMP-025 — empresa com vinculo nao pode ser apagada.
-- O hook expoe delete(); a trava precisa estar no banco (ON DELETE RESTRICT).
CREATE OR REPLACE FUNCTION public.qa_caso_emp_025()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pessoa uuid; v_apagou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('EMP-025');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar empresa com colaborador vinculado';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-025] Empresa Protegida', '11555666000303', true)
  RETURNING id INTO v_emp;

  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-EMP-025] Colaborador', public.qa_fixture_email('EMP-025', 1),
          '99900002501', 'colaborador', 'ativo')
  RETURNING id INTO v_pessoa;

  INSERT INTO public.usuario_vinculos
    (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_pessoa, v_emp, 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar apagar a empresa';
  r.esperado    := 'Recusado por foreign_key_violation (ON DELETE RESTRICT)';
  BEGIN
    DELETE FROM public.empresa_cadastro WHERE id = v_emp;
    v_apagou := true;
  EXCEPTION
    WHEN foreign_key_violation THEN v_apagou := false;
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
      PERFORM public.qa_fixture_limpar('EMP-025');
      RETURN r;
  END;

  IF v_apagou THEN
    r.situacao := 'falhou';
    r.obtido   := 'APAGOU a empresa que tinha vinculo. O historico do colaborador ficou '
               || 'orfao ou foi em cascata junto. O hook expoe delete() na interface, '
               || 'entao esta e uma rota alcancavel pela tela.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco. O ON DELETE RESTRICT protege o historico de '
               || 'pessoa contra exclusao de empresa.';
  END IF;

  PERFORM public.qa_fixture_limpar('EMP-025');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- EMP-060 — criar empresa vincula todos os administradores do tenant.
-- O passo 4 so passou a significar algo em 15/07/2026: o ON CONFLICT DO
-- NOTHING desta trigger era no-op desde maio, por falta de indice unico.
CREATE OR REPLACE FUNCTION public.qa_caso_emp_060()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_admins int; v_vinc int; v_dup int; v_duplicou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('EMP-060');

  r.passo_ordem := 1;
  r.passo_acao  := 'Garantir dois administradores no cercado';
  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES
    (v_t, '[QA-EMP-060] Admin Um', public.qa_fixture_email('EMP-060', 1), '99900006001', 'administrador', 'ativo'),
    (v_t, '[QA-EMP-060] Admin Dois', public.qa_fixture_email('EMP-060', 2), '99900006002', 'administrador', 'ativo');

  SELECT count(*) INTO v_admins FROM public.usuarios_base
  WHERE tenant_id = v_t AND tipo_usuario = 'administrador';

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar empresa nova';
  r.esperado    := format('Um vinculo administrador ativo para cada um dos %s admins', v_admins);
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-060] Empresa Nova', '11555666000306', true)
  RETURNING id INTO v_emp;

  r.passo_ordem := 3;
  r.passo_acao  := 'Contar os vinculos criados automaticamente';
  SELECT count(*) INTO v_vinc FROM public.usuario_vinculos
  WHERE empresa_id = v_emp AND tipo_vinculo = 'administrador' AND status = 'ativo';

  IF v_vinc <> v_admins THEN
    r.situacao := 'falhou';
    r.obtido   := format('O tenant tem %s administrador(es), mas a empresa nova recebeu '
               || '%s vinculo(s). Admin sem vinculo nao enxerga a empresa e o problema '
               || 'so aparece quando alguem reclama de acesso.', v_admins, v_vinc);
    PERFORM public.qa_fixture_limpar('EMP-060');
    RETURN r;
  END IF;

  r.passo_ordem := 4;
  r.passo_acao  := 'Tentar criar um vinculo administrador repetido, como a trigger faria num reprocessamento';
  r.esperado    := 'Recusado pelo indice unico — e o que sustenta o ON CONFLICT DO NOTHING';
  BEGIN
    INSERT INTO public.usuario_vinculos
      (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    SELECT v_t, ub.id, v_emp, 'administrador', 'ativo'
    FROM public.usuarios_base ub
    WHERE ub.tenant_id = v_t AND ub.tipo_usuario = 'administrador'
    LIMIT 1;
    v_duplicou := true;
  EXCEPTION WHEN unique_violation THEN v_duplicou := false;
  END;

  SELECT count(*) INTO v_dup FROM public.usuario_vinculos
  WHERE empresa_id = v_emp AND tipo_vinculo = 'administrador' AND status = 'ativo';

  IF NOT v_duplicou AND v_dup = v_admins THEN
    r.situacao := 'passou';
    r.obtido   := format('%s administrador(es) vinculado(s) automaticamente, e a tentativa '
               || 'de repetir o vinculo foi recusada pelo indice unico. O ON CONFLICT DO '
               || 'NOTHING da trigger esta apoiado no indice instalado em 15/07/2026 — '
               || 'antes disso era decorativo.', v_admins);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Vinculo administrador duplicado foi ACEITO: a contagem foi de %s '
               || 'para %s. O ON CONFLICT DO NOTHING da trigger nao tem indice unico que '
               || 'o sustente e voltou a ser decorativo.', v_admins, v_dup);
  END IF;

  PERFORM public.qa_fixture_limpar('EMP-060');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- EMP-061 — criar empresa gera a estrutura de pastas.
-- A trigger engole excecao (RAISE WARNING e RETURN NEW): se falhar, a
-- empresa nasce mesmo assim, sem pastas, e o sintoma so aparece semanas
-- depois no modulo de documentos, longe da causa.
CREATE OR REPLACE FUNCTION public.qa_caso_emp_061()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pastas int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar empresa nova';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-EMP-061] Empresa Com Pastas', '11555666000307', true)
  RETURNING id INTO v_emp;

  r.passo_ordem := 2;
  r.passo_acao  := 'Contar as pastas geradas para a empresa';
  r.esperado    := 'Estrutura padrao criada, nao vazia';
  SELECT count(*) INTO v_pastas FROM public.documento_pastas WHERE empresa_id = v_emp;

  IF v_pastas > 0 THEN
    r.situacao := 'passou';
    r.obtido   := format('%s pasta(s) criada(s) automaticamente.', v_pastas);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Empresa criada SEM nenhuma pasta. A trigger trg_auto_gerar_pastas_empresa '
               || 'engole a excecao (RAISE WARNING + RETURN NEW), entao a falha e '
               || 'silenciosa: o cadastro conclui normalmente e o problema so aparece '
               || 'depois, no modulo de documentos. Existe reconciliar_pastas_todas_empresas() '
               || 'para remediar, mas alguem precisa saber que deve rodar.';
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- HIER-005 — ciclo entre matriz e filial.
-- A tela apenas remove a propria empresa da lista de matrizes, o que cobre
-- so a auto-referencia. Ciclo de dois e de tres niveis deve passar.
CREATE OR REPLACE FUNCTION public.qa_caso_hier_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_a uuid; v_b uuid; v_c uuid;
  v_ciclo2 boolean := false; v_auto boolean := false; v_ciclo3 boolean := false;
  v_falhas text := '';
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar tres empresas e tornar A filial de B';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo, tipo_unidade)
  VALUES (v_t, '[QA-HIER-005] Empresa A', '11555666000311', true, 'matriz') RETURNING id INTO v_a;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo, tipo_unidade)
  VALUES (v_t, '[QA-HIER-005] Empresa B', '11555666000312', true, 'matriz') RETURNING id INTO v_b;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo, tipo_unidade)
  VALUES (v_t, '[QA-HIER-005] Empresa C', '11555666000313', true, 'matriz') RETURNING id INTO v_c;

  UPDATE public.empresa_cadastro SET tipo_unidade = 'filial', matriz_id = v_b WHERE id = v_a;

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar tornar B filial de A (ciclo de dois niveis)';
  r.esperado    := 'Recusado — criaria ciclo';
  BEGIN
    UPDATE public.empresa_cadastro SET tipo_unidade = 'filial', matriz_id = v_a WHERE id = v_b;
    v_ciclo2 := true;
    UPDATE public.empresa_cadastro SET tipo_unidade = 'matriz', matriz_id = NULL WHERE id = v_b;
  EXCEPTION WHEN OTHERS THEN v_ciclo2 := false;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Tentar fazer uma empresa ser filial de si mesma';
  r.esperado    := 'Recusado';
  BEGIN
    UPDATE public.empresa_cadastro SET tipo_unidade = 'filial', matriz_id = v_c WHERE id = v_c;
    v_auto := true;
    UPDATE public.empresa_cadastro SET tipo_unidade = 'matriz', matriz_id = NULL WHERE id = v_c;
  EXCEPTION WHEN OTHERS THEN v_auto := false;
  END;

  r.passo_ordem := 4;
  r.passo_acao  := 'Tentar ciclo de tres niveis (A -> B -> C -> A)';
  r.esperado    := 'Recusado';
  BEGIN
    UPDATE public.empresa_cadastro SET tipo_unidade = 'filial', matriz_id = v_c WHERE id = v_b;
    UPDATE public.empresa_cadastro SET tipo_unidade = 'filial', matriz_id = v_a WHERE id = v_c;
    v_ciclo3 := true;
  EXCEPTION WHEN OTHERS THEN v_ciclo3 := false;
  END;

  IF v_ciclo2 THEN v_falhas := v_falhas || 'ciclo de 2 niveis aceito; '; END IF;
  IF v_auto   THEN v_falhas := v_falhas || 'auto-referencia aceita; '; END IF;
  IF v_ciclo3 THEN v_falhas := v_falhas || 'ciclo de 3 niveis aceito; '; END IF;

  IF v_falhas = '' THEN
    r.situacao := 'passou';
    r.obtido   := 'Nenhuma das tres formas de ciclo foi aceita. A arvore de unidades '
               || 'esta protegida no banco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'A arvore de unidades aceita ciclo: ' || v_falhas
               || 'nao ha constraint nem trigger de ciclo em matriz_id, que e FK '
               || 'simples para empresa_cadastro. A tela so remove a propria empresa '
               || 'da lista de matrizes, o que nao alcanca ciclo de dois ou mais '
               || 'niveis. Qualquer travessia recursiva por grupo entra em laco.';
    r.detalhe  := jsonb_build_object('ciclo_2_niveis', v_ciclo2,
                                     'auto_referencia', v_auto,
                                     'ciclo_3_niveis', v_ciclo3);
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- HIER-006 — filial nao pode apontar matriz de outro cliente.
-- matriz_id e FK simples para empresa_cadastro, sem nenhuma checagem de
-- tenant. A RLS protege LEITURA; nada garante que a ESCRITA respeite a
-- fronteira do cliente.
-- Nota de seguranca: a rotina apenas LE o id de uma empresa fora do cercado
-- para usar como alvo. Nenhuma escrita acontece fora do cercado, e o funil
-- descarta tudo ao final.
CREATE OR REPLACE FUNCTION public.qa_caso_hier_006()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_filial uuid; v_alheia uuid; v_gravou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Localizar uma empresa de OUTRO tenant para usar como alvo';
  SELECT id INTO v_alheia FROM public.empresa_cadastro
  WHERE tenant_id IS DISTINCT FROM v_t LIMIT 1;

  IF v_alheia IS NULL THEN
    r.situacao := 'nao_implementado';
    r.obtido   := 'Nao existe empresa fora do cercado nesta base, entao o isolamento '
               || 'entre clientes nao pode ser exercitado aqui. Rode em base com mais '
               || 'de um tenant.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar filial dentro do cercado';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo, tipo_unidade)
  VALUES (v_t, '[QA-HIER-006] Filial', '11555666000321', true, 'filial')
  RETURNING id INTO v_filial;

  r.passo_ordem := 3;
  r.passo_acao  := 'Apontar matriz_id para a empresa de outro cliente';
  r.esperado    := 'Recusado — hierarquia nao atravessa a fronteira do cliente';
  BEGIN
    UPDATE public.empresa_cadastro SET matriz_id = v_alheia WHERE id = v_filial;
    v_gravou := EXISTS (SELECT 1 FROM public.empresa_cadastro
                        WHERE id = v_filial AND matriz_id = v_alheia);
  EXCEPTION WHEN OTHERS THEN v_gravou := false;
  END;

  IF v_gravou THEN
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU. Uma filial do cercado esta apontando como matriz uma '
               || 'empresa de outro cliente. matriz_id e FK simples para '
               || 'empresa_cadastro, sem checagem de tenant — a RLS protege a LEITURA, '
               || 'mas nada valida a ESCRITA. Consequencia: estrutura societaria de um '
               || 'cliente aparece pendurada na de outro em qualquer consulta que suba '
               || 'a arvore. Correcao: trigger validando que matriz_id pertence ao mesmo '
               || 'tenant, ou FK composta (tenant_id, matriz_id).';
    r.detalhe  := jsonb_build_object('filial_no_cercado', v_filial,
                                     'matriz_fora_do_cercado', v_alheia);
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Recusado. A hierarquia respeita a fronteira entre clientes na escrita.';
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- PORTE-005 — contagem do porte.
-- Espelha exatamente o filtro do usePorteEmpresa: status concluido, nao
-- inativo, por empresa. Ver o achado do passo 3 na mensagem da rotina.
CREATE OR REPLACE FUNCTION public.qa_caso_porte_005()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_outra uuid; v_conta int; v_nulo_permitido boolean;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar duas empresas e povoar admissoes em varios estados';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-PORTE-005] Empresa Alvo', '11555666000331', true) RETURNING id INTO v_emp;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, ativo)
  VALUES (v_t, '[QA-PORTE-005] Outra Empresa', '11555666000332', true) RETURNING id INTO v_outra;

  INSERT INTO public.admissoes
    (tenant_id, empresa_id, nome_completo, cpf, email, cargo, status, inativo)
  VALUES
    (v_t, v_emp,   '[QA-PORTE-005] Conta 1',   '99900050001', 'p1@sandbox.invalid', 'Operador', 'concluido', false),
    (v_t, v_emp,   '[QA-PORTE-005] Conta 2',   '99900050002', 'p2@sandbox.invalid', 'Operador', 'concluido', false),
    (v_t, v_emp,   '[QA-PORTE-005] Inativa',   '99900050003', 'p3@sandbox.invalid', 'Operador', 'concluido', true),
    (v_t, v_emp,   '[QA-PORTE-005] Em Curso',  '99900050004', 'p4@sandbox.invalid', 'Operador', 'em_analise', false),
    (v_t, v_outra, '[QA-PORTE-005] Vizinha',   '99900050005', 'p5@sandbox.invalid', 'Operador', 'concluido', false);

  r.passo_ordem := 2;
  r.passo_acao  := 'Contar com o mesmo criterio do usePorteEmpresa';
  r.esperado    := 'Exatamente 2 — so concluidas, nao inativas, da propria empresa';
  SELECT count(*) INTO v_conta FROM public.admissoes
  WHERE tenant_id = v_t AND empresa_id = v_emp
    AND status = 'concluido'
    AND (inativo IS NULL OR inativo = false);

  IF v_conta <> 2 THEN
    r.situacao := 'falhou';
    r.obtido   := format('Esperava 2 e contei %s. Inativa, em andamento ou de outra '
               || 'empresa entrou na conta — o porte sai errado e o Plano de Acao do '
               || 'PGR dimensiona estrutura errada.', v_conta);
    RETURN r;
  END IF;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir se inativo pode ser NULL no banco';
  r.esperado    := 'A coluna e NOT NULL — o ramo NULL do front e defensivo, nao real';
  SELECT NOT a.attnotnull INTO v_nulo_permitido
  FROM pg_attribute a
  WHERE a.attrelid = 'public.admissoes'::regclass AND a.attname = 'inativo';

  IF v_nulo_permitido THEN
    r.situacao := 'falhou';
    r.obtido   := 'A coluna admissoes.inativo ACEITA NULL. O filtro do front trata NULL '
               || 'como ativo, entao a contagem so esta correta por causa desse ramo — '
               || 'ele passou a ser carga estrutural. Quem simplificar para inativo = '
               || 'false exclui todo registro com NULL e derruba o porte da empresa uma '
               || 'categoria inteira, em silencio.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := 'Contagem correta (2). ACHADO: admissoes.inativo e NOT NULL DEFAULT '
               || 'false, entao o ramo "inativo IS NULL" do usePorteEmpresa protege um '
               || 'estado que o banco ja impede. E codigo defensivo inofensivo hoje, '
               || 'mas o comentario no hook ("pode ser null em registros antigos") '
               || 'descreve uma realidade que nao existe — vale corrigir o comentario '
               || 'ou remover o ramo, para nao induzir a proxima leitura ao erro.';
    r.detalhe  := jsonb_build_object('contagem', v_conta, 'inativo_aceita_null', false);
  END IF;

  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ─────────────────────────────────────────────────────────
-- 4) Ligar caso <-> rotina
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('EMP-023',   'qa_caso_emp_023',   true),
  ('EMP-024',   'qa_caso_emp_024',   true),
  ('EMP-025',   'qa_caso_emp_025',   true),
  ('EMP-060',   'qa_caso_emp_060',   true),
  ('EMP-061',   'qa_caso_emp_061',   true),
  ('HIER-005',  'qa_caso_hier_005',  true),
  ('HIER-006',  'qa_caso_hier_006',  true),
  ('PORTE-005', 'qa_caso_porte_005', true)
ON CONFLICT (codigo) DO UPDATE
  SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- ─────────────────────────────────────────────────────────
-- 5) Conferencia e execucao
-- ─────────────────────────────────────────────────────────
DO $confere$
DECLARE v_orfaos text;
BEGIN
  SELECT string_agg(ct.codigo, ', ' ORDER BY ct.codigo) INTO v_orfaos
  FROM public.qa_casos_teste ct
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
  WHERE m.path = 'estrutura-organizacional/empresa'
    AND ct.status = 'aprovado' AND ct.nivel = 'api'
    AND i.funcao_sql IS NULL;

  IF v_orfaos IS NULL THEN
    RAISE NOTICE 'OK: todo caso aprovado de nivel api em Empresa tem rotina.';
  ELSE
    RAISE WARNING 'Ainda sem rotina em Empresa: %', v_orfaos;
  END IF;
END $confere$;

DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/empresa');
END $roda$;

SELECT r.codigo,
       r.situacao::text AS situacao,
       COALESCE(left(r.obtido, 100), '') AS o_que_aconteceu
FROM public.qa_resultados r
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
  AND r.codigo IN ('EMP-023','EMP-024','EMP-025','EMP-060','EMP-061',
                   'HIER-005','HIER-006','PORTE-005')
ORDER BY (r.situacao <> 'passou') DESC, r.codigo;

SELECT * FROM public.qa_verifica_vazamento();
