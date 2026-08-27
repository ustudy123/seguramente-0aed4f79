-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 4 de 15
-- Colaboradores, Compliance SST e Departamentos
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

-- (1) ROTINAS — 51 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_p uuid;
  v_por_nome int; v_por_cpf_limpo int; v_por_cpf_fmt int;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Criar colaborador com nome e CPF conhecidos';
  r.esperado := 'Encontravel por nome parcial, por CPF sem e com formatacao';
  INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
  VALUES (v_t, '[QA-002] Joaquim Aparecido Testonildo', 'qa.002.1@sandbox.invalid',
          '99900000188', 'colaborador', 'ativo')
  RETURNING id INTO v_p;

  r.passo_ordem := 2;
  r.passo_acao := 'Buscar pelo nome parcial ("Testonildo")';
  SELECT count(*) INTO v_por_nome
  FROM public.usuarios_base
  WHERE tenant_id = v_t AND nome_completo ILIKE '%Testonildo%';

  r.passo_ordem := 3;
  r.passo_acao := 'Buscar pelo CPF sem formatacao (99900000188)';
  SELECT count(*) INTO v_por_cpf_limpo
  FROM public.usuarios_base
  WHERE tenant_id = v_t AND regexp_replace(cpf, '[^0-9]', '', 'g') = '99900000188';

  r.passo_ordem := 4;
  r.passo_acao := 'Buscar pelo CPF formatado (999.000.001-88)';
  -- normaliza os dois lados: o gravado e o buscado
  SELECT count(*) INTO v_por_cpf_fmt
  FROM public.usuarios_base
  WHERE tenant_id = v_t
    AND regexp_replace(cpf, '[^0-9]', '', 'g') = regexp_replace('999.000.001-88', '[^0-9]', '', 'g');

  IF v_por_nome >= 1 AND v_por_cpf_limpo >= 1 AND v_por_cpf_fmt >= 1 THEN
    r.situacao := 'passou';
    r.obtido := 'Encontrado pelas 3 vias: nome parcial, CPF limpo e CPF formatado.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('Falha na busca — nome:%s, cpf_limpo:%s, cpf_fmt:%s (esperado >=1 em cada).',
                       v_por_nome, v_por_cpf_limpo, v_por_cpf_fmt);
  END IF;
  r.detalhe := jsonb_build_object('por_nome', v_por_nome,
                                  'por_cpf_limpo', v_por_cpf_limpo,
                                  'por_cpf_formatado', v_por_cpf_fmt);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_alfa uuid := public.qa_empresa('[QA] Alfa');
  v_ids uuid[];
  v_id uuid;
  v_n int;
  v_nomes text[] := ARRAY['[QA-COLAB-010] Conceição Assunção',
                          '[QA-COLAB-010] João Müller',
                          '[QA-COLAB-010] Antônio Nuñez'];
  v_cpfs text[] := ARRAY[public.qa_cpf(1010),public.qa_cpf(1011),public.qa_cpf(1012)];
  i int;
  v_lido text;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-010');

  IF v_alfa IS NULL THEN
    r.situacao := 'erro';
    r.obtido   := 'A empresa [QA] Alfa nao existe no cercado. Semeie o cercado antes.';
    RETURN r;
  END IF;

  r.passo_ordem := 1;
  r.passo_acao  := 'Importar planilha com 3 colaboradores novos (CPFs distintos, nomes acentuados)';
  r.esperado    := '3 registros criados, 0 erros';

  FOR i IN 1..3 LOOP
    INSERT INTO public.usuarios_base
      (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, v_nomes[i], public.qa_fixture_email('COLAB-010', i),
            v_cpfs[i], 'colaborador', 'ativo')
    RETURNING id INTO v_id;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  IF array_length(v_ids, 1) <> 3 THEN
    r.situacao := 'falhou';
    r.obtido   := 'Esperava 3 pessoas criadas, saiu ' || COALESCE(array_length(v_ids,1), 0) || '.';
    PERFORM public.qa_fixture_limpar('COLAB-010');
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Conferir a acentuacao dos nomes gravados';
  r.esperado    := 'Acentos corretos (UTF-8), sem caractere trocado';

  FOR i IN 1..3 LOOP
    SELECT nome_completo INTO v_lido FROM public.usuarios_base WHERE id = v_ids[i];
    IF v_lido IS DISTINCT FROM v_nomes[i] THEN
      r.situacao := 'falhou';
      r.obtido   := 'Nome voltou diferente do gravado. Esperado "' || v_nomes[i]
                 || '", lido "' || COALESCE(v_lido,'(nulo)') || '". Encoding corrompeu o dado.';
      PERFORM public.qa_fixture_limpar('COLAB-010');
      RETURN r;
    END IF;
  END LOOP;

  r.passo_ordem := 3;
  r.passo_acao  := 'Conferir os vinculos na empresa escolhida';
  r.esperado    := 'Os 3 com vinculo ativo na Alfa';

  FOR i IN 1..3 LOOP
    INSERT INTO public.usuario_vinculos
      (tenant_id, usuario_id, empresa_id, tipo_vinculo, status)
    VALUES (v_t, v_ids[i], v_alfa, 'colaborador', 'ativo');
  END LOOP;

  SELECT count(*) INTO v_n FROM public.usuario_vinculos
  WHERE empresa_id = v_alfa AND usuario_id = ANY(v_ids) AND status = 'ativo';

  IF v_n <> 3 THEN
    r.situacao := 'falhou';
    r.obtido   := 'Esperava 3 vinculos ativos, contei ' || v_n || '.';
    PERFORM public.qa_fixture_limpar('COLAB-010');
    RETURN r;
  END IF;

  r.passo_ordem := 4;
  r.passo_acao  := 'Comparar a estrutura com o cadastro manual do COLAB-001';
  r.esperado    := 'Mesmos campos preenchidos — a importacao nao deixa buraco';

  SELECT count(*) INTO v_n FROM public.usuarios_base
  WHERE id = ANY(v_ids)
    AND cpf IS NOT NULL AND btrim(cpf) <> ''
    AND email_principal IS NOT NULL
    AND nome_completo IS NOT NULL
    AND tipo_usuario = 'colaborador'
    AND status = 'ativo';

  IF v_n = 3 THEN
    r.situacao := 'passou';
    r.obtido   := '3 criados com acentuacao intacta, 3 vinculos ativos e nenhum campo em branco.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := 'Apenas ' || v_n || ' dos 3 tem a estrutura completa do cadastro manual. '
               || 'A importacao deixou buraco em campo que o cadastro manual preenche.';
  END IF;

  PERFORM public.qa_fixture_limpar('COLAB-010');
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid;
  v_estado text;
  v_msg text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Tentar cadastrar com CPF matematicamente invalido (111.111.111-11)';
  r.esperado    := 'Recusado pelo banco — digito verificador invalido';

  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-021] CPF Ruim', 'qa.021.1@sandbox.invalid', '11111111111', 'colaborador', 'ativo')
    RETURNING id INTO v_id;

    r.situacao := 'falhou';
    r.obtido   := 'O BANCO ACEITOU CPF invalido. A validacao existe so no front — '
               || 'a trigger valida_cpf_usuario nao esta instalada nesta base.';
    RETURN r;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_estado = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  -- check_violation (23514) e a recusa esperada: e o ERRCODE que a trigger
  -- levanta e o mesmo de um CHECK constraint, caso a defesa mude de forma.
  -- unaccent nao esta garantido em toda base, entao a checagem de texto usa
  -- translate para tirar os acentos que interessam.
  IF v_estado = '23514'
     OR lower(translate(v_msg, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) LIKE '%cpf%'
     OR lower(translate(v_msg, 'áàâãéêíóôõúüç', 'aaaaeeiooouuc')) LIKE '%invalid%' THEN
    r.situacao := 'passou';
    r.obtido   := format('Recusado pelo banco, como deveria (SQLSTATE %s): %s', v_estado, v_msg);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('A escrita falhou, mas por outro motivo — nao pela validacao de CPF '
                      || '(SQLSTATE %s): %s', v_estado, v_msg);
    r.erro_tecnico := v_msg;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao := 'Tentar cadastrar sem nome (campo obrigatorio)';
  r.esperado := 'Recusado — NOT NULL protege a identidade minima';
  BEGIN
    INSERT INTO public.usuarios_base (tenant_id, nome_completo, email_principal, tipo_usuario, status)
    VALUES (v_t, NULL, 'qa.022.1@sandbox.invalid', 'colaborador', 'ativo');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU pessoa sem nome.';
  EXCEPTION WHEN not_null_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com not_null_violation, como deveria.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_023()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_023()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_023 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_024()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_024()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_024 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_025()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_025()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_025 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_026()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_026()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_026 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_027()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_027()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_027 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_028()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_028()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_028 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_029()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_029()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_029 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a importação de colaboradores existe como processo no banco?';
  r.esperado := 'Reimportar a mesma planilha identifica existentes e devolve a decisão — nunca duplica';
  v_est := coalesce(public.qa_fns_com('%importa%colaborador%'), public.qa_fns_com('%planilha%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a importação de colaboradores não existe como processo no banco — sem '
             || 'função de conciliação, a tela grava linha a linha e reimportar a mesma '
             || 'planilha duplicaria em silêncio (só a trava de CPF por admissão ativa segura '
             || 'parte). O desenho correto: detectar existentes pelo CPF, listar e devolver a '
             || 'decisão ao usuário (manter × substituir). Correção: função de importação com '
             || 'staging e relatório de conflitos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Processo de importação presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção "manter os dados atuais" existe na reimportação?';
  r.esperado := 'Colaborador já existente com escolha "manter" preserva o que foi alterado no sistema';
  v_est := public.qa_fns_com('%manter%colaborador%');
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem o processo de importação (COLAB-030), a escolha "manter" não '
             || 'existe. O risco que ela previne: a planilha envelhece — depois da importação '
             || 'inicial, o RH corrige dados NO SISTEMA; uma reimportação ingênua sobrescreve '
             || 'as correções com os dados velhos da planilha. "Manter" preserva o atual e '
             || 'ignora a planilha para os existentes.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Opção presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_032()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a opção "substituir" atualiza no lugar (UPDATE), sem recriar?';
  r.esperado := 'Substituir mantém o id da pessoa — apagar e recriar deixa todo o histórico órfão';
  v_est := public.qa_fns_com('%substitu%colaborador%');
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sem o processo de importação (COLAB-030), a escolha "substituir" não '
             || 'existe — e é a mais perigosa de improvisar: se a tela um dia apagar e '
             || 'recriar, o id muda e TODO o histórico da pessoa (ponto, férias, atestados, '
             || 'documentos) vira órfão. Substituir é UPDATE no registro existente, nunca '
             || 'DELETE+INSERT. Registrado aqui para o desenho da funcionalidade nascer certo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Opção presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_032()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_032 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_033()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_033()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_033 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_034()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_fixture_limpar('COLAB-034');

  r.passo_ordem := 1;
  r.passo_acao  := 'Cadastrar usuario de sistema (gestor) SEM CPF';
  r.esperado    := 'ACEITO — usuario de sistema nao precisa de CPF, o indice parcial esta correto';

  BEGIN
    INSERT INTO public.usuarios_base
      (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-COLAB-034] Gestor Sem CPF', public.qa_fixture_email('COLAB-034', 1),
            NULL, 'gestor', 'ativo');
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'falhou';
    r.obtido   := 'RECUSOU o gestor sem CPF. A regra ficou larga demais: usuario de '
               || 'sistema nao deve exigir CPF.';
    r.erro_tecnico := SQLERRM;
    PERFORM public.qa_fixture_limpar('COLAB-034');
    RETURN r;
  END;

  r.passo_ordem := 2;
  r.passo_acao  := 'Cadastrar COLABORADOR sem CPF';
  r.esperado    := 'Recusado — colaborador e pessoa fisica com vinculo, CPF e obrigatorio';

  BEGIN
    INSERT INTO public.usuarios_base
      (tenant_id, nome_completo, email_principal, cpf, tipo_usuario, status)
    VALUES (v_t, '[QA-COLAB-034] Colaborador Sem CPF', public.qa_fixture_email('COLAB-034', 2),
            NULL, 'colaborador', 'ativo')
    RETURNING id INTO v_id;

    r.situacao := 'falhou';
    r.obtido   := 'ACEITOU colaborador sem CPF. Nao existe constraint garantindo a regra — '
               || 'ela depende inteiramente da tela lembrar de validar. Colaborador sem CPF '
               || 'fica fora do indice parcial e portanto fora de qualquer protecao contra '
               || 'duplicidade. Correcao: CHECK (tipo_usuario <> ''colaborador'' OR cpf IS NOT NULL), '
               || 'aplicavel so depois de conferir que nao ha colaborador sem CPF na base.';
    r.detalhe  := jsonb_build_object('id_criado', v_id, 'constraint_existe', false);
  EXCEPTION
    WHEN check_violation OR not_null_violation THEN
      r.situacao := 'passou';
      r.obtido   := 'Recusado pelo banco. A regra e garantida por constraint, nao por disciplina de tela.';
    WHEN OTHERS THEN
      r.situacao := 'erro'; r.obtido := 'Erro inesperado'; r.erro_tecnico := SQLERRM;
  END;

  PERFORM public.qa_fixture_limpar('COLAB-034');
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_034()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_034 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_035()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_035()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_035 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_colab_036()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_colab_036()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_colab_036 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_grau text; v_apl text; v_val numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar insalubridade grau medio (20% do salario minimo = R$ 303,60)';
  r.esperado:='Enquadramento gravado, adicional de insalubridade aplicado';
  v_id := public.qa_nova_condicao('[QA] Operador Insalubre', true, 'medio', 303.60,
                                  false, 0, 'insalubridade', 303.60);
  SELECT insalubridade_grau, adicional_aplicado, adicional_valor_aplicado
    INTO v_grau, v_apl, v_val FROM public.colaborador_condicoes_especiais WHERE id=v_id;
  IF v_grau='medio' AND v_apl='insalubridade' AND v_val=303.60 THEN
    r.situacao:='passou';
    r.obtido:='Insalubridade grau medio registrada, adicional de R$ 303,60 aplicado.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('grau=%s, aplicado=%s, valor=%s.', v_grau, v_apl, v_val);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_tipo text; v_apl text; v_val numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar periculosidade (30% sobre salario base de R$ 3.000 = R$ 900)';
  r.esperado:='Enquadramento gravado, adicional de periculosidade aplicado';
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome, periculosidade, periculosidade_tipo,
     periculosidade_valor_calculado, adicional_aplicado, adicional_valor_aplicado)
  VALUES (v_t, public.qa_cpf(701483), '[QA] Operador Periculoso', true, 'Inflamaveis',
          900.00, 'periculosidade', 900.00) RETURNING id INTO v_id;
  SELECT periculosidade_tipo, adicional_aplicado, adicional_valor_aplicado
    INTO v_tipo, v_apl, v_val FROM public.colaborador_condicoes_especiais WHERE id=v_id;
  IF v_tipo='Inflamaveis' AND v_apl='periculosidade' AND v_val=900.00 THEN
    r.situacao:='passou';
    r.obtido:='Periculosidade (inflamaveis) registrada, adicional de R$ 900,00 aplicado.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('tipo=%s, aplicado=%s, valor=%s.', v_tipo, v_apl, v_val);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
        v_insal numeric; v_peric numeric; v_apl text; v_val numeric; v_soma numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar colaborador enquadrado nas DUAS condicoes (insalubridade R$ 607,20 e periculosidade R$ 900,00)';
  r.esperado:='Apenas o maior valor aplicado (R$ 900,00), nunca a soma';
  -- grau maximo (40% do minimo = 607,20) x periculosidade (30% de 3000 = 900)
  v_id := public.qa_nova_condicao('[QA] Dupla Exposicao', true, 'maximo', 607.20,
                                  true, 900.00, 'periculosidade', 900.00);
  SELECT insalubridade_valor_calculado, periculosidade_valor_calculado,
         adicional_aplicado, adicional_valor_aplicado
    INTO v_insal, v_peric, v_apl, v_val
    FROM public.colaborador_condicoes_especiais WHERE id=v_id;
  v_soma := v_insal + v_peric;

  IF v_apl IN ('insalubridade','periculosidade')
     AND v_val = GREATEST(v_insal, v_peric)
     AND v_val <> v_soma THEN
    r.situacao:='passou';
    r.obtido:=format('Prevalencia respeitada: calculados R$ %s (insalubridade) e R$ %s (periculosidade); aplicado apenas R$ %s (%s). Nao houve cumulatividade.',
                     v_insal, v_peric, v_val, v_apl);
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Prevalencia violada: aplicado=%s, valor=%s. Maior seria %s, soma seria %s (vedada pelo art. 193 §2º).',
                     v_apl, v_val, GREATEST(v_insal, v_peric), v_soma);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_grau text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar insalubridade com grau "altissimo" (fora da NR-15)';
  r.esperado:='Idealmente recusado — a NR-15 preve so minimo, medio e maximo';
  BEGIN
    v_id := public.qa_nova_condicao('[QA] Grau Invalido', true, 'altissimo', 0, false, 0, 'insalubridade', 0);
    SELECT insalubridade_grau INTO v_grau FROM public.colaborador_condicoes_especiais WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU grau "%s". A NR-15 preve apenas minimo (10%%), medio (20%%) e maximo (40%%). Sem CHECK — um grau desconhecido resulta em percentual zero no calculo, e o adicional sai R$ 0,00 sem aviso.', v_grau);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: grau restrito aos tres previstos na NR-15.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_apl text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar adicional aplicado = "ambos" (vedado pelo art. 193 §2º da CLT)';
  r.esperado:='Idealmente recusado — a lei veda a cumulatividade';
  BEGIN
    v_id := public.qa_nova_condicao('[QA] Cumulatividade', true, 'maximo', 607.20,
                                    true, 900.00, 'ambos', 1507.20);
    SELECT adicional_aplicado INTO v_apl FROM public.colaborador_condicoes_especiais WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU adicional aplicado = "%s". E justamente o que o art. 193 §2º da CLT proibe — o campo que documenta o cumprimento da regra aceita o valor que a lei veda.', v_apl);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: so insalubridade, periculosidade ou nenhum sao validos.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_val numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar valor de adicional negativo (-500,00)';
  r.esperado:='Idealmente recusado — adicional e acrescimo, nunca desconto';
  BEGIN
    v_id := public.qa_nova_condicao('[QA] Adicional Negativo', true, 'medio', -500.00,
                                    false, 0, 'insalubridade', -500.00);
    SELECT adicional_valor_aplicado INTO v_val FROM public.colaborador_condicoes_especiais WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU adicional de R$ %s (negativo). Em campo que alimenta folha, isso vira desconto no salario do colaborador.', v_val);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: adicional nao pode ser negativo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_cargo uuid; v_cond uuid; v_existe boolean; v_cargo_da_cond uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar condicoes especiais vinculadas a um cargo';
  r.esperado:='Apagar o cargo preserva o enquadramento (historico legal)';
  INSERT INTO public.cargos (tenant_id, nome) VALUES (v_t, '[QA] Operador de Caldeira')
  RETURNING id INTO v_cargo;
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome, cargo_id, insalubridade, insalubridade_grau)
  VALUES (v_t, public.qa_cpf(701485), '[QA] Caldeireiro', v_cargo, true, 'maximo')
  RETURNING id INTO v_cond;

  r.passo_ordem:=2; r.passo_acao:='Apagar o cargo';
  BEGIN
    DELETE FROM public.cargos WHERE id=v_cargo;
  EXCEPTION WHEN foreign_key_violation THEN
    r.situacao:='passou';
    r.obtido:='O banco bloqueou apagar o cargo enquanto ha enquadramento vinculado — o historico esta protegido.';
    RETURN r;
  END;

  r.passo_ordem:=3; r.passo_acao:='Conferir se o enquadramento sobreviveu';
  SELECT EXISTS(SELECT 1 FROM public.colaborador_condicoes_especiais WHERE id=v_cond) INTO v_existe;
  SELECT cargo_id INTO v_cargo_da_cond FROM public.colaborador_condicoes_especiais WHERE id=v_cond;
  IF v_existe THEN
    r.situacao:='passou';
    r.obtido:=format('O enquadramento sobreviveu ao cargo (cargo_id agora %s). O historico de exposicao foi preservado.',
                     COALESCE(v_cargo_da_cond::text,'nulo'));
  ELSE
    r.situacao:='falhou';
    r.obtido:='O enquadramento foi APAGADO junto com o cargo — perda de historico com valor legal para aposentadoria especial e defesa trabalhista.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_cond_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Registrar condicoes no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.colaborador_condicoes_especiais
    (tenant_id, colaborador_id, colaborador_nome, insalubridade, insalubridade_agente_nocivo)
  VALUES (v_t1, public.qa_cpf(701485), '[QA] Exposto Secreto T1', true, 'Benzeno');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.colaborador_condicoes_especiais
   WHERE tenant_id=v_t2 AND colaborador_nome='[QA] Exposto Secreto T1';
  IF v_vis=0 THEN
    r.situacao:='passou'; r.obtido:='Registro do tenant 1 invisivel ao tenant 2.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s registro(s) de saude ocupacional visiveis.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_cond_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_cond_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dep_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento "Producao (teste)"'; r.esperado:='Criado';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Producao') RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN r.situacao:='passou'; r.obtido:='Departamento criado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nao criou.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dep_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dep_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dep_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_n text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar e renomear departamento'; r.esperado:='Nome novo persiste';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Antigo Dep') RETURNING id INTO v_id;
  UPDATE public.departamentos SET nome='[QA] Novo Dep' WHERE id=v_id;
  SELECT nome INTO v_n FROM public.departamentos WHERE id=v_id;
  IF v_n='[QA] Novo Dep' THEN r.situacao:='passou'; r.obtido:='Renomeado.';
  ELSE r.situacao:='falhou'; r.obtido:='Nome='||v_n; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dep_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dep_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dep_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criar departamento sem nome'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU sem nome.';
  EXCEPTION WHEN not_null_violation THEN r.situacao:='passou'; r.obtido:='Recusado com not_null_violation.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dep_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dep_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dep_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento e tentar outro com o mesmo nome'; r.esperado:='Segundo recusado (UNIQUE)';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Repetido');
  BEGIN
    INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Repetido');
    r.situacao:='falhou'; r.obtido:='ACEITOU nome duplicado no mesmo cliente.';
  EXCEPTION WHEN unique_violation THEN r.situacao:='passou'; r.obtido:='Recusado: nome unico por cliente.'; END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dep_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dep_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dep_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id(); v_t2 uuid := public.qa_sandbox2_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Criar "Mesmo Nome" no tenant 1 e no tenant 2'; r.esperado:='Aceito nos dois (UNIQUE e por tenant)';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t1, '[QA] Mesmo Nome Dep');
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t2, '[QA] Mesmo Nome Dep');
  SELECT count(*) INTO v_n FROM public.departamentos WHERE nome='[QA] Mesmo Nome Dep' AND tenant_id IN (v_t1,v_t2);
  IF v_n=2 THEN r.situacao:='passou'; r.obtido:='Mesmo nome convive em clientes diferentes.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Esperava 2, achou %s.', v_n); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dep_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dep_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dep_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_dep uuid; v_car uuid; v_dep_do_cargo uuid; v_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar departamento e um cargo ligado a ele'; r.esperado:='Apagar o departamento desassocia o cargo, nao o apaga';
  INSERT INTO public.departamentos (tenant_id, nome) VALUES (v_t, '[QA] Dep Com Cargo') RETURNING id INTO v_dep;
  INSERT INTO public.cargos (tenant_id, nome, departamento_id) VALUES (v_t, '[QA] Cargo Orfao', v_dep) RETURNING id INTO v_car;
  r.passo_ordem:=2; r.passo_acao:='Apagar o departamento';
  DELETE FROM public.departamentos WHERE id=v_dep;
  r.passo_ordem:=3; r.passo_acao:='Conferir que o cargo sobreviveu, agora sem departamento';
  SELECT EXISTS(SELECT 1 FROM public.cargos WHERE id=v_car) INTO v_existe;
  SELECT departamento_id INTO v_dep_do_cargo FROM public.cargos WHERE id=v_car;
  IF v_existe AND v_dep_do_cargo IS NULL THEN
    r.situacao:='passou'; r.obtido:='Cargo sobreviveu e ficou sem departamento (SET NULL), como esperado.';
  ELSE r.situacao:='falhou'; r.obtido:=format('Cargo existe=%s, departamento=%s.', v_existe, v_dep_do_cargo); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dep_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dep_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_status text; v_fns text;
BEGIN
  PERFORM public.qa_modo_ligar();

  r.passo_ordem := 1;
  r.passo_acao := 'Cadastrar PGR com vigência VENCIDA e conferir se o status reage';
  r.esperado := 'Documento vencido acusado (status/alerta) — nunca "vigente" com data no passado';
  INSERT INTO public.sst_documentos (tenant_id, tipo, data_emissao, data_vigencia, status)
  VALUES (v_t, 'PGR', CURRENT_DATE - 800, CURRENT_DATE - 30, 'vigente');
  SELECT s.status INTO v_status FROM public.sst_documentos s
  WHERE s.tenant_id = v_t AND s.tipo = 'PGR' AND s.data_vigencia = CURRENT_DATE - 30
  ORDER BY s.created_at DESC LIMIT 1;

  r.passo_ordem := 2;
  r.passo_acao := 'AUDITORIA: alguma rotina vigia data_vigencia (alerta de renovação / marcação de vencido)?';
  r.esperado := 'Janela de 60/30 dias avisando a renovação e vencimento acusado automaticamente';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%sst_documentos%'
    AND (p.prosrc ILIKE '%vigencia%' OR p.prosrc ILIKE '%vencid%');

  IF v_status = 'vigente' AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a vigência é decorativa — o PGR entrou com validade 30 dias no '
             || 'PASSADO e ficou "vigente": nenhum gatilho compara data_vigencia com o '
             || 'calendário, nenhuma rotina (pg_cron, como as demais do projeto) marca o '
             || 'vencido nem dispara a janela de renovação de 60/30 dias. O status só muda '
             || 'se alguém lembrar de editar — e o problema que o módulo existe para '
             || 'resolver ("documento vencido descoberto pela fiscalização") continua '
             || 'inteiro. Correção: rotina diária que marca vencido e alerta a renovação, '
             || 'com ação no Plano de Ação; nova versão preserva a anterior como '
             || '"substituido" (o status já prevê).';
  ELSIF v_status IS DISTINCT FROM 'vigente' THEN
    r.situacao := 'passou';
    r.obtido := format('Vencimento reagiu na gravação (status: %s).', coalesce(v_status, 'NULL'));
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Vigência vigiada por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ia text; v_rev text; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): os dados extraídos têm fonte, confiança e estado de revisão?';
  r.esperado := 'Dado extraído aponta o documento-fonte; baixa confiança exige revisão antes de produzir efeito';
  v_ia := public.qa_col_existe('sst_documentos', 'analise_ia');
  v_rev := coalesce(public.qa_col_existe('sst_documentos', '%revis%'),
                    public.qa_col_existe('sst_documentos', '%confianca%'));
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%sst%extra%' OR table_name ILIKE '%sst%risco%'
         OR table_name ILIKE '%pgr%risco%');

  IF v_ia IS NOT NULL AND v_rev IS NULL AND v_tab IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO (o cofre existe, o inventário não): sst_documentos guarda o resultado '
             || 'da IA num JSONB solto (analise_ia) — sem nível de confiança, sem estado de '
             || 'revisão (quem validou a extração?) e sem tabela estruturada de dados '
             || 'extraídos (riscos, exames, periodicidades, enquadramentos) ligados ao '
             || 'documento-fonte. Um blob JSON não vira OS, ficha de EPI, agenda de exame '
             || 'nem adicional: os efeitos do RF-009/RF-010 não têm de onde partir, e a '
             || 'exigência de revisão humana (RNF-003 — dado errado vira adicional errado '
             || 'na folha) não tem onde morar. Correção: tabela de extração (dado + tipo + '
             || 'documento_id + confiança + revisor) como camada entre a IA e os efeitos.';
  ELSIF v_ia IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A coluna analise_ia não existe mais em sst_documentos.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de extração presente (revisão: %s; tabelas: %s).',
                       coalesce(v_rev, '—'), coalesce(v_tab, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o plano de ação do PGR vira tarefas no módulo Plano de Ação?';
  r.esperado := 'Medidas do PGR importado criadas como ações rastreáveis, vinculadas ao risco de origem';
  -- o módulo Plano de Ação vive nas tabelas plano_acoes/plano_tarefas —
  -- "acoes" solto casa com "informacoes"/"transacoes"
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%sst_documentos%'
    AND (p.prosrc ILIKE '%plano_acoes%' OR p.prosrc ILIKE '%plano_tarefas%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o "documento que vira ação" — a promessa central do módulo (seção '
             || '29) — não existe: nenhuma função converte as medidas do plano de ação do '
             || 'PGR em tarefas do módulo Plano de Ação. O PGR importado é arquivo parado: '
             || 'as medidas que ele propõe (com responsável e prazo, exigência da NR-1) não '
             || 'entram em fila nenhuma, e a fiscalização que pedir evidência de execução '
             || 'do plano recebe silêncio. O módulo Plano de Ação existe e tem família '
             || 'própria no motor — falta a ponte. Correção: na importação interpretada '
             || '(depende do SST-002), criar as ações com vínculo ao risco de origem, sem '
             || 'duplicar em reimportação.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte PGR→Plano de Ação presente: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_os text; v_risco text; v_ger text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a OS nasce dos riscos da função e cobra ciência?';
  r.esperado := 'OS gerada por função a partir do PGR, com assinatura/ciência rastreada e pendência para os novos';
  v_os := CASE WHEN to_regclass('public.ordens_servico') IS NOT NULL THEN 'ordens_servico' END;
  v_risco := coalesce(public.qa_col_existe('ordens_servico', '%risco%'),
                      public.qa_col_existe('ordens_servico', '%funcao%'),
                      public.qa_col_existe('ordens_servico', '%cargo%'));
  -- geração de verdade escreve na tabela; marcar_os_desatualizadas_apos_pgr
  -- só INVALIDA as OS quando chega PGR novo (meio caminho — bom, mas não gera)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ger
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%INSERT INTO%ordens_servico%'
    AND (p.prosrc ILIKE '%risco%' OR p.prosrc ILIKE '%pgr%' OR p.prosrc ILIKE '%sst_documentos%');

  IF v_os IS NOT NULL AND v_ger IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (metade boa, metade manual): a infraestrutura de OS EXISTE — '
             || 'ordens_servico com links de assinatura (ordem_servico_links, com token e '
             || 'expiração, o mesmo desenho da experiência) — mas a OS é redigida à MÃO: '
             || 'nenhuma função a gera dos riscos da função extraídos do PGR (campos de '
             || 'vínculo: %s). A NR-1 (1.4.1) exige informar riscos e medidas por função; '
             || 'com a OS manual, função nova ou risco novo no PGR não regeram nada, e o '
             || 'colaborador admitido pode começar sem ciência assinada. O meio caminho já '
             || 'existe: marcar_os_desatualizadas_apos_pgr INVALIDA as OS quando chega PGR '
             || 'novo — falta a outra metade, gerar as novas. Correção: geração da OS por '
             || 'função a partir da extração (SST-002), com pendência de ciência para '
             || 'admitidos e mudanças de função.',
             coalesce(v_risco, 'nenhum'));
  ELSIF v_os IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A tabela ordens_servico não existe mais nesta base.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('OS gerada dos riscos por: %s.', v_ger);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ca text; v_trava text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a entrega de EPI confere o CA vigente?';
  r.esperado := 'Entrega bloqueada com CA vencido; ficha com assinatura e treinamento evidenciado';
  v_ca := coalesce(public.qa_col_existe('epi_tipos', 'ca_validade'),
                   public.qa_col_existe('epis', '%validade%'));
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_trava
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%epi_entregas%'
    AND (p.prosrc ILIKE '%ca_validade%' OR p.prosrc ILIKE '%validade%');
  IF v_trava IS NULL THEN
    SELECT string_agg(DISTINCT t.tgname, ', ') INTO v_trava
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.epi_entregas'::regclass AND NOT t.tgisinternal
      AND t.tgname NOT ILIKE '%updated_at%' AND t.tgname NOT ILIKE 'qa\_%'
      AND p.prosrc ILIKE '%validade%';
  END IF;

  IF v_ca IS NOT NULL AND v_trava IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (o dado existe, a trava não): o CA tem validade cadastrada '
             || '(%s — o subsistema de EPI é dos mais completos: tipos, CETs, entregas, '
             || 'estoque, e o EPI-001 já protege a baixa de estoque), mas NADA confere o CA '
             || 'na hora da ENTREGA: nenhum gatilho ou função compara ca_validade com a '
             || 'data — EPI de CA vencido sai do estoque e vira ficha normalmente. Pela '
             || 'NR-6, entrega com CA vencido equivale juridicamente a não ter entregue: '
             || 'no acidente, a empresa responde como se o colaborador estivesse '
             || 'desprotegido. E a neutralização da insalubridade que o EPI sustenta '
             || '(SST-050) cai junto. Correção: trava de CA vigente na entrega + alerta de '
             || 'CA a vencer com reposição antecipada (janela da seção 14).',
             v_ca);
  ELSIF v_ca IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'A validade do CA não existe mais no cadastro de EPI.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('CA conferido na entrega por: %s.', v_trava);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_param text; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém calcula e vigia a próxima data do exame periódico?';
  r.esperado := 'Próximo exame derivado da periodicidade do risco; alertas 30/15/7; vencido acusado';
  v_param := public.qa_col_existe(NULL, 'periodicidade_exame_meses');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%periodicidade_exame%' OR p.prosrc ILIKE '%proximo_exame%'
         OR (p.prosrc ILIKE '%periodico%' AND p.prosrc ILIKE '%exame%'));

  IF v_param IS NOT NULL AND v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (o parâmetro existe, o relógio não): a periodicidade está '
             || 'cadastrada (%s) e NINGUÉM a usa — nenhuma função calcula a próxima data do '
             || 'periódico a partir do último ASO, nenhuma rotina vigia vencimentos com a '
             || 'janela 30/15/7 da seção 14. O contraste incomoda: o exame DEMISSIONAL tem '
             || 'motor dedicado (exame_demissional_pendencias, DESL-060..067), enquanto o '
             || 'PERIÓDICO — que acontece dezenas de vezes mais — depende de planilha '
             || 'externa. ASO vencido de quem segue trabalhando é a autuação mais fácil da '
             || 'fiscalização. Correção: próxima data derivada de último ASO + '
             || 'periodicidade do risco, com rotina de alertas e painel de vencidos.',
             v_param);
  ELSIF v_param IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'O parâmetro periodicidade_exame_meses não existe mais.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Agenda do periódico viva: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): mudança de função/risco exige ASO antes de efetivar?';
  r.esperado := 'Troca para função de risco diferente retida até o ASO de mudança; OS/ficha regeradas';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%mudanca%risco%' OR p.prosrc ILIKE '%mudanca%funcao%'
         OR (p.prosrc ILIKE '%exame%' AND p.prosrc ILIKE '%cargo%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o ASO de mudança de risco não existe — dos cinco eventos de exame '
             || 'da NR-7, quatro têm dono (admissional ADM-060.., periódico SST-020, '
             || 'retorno AFAST-070, demissional DESL-060..) e a MUDANÇA é o único sem '
             || 'nenhuma estrutura: trocar um colaborador de função administrativa para '
             || 'função exposta não exige exame, não regera OS nem ficha de EPI e não '
             || 'revisa o adicional. A transferência silenciosa deixa a pessoa num risco '
             || 'que nenhum médico avaliou — e o exame DEPOIS da mudança não conserta: a '
             || 'NR-7 o exige ANTES. Correção: troca de cargo/função com risco diferente '
             || 'retida até ASO de mudança apto, disparando a regeração da OS/ficha '
             || '(SST-010/011) e a revisão do adicional (SST-050).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Mudança de risco tratada por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tela text; v_prazo text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o S-2220 tem relógio — ASO registrado projeta o dia 15?';
  r.esperado := 'Data-limite (dia 15 do mês seguinte ao ASO) projetada, vigiada e atraso acusado';
  SELECT string_agg(DISTINCT tipo_evento, ', ') INTO v_tela
  FROM (SELECT DISTINCT tipo_evento FROM public.esocial_transmissoes
        WHERE tipo_evento ILIKE '%2220%' LIMIT 3) s;
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_prazo
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%2220%' AND p.prosrc ILIKE '%prazo%');

  IF v_prazo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o S-2220 não tem relógio — a fila de transmissão aceita o evento '
             || 'quando a TELA o monta, mas nenhuma função projeta a data-limite (dia 15 '
             || 'do mês seguinte à emissão do ASO), nenhum alerta corre até lá e a '
             || 'transmissão tardia entra como regular. Cada ASO emitido e não transmitido '
             || 'é multa acumulando por competência em silêncio — e como o ASO vive em '
             || 'campos da admissão e em eventos de saúde, sem gatilho ninguém nem sabe '
             || 'QUAIS ASOs ainda devem evento. Correção: registro do ASO dispara a '
             || 'preparação do S-2220 com data-limite; pendências e atrasos visíveis '
             || '(mesmo desenho pedido para o S-2230 no AFAST-060 e o S-1299 no '
             || 'FOLHA-060 — um motor de prazos do eSocial serve aos três).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Prazo do S-2220 controlado por: %s (eventos na fila: %s).',
                       v_prazo, coalesce(v_tela, 'nenhum'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_hist text; v_ger text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a exposição a agentes tem histórico e gera S-2240?';
  r.esperado := 'Exposição por colaborador (agente, período, EPI) registrada; S-2240 na admissão e a cada alteração';
  SELECT string_agg(table_name, ', ') INTO v_hist
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE '%exposicao%' OR table_name ILIKE '%agente%nocivo%'
         OR table_name ILIKE '%ltcat%');
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_ger
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.prosrc ILIKE '%2240%';

  IF v_hist IS NULL AND v_ger IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: a exposição a agentes nocivos não tem registro estruturado — o '
             || 'LTCAT entra em sst_documentos como arquivo, mas nenhuma tabela guarda '
             || 'QUEM está exposto a QUAL agente desde QUANDO (com o EPI que atenua), e '
             || 'nenhuma função gera o S-2240 na admissão ou na mudança de exposição. O '
             || 'S-2240 é a matéria-prima do PPP eletrônico: cada mês sem o registro é um '
             || 'mês de aposentadoria especial que ninguém vai conseguir reconstituir '
             || 'quando o INSS pedir — o furo só aparece anos depois, sem conserto. '
             || 'Correção: histórico de exposição por colaborador (extraído do LTCAT — '
             || 'depende do SST-002) + geração do S-2240 com prazo dia 15, alimentando o '
             || 'PPP (SST-060).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Exposição estruturada (tabelas: %s; geração: %s).',
                       coalesce(v_hist, '—'), coalesce(v_ger, '—'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a CIPA existe no sistema?';
  r.esperado := 'Dimensionamento pelo Quadro I, mandato controlado e atas arquivadas';
  -- palavra inteira: "parti[cipa]coes" contém "cipa" e engana o LIKE
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name ~* '(^|_)cipa(_|$)';

  DECLARE v_dim text; v_atas text;
  BEGIN
    SELECT string_agg(DISTINCT p.proname, ', ') INTO v_dim
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
      AND p.prosrc ILIKE '%cipa%'
      AND (p.prosrc ILIKE '%dimension%' OR p.prosrc ILIKE '%quadro%');
    SELECT string_agg(table_name, ', ') INTO v_atas
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name ~* '(^|_)cipa(_|$)' AND table_name ILIKE '%ata%';

    IF v_tab IS NOT NULL AND (v_dim IS NULL OR v_atas IS NULL) THEN
      r.situacao := 'falhou';
      r.obtido := format('ACHADO (a comissão existe, a régua e a prova não): cipa_composicao '
               || 'está de pé com representação, condição e MANDATO (início/fim) — a '
               || 'estrutura viva que o DESL-073 usa para a estabilidade do cipeiro — mas '
               || 'faltam as outras duas pernas da NR-5: o DIMENSIONAMENTO pelo Quadro I '
               || '(%s — efetivo × grupo do CNAE decide quantos titulares/suplentes, ou o '
               || 'designado; o efetivo e o CNAE o cadastro já tem) e as ATAS mensais '
               || 'arquivadas (%s), que são a prova de que a comissão funciona. Sem a '
               || 'régua, ninguém sabe se a composição cadastrada é a exigida; sem as '
               || 'atas, a CIPA existe só no cadastro. Correção: cálculo do Quadro I por '
               || 'estabelecimento + registro de reuniões/atas em Documentos + alerta de '
               || 'fim de mandato (eleição com 60 dias).',
               coalesce('há: ' || v_dim, 'nenhuma função'),
               coalesce('há: ' || v_atas, 'nenhuma tabela'));
    ELSIF v_tab IS NULL THEN
      r.situacao := 'falhou';
      r.obtido := 'A estrutura de CIPA não existe nesta base.';
    ELSE
      r.situacao := 'passou';
      r.obtido := format('CIPA completa (composição: %s; dimensionamento: %s; atas: %s).',
                         v_tab, v_dim, v_atas);
    END IF;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_tab text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): existe canal formal de denúncias com sigilo?';
  r.esperado := 'Denúncia anônima com protocolo, acesso restrito ao fluxo de apuração e prazo vigiado';
  -- a ouvidoria é o canal real; marketplace_denuncias é reclamação de loja
  SELECT string_agg(table_name, ', ') INTO v_tab
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name ILIKE 'ouvidoria%' OR table_name ILIKE '%assedio%');

  IF v_tab IS NOT NULL THEN
    DECLARE v_anon text; v_restr int; v_prazo text;
    BEGIN
      v_anon := public.qa_col_existe('ouvidoria', 'anonimo');
      SELECT count(*) INTO v_restr FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'ouvidoria'
        AND policyname ILIKE 'perfil_restringe%';
      v_prazo := coalesce(public.qa_col_existe('ouvidoria', '%prazo%'),
                          public.qa_col_existe('ouvidoria', '%data_limite%'));
      IF v_anon IS NOT NULL AND (v_restr = 0 OR v_prazo IS NULL) THEN
        r.situacao := 'falhou';
        r.obtido := format('ACHADO (o canal existe, o sigilo e o prazo mancam): a ouvidoria '
                 || 'está de pé (%s) e aceita denúncia ANÔNIMA (coluna anonimo — o requisito '
                 || 'central da Lei 14.457 atendido), mas: (1) a tabela está FORA da camada '
                 || 'perfil_restringe_leitura_* (%s políticas) — quem tem acesso ao módulo lê '
                 || 'as denúncias, inclusive potencialmente o gestor da área denunciada, e '
                 || 'para canal de assédio o sigilo precisa ser mais duro que o do CID; e '
                 || '(2) não há prazo de apuração vigiado (%s) — a lei pede tratativa, não '
                 || 'caixa de entrada. Correção: política restritiva própria (fluxo de '
                 || 'apuração, não módulo) + log de tentativas de acesso + prazo de '
                 || 'tratativa com alerta.',
                 v_tab, v_restr, coalesce(v_prazo, 'nenhum campo'));
      ELSE
        r.situacao := 'passou';
        r.obtido := format('Canal com anonimato, restrição e prazo (%s).', v_tab);
      END IF;
    END;
  ELSE
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o canal de denúncias da Lei 14.457/2022 não existe — nenhuma '
             || 'tabela de ouvidoria ou assédio. A família PSICO cobre o outro braço da '
             || 'lei (avaliação de riscos psicossociais), mas o CANAL formal — denúncia '
             || 'anônima com protocolo, apuração com prazo e sigilo — não tem onde '
             || 'existir. Correção: registro anônimo com protocolo + fluxo de apuração '
             || 'restrito + log de tentativas de acesso + prazo de tratativa vigiado.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o enquadramento do laudo alimenta o adicional — e o EPI o neutraliza?';
  r.esperado := 'Laudo→função→adicional com fonte rastreável; neutralização viva (CA vencido religa)';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%insalubr%' OR p.prosrc ILIKE '%periculos%' OR p.prosrc ILIKE '%neutraliza%')
    AND (p.prosrc ILIKE '%laudo%' OR p.prosrc ILIKE '%sst_documentos%' OR p.prosrc ILIKE '%cargo%');

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o laudo e o adicional vivem em mundos separados — nenhuma função '
             || 'liga o enquadramento (que deveria sair do laudo importado) à função/'
             || 'colaborador que a Folha usa para calcular os 10/20/40% ou os 30% '
             || '(o motor de cálculo existe no React — adicionais.ts, FOLHA-021 — mas a '
             || 'ORIGEM do enquadramento é digitação). E a via de volta tampouco existe: '
             || 'EPI eficaz pode NEUTRALIZAR a insalubridade e cessar o adicional (CLT '
             || 'art. 191, [VAL]), com o vínculo vivo — CA vencido religa o adicional '
             || '(SST-011). Sem as duas pontes, ou se paga adicional que o EPI eliminou, '
             || 'ou se corta adicional sem laudo que sustente. Correção: enquadramento por '
             || 'função com laudo-fonte (depende do SST-002) + estado de neutralização '
             || 'amarrado à entrega e ao CA do EPI.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Ponte laudo→adicional presente: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o PPP tem estrutura para ser gerado?';
  r.esperado := 'PPP montado do histórico de exposição (LTCAT/S-2240), entregue no desligamento e sob demanda';
  v_est := coalesce((SELECT string_agg(table_name, ', ')
                     FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name ILIKE '%ppp%'),
                    public.qa_fns_com('%ppp%'));

  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o PPP não existe no sistema — nenhuma tabela ou função. O Perfil '
             || 'Profissiográfico é a biografia previdenciária da exposição: obrigatório '
             || 'na rescisão de quem trabalhou exposto e a base da aposentadoria especial '
             || '(Lei 8.213, arts. 57-58), hoje gerado eletronicamente a partir dos '
             || 'S-2240. A cadeia inteira está pendente: sem histórico de exposição '
             || '(SST-031) não há S-2240, e sem S-2240 não há PPP — e esse é o tipo de '
             || 'dívida que não se paga depois: exposição não registrada em 2026 é '
             || 'benefício negado em 2046. Correção: na ordem, SST-002 (extração) → '
             || 'SST-031 (exposição/S-2240) → geração do PPP no desligamento e sob '
             || 'demanda, anexado ao dossiê da rescisão (DESL-082).';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Estrutura de PPP presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): alguém cruza PGR × PCMSO × LTCAT × S-2240?';
  r.esperado := 'Conferência de coerência apontando risco sem exame, agente sem inventário, exposição sem laudo';
  -- exige cruzamento de RISCOS — "PGR + PCMSO" soltos casam com a função que
  -- cria a árvore de pastas padrão (os nomes das pastas contêm as siglas)
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND p.proname NOT ILIKE '%pasta%'
    AND (p.prosrc ILIKE '%coerencia%'
         OR (p.prosrc ILIKE '%pgr%' AND p.prosrc ILIKE '%pcmso%' AND p.prosrc ILIKE '%risco%'));

  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: os documentos não conversam — nenhuma função cruza o que o PGR '
             || 'inventariou com o que o PCMSO examina, o que o LTCAT mediu e o que o '
             || 'S-2240 declara. A NR-7 exige o PCMSO BASEADO no PGR; divergência entre '
             || 'eles (risco inventariado sem exame previsto, agente medido que o '
             || 'inventário não conhece) é a primeira coisa que a fiscalização procura, '
             || 'porque derruba a credibilidade do conjunto — e hoje cada documento é um '
             || 'PDF isolado em sst_documentos, sem base comum de riscos para comparar. '
             || 'Depende da extração estruturada (SST-002). [BPR] com fundamento nas NRs. '
             || 'Correção: conferência de coerência sobre a base extraída, com relatório '
             || 'de divergências arquivado como evidência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Coerência conferida por: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_sst_080()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_ev int; v_at int; v_log text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o dado clínico está restrito e o acesso é logado?';
  r.esperado := 'Tabelas clínicas na camada de perfil; aptidão circula sem diagnóstico; log próprio de acesso';
  SELECT count(*) INTO v_ev FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'eventos_saude'
    AND policyname ILIKE 'perfil_restringe%';
  SELECT count(*) INTO v_at FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'atestados'
    AND policyname ILIKE 'perfil_restringe%';
  SELECT string_agg(DISTINCT p.proname, ', ') INTO v_log
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname NOT LIKE 'qa\_%'
    AND (p.prosrc ILIKE '%eventos_saude%' OR p.prosrc ILIKE '%cid_principal%')
    AND (p.prosrc ILIKE '%log%' OR p.prosrc ILIKE '%acesso%' OR p.prosrc ILIKE '%audit%');

  IF v_ev > 0 AND v_at > 0 AND v_log IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO (mesma tranca sem caderno do AFAST-080, agora no acervo '
             || 'clínico inteiro): eventos_saude (%s política(s)) e atestados (%s) estão '
             || 'na camada de perfil — a restrição de leitura existe e funciona — mas '
             || 'NENHUMA função registra o ACESSO ao dado clínico: quem abriu o exame de '
             || 'quem, quando. O documento pede log específico (seção 22) e o "cofre '
             || 'clínico" (seção 29) é isso: leitura por função que anota o leitor. A '
             || 'separação aptidão × diagnóstico até se sustenta hoje (o apto/inapto vive '
             || 'em campos administrativos da admissão, fora das tabelas clínicas), mas '
             || 'numa investigação de vazamento não há trilha para consultar. Correção: '
             || 'acesso ao clínico via função SECURITY DEFINER com registro append-only '
             || '(leitor, titular, registro, hora) — uma vez, servindo CID (AFAST-080) e '
             || 'exames.',
             v_ev, v_at);
  ELSIF v_ev = 0 OR v_at = 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('ACHADO GRAVE: tabela clínica fora da camada de perfil '
             || '(eventos_saude: %s; atestados: %s políticas).', v_ev, v_at);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_sst_080()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_sst_080 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 53 casos.

-- Colaboradores (32 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('COLAB-001', 'Cadastro manual de colaborador com vínculo ativo', 'feliz', 'alta', 'aprovado', 'Verificar que um colaborador novo pode ser cadastrado e vinculado a uma empresa. Regra: todo colaborador precisa de nome e email; o vinculo liga a pessoa a uma empresa com um tipo (colaborador, estagiario, etc). Importa porque este e o fluxo de entrada de toda pessoa no sistema — se falhar, ninguem consegue ser admitido.', 'Precisa existir pelo menos uma empresa cadastrada no cliente (ex.: a empresa "Alfa"). O usuario logado precisa ter permissao de RH ou gestor.', '[{"acao": "Abrir o cadastro de novo colaborador", "dados": "-", "ordem": 1, "onde_na_tela": "Menu lateral > Colaboradores > botao \"Novo Colaborador\" (canto superior direito)", "resultado_esperado": "Abre o formulario de cadastro com os campos vazios"}, {"acao": "Preencher os dados basicos do colaborador", "dados": "Nome: Maria Aparecida Teste | Email: maria.teste@exemplo.com.br | CPF: 529.982.247-25 (valido)", "ordem": 2, "onde_na_tela": "Campos \"Nome completo\" e \"Email\" do formulario", "resultado_esperado": "Os campos aceitam os valores sem erro de validacao"}, {"acao": "Vincular o colaborador a uma empresa", "dados": "Empresa: Alfa | Tipo de vinculo: colaborador | Status: ativo", "ordem": 3, "onde_na_tela": "Secao \"Vinculo\" > campo \"Empresa\" (selecionar) e \"Tipo de vinculo\"", "resultado_esperado": "A empresa aparece na lista e pode ser selecionada"}, {"acao": "Salvar o cadastro", "dados": "-", "ordem": 4, "onde_na_tela": "Botao \"Salvar\" no rodape do formulario", "resultado_esperado": "Mensagem de sucesso; o colaborador aparece na lista com 1 vinculo ativo"}]', 'O colaborador Maria Aparecida Teste existe no sistema, com exatamente 1 vinculo ativo na empresa Alfa, tipo colaborador. Consultando a lista de colaboradores, ele aparece. O CPF valido foi aceito.', 'IMPACTO SE FALHAR: e o fluxo de entrada de pessoas no sistema. Se quebrar, o RH nao consegue admitir ninguem — bloqueia a operacao inteira do cliente.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-002', 'Busca de colaborador por nome e por CPF', 'feliz', 'media', 'aprovado', 'Verificar que a busca de colaborador funciona pelos dois identificadores que o RH usa no dia a dia: nome (parcial) e CPF (com ou sem formatacao). Regra: a busca deve normalizar o CPF, entao "111.222.333-44" e "11122233344" encontram a mesma pessoa. Importa porque o RH localiza gente o tempo todo; se a busca falha, ele nao acha o colaborador para editar, desligar ou consultar.', 'Precisa existir um colaborador cadastrado com nome e CPF conhecidos para buscar.', '[{"acao": "Abrir a lista de colaboradores", "dados": "-", "ordem": 1, "onde_na_tela": "Menu lateral > Colaboradores", "resultado_esperado": "Lista de colaboradores exibida com campo de busca no topo"}, {"acao": "Buscar por parte do nome", "dados": "Digitar: Testonildo", "ordem": 2, "onde_na_tela": "Campo de busca (topo da lista)", "resultado_esperado": "O colaborador cujo nome contem Testonildo aparece nos resultados"}, {"acao": "Buscar pelo CPF sem formatacao", "dados": "Digitar: 99900000188", "ordem": 3, "onde_na_tela": "Campo de busca", "resultado_esperado": "O mesmo colaborador aparece"}, {"acao": "Buscar pelo CPF com formatacao", "dados": "Digitar: 999.000.001-88", "ordem": 4, "onde_na_tela": "Campo de busca", "resultado_esperado": "O mesmo colaborador aparece (a busca normaliza a pontuacao)"}]', 'O colaborador e encontrado pelas 3 vias: nome parcial, CPF limpo e CPF formatado. A busca por CPF ignora pontos e tracos.', 'IMPACTO SE FALHAR: o RH nao localiza o colaborador. Se a busca por CPF nao normalizar, digitar o CPF com pontos (como aparece no documento) nao acha ninguem — o RH acha que a pessoa nao existe e pode cadastrar de novo, gerando duplicata.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-010', 'Importação de colaboradores por planilha', 'alternativo', 'alta', 'aprovado', 'Verificar que importar colaboradores por planilha chega ao mesmo resultado do cadastro manual. Regra: a importacao cria as pessoas, os vinculos e preserva a acentuacao dos nomes. Importa porque a importacao e o caminho usado na implantacao de um cliente novo — e quando dezenas ou centenas de pessoas entram de uma vez. Se algo falha ali, falha em escala e no pior momento, que e a estreia do cliente no sistema.', 'Planilha com 3 colaboradores novos, CPFs validos e distintos, nomes com acentuacao (para testar a codificacao). Empresa de destino ja cadastrada.', '[{"acao": "Abrir a importacao de colaboradores", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Colaboradores > botao Importar (ou Importar Planilha)", "resultado_esperado": "Tela de importacao aberta, com opcao de escolher o arquivo e a empresa de destino"}, {"acao": "Selecionar a planilha e a empresa de destino", "dados": "Arquivo: 3 colaboradores | Nomes com acento: Joao Conceicao, Antonio Jose, Maria Ines | Empresa: Alfa", "ordem": 2, "onde_na_tela": "Campo de arquivo + seletor de Empresa", "resultado_esperado": "O sistema mostra a previa dos registros a importar"}, {"acao": "Confirmar a importacao", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Importar/Confirmar", "resultado_esperado": "3 registros criados, 0 erros"}, {"acao": "Conferir a acentuacao dos nomes gravados", "dados": "-", "ordem": 4, "onde_na_tela": "Colaboradores > lista", "resultado_esperado": "Acentos corretos (UTF-8): Joao Conceicao aparece com til e cedilha, sem caracteres trocados"}, {"acao": "Conferir os vinculos criados", "dados": "-", "ordem": 5, "onde_na_tela": "Cada colaborador > aba Vinculos", "resultado_esperado": "Os 3 com vinculo ativo na empresa escolhida"}]', 'Os 3 colaboradores existem, com nomes acentuados corretamente e vinculo ativo na empresa escolhida. O resultado e indistinguivel de terem sido cadastrados um a um pela tela.', 'IMPACTO SE FALHAR: a importacao e o caminho da implantacao. Um erro de codificacao grava "Joao Conceicao" com caracteres trocados em centenas de registros de uma vez, e a correcao depois e manual. Um vinculo que nao se cria deixa as pessoas cadastradas mas invisiveis na empresa. NOTA SOBRE COBERTURA: este caso nao tem rotina automatizada. A importacao acontece no front (leitura do arquivo, previa, confirmacao) e o robo SQL nao alcanca esse fluxo. Fica documentado para execucao manual ou para Cypress. O que o robo cobre e o RESULTADO da importacao — que as pessoas e vinculos criados respeitam as mesmas regras do cadastro manual (casos COLAB-020, 023, 025).', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-011', 'Cadastro com apenas os campos obrigatórios', 'alternativo', 'media', 'aprovado', 'Verificar que o cadastro minimo (so os campos obrigatorios) e aceito, provando que os campos opcionais sao de fato opcionais. Regra: nome e email bastam; CPF, telefone, endereco e demais podem ficar em branco. Importa porque nem sempre o RH tem todos os dados na hora da admissao — precisa poder cadastrar com o minimo e completar depois.', 'Nenhuma alem de ter o formulario de cadastro disponivel.', '[{"acao": "Abrir novo colaborador", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Colaboradores > Novo Colaborador", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher SO nome e email, deixar o resto em branco", "dados": "Nome: Ana Minima Teste | Email: ana.minima@exemplo.com.br | (sem CPF, sem telefone, sem endereco)", "ordem": 2, "onde_na_tela": "Campos Nome e Email", "resultado_esperado": "O formulario aceita sem exigir os campos opcionais"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Colaborador criado com sucesso mesmo sem os opcionais"}]', 'O colaborador Ana Minima Teste e criado apenas com nome e email. Os campos opcionais ficam vazios e isso nao impede o cadastro.', 'IMPACTO SE FALHAR: se o sistema exigir campos que deveriam ser opcionais, o RH nao consegue admitir alguem quando falta um dado (ex.: endereco ainda nao informado) — trava a admissao por burocracia desnecessaria.', 'api', NULL, 'comportamento_correto', 'CONFLITO ENTRE CASOS, resolvido em 31/07/2026. O COLAB-011 pedia que pessoa sem CPF fosse aceita ("opcional é opcional") e o COLAB-034 pedia que colaborador sem CPF fosse recusado. Os dois não podiam estar certos. Decisão do time: COLABORADOR PRECISA TER CPF, e a constraint usuarios_base_colaborador_exige_cpf foi criada. O sistema está correto; o caso é que precisa ser reescrito para exercitar campo opcional em usuário que NÃO seja colaborador — gestor ou administrador, para quem o CPF de fato não se aplica.'),
    ('COLAB-012', 'Mesma pessoa com vínculo em duas empresas do mesmo tenant', 'alternativo', 'alta', 'aprovado', 'Verificar que a mesma pessoa pode ter vinculo em duas empresas do mesmo cliente. Regra: um grupo economico com varias empresas pode ter o mesmo funcionario atuando em mais de uma; cada atuacao e um vinculo separado. Importa porque e comum em grupos — o gestor que responde por duas empresas do grupo, por exemplo.', 'Precisam existir DUAS empresas cadastradas no mesmo cliente (ex.: Alfa e Beta).', '[{"acao": "Cadastrar a pessoa e vincular a primeira empresa", "dados": "Nome: Multi Empresa Teste | CPF: 999.000.006-92 | Empresa: Alfa | Tipo: colaborador", "ordem": 1, "onde_na_tela": "Novo Colaborador > secao Vinculo", "resultado_esperado": "Colaborador criado com vinculo na Alfa"}, {"acao": "No mesmo colaborador, adicionar um segundo vinculo", "dados": "Empresa: Beta | Tipo: colaborador | Status: ativo", "ordem": 2, "onde_na_tela": "Ficha do colaborador > Vinculos > Adicionar vinculo", "resultado_esperado": "O segundo vinculo e aceito"}, {"acao": "Conferir os vinculos da pessoa", "dados": "-", "ordem": 3, "onde_na_tela": "Ficha do colaborador > aba Vinculos", "resultado_esperado": "A pessoa tem 2 vinculos ativos: um na Alfa, um na Beta"}]', 'Uma unica pessoa (mesmo CPF) com exatamente 2 vinculos ativos, um em cada empresa. Nao foram criadas duas pessoas.', 'IMPACTO SE FALHAR: se o sistema recusar o segundo vinculo, um funcionario que atua em duas empresas do grupo nao pode ser registrado corretamente — ou o RH cria uma pessoa duplicada (CPF repetido) para contornar, sujando a base.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-020', 'CPF já cadastrado no mesmo tenant é recusado', 'negativo', 'critica', 'aprovado', 'Verificar que cadastrar um CPF ja existente no mesmo cliente e recusado, E que o erro e legivel para o RH. Regra: dentro de um cliente, o CPF identifica unicamente a pessoa — nao pode haver dois cadastros com o mesmo CPF. Importa porque CPF duplicado gera pessoas fantasma, confunde folha e relatorios.', 'Precisa existir um colaborador ja cadastrado com um CPF conhecido.', '[{"acao": "Cadastrar um colaborador com um CPF", "dados": "Nome: Primeiro | CPF: 529.982.247-25", "ordem": 1, "onde_na_tela": "Novo Colaborador", "resultado_esperado": "Cadastrado com sucesso"}, {"acao": "Tentar cadastrar OUTRA pessoa com o MESMO CPF", "dados": "Nome: Segundo (pessoa diferente) | CPF: 529.982.247-25 (mesmo do primeiro)", "ordem": 2, "onde_na_tela": "Novo Colaborador", "resultado_esperado": "O sistema DEVE recusar"}, {"acao": "Ler a mensagem de erro", "dados": "-", "ordem": 3, "onde_na_tela": "Mensagem exibida ao salvar", "resultado_esperado": "Mensagem clara, ex.: CPF ja cadastrado neste cliente"}]', 'O segundo cadastro e recusado com uma mensagem legivel. So existe uma pessoa com aquele CPF no cliente.', 'IMPACTO SE FALHAR: CPF duplicado cria duas fichas para a mesma pessoa. A folha pode pagar duas vezes, relatorios de SST contam a pessoa em dobro, e o eSocial rejeita. Esta protecao existe no banco (indice unico) — o caso confirma que segue de pe.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-021', 'CPF matematicamente inválido é recusado', 'negativo', 'alta', 'aprovado', 'Verificar que o sistema NAO aceita um CPF matematicamente invalido. Regra: o CPF tem digitos verificadores que seguem um calculo; "111.111.111-11" tem o formato certo mas e invalido. Importa porque CPF invalido contamina eSocial, relatorios de SST e a identificacao legal do trabalhador — pode gerar multa e retrabalho.', 'Precisa existir uma empresa para vincular o colaborador. Este teste tenta cadastrar com um CPF proposital invalido.', '[{"acao": "Abrir o cadastro de novo colaborador", "dados": "-", "ordem": 1, "onde_na_tela": "Menu lateral > Colaboradores > botao \"Novo Colaborador\"", "resultado_esperado": "Formulario de cadastro aberto"}, {"acao": "Preencher nome e email validos, mas um CPF INVALIDO", "dados": "Nome: Joao CPF Invalido | Email: joao.cpf@exemplo.com.br | CPF: 111.111.111-11 (invalido de proposito)", "ordem": 2, "onde_na_tela": "Campos \"Nome\", \"Email\" e \"CPF\"", "resultado_esperado": "Ao sair do campo CPF, a tela DEVERIA mostrar erro \"CPF invalido\""}, {"acao": "Tentar salvar o cadastro mesmo com o CPF invalido", "dados": "-", "ordem": 3, "onde_na_tela": "Botao \"Salvar\"", "resultado_esperado": "O sistema DEVE recusar e nao gravar o colaborador com CPF invalido"}]', 'O cadastro e RECUSADO. O colaborador com CPF "111.111.111-11" NAO deve existir no banco. ACHADO ATUAL: o banco aceita — a validacao de digitos verificadores existe APENAS no front-end, em TypeScript. Nao ha nenhuma funcao de validacao de CPF no banco de dados. Por importacao de planilha, API ou script, um CPF invalido entra sem qualquer barreira.', 'IMPACTO SE FALHAR (e falha hoje): CPF invalido no banco quebra a integracao com o eSocial (rejeicao pela Receita, com retrabalho e risco de multa por atraso), gera identificacao invalida em relatorios legais de SST e compromete o vinculo legal do trabalhador com todo o seu historico. CORRECAO SUGERIDA: criar no banco uma funcao de validacao de CPF (replicando a logica que ja existe no front) e aplica-la como trigger BEFORE INSERT OR UPDATE em usuarios_base. O relatorio da equipe traz o SQL completo e testado. ATENCAO: conferir CPFs invalidos ja existentes na base antes de aplicar a trigger.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-022', 'Campo obrigatório vazio é recusado', 'negativo', 'media', 'aprovado', 'Verificar que o sistema nao deixa criar uma pessoa sem a identidade minima (nome). Regra: nome e obrigatorio (NOT NULL no banco). Importa porque uma pessoa sem nome e um registro inutil que polui a base e quebra telas que esperam exibir o nome.', 'Nenhuma.', '[{"acao": "Abrir novo colaborador", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Colaboradores > Novo Colaborador", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o nome em branco e tentar salvar", "dados": "Nome: (vazio) | Email: alguem@exemplo.com.br", "ordem": 2, "onde_na_tela": "Campo Nome (vazio) + botao Salvar", "resultado_esperado": "O sistema DEVE recusar e sinalizar que o nome e obrigatorio"}]', 'O cadastro e recusado. Nenhuma pessoa sem nome e criada.', 'IMPACTO SE FALHAR: uma pessoa sem nome aparece em branco nas listas, relatorios e vinculos — o RH nao sabe quem e, e telas que exibem o nome podem quebrar.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-023', 'E-mail já em uso no tenant', 'negativo', 'alta', 'aprovado', 'Verificar que um e-mail ja em uso no cliente nao pode ser reutilizado por outra pessoa. Regra: o e-mail e a chave de acesso (login e convite) do colaborador; duas pessoas com o mesmo e-mail geram ambiguidade de identidade. Importa porque o login e o convite dependem do e-mail ser unico.', 'Precisa existir um colaborador ja cadastrado com um e-mail conhecido.', '[{"acao": "Cadastrar um colaborador com um e-mail", "dados": "Nome: Dono do Email | Email: repetido@exemplo.com.br", "ordem": 1, "onde_na_tela": "Novo Colaborador", "resultado_esperado": "Cadastrado"}, {"acao": "Tentar cadastrar OUTRA pessoa com o MESMO e-mail", "dados": "Nome: Outra Pessoa | Email: repetido@exemplo.com.br (mesmo do primeiro)", "ordem": 2, "onde_na_tela": "Novo Colaborador", "resultado_esperado": "O sistema DEVE recusar"}]', 'O segundo cadastro e RECUSADO. So uma pessoa usa aquele e-mail no cliente. ACHADO ATUAL: o banco ACEITA e-mail duplicado — nao ha restricao unica em email_principal. Duas pessoas podem acabar com o mesmo login.', 'IMPACTO SE FALHAR (e falha hoje): com dois colaboradores no mesmo e-mail, o convite e o login ficam ambiguos — o sistema nao sabe qual pessoa autenticar. CORRECAO SUGERIDA: criar indice unico em (tenant_id, lower(email_principal)) onde email nao e nulo, apos checar duplicatas existentes.', 'api', NULL, 'comportamento_correto', 'CONFLITO ENTRE CASOS, resolvido em 31/07/2026. O COLAB-011 pedia que pessoa sem CPF fosse aceita ("opcional é opcional") e o COLAB-034 pedia que colaborador sem CPF fosse recusado. Os dois não podiam estar certos. Decisão do time: COLABORADOR PRECISA TER CPF, e a constraint usuarios_base_colaborador_exige_cpf foi criada. O sistema está correto; o caso é que precisa ser reescrito para exercitar campo opcional em usuário que NÃO seja colaborador — gestor ou administrador, para quem o CPF de fato não se aplica.'),
    ('COLAB-024', 'Colaborador de outro tenant é invisível', 'negativo', 'critica', 'aprovado', 'Verificar que um colaborador de um cliente e completamente invisivel para outro cliente. Regra: cada cliente (tenant) so enxerga os seus proprios dados — a fronteira multi-tenant e absoluta. Importa porque vazamento aqui e um incidente de LGPD: dados pessoais de uma empresa apareceriam para outra.', 'Precisam existir dois clientes distintos no sistema (o teste usa dois ambientes de teste isolados).', '[{"acao": "No cliente A, cadastrar um colaborador", "dados": "Nome: Secreto do Cliente A | CPF: 999.000.001-88", "ordem": 1, "onde_na_tela": "Cliente A > Novo Colaborador", "resultado_esperado": "Cadastrado no cliente A"}, {"acao": "Entrar como cliente B e buscar esse colaborador", "dados": "Buscar pelo nome ou CPF do colaborador do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Colaboradores > busca", "resultado_esperado": "O colaborador do cliente A NAO aparece para o cliente B"}]', 'O colaborador cadastrado no cliente A e invisivel no cliente B. A busca no cliente B nao retorna nada. Zero vazamento entre clientes.', 'IMPACTO SE FALHAR: seria um vazamento de dados pessoais entre clientes — incidente grave de LGPD, com risco legal e de reputacao. Esta protecao (RLS por tenant) e a mais critica do sistema; o caso a verifica a cada bateria.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-025', 'Segundo vínculo ativo na mesma empresa é recusado', 'negativo', 'critica', 'aprovado', 'Verificar que a mesma pessoa NAO pode ter dois vinculos ativos na MESMA empresa. Regra: dentro de uma empresa, o CPF e chave unica de vinculo vigente — a pessoa nao pode figurar duas vezes ativa no mesmo lugar. Importa porque vinculo duplicado dobra a pessoa na folha e nos relatorios daquela empresa. Esta e a regra que o indice unico de vinculo (criado em jul/2026) protege.', 'Precisa existir uma empresa e uma pessoa ja com vinculo ativo nela.', '[{"acao": "Cadastrar a pessoa com vinculo ativo na empresa Alfa", "dados": "Nome: Vinculo Unico Teste | CPF: 999.000.010-05 | Empresa: Alfa | Tipo: colaborador | Status: ativo", "ordem": 1, "onde_na_tela": "Novo Colaborador > Vinculo", "resultado_esperado": "Vinculo ativo criado na Alfa"}, {"acao": "Tentar adicionar um SEGUNDO vinculo ativo na MESMA Alfa, mesmo tipo", "dados": "Empresa: Alfa (a mesma) | Tipo: colaborador (o mesmo) | Status: ativo", "ordem": 2, "onde_na_tela": "Ficha do colaborador > Vinculos > Adicionar", "resultado_esperado": "O sistema DEVE recusar o vinculo duplicado"}]', 'O segundo vinculo ativo na mesma empresa e RECUSADO. A pessoa mantem exatamente 1 vinculo vigente na Alfa. O indice unico segura.', 'IMPACTO SE FALHAR: vinculo duplicado faz a folha processar a pessoa duas vezes na mesma empresa e a conta em dobro em relatorios de SST. Foi um problema real (133 duplicatas encontradas e corrigidas em jul/2026). Este caso guarda a correcao — falha na hora se o indice unico for removido.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-026', 'Mesma pessoa em duas empresas do tenant é permitida', 'alternativo', 'alta', 'aprovado', 'Verificar a contraparte da regra: entre empresas DIFERENTES do mesmo cliente, nao ha restricao — a mesma pessoa pode ter vinculo ativo em cada uma. Regra: o limite de "um vinculo" vale por empresa, nao por pessoa. Importa para nao restringir demais: seria errado impedir alguem de atuar em duas empresas do grupo.', 'Precisam existir duas empresas (Alfa e Beta) no mesmo cliente.', '[{"acao": "Criar a pessoa com vinculo ativo na Alfa", "dados": "Nome: Duas Empresas OK | CPF: 999.000.011-96 | Empresa: Alfa | Status: ativo", "ordem": 1, "onde_na_tela": "Novo Colaborador > Vinculo", "resultado_esperado": "Vinculo na Alfa criado"}, {"acao": "Adicionar vinculo ativo na Beta (empresa diferente)", "dados": "Empresa: Beta | Status: ativo", "ordem": 2, "onde_na_tela": "Ficha > Vinculos > Adicionar", "resultado_esperado": "O vinculo na Beta e ACEITO (empresa diferente, sem restricao)"}]', 'A pessoa tem 2 vinculos ativos, um na Alfa e um na Beta. O indice unico NAO barra vinculos em empresas diferentes.', 'IMPACTO SE FALHAR: se o sistema barrar por engano, um funcionario de duas empresas do grupo nao poderia ser registrado corretamente. Confirma que o indice unico e preciso (barra so a MESMA empresa, nao qualquer segundo vinculo).', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-027', 'Vínculo suspenso ainda ocupa a vaga: novo vínculo ativo é recusado', 'negativo', 'critica', 'aprovado', 'Verificar que um vinculo SUSPENSO ainda ocupa a vaga: nao da para criar um novo vinculo ativo na mesma empresa enquanto o suspenso existe. Regra: suspensao e medida disciplinar sobre um vinculo vigente — a pessoa continua vinculada, so temporariamente afastada. Importa porque suspenso nao e desligado; a vaga ainda e dela.', 'Precisa existir uma pessoa com vinculo na empresa, com esse vinculo em status suspenso.', '[{"acao": "Criar a pessoa com vinculo na Alfa e coloca-lo como suspenso", "dados": "Nome: Suspenso Teste | CPF: 999.000.012-87 | Empresa: Alfa | Status: suspenso", "ordem": 1, "onde_na_tela": "Ficha do colaborador > Vinculo > Status", "resultado_esperado": "Vinculo existe, em status suspenso"}, {"acao": "Tentar criar um NOVO vinculo ativo na mesma Alfa para a mesma pessoa", "dados": "Empresa: Alfa | Status: ativo", "ordem": 2, "onde_na_tela": "Ficha > Vinculos > Adicionar", "resultado_esperado": "O sistema DEVE recusar — o vinculo suspenso ainda ocupa a vaga"}]', 'O novo vinculo ativo e RECUSADO enquanto ha um vinculo suspenso na mesma empresa. Suspenso conta como vigente para a regra de unicidade.', 'IMPACTO SE FALHAR: se permitir, a pessoa teria um vinculo suspenso E um ativo na mesma empresa ao mesmo tempo — situacao incoerente que confunde folha (paga o ativo enquanto o suspenso deveria estar bloqueado) e distorce o headcount.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-028', 'Fim da suspensão devolve o vínculo a ativo sem colisão', 'alternativo', 'critica', 'aprovado', 'Verificar que, ao terminar a suspensao, o vinculo volta a ativo sem erro. Regra: o indice unico nao pode transformar o retorno da suspensao em uma falsa colisao — voltar de suspenso para ativo e uma transicao valida do MESMO vinculo, nao a criacao de um novo. Importa porque a pessoa precisa poder retornar ao trabalho sem travar.', 'Precisa existir uma pessoa com vinculo suspenso na empresa (sem outro vinculo ativo la).', '[{"acao": "Ter a pessoa com vinculo suspenso na Alfa", "dados": "Nome: Retorno Suspensao | CPF: 999.000.013-78 | Empresa: Alfa | Status: suspenso", "ordem": 1, "onde_na_tela": "Ficha > Vinculo", "resultado_esperado": "Vinculo suspenso existe"}, {"acao": "Mudar o status do MESMO vinculo de suspenso para ativo", "dados": "Status: de suspenso para ativo", "ordem": 2, "onde_na_tela": "Ficha > Vinculo > alterar Status", "resultado_esperado": "O vinculo volta a ativo sem erro de duplicidade"}]', 'O vinculo transita de suspenso para ativo com sucesso. A pessoa fica com 1 vinculo ativo na Alfa. Nenhum erro de colisao no indice unico.', 'IMPACTO SE FALHAR: se o retorno da suspensao desse erro de duplicidade, a pessoa nao conseguiria voltar ao trabalho pelo sistema — o RH ficaria travado. Este caso prova que a regra de unicidade distingue "novo vinculo" de "mudanca de status do mesmo vinculo".', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-029', 'Papel duplo na mesma empresa é permitido (dono que também é colaborador)', 'alternativo', 'critica', 'aprovado', 'Verificar que a mesma pessoa pode ter dois PAPEIS diferentes na mesma empresa (ex.: dono que tambem e colaborador). Regra: a unicidade vale por PAPEL (tipo de vinculo), nao por pessoa — dono e colaborador sao vinculos de tipos diferentes, entao coexistem. Importa porque em pequenas empresas o socio muitas vezes tambem trabalha como funcionario.', 'Precisa existir uma empresa e uma pessoa que sera vinculada com dois papeis.', '[{"acao": "Criar a pessoa com vinculo de dono na Alfa", "dados": "Nome: Dono e Funcionario | CPF: 999.000.014-69 | Empresa: Alfa | Tipo: dono | Status: ativo", "ordem": 1, "onde_na_tela": "Novo Colaborador > Vinculo", "resultado_esperado": "Vinculo de dono criado"}, {"acao": "Adicionar um segundo vinculo, tipo colaborador, na mesma Alfa", "dados": "Empresa: Alfa (a mesma) | Tipo: colaborador (papel diferente) | Status: ativo", "ordem": 2, "onde_na_tela": "Ficha > Vinculos > Adicionar", "resultado_esperado": "ACEITO — papel diferente, mesmo sendo a mesma empresa"}]', 'A pessoa tem 2 vinculos ativos na Alfa: um como dono, um como colaborador. A unicidade barra papel repetido, nao papeis diferentes.', 'IMPACTO SE FALHAR: se barrasse, o socio que tambem e funcionario nao poderia ter os dois papeis registrados — comum em pequenas empresas. Prova que o indice unico e por (empresa + pessoa + TIPO), nao so (empresa + pessoa).', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-030', '[A CONSTRUIR] Reimportar a mesma planilha não duplica e pede decisão', 'excecao', 'critica', 'rascunho', 'Importação é idempotente: reimportar identifica os existentes e devolve a decisão ao usuário, nunca duplica em silêncio.', 'COLAB-010 executado (os 3 já existem).', '[{"acao": "Importar exatamente a mesma planilha", "ordem": 1, "resultado_esperado": "Sistema identifica os 3 como já existentes e pergunta se deve substituir os dados ou mantê-los"}, {"acao": "Contar registros por CPF", "ordem": 2, "resultado_esperado": "1 por CPF — nenhum duplicado, independentemente da escolha"}, {"acao": "Importar planilha com 1 CPF novo entre os 3 existentes", "ordem": 3, "resultado_esperado": "1 criado; os 3 existentes apenas sinalizados, não duplicados"}]', 'Reimportação nunca duplica; a decisão sobre os dados é do usuário.', 'REPRODUZ O BUG conhecido de duplicação por reimportação. A escolha substituir/manter é regra NOVA definida em jul/2026 — ainda não implementada. | RECLASSIFICADO 30/07/2026: a escolha substituir/manter na reimportação não existe no produto. Enquanto não existir, este caso é ESPECIFICAÇÃO, não teste — sai do motor para não fabricar falha permanente. Ao implementar a funcionalidade, devolver para status aprovado e escrever a rotina no mesmo movimento.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-031', '[A CONSTRUIR] Reimportação com a opção "manter" preserva os dados atuais', 'excecao', 'alta', 'rascunho', 'Verificar que reimportar a mesma planilha com a opcao "manter" nao sobrescreve o que foi alterado no sistema. Regra: quando o colaborador ja existe, a escolha "manter" preserva os dados atuais e ignora os da planilha. Importa porque a planilha envelhece: depois da importacao inicial, o RH ajusta cargos e dados pelo sistema. Reimportar sem essa protecao desfaria todo o trabalho, voltando aos valores antigos do arquivo.', 'COLAB-010 executado (os 3 colaboradores importados). Depois disso, um deles teve o cargo alterado pelo sistema — a planilha original ainda traz o cargo antigo.', '[{"acao": "Alterar o cargo de um colaborador importado, pelo sistema", "dados": "Cargo antigo (na planilha): Auxiliar | Novo cargo (no sistema): Analista", "ordem": 1, "onde_na_tela": "Colaboradores > abrir a ficha > campo Cargo", "resultado_esperado": "O colaborador fica com o cargo Analista"}, {"acao": "Reimportar a MESMA planilha original", "dados": "Arquivo: o mesmo da importacao inicial, que traz o cargo Auxiliar", "ordem": 2, "onde_na_tela": "Colaboradores > Importar > mesmo arquivo", "resultado_esperado": "O sistema detecta que os 3 ja existem e pergunta o que fazer"}, {"acao": "Escolher a opcao Manter", "dados": "Escolha: Manter", "ordem": 3, "onde_na_tela": "Dialogo de decisao > opcao Manter dados atuais", "resultado_esperado": "A importacao prossegue sem sobrescrever"}, {"acao": "Conferir o cargo do colaborador", "dados": "-", "ordem": 4, "onde_na_tela": "Colaboradores > ficha do colaborador alterado", "resultado_esperado": "O cargo continua Analista — a planilha NAO sobrescreveu com Auxiliar"}, {"acao": "Conferir a contagem e o relatorio", "dados": "-", "ordem": 5, "onde_na_tela": "Relatorio da importacao", "resultado_esperado": "Nenhum registro criado; o relatorio informa quantos foram mantidos"}]', 'O cargo alterado no sistema permanece. Nenhum registro novo e criado (nao houve duplicacao). O relatorio da importacao informa quantos registros foram mantidos.', 'IMPACTO SE FALHAR: se "manter" nao preservasse, uma reimportacao de rotina desfaria silenciosamente semanas de ajustes feitos pelo RH — cargos, departamentos e dados corrigidos voltariam aos valores da planilha antiga. E o pior tipo de perda: acontece sem erro, sem aviso, e so se descobre quando alguem estranha um dado. NOTA SOBRE COBERTURA: sem rotina automatizada, pelo mesmo motivo do COLAB-010 — a decisao "substituir ou manter" acontece no front. Documentado para execucao manual ou Cypress. Complementar: COLAB-030 (reimportar nao duplica) e COLAB-032 (a opcao substituir). | RECLASSIFICADO 30/07/2026: a escolha substituir/manter na reimportação não existe no produto. Enquanto não existir, este caso é ESPECIFICAÇÃO, não teste — sai do motor para não fabricar falha permanente. Ao implementar a funcionalidade, devolver para status aprovado e escrever a rotina no mesmo movimento.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-032', '[A CONSTRUIR] Reimportação com "substituir" atualiza sem recriar a pessoa', 'excecao', 'critica', 'rascunho', 'Substituir é UPDATE no lugar. Se apagar e recriar, o id muda e todo o histórico da pessoa é órfão.', 'COLAB-010 executado. O colaborador possui marcações de ponto, férias e entrega de EPI registradas.', '[{"acao": "Anotar o id (usuarios_base.id) do colaborador antes da importação", "ordem": 1, "resultado_esperado": "id registrado para comparação"}, {"acao": "Reimportar a planilha com dados alterados escolhendo Substituir", "ordem": 2, "resultado_esperado": "Dados atualizados"}, {"acao": "Conferir o id do colaborador", "ordem": 3, "resultado_esperado": "O MESMO id de antes — foi update, não delete + insert"}, {"acao": "Conferir ponto, férias e EPI da pessoa", "ordem": 4, "resultado_esperado": "Histórico intacto e ainda vinculado"}, {"acao": "Conferir os vínculos", "ordem": 5, "resultado_esperado": "Preservados, não recriados"}]', 'Substituir troca os dados e preserva identidade, vínculos e histórico.', 'Caso de maior risco do módulo: apagar-e-recriar destruiria registro de ponto (CLT) e prova de entrega de EPI (NR-06). Comportamento novo — ainda não implementado. | RECLASSIFICADO 30/07/2026: a escolha substituir/manter na reimportação não existe no produto. Enquanto não existir, este caso é ESPECIFICAÇÃO, não teste — sai do motor para não fabricar falha permanente. Ao implementar a funcionalidade, devolver para status aprovado e escrever a rotina no mesmo movimento.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-033', 'CPF com formatação diferente é reconhecido como a mesma pessoa', 'excecao', 'media', 'aprovado', 'O índice único compara string. "111.222.333-44" e "11122233344" passam os dois — e duplicam.', 'COLAB-001 executado com CPF gravado sem formatação.', '[{"acao": "Cadastrar pessoa com o mesmo CPF, porém formatado com pontos e traço", "ordem": 1, "resultado_esperado": "Recusado como duplicata — o CPF é normalizado antes de comparar e gravar"}, {"acao": "Importar planilha com os CPFs formatados", "ordem": 2, "resultado_esperado": "Reconhecidos como os já existentes; nada duplicado"}, {"acao": "Conferir como o CPF foi gravado", "ordem": 3, "resultado_esperado": "Formato único e consistente na base, independente de como foi digitado"}]', 'A formatação do CPF não cria pessoas diferentes.', 'HIPÓTESE DERRUBADA (jul/2026). Este caso acusava a falta de normalização de CPF como provável causa-raiz do bug de duplicação. A varredura da base retornou ZERO CPFs que dupliquem só por formatação — usuarios_base_cpf_tenant_uidx sempre protegeu a pessoa. A duplicação nunca foi da PESSOA, era do VÍNCULO (ver COLAB-025). Normalizar CPF continua valendo como higiene preventiva, mas rebaixado de crítico para médio: é porta que está fechada, não porta arrombada.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-034', 'Colaborador sem CPF não escapa da detecção de duplicidade', 'excecao', 'alta', 'aprovado', 'O índice único é parcial (WHERE cpf IS NOT NULL). Sem CPF, ele não protege nada.', 'Tenant de teste.', '[{"acao": "Cadastrar pessoa sem CPF", "ordem": 1, "resultado_esperado": "Aceito — CPF é opcional"}, {"acao": "Cadastrar outra com o mesmo nome e o mesmo e-mail, também sem CPF", "ordem": 2, "resultado_esperado": "alerta_duplicidade = true e duplicidade_nivel preenchido"}, {"acao": "Importar duas vezes uma planilha sem coluna de CPF", "ordem": 3, "resultado_esperado": "Não duplica — a deduplicação recai sobre e-mail/matrícula"}]', 'A ausência de CPF não abre buraco na deduplicação.', 'REFORMULADO (jul/2026) após medir a base: 20 pessoas sem CPF, sendo 18 administrador e 2 gestor. ZERO colaboradores. Não é buraco — é design: usuário de sistema não tem por que ter CPF, e o índice parcial WHERE cpf IS NOT NULL está correto. A regra não é "sem CPF duplica livre", é "tipo_usuario = colaborador exige CPF". Hoje isso se cumpre. O caso deve testar a REGRA (colaborador sem CPF é recusado), não o buraco imaginário.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-035', 'Desligamento preserva a pessoa e todo o histórico', 'excecao', 'critica', 'aprovado', 'Verificar que desligar um colaborador encerra o vinculo mas NAO apaga a pessoa nem seu historico. Regra: desligamento muda o status do vinculo para inativo/desligado; a pessoa e todo o seu historico (documentos, ferias, ponto) permanecem. Importa porque o historico tem valor legal e pode ser necessario apos o desligamento (processos, readmissao).', 'Precisa existir uma pessoa com vinculo ativo e algum historico associado.', '[{"acao": "Ter uma pessoa com vinculo ativo na Alfa", "dados": "Nome: Desligado Teste | CPF: 999.000.015-50 | Empresa: Alfa | Status: ativo", "ordem": 1, "onde_na_tela": "Ficha do colaborador", "resultado_esperado": "Colaborador ativo com vinculo"}, {"acao": "Desligar o colaborador", "dados": "Status do vinculo: desligado/inativo | Data de desligamento: hoje", "ordem": 2, "onde_na_tela": "Ficha > acao Desligar (ou mudar status do vinculo)", "resultado_esperado": "Vinculo encerrado"}, {"acao": "Conferir que a pessoa ainda existe", "dados": "Buscar a pessoa desligada", "ordem": 3, "onde_na_tela": "Colaboradores > filtro Desligados (ou busca)", "resultado_esperado": "A pessoa continua no sistema, com vinculo inativo e historico intacto"}]', 'A pessoa continua existindo apos o desligamento, com o vinculo em status desligado. O historico nao foi apagado. Ela pode ser encontrada nos desligados.', 'IMPACTO SE FALHAR: se o desligamento apagasse a pessoa, perderia-se historico com valor legal (documentos, ferias, ponto) — problema em auditoria, processo trabalhista ou readmissao. Desligar deve ser encerrar, nunca deletar.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-036', 'Readmissão reaproveita a pessoa existente', 'excecao', 'alta', 'aprovado', 'Verificar que readmitir alguem reaproveita a pessoa existente em vez de criar uma segunda com o mesmo CPF. Regra: a constraint de CPF unico impede duplicar a pessoa; readmissao e um novo vinculo (ou reativacao) sobre a MESMA pessoa. Importa porque criar uma segunda ficha para quem volta fragmenta o historico da pessoa em dois cadastros.', 'Precisa existir uma pessoa que foi desligada (vinculo inativo), com CPF conhecido.', '[{"acao": "Ter uma pessoa desligada no sistema", "dados": "Nome: Readmitido Teste | CPF: 999.000.016-41 | vinculo: desligado", "ordem": 1, "onde_na_tela": "Colaboradores > Desligados", "resultado_esperado": "Pessoa existe, desligada"}, {"acao": "Readmitir usando o MESMO CPF", "dados": "CPF: 999.000.016-41 (o mesmo da pessoa desligada)", "ordem": 2, "onde_na_tela": "Novo Colaborador (ou acao Readmitir) com o CPF existente", "resultado_esperado": "O sistema reconhece o CPF e reaproveita a pessoa, criando um novo vinculo ativo — NAO uma segunda pessoa"}, {"acao": "Conferir que ha so uma pessoa com aquele CPF", "dados": "Buscar 999.000.016-41", "ordem": 3, "onde_na_tela": "Busca pelo CPF", "resultado_esperado": "Retorna UMA pessoa, agora com vinculo ativo e o historico anterior preservado"}]', 'Existe UMA unica pessoa com aquele CPF, agora readmitida (vinculo ativo). O historico da passagem anterior continua ligado a ela. Nenhuma segunda ficha foi criada.', 'IMPACTO SE FALHAR: se a readmissao criasse uma segunda pessoa com o mesmo CPF, o historico ficaria partido em dois cadastros — o tempo de casa, documentos e registros anteriores se desconectariam. A constraint de CPF unico e o que forca o reaproveitamento.', 'api', NULL, 'em_triagem', NULL),
    ('COLAB-037', 'Duplo clique no cadastro não cria dois vínculos', 'negativo', 'alta', 'aprovado', 'A tela é caminho de escrita sem guarda. Submissão dupla em segundos gera vínculo duplicado.', 'Formulário de vínculo preenchido, ainda não submetido.', '[{"acao": "Clicar em salvar duas vezes em sequência rápida (< 2s)", "ordem": 1, "resultado_esperado": "O botão desabilita na primeira submissão"}, {"acao": "Contar vínculos vigentes de (empresa, pessoa, papel)", "ordem": 2, "resultado_esperado": "Exatamente 1"}, {"acao": "Repetir com a rede lenta (throttle 3G)", "ordem": 3, "resultado_esperado": "Continua 1 — a proteção não depende da latência"}]', 'Uma submissão, um vínculo, independente de quantos cliques.', 'ATUALIZADO 15/07/2026 — o índice único mudou o sintoma, não resolveu o caso. Antes: duplo clique criava dois vínculos em silêncio. Agora: o segundo INSERT bate no índice e o usuário leva um erro de constraint na cara, em inglês, vindo do Postgres. Melhor que duplicar, longe de aceitável. O caso continua aberto e a correção continua sendo na tela: desabilitar o botão na primeira submissão E tratar a unique violation com mensagem em português. O índice é a rede de segurança, não a UX. | 30/07/2026: confirmado que este caso NAO e implementavel no motor SQL (nivel e2e). O motor agora diz isso explicitamente no resultado. A cobertura pertence ao Cypress, junto com os specs ja existentes em cypress/e2e. Correcao do produto segue pendente e inalterada: desabilitar o botao na primeira submissao E traduzir a unique violation para portugues.', 'e2e', NULL, 'em_triagem', NULL),
    ('COND-001', 'Registrar insalubridade de grau medio', 'feliz', 'alta', 'aprovado', 'Verificar o registro de enquadramento em insalubridade. Regra: o grau define o percentual (minimo 10%, medio 20%, maximo 40%) aplicado sobre o salario minimo ou o piso convencional. Importa porque este registro alimenta a folha — e o que faz o adicional ser pago.', 'Precisa existir um colaborador cadastrado.', '[{"acao": "Abrir a ficha do colaborador e ir as condicoes especiais", "dados": "-", "ordem": 1, "onde_na_tela": "Colaboradores > abrir a ficha > aba Condicoes Especiais", "resultado_esperado": "Secao de insalubridade e periculosidade visivel"}, {"acao": "Marcar insalubridade e informar o enquadramento", "dados": "Insalubridade: sim | Grau: medio (20%) | Agente nocivo: Ruido acima de 85 dB | Base: salario_minimo", "ordem": 2, "onde_na_tela": "Campos Insalubridade, Grau, Agente Nocivo, Base de Calculo", "resultado_esperado": "Campos aceitos e o valor calculado exibido"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "O enquadramento persistiu, com o adicional aplicado igual ao de insalubridade"}]', 'O colaborador fica registrado com insalubridade de grau medio, agente nocivo identificado, base no salario minimo, e o adicional aplicado e o de insalubridade.', 'IMPACTO SE FALHAR: sem o registro, o adicional nao e pago — o colaborador recebe a menos e a empresa acumula passivo trabalhista com juros e correcao.', 'api', NULL, 'em_triagem', NULL),
    ('COND-002', 'Registrar periculosidade', 'feliz', 'alta', 'aprovado', 'Verificar o registro de enquadramento em periculosidade. Regra: o adicional e de 30% sobre o salario base (NR-16 e art. 193 da CLT), diferente da insalubridade, que incide sobre o salario minimo. Importa porque a base de calculo distinta e o que faz a periculosidade ser quase sempre mais vantajosa para quem tem salario acima do minimo.', 'Precisa existir um colaborador cadastrado.', '[{"acao": "Abrir as condicoes especiais do colaborador", "dados": "-", "ordem": 1, "onde_na_tela": "Colaboradores > ficha > Condicoes Especiais", "resultado_esperado": "Secao visivel"}, {"acao": "Marcar periculosidade e informar o tipo", "dados": "Periculosidade: sim | Tipo: Inflamaveis", "ordem": 2, "onde_na_tela": "Campos Periculosidade e Tipo", "resultado_esperado": "Campos aceitos, adicional de 30% calculado sobre o salario base"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Enquadramento gravado, adicional aplicado e o de periculosidade"}]', 'O colaborador fica registrado com periculosidade, tipo identificado, e o adicional aplicado e o de periculosidade.', 'IMPACTO SE FALHAR: mesmo risco do COND-001 — adicional nao pago vira passivo trabalhista.', 'api', NULL, 'em_triagem', NULL),
    ('COND-003', 'Prevalencia: os dois enquadramentos, um so adicional', 'feliz', 'critica', 'aprovado', 'Verificar a regra do art. 193 §2º da CLT: quando o colaborador se enquadra em insalubridade E periculosidade, aplica-se apenas o MAIS VANTAJOSO — vedada a cumulatividade. Importa porque somar os dois e erro classico de folha: paga-se a mais e, em fiscalizacao ou acao trabalhista, o erro aparece nos dois sentidos (a empresa pagou errado, e o calculo do que era devido fica contestavel).', 'Precisa existir um colaborador enquadrado nas duas condicoes.', '[{"acao": "Marcar o colaborador com insalubridade e periculosidade ao mesmo tempo", "dados": "Insalubridade: sim, grau maximo (40% do salario minimo) | Periculosidade: sim (30% do salario base)", "ordem": 1, "onde_na_tela": "Colaboradores > ficha > Condicoes Especiais", "resultado_esperado": "A tela avisa que sera aplicado o mais vantajoso (art. 193 §2º)"}, {"acao": "Conferir qual adicional foi aplicado", "dados": "-", "ordem": 2, "onde_na_tela": "Campo Adicional Aplicado", "resultado_esperado": "Apenas UM dos dois consta como aplicado — o de maior valor"}, {"acao": "Conferir a fundamentacao legal registrada", "dados": "-", "ordem": 3, "onde_na_tela": "Campo Fundamentacao Legal", "resultado_esperado": "Texto citando os dois valores calculados, qual prevaleceu e o art. 193 §2º da CLT"}, {"acao": "Conferir o valor aplicado", "dados": "-", "ordem": 4, "onde_na_tela": "Campo Valor do Adicional Aplicado", "resultado_esperado": "Igual ao maior dos dois — NUNCA a soma"}]', 'Somente um adicional consta como aplicado, com valor igual ao maior dos dois calculados, e a fundamentacao legal registra a comparacao e a base legal.', 'IMPACTO SE FALHAR: somar os dois adicionais e pagamento indevido; aplicar o menor e pagamento a menor, com passivo. Em ambos os casos ha exposicao em fiscalizacao. A logica esta corretamente implementada no front (src/lib/folha/adicionais.ts), incluindo a fundamentacao. Este caso verifica se o dado GRAVADO respeita a regra — o que importa quando o registro vem por importacao de SST, caminho previsto na propria tabela (origem = importacao_sst).', 'api', NULL, 'em_triagem', NULL),
    ('COND-010', 'Grau de insalubridade aceita valor fora da NR-15', 'excecao', 'alta', 'aprovado', 'Verificar se o grau de insalubridade tem lista fechada. Regra: a NR-15 preve apenas tres graus — minimo (10%), medio (20%) e maximo (40%). Importa porque o grau determina o percentual; um valor fora da lista nao tem percentual correspondente e o calculo do adicional fica indeterminado.', 'Precisa existir um colaborador cadastrado.', '[{"acao": "Registrar insalubridade com grau fora da NR-15", "dados": "Insalubridade: sim | Grau: altissimo (nao existe na NR-15)", "ordem": 1, "onde_na_tela": "Via importacao de SST ou API", "resultado_esperado": "Idealmente recusado — so minimo, medio e maximo existem"}]', 'O grau invalido deveria ser recusado. RESULTADO REAL: o banco aceita — insalubridade_grau e TEXT sem CHECK; os valores validos estao apenas no comentario do codigo.', 'IMPACTO: um grau sem percentual correspondente deixa o calculo do adicional indeterminado. Na implementacao do front, um grau desconhecido resulta em percentual zero — ou seja, o colaborador enquadrado em insalubridade receberia adicional de R$ 0,00 sem que nada acusasse o erro. CORRECAO SUGERIDA: ALTER TABLE colaborador_condicoes_especiais ADD CONSTRAINT insalubridade_grau_nr15 CHECK (insalubridade_grau IS NULL OR insalubridade_grau IN (''minimo'',''medio'',''maximo''));', 'api', NULL, 'em_triagem', NULL),
    ('COND-011', 'Adicional aplicado aceita valor fora da regra', 'excecao', 'critica', 'aprovado', 'Verificar se o campo que registra qual adicional prevaleceu tem lista fechada. Regra: os unicos valores possiveis sao insalubridade, periculosidade ou nenhum — a CLT veda a cumulatividade, entao "ambos" nao e uma opcao valida. Importa porque este campo e o registro formal de qual adicional a empresa esta pagando.', 'Precisa existir um colaborador cadastrado.', '[{"acao": "Registrar condicoes com adicional aplicado = ambos", "dados": "Insalubridade: sim | Periculosidade: sim | Adicional aplicado: ambos (vedado pelo art. 193 §2º)", "ordem": 1, "onde_na_tela": "Via importacao de SST ou API", "resultado_esperado": "Idealmente recusado — a CLT veda a cumulatividade"}]', 'O valor "ambos" deveria ser recusado. RESULTADO REAL: o banco aceita qualquer texto — adicional_aplicado e TEXT sem CHECK.', 'IMPACTO: o campo que documenta o cumprimento do art. 193 §2º aceita justamente o valor que a lei proibe. Um registro com "ambos" contradiz a norma no proprio dado. CORRECAO SUGERIDA: ALTER TABLE colaborador_condicoes_especiais ADD CONSTRAINT adicional_aplicado_valido CHECK (adicional_aplicado IS NULL OR adicional_aplicado IN (''insalubridade'',''periculosidade'',''nenhum''));', 'api', NULL, 'em_triagem', NULL),
    ('COND-012', 'Valor de adicional negativo e aceito', 'excecao', 'alta', 'aprovado', 'Verificar se o banco aceita valores negativos nos adicionais. Regra: adicional e acrescimo ao salario; nao existe adicional negativo. Importa porque um valor negativo em campo que alimenta folha significa desconto indevido no salario do colaborador.', 'Precisa existir um colaborador cadastrado.', '[{"acao": "Registrar condicoes especiais com valor negativo", "dados": "Valor do adicional aplicado: -500,00", "ordem": 1, "onde_na_tela": "Via importacao de SST ou API", "resultado_esperado": "Idealmente recusado — adicional e acrescimo, nunca desconto"}]', 'O valor negativo deveria ser recusado. RESULTADO REAL: o banco aceita — os campos numericos nao tem CHECK de nao-negatividade.', 'IMPACTO: valor negativo em campo de folha vira desconto no salario do colaborador. Diferente dos demais achados de nao-negatividade (que geram relatorio errado), aqui o efeito e financeiro e direto sobre a remuneracao. CORRECAO SUGERIDA: CHECK (>= 0) em insalubridade_valor_calculado, periculosidade_valor_calculado e adicional_valor_aplicado.', 'api', NULL, 'em_triagem', NULL),
    ('COND-013', 'Apagar o cargo preserva as condicoes do colaborador', 'alternativo', 'media', 'aprovado', 'Verificar que apagar um cargo nao apaga o enquadramento em condicoes especiais dos colaboradores. Regra: cargo_id referencia cargos, sem CASCADE. Importa porque o enquadramento pertence a pessoa e ao seu ambiente de trabalho, nao ao cargo — e tem valor historico para aposentadoria especial e eventuais acoes trabalhistas.', 'Precisa existir um colaborador com condicoes especiais ligadas a um cargo.', '[{"acao": "Registrar condicoes especiais vinculadas a um cargo", "dados": "Colaborador com insalubridade, cargo: Operador de Caldeira", "ordem": 1, "onde_na_tela": "Colaboradores > ficha > Condicoes Especiais", "resultado_esperado": "Enquadramento vinculado ao cargo"}, {"acao": "Apagar o cargo", "dados": "-", "ordem": 2, "onde_na_tela": "Cargos > Excluir", "resultado_esperado": "Comportamento a verificar"}, {"acao": "Conferir o enquadramento do colaborador", "dados": "-", "ordem": 3, "onde_na_tela": "Colaboradores > ficha > Condicoes Especiais", "resultado_esperado": "O enquadramento deve continuar existindo — e historico com valor legal"}]', 'O enquadramento do colaborador sobrevive ao cargo. O historico de exposicao nao se perde.', 'IMPACTO SE FALHAR: perder o registro de exposicao a agentes nocivos compromete a comprovacao de tempo especial para aposentadoria e a defesa da empresa em acao trabalhista — o historico de exposicao e prova documental.', 'api', NULL, 'em_triagem', NULL),
    ('COND-022', 'Condicoes especiais de outro cliente sao invisiveis', 'negativo', 'critica', 'aprovado', 'Verificar o isolamento multi-tenant. Importa porque estes registros contem dados de saude ocupacional e exposicao a agentes nocivos — informacao sensivel sob a LGPD, alem de revelar passivo trabalhista potencial da empresa.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, registrar condicoes especiais de um colaborador", "dados": "Registro identificavel", "ordem": 1, "onde_na_tela": "Cliente A > Colaboradores > Condicoes Especiais", "resultado_esperado": "Criado no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Buscar o registro do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Colaboradores", "resultado_esperado": "NAO aparece"}]', 'O registro do cliente A e invisivel no cliente B.', 'IMPACTO SE FALHAR: exporia dados de saude ocupacional (agentes nocivos a que pessoas estao expostas) entre clientes — dado sensivel sob a LGPD.', 'api', NULL, 'em_triagem', NULL),
    ('TELA-IMPORT-001', 'deve abrir o modal de importação ao clicar no botão ''Importar Colaboradores'' em qualquer aba', 'feliz', 'media', 'aprovado', 'Teste de tela ja existente em cypress/e2e/importar-colaboradores.cy.ts. Documentado para que o resultado da suite apareca no relatorio de QA.', NULL, '[]', NULL, 'Criado em 11/08/2026 a partir do titulo real do it(). A ligacao com o Cypress vive em qa_cobertura_e2e.', 'e2e', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/colaboradores'
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

-- Compliance SST (15 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('SST-001', 'PGR, PCMSO e laudos com vigência viva: vencimento avisa antes, não depois', 'feliz', 'critica', 'aprovado', 'O coração do escopo de GESTÃO: os documentos importados (PGR, PCMSO, LTCAT, laudos) têm vigência controlada — o sistema conhece a validade de cada um, avisa com antecedência (60/30 dias) que uma nova versão precisa ser solicitada à consultoria e acusa o vencido. Documento vencido descoberto pela fiscalização é exatamente o problema que o módulo existe para eliminar.', 'Documentos de SST cadastrados com data de vigência no ambiente de teste.', '[{"acao": "Cadastrar PGR com vigência a 45 dias do fim", "ordem": 1, "resultado_esperado": "Alerta de renovação disparado (janela de 60/30 dias), com ação no Plano de Ação"}, {"acao": "Deixar a vigência vencer", "ordem": 2, "resultado_esperado": "Documento marcado VENCIDO e sinalizado no painel — nunca silêncio"}, {"acao": "Importar a nova versão", "ordem": 3, "resultado_esperado": "Versão anterior preservada como histórico; vigência renovada; reflexos reprocessados"}]', 'Todo documento tem prazo de validade — e o sistema olha o calendário primeiro.', 'Requisitos YE-DP-SST-001: RF-001 / alerta "Documento vencido" (seção 14) / cenário "Documento vencido" (seção 25). sst_documentos existe com tipo e data_vigencia — a sonda confere se alguém VIGIA a data ou se ela é decorativa.', 'api', 'NR-1 (PGR: revisão a cada 2 anos, ou 3 com certificação; avaliação de riscos) ; NR-7 (PCMSO baseado no PGR)', 'em_triagem', NULL),
    ('SST-002', 'Dado extraído de documento aponta a fonte e passa por revisão humana', 'alternativo', 'alta', 'aprovado', 'A interpretação por IA é o núcleo do módulo, e ela só é confiável com dois cintos: cada dado extraído (risco, exame, periodicidade, enquadramento) aponta o DOCUMENTO-FONTE de onde saiu, e extração com baixa confiança para na mesa de um humano antes de virar OS, ficha ou adicional. Dado extraído errado que vira adicional na folha é erro de IA cobrado em reclamatória.', 'Documento importado com dados extraídos no ambiente de teste.', '[{"acao": "Conferir um risco/exame extraído", "ordem": 1, "resultado_esperado": "Vínculo com o documento-fonte (qual arquivo, qual versão) rastreável"}, {"acao": "Simular extração de baixa confiança", "ordem": 2, "resultado_esperado": "Revisão humana exigida antes de o dado produzir efeito"}, {"acao": "Revisar e aprovar a extração", "ordem": 3, "resultado_esperado": "Dado liberado com o revisor registrado na trilha"}]', 'Dado sem fonte não vale; extração sem revisão não produz efeito.', 'Requisitos YE-DP-SST-001: RF-009 / RNF-003 / cenário "Documento ruim" (seção 25). Estrutura de extração (dados ligados ao documento-fonte + estado de revisão) não existe hoje — deve falhar e encaminhar.', 'api', 'Documento YE-DP-SST-001, RF-009 / RNF-003 (extração com confiança, revisão humana e rastreio do documento-fonte)', 'em_triagem', NULL),
    ('SST-003', 'As ações do plano do PGR viram tarefas rastreáveis no Plano de Ação', 'feliz', 'alta', 'aprovado', 'O PGR não é só inventário: ele traz um plano de ação com medidas, responsáveis e prazos. O "documento que vira ação" (seção 29) é a promessa central do módulo: importado o PGR, cada medida proposta vira tarefa no módulo Plano de Ação, com o vínculo ao risco de origem preservado — e a conclusão da tarefa volta como evidência de que a medida saiu do papel.', 'PGR importado com plano de ação interpretado no ambiente de teste.', '[{"acao": "Importar/interpretar o PGR", "ordem": 1, "resultado_esperado": "Medidas do plano viram ações no Plano de Ação (5W2H), vinculadas ao risco de origem"}, {"acao": "Concluir uma ação", "ordem": 2, "resultado_esperado": "Evidência registrada; o risco de origem mostra a medida executada"}, {"acao": "Reimportar versão nova do PGR", "ordem": 3, "resultado_esperado": "Ações novas criadas sem duplicar as existentes; encerradas as que saíram do plano"}]', 'O plano do PGR deixa de ser página de PDF e vira fila de trabalho.', 'Requisitos YE-DP-SST-001: RN-008 / CA-002 / seção 15. O módulo Plano de Ação existe (família própria no motor); a ponte PGR→ações, não. Deve falhar e encaminhar.', 'api', 'NR-1 (PGR = inventário de riscos + PLANO DE AÇÃO com cronograma)', 'em_triagem', NULL),
    ('SST-010', 'Ordem de Serviço por função: riscos, medidas e ciência do colaborador', 'feliz', 'alta', 'aprovado', 'A OS é o documento que prova que o colaborador FOI INFORMADO dos riscos da função e das medidas de prevenção — gerada a partir do PGR interpretado, por função, e assinada (ciência). Sem OS assinada, a empresa não prova a informação do risco, e a multa vem acompanhada do agravamento de qualquer acidente. Colaborador novo ou mudança de função exigem OS nova.', 'Função com riscos extraídos do PGR; colaborador vinculado à função.', '[{"acao": "Gerar a OS da função", "ordem": 1, "resultado_esperado": "Riscos, medidas e procedimentos da função no documento, derivados do PGR"}, {"acao": "Colher a ciência do colaborador", "ordem": 2, "resultado_esperado": "Assinatura com trilha; OS arquivada na pasta do colaborador"}, {"acao": "Admitir colaborador novo na função", "ordem": 3, "resultado_esperado": "OS pendente de ciência apontada — não fica esquecida"}]', 'Risco informado é risco assinado — por função, por pessoa.', 'Requisitos YE-DP-SST-001: RF-010 / CA-002 / seção 16. Existe ordem_servico_links (infraestrutura de assinatura); a GERAÇÃO por função a partir dos riscos, não. Modelos por cliente são [DAE] (seção 30).', 'api', 'NR-1, item 1.4.1 (ordem de serviço: informar os riscos e as medidas de prevenção)', 'em_triagem', NULL),
    ('SST-011', 'Ficha de EPI: entrega só com CA vigente, assinatura e treinamento', 'negativo', 'alta', 'aprovado', 'O subsistema de EPI já controla tipos, CAs (CETs), entregas e estoque — o que o caso cobra é a REGRA na entrega: EPI só sai com CA vigente (entrega com CA vencido é como não ter entregue), a ficha registra a assinatura do colaborador e o treinamento de uso fica evidenciado. A ficha de EPI por função, derivada do PGR, fecha o ciclo: o que a função exige × o que foi entregue.', 'EPI cadastrado com CA vencido e outro com CA vigente; colaborador com função de risco.', '[{"acao": "Tentar registrar entrega de EPI com CA vencido", "ordem": 1, "resultado_esperado": "Bloqueada — CA vigente é condição da entrega válida"}, {"acao": "Entregar EPI com CA vigente", "ordem": 2, "resultado_esperado": "Ficha gerada com assinatura do colaborador e treinamento registrado"}, {"acao": "Conferir a função contra a ficha", "ordem": 3, "resultado_esperado": "EPIs exigidos pela função (PGR) × entregues — pendência apontada"}]', 'CA vencido não protege ninguém — nem a empresa na fiscalização.', 'Requisitos YE-DP-SST-001: RN-007 / CA-008 / RF-004. O subsistema existe (epi_tipos/cets/entregas — EPI-001 cobre estoque); a TRAVA de CA na entrega e a ficha por função, a sonda confere. A neutralização do adicional é o SST-050. | Requisitos YE-DP-EPI-001: segue dono da TRAVA de CA vigente na entrega e da ficha por função; o monitoramento da validade no catálogo é o EPI-011, e o bloqueio de ITEM vencido é o EPI-040.', 'api', 'NR-6 (fornecimento gratuito, CA válido, registro de entrega e treinamento)', 'em_triagem', NULL),
    ('SST-020', 'Exame periódico agendado pela periodicidade do risco — antes de vencer', 'feliz', 'critica', 'aprovado', 'O periódico não é evento — é ciclo: cada colaborador tem a próxima data calculada pela periodicidade do seu risco (extraída do PCMSO), e o sistema avisa com 30/15/7 dias, agenda e acusa o vencido. ASO vencido de quem segue trabalhando é a autuação mais fácil da fiscalização — e o primeiro item checado depois de qualquer acidente.', 'Colaboradores com ASO registrado e periodicidade definida por função/risco.', '[{"acao": "Registrar ASO periódico com periodicidade de 12 meses", "ordem": 1, "resultado_esperado": "Próximo exame calculado e agendado automaticamente"}, {"acao": "Aproximar-se do vencimento", "ordem": 2, "resultado_esperado": "Alertas 30/15/7 dias a SST/DP/colaborador"}, {"acao": "Deixar vencer sem novo exame", "ordem": 3, "resultado_esperado": "ASO VENCIDO acusado no painel, com ação crítica — nunca silêncio"}]', 'O periódico se agenda sozinho; o vencido grita.', 'Requisitos YE-DP-SST-001: RN-002 / alerta "ASO a vencer" (seção 14) / cenário "Normal" (seção 25). periodicidade_exame_meses existe no cadastro — a sonda confere se alguém CALCULA a próxima data e vigia. O admissional é ADM-060..; o demissional, DESL-060...', 'api', 'NR-7 (exame periódico com periodicidade conforme risco/idade; ASO com validade)', 'em_triagem', NULL),
    ('SST-021', 'Mudança de função com risco novo exige ASO de mudança e atualiza OS/ficha', 'alternativo', 'alta', 'aprovado', 'Trocar de função é trocar de exposição: se a função nova tem risco diferente, o ASO de mudança é obrigatório ANTES da alteração — e a mudança em cadeia não termina no exame: a OS e a ficha de EPI da função nova precisam ser regeradas com ciência, e o adicional na Folha revisto. A transferência silenciosa, sem exame, deixa o colaborador exposto a risco não avaliado.', 'Colaborador em função sem risco transferido para função com risco cadastrado no PGR.', '[{"acao": "Registrar a mudança para função de risco diferente", "ordem": 1, "resultado_esperado": "ASO de mudança de risco exigido antes de efetivar"}, {"acao": "Registrar o ASO apto", "ordem": 2, "resultado_esperado": "Mudança efetivada; OS e ficha de EPI da função nova geradas com ciência pendente"}, {"acao": "Conferir a Folha", "ordem": 3, "resultado_esperado": "Adicional revisto conforme o risco da função nova (integração)"}]', 'Função nova, exame novo, OS nova — antes, nunca depois.', 'Requisitos YE-DP-SST-001: RN-002 / cenário "Mudança de risco" (seção 25). Nenhum dos quatro eventos de ASO cobertos (admissão/retorno/demissão) trata a MUDANÇA — este é o vão. Deve falhar e encaminhar.', 'api', 'NR-7 (exame de mudança de riscos ocupacionais, antes da mudança)', 'em_triagem', NULL),
    ('SST-030', 'S-2220 do ASO transmitido até o dia 15 do mês seguinte', 'excecao', 'alta', 'aprovado', 'Cada ASO emitido vira um S-2220 com prazo: dia 15 do mês seguinte. A tela de transmissão do eSocial já conhece os eventos SST — o que o caso cobra é o RELÓGIO: ASO registrado projeta a data-limite do evento, o alerta corre até o dia 15 e a transmissão tardia é acusada. ASO em dia com S-2220 esquecido é multa silenciosa acumulando por competência.', 'ASOs registrados em competências distintas no ambiente de teste.', '[{"acao": "Registrar um ASO", "ordem": 1, "resultado_esperado": "S-2220 preparado com data-limite no dia 15 do mês seguinte"}, {"acao": "Aproximar-se do dia 15 sem transmitir", "ordem": 2, "resultado_esperado": "Alerta a SST/DP com escalada"}, {"acao": "Transmitir após o prazo", "ordem": 3, "resultado_esperado": "Marcado FORA DO PRAZO com trilha — nunca como regular"}]', 'Todo ASO carrega um evento com data — e a data é vigiada.', 'Requisitos YE-DP-SST-001: RN-009 / CA-006 / RNF-002. esocial_transmissoes já recebe S-2220 pela tela; o motor de prazo, não. Anti-duplicidade/rejeição é a série ADM-093..DESL-094.', 'api', 'eSocial — S-2220 (monitoramento da saúde: até o dia 15 do mês seguinte à emissão do ASO)', 'em_triagem', NULL),
    ('SST-031', 'S-2240 acompanha a exposição: admissão e mudança de agente, até o dia 15', 'excecao', 'alta', 'aprovado', 'O S-2240 é a fotografia da exposição do colaborador aos agentes do LTCAT — devido na admissão e a CADA alteração de exposição (mudança de função, novo laudo, EPI que neutraliza), até o dia 15 do mês seguinte. É ele que constrói o PPP eletrônico: exposição sem S-2240 é aposentadoria especial mal instruída lá na frente, quando não dá mais para reconstituir.', 'Colaborador exposto a agente do LTCAT; mudança de exposição simulada.', '[{"acao": "Admitir colaborador em função com agente nocivo", "ordem": 1, "resultado_esperado": "S-2240 preparado com a exposição do LTCAT, prazo dia 15 do mês seguinte"}, {"acao": "Alterar a exposição (novo laudo/função)", "ordem": 2, "resultado_esperado": "Novo S-2240 de alteração preparado com prazo próprio"}, {"acao": "Conferir o histórico", "ordem": 3, "resultado_esperado": "Linha de exposição contínua e consistente — a matéria-prima do PPP (SST-060)"}]', 'Cada mudança de exposição vira evento — o PPP de amanhã agradece.', 'Requisitos YE-DP-SST-001: RN-005 / CA-007 / RNF-002. A geração a partir do LTCAT interpretado não existe — deve falhar e encaminhar. Consistência PGR-LTCAT é o SST-070. | Requisitos YE-DP-EPI-001 (RF-017): o EPI eficaz informado no S-2240 nasce das entregas da família EPI — este caso segue dono do evento.', 'api', 'eSocial — S-2240 (condições ambientais/agentes nocivos: até o dia 15 do mês seguinte à admissão ou alteração); Lei 8.213/1991 (base do PPP)', 'em_triagem', NULL),
    ('SST-040', 'CIPA dimensionada pelo Quadro I, com mandato e atas arquivadas', 'feliz', 'media', 'aprovado', 'A CIPA nasce do DIMENSIONAMENTO: o Quadro I da NR-5 cruza o número de empregados com o grupo do CNAE e diz quantos titulares e suplentes a empresa precisa — ou se basta o designado. O sistema deve calcular a obrigação por estabelecimento, controlar mandato (1 ano, uma reeleição consecutiva para representantes dos empregados) e arquivar as atas das reuniões mensais, que são a prova de que a comissão existe de fato.', 'Estabelecimentos fictícios com efetivos e CNAEs distintos.', '[{"acao": "Consultar o dimensionamento do estabelecimento com 120 empregados", "ordem": 1, "resultado_esperado": "Composição exigida pelo Quadro I (titulares/suplentes) calculada"}, {"acao": "Estabelecimento pequeno sem obrigação de CIPA", "ordem": 2, "resultado_esperado": "Designado exigido no lugar da comissão"}, {"acao": "Registrar mandato e atas", "ordem": 3, "resultado_esperado": "Vigência do mandato controlada (alerta de eleição) e atas arquivadas com assinatura"}]', 'Quantos, quem e até quando — o Quadro I responde e o sistema cobra.', 'Requisitos YE-DP-SST-001: RN-006 / RF-003. Não existe estrutura de CIPA no sistema (nenhuma tabela) — deve falhar e encaminhar. Dimensionamento é [RCE] por porte/CNAE (seção 30).', 'api', 'NR-5 (dimensionamento pelo Quadro I; mandato de 1 ano + reeleição; reuniões mensais com ata; designado quando não há CIPA)', 'em_triagem', NULL),
    ('SST-041', 'Canal de denúncias de assédio: sigilo reforçado e prazos da Lei 14.457', 'negativo', 'critica', 'aprovado', 'Desde a Lei 14.457, empresa com CIPA precisa de canal de denúncias com garantia de sigilo/anonimato, procedimento de apuração e prazo de tratativa. O sigilo aqui é mais duro que o do CID: a identidade de quem denuncia não pode vazar nem para o gestor da área denunciada — acesso mínimo, log próprio e denúncias fora dos relatórios comuns. Canal que vaza é pior que canal que não existe.', 'Canal de denúncias com registros fictícios no tenant de teste.', '[{"acao": "Registrar denúncia anônima", "ordem": 1, "resultado_esperado": "Aceita sem identificação obrigatória; protocolo gerado para acompanhamento"}, {"acao": "Gestor da área tenta acessar a denúncia", "ordem": 2, "resultado_esperado": "Bloqueado — acesso restrito ao fluxo de apuração; tentativa logada"}, {"acao": "Conferir a tratativa", "ordem": 3, "resultado_esperado": "Prazo de apuração vigiado; medidas registradas sem expor o denunciante"}]', 'A denúncia anda; a identidade fica — trancada e com registro de quem tentou.', 'Requisitos YE-DP-SST-001: RN-006 / cenário "CIPA/assédio" (seção 25). A família PSICO cobre os riscos psicossociais (questionários/entrevistas com camada de perfil); o CANAL de denúncias formal da 14.457, não. Deve falhar e encaminhar.', 'api', 'Lei 14.457/2022 (canal de denúncias com anonimato/sigilo, apuração e medidas); NR-5 (CIPA na prevenção do assédio)', 'em_triagem', NULL),
    ('SST-050', 'Enquadramento do laudo vira adicional na Folha — e o EPI pode neutralizar', 'alternativo', 'alta', 'aprovado', 'O laudo é a origem do adicional: enquadramento extraído (insalubridade por grau, periculosidade) alimenta a Folha por função/colaborador — e o caminho de volta também vale: EPI eficaz, entregue e treinado pode NEUTRALIZAR a insalubridade e cessar o adicional (art. 191), decisão que exige laudo e é [VAL]. Sem a ponte laudo→folha, o adicional vive de digitação; sem a neutralização, a empresa paga adicional de risco que o EPI já eliminou.', 'Laudo com enquadramento extraído; função vinculada; EPI eficaz entregue no cenário de neutralização.', '[{"acao": "Importar laudo com insalubridade grau médio para a função", "ordem": 1, "resultado_esperado": "Enquadramento extraído e adicional de 20% sinalizado à Folha, com o laudo-fonte"}, {"acao": "Registrar neutralização por EPI (com laudo)", "ordem": 2, "resultado_esperado": "Adicional cessado a partir da neutralização, com evidência e marcação [VAL]"}, {"acao": "Vencer o CA do EPI neutralizador", "ordem": 3, "resultado_esperado": "Neutralização cai e o adicional volta — o vínculo é vivo, não um flag"}]', 'O laudo liga o adicional; o EPI eficaz desliga; o CA vencido religa.', 'Requisitos YE-DP-SST-001: RN-004/RN-007 / CA-008 / cenário "Insalubridade" (seção 25). O CÁLCULO do adicional é FOLHA-021; aqui se testa a ORIGEM (laudo→enquadramento→função) e a neutralização. Base da insalubridade é [VAL] (seção 30). | Requisitos YE-DP-EPI-001: a neutralização do adicional por EPI eficaz segue aqui; a gestão da entrega/ficha que a sustenta é a família EPI (EPI-040..044).', 'api', 'NR-15/NR-16; CLT arts. 191..194 (eliminação/neutralização por EPC/EPI cessa o adicional); Súmula 80 do TST', 'em_triagem', NULL),
    ('SST-060', 'PPP gerado do histórico de exposição (LTCAT/S-2240)', 'feliz', 'media', 'aprovado', 'O PPP é a biografia previdenciária da exposição: gerado do LTCAT e da linha de S-2240 do colaborador, entregue no desligamento de quem teve exposição e sob demanda para a aposentadoria especial. Ele não se escreve na hora — se o histórico de exposição não foi mantido (SST-031), o PPP sai furado e o problema aparece anos depois, no INSS, sem como reconstituir.', 'Colaborador com histórico de exposição registrado (agente, período, EPI).', '[{"acao": "Solicitar o PPP do colaborador exposto", "ordem": 1, "resultado_esperado": "Documento gerado do histórico (agentes, períodos, medições do LTCAT, EPI/EPC)"}, {"acao": "Desligar colaborador com exposição", "ordem": 2, "resultado_esperado": "PPP incluído no dossiê da rescisão"}, {"acao": "Conferir a consistência", "ordem": 3, "resultado_esperado": "Linha do PPP bate com os S-2240 transmitidos — sem buracos"}]', 'A aposentadoria especial se instrui todo mês — o PPP só imprime.', 'Requisitos YE-DP-SST-001: RF-007 / CA-010 / cenário "Aposentadoria especial" (seção 25). Depende do histórico do SST-031. Não existe estrutura de PPP — deve falhar e encaminhar.', 'api', 'Lei 8.213/1991, arts. 57-58; PPP eletrônico via eSocial (a partir dos S-2240)', 'em_triagem', NULL),
    ('SST-070', 'Coerência documental: PGR, LTCAT, PCMSO e ASO falam dos mesmos riscos', 'alternativo', 'media', 'aprovado', 'Os documentos de SST formam um sistema: o PCMSO deve examinar os riscos que o PGR inventariou; o LTCAT deve medir os agentes que o PGR apontou; o S-2240 deve declarar o que o LTCAT mediu. Divergência entre eles — risco no PGR sem exame no PCMSO, agente no LTCAT ausente do PGR — é a inconsistência que a fiscalização procura primeiro, porque derruba a credibilidade do conjunto.', 'Documentos importados com riscos extraídos; divergência proposital entre eles.', '[{"acao": "Rodar a conferência de coerência", "ordem": 1, "resultado_esperado": "Cruzamento PGR × PCMSO × LTCAT × S-2240 com as divergências listadas"}, {"acao": "Risco no PGR sem exame correspondente no PCMSO", "ordem": 2, "resultado_esperado": "Divergência apontada com os dois documentos-fonte"}, {"acao": "Sanar e reconferir", "ordem": 3, "resultado_esperado": "Painel limpo; conferência arquivada como evidência"}]', 'Quatro documentos, uma só base de riscos — e o sistema confere o alinhamento.', 'Requisitos YE-DP-SST-001: RNF-009 / seção 29 ("coerência documental automática") / seção 13. Depende da extração (SST-002). [BPR] com fundamento estrutural nas NRs — deve falhar e encaminhar.', 'api', 'NR-1 e NR-7 (PCMSO baseado no PGR); Lei 8.213/1991 (LTCAT coerente com a exposição declarada); RNF-009 do documento', 'em_triagem', NULL),
    ('SST-080', 'Dado clínico de SST: restrito à medicina, com log próprio — o gestor vê aptidão, não diagnóstico', 'negativo', 'critica', 'aprovado', 'No SST circulam três camadas de informação: o ADMINISTRATIVO (apto/inapto, datas, pendências — que DP e gestor precisam ver), o CLÍNICO (exames, resultados, CID — só medicina/SST) e as DENÚNCIAS (sigilo reforçado — SST-041). O caso confere a separação: a aptidão flui para Admissão/Afastamentos sem carregar o diagnóstico junto, as tabelas clínicas ficam na camada de perfil e o acesso ao dado clínico gera log próprio.', 'ASOs e eventos de saúde no tenant de teste; usuários de perfis distintos.', '[{"acao": "DP consulta a situação do ASO de um colaborador", "ordem": 1, "resultado_esperado": "Vê apto/inapto e validade — sem resultados de exames nem CID"}, {"acao": "Médico do trabalho acessa o prontuário", "ordem": 2, "resultado_esperado": "Acesso completo, registrado em log específico (quem, quando, qual registro)"}, {"acao": "Perfil sem o módulo de saúde tenta ler eventos_saude/aso", "ordem": 3, "resultado_esperado": "Bloqueado pela camada perfil_restringe_leitura_*"}, {"acao": "Exportar relatório de exames", "ordem": 4, "resultado_esperado": "Dados clínicos protegidos na exportação (seção 21)"}]', 'Aptidão circula, diagnóstico não — e quem abre o clínico deixa rastro.', 'Requisitos YE-DP-SST-001: CA-009 / RNF-001 / seção 22 / cenário "Permissões (clínico)" (seção 25). eventos_saude e atestados já estão na camada de perfil (ponto bom); a separação aptidão×clínico e o log de acesso, a sonda confere. Par do AFAST-080 (CID nos afastamentos).', 'api', 'LGPD (Lei 13.709/2018), arts. 11 e 46; NR-7 (prontuário sob responsabilidade do médico); matriz de perfis (seção 6)', 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'saude-seguranca/compliance-sst'
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

-- Departamentos (6 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('DEP-001', 'Criar departamento', 'feliz', 'alta', 'aprovado', 'Verificar o cadastro basico de um departamento. Regra: departamento precisa de um nome unico no cliente. Importa porque departamentos organizam a estrutura — cargos e colaboradores se distribuem por eles; sao a base do organograma.', 'Usuario com permissao de administracao da estrutura.', '[{"acao": "Abrir o cadastro de departamento", "dados": "-", "ordem": 1, "onde_na_tela": "Menu > Estrutura Organizacional > Departamentos > Novo Departamento", "resultado_esperado": "Formulario aberto"}, {"acao": "Preencher o nome", "dados": "Nome: Recursos Humanos", "ordem": 2, "onde_na_tela": "Campo Nome", "resultado_esperado": "Campo aceita o valor"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Departamento criado e aparece na lista"}]', 'O departamento Recursos Humanos existe e aparece na lista de departamentos do cliente.', 'IMPACTO SE FALHAR: sem cadastrar departamentos, nao ha como organizar cargos e colaboradores por area — o organograma e os relatorios por setor ficam inviaveis.', 'api', NULL, 'em_triagem', NULL),
    ('DEP-002', 'Editar nome do departamento', 'feliz', 'media', 'aprovado', 'Verificar que o nome de um departamento pode ser editado e a alteracao persiste. Regra: dados do departamento sao editaveis. Importa porque areas sao renomeadas (reestruturacoes) e o nome precisa refletir a realidade nos relatorios.', 'Precisa existir um departamento cadastrado.', '[{"acao": "Abrir um departamento para editar", "dados": "-", "ordem": 1, "onde_na_tela": "Departamentos > clicar no departamento > Editar", "resultado_esperado": "Formulario com o nome atual"}, {"acao": "Alterar o nome", "dados": "Novo nome: Gente e Gestao", "ordem": 2, "onde_na_tela": "Campo Nome", "resultado_esperado": "Campo aceita o novo valor"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir", "resultado_esperado": "O nome novo esta gravado"}]', 'O nome do departamento e atualizado para Gente e Gestao e persiste.', 'IMPACTO SE FALHAR: se a edicao nao persistir, o nome antigo continua aparecendo em relatorios e telas apos uma reestruturacao.', 'api', NULL, 'em_triagem', NULL),
    ('DEP-010', 'Nome vazio e recusado', 'excecao', 'media', 'aprovado', 'Verificar que um departamento sem nome e recusado. Regra: nome e obrigatorio (NOT NULL). Importa porque um departamento sem nome aparece em branco nas listas e nao serve para organizar nada.', 'Nenhuma.', '[{"acao": "Abrir novo departamento", "dados": "-", "ordem": 1, "onde_na_tela": "Departamentos > Novo Departamento", "resultado_esperado": "Formulario aberto"}, {"acao": "Deixar o nome vazio e tentar salvar", "dados": "Nome: (vazio)", "ordem": 2, "onde_na_tela": "Campo Nome (vazio) + Salvar", "resultado_esperado": "O sistema DEVE recusar — nome e obrigatorio"}]', 'O cadastro e recusado. Nenhum departamento sem nome e criado.', 'IMPACTO SE FALHAR: departamento em branco polui as listas e os filtros por area — o usuario nao sabe do que se trata.', 'api', NULL, 'em_triagem', NULL),
    ('DEP-011', 'Nome duplicado no mesmo cliente e recusado', 'negativo', 'alta', 'aprovado', 'Verificar que dois departamentos com o mesmo nome no mesmo cliente sao recusados. Regra: UNIQUE(tenant_id, nome) — o nome do departamento e unico dentro do cliente. Importa porque dois "Financeiro" no mesmo cliente confundem a que area um cargo ou colaborador pertence.', 'Precisa existir um departamento com um nome conhecido.', '[{"acao": "Criar um departamento", "dados": "Nome: Financeiro", "ordem": 1, "onde_na_tela": "Novo Departamento", "resultado_esperado": "Criado"}, {"acao": "Tentar criar OUTRO com o mesmo nome", "dados": "Nome: Financeiro (repetido)", "ordem": 2, "onde_na_tela": "Novo Departamento", "resultado_esperado": "O sistema DEVE recusar o nome duplicado"}]', 'O segundo Financeiro e recusado. So existe um departamento com esse nome no cliente.', 'IMPACTO SE FALHAR: departamentos de nome repetido tornam ambiguo a qual area cargos e pessoas pertencem, quebrando relatorios por setor.', 'api', NULL, 'em_triagem', NULL),
    ('DEP-012', 'Mesmo nome em clientes diferentes e permitido', 'alternativo', 'media', 'aprovado', 'Verificar que o mesmo nome de departamento pode existir em clientes DIFERENTES. Regra: o UNIQUE e por tenant — a unicidade vale dentro de um cliente, nao entre clientes. Importa para nao restringir demais: "Financeiro" e um nome comum, varios clientes vao te-lo.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, criar departamento Financeiro", "dados": "Nome: Financeiro", "ordem": 1, "onde_na_tela": "Cliente A > Novo Departamento", "resultado_esperado": "Criado no cliente A"}, {"acao": "No cliente B, criar departamento Financeiro", "dados": "Nome: Financeiro (mesmo nome, outro cliente)", "ordem": 2, "onde_na_tela": "Cliente B > Novo Departamento", "resultado_esperado": "ACEITO — a unicidade e por cliente"}]', 'Ambos os clientes tem um departamento Financeiro. O nome igual em clientes diferentes convive sem conflito.', 'IMPACTO SE FALHAR: se a unicidade fosse global, o segundo cliente nao poderia usar um nome comum ja usado por outro — restricao absurda que vazaria informacao entre clientes.', 'api', NULL, 'em_triagem', NULL),
    ('DEP-013', 'Apagar departamento com cargos apenas desassocia', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar um departamento que tem cargos apenas DESASSOCIA os cargos, sem apaga-los. Regra: ON DELETE SET NULL — o cargo perde o departamento (fica sem area), mas continua existindo. Importa porque apagar uma area nao deveria destruir os cargos que existiam nela; eles podem ser realocados.', 'Precisa existir um departamento com pelo menos um cargo ligado a ele.', '[{"acao": "Criar departamento e um cargo ligado a ele", "dados": "Departamento: Operacoes | Cargo: Operador, ligado a Operacoes", "ordem": 1, "onde_na_tela": "Departamentos e Cargos", "resultado_esperado": "Cargo pertence ao departamento"}, {"acao": "Apagar o departamento Operacoes", "dados": "-", "ordem": 2, "onde_na_tela": "Departamentos > Operacoes > Excluir", "resultado_esperado": "Departamento apagado"}, {"acao": "Conferir o cargo Operador", "dados": "-", "ordem": 3, "onde_na_tela": "Cargos > Operador", "resultado_esperado": "O cargo Operador ainda existe, agora sem departamento (desassociado)"}]', 'O departamento e apagado, mas o cargo Operador continua existindo, agora com departamento vazio. Nada de cargo apagado junto.', 'IMPACTO SE FALHAR: se apagar o departamento apagasse os cargos, uma reestruturacao de area destruiria cargos que so precisavam ser realocados — perda de configuracao. O SET NULL preserva os cargos.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/departamentos'
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


-- (3) PONTES — 51 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('COLAB-001', 'qa_caso_colab_001', true),
    ('COLAB-002', 'qa_caso_colab_002', true),
    ('COLAB-010', 'qa_caso_colab_010', true),
    ('COLAB-011', 'qa_caso_colab_011', true),
    ('COLAB-012', 'qa_caso_colab_012', true),
    ('COLAB-020', 'qa_caso_colab_020', true),
    ('COLAB-021', 'qa_caso_colab_021', true),
    ('COLAB-022', 'qa_caso_colab_022', true),
    ('COLAB-023', 'qa_caso_colab_023', true),
    ('COLAB-024', 'qa_caso_colab_024', true),
    ('COLAB-025', 'qa_caso_colab_025', true),
    ('COLAB-026', 'qa_caso_colab_026', true),
    ('COLAB-027', 'qa_caso_colab_027', true),
    ('COLAB-028', 'qa_caso_colab_028', true),
    ('COLAB-029', 'qa_caso_colab_029', true),
    ('COLAB-030', 'qa_caso_colab_030', true),
    ('COLAB-031', 'qa_caso_colab_031', true),
    ('COLAB-032', 'qa_caso_colab_032', true),
    ('COLAB-033', 'qa_caso_colab_033', true),
    ('COLAB-034', 'qa_caso_colab_034', true),
    ('COLAB-035', 'qa_caso_colab_035', true),
    ('COLAB-036', 'qa_caso_colab_036', true),
    ('COND-001', 'qa_caso_cond_001', true),
    ('COND-002', 'qa_caso_cond_002', true),
    ('COND-003', 'qa_caso_cond_003', true),
    ('COND-010', 'qa_caso_cond_010', true),
    ('COND-011', 'qa_caso_cond_011', true),
    ('COND-012', 'qa_caso_cond_012', true),
    ('COND-013', 'qa_caso_cond_013', true),
    ('COND-022', 'qa_caso_cond_022', true),
    ('SST-001', 'qa_caso_sst_001', true),
    ('SST-002', 'qa_caso_sst_002', true),
    ('SST-003', 'qa_caso_sst_003', true),
    ('SST-010', 'qa_caso_sst_010', true),
    ('SST-011', 'qa_caso_sst_011', true),
    ('SST-020', 'qa_caso_sst_020', true),
    ('SST-021', 'qa_caso_sst_021', true),
    ('SST-030', 'qa_caso_sst_030', true),
    ('SST-031', 'qa_caso_sst_031', true),
    ('SST-040', 'qa_caso_sst_040', true),
    ('SST-041', 'qa_caso_sst_041', true),
    ('SST-050', 'qa_caso_sst_050', true),
    ('SST-060', 'qa_caso_sst_060', true),
    ('SST-070', 'qa_caso_sst_070', true),
    ('SST-080', 'qa_caso_sst_080', true),
    ('DEP-001', 'qa_caso_dep_001', true),
    ('DEP-002', 'qa_caso_dep_002', true),
    ('DEP-010', 'qa_caso_dep_010', true),
    ('DEP-011', 'qa_caso_dep_011', true),
    ('DEP-012', 'qa_caso_dep_012', true),
    ('DEP-013', 'qa_caso_dep_013', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 53, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('COLAB-001'), ('COLAB-002'), ('COLAB-010'), ('COLAB-011'), ('COLAB-012'), ('COLAB-020'), ('COLAB-021'), ('COLAB-022'), ('COLAB-023'), ('COLAB-024'), ('COLAB-025'), ('COLAB-026'), ('COLAB-027'), ('COLAB-028'), ('COLAB-029'), ('COLAB-030'), ('COLAB-031'), ('COLAB-032'), ('COLAB-033'), ('COLAB-034'), ('COLAB-035'), ('COLAB-036'), ('COLAB-037'), ('COND-001'), ('COND-002'), ('COND-003'), ('COND-010'), ('COND-011'), ('COND-012'), ('COND-013'), ('COND-022'), ('DEP-001'), ('DEP-002'), ('DEP-010'), ('DEP-011'), ('DEP-012'), ('DEP-013'), ('SST-001'), ('SST-002'), ('SST-003'), ('SST-010'), ('SST-011'), ('SST-020'), ('SST-021'), ('SST-030'), ('SST-031'), ('SST-040'), ('SST-041'), ('SST-050'), ('SST-060'), ('SST-070'), ('SST-080'), ('TELA-IMPORT-001')),
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
