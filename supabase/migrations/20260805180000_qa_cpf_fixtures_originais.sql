-- =========================================================
-- QA — Últimas fixtures com CPF literal (31/07/2026)
--
-- A migration 20260805090000 converteu as 14 rotinas que EU havia escrito.
-- A conferência ao final dela, que procura CPF literal em qualquer rotina de
-- QA, revelou outras 14 — todas da suíte original, anteriores a este
-- trabalho: COLAB-001, 012, 020, 024 a 029, 035, 036, ADM-001, EPI-001 e
-- TER-002.
--
-- POR QUE MIGRAR SE ELAS PASSARAM: passaram por acaso. Os CPFs literais
-- delas satisfazem o dígito verificador que o banco passou a exigir; se a
-- validação apertar mais — e o COLAB-021 mostra que ela ainda vai apertar,
-- pela regra dos dígitos repetidos — param todas de uma vez, exatamente
-- como aconteceu com as minhas. Lista fixa de CPF é dívida latente, não
-- defeito ausente.
--
-- Regeradas programaticamente a partir das definições versionadas,
-- trocando apenas o literal por qa_cpf(semente). Nenhuma alteração de
-- lógica. As sementes preservam os números originais, então as fixtures
-- continuam rastreáveis nos registros já existentes.
--
-- Ao final, a suíte inteira fica sem um único CPF literal.
-- =========================================================

SET lock_timeout = '10s';

DO $pre$
BEGIN
  IF to_regprocedure('public.qa_cpf(integer)') IS NULL THEN
    RAISE EXCEPTION 'qa_cpf(int) nao existe. Aplique 20260805090000_qa_cpf_fixtures.sql antes.';
  END IF;
END $pre$;

-- ─────────────────────────────────────────────────────────
-- Rotinas da suíte original, regeradas
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.qa_caso_adm_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_p uuid; v_v uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-001');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar colaborador com nome, CPF e e-mail';
  r.esperado    := 'Pessoa criada com 1 vinculo ativo na empresa Alfa';

  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-001] Colaborador Base', public.qa_fixture_email('COLAB-001', 1),
          public.qa_cpf(188), 'colaborador', 'ativo')
  RETURNING id INTO v_p;

  r.passo_ordem := 2;
  r.passo_acao  := 'Vincular a pessoa a empresa Alfa como colaborador';

  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, public.qa_empresa('[QA] Alfa'), 'colaborador', 'ativo')
  RETURNING id INTO v_v;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir que existe exatamente 1 vinculo vigente';

  SELECT count(*) INTO v_n FROM public.usuario_vinculos
  WHERE usuario_id = v_p AND status IN ('ativo','pendente','suspenso');

  IF v_n = 1 THEN
    r.situacao := 'passou';
    r.obtido   := 'Pessoa e vinculo criados. 1 vinculo vigente.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Esperava 1 vinculo vigente, encontrou %s.', v_n);
  END IF;

  r.detalhe := jsonb_build_object('usuario_id', v_p, 'vinculo_id', v_v);
  PERFORM public.qa_fixture_limpar('COLAB-001');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_012()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar pessoa e vincular a Alfa';
  r.esperado := 'Pessoa unica com 2 vinculos, um por empresa';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-012] Multi', 'qa.012.1@sandbox.invalid', public.qa_cpf(692), 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, public.qa_empresa('[QA] Alfa'), 'colaborador', 'ativo');
  r.passo_ordem := 2; r.passo_acao := 'Vincular a MESMA pessoa a Beta';
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, public.qa_empresa('[QA] Beta'), 'colaborador', 'ativo');
  SELECT count(*) INTO v_n FROM public.usuario_vinculos WHERE usuario_id = v_p AND status = 'ativo';
  IF v_n = 2 THEN r.situacao := 'passou'; r.obtido := '1 pessoa, 2 vinculos (Alfa e Beta).';
  ELSE r.situacao := 'falhou'; r.obtido := format('Esperava 2 vinculos, achou %s.', v_n); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_020()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-020');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar a primeira pessoa com o CPF 999.000.002-69';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-020] Pessoa Original', public.qa_fixture_email('COLAB-020', 1),
          public.qa_cpf(269), 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar cadastrar OUTRA pessoa com o MESMO CPF no mesmo cliente';
  r.esperado    := 'Recusado — usuarios_base_cpf_tenant_uidx impede CPF repetido por cliente';

  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-COLAB-020] Pessoa Duplicada', public.qa_fixture_email('COLAB-020', 2),
            public.qa_cpf(269), 'colaborador', 'ativo');
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU. O indice de CPF por cliente nao esta protegendo — a mesma pessoa existe duas vezes.';
  EXCEPTION
    WHEN unique_violation THEN
      r.situacao := 'passou';
      r.obtido   := 'Recusado com unique_violation, como o caso descreve.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  PERFORM public.qa_fixture_limpar('COLAB-020');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_024()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t1 uuid := public.qa_sandbox_tenant_id();
  v_t2 uuid := public.qa_sandbox2_tenant_id();
  v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN
    r.situacao := 'erro'; r.obtido := 'Segundo cercado nao existe.'; RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao := 'Criar colaborador no cercado 1';
  r.esperado := 'Consultando o tenant 2, o colaborador do tenant 1 NAO aparece';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t1, '[QA-024] Secreto do Tenant 1', 'qa.024.1@sandbox.invalid', public.qa_cpf(188), 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao := 'Contar, filtrando pelo tenant 2, quantos veem esse colaborador';
  -- Simula a consulta que uma funcao isolada por tenant faria: filtra por tenant_id.
  SELECT count(*) INTO v_vis
  FROM public.usuarios_base
  WHERE tenant_id = v_t2 AND email_principal = 'qa.024.1@sandbox.invalid';

  IF v_vis = 0 THEN
    r.situacao := 'passou';
    r.obtido := 'O colaborador do tenant 1 e invisivel para o tenant 2. Fronteira respeitada.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('VAZAMENTO: %s registro(s) do tenant 1 visiveis pelo tenant 2.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_025()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_p uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa');
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-025');

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar colaborador com vinculo ativo na Alfa';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-025] Pessoa', public.qa_fixture_email('COLAB-025', 1),
          public.qa_cpf(340), 'colaborador', 'ativo')
  RETURNING id INTO v_p;

  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar criar um SEGUNDO vinculo de colaborador ativo na MESMA empresa';
  r.esperado    := 'Recusado por usuario_vinculos_vigente_uidx (instalado em 15/07/2026)';

  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');
    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU o segundo vinculo. O indice unico sumiu ou foi alterado — a duplicata voltou a ser possivel.';
  EXCEPTION
    WHEN unique_violation THEN
      r.situacao := 'passou';
      r.obtido   := 'Recusado com unique_violation. A trava esta de pe.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  PERFORM public.qa_fixture_limpar('COLAB-025');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_026()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_p uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-026');

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar pessoa com vinculo ativo na Alfa';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-026] Pessoa Duas Empresas', public.qa_fixture_email('COLAB-026', 1),
          public.qa_cpf(420), 'colaborador', 'ativo')
  RETURNING id INTO v_p;

  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, public.qa_empresa('[QA] Alfa'), 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Vincular a MESMA pessoa a empresa Beta, do mesmo cliente';
  r.esperado    := 'ACEITO — a regra proibe duplicar DENTRO da empresa, nao entre empresas';

  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, public.qa_empresa('[QA] Beta'), 'colaborador', 'ativo');

    SELECT count(*) INTO v_n FROM public.usuario_vinculos
    WHERE usuario_id = v_p AND status IN ('ativo','pendente','suspenso');

    IF v_n = 2 THEN
      r.situacao := 'passou';
      r.obtido   := '2 vinculos vigentes, um por empresa. Uma pessoa, dois vinculos.';
    ELSE
      r.situacao := 'falhou';
      r.obtido   := format('Esperava 2 vinculos vigentes, encontrou %s.', v_n);
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      r.situacao := 'falhou';
      r.obtido   := 'RECUSOU. A chave do indice esta larga demais — provavelmente sem empresa_id, barrando o que deveria permitir.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  PERFORM public.qa_fixture_limpar('COLAB-026');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_027()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa');
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar colaborador e suspender o vinculo';
  r.esperado := 'Novo vinculo na mesma empresa e recusado enquanto suspenso';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-027] Suspenso', 'qa.027.1@sandbox.invalid', public.qa_cpf(269), 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'suspenso');
  r.passo_ordem := 2; r.passo_acao := 'Tentar novo vinculo ativo na mesma empresa';
  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU segundo vinculo enquanto o primeiro esta suspenso — suspenso deveria ocupar a vaga.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: suspenso ocupa a vaga, como a regra diz.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_028()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_v uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_di date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar vinculo suspenso';
  r.esperado := 'Voltar de suspenso para ativo e aceito (mesmo vinculo, sem colisao)';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-028] Retorno', 'qa.028.1@sandbox.invalid', public.qa_cpf(340), 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_inicio)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'suspenso', CURRENT_DATE)
  RETURNING id, data_inicio INTO v_v, v_di;
  r.passo_ordem := 2; r.passo_acao := 'Mudar o mesmo vinculo de suspenso para ativo';
  BEGIN
    UPDATE public.usuario_vinculos SET status = 'ativo' WHERE id = v_v;
    r.situacao := 'passou';
    r.obtido := 'Retorno da suspensao aceito, mesmo vinculo, sem unique_violation.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'falhou';
    r.obtido := 'O retorno da suspensao COLIDIU — o indice esta transformando volta em erro (bug do COLAB-028).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_029()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_p uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-029');

  r.passo_ordem := 1;
  r.passo_acao  := 'Criar pessoa com vinculo de ADMINISTRADOR na Alfa';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-029] Dono Que Trabalha', public.qa_fixture_email('COLAB-029', 1),
          public.qa_cpf(501), 'administrador', 'ativo')
  RETURNING id INTO v_p;

  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, v_alfa, 'administrador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Vincular a MESMA pessoa a MESMA empresa como COLABORADOR';
  r.esperado    := 'ACEITO — papel diferente nao e duplicata (dono que tambem e funcionario)';

  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');

    SELECT count(*) INTO v_n FROM public.usuario_vinculos
    WHERE usuario_id = v_p AND empresa_id = v_alfa AND status IN ('ativo','pendente','suspenso');

    IF v_n = 2 THEN
      r.situacao := 'passou';
      r.obtido   := '2 vinculos na mesma empresa, papeis distintos. O caso do Joao esta protegido.';
    ELSE
      r.situacao := 'falhou';
      r.obtido   := format('Esperava 2 vinculos, encontrou %s.', v_n);
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      r.situacao := 'falhou';
      r.obtido   := 'RECUSOU. A chave perdeu o tipo_vinculo: o dono da conta nao consegue mais ser funcionario. Regressao da correcao de 15/07.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  r.passo_ordem := 3;
  r.passo_acao  := 'Tentar um SEGUNDO vinculo de colaborador na mesma empresa';
  IF r.situacao = 'passou' THEN
    BEGIN
      INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
      VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');
      r.situacao := 'falhou';
      r.obtido   := r.obtido || ' MAS aceitou colaborador repetido — a trava nao pega papel repetido.';
    EXCEPTION WHEN unique_violation THEN
      r.obtido := r.obtido || ' E papel repetido continua recusado.';
    END;
  END IF;

  PERFORM public.qa_fixture_limpar('COLAB-029');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_035()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_v uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar colaborador ativo';
  r.esperado := 'Ao desligar: vinculo encerra, pessoa e historico permanecem';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-035] Desligado', 'qa.035.1@sandbox.invalid', public.qa_cpf(420), 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo') RETURNING id INTO v_v;
  r.passo_ordem := 2; r.passo_acao := 'Desligar: encerrar o vinculo';
  UPDATE public.usuario_vinculos SET status = 'encerrado', data_fim = CURRENT_DATE WHERE id = v_v;
  r.passo_ordem := 3; r.passo_acao := 'Conferir que a PESSOA ainda existe';
  SELECT EXISTS(SELECT 1 FROM public.usuarios_base WHERE id = v_p) INTO v_existe;
  IF v_existe AND EXISTS(SELECT 1 FROM public.usuario_vinculos WHERE id = v_v AND status = 'encerrado') THEN
    r.situacao := 'passou'; r.obtido := 'Vinculo encerrado, pessoa e historico preservados.';
  ELSE r.situacao := 'falhou'; r.obtido := 'A pessoa ou o historico sumiram no desligamento.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_colab_036()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_p uuid; v_alfa uuid := public.qa_empresa('[QA] Alfa'); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar pessoa, vincular e depois encerrar (ex-funcionario)';
  r.esperado := 'Readmitir cria NOVO vinculo reusando a MESMA pessoa (1 pessoa, 2 vinculos)';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-036] Readmitido', 'qa.036.1@sandbox.invalid', public.qa_cpf(501), 'colaborador', 'ativo')
  RETURNING id INTO v_p;
  INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status, data_fim)
  VALUES (v_t, v_p, v_alfa, 'colaborador', 'encerrado', CURRENT_DATE - 30);
  r.passo_ordem := 2; r.passo_acao := 'Readmitir: novo vinculo ativo, mesma pessoa, mesma empresa';
  BEGIN
    INSERT INTO public.usuario_vinculos (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_p, v_alfa, 'colaborador', 'ativo');
    SELECT count(*) INTO v_n FROM public.usuario_vinculos WHERE usuario_id = v_p;
    IF v_n = 2 THEN r.situacao := 'passou'; r.obtido := '1 pessoa, 2 vinculos (encerrado + ativo). Readmissao OK.';
    ELSE r.situacao := 'falhou'; r.obtido := format('Esperava 2 vinculos, achou %s.', v_n); END IF;
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'falhou';
    r.obtido := 'RECUSOU a readmissao — o indice esta barrando novo vinculo apesar do antigo estar encerrado (o predicado nao esta parcial).';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_epi_001()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

CREATE OR REPLACE FUNCTION public.qa_caso_ter_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $$;
-- ─────────────────────────────────────────────────────────
-- Conferência final: nenhuma rotina de QA pode ter CPF literal
-- ─────────────────────────────────────────────────────────
DO $conf$
DECLARE v_resta text;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_resta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'qa\_caso\_%'
    AND p.prosrc ~ '''[0-9]{11}''';

  IF v_resta IS NULL THEN
    RAISE NOTICE 'OK: nenhuma rotina de QA tem CPF literal. Todas usam qa_cpf().';
  ELSE
    RAISE WARNING 'Ainda com CPF literal: %', v_resta;
  END IF;
END $conf$;

SELECT count(*) AS rotinas_de_caso,
       count(*) FILTER (WHERE p.prosrc ~ 'qa_cpf\(') AS usam_qa_cpf,
       count(*) FILTER (WHERE p.prosrc ~ '''[0-9]{11}''') AS ainda_com_literal
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'qa\_caso\_%';
