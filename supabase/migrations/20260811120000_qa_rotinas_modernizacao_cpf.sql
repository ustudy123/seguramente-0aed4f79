-- =========================================================
-- QA — Modernização de 4 rotinas antigas (11/08)
--
-- A primeira execução em escala das baterias mostrou rotinas antigas
-- quebrando por dois motivos que NÃO são defeito do sistema:
--
--   1. CPF fictício FORMATADO ainda fixo no código ('999.002.000-02',
--      '999.000.010-33') com dígito verificador inválido — a validação
--      de CPF no banco (20260730020000) agora os recusa antes de o
--      teste chegar ao que ele quer testar. A migration de fixtures
--      (20260805090000) trocou os CPFs crus por qa_cpf(), mas as
--      variantes pontuadas escaparam.
--   2. A constraint usuarios_base_colaborador_exige_cpf (proteção que
--      o próprio QA recomendou e o desenvolvimento aplicou) mudou a
--      regra: colaborador SEM CPF agora é recusado. COLAB-011 e
--      COLAB-023 testavam o mundo antigo — cadastro mínimo sem CPF —
--      e passaram a quebrar na fixture, não no alvo do teste.
--
-- O que muda aqui:
--   ADM-002    variante pontuada derivada do próprio qa_cpf(200002)
--   COLAB-033  idem, derivada de qa_cpf(1033)
--   COLAB-011  o caso passa a validar a proteção NOVA: colaborador sem
--              CPF recusado; com CPF entra (a semântica do caso — "o
--              mínimo obrigatório basta" — se atualiza porque o mínimo
--              obrigatório mudou, e para melhor)
--   COLAB-023  fixtures com CPF válido, para o teste alcançar o alvo
--              (e-mail duplicado)
--
-- As demais rotinas que aparecem com erro em bancos antigos (DESL-*,
-- EMP-024/025/060, PORTE-005, ADM-111, PERFIL-004) JÁ ESTÃO corrigidas
-- em migrations anteriores — o ambiente de testes, que recebe todas as
-- migrations pela esteira, executa as versões certas.
--
-- NENHUMA CORREÇÃO DE FUNCIONALIDADE. Só rotinas qa_*.
-- =========================================================

SET lock_timeout = '10s';

-- Helper: forma pontuada de um CPF de 11 dígitos (000.000.000-00).
CREATE OR REPLACE FUNCTION public.qa_cpf_formatado(p_cpf text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format('%s.%s.%s-%s',
                substr(p_cpf,1,3), substr(p_cpf,4,3), substr(p_cpf,7,3), substr(p_cpf,10,2))
$$;

-- ══ ADM-002: duplicidade de CPF em admissões ══
CREATE OR REPLACE FUNCTION public.qa_caso_adm_002()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ══ COLAB-033: mesmo CPF cru e formatado em usuarios_base ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cru  text := public.qa_cpf(1033);
  v_fmt  text := public.qa_cpf_formatado(public.qa_cpf(1033));
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-033');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar pessoa com CPF sem formatacao (' || v_cru || ')';

  INSERT INTO public.usuarios_base
    (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-COLAB-033] Pessoa CPF Cru', public.qa_fixture_email('COLAB-033', 1),
          v_cru, 'colaborador', 'ativo');

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar OUTRA pessoa com o MESMO CPF, agora formatado (' || v_fmt || ')';
  r.esperado    := 'Recusado — mesmos 11 digitos, mesma pessoa';

  BEGIN
    INSERT INTO public.usuarios_base
      (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-COLAB-033] Pessoa CPF Formatado', public.qa_fixture_email('COLAB-033', 2),
            v_fmt, 'colaborador', 'ativo');

    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU. A mesma pessoa existe duas vezes, separada so pela pontuacao do CPF. '
               || 'usuarios_base_cpf_tenant_uidx e sobre a coluna crua e nao enxerga que '
               || regexp_replace(v_fmt,'[^0-9]','','g') || ' = ' || v_cru
               || '. Correcao: normalizar o CPF na escrita (trigger) e reconstruir o indice '
               || 'sobre a forma normalizada.';
    r.detalhe  := jsonb_build_object(
                    'cpf_gravado_1', v_cru,
                    'cpf_gravado_2', v_fmt,
                    'digitos_iguais', regexp_replace(v_fmt,'[^0-9]','','g') = v_cru);
  EXCEPTION
    WHEN unique_violation THEN
      r.situacao := 'passou';
      r.obtido   := 'Recusado com unique_violation. O CPF esta normalizado na escrita.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  PERFORM public.qa_fixture_limpar('COLAB-033');
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM;
  RETURN r;
END $$;

-- ══ COLAB-011: o mínimo obrigatório mudou — e para melhor ══
-- Antes: "nome + email bastam, CPF é opcional". Desde 30/07 a constraint
-- usuarios_base_colaborador_exige_cpf (recomendação do próprio QA) exige
-- CPF para colaborador. O caso passa a vigiar a proteção nova.
CREATE OR REPLACE FUNCTION public.qa_caso_colab_011()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Tentar cadastrar colaborador SEM CPF (so nome e email)';
  r.esperado := 'Recusado — colaborador sem CPF fica fora da protecao de duplicidade';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
    VALUES (v_t, '[QA-011] Sem CPF', 'qa.011.1@sandbox.invalid', 'colaborador', 'ativo');
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU colaborador sem CPF — a constraint usuarios_base_colaborador_exige_cpf '
             || 'nao esta segurando. Sem CPF, o registro fica fora do indice de unicidade e de '
             || 'qualquer protecao contra duplicidade.';
    RETURN r;
  EXCEPTION WHEN check_violation THEN
    r.obtido := 'Sem CPF, recusado pela constraint.';
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Cadastrar o mesmo colaborador COM CPF valido';
  r.esperado := 'Aceito — o minimo obrigatorio (nome, email, CPF) basta';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-011] Com CPF', 'qa.011.2@sandbox.invalid', public.qa_cpf(1101),
          'colaborador', 'ativo')
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    r.situacao := 'passou';
    r.obtido := 'Colaborador sem CPF barrado; com CPF valido, criado com o minimo. '
             || 'A regra nova (constraint de 30/07, recomendada pelo proprio QA) esta de pe.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'Com CPF valido, nao criou.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;

-- ══ COLAB-023: e-mail duplicado — fixture com CPF para alcançar o alvo ══
CREATE OR REPLACE FUNCTION public.qa_caso_colab_023()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar pessoa com um email';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-023] A', 'qa.023.dup@sandbox.invalid', public.qa_cpf(2301), 'colaborador', 'ativo');
  r.passo_ordem := 2;
  r.passo_acao := 'Tentar criar OUTRA pessoa (CPF diferente) com o MESMO email no mesmo tenant';
  r.esperado := 'Recusado — email e chave de acesso, nao pode duplicar';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-023] B', 'qa.023.dup@sandbox.invalid', public.qa_cpf(2302), 'colaborador', 'ativo');
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU email duplicado. Nao ha constraint unica em email_principal — dois usuarios podem ter o mesmo login. Falta protecao no banco.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado, como deveria.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $$;
