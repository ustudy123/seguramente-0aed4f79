-- =========================================================
-- QA — Fase 3: o motor do robô + as 5 primeiras rotinas
--
-- DEPENDE das Fases 1 e 1b. Se elas não rodaram, este arquivo se recusa a
-- instalar e avisa — em vez de criar rotina que escreve sem trava.
--
-- AS 5 ROTINAS FORAM ESCOLHIDAS DE PROPÓSITO: são as que testam exatamente
-- a trava criada hoje (usuario_vinculos_vigente_uidx). Se o robô funcionar,
-- ele prova a correção de hoje sozinho, toda vez que rodar.
--
--   COLAB-001  cadastro manual com vínculo ativo        (o caminho normal)
--   COLAB-020  CPF repetido no mesmo cliente é recusado (índice de pessoa)
--   COLAB-025  segundo vínculo ativo na mesma empresa   (a trava de hoje)
--   COLAB-026  mesma pessoa em duas empresas é OK       (o que a trava NÃO pode barrar)
--   COLAB-029  papel duplo é OK                          (o caso do João)
--
-- COMO CADA ROTINA SE PROTEGE:
--   1. liga o modo de teste  -> o banco passa a recusar escrita fora do cercado
--   2. limpa a própria bagunça ANTES de começar (não depois) -> se a rodada
--      anterior morreu no meio, esta se cura sozinha
--   3. dados sintéticos reconhecíveis: e-mail @sandbox.invalid (TLD reservado,
--      nunca resolve), CPF 999.xxx, nome com [QA-<codigo>]
-- =========================================================

DO $guarda$
BEGIN
  IF to_regprocedure('public.qa_sandbox_tenant_id()') IS NULL
     OR public.qa_sandbox_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: o cercado nao existe. Rode qa_fase1_cercado.sql antes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_guarda_cercado' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'ABORTADO: a trava nao esta instalada. Rode qa_fase1b_endurecer.sql antes. Sem ela, rotina de teste escreve em cliente real.';
  END IF;
  IF (SELECT count(*) FROM public.empresa_cadastro WHERE tenant_id = public.qa_sandbox_tenant_id()) < 2 THEN
    RAISE EXCEPTION 'ABORTADO: o cercado precisa das empresas Alfa e Beta (o COLAB-026 usa as duas).';
  END IF;
  RAISE NOTICE 'Cercado e trava conferidos. Instalando o motor.';
END $guarda$;

-- ─────────────────────────────────────────────────────────
-- O CONTRATO — toda rotina devolve isto, sempre
-- ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.qa_retorno AS (
    situacao     public.qa_situacao,
    passo_ordem  int,
    passo_acao   text,
    esperado     text,
    obtido       text,
    erro_tecnico text,
    detalhe      jsonb
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────
-- HELPERS
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_fixture_email(p_codigo text, p_n int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'qa.' || lower(replace(p_codigo, '-', '')) || '.' || p_n || '@sandbox.invalid'
$$;

CREATE OR REPLACE FUNCTION public.qa_fixture_limpar(p_codigo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_tenant uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  -- usuario_vinculos tem ON DELETE CASCADE a partir de usuarios_base
  DELETE FROM public.usuarios_base
  WHERE tenant_id = v_tenant
    AND email_principal LIKE 'qa.' || lower(replace(p_codigo, '-', '')) || '.%@sandbox.invalid';
END $$;

COMMENT ON FUNCTION public.qa_fixture_limpar(text) IS
  'Apaga os dados sinteticos de um caso. Chamado NO INICIO de cada rotina, nao no fim: assim uma rodada que morreu no meio nao contamina a proxima.';

CREATE OR REPLACE FUNCTION public.qa_empresa(p_nome text)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.empresa_cadastro
  WHERE tenant_id = public.qa_sandbox_tenant_id() AND nome_fantasia = p_nome
  LIMIT 1
$$;

-- ─────────────────────────────────────────────────────────
-- COLAB-001 — o caminho normal
-- ─────────────────────────────────────────────────────────
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
          '99900000188', 'colaborador', 'ativo')
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

-- ─────────────────────────────────────────────────────────
-- COLAB-020 — CPF repetido no mesmo cliente é recusado
-- ─────────────────────────────────────────────────────────
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
          '99900000269', 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Tentar cadastrar OUTRA pessoa com o MESMO CPF no mesmo cliente';
  r.esperado    := 'Recusado — usuarios_base_cpf_tenant_uidx impede CPF repetido por cliente';

  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-COLAB-020] Pessoa Duplicada', public.qa_fixture_email('COLAB-020', 2),
            '99900000269', 'colaborador', 'ativo');
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

-- ─────────────────────────────────────────────────────────
-- COLAB-025 — a trava de hoje. Segundo vinculo ativo na mesma empresa.
-- ─────────────────────────────────────────────────────────
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
          '99900000340', 'colaborador', 'ativo')
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

-- ─────────────────────────────────────────────────────────
-- COLAB-026 — o que a trava NAO pode barrar: duas empresas
-- ─────────────────────────────────────────────────────────
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
          '99900000420', 'colaborador', 'ativo')
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

-- ─────────────────────────────────────────────────────────
-- COLAB-029 — o caso do Joao: papel duplo na mesma empresa
-- ─────────────────────────────────────────────────────────
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
          '99900000501', 'administrador', 'ativo')
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

-- ─────────────────────────────────────────────────────────
-- REGISTRO — liga caso a rotina. A view qa_cobertura le daqui.
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql) VALUES
  ('COLAB-001', 'qa_caso_colab_001'),
  ('COLAB-020', 'qa_caso_colab_020'),
  ('COLAB-025', 'qa_caso_colab_025'),
  ('COLAB-026', 'qa_caso_colab_026'),
  ('COLAB-029', 'qa_caso_colab_029')
ON CONFLICT (codigo) DO UPDATE SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- ─────────────────────────────────────────────────────────
-- O MOTOR — percorre TODOS os casos aprovados do modulo.
-- Caso sem rotina nao e ignorado: entra no relatorio como
-- 'nao_implementado'. E como "percorrer todos" vira verdade.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_rodar_bateria(
  p_disparo public.qa_disparo DEFAULT 'manual',
  p_modulo  text DEFAULT 'estrutura-organizacional/colaboradores'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_exec uuid;
  v_t0   timestamptz := clock_timestamp();
  c      record;
  r      public.qa_retorno;
  v_ini  timestamptz;
BEGIN
  IF public.qa_sandbox_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Cercado nao existe. Bateria abortada.';
  END IF;

  INSERT INTO public.qa_execucoes (disparo, modulo_path)
  VALUES (p_disparo, p_modulo)
  RETURNING id INTO v_exec;

  FOR c IN
    SELECT ct.id AS caso_id, ct.codigo, ct.titulo, i.funcao_sql
    FROM public.qa_casos_teste ct
    JOIN public.qa_modulos m ON m.id = ct.modulo_id AND m.path = p_modulo
    LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
    WHERE ct.status = 'aprovado'
    ORDER BY ct.codigo
  LOOP
    v_ini := clock_timestamp();

    IF c.funcao_sql IS NULL THEN
      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, esperado, obtido, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, 'nao_implementado',
              c.titulo,
              'Caso documentado e aprovado, mas nenhuma rotina foi escrita para executa-lo.',
              0);
    ELSE
      BEGIN
        EXECUTE format('SELECT * FROM public.%I()', c.funcao_sql) INTO r;
        INSERT INTO public.qa_resultados
          (execucao_id, caso_id, codigo, situacao, passo_ordem, passo_acao,
           esperado, obtido, erro_tecnico, detalhe, duracao_ms)
        VALUES (v_exec, c.caso_id, c.codigo, r.situacao, r.passo_ordem, r.passo_acao,
                r.esperado, r.obtido, r.erro_tecnico, r.detalhe,
                extract(milliseconds from clock_timestamp() - v_ini)::int);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.qa_resultados
          (execucao_id, caso_id, codigo, situacao, obtido, erro_tecnico, duracao_ms)
        VALUES (v_exec, c.caso_id, c.codigo, 'erro',
                'A rotina nao pode nem ser chamada.', SQLERRM,
                extract(milliseconds from clock_timestamp() - v_ini)::int);
      END;
    END IF;
  END LOOP;

  UPDATE public.qa_execucoes e SET
    terminada_em     = now(),
    duracao_ms       = extract(milliseconds from clock_timestamp() - v_t0)::int,
    total            = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec),
    passou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='passou'),
    falhou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='falhou'),
    nao_implementado = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='nao_implementado'),
    erro             = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='erro')
  WHERE e.id = v_exec;

  RETURN v_exec;
END $$;

COMMENT ON FUNCTION public.qa_rodar_bateria(public.qa_disparo, text) IS
  'Roda a bateria do modulo. Percorre TODOS os casos aprovados: os sem rotina entram no relatorio como nao_implementado, nunca sao ignorados.';

-- ─────────────────────────────────────────────────────────
-- PRIMEIRA BATERIA — roda agora e mostra o resultado
-- ─────────────────────────────────────────────────────────
DO $roda$
DECLARE v_exec uuid;
BEGIN
  v_exec := public.qa_rodar_bateria('manual');
  RAISE NOTICE 'Bateria % concluida.', v_exec;
END $roda$;

SELECT r.codigo,
       r.situacao::text                                   AS situacao,
       COALESCE(left(r.obtido, 62), '')                   AS o_que_aconteceu,
       COALESCE(r.duracao_ms, 0)                          AS ms
FROM public.qa_resultados r
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (r.situacao <> 'passou') DESC, r.codigo;
