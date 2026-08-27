-- ============================================================================
-- ENTREGA — BANCADA DE QA NA PRODUCAO — parte 7 de 15
-- Empresa (1 de 2)
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

-- (1) ROTINAS — 59 funcoes de teste.

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_dado_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_tipo text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar empresa com tipo de pessoa = "mei"';
  r.esperado:='Idealmente recusado — so pj e pf sao valores previstos';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, tipo_pessoa)
    VALUES (v_t, '[QA] Tipo Pessoa Invalido', '11333444000343', 'mei') RETURNING id INTO v_id;
    SELECT tipo_pessoa INTO v_tipo FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU tipo_pessoa = "%s". So pj e pf sao previstos (MEI e uma pj). O tipo decide qual documento identifica a empresa.', v_tipo);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: tipo de pessoa restrito a pj ou pf.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_dado_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_dado_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Cadastrar empresa com razao social e CNPJ';
  r.esperado := 'Empresa criada e recuperavel';
  v_id := public.qa_nova_empresa('[QA-EMP] Alfa Industria LTDA', '11222333000181');
  IF EXISTS (SELECT 1 FROM public.empresa_cadastro WHERE id = v_id) THEN
    r.situacao := 'passou'; r.obtido := 'Empresa criada e encontrada.';
  ELSE r.situacao := 'falhou'; r.obtido := 'Nao encontrada apos criar.'; END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_gr int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Cadastrar empresa com grau de risco 3, SESMT proprio, CIPA ativa';
  r.esperado := 'Dados de SST gravados';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, nome_fantasia, cnpj, ativo,
     grau_risco, sesmt_situacao, sesmt_obrigatorio, cipa_situacao, cipa_obrigatoria)
  VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] Beta SST', '[QA-EMP] Beta', '11222333000262', true,
          3, 'proprio', true, 'ativa', true)
  RETURNING id INTO v_id;
  SELECT grau_risco INTO v_gr FROM public.empresa_cadastro WHERE id = v_id;
  IF v_gr = 3 THEN r.situacao := 'passou'; r.obtido := 'Empresa com grau de risco 3 e SST persistidos.';
  ELSE r.situacao := 'falhou'; r.obtido := format('grau_risco gravado = %s (esperado 3).', v_gr); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_nome text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa e depois alterar a razao social';
  r.esperado := 'Novo nome persiste no mesmo registro';
  v_id := public.qa_nova_empresa('[QA-EMP] Nome Antigo', '11222333000343');
  UPDATE public.empresa_cadastro SET razao_social = '[QA-EMP] Nome Novo' WHERE id = v_id;
  SELECT razao_social INTO v_nome FROM public.empresa_cadastro WHERE id = v_id;
  IF v_nome = '[QA-EMP] Nome Novo' THEN r.situacao := 'passou'; r.obtido := 'Edicao persistiu.';
  ELSE r.situacao := 'falhou'; r.obtido := format('Nome = %s.', v_nome); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Tentar cadastrar empresa com grau_risco = 5 (fora de 1-4)';
  r.esperado := 'Recusado pelo CHECK (NR-04 vai de 1 a 4)';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, grau_risco)
    VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] Risco Invalido', 'x', '11222333000424', 5);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU grau_risco = 5.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com check_violation, como manda a NR-04.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Tentar sesmt_situacao = "meio-termo" (fora da lista)';
  r.esperado := 'Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, sesmt_situacao)
    VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] SESMT Invalido', 'x', '11222333000505', 'meio-termo');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU sesmt_situacao invalida.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com check_violation.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Tentar cipa_situacao = "parcial" (fora da lista)';
  r.esperado := 'Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, nome_fantasia, cnpj, cipa_situacao)
    VALUES (public.qa_sandbox_tenant_id(), '[QA-EMP] CIPA Invalido', 'x', '11222333000686', 'parcial');
    r.situacao := 'falhou'; r.obtido := 'ACEITOU cipa_situacao invalida.';
  EXCEPTION WHEN check_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado com check_violation.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa ativa com CNPJ sem pontuacao';
  r.esperado := 'Criar OUTRA ativa com o MESMO CNPJ formatado e recusado';
  PERFORM public.qa_nova_empresa('[QA-EMP] Primeira', '11222333000767', true);
  r.passo_ordem := 2; r.passo_acao := 'Tentar segunda empresa ativa com CNPJ formatado (11.222.333/0007-67)';
  BEGIN
    PERFORM public.qa_nova_empresa('[QA-EMP] Segunda', '11.222.333/0007-67', true);
    r.situacao := 'falhou';
    r.obtido := 'ACEITOU duplicata — a trava nao normalizou a pontuacao do CNPJ.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Recusado: a trava reconheceu o CNPJ formatado como o mesmo numero.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa ativa com um CNPJ';
  r.esperado := 'Segunda empresa ativa com o mesmo CNPJ e recusada';
  PERFORM public.qa_nova_empresa('[QA-EMP] Ativa 1', '11222333000848', true);
  r.passo_ordem := 2; r.passo_acao := 'Tentar segunda empresa ATIVA com o mesmo CNPJ';
  BEGIN
    PERFORM public.qa_nova_empresa('[QA-EMP] Ativa 2', '11222333000848', true);
    r.situacao := 'falhou'; r.obtido := 'ACEITOU duas empresas ativas com o mesmo CNPJ.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: a trava impede CNPJ ativo duplicado.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_021()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_inativa uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1; r.passo_acao := 'Criar uma empresa ATIVA e outra INATIVA com o mesmo CNPJ';
  r.esperado := 'Ativar a inativa (UPDATE ativo=true) e recusado';
  PERFORM public.qa_nova_empresa('[QA-EMP] Ja Ativa', '11222333000929', true);
  v_inativa := public.qa_nova_empresa('[QA-EMP] Inativa', '11222333000929', false);
  r.passo_ordem := 2; r.passo_acao := 'Tentar ativar a segunda (mesmo CNPJ ja ativo na primeira)';
  BEGIN
    UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_inativa;
    r.situacao := 'falhou'; r.obtido := 'ATIVOU a duplicata — a trava nao pega o UPDATE.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou'; r.obtido := 'Recusado: nao da pra ativar duplicata de CNPJ.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_021()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_021 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem := 1; r.passo_acao := 'Criar empresa no cercado 1';
  r.esperado := 'Consultando o tenant 2, a empresa do tenant 1 nao aparece';
  PERFORM public.qa_nova_empresa('[QA-EMP] Secreta T1', '11222333001000', true);
  r.passo_ordem := 2; r.passo_acao := 'Contar, filtrando pelo tenant 2, quantos veem essa empresa';
  SELECT count(*) INTO v_vis FROM public.empresa_cadastro
  WHERE tenant_id = v_t2 AND cnpj = '11222333001000';
  IF v_vis = 0 THEN r.situacao := 'passou'; r.obtido := 'Empresa do tenant 1 invisivel para o tenant 2.';
  ELSE r.situacao := 'falhou'; r.obtido := format('VAZAMENTO: %s empresa(s) do tenant 1 visiveis pelo tenant 2.', v_vis); END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  r.situacao := 'erro'; r.obtido := 'A rotina quebrou'; r.erro_tecnico := SQLERRM; RETURN r;
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_023()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_023()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_023 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_024()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
          public.qa_cpf(2401), 'colaborador', 'ativo')
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_024()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_024 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_025()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
          public.qa_cpf(2501), 'colaborador', 'ativo')
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_025()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_025 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_030()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_tot int; v_pct numeric; v_ex int; v_at int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar empresa com 350 empregados, 3%, cota 11, 11 PcDs';
  r.esperado:='Dados de cota persistidos corretamente';
  v_id := public.qa_empresa_com_cota('[QA] Cota Coerente', '11222333000181', 350, 3, 11, 11);
  SELECT total_colaboradores, pcd_percentual_exigido, pcd_quantidade_exigida, pcd_quantidade_atual
    INTO v_tot, v_pct, v_ex, v_at FROM public.empresa_cadastro WHERE id=v_id;
  IF v_tot=350 AND v_pct=3 AND v_ex=11 AND v_at=11 THEN
    r.situacao:='passou';
    r.obtido:='Cota gravada: 350 empregados, 3%, exige 11, tem 11 — regular. (350 x 3% = 10,5 -> 11)';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava 350/3/11/11, obteve %s/%s/%s/%s.', v_tot, v_pct, v_ex, v_at);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_030()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_030 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_031()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pct numeric; v_qtd int; v_recusou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Gravar 1.200 empregados com percentual de 2% (a Lei 8.213/91 exige 5%)';
  r.esperado    := 'Recusado OU corrigido para 5% — o valor gravado precisa ser legal';

  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, ativo, total_colaboradores,
       pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida)
    VALUES (v_t, '[QA-EMP-031] Faixa 5%', '11555666000401', true, 1200,
            true, 2.00, 24)
    RETURNING id INTO v_emp;
  EXCEPTION WHEN OTHERS THEN v_recusou := true;
  END;

  IF v_recusou THEN
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco: percentual nao corresponde a faixa legal.';
    RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao  := 'Reler o que ficou gravado';
  SELECT pcd_percentual_exigido, pcd_quantidade_exigida INTO v_pct, v_qtd
  FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_pct = 5.00 AND v_qtd = 60 THEN
    r.situacao := 'passou';
    r.obtido   := format('AUTOCORRIGIDO pelo banco: gravei 2%% e 24, ficou %s%% e %s — '
               || 'exatamente a faixa da Lei 8.213/91 para 1.200 empregados. Corrigir e '
               || 'melhor que recusar: o valor armazenado fica sempre legal e quem digitou '
               || 'errado nao fica travado.', v_pct, v_qtd);
    r.detalhe  := jsonb_build_object('escrito_pct', 2.00, 'lido_pct', v_pct,
                                     'escrito_qtd', 24, 'lido_qtd', v_qtd,
                                     'autocorrigido', true);
  ELSIF v_pct = 2.00 THEN
    r.situacao := 'falhou';
    r.obtido   := format('GRAVOU COMO VEIO: %s%% e %s PcDs para 1.200 empregados. A Lei '
               || '8.213/91, art. 93, exige 5%% nessa faixa, o que daria 60. Nem recusou '
               || 'nem corrigiu.', v_pct, v_qtd);
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Corrigiu para valor INESPERADO: %s%% e %s. Para 1.200 empregados '
               || 'a lei exige 5%% e 60.', v_pct, v_qtd);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_031()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_031 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_032()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_qtd int; v_recusou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Gravar 480 empregados, 3%, com quantidade exigida 10 (o calculo da 15)';
  r.esperado    := 'Recusado OU corrigido para 15 (480 x 3%% = 14,4, arredonda para cima)';

  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, ativo, total_colaboradores,
       pcd_obrigatoria, pcd_percentual_exigido, pcd_quantidade_exigida)
    VALUES (v_t, '[QA-EMP-032] Arredondamento', '11555666000402', true, 480,
            true, 3.00, 10)
    RETURNING id INTO v_emp;
  EXCEPTION WHEN OTHERS THEN v_recusou := true;
  END;

  IF v_recusou THEN
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco: quantidade nao corresponde ao calculo legal.';
    RETURN r;
  END IF;

  SELECT pcd_quantidade_exigida INTO v_qtd FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_qtd = 15 THEN
    r.situacao := 'passou';
    r.obtido   := format('AUTOCORRIGIDO: gravei 10, ficou %s. O arredondamento e para cima '
               || '(480 x 3%% = 14,4 -> 15), como a cota legal exige.', v_qtd);
    r.detalhe  := jsonb_build_object('escrito', 10, 'lido', v_qtd, 'autocorrigido', true);
  ELSIF v_qtd = 14 THEN
    r.situacao := 'falhou';
    r.obtido   := 'Corrigiu para 14: arredondou para BAIXO. A cota de PcD arredonda para '
               || 'cima — 14,4 vira 15. Arredondar para baixo entrega cota menor que a lei exige.';
  ELSE
    r.situacao := 'falhou';
    r.obtido   := format('Gravou %s. O calculo legal para 480 empregados a 3%% e 15.', v_qtd);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_032()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_032 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_033()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE
  r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
  v_emp uuid; v_pct numeric; v_recusou boolean := false;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem := 1;
  r.passo_acao  := 'Gravar percentual de cota = 7% (nao existe na Lei 8.213/91)';
  r.esperado    := 'Recusado OU corrigido — so 2, 3, 4 e 5%% existem na lei';

  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, ativo, total_colaboradores,
       pcd_obrigatoria, pcd_percentual_exigido)
    VALUES (v_t, '[QA-EMP-033] Percentual invalido', '11555666000403', true, 300,
            true, 7.00)
    RETURNING id INTO v_emp;
  EXCEPTION WHEN OTHERS THEN v_recusou := true;
  END;

  IF v_recusou THEN
    r.situacao := 'passou';
    r.obtido   := 'Recusado pelo banco: percentual fora do dominio legal.';
    RETURN r;
  END IF;

  SELECT pcd_percentual_exigido INTO v_pct FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_pct = 3.00 THEN
    r.situacao := 'passou';
    r.obtido   := format('AUTOCORRIGIDO: gravei 7%%, ficou %s%% — a faixa correta para 300 '
               || 'empregados (201 a 500). O valor armazenado esta dentro do dominio da '
               || 'Lei 8.213/91.', v_pct);
    r.detalhe  := jsonb_build_object('escrito', 7.00, 'lido', v_pct, 'autocorrigido', true);
  ELSIF v_pct = 7.00 THEN
    r.situacao := 'falhou';
    r.obtido   := 'GRAVOU 7%%. A Lei 8.213/91, art. 93, preve apenas 2, 3, 4 e 5%%. '
               || 'Nem recusou nem corrigiu.';
  ELSE
    r.situacao := 'passou';
    r.obtido   := format('Corrigido para %s%%, dentro do dominio legal.', v_pct);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_033()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_033 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_034()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_at int; v_tot int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar quantidade de PcD = -5 e total de empregados = -100';
  r.esperado:='Idealmente recusado — nao existe quantidade negativa de pessoas';
  BEGIN
    v_id := public.qa_empresa_com_cota('[QA] Negativos', '11444777000404', -100, 2, 0, -5);
    SELECT pcd_quantidade_atual, total_colaboradores INTO v_at, v_tot
      FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU %s PcDs e %s empregados (negativos). Campos INTEGER sem CHECK de nao-negatividade.', v_at, v_tot);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: quantidades negativas sao barradas.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_034()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_034 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_035()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_pct numeric; v_ex int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar empresa com 199 empregados (faixa 2%, cota 4)';
  r.esperado:='Ao mudar para 201, a cota deveria virar 3% e 7';
  v_id := public.qa_empresa_com_cota('[QA] Mudanca de Faixa', '11444777000595', 199, 2, 4, 4);

  r.passo_ordem:=2; r.passo_acao:='Alterar o total para 201 (cruza a faixa de 2% para 3%)';
  UPDATE public.empresa_cadastro SET total_colaboradores = 201 WHERE id = v_id;

  r.passo_ordem:=3; r.passo_acao:='Conferir se a cota gravada acompanhou a mudanca de faixa';
  SELECT pcd_percentual_exigido, pcd_quantidade_exigida INTO v_pct, v_ex
    FROM public.empresa_cadastro WHERE id=v_id;

  IF v_pct = 3 AND v_ex = 7 THEN
    r.situacao:='passou';
    r.obtido:='A cota recalculou sozinha ao mudar de faixa: 3% e 7 PcDs. Ha automacao no banco.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('A cota NAO recalculou. Empresa passou para 201 empregados (faixa de 3%%, exige 7) mas continua gravada com %s%% e %s PcDs. Sem trigger de recalculo no banco — so a tela recalcula, e apenas quando alguem edita por la.', v_pct, v_ex);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_035()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_035 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_040()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_min int; v_max int; v_at int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar empresa com faixa de aprendiz de 5 a 15, com 8 atuais';
  r.esperado:='Os tres valores persistem';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, aprendiz_obrigatorio,
     aprendiz_quantidade_minima, aprendiz_quantidade_maxima, aprendiz_quantidade_atual)
  VALUES (v_t, '[QA] Cota Aprendiz', '11444777000676', true, 5, 15, 8) RETURNING id INTO v_id;
  SELECT aprendiz_quantidade_minima, aprendiz_quantidade_maxima, aprendiz_quantidade_atual
    INTO v_min, v_max, v_at FROM public.empresa_cadastro WHERE id=v_id;
  IF v_min=5 AND v_max=15 AND v_at=8 THEN
    r.situacao:='passou'; r.obtido:='Faixa de aprendiz gravada: 5 a 15, com 8 atuais (dentro da faixa).';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava 5/15/8, obteve %s/%s/%s.', v_min, v_max, v_at);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_040()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_040 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_041()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_min int; v_max int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar faixa de aprendiz invertida: minimo 20, maximo 5';
  r.esperado:='Idealmente recusado — minimo nao pode exceder o maximo';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, aprendiz_obrigatorio,
       aprendiz_quantidade_minima, aprendiz_quantidade_maxima)
    VALUES (v_t, '[QA] Faixa Aprendiz Invertida', '11444777000757', true, 20, 5)
    RETURNING id INTO v_id;
    SELECT aprendiz_quantidade_minima, aprendiz_quantidade_maxima INTO v_min, v_max
      FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU minimo (%s) maior que o maximo (%s). Sem CHECK de coerencia — mesmo padrao do achado CARGO-012.', v_min, v_max);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: minimo nao pode ser maior que o maximo.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_041()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_041 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_conta boolean; v_trigger boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o total de empregados é derivado dos vínculos ativos?';
  r.esperado := 'total_colaboradores calculado da contagem real, atualizado por movimentação';
  SELECT bool_or(p.prosrc ILIKE '%admissoes%') INTO v_conta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recalcular_cota_pcd';
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.admissoes'::regclass AND NOT t.tgisinternal
      AND (p.proname ILIKE '%cota%' OR p.prosrc ILIKE '%total_colaboradores%'
           OR p.prosrc ILIKE '%recalcular_cota%')
  ) INTO v_trigger;

  IF coalesce(v_conta, false) AND v_trigger THEN
    r.situacao := 'passou';
    r.obtido := 'O recálculo conta os vínculos reais e dispara nas movimentações de admissão.';
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: o total de empregados ainda depende de digitação — o recálculo '
             || 'de cota %s conta de admissões e %s gatilho nas movimentações. Enquanto '
             || 'empresa_cadastro.total_colaboradores for número digitado, toda régua legal '
             || 'baseada em headcount (cota PcD, CIPA, SESMT, obrigatoriedade de ponto) herda '
             || 'o erro de digitação. Correção: derivar da contagem de vínculos ativos.',
             CASE WHEN coalesce(v_conta,false) THEN 'JÁ' ELSE 'NÃO' END,
             CASE WHEN v_trigger THEN 'tem' ELSE 'NÃO tem' END);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_emp uuid; v_antes int; v_depois int;
BEGIN
  v_emp := public.qa_empresa_com_cota('QA Cota Movimento', '19.131.243/0001-97', 100, NULL, NULL, NULL);
  SELECT total_colaboradores INTO v_antes FROM public.empresa_cadastro WHERE id = v_emp;

  r.passo_ordem := 1;
  r.passo_acao := 'Admitir um colaborador na empresa e conferir se o total/cota reagiu';
  r.esperado := 'A movimentação recalcula o total e a cota PcD automaticamente';
  PERFORM public.qa_ponto_admissao('QA Cota Movimento Colab', 7051, v_emp);
  SELECT total_colaboradores INTO v_depois FROM public.empresa_cadastro WHERE id = v_emp;

  IF v_depois IS DISTINCT FROM v_antes THEN
    r.situacao := 'passou';
    r.obtido := format('A admissão recalculou o total (%s → %s) — a cota acompanha a movimentação.',
                       coalesce(v_antes::text,'-'), coalesce(v_depois::text,'-'));
  ELSE
    r.situacao := 'falhou';
    r.obtido := format('ACHADO: admitir um colaborador NÃO mexeu no total da empresa (segue %s). '
             || 'A cota PcD da Lei 8.213/91 muda de faixa exatamente nas movimentações '
             || '(100→101 empregados muda a exigência) — sem recálculo automático, a empresa '
             || 'cruza a faixa sem saber. Correção: gatilho de admissão/desligamento '
             || 'recalculando total e cota.', coalesce(v_antes::text, '-'));
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_052()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_laudo text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a contagem de PcD tem lastro documental (laudo válido)?';
  r.esperado := 'Só contam PcDs com laudo dentro do prazo, ligados a pessoas reais';
  v_laudo := public.qa_col_existe(NULL, '%laudo%');
  IF v_laudo IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: não existe laudo em lugar nenhum do banco — pcd_quantidade_atual é um '
             || 'número sem ligação com pessoas nem com documentos. Na fiscalização, o que '
             || 'vale é o laudo caracterizador válido de cada PcD; um contador solto não '
             || 'sustenta a cota da Lei 8.213/91. Correção: marcação de PcD no vínculo com o '
             || 'laudo anexado e vigência, e a contagem derivando daí.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Lastro documental presente: %s.', v_laudo);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_052()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_052 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_053()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_est text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): a categoria "reabilitado do INSS" existe?';
  r.esperado := 'A Lei 8.213/91 admite na cota PcDs E beneficiários reabilitados — categorias distintas';
  v_est := coalesce(public.qa_col_existe(NULL, '%reabilitad%'), public.qa_fns_com('%reabilitad%'));
  IF v_est IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o sistema não conhece o beneficiário reabilitado do INSS — só "PcD". '
             || 'A Lei 8.213/91, art. 93, manda preencher a cota com as DUAS categorias; '
             || 'empresa com reabilitados no quadro não consegue computá-los e aparenta '
             || 'déficit que não tem. Correção: categoria própria no vínculo, somada na cota.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Categoria presente: %s.', v_est);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_053()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_053 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_054()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_agrupa boolean;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): o recálculo de cota agrupa matriz e filiais?';
  r.esperado := 'Cota apurada sobre o total da pessoa jurídica (todos os estabelecimentos somados)';
  SELECT bool_or(p.prosrc ILIKE '%matriz%' OR p.prosrc ILIKE '%raiz%' OR p.prosrc ILIKE '%filia%')
    INTO v_agrupa
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recalcular_cota_pcd';
  IF NOT coalesce(v_agrupa, false) THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: o recálculo de cota trata cada cadastro isoladamente — não agrupa '
             || 'matriz e filiais pela raiz do CNPJ. A cota da Lei 8.213/91 é da EMPRESA '
             || '(pessoa jurídica inteira): três filiais de 40 empregados não devem 0+0+0, '
             || 'devem a cota de 120. Correção: apuração agrupada pela raiz do CNPJ, com a '
             || 'exigência exibida no grupo.';
  ELSE
    r.situacao := 'passou';
    r.obtido := 'O recálculo agrupa os estabelecimentos da mesma pessoa jurídica.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_054()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_054 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_060()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
    (v_t, '[QA-EMP-060] Admin Um', public.qa_fixture_email('EMP-060', 1), public.qa_cpf(6001), 'administrador', 'ativo'),
    (v_t, '[QA-EMP-060] Admin Dois', public.qa_fixture_email('EMP-060', 2), public.qa_cpf(6002), 'administrador', 'ativo');

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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_060()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_060 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_061()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_061()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_061 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_070()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(700); v_dup uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_nova_empresa_pf('[QA-EMP] Firma Individual A', v_cpf, true);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segunda empresa PF ATIVA com o mesmo CPF no mesmo tenant';
  r.esperado := 'Recusado com erro de duplicidade, como acontece com CNPJ (EMP-020)';
  BEGIN
    v_dup := public.qa_nova_empresa_pf('[QA-EMP] Firma Individual B', v_cpf, true);
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU a segunda empresa ativa com o mesmo CPF. '
      'O trigger prevent_duplicate_active_cnpj compara apenas a coluna cnpj — '
      'empresa PF (cnpj nulo, documento em cpf) passa sem verificação nenhuma. '
      'A regra de unicidade de EMP-020 depende do tipo de pessoa, e não deveria.';
    RETURN r;
  EXCEPTION WHEN unique_violation THEN
    r.obtido := 'Recusado o CPF limpo.';
  END;

  r.passo_ordem := 2;
  r.passo_acao := 'Repetir com o mesmo CPF pontuado (espelho de EMP-013)';
  r.esperado := 'Reconhecido como o mesmo documento e recusado';
  BEGIN
    v_dup := public.qa_nova_empresa_pf('[QA-EMP] Firma Individual C',
      format('%s.%s.%s-%s', substr(v_cpf,1,3), substr(v_cpf,4,3), substr(v_cpf,7,3), substr(v_cpf,10,2)),
      true);
    r.situacao := 'falhou';
    r.obtido := 'O CPF pontuado entrou ativo ao lado do mesmo número limpo — a comparação precisa normalizar a pontuação, como o trigger de CNPJ já faz.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Duplicata de CPF recusada com e sem pontuação.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_070()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_070 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_emp_071()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_cpf text := public.qa_cpf(710); v_inativa uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_nova_empresa_pf('[QA-EMP] PF Ativa', v_cpf, true);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segunda empresa PF com o mesmo CPF e ativo = false';
  r.esperado := 'Aceita — a proibição vale só entre ativas (espelho de EMP-023)';
  v_inativa := public.qa_nova_empresa_pf('[QA-EMP] PF Historica', v_cpf, false);
  IF v_inativa IS NULL THEN
    r.situacao := 'falhou'; r.obtido := 'A inativa não entrou.'; RETURN r;
  END IF;

  r.passo_ordem := 2;
  r.passo_acao := 'Tentar reativar a inativa com o CPF ainda ativo na outra';
  r.esperado := 'Recusado (espelho de EMP-021)';
  BEGIN
    UPDATE public.empresa_cadastro SET ativo = true WHERE id = v_inativa;
    r.situacao := 'falhou';
    r.obtido := 'A REATIVAÇÃO PASSOU: duas empresas PF ativas com o mesmo CPF. Mesma causa de EMP-070 — o trigger de duplicidade não olha a coluna cpf.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Inativa convive; reativação com CPF já ativo é barrada.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_emp_071()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_emp_071 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_cnae text; v_grau int; v_sesmt text; v_cipa text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar enquadramento: CNAE 4120-4/00, grau 3, SESMT terceirizado, CIPA ativa';
  r.esperado:='Todo o enquadramento persistido';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, cnae_principal, cnae_descricao,
     grau_risco, sesmt_situacao, cipa_situacao)
  VALUES (v_t, '[QA] Construtora Enquadrada', '11222333000181', '4120-4/00',
          'Construcao de edificios', 3, 'terceirizado', 'ativa')
  RETURNING id INTO v_id;
  SELECT cnae_principal, grau_risco, sesmt_situacao, cipa_situacao
    INTO v_cnae, v_grau, v_sesmt, v_cipa FROM public.empresa_cadastro WHERE id=v_id;
  IF v_cnae='4120-4/00' AND v_grau=3 AND v_sesmt='terceirizado' AND v_cipa='ativa' THEN
    r.situacao:='passou';
    r.obtido:='Enquadramento completo: CNAE 4120-4/00, grau 3, SESMT terceirizado, CIPA ativa.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('cnae=%s, grau=%s, sesmt=%s, cipa=%s.', v_cnae, v_grau, v_sesmt, v_cipa);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_fap numeric;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar FAP = 5,0000 (a Lei 10.666/2003 limita a 2,0000)';
  r.esperado:='Idealmente recusado — nao existe FAP acima de 2,0';
  BEGIN
    INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, fap_atual)
    VALUES (v_t, '[QA] FAP Invalido', '11222333000262', 5.0000) RETURNING id INTO v_id;
    SELECT fap_atual INTO v_fap FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU FAP = %s. A faixa legal e 0,5000 a 2,0000 (Lei 10.666/2003). O FAP multiplica a aliquota RAT — valor invalido distorce o recolhimento previdenciario.', v_fap);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: FAP restrito a faixa legal de 0,5 a 2,0.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_orig int; v_ajus int; v_just text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Gravar empresa com grau de risco 4 ajustado para 1, sem justificativa';
  r.esperado:='Idealmente recusado — o ajuste exige fundamentacao tecnica';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, grau_risco, grau_risco_ajustado, grau_risco_justificativa)
    VALUES (v_t, '[QA] Grau Ajustado Sem Justificativa', '11222333000343', 4, 1, NULL)
    RETURNING id INTO v_id;
    SELECT grau_risco, grau_risco_ajustado, grau_risco_justificativa
      INTO v_orig, v_ajus, v_just FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU ajuste de grau %s para %s sem justificativa. O grau de risco define obrigacoes de SST — reduzi-lo sem fundamento reduz exigencias legais sem deixar rastro.', v_orig, v_ajus);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: ajustar o grau de risco exige justificativa.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_obrig boolean; v_sit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar SESMT obrigatorio com situacao "inexistente"';
  r.esperado:='Aceito (a empresa pode estar irregular), mas a irregularidade fica sem sinalizacao';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, sesmt_obrigatorio, sesmt_situacao)
  VALUES (v_t, '[QA] SESMT Irregular', '11222333000424', true, 'inexistente')
  RETURNING id INTO v_id;
  SELECT sesmt_obrigatorio, sesmt_situacao INTO v_obrig, v_sit
    FROM public.empresa_cadastro WHERE id=v_id;
  IF v_obrig AND v_sit='inexistente' THEN
    r.situacao:='passou';
    r.obtido:='Combinacao aceita, como deve ser — a empresa PODE estar irregular e precisa poder registrar. Nada e sinalizado automaticamente; hoje depende de registro manual no painel de conformidade.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('obrigatorio=%s, situacao=%s.', v_obrig, v_sit);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_ini date; v_fim date;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Gravar mandato da CIPA com fim antes do inicio';
  r.esperado:='Idealmente recusado';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, cipa_situacao,
       cipa_data_mandato_inicio, cipa_data_mandato_fim)
    VALUES (v_t, '[QA] CIPA Mandato Invertido', '11222333000505', 'ativa',
            DATE '2026-12-31', DATE '2026-01-01') RETURNING id INTO v_id;
    SELECT cipa_data_mandato_inicio, cipa_data_mandato_fim INTO v_ini, v_fim
      FROM public.empresa_cadastro WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU mandato de %s ate %s (fim antes do inicio). O controle de renovacao da CIPA usa a data de fim — periodo invertido quebra o calculo da proxima eleicao.', v_ini, v_fim);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: o fim do mandato precisa ser posterior ao inicio.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_014()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar grau de risco ajustado = 7 (a NR-04 vai ate 4)';
  r.esperado:='Recusado pelo CHECK';
  BEGIN
    INSERT INTO public.empresa_cadastro
      (tenant_id, razao_social, cnpj, grau_risco, grau_risco_ajustado)
    VALUES (v_t, '[QA] Grau Ajustado Invalido', '11222333000686', 2, 7);
    r.situacao:='falhou'; r.obtido:='ACEITOU grau ajustado fora da escala 1-4.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: o grau ajustado tambem esta limitado a 1-4, como o original.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_014()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_014 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_050()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): sesmt_obrigatorio é derivado de grau de risco × empregados?';
  r.esperado := 'A NR-04 dimensiona deterministicamente; os dois insumos já estão no cadastro';
  v_fns := public.qa_fns_com('%sesmt_obrigatorio%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: sesmt_obrigatorio é um interruptor manual — nenhuma função o deriva do '
             || 'cruzamento grau de risco × número de empregados (Quadro II da NR-04), embora '
             || 'os dois dados já existam no cadastro. Quem preenche errado carrega o '
             || 'enquadramento errado para todo o compliance. Correção: cálculo determinístico '
             || 'com o quadro da NR-04 parametrizado, mantendo o manual só como exceção '
             || 'justificada.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dimensionamento presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_050()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_050 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_enq_051()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_fns text;
BEGIN
  r.passo_ordem := 1;
  r.passo_acao := 'AUDITORIA (somente leitura): cipa_obrigatoria é derivada de CNAE × empregados?';
  r.esperado := 'A NR-05 dimensiona pelo Quadro I; switch manual é fonte de erro';
  v_fns := public.qa_fns_com('%cipa_obrigatoria%');
  IF v_fns IS NULL THEN
    r.situacao := 'falhou';
    r.obtido := 'ACHADO: cipa_obrigatoria é switch manual — nenhuma função aplica o Quadro I '
             || 'da NR-05 (dimensionamento por CNAE × número de empregados). Mesmo padrão do '
             || 'SESMT (ENQ-050): dado derivável tratado como digitação. Correção: '
             || 'dimensionamento automático com o quadro parametrizado por vigência.';
  ELSE
    r.situacao := 'passou';
    r.obtido := format('Dimensionamento presente em: %s.', v_fns);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_enq_051()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_enq_051 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_fer_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab uuid; v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-FER] Unidade SP', '11222333007101');
  v_tab := public.qa_nova_tabela_feriados('[QA-FER] Feriados SP 2026');

  r.passo_ordem := 1; r.passo_acao := 'Vincular a tabela à unidade';
  r.esperado := 'Vínculo gravado em feriado_tabela_empresas';
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab, v_emp);

  SELECT count(*) INTO v_n FROM public.feriado_tabela_empresas
  WHERE empresa_id = v_emp AND tabela_id = v_tab;
  IF v_n = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Unidade vinculada à tabela; os itens da tabela valem para ela.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('Esperado 1 vínculo, encontrado %s.', v_n);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_fer_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_fer_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_fer_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab1 uuid; v_tab2 uuid; v_n int; v_qual uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp  := public.qa_nova_empresa('[QA-FER] Unidade Troca', '11222333007202');
  v_tab1 := public.qa_nova_tabela_feriados('[QA-FER] Tabela Antiga');
  v_tab2 := public.qa_nova_tabela_feriados('[QA-FER] Tabela Nova');
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab1, v_emp);

  r.passo_ordem := 1; r.passo_acao := 'Trocar a tabela (remover a antiga, gravar a nova)';
  r.esperado := 'Após a troca, exatamente um vínculo, apontando a tabela nova';
  DELETE FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab2, v_emp);

  SELECT count(*), min(tabela_id) INTO v_n, v_qual
  FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  IF v_n <> 1 OR v_qual <> v_tab2 THEN
    r.situacao := 'falhou';
    r.obtido := format('Após a troca: %s vínculo(s), tabela %s.', v_n, v_qual);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Selecionar a opção sem tabela';
  r.esperado := 'Unidade fica sem vínculo, sem erro';
  DELETE FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  SELECT count(*) INTO v_n FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  IF v_n = 0 THEN
    r.situacao := 'passou'; r.obtido := 'Troca substitui; desvincular zera sem erro.';
  ELSE
    r.situacao := 'falhou'; r.obtido := format('Sobraram %s vínculo(s) após desvincular.', v_n);
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_fer_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_fer_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_fer_003()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab1 uuid; v_tab2 uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp  := public.qa_nova_empresa('[QA-FER] Unidade Ambigua', '11222333007303');
  v_tab1 := public.qa_nova_tabela_feriados('[QA-FER] Municipal');
  v_tab2 := public.qa_nova_tabela_feriados('[QA-FER] Estadual');
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab1, v_emp);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir segundo vínculo (outra tabela) sem apagar o primeiro';
  r.esperado := 'Recusado — uma tabela de feriados por unidade';
  BEGIN
    INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
    VALUES (v_t, v_tab2, v_emp);
    r.situacao := 'falhou';
    r.obtido := 'O BANCO ACEITOU a mesma unidade em DUAS tabelas de feriados. '
      'O UNIQUE é (tabela_id, empresa_id) e a regra de uma tabela por unidade vive só '
      'no delete-then-insert da tela — dado por API ou SQL cria a ambiguidade, e a '
      'apuração de ponto não tem critério para escolher qual calendário vale.';
  EXCEPTION WHEN unique_violation THEN
    r.situacao := 'passou';
    r.obtido := 'Segundo vínculo simultâneo recusado.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_fer_003()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_fer_003 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_fer_004()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id();
        v_emp uuid; v_tab_t2 uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN
    r.situacao := 'erro'; r.obtido := '2o cercado nao existe.'; RETURN r;
  END IF;
  v_emp    := public.qa_nova_empresa('[QA-FER] Unidade T1', '11222333007404');
  v_tab_t2 := public.qa_nova_tabela_feriados('[QA-FER] Tabela do Outro Cliente', v_t2);

  r.passo_ordem := 1;
  r.passo_acao := 'Inserir vínculo no tenant 1 apontando tabela de feriados do tenant 2';
  r.esperado := 'Recusado — tabela e unidade precisam ser do mesmo tenant';
  BEGIN
    INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
    VALUES (v_t1, v_tab_t2, v_emp);
    r.situacao := 'falhou';
    r.obtido := 'VÍNCULO CRUZANDO TENANTS ACEITO: a unidade do tenant 1 ficou presa ao '
      'calendário de feriados de outro cliente. A RLS confere o tenant da linha de '
      'vínculo, e a FK de tabela_id não olha tenant — falta um gatilho de coerência.';
  EXCEPTION WHEN OTHERS THEN
    r.situacao := 'passou';
    r.obtido := 'Vínculo cruzando tenants recusado: ' || SQLERRM;
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_fer_004()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_fer_004 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_fer_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_emp uuid; v_tab uuid; v_vinculos int; v_empresa_ok int;
BEGIN
  PERFORM public.qa_modo_ligar();
  v_emp := public.qa_nova_empresa('[QA-FER] Unidade Cascade', '11222333007505');
  v_tab := public.qa_nova_tabela_feriados('[QA-FER] Tabela Extinta');
  INSERT INTO public.feriado_tabela_empresas (tenant_id, tabela_id, empresa_id)
  VALUES (v_t, v_tab, v_emp);

  r.passo_ordem := 1; r.passo_acao := 'Apagar a tabela de feriados vinculada';
  r.esperado := 'Cascade leva o vínculo junto; nenhum vínculo órfão';
  DELETE FROM public.feriado_tabelas WHERE id = v_tab;
  SELECT count(*) INTO v_vinculos FROM public.feriado_tabela_empresas WHERE empresa_id = v_emp;
  IF v_vinculos <> 0 THEN
    r.situacao := 'falhou';
    r.obtido := format('Sobraram %s vínculo(s) órfão(s) após apagar a tabela.', v_vinculos);
    RETURN r;
  END IF;

  r.passo_ordem := 2; r.passo_acao := 'Conferir a unidade';
  r.esperado := 'Empresa intacta, apenas sem tabela';
  SELECT count(*) INTO v_empresa_ok FROM public.empresa_cadastro WHERE id = v_emp AND ativo = true;
  IF v_empresa_ok = 1 THEN
    r.situacao := 'passou'; r.obtido := 'Cascade limpou o vínculo; a unidade segue íntegra.';
  ELSE
    r.situacao := 'falhou'; r.obtido := 'A exclusão da tabela afetou a própria empresa.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_fer_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_fer_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hier_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_grupo uuid; v_emp uuid; v_grupo_da_emp uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Cadastrar um grupo economico';
  r.esperado:='A empresa fica vinculada ao grupo';
  INSERT INTO public.grupos_economicos (tenant_id, nome)
  VALUES (v_t, '[QA] Grupo Teste') RETURNING id INTO v_grupo;
  r.passo_ordem:=2; r.passo_acao:='Vincular a empresa ao grupo';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, grupo_economico_id)
  VALUES (v_t, '[QA] Empresa Do Grupo', '11333444000181', v_grupo) RETURNING id INTO v_emp;
  SELECT grupo_economico_id INTO v_grupo_da_emp FROM public.empresa_cadastro WHERE id=v_emp;
  IF v_grupo_da_emp = v_grupo THEN
    r.situacao:='passou'; r.obtido:='Empresa vinculada ao grupo economico.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A empresa nao referenciou o grupo.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hier_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hier_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hier_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
        v_grupo uuid; v_emp uuid; v_existe boolean; v_grupo_da_emp uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar grupo com uma empresa vinculada';
  r.esperado:='Apagar o grupo preserva a empresa (SET NULL)';
  INSERT INTO public.grupos_economicos (tenant_id, nome)
  VALUES (v_t, '[QA] Grupo Que Sera Apagado') RETURNING id INTO v_grupo;
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, grupo_economico_id)
  VALUES (v_t, '[QA] Empresa Sobrevivente', '11333444000262', v_grupo) RETURNING id INTO v_emp;

  r.passo_ordem:=2; r.passo_acao:='Apagar o grupo economico';
  DELETE FROM public.grupos_economicos WHERE id=v_grupo;

  r.passo_ordem:=3; r.passo_acao:='Conferir que a empresa sobreviveu';
  SELECT EXISTS(SELECT 1 FROM public.empresa_cadastro WHERE id=v_emp) INTO v_existe;
  SELECT grupo_economico_id INTO v_grupo_da_emp FROM public.empresa_cadastro WHERE id=v_emp;
  IF v_existe AND v_grupo_da_emp IS NULL THEN
    r.situacao:='passou';
    r.obtido:='Grupo apagado; a empresa sobreviveu, agora sem grupo (SET NULL). Nenhum cadastro destruido.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Empresa existe=%s, grupo=%s. Se a empresa sumiu, apagar um grupo destroi cadastros inteiros.',
                     v_existe, v_grupo_da_emp);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hier_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hier_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hier_005()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hier_005()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hier_005 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_hier_006()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
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
END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_hier_006()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_hier_006 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_jor_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_jor text; v_3t boolean; v_esc boolean; v_ins boolean; v_alt boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Registrar jornada 44h, terceiro turno, escalas especiais, insalubridade e trabalho em altura';
  r.esperado:='Jornada e condicoes persistidas';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, jornada_padrao, possui_terceiro_turno,
     possui_escalas_especiais, insalubridade, trabalho_altura, espaco_confinado, periculosidade)
  VALUES (v_t, '[QA] Industria Tres Turnos', '11222333000767', '44h semanais',
          true, true, true, true, false, false) RETURNING id INTO v_id;
  SELECT jornada_padrao, possui_terceiro_turno, possui_escalas_especiais,
         insalubridade, trabalho_altura
    INTO v_jor, v_3t, v_esc, v_ins, v_alt FROM public.empresa_cadastro WHERE id=v_id;
  IF v_jor='44h semanais' AND v_3t AND v_esc AND v_ins AND v_alt THEN
    r.situacao:='passou';
    r.obtido:='Jornada 44h, terceiro turno, escalas especiais, insalubridade e trabalho em altura registrados.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('jornada=%s, 3turno=%s, escalas=%s, insalubridade=%s, altura=%s.',
                     v_jor, v_3t, v_esc, v_ins, v_alt);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_jor_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_jor_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_jor_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar tres turnos com seus horarios';
  r.esperado:='Os tres turnos guardados como lista estruturada';
  INSERT INTO public.empresa_cadastro (tenant_id, razao_social, cnpj, turnos)
  VALUES (v_t, '[QA] Empresa Com Turnos', '11222333000848',
    '[{"nome":"1o turno","inicio":"06:00","fim":"14:00"},
      {"nome":"2o turno","inicio":"14:00","fim":"22:00"},
      {"nome":"3o turno","inicio":"22:00","fim":"06:00"}]'::jsonb)
  RETURNING id INTO v_id;
  SELECT jsonb_array_length(turnos) INTO v_qtd FROM public.empresa_cadastro WHERE id=v_id;
  IF v_qtd = 3 THEN
    r.situacao:='passou'; r.obtido:='3 turnos guardados como lista, cada um com inicio e fim.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('Esperava 3 turnos, achou %s.', v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_jor_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_jor_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_jor_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_3t boolean; v_qtd int;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Declarar terceiro turno sem cadastrar nenhum turno';
  r.esperado:='Aceito, mas a inconsistencia de preenchimento fica sem sinalizacao';
  INSERT INTO public.empresa_cadastro
    (tenant_id, razao_social, cnpj, possui_terceiro_turno, turnos)
  VALUES (v_t, '[QA] Terceiro Turno Sem Turnos', '11222333000929', true, '[]'::jsonb)
  RETURNING id INTO v_id;
  SELECT possui_terceiro_turno, jsonb_array_length(turnos) INTO v_3t, v_qtd
    FROM public.empresa_cadastro WHERE id=v_id;
  IF v_3t AND v_qtd = 0 THEN
    r.situacao:='passou';
    r.obtido:='Aceito: terceiro turno declarado com lista de turnos vazia. E preenchimento gradual, nao defeito — mas ninguem e avisado da pendencia.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('3turno=%s, turnos=%s.', v_3t, v_qtd);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_jor_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_jor_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_001()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id(); v_id uuid;
        v_cat text; v_sub text; v_st text; v_crit text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Registrar a obrigacao "Constituir CIPA" (NR-05)';
  r.esperado:='Obrigacao registrada com status pendente';
  INSERT INTO public.empresa_obrigacoes
    (tenant_id, categoria, subcategoria, titulo, base_legal, criticidade)
  VALUES (v_t, 'sst', 'cipa', '[QA] Constituir CIPA', 'NR-05', 'alta') RETURNING id INTO v_id;
  SELECT categoria, subcategoria, status, criticidade INTO v_cat, v_sub, v_st, v_crit
    FROM public.empresa_obrigacoes WHERE id=v_id;
  IF v_cat='sst' AND v_sub='cipa' AND v_st='pendente' AND v_crit='alta' THEN
    r.situacao:='passou';
    r.obtido:='Obrigacao registrada: sst/cipa, NR-05, criticidade alta, status inicial pendente.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Valores inesperados: %s/%s, status=%s, criticidade=%s.', v_cat, v_sub, v_st, v_crit);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_001()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_001 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_002()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_acao uuid; v_obr uuid; v_acao_da_obr uuid;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar a acao no plano para resolver a irregularidade';
  r.esperado:='A obrigacao referencia a acao criada';
  v_acao := public.qa_nova_acao('[QA] Contratar PcDs para atingir a cota');
  r.passo_ordem:=2; r.passo_acao:='Registrar a obrigacao nao conforme, vinculada a essa acao';
  v_obr := public.qa_nova_obrigacao('legal', '[QA] Cumprir cota de PcD', 'nao_conforme', 'alta', 'pcd', v_acao);
  SELECT acao_gerada_id INTO v_acao_da_obr FROM public.empresa_obrigacoes WHERE id=v_obr;
  IF v_acao_da_obr = v_acao THEN
    r.situacao:='passou';
    r.obtido:='Obrigacao nao conforme ligada a acao do plano — conformidade e execucao conectadas.';
  ELSE
    r.situacao:='falhou'; r.obtido:='A obrigacao nao referenciou a acao.';
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_002()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_002 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_010()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar registrar obrigacao sem titulo'; r.esperado:='Recusado (NOT NULL)';
  BEGIN
    INSERT INTO public.empresa_obrigacoes (tenant_id, categoria, titulo)
    VALUES (v_t, 'legal', NULL);
    r.situacao:='falhou'; r.obtido:='ACEITOU obrigacao sem titulo.';
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
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_010()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_010 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_011()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar status "resolvido" (fora da lista)';
  r.esperado:='Recusado pelo CHECK';
  BEGIN
    PERFORM public.qa_nova_obrigacao('legal', '[QA] Status Invalido', 'resolvido');
    r.situacao:='falhou'; r.obtido:='ACEITOU status fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou';
    r.obtido:='Recusado: status so aceita pendente/conforme/nao_conforme/em_adequacao/nao_aplicavel.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_011()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_011 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_012()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Tentar criticidade "urgentissima" (fora da lista)';
  r.esperado:='Recusado pelo CHECK';
  BEGIN
    PERFORM public.qa_nova_obrigacao('legal', '[QA] Criticidade Invalida', 'pendente', 'urgentissima');
    r.situacao:='falhou'; r.obtido:='ACEITOU criticidade fora da lista.';
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: criticidade so aceita baixa/media/alta/critica.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_012()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_012 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_013()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_acao uuid; v_obr uuid;
        v_obr_existe boolean; v_vinculo uuid; v_acao_existe boolean;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1; r.passo_acao:='Criar acao e obrigacao vinculada a ela';
  r.esperado:='Apagar a acao desvincula a obrigacao, sem apaga-la (SET NULL)';
  v_acao := public.qa_nova_acao('[QA] Acao Que Sera Apagada');
  v_obr := public.qa_nova_obrigacao('legal', '[QA] Obrigacao Sobrevivente', 'nao_conforme', 'alta', 'tac', v_acao);

  r.passo_ordem:=2; r.passo_acao:='Apagar a acao no plano';
  DELETE FROM public.plano_acoes WHERE id=v_acao;

  r.passo_ordem:=3; r.passo_acao:='Conferir que a obrigacao sobreviveu, sem o vinculo';
  SELECT EXISTS(SELECT 1 FROM public.plano_acoes WHERE id=v_acao) INTO v_acao_existe;
  SELECT EXISTS(SELECT 1 FROM public.empresa_obrigacoes WHERE id=v_obr) INTO v_obr_existe;
  SELECT acao_gerada_id INTO v_vinculo FROM public.empresa_obrigacoes WHERE id=v_obr;

  IF NOT v_acao_existe AND v_obr_existe AND v_vinculo IS NULL THEN
    r.situacao:='passou';
    r.obtido:='Acao apagada; a obrigacao sobreviveu e ficou sem acao vinculada (SET NULL). O registro de conformidade nao se perde.';
  ELSE
    r.situacao:='falhou';
    r.obtido:=format('Esperava acao apagada, obrigacao viva e vinculo nulo. Obteve: acao_existe=%s, obrigacao_existe=%s, vinculo=%s.',
                     v_acao_existe, v_obr_existe, v_vinculo);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_013()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_013 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_020()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_id uuid; v_cat text; v_sub text;
BEGIN
  PERFORM public.qa_modo_ligar();
  r.passo_ordem:=1;
  r.passo_acao:='Tentar categoria "juridico" e subcategoria "banana" (fora do previsto)';
  r.esperado:='Idealmente recusado — ha uma lista esperada documentada no codigo';
  BEGIN
    v_id := public.qa_nova_obrigacao('juridico', '[QA] Categoria Livre', 'pendente', 'media', 'banana');
    SELECT categoria, subcategoria INTO v_cat, v_sub FROM public.empresa_obrigacoes WHERE id=v_id;
    r.situacao:='falhou';
    r.obtido:=format('O BANCO ACEITOU categoria "%s" e subcategoria "%s". Sao TEXT sem CHECK — os valores validos vivem so no comentario do codigo. Uma obrigacao assim some do agrupamento do painel.', v_cat, v_sub);
  EXCEPTION WHEN check_violation THEN
    r.situacao:='passou'; r.obtido:='Recusado: categoria e subcategoria tem lista fechada.';
  END;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_020()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_020 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;

DO $qa1$
DECLARE d text := $qadef$
CREATE OR REPLACE FUNCTION public.qa_caso_obrg_022()
 RETURNS qa_retorno
 LANGUAGE plpgsql
AS $function$
DECLARE r public.qa_retorno; v_t1 uuid := public.qa_sandbox_tenant_id();
        v_t2 uuid := public.qa_sandbox2_tenant_id(); v_vis int;
BEGIN
  PERFORM public.qa_modo_ligar();
  IF v_t2 IS NULL THEN r.situacao:='erro'; r.obtido:='2o cercado nao existe.'; RETURN r; END IF;
  r.passo_ordem:=1; r.passo_acao:='Registrar obrigacao no tenant 1'; r.esperado:='Invisivel ao tenant 2';
  INSERT INTO public.empresa_obrigacoes (tenant_id, categoria, titulo, status)
  VALUES (v_t1, 'legal', '[QA] Irregularidade Secreta T1', 'nao_conforme');
  r.passo_ordem:=2; r.passo_acao:='Contar, filtrando pelo tenant 2';
  SELECT count(*) INTO v_vis FROM public.empresa_obrigacoes
   WHERE tenant_id=v_t2 AND titulo='[QA] Irregularidade Secreta T1';
  IF v_vis=0 THEN
    r.situacao:='passou'; r.obtido:='Obrigacao do tenant 1 invisivel ao tenant 2.';
  ELSE
    r.situacao:='falhou'; r.obtido:=format('VAZAMENTO: %s obrigacao(oes) visiveis.', v_vis);
  END IF;
  RETURN r;
EXCEPTION WHEN OTHERS THEN r.situacao:='erro'; r.obtido:='Quebrou'; r.erro_tecnico:=SQLERRM; RETURN r; END $function$
$qadef$;
BEGIN
  EXECUTE d;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.qa_caso_obrg_022()';
    EXECUTE d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rotina qa_caso_obrg_022 nao pode ser criada: %', SQLERRM;
  END;
END $qa1$;


-- (2) CASOS DOCUMENTADOS — 83 casos.

-- Empresa (1 de 2) (83 casos)

INSERT INTO public.qa_casos_teste (modulo_id, codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
SELECT m.id, d.codigo::text, d.titulo::text, d.tipo::text::qa_caso_tipo, d.prioridade::text::qa_prioridade, d.status::text::qa_caso_status, d.objetivo::text, d.pre_condicoes::text, d.passos::text::jsonb, d.resultado_esperado::text, d.observacoes::text, d.nivel::text, d.base_legal::text, d.disposicao::text, d.disposicao_motivo::text
FROM (VALUES
    ('CHK-001', 'Checklist reflete o preenchimento em tempo real', 'feliz', 'media', 'aprovado', 'O checklist e a leitura que o usuario tem do proprio cadastro, dividido em cinco blocos. Precisa acompanhar a digitacao, nao o salvamento.', 'Cadastro novo, em branco.', '[{"acao": "Abrir o checklist", "ordem": 1, "resultado_esperado": "Todos os obrigatorios listados como pendentes"}, {"acao": "Preencher razao social, documento, e-mail, CEP, endereco, cidade e estado", "ordem": 2, "resultado_esperado": "Bloco de dados basicos marcado como completo"}, {"acao": "Conferir a contagem de pendencias", "ordem": 3, "resultado_esperado": "Diminui conforme os campos sao preenchidos"}]', 'O checklist e espelho fiel e imediato do cadastro.', 'Cinco blocos: dados basicos, enquadramento, inclusao, FAP/TAC e jornada. Opcionais aparecem sem marcacao de obrigatorio.', 'e2e', NULL, 'em_triagem', NULL),
    ('CHK-002', 'Obrigatoriedade condicional acompanha o que foi declarado', 'alternativo', 'alta', 'aprovado', 'Varios campos so viram obrigatorios em funcao de outra escolha. E a parte mais dificil de acertar do checklist e a que ninguem testou.', 'Cadastro com os dados basicos completos.', '[{"acao": "Ligar sesmt_obrigatorio", "ordem": 1, "resultado_esperado": "Profissionais do SESMT passam a ser exigidos"}, {"acao": "Marcar CIPA como ativa", "ordem": 2, "resultado_esperado": "Mandato e membros passam a ser exigidos"}, {"acao": "Ligar pcd_obrigatoria", "ordem": 3, "resultado_esperado": "Cota exigida e PcDs atuais passam a ser exigidos"}, {"acao": "Ligar aprendiz_obrigatorio", "ordem": 4, "resultado_esperado": "Minimo e atual de aprendizes passam a ser exigidos"}, {"acao": "Ligar tac_possui", "ordem": 5, "resultado_esperado": "Detalhes do TAC passam a ser exigidos"}, {"acao": "Desligar cada uma das chaves", "ordem": 6, "resultado_esperado": "As exigencias correspondentes desaparecem, sem deixar pendencia orfa"}]', 'A exigencia nasce e morre junto com a declaracao que a origina.', 'Cinco condicionais em um caso porque a mecanica e a mesma. O passo 6 e o que garante que desmarcar limpa de verdade — pendencia orfa deixa o cadastro travado em incompleto para sempre, sem o usuario descobrir o motivo.', 'e2e', NULL, 'em_triagem', NULL),
    ('CHK-003', 'Quantidade zero conta como preenchida', 'excecao', 'media', 'aprovado', 'Zero PcDs contratados e uma resposta legitima e diferente de nao ter respondido. O checklist trata os dois campos de quantidade atual com verificacao propria, distinta do resto.', 'Empresa com cota PcD e de aprendiz obrigatorias.', '[{"acao": "Informar 0 em PcDs contratados atualmente", "ordem": 1, "resultado_esperado": "Campo considerado PREENCHIDO — zero e resposta"}, {"acao": "Deixar o campo realmente vazio", "ordem": 2, "resultado_esperado": "Considerado pendente"}, {"acao": "Repetir com aprendizes contratados", "ordem": 3, "resultado_esperado": "Mesmo comportamento"}]', 'Zero e informacao; vazio e ausencia. O checklist distingue os dois.', 'Distincao facil de perder: uma verificacao ingenua de valor vazio trataria 0 como nao preenchido e a empresa em deficit total nunca completaria o cadastro — justamente a que mais precisa aparecer como conforme para o painel funcionar.', 'e2e', NULL, 'em_triagem', NULL),
    ('DADO-010', 'Tipo de pessoa aceita valor fora de PJ/PF', 'excecao', 'media', 'aprovado', 'Verificar se o tipo de pessoa tem lista fechada. Regra: os unicos valores possiveis sao pessoa juridica (pj) e pessoa fisica (pf) — o campo tem default "pj". Importa porque o tipo define qual documento identifica a empresa (CNPJ ou CPF) e como ela e tratada em obrigacoes legais.', 'Nenhuma.', '[{"acao": "Cadastrar empresa com tipo de pessoa fora da lista", "dados": "Tipo de pessoa: mei (nao e um valor previsto; MEI e pj)", "ordem": 1, "onde_na_tela": "Via importacao ou API", "resultado_esperado": "Idealmente recusado"}]', 'O tipo invalido deveria ser recusado. RESULTADO REAL: o banco aceita — tipo_pessoa e TEXT com default "pj", sem CHECK.', 'IMPACTO: o tipo de pessoa decide qual documento valida a identidade da empresa e como ela entra em obrigacoes legais. Um valor desconhecido deixa esse comportamento indefinido. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT tipo_pessoa_valido CHECK (tipo_pessoa IN (''pj'',''pf''));', 'api', NULL, 'em_triagem', NULL),
    ('EMP-001', 'Cadastrar empresa com dados basicos validos', 'feliz', 'critica', 'aprovado', 'Verificar que uma empresa pode ser cadastrada com os dados basicos: razao social e CNPJ. Regra: toda empresa precisa de razao social e um CNPJ valido. Importa porque a empresa e a base da estrutura — colaboradores, obras e documentos penduram nela; sem cadastrar empresa, nada mais funciona para aquele cliente.', 'Usuario logado com permissao de administrador do cliente.', '[{"acao": "Abrir o cadastro de empresa", "dados": "-", "ordem": 1, "onde_na_tela": "Menu lateral > Empresas (ou Estrutura Organizacional > Empresas) > botao Nova Empresa", "resultado_esperado": "Formulario de cadastro de empresa aberto"}, {"acao": "Preencher razao social e CNPJ validos", "dados": "Razao Social: Empresa Teste Ltda | CNPJ: 11.222.333/0001-81 (valido)", "ordem": 2, "onde_na_tela": "Campos Razao Social e CNPJ", "resultado_esperado": "Os campos aceitam os valores"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Botao Salvar", "resultado_esperado": "Empresa criada e aparece na lista de empresas"}]', 'A empresa Empresa Teste Ltda existe no sistema com o CNPJ informado e aparece na lista de empresas do cliente.', 'IMPACTO SE FALHAR: a empresa e a base de tudo. Sem conseguir cadastra-la, o cliente nao consegue registrar colaboradores, obras nem documentos — bloqueia a implantacao inteira.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-002', 'Cadastrar empresa completa com dados de SST (NR-04, NR-05)', 'feliz', 'alta', 'aprovado', 'Verificar que os dados de SST (grau de risco da NR-04, situacao de SESMT e CIPA da NR-05) sao gravados junto com a empresa. Regra: essas informacoes definem as obrigacoes legais de saude e seguranca da empresa. Importa porque grau de risco e SESMT/CIPA determinam o que a empresa precisa cumprir legalmente — e a razao de ser de um sistema de SST.', 'Formulario de empresa disponivel, com a secao de SST.', '[{"acao": "Abrir nova empresa e ir a secao de SST", "dados": "-", "ordem": 1, "onde_na_tela": "Nova Empresa > secao Saude e Seguranca (NR-04/NR-05)", "resultado_esperado": "Campos de grau de risco, SESMT e CIPA visiveis"}, {"acao": "Preencher os dados de SST", "dados": "Grau de Risco: 3 | SESMT: terceirizado | CIPA: ativa", "ordem": 2, "onde_na_tela": "Campos Grau de Risco, Situacao SESMT, Situacao CIPA", "resultado_esperado": "Os valores sao aceitos"}, {"acao": "Salvar e reabrir a empresa", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > depois abrir a empresa de novo", "resultado_esperado": "Os dados de SST foram gravados e aparecem ao reabrir"}]', 'A empresa e salva com grau de risco 3, SESMT terceirizado e CIPA ativa. Ao reabrir, os tres dados de SST estao la.', 'IMPACTO SE FALHAR: se os dados de NR-04/NR-05 nao gravarem, a empresa fica sem a classificacao legal que orienta todas as obrigacoes de SST — o sistema perde a base para gerar programas, treinamentos e exigencias corretas.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-003', 'Editar dados de uma empresa existente', 'feliz', 'alta', 'aprovado', 'Verificar que dados de uma empresa existente podem ser editados e a alteracao persiste. Regra: os dados cadastrais sao editaveis (empresas mudam de endereco, telefone, etc). Importa porque dados desatualizados geram documentos e comunicacoes erradas.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir uma empresa para edicao", "dados": "-", "ordem": 1, "onde_na_tela": "Lista de Empresas > clicar na empresa > Editar", "resultado_esperado": "Formulario aberto com os dados atuais"}, {"acao": "Alterar a razao social", "dados": "Novo valor: Empresa Teste Editada Ltda", "ordem": 2, "onde_na_tela": "Campo Razao Social", "resultado_esperado": "O campo aceita o novo valor"}, {"acao": "Salvar e conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir a empresa", "resultado_esperado": "A razao social nova esta gravada"}]', 'A razao social e atualizada para o novo valor e persiste ao reabrir a empresa.', 'IMPACTO SE FALHAR: se a edicao nao persistir, dados desatualizados continuam em documentos e relatorios oficiais da empresa.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-010', 'Grau de risco fora da faixa 1-4 e recusado', 'excecao', 'alta', 'aprovado', 'Verificar que um grau de risco fora da faixa 1-4 e recusado. Regra: a NR-04 define grau de risco APENAS de 1 a 4; qualquer outro valor e invalido por lei. Importa porque um grau invalido (0, 5, 9) corromperia a classificacao legal da empresa e os documentos gerados a partir dela.', 'Formulario de empresa com o campo grau de risco.', '[{"acao": "Abrir nova empresa e ir ao grau de risco", "dados": "-", "ordem": 1, "onde_na_tela": "Nova Empresa > secao SST > Grau de Risco", "resultado_esperado": "Campo grau de risco disponivel"}, {"acao": "Tentar informar um grau invalido", "dados": "Grau de Risco: 9 (invalido — a NR-04 so vai ate 4)", "ordem": 2, "onde_na_tela": "Campo Grau de Risco", "resultado_esperado": "O sistema DEVE recusar o valor"}]', 'O grau de risco 9 e recusado. So valores de 1 a 4 sao aceitos, conforme a NR-04.', 'IMPACTO SE FALHAR: grau de risco invalido corrompe a classificacao legal da empresa e os documentos de SST derivados. O banco tem CHECK (1-4) — o caso confirma que segura.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-011', 'Situacao de SESMT com valor invalido e recusada', 'excecao', 'media', 'aprovado', 'Verificar que a situacao de SESMT so aceita os valores validos: proprio, terceirizado ou inexistente. Regra: SESMT (servico de seguranca da NR-04) tem essas tres situacoes possiveis. Importa porque um valor livre quebraria relatorios e a logica que depende de saber como a empresa gerencia o SESMT.', 'Formulario de empresa com o campo situacao SESMT.', '[{"acao": "Abrir nova empresa e ir a situacao SESMT", "dados": "-", "ordem": 1, "onde_na_tela": "Nova Empresa > secao SST > Situacao SESMT", "resultado_esperado": "Campo disponivel"}, {"acao": "Tentar um valor fora da lista", "dados": "Situacao SESMT: quase (valor invalido)", "ordem": 2, "onde_na_tela": "Campo Situacao SESMT", "resultado_esperado": "O sistema DEVE recusar"}]', 'O valor invalido e recusado. So proprio, terceirizado ou inexistente sao aceitos.', 'IMPACTO SE FALHAR: situacao de SESMT invalida quebra relatorios de SST e a logica que decide obrigacoes conforme a estrutura de seguranca da empresa.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-012', 'Situacao de CIPA com valor invalido e recusada', 'excecao', 'media', 'aprovado', 'Verificar que a situacao de CIPA so aceita valores validos: nao_constituida, em_implantacao ou ativa. Regra: a CIPA (comissao de prevencao da NR-05) tem esses estados. Importa porque o estado da CIPA orienta obrigacoes (eleicao, treinamento) e um valor invalido quebraria essa logica.', 'Formulario de empresa com o campo situacao CIPA.', '[{"acao": "Abrir nova empresa e ir a situacao CIPA", "dados": "-", "ordem": 1, "onde_na_tela": "Nova Empresa > secao SST > Situacao CIPA", "resultado_esperado": "Campo disponivel"}, {"acao": "Tentar um valor fora da lista", "dados": "Situacao CIPA: talvez (valor invalido)", "ordem": 2, "onde_na_tela": "Campo Situacao CIPA", "resultado_esperado": "O sistema DEVE recusar"}]', 'O valor invalido e recusado. So nao_constituida, em_implantacao ou ativa sao aceitos.', 'IMPACTO SE FALHAR: estado de CIPA invalido quebra a logica de obrigacoes da NR-05 (quando exigir eleicao, treinamento) e os relatorios relacionados.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-013', 'CNPJ com pontuacao e reconhecido como o mesmo numero', 'alternativo', 'alta', 'aprovado', 'Verificar que a trava de CNPJ normaliza a pontuacao: "11.222.333/0001-44" e "11222333000144" sao o mesmo numero. Regra: a comparacao de CNPJ deve ignorar pontos, barras e tracos. Importa porque, sem isso, a mesma empresa cadastrada com e sem formatacao passaria como duas — furando a trava de duplicidade.', 'Precisa existir uma empresa cadastrada com um CNPJ (formatado ou nao).', '[{"acao": "Cadastrar uma empresa com CNPJ sem pontuacao", "dados": "CNPJ: 11222333000144 (sem pontos)", "ordem": 1, "onde_na_tela": "Nova Empresa", "resultado_esperado": "Empresa criada"}, {"acao": "Tentar cadastrar outra com o MESMO CNPJ, mas formatado", "dados": "CNPJ: 11.222.333/0001-44 (mesmo numero, com pontos)", "ordem": 2, "onde_na_tela": "Nova Empresa", "resultado_esperado": "O sistema reconhece como o mesmo CNPJ e trata como duplicata"}]', 'O sistema entende que os dois CNPJs sao o mesmo numero. A formatacao nao cria uma empresa distinta.', 'IMPACTO SE FALHAR: se a normalizacao falhar, a mesma empresa entra duas vezes (uma formatada, uma nao), furando a trava de CNPJ duplicado e duplicando toda a estrutura pendurada nela.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-014', 'Documento exigido acompanha o tipo de pessoa', 'alternativo', 'alta', 'aprovado', 'tipo_pessoa define qual documento e obrigatorio: PJ exige CNPJ, PF exige CPF. Hoje isso vive so no checklist da tela.', 'Formulario de cadastro aberto.', '[{"acao": "Marcar tipo_pessoa = pj e deixar o CNPJ vazio", "ordem": 1, "resultado_esperado": "Checklist acusa CNPJ como pendencia obrigatoria"}, {"acao": "Marcar tipo_pessoa = pf", "ordem": 2, "resultado_esperado": "A pendencia passa a ser CPF, e o CNPJ deixa de ser exigido"}, {"acao": "Gravar PJ sem CNPJ direto pela API", "ordem": 3, "resultado_esperado": "Hoje: aceito. Nao ha constraint nem validacao fora da tela"}]', 'O documento obrigatorio muda conforme o tipo de pessoa, nas duas rotas de entrada.', 'GAP CONHECIDO: a constraint tipo_pessoa_valido consta como SUGERIDA em caso anterior e nunca foi aplicada. O passo 3 documenta a rota que escapa.', 'e2e', NULL, 'em_triagem', NULL),
    ('EMP-020', 'Duas empresas ATIVAS com o mesmo CNPJ no mesmo tenant e proibido', 'negativo', 'critica', 'aprovado', 'Verificar que duas empresas ATIVAS com o mesmo CNPJ no mesmo cliente sao proibidas. Regra: a trigger prevent_duplicate_active_cnpj impede dois cadastros ativos com o mesmo CNPJ. Importa porque CNPJ ativo duplicado gera confusao fiscal e documentos emitidos para a empresa errada.', 'Precisa existir uma empresa ativa com um CNPJ conhecido.', '[{"acao": "Cadastrar uma empresa ativa com um CNPJ", "dados": "Razao: Primeira | CNPJ: 11.444.777/0001-61 | Status: ativa", "ordem": 1, "onde_na_tela": "Nova Empresa", "resultado_esperado": "Empresa ativa criada"}, {"acao": "Tentar cadastrar OUTRA empresa ativa com o MESMO CNPJ", "dados": "Razao: Segunda | CNPJ: 11.444.777/0001-61 (mesmo) | Status: ativa", "ordem": 2, "onde_na_tela": "Nova Empresa", "resultado_esperado": "O sistema DEVE recusar o CNPJ ativo duplicado"}]', 'A segunda empresa ativa com o mesmo CNPJ e recusada. So uma empresa ativa por CNPJ no cliente.', 'IMPACTO SE FALHAR: dois cadastros ativos para o mesmo CNPJ confundem qual e a empresa "de verdade" — documentos, guias e relatorios podem sair pela empresa errada. A trigger prevent_duplicate_active_cnpj protege; o caso confirma.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-021', 'Reativar empresa cujo CNPJ ja esta ativo em outra e proibido', 'negativo', 'alta', 'aprovado', 'Verificar que nao da para REATIVAR uma empresa cujo CNPJ ja esta ativo em outra. Regra: a mesma protecao de CNPJ ativo unico vale tambem na edicao (UPDATE), nao so na criacao. Importa porque, sem isso, daria para burlar a trava criando a empresa inativa e depois ativando-a.', 'Precisa existir uma empresa ATIVA com um CNPJ, e uma segunda empresa INATIVA com o mesmo CNPJ.', '[{"acao": "Ter uma empresa ativa e outra inativa com o MESMO CNPJ", "dados": "Empresa A: CNPJ X, ativa | Empresa B: CNPJ X, inativa", "ordem": 1, "onde_na_tela": "Lista de Empresas", "resultado_esperado": "Uma ativa, uma inativa, mesmo CNPJ"}, {"acao": "Tentar ativar a empresa B (a inativa)", "dados": "Status: de inativa para ativa", "ordem": 2, "onde_na_tela": "Empresa B > Editar > mudar Status para ativa", "resultado_esperado": "O sistema DEVE recusar — ja existe uma ativa com esse CNPJ"}]', 'A ativacao da segunda empresa e recusada enquanto a primeira com o mesmo CNPJ estiver ativa. A regra vale no UPDATE, nao so na criacao.', 'IMPACTO SE FALHAR: se a regra so valesse na criacao, daria para burlar — criar inativa e depois ativar, chegando a duas ativas com o mesmo CNPJ. O caso garante que a edicao tambem e protegida.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-022', 'Empresa de outro tenant e invisivel', 'negativo', 'critica', 'aprovado', 'Verificar que uma empresa de um cliente e invisivel para outro cliente. Regra: o isolamento multi-tenant vale para empresas como para tudo. Importa porque ver a empresa de outro cliente exporia dados cadastrais e fiscais de terceiros — violacao de confidencialidade.', 'Dois clientes distintos no sistema (o teste usa dois ambientes isolados).', '[{"acao": "No cliente A, cadastrar uma empresa", "dados": "Razao: Empresa Secreta do A | CNPJ: 11.222.333/0001-81", "ordem": 1, "onde_na_tela": "Cliente A > Nova Empresa", "resultado_esperado": "Empresa criada no cliente A"}, {"acao": "Entrar como cliente B e procurar essa empresa", "dados": "Buscar pela razao ou CNPJ da empresa do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Empresas > busca", "resultado_esperado": "A empresa do cliente A NAO aparece para o cliente B"}]', 'A empresa cadastrada no cliente A e invisivel no cliente B. Zero vazamento entre clientes.', 'IMPACTO SE FALHAR: exporia dados cadastrais e fiscais (CNPJ, razao social) de uma empresa para outro cliente — quebra de confidencialidade e risco de LGPD. Protecao RLS por tenant; o caso verifica a cada bateria.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-023', 'Duplicata INATIVA do mesmo CNPJ e permitida', 'alternativo', 'alta', 'aprovado', 'Contraparte do EMP-020. A trigger so age quando ativo IS TRUE — de proposito. Sem este caso, alguem "melhora" a trigger para barrar todo CNPJ repetido e quebra o fluxo de desativar e recadastrar.', 'Uma empresa ativa com CNPJ conhecido.', '[{"acao": "Cadastrar segunda empresa com o MESMO CNPJ e ativo = false", "ordem": 1, "resultado_esperado": "ACEITO — a trigger nao age sobre registro inativo"}, {"acao": "Contar empresas com o CNPJ no tenant", "ordem": 2, "resultado_esperado": "2 — uma ativa, uma inativa"}, {"acao": "Tentar ativar a segunda", "ordem": 3, "resultado_esperado": "Recusado (EMP-021) enquanto a primeira estiver ativa"}]', 'Historico convive; so a ATIVACAO e exclusiva.', 'Caso de protecao, nao de defeito. Serve para que uma correcao futura da trigger nao restrinja mais do que a regra pede.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-024', 'Desativar empresa preserva vinculos e dados', 'alternativo', 'alta', 'aprovado', 'Desativar e o caminho normal de saida (o botao da lista alterna ativo). Precisa ser reversivel: nada pode ser destruido no caminho.', 'Empresa ativa com colaboradores vinculados e documentos gerados.', '[{"acao": "Anotar quantidade de vinculos e de pastas da empresa", "ordem": 1, "resultado_esperado": "Numeros registrados"}, {"acao": "Desativar a empresa (ativo = false)", "ordem": 2, "resultado_esperado": "Aceito"}, {"acao": "Reconferir vinculos e pastas", "ordem": 3, "resultado_esperado": "Intactos — desativar nao e apagar"}, {"acao": "Reativar a empresa", "ordem": 4, "resultado_esperado": "Volta ao estado anterior sem perda"}]', 'Desativacao e reversivel e nao destroi dado dependente.', 'Importa porque desativar e o caminho usado para resolver duplicata de CNPJ (EMP-020). Se desativar destruisse vinculo, a saida recomendada pelo proprio sistema causaria perda.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-025', 'Empresa com vinculo nao pode ser apagada', 'negativo', 'alta', 'aprovado', 'usuario_vinculos referencia empresa_cadastro com ON DELETE RESTRICT. O hook expoe delete(); a trava tem que estar no banco.', 'Empresa com ao menos um colaborador vinculado.', '[{"acao": "Tentar apagar a empresa", "ordem": 1, "resultado_esperado": "Recusado por foreign_key_violation (ON DELETE RESTRICT)"}, {"acao": "Revogar os vinculos e tentar de novo", "ordem": 2, "resultado_esperado": "Depende da regra de negocio — documentar o comportamento observado"}]', 'Exclusao nao pode orfanar historico de pessoa.', 'O passo 2 esta em aberto de proposito: a regra de o que fazer com empresa sem vinculo nunca foi definida. O caso serve para forcar a decisao.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-030', 'Gravar cota PcD coerente com a faixa legal', 'feliz', 'alta', 'aprovado', 'Verificar que os dados de cota PcD sao gravados e recuperados corretamente. Regra (Lei 8.213/91 art. 93): empresa com 350 empregados esta na faixa de 201 a 500, logo 3%; 350 x 3% = 10,5, que arredonda para 11. Importa porque a cota e obrigacao legal fiscalizavel — os numeros gravados sao a base do que a empresa precisa cumprir.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir a empresa e ir as obrigacoes de inclusao", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > abrir a empresa > aba Obrigacoes de Inclusao", "resultado_esperado": "Secao de cota PcD visivel"}, {"acao": "Informar o total de empregados", "dados": "Total: 350", "ordem": 2, "onde_na_tela": "Campo Total de Colaboradores", "resultado_esperado": "O sistema marca a cota como obrigatoria e calcula 3%"}, {"acao": "Conferir o calculo", "dados": "-", "ordem": 3, "onde_na_tela": "Campos Percentual Exigido e Quantidade Exigida", "resultado_esperado": "Percentual: 3% | Quantidade exigida: 11 (350 x 3% = 10,5, arredondado para cima)"}, {"acao": "Informar quantos PcDs a empresa tem e salvar", "dados": "PcDs atuais: 11", "ordem": 4, "onde_na_tela": "Campo Quantidade Atual + Salvar", "resultado_esperado": "Situacao regular, sem deficit"}]', 'A empresa fica gravada com total 350, percentual 3%, cota exigida 11 e 11 PcDs atuais — situacao regular. Os valores persistem ao reabrir.', 'IMPACTO SE FALHAR: se os dados de cota nao gravarem corretamente, a empresa perde o controle de uma obrigacao legal fiscalizavel pelo Ministerio do Trabalho, com risco de multa.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-031', 'Percentual incoerente com a faixa de empregados', 'excecao', 'alta', 'aprovado', 'Verificar se o banco aceita um percentual que nao corresponde a faixa legal do total de empregados. Regra: 1.200 empregados exigem 5%; gravar 2% seria uma cota subdimensionada. Este caso revela se ha validacao no banco. Importa porque o calculo correto vive apenas no front — dados que entrem por importacao ou API nao passam por ele.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Gravar uma empresa com 1.200 empregados mas percentual de 2%", "dados": "Total: 1200 | Percentual exigido: 2 (deveria ser 5) | Cota exigida: 24 (deveria ser 60)", "ordem": 1, "onde_na_tela": "Via importacao de planilha ou API (fora da tela, que calcularia certo)", "resultado_esperado": "Idealmente o banco DEVERIA recusar ou corrigir"}]', 'A combinacao incoerente deveria ser recusada. RESULTADO REAL: o banco aceita — nao ha validacao de coerencia entre total de empregados e percentual exigido. Uma empresa pode ficar com cota subdimensionada no sistema.', 'IMPACTO: cota subdimensionada da falsa sensacao de conformidade. A empresa acredita precisar de 24 PcDs quando a lei exige 60 — diferenca de 36 vagas, com exposicao a multa e acao civil publica. CORRECAO SUGERIDA: criar no banco uma funcao que calcule o percentual pela faixa (replicando a logica do front) e aplica-la como trigger BEFORE INSERT OR UPDATE, recalculando percentual e quantidade exigida a partir de total_colaboradores.', 'api', NULL, 'comportamento_correto', 'O banco passou a CORRIGIR SOZINHO o percentual e a quantidade da cota conforme a faixa legal, em vez de recusar a gravação. Para conformidade isso é melhor que recusar: o valor armazenado fica sempre legal, e quem digitou errado não fica travado. Os casos foram escritos esperando recusa e passaram a relatar "o banco aceitou" mostrando o valor JÁ CORRIGIDO — mensagem sem sentido, defeito da suíte. Rotinas ajustadas nesta migration para reconhecer autocorreção como resultado válido.'),
    ('EMP-032', 'Quantidade exigida que nao bate com o calculo', 'excecao', 'alta', 'aprovado', 'Verificar se o banco aceita uma quantidade exigida diferente do resultado do calculo. Regra: 480 empregados x 3% = 14,4, que arredonda para 15. Gravar 10 seria errado. Este caso revela se ha conferencia no banco. Importa porque e a quantidade exigida que orienta a contratacao.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Gravar empresa com 480 empregados, 3%, mas cota exigida 10", "dados": "Total: 480 | Percentual: 3 | Cota exigida: 10 (o correto seria 15)", "ordem": 1, "onde_na_tela": "Via importacao ou API", "resultado_esperado": "Idealmente recusado — a quantidade deveria derivar do calculo"}]', 'A quantidade incoerente deveria ser recusada ou recalculada. RESULTADO REAL: o banco aceita qualquer numero em pcd_quantidade_exigida, sem relacao com total_colaboradores e percentual.', 'IMPACTO: a empresa se orienta por uma meta errada de contratacao. No exemplo, acredita precisar de 10 PcDs quando a lei exige 15 — deficit real de 5 vagas nao identificado. CORRECAO SUGERIDA: a mesma trigger do EMP-031 deve derivar a quantidade, tornando o campo calculado em vez de livre.', 'api', NULL, 'comportamento_correto', 'O banco passou a CORRIGIR SOZINHO o percentual e a quantidade da cota conforme a faixa legal, em vez de recusar a gravação. Para conformidade isso é melhor que recusar: o valor armazenado fica sempre legal, e quem digitou errado não fica travado. Os casos foram escritos esperando recusa e passaram a relatar "o banco aceitou" mostrando o valor JÁ CORRIGIDO — mensagem sem sentido, defeito da suíte. Rotinas ajustadas nesta migration para reconhecer autocorreção como resultado válido.'),
    ('EMP-033', 'Percentual de cota fora dos valores legais', 'excecao', 'media', 'aprovado', 'Verificar se o banco aceita um percentual que nao existe na lei. Regra: os unicos percentuais validos sao 0 (isento), 2, 3, 4 e 5. Um valor como 7% ou 1,5% nao tem respaldo legal. Importa porque um percentual invalido gera uma cota sem base juridica.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Gravar uma empresa com percentual de cota fora da lei", "dados": "Percentual exigido: 7 (nao existe na Lei 8.213/91)", "ordem": 1, "onde_na_tela": "Via importacao ou API", "resultado_esperado": "Idealmente recusado pelo banco"}]', 'O percentual invalido deveria ser recusado. RESULTADO REAL: o banco aceita — o campo e NUMERIC(5,2) sem CHECK de dominio.', 'IMPACTO: cota calculada sobre percentual sem base legal. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT pcd_percentual_legal CHECK (pcd_percentual_exigido IN (0, 2, 3, 4, 5));', 'api', NULL, 'comportamento_correto', 'O banco passou a CORRIGIR SOZINHO o percentual e a quantidade da cota conforme a faixa legal, em vez de recusar a gravação. Para conformidade isso é melhor que recusar: o valor armazenado fica sempre legal, e quem digitou errado não fica travado. Os casos foram escritos esperando recusa e passaram a relatar "o banco aceitou" mostrando o valor JÁ CORRIGIDO — mensagem sem sentido, defeito da suíte. Rotinas ajustadas nesta migration para reconhecer autocorreção como resultado válido.'),
    ('EMP-034', 'Numeros negativos em campos de cota', 'excecao', 'media', 'aprovado', 'Verificar se o banco aceita quantidades negativas nos campos de cota. Regra: quantidade de pessoas nao pode ser negativa. Importa porque um valor negativo quebra os calculos de deficit e as barras de progresso da tela.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Gravar uma empresa com quantidade de PcD negativa", "dados": "PcDs atuais: -5 | Total de colaboradores: -100", "ordem": 1, "onde_na_tela": "Via importacao ou API", "resultado_esperado": "Idealmente recusado — nao existe quantidade negativa de pessoas"}]', 'Os valores negativos deveriam ser recusados. RESULTADO REAL: o banco aceita — os campos sao INTEGER sem CHECK de nao-negatividade.', 'IMPACTO: deficit calculado errado (cota 10 menos "-5 PcDs" resulta em deficit de 15) e barras de progresso quebradas. CORRECAO SUGERIDA: CHECK (>= 0) em total_colaboradores, pcd_quantidade_atual, pcd_quantidade_exigida e nos campos equivalentes de aprendiz.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-035', 'Mudar o total de empregados nao recalcula a cota gravada', 'excecao', 'critica', 'aprovado', 'Verificar o que acontece com a cota ja gravada quando o total de empregados muda. Regra esperada (cenarios 11 a 13 da especificacao): admissoes e demissoes devem recalcular a cota. Importa porque este e o coracao do controle: uma empresa que cresce de 199 para 201 empregados muda de faixa (2% para 3%) e passa a precisar de mais PcDs.', 'Precisa existir uma empresa com cota ja calculada e gravada.', '[{"acao": "Gravar uma empresa na faixa de 2%", "dados": "Total: 199 | Percentual: 2% | Cota exigida: 4", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes de Inclusao", "resultado_esperado": "Cota gravada corretamente para a faixa"}, {"acao": "Alterar o total de empregados para 201 (mudanca de faixa)", "dados": "Total: 201 (agora faixa de 3%, cota deveria virar 7)", "ordem": 2, "onde_na_tela": "Via importacao, API ou edicao do campo", "resultado_esperado": "Idealmente a cota DEVERIA recalcular sozinha"}, {"acao": "Conferir a cota gravada", "dados": "-", "ordem": 3, "onde_na_tela": "Consultar os campos de cota da empresa", "resultado_esperado": "Percentual e quantidade exigida deveriam refletir a nova faixa"}]', 'A cota deveria ser recalculada. RESULTADO REAL: os campos de cota continuam com os valores antigos (2% e 4). Nao ha trigger de recalculo no banco. Na tela, o recalculo acontece — mas so quando alguem abre a empresa e edita o total ali; por importacao ou API, a cota fica congelada.', 'IMPACTO: uma empresa que cruzou a faixa fica com cota desatualizada e nao sabe. No exemplo, acredita precisar de 4 PcDs quando ja precisa de 7 — irregular sem saber, exposta a autuacao. CORRECAO SUGERIDA: trigger BEFORE INSERT OR UPDATE OF total_colaboradores em empresa_cadastro que recalcule percentual e quantidade exigida pela faixa legal.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-036', 'Fronteiras das faixas legais da cota PcD', 'alternativo', 'critica', 'aprovado', 'As faixas da Lei 8.213/91 sao definidas por intervalos fechados. Erro de faixa quase sempre esta no limite, nao no meio: um >= trocado por > desloca a empresa inteira de percentual.', 'Formulario com total de colaboradores editavel.', '[{"acao": "Total = 99", "ordem": 1, "resultado_esperado": "Cota nao obrigatoria automaticamente"}, {"acao": "Total = 100", "ordem": 2, "resultado_esperado": "pcd_obrigatoria liga sozinha e percentual = 2%"}, {"acao": "Total = 200 e depois 201", "ordem": 3, "resultado_esperado": "2% vira 3% exatamente em 201"}, {"acao": "Total = 500 e depois 501", "ordem": 4, "resultado_esperado": "3% vira 4% exatamente em 501"}, {"acao": "Total = 1000 e depois 1001", "ordem": 5, "resultado_esperado": "4% vira 5% exatamente em 1001"}]', 'Cada troca de faixa acontece no numero exato previsto em lei.', 'Cinco fronteiras, nenhuma testada ate hoje. Uma empresa que cruza de 200 para 201 passa a precisar de mais PcDs — errar a borda subdimensiona a cota de um cliente inteiro.', 'e2e', NULL, 'em_triagem', NULL),
    ('EMP-037', 'Quantidade exigida sempre arredonda para cima', 'alternativo', 'alta', 'aprovado', 'O calculo usa Math.ceil. Arredondar para baixo entregaria cota menor que a lei exige — erro que so aparece em fiscalizacao.', 'Cota PcD obrigatoria ligada.', '[{"acao": "Total = 350, percentual 3%", "ordem": 1, "resultado_esperado": "10,5 arredonda para 11"}, {"acao": "Total = 480, percentual 3%", "ordem": 2, "resultado_esperado": "14,4 arredonda para 15"}, {"acao": "Total = 100, percentual 2%", "ordem": 3, "resultado_esperado": "Exatos 2 — sem fracao, sem arredondar"}]', 'Fracao sempre sobe, nunca desce.', 'O passo 3 protege o caso exato: arredondamento nao pode inventar uma unidade a mais quando a conta ja e inteira.', 'e2e', NULL, 'em_triagem', NULL),
    ('EMP-038', 'Cem ou mais colaboradores liga a cota sozinho', 'feliz', 'alta', 'aprovado', 'A obrigatoriedade e da lei, nao do usuario. Ao cruzar 100, o sistema liga pcd_obrigatoria sem perguntar.', 'Empresa com cota desligada e menos de 100 colaboradores.', '[{"acao": "Elevar o total para 100", "ordem": 1, "resultado_esperado": "pcd_obrigatoria liga automaticamente"}, {"acao": "Tentar desligar a cota manualmente mantendo 100+", "ordem": 2, "resultado_esperado": "Documentar o comportamento: hoje o desligamento e possivel e o automatismo religa no proximo render"}]', 'Cota obrigatoria acompanha o quadro, nao a vontade de quem preenche.', 'O passo 2 expoe um conflito real entre o switch manual e o useEffect. Vale medir antes de decidir: ou o switch fica somente-leitura acima de 100, ou o automatismo precisa respeitar a escolha explicita.', 'e2e', NULL, 'em_triagem', NULL),
    ('EMP-039', 'Abaixo de cem, cota marcada a mao usa piso de 2%', 'alternativo', 'media', 'aprovado', 'Empresa com menos de 100 empregados nao e obrigada por lei, mas pode assumir a cota voluntariamente ou por TAC. Nesse caso o sistema adota 2% como piso.', 'Empresa com menos de 100 colaboradores.', '[{"acao": "Marcar pcd_obrigatoria manualmente com total = 60", "ordem": 1, "resultado_esperado": "Percentual assume 2%"}, {"acao": "Informar percentual proprio (ex.: 4%)", "ordem": 2, "resultado_esperado": "O valor informado prevalece — o piso so vale quando nada foi informado"}, {"acao": "Conferir se o campo de percentual esta editavel", "ordem": 3, "resultado_esperado": "Editavel abaixo de 100; somente-leitura de 100 em diante"}]', 'Piso de 2% e default, nao imposicao.', 'Regra sutil e nunca documentada: o piso so entra quando pcd_percentual_exigido esta vazio. Cobre tambem a alternancia editavel/somente-leitura do campo.', 'e2e', NULL, 'em_triagem', NULL),
    ('EMP-040', 'Gravar cota de aprendiz', 'feliz', 'media', 'aprovado', 'Verificar que os dados de cota de aprendiz sao gravados e recuperados. NOTA: ao contrario da cota PcD, o sistema NAO calcula a cota de aprendiz — o auto-calculo foi removido do codigo por decisao de produto, porque a base de calculo legal e complexa (exclui funcoes que exigem formacao tecnica e cargos de confianca, conforme o Decreto 9.579/2018). Os valores sao informados manualmente.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir a empresa e ir as obrigacoes de inclusao", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > abrir > aba Obrigacoes de Inclusao > secao Jovem Aprendiz", "resultado_esperado": "Secao de aprendiz visivel"}, {"acao": "Informar a faixa de aprendizes e quantos a empresa tem", "dados": "Minimo: 5 | Maximo: 15 | Atual: 8", "ordem": 2, "onde_na_tela": "Campos Quantidade Minima, Maxima e Atual", "resultado_esperado": "Valores aceitos"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar > reabrir a empresa", "resultado_esperado": "Os tres valores persistiram"}]', 'A empresa fica gravada com faixa de aprendiz de 5 a 15 e 8 aprendizes atuais — dentro da faixa.', 'IMPACTO SE FALHAR: a empresa perde o controle da cota de aprendiz, que e obrigacao legal fiscalizavel (Lei 10.097/2000) com multa por descumprimento.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-041', 'Faixa de aprendiz invertida (minimo maior que maximo)', 'excecao', 'media', 'aprovado', 'Verificar se o banco aceita uma faixa de aprendiz incoerente. Regra: o minimo legal (5%) e sempre menor que o maximo (15%), entao minimo nao pode ser maior que maximo. Importa porque uma faixa invertida torna impossivel saber se a empresa esta ou nao em conformidade.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Gravar uma empresa com a faixa de aprendiz invertida", "dados": "Quantidade minima: 20 | Quantidade maxima: 5 (invertido)", "ordem": 1, "onde_na_tela": "Via importacao, API ou edicao", "resultado_esperado": "Idealmente recusado — minimo nao pode exceder o maximo"}]', 'A faixa invertida deveria ser recusada. RESULTADO REAL: o banco aceita — nao ha CHECK de coerencia entre aprendiz_quantidade_minima e aprendiz_quantidade_maxima.', 'IMPACTO: impossivel avaliar conformidade — com minimo 20 e maximo 5, nenhum numero de aprendizes satisfaz a faixa. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT aprendiz_faixa_coerente CHECK (aprendiz_quantidade_minima <= aprendiz_quantidade_maxima). MESMO PADRAO do achado CARGO-012 (faixa salarial invertida) — vale corrigir os dois juntos.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-042', 'Auto-calculo de aprendiz permanece desligado', 'negativo', 'media', 'aprovado', 'O calculo automatico de 5% a 15% foi removido por DECISAO DE PRODUTO e esta comentado no codigo. Sem caso registrando isso, o proximo leitor encontra codigo comentado, acha que e esquecimento e "conserta".', 'Empresa com total de colaboradores preenchido e cota de aprendiz obrigatoria.', '[{"acao": "Informar total = 200 e ligar aprendiz_obrigatorio", "ordem": 1, "resultado_esperado": "Minimo e maximo permanecem como estavam — nada e calculado"}, {"acao": "Preencher minimo e maximo manualmente", "ordem": 2, "resultado_esperado": "Valores aceitos e preservados"}, {"acao": "Alterar o total de colaboradores", "ordem": 3, "resultado_esperado": "Os valores informados NAO sao recalculados nem sobrescritos"}]', 'A cota de aprendiz e informada, nunca inferida.', 'MOTIVO DA DECISAO, registrado para nao se perder: a base de calculo do Decreto 9.579/2018 exclui funcoes que exigem formacao tecnica e cargos de confianca. Calcular sobre o headcount bruto produziria numero errado com aparencia de exatidao — pior que campo vazio.', 'e2e', NULL, 'em_triagem', NULL),
    ('EMP-050', '[A CONSTRUIR] Total de empregados vir da contagem real', 'feliz', 'alta', 'rascunho', 'ESPECIFICACAO — nao implementado. O total de empregados da empresa deveria vir da contagem de vinculos ativos, nao de digitacao manual. Hoje empresa_cadastro.total_colaboradores e um campo preenchido a mao, sem ligacao com os colaboradores cadastrados.', 'Depende de definir a regra: quais vinculos entram na contagem (ativos? por empresa? incluindo afastados?). A base de calculo da cota PcD tem definicao legal propria.', '[{"acao": "Cadastrar colaboradores vinculados a empresa", "dados": "Cadastrar 201 colaboradores ativos na empresa", "ordem": 1, "onde_na_tela": "Colaboradores > Novo", "resultado_esperado": "O total de empregados da empresa deveria passar a 201 automaticamente"}, {"acao": "Conferir o cadastro da empresa", "dados": "-", "ordem": 2, "onde_na_tela": "Empresas > Obrigacoes de Inclusao", "resultado_esperado": "Total: 201, sem ninguem ter digitado"}]', 'ESPECIFICACAO: o total deveria refletir os vinculos reais. HOJE: e um numero digitado; se o RH admite 50 pessoas, o campo nao muda.', 'ORIGEM: cenarios 11, 12, 13 e 15 da especificacao de cotas. PRE-REQUISITO para os casos EMP-051 a EMP-054 — sem o total automatico, nenhum recalculo por movimentacao e possivel. DECISAO DE PRODUTO NECESSARIA: definir a base de calculo (quais vinculos contam).', 'api', NULL, 'em_triagem', NULL),
    ('EMP-051', '[A CONSTRUIR] Admissao e demissao recalculam a cota', 'feliz', 'alta', 'rascunho', 'ESPECIFICACAO — nao implementado. Admitir ou demitir empregados deveria recalcular a cota PcD automaticamente, inclusive quando a movimentacao cruza uma faixa legal.', 'Depende do EMP-050 (total vindo da contagem real).', '[{"acao": "Partir de uma empresa com 199 empregados e 4 PcDs (regular na faixa de 2%)", "dados": "Total: 199 | Cota: 4 | PcDs: 4", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes de Inclusao", "resultado_esperado": "Situacao regular"}, {"acao": "Admitir 2 empregados nao PcD", "dados": "2 admissoes", "ordem": 2, "onde_na_tela": "Admissao > Novo", "resultado_esperado": "Total passa a 201, cruzando para a faixa de 3%"}, {"acao": "Conferir a cota", "dados": "-", "ordem": 3, "onde_na_tela": "Empresa > Obrigacoes de Inclusao", "resultado_esperado": "Cota deveria virar 7 (201 x 3% = 6,03 -> 7) e a situacao passar a irregular, com deficit de 3"}]', 'ESPECIFICACAO: a cota acompanha a movimentacao de pessoal. HOJE: nao acontece — a cota so muda se alguem editar a empresa manualmente.', 'ORIGEM: cenarios 11, 12 e 13. Inclui tambem o caso inverso (cenario 13): demitir empregados nao PcD pode fazer a empresa VOLTAR para uma faixa menor, gerando excedente em vez de deficit.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-052', '[A CONSTRUIR] Contar apenas PcDs com documentacao valida', 'feliz', 'alta', 'rascunho', 'ESPECIFICACAO — nao implementado. So deveriam contar para a cota os PcDs com laudo valido e dentro do prazo. Hoje pcd_quantidade_atual e um numero digitado, sem ligacao com pessoas nem com documentos.', 'Depende de: (a) marcar colaboradores como PcD no cadastro, (b) vincular o laudo ao colaborador, (c) controlar a validade desse laudo.', '[{"acao": "Marcar 3 colaboradores como PcD", "dados": "3 colaboradores marcados como PcD", "ordem": 1, "onde_na_tela": "Colaboradores > ficha > campo PcD", "resultado_esperado": "3 PcDs cadastrados"}, {"acao": "Anexar laudo valido a apenas 2 deles", "dados": "2 laudos validos, 1 sem laudo", "ordem": 2, "onde_na_tela": "Colaborador > Documentos > laudo PcD", "resultado_esperado": "Documentacao registrada"}, {"acao": "Conferir a contagem para a cota", "dados": "-", "ordem": 3, "onde_na_tela": "Empresa > Obrigacoes de Inclusao", "resultado_esperado": "Deveria contar 2 PcDs validos (nao 3) e alertar: PcD sem documentacao comprobatoria"}]', 'ESPECIFICACAO: a cota conta apenas PcDs comprovados. HOJE: nao existe — o sistema nao sabe quem sao os PcDs, apenas quantos alguem digitou.', 'ORIGEM: cenarios 17 e 18. RISCO DE NEGOCIO: em fiscalizacao, o que vale e a documentacao. Uma empresa pode se considerar regular contando pessoas cuja condicao nao esta comprovada, e ser autuada mesmo assim. Inclui tambem laudo VENCIDO (cenario 18), o que exige controle de validade ligado ao colaborador.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-053', '[A CONSTRUIR] Reabilitados do INSS contam para a cota', 'feliz', 'media', 'rascunho', 'ESPECIFICACAO — nao implementado. A Lei 8.213/91 admite na cota tanto pessoas com deficiencia quanto beneficiarios reabilitados do INSS. O sistema nao distingue as duas categorias.', 'Depende do EMP-052 (identificar os PcDs individualmente).', '[{"acao": "Cadastrar colaboradores em ambas as categorias", "dados": "6 PcDs + 2 reabilitados do INSS", "ordem": 1, "onde_na_tela": "Colaboradores > ficha", "resultado_esperado": "As duas categorias sao registradas distintamente"}, {"acao": "Conferir a contagem para a cota", "dados": "Empresa com 250 empregados, cota exigida 8", "ordem": 2, "onde_na_tela": "Empresa > Obrigacoes de Inclusao", "resultado_esperado": "Total valido para a cota: 8 (6 PcDs + 2 reabilitados) — situacao regular"}]', 'ESPECIFICACAO: as duas categorias somam para a cota, mas sao registradas separadamente. HOJE: nao ha distincao — existe apenas um contador unico digitado.', 'ORIGEM: cenario 19. A distincao importa alem da soma: os documentos comprobatorios sao diferentes (laudo medico para PcD, certificado de reabilitacao para o beneficiario do INSS), e a fiscalizacao pode exigir a composicao detalhada.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-054', '[A CONSTRUIR] Cota considera o total da empresa, nao de cada filial', 'feliz', 'media', 'rascunho', 'ESPECIFICACAO — nao implementado de forma garantida. A cota deve ser apurada sobre o total da empresa (todos os estabelecimentos somados), nao por filial isolada. Hoje, como o total e digitado, isso depende inteiramente de quem preenche fazer a soma certa.', 'Depende do EMP-050 (contagem automatica), que precisaria somar os vinculos de todos os estabelecimentos da empresa.', '[{"acao": "Cadastrar uma empresa com tres estabelecimentos", "dados": "Matriz: 80 empregados | Filial 1: 50 | Filial 2: 40", "ordem": 1, "onde_na_tela": "Estabelecimentos", "resultado_esperado": "Tres estabelecimentos cadastrados"}, {"acao": "Conferir o total considerado para a cota", "dados": "-", "ordem": 2, "onde_na_tela": "Empresa > Obrigacoes de Inclusao", "resultado_esperado": "Total: 170 (a soma) — cota exigida 4, e nao isencao por nenhuma filial ter menos de 100"}]', 'ESPECIFICACAO: a apuracao e por empresa, somando os estabelecimentos. HOJE: sem garantia sistemica — se quem preenche digitar o numero de uma filial so, a empresa aparece isenta ou com cota menor sem que nada acuse.', 'ORIGEM: cenarios 15 e 16. RISCO: uma empresa com tres filiais de 80, 50 e 40 empregados poderia ser lancada como isenta (nenhuma filial atinge 100), quando na verdade tem 170 empregados e deve 4 PcDs.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-060', 'Criar empresa vincula todos os administradores do tenant', 'feliz', 'media', 'aprovado', 'A trigger auto_vincular_admins_nova_empresa da acesso imediato a quem administra o cliente. Efeito colateral desejado do INSERT.', 'Tenant com 2 ou mais usuarios tipo_usuario = administrador.', '[{"acao": "Cadastrar empresa nova", "ordem": 1, "resultado_esperado": "Aceito"}, {"acao": "Listar vinculos da empresa criada", "ordem": 2, "resultado_esperado": "Um vinculo administrador ativo para CADA administrador do tenant"}, {"acao": "Conferir a observacao dos vinculos", "ordem": 3, "resultado_esperado": "Marcados como criados automaticamente ao cadastrar a empresa"}, {"acao": "Rodar a mesma criacao duas vezes (mesma empresa reprocessada)", "ordem": 4, "resultado_esperado": "ON CONFLICT DO NOTHING evita vinculo duplicado"}]', 'Administrador enxerga empresa nova sem intervencao manual.', 'O passo 4 so passou a significar algo em 15/07/2026: o ON CONFLICT DO NOTHING desta trigger era no-op desde maio, porque nao existia indice unico para conflitar. Hoje funciona. Este caso protege essa garantia.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-061', 'Criar empresa gera a estrutura de pastas de documentos', 'feliz', 'media', 'aprovado', 'A trigger auto_gerar_pastas_empresa monta a arvore documental. Empresa sem pastas quebra o modulo de documentos silenciosamente.', 'Nenhuma.', '[{"acao": "Cadastrar empresa nova", "ordem": 1, "resultado_esperado": "Aceito"}, {"acao": "Listar pastas da empresa", "ordem": 2, "resultado_esperado": "Estrutura padrao criada, nao vazia"}]', 'Toda empresa nasce com a arvore de pastas pronta.', 'Efeito colateral de INSERT nunca documentado. Se a trigger falhar, o sintoma aparece semanas depois no modulo de documentos, longe da causa.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-070', 'Duas empresas PF ATIVAS com o mesmo CPF é proibido', 'negativo', 'critica', 'aprovado', 'O trigger prevent_duplicate_active_cnpj normaliza e compara apenas a coluna cnpj. Uma empresa PF tem cnpj nulo e o documento no campo cpf — o trigger nem olha. Resultado: o mesmo CPF pode ter duas empresas ativas no mesmo tenant, exatamente o cenário que EMP-020 proíbe para PJ. A regra de unicidade não pode depender do tipo de pessoa.', 'Uma empresa PF ativa cadastrada no cercado com um CPF conhecido.', '[{"acao": "Inserir segunda empresa com tipo_pessoa = pf, mesmo CPF, ativo = true, no mesmo tenant", "ordem": 1, "resultado_esperado": "Recusado com erro de duplicidade, como acontece com CNPJ"}, {"acao": "Repetir com o CPF pontuado (000.000.000-00) contra o mesmo número limpo", "ordem": 2, "resultado_esperado": "Reconhecido como o mesmo documento e recusado, espelhando EMP-013"}]', 'A segunda empresa ativa com o mesmo CPF não entra, com ou sem pontuação.', 'ACHADO na revisão de 07/08: hoje os dois passos PASSAM (a duplicata entra). Correção sugerida: estender o trigger para comparar também a coluna cpf quando cnpj está vazio — mesma normalização, mesma mensagem. Enquanto a correção não vem, este caso deve FALHAR na bateria: é o alarme.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-071', 'Duplicata INATIVA do mesmo CPF é permitida', 'alternativo', 'media', 'aprovado', 'A contraparte de EMP-023 para PF: a proibição vale só entre ATIVAS. Histórico de reabertura de firma individual precisa conviver — a antiga fica inativa, a nova assume.', 'Uma empresa PF ativa cadastrada no cercado.', '[{"acao": "Inserir segunda empresa PF com o mesmo CPF e ativo = false", "ordem": 1, "resultado_esperado": "Aceita — inativa não conflita"}, {"acao": "Tentar reativar a inativa enquanto a outra segue ativa", "ordem": 2, "resultado_esperado": "Recusado, espelhando EMP-021"}]', 'Inativa convive; reativação com o CPF já ativo em outra é barrada.', 'Depende da correção descrita em EMP-070 — sem ela, o passo 2 também passa indevidamente.', 'api', NULL, 'em_triagem', NULL),
    ('EMP-072', 'Duplo clique no salvar não cria duas empresas', 'excecao', 'alta', 'aprovado', 'O botão Salvar tem trava de re-entrância (savingRef) e, depois do primeiro insert em modo novo, o id criado (createdIdRef) força update nas gravações seguintes. Sem isso, duplo clique ou re-render criava cadastros duplicados. Para PJ o trigger de CNPJ segura o estrago; para PF (EMP-070) e para cadastros sem documento ainda digitado, a trava da tela é a única defesa.', 'Formulário de nova empresa preenchido com os campos mínimos.', '[{"acao": "Clicar Salvar duas vezes em sequência imediata", "ordem": 1, "onde_na_tela": "Botão Salvar, cabeçalho do formulário", "resultado_esperado": "Uma única empresa criada; o segundo clique é ignorado ou vira update"}, {"acao": "Após o primeiro salvamento, alterar um campo e salvar de novo sem sair da tela", "ordem": 2, "resultado_esperado": "Atualiza a empresa criada — não nasce uma segunda"}]', 'Uma empresa no banco, independentemente de quantos cliques o salvamento levou.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('ENQ-001', 'Cadastrar o enquadramento completo da empresa', 'feliz', 'alta', 'aprovado', 'Verificar que o enquadramento legal e gravado por inteiro: CNAE principal, grau de risco, situacao de SESMT e CIPA. Regra: o CNAE define a atividade economica e, por consequencia, o grau de risco da NR-04 — que determina as obrigacoes de SST da empresa. Importa porque este conjunto e a base legal de tudo o que o sistema vai exigir dessa empresa.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir a aba de enquadramento legal", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > abrir a empresa > aba Enquadramento Legal", "resultado_esperado": "Campos de CNAE, grau de risco, SESMT e CIPA visiveis"}, {"acao": "Informar o CNAE e a descricao da atividade", "dados": "CNAE: 4120-4/00 | Descricao: Construcao de edificios", "ordem": 2, "onde_na_tela": "Campos CNAE Principal e Descricao", "resultado_esperado": "Campos aceitos"}, {"acao": "Informar grau de risco e a estrutura de SST", "dados": "Grau de risco: 3 | SESMT: terceirizado | CIPA: ativa", "ordem": 3, "onde_na_tela": "Campos Grau de Risco, Situacao SESMT, Situacao CIPA", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 4, "onde_na_tela": "Salvar", "resultado_esperado": "Todo o enquadramento persistiu"}]', 'A empresa fica com CNAE 4120-4/00, grau de risco 3, SESMT terceirizado e CIPA ativa. Os dados persistem ao reabrir.', 'IMPACTO SE FALHAR: sem o enquadramento, o sistema nao sabe quais obrigacoes de SST exigir da empresa — programas, treinamentos e prazos ficam sem base legal.', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-010', 'FAP fora da faixa legal e aceito', 'excecao', 'critica', 'aprovado', 'Verificar se o FAP respeita a faixa prevista em lei. Regra: o Fator Acidentario de Prevencao (Lei 10.666/2003) varia de 0,5000 a 2,0000 — multiplica a aliquota RAT que a empresa recolhe. Um FAP de 0,5 reduz a contribuicao pela metade; 2,0 dobra. Valores fora dessa faixa nao existem. Importa porque o FAP tem efeito financeiro direto sobre o recolhimento previdenciario.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir o enquadramento legal da empresa", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > secao FAP", "resultado_esperado": "Campo FAP visivel"}, {"acao": "Informar um FAP fora da faixa legal", "dados": "FAP: 5,0000 (a lei limita a 2,0000)", "ordem": 2, "onde_na_tela": "Campo FAP Atual", "resultado_esperado": "Idealmente recusado — nao existe FAP acima de 2,0"}]', 'O FAP fora da faixa deveria ser recusado. RESULTADO REAL: o banco aceita — fap_atual e NUMERIC(5,4) sem CHECK de faixa.', 'IMPACTO: o FAP multiplica a aliquota RAT no recolhimento previdenciario. Um valor invalido gravado distorce qualquer calculo ou projecao de custo que o use, e um FAP acima de 2,0 nao tem existencia legal — se aparecer em relatorio ou documento, e erro visivel para a contabilidade e para fiscalizacao. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT fap_faixa_legal CHECK (fap_atual IS NULL OR fap_atual BETWEEN 0.5 AND 2.0);', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-011', 'Grau de risco ajustado sem justificativa', 'excecao', 'alta', 'aprovado', 'Verificar se e possivel ajustar o grau de risco sem justificar. Regra de negocio: o grau de risco vem da NR-04 conforme o CNAE. Ajusta-lo para cima ou para baixo e uma decisao tecnica que precisa de fundamentacao — a propria tela exibe o campo de justificativa justamente quando o ajustado difere do original. Importa porque o grau de risco define obrigacoes de SST; reduzi-lo sem fundamento e reduzir exigencias legais sem base.', 'Precisa existir uma empresa com grau de risco definido.', '[{"acao": "Abrir o enquadramento de uma empresa com grau de risco 4", "dados": "Grau de risco (NR-04): 4", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal", "resultado_esperado": "Grau original exibido"}, {"acao": "Ajustar o grau para 1, sem preencher a justificativa", "dados": "Grau ajustado: 1 | Justificativa: (vazia)", "ordem": 2, "onde_na_tela": "Campo Grau de Risco Ajustado (a tela exibe o campo de justificativa ao detectar a diferenca)", "resultado_esperado": "Idealmente recusado — ajuste exige fundamentacao"}]', 'O ajuste sem justificativa deveria ser recusado. RESULTADO REAL: o banco aceita — nao ha regra que vincule o ajuste a justificativa. A tela EXIBE o campo quando detecta a diferenca, mas nao o exige.', 'IMPACTO: uma empresa pode ter o grau de risco reduzido de 4 para 1 sem qualquer registro do porque. O grau determina obrigacoes de SST (dimensionamento de SESMT, exames, treinamentos) — reduzi-lo sem fundamento reduz exigencias legais sem rastro, e em fiscalizacao nao ha como defender a decisao. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT grau_ajustado_exige_justificativa CHECK (grau_risco_ajustado IS NULL OR grau_risco_ajustado = grau_risco OR (grau_risco_justificativa IS NOT NULL AND length(trim(grau_risco_justificativa)) > 0));', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-012', 'SESMT obrigatorio mas declarado inexistente', 'excecao', 'alta', 'aprovado', 'Verificar a coerencia entre a obrigatoriedade e a situacao do SESMT. Regra de negocio: se a empresa e obrigada a ter SESMT (pelo porte e grau de risco, conforme NR-04) e a situacao informada e "inexistente", ha uma irregularidade declarada. Importa porque essa combinacao deveria ao menos gerar um alerta ou uma obrigacao de conformidade, nao passar despercebida.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Marcar o SESMT como obrigatorio para a empresa", "dados": "SESMT obrigatorio: sim", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > SESMT", "resultado_esperado": "Marcado"}, {"acao": "Informar a situacao como inexistente", "dados": "Situacao: inexistente", "ordem": 2, "onde_na_tela": "Campo Situacao SESMT", "resultado_esperado": "Aceito, mas deveria sinalizar a irregularidade"}, {"acao": "Conferir se algo foi sinalizado", "dados": "-", "ordem": 3, "onde_na_tela": "Aba Obrigacoes / painel de conformidade", "resultado_esperado": "Idealmente uma obrigacao nao conforme seria registrada"}]', 'A combinacao e aceita pelo banco — e ate faz sentido permitir, porque a empresa PODE estar irregular e precisa poder registrar isso. RESULTADO REAL: aceita, e nada e sinalizado automaticamente.', 'OBSERVACAO IMPORTANTE: este NAO e um defeito de dados — registrar que a empresa esta irregular e legitimo e necessario. O ponto e outro: a combinacao "obrigatorio + inexistente" e uma irregularidade conhecida que poderia alimentar automaticamente o painel de conformidade (empresa_obrigacoes, subcategoria sesmt, status nao_conforme). Hoje depende de alguem registrar manualmente. SUGESTAO DE PRODUTO, nao correcao de banco.', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-013', 'Mandato da CIPA com fim antes do inicio', 'excecao', 'media', 'aprovado', 'Verificar a coerencia das datas de mandato da CIPA. Regra: o mandato tem inicio e fim; o fim nao pode anteceder o inicio. Importa porque as datas controlam quando a proxima eleicao deve ocorrer — um periodo invertido quebra esse controle e pode fazer a empresa perder o prazo legal de renovacao.', 'Precisa existir uma empresa com CIPA.', '[{"acao": "Abrir o enquadramento e a secao da CIPA", "dados": "CIPA: ativa", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > CIPA", "resultado_esperado": "Campos de mandato visiveis"}, {"acao": "Informar o mandato com as datas invertidas", "dados": "Inicio: 31/12/2026 | Fim: 01/01/2026", "ordem": 2, "onde_na_tela": "Campos Inicio e Fim do Mandato", "resultado_esperado": "Idealmente recusado"}]', 'O mandato invertido deveria ser recusado. RESULTADO REAL: o banco aceita — nao ha CHECK entre as datas.', 'IMPACTO: o controle de renovacao da CIPA se baseia na data de fim do mandato. Um periodo invertido quebra o calculo de quando convocar a proxima eleicao — a empresa pode ficar com CIPA vencida sem alerta. CORRECAO SUGERIDA: ALTER TABLE empresa_cadastro ADD CONSTRAINT cipa_mandato_coerente CHECK (cipa_data_mandato_inicio IS NULL OR cipa_data_mandato_fim IS NULL OR cipa_data_mandato_inicio <= cipa_data_mandato_fim);', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-014', 'Grau de risco ajustado respeita a faixa da NR-04', 'excecao', 'media', 'aprovado', 'Verificar que o grau ajustado tambem esta limitado a 1-4. Regra: o ajuste continua sendo um grau de risco da NR-04 — nao pode sair da escala so por ser um ajuste. Importa para confirmar que a protecao existente no grau original tambem vale no ajustado.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Tentar informar um grau ajustado fora da escala", "dados": "Grau ajustado: 7 (a NR-04 vai ate 4)", "ordem": 1, "onde_na_tela": "Empresas > Enquadramento Legal > Grau de Risco Ajustado", "resultado_esperado": "O sistema DEVE recusar"}]', 'O grau ajustado fora da escala e recusado, pelo mesmo CHECK que protege o grau original.', 'IMPACTO SE FALHAR: um grau ajustado invalido corromperia a classificacao legal da empresa da mesma forma que o original — e o ajustado e o que prevalece quando existe.', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-015', 'CNAE principal preenche o grau de risco automaticamente', 'feliz', 'alta', 'aprovado', 'getGrauRiscoByCnae traduz o CNAE no grau da NR-04 e avisa por toast. E a porta de entrada de todo o enquadramento: SESMT, exames e programas dependem do grau.', 'Formulario de enquadramento aberto, grau de risco vazio.', '[{"acao": "Informar CNAE 4120-4/00 (construcao de edificios)", "ordem": 1, "resultado_esperado": "Grau de risco preenchido automaticamente e toast informando a origem"}, {"acao": "Conferir o grau atribuido", "ordem": 2, "resultado_esperado": "Corresponde ao Quadro I da NR-04 para o CNAE informado"}]', 'O grau vem do CNAE sem digitacao.', 'Regra central do modulo e sem caso ate hoje. O toast faz parte do resultado esperado: preenchimento silencioso de campo legal e pior que nenhum, porque ninguem confere o que nao viu acontecer.', 'e2e', NULL, 'em_triagem', NULL),
    ('ENQ-016', 'Auto-preenchimento nao atropela ajuste manual', 'excecao', 'alta', 'aprovado', 'O useEffect so age quando o CNAE MUDOU ou quando o grau esta vazio. Reabrir a ficha nao pode desfazer decisao tecnica de quem ajustou o grau na mao.', 'Empresa com CNAE preenchido e grau de risco ajustado manualmente para valor diferente do sugerido.', '[{"acao": "Sair da ficha e reabrir", "ordem": 1, "resultado_esperado": "O grau ajustado permanece — o automatismo nao dispara"}, {"acao": "Editar outro campo qualquer e salvar", "ordem": 2, "resultado_esperado": "O grau segue intacto"}, {"acao": "Trocar o CNAE principal", "ordem": 3, "resultado_esperado": "AI sim o grau e recalculado, com toast, porque a premissa mudou"}]', 'Automatismo cede ao ajuste humano, exceto quando a premissa muda.', 'Classe de bug perigosa e invisivel: o dado volta ao valor automatico sem ninguem perceber, e a empresa passa a operar com grau errado. O passo 3 garante que a protecao nao vire engessamento.', 'e2e', NULL, 'em_triagem', NULL),
    ('ENQ-017', 'CNAE sem grau mapeado nao quebra o cadastro', 'excecao', 'media', 'aprovado', 'CNAE inexistente, mal digitado ou fora da tabela nao pode travar o formulario nem gravar grau invalido.', 'Formulario de enquadramento aberto.', '[{"acao": "Informar um CNAE inexistente (ex.: 9999-9/99)", "ordem": 1, "resultado_esperado": "Nenhum grau atribuido, sem erro em tela, campo segue editavel"}, {"acao": "Informar texto que nao e CNAE", "ordem": 2, "resultado_esperado": "Mesmo comportamento — degrada sem quebrar"}, {"acao": "Preencher o grau manualmente", "ordem": 3, "resultado_esperado": "Aceito normalmente"}]', 'CNAE desconhecido degrada com elegancia.', 'Importa porque a tabela CNAE-grau nao e exaustiva e o campo e texto livre, sem mascara nem selecao assistida.', 'e2e', NULL, 'em_triagem', NULL),
    ('ENQ-018', 'Mandato e membros viram obrigatorios com CIPA ativa', 'alternativo', 'media', 'aprovado', 'O checklist torna mandato (inicio e fim) e membros obrigatorios quando cipa_situacao = ativa. Declarar CIPA ativa sem mandato e sem membros e declaracao vazia.', 'Empresa com CIPA obrigatoria.', '[{"acao": "Marcar situacao nao_constituida", "ordem": 1, "resultado_esperado": "Mandato e membros nao aparecem como pendencia obrigatoria"}, {"acao": "Mudar para ativa deixando mandato e membros vazios", "ordem": 2, "resultado_esperado": "Checklist passa a acusar as duas pendencias"}, {"acao": "Preencher mandato e membros", "ordem": 3, "resultado_esperado": "Pendencias resolvidas e bloco marcado como completo"}]', 'Obrigatoriedade condicional acompanha a situacao declarada.', 'Coberto so pelo checklist, sem nenhuma garantia no banco: pela API da para gravar CIPA ativa sem mandato nenhum.', 'e2e', NULL, 'em_triagem', NULL),
    ('ENQ-050', '[A CONSTRUIR] Obrigatoriedade do SESMT vem do dimensionamento', 'feliz', 'alta', 'rascunho', 'ESPECIFICACAO — nao implementado. sesmt_obrigatorio e hoje um switch manual. A NR-04 define a obrigatoriedade de forma deterministica pelo cruzamento de grau de risco com numero de empregados. Os dois dados ja estao no cadastro.', 'Depende de definir a fonte do numero de empregados (ver EMP-050) e de embarcar o Quadro II da NR-04.', '[{"acao": "Empresa grau 3 com 60 empregados", "ordem": 1, "resultado_esperado": "SESMT obrigatorio marcado automaticamente"}, {"acao": "Empresa grau 1 com 40 empregados", "ordem": 2, "resultado_esperado": "SESMT nao obrigatorio"}, {"acao": "Cruzar a faixa admitindo empregados", "ordem": 3, "resultado_esperado": "A obrigatoriedade acompanha, como acontece hoje com a cota PcD"}]', 'Obrigatoriedade derivada da norma, nao declarada por quem preenche.', 'Mesma classe do EMP-050: o dado necessario ja existe no sistema, a derivacao nao foi feita. Enquanto for switch manual, uma empresa obrigada pode ficar marcada como dispensada e o painel de conformidade concorda com o erro.', 'api', NULL, 'em_triagem', NULL),
    ('ENQ-051', '[A CONSTRUIR] Obrigatoriedade da CIPA vem do Quadro I da NR-05', 'feliz', 'media', 'rascunho', 'ESPECIFICACAO — nao implementado. cipa_obrigatoria e switch manual. A NR-05 dimensiona por CNAE e numero de empregados.', 'Depende do EMP-050 e do Quadro I da NR-05.', '[{"acao": "Empresa no grupo de CNAE aplicavel com 25 empregados", "ordem": 1, "resultado_esperado": "CIPA obrigatoria marcada automaticamente"}, {"acao": "Empresa abaixo do corte", "ordem": 2, "resultado_esperado": "Nao obrigatoria, com indicacao de designado responsavel"}]', 'Obrigatoriedade e dimensionamento derivados da norma.', 'Par do ENQ-050. Documentado agora para que a lacuna fique visivel no backlog em vez de viver so na cabeca de quem leu a NR.', 'api', NULL, 'em_triagem', NULL),
    ('FER-001', 'Vincular tabela de feriados à unidade', 'feliz', 'alta', 'aprovado', 'A aba Jornada vincula a unidade a uma tabela nomeada de feriados (feriado_tabela_empresas). É esse vínculo que diz à apuração de ponto quais dias são feriado para os colaboradores daquela unidade — errar aqui erra hora extra e adicional.', 'Uma empresa e uma tabela de feriados ativas no cercado, mesmo tenant.', '[{"acao": "Vincular a tabela à unidade", "ordem": 1, "onde_na_tela": "Empresas > abrir a empresa > aba Jornada > Tabela de feriados vinculada", "resultado_esperado": "Vínculo gravado em feriado_tabela_empresas"}, {"acao": "Conferir que a apuração passa a enxergar os feriados da tabela para essa empresa", "ordem": 2, "resultado_esperado": "Itens da tabela valem para a unidade vinculada"}]', 'A unidade fica com exatamente uma tabela vinculada e a apuração a enxerga.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('FER-002', 'Trocar a tabela vinculada substitui, não acumula', 'alternativo', 'media', 'aprovado', 'A troca de tabela na tela apaga o vínculo anterior antes de criar o novo (delete-then-insert). O caso garante que trocar deixa UM vínculo — não dois, não zero.', 'Unidade já vinculada a uma tabela; segunda tabela disponível no mesmo tenant.', '[{"acao": "Selecionar outra tabela para a mesma unidade", "ordem": 1, "onde_na_tela": "Aba Jornada > seletor de tabela", "resultado_esperado": "Vínculo antigo removido, novo criado"}, {"acao": "Selecionar a opção sem tabela", "ordem": 2, "resultado_esperado": "Unidade fica sem vínculo, sem erro"}]', 'Após qualquer troca a unidade tem no máximo um vínculo.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('FER-003', 'Unidade em duas tabelas de feriados ao mesmo tempo é proibido', 'negativo', 'alta', 'aprovado', 'O UNIQUE de feriado_tabela_empresas é (tabela_id, empresa_id) — impede repetir o MESMO par, mas não impede a mesma empresa em DUAS tabelas diferentes. A regra de uma tabela por unidade vive só no delete-then-insert do front: dado que entre por API ou SQL direto cria a ambiguidade, e a apuração de ponto não tem critério para escolher qual tabela vale.', 'Unidade vinculada a uma tabela; segunda tabela ativa no mesmo tenant.', '[{"acao": "Inserir segundo vínculo direto em feriado_tabela_empresas, para outra tabela, sem apagar o primeiro", "ordem": 1, "resultado_esperado": "Recusado — uma tabela por unidade"}]', 'O segundo vínculo simultâneo não entra.', 'ACHADO na revisão de 07/08: hoje o insert PASSA. Correção sugerida: UNIQUE (empresa_id) na tabela de vínculos — a semântica da tela já é essa. Até lá, o caso deve FALHAR na bateria.', 'api', NULL, 'em_triagem', NULL),
    ('FER-004', 'Tabela de feriados de outro cliente não pode ser vinculada', 'negativo', 'alta', 'aprovado', 'A RLS de feriado_tabela_empresas confere o tenant_id DA LINHA DE VÍNCULO, e a FK de tabela_id não olha tenant. Um vínculo com tenant_id próprio apontando para tabela de outro cliente é estruturalmente possível — e faria a apuração de uma unidade usar o calendário de outro cliente.', 'Cercado com dois tenants; tabela de feriados no tenant B, empresa no tenant A.', '[{"acao": "Inserir vínculo no tenant A apontando tabela_id do tenant B", "ordem": 1, "resultado_esperado": "Recusado — tabela e empresa precisam ser do mesmo tenant"}]', 'Vínculo cruzando tenants não entra.', 'Mesma família dos casos de coerência de tenant já documentados em outros módulos. Se o insert passar, é achado com o mesmo remédio de sempre: trigger de coerência comparando o tenant da tabela com o do vínculo.', 'api', NULL, 'em_triagem', NULL),
    ('FER-005', 'Apagar a tabela vinculada limpa o vínculo e não quebra a unidade', 'excecao', 'media', 'aprovado', 'A FK de tabela_id é ON DELETE CASCADE: apagar a tabela leva os vínculos junto. O caso confirma o cascade e que a unidade simplesmente volta ao estado sem tabela — cadastro intacto, apuração sem os feriados da tabela extinta, nenhum vínculo órfão.', 'Unidade vinculada a uma tabela de feriados no cercado.', '[{"acao": "Apagar a tabela de feriados", "ordem": 1, "resultado_esperado": "Tabela e vínculo somem juntos"}, {"acao": "Conferir a unidade", "ordem": 2, "resultado_esperado": "Empresa intacta, sem vínculo, sem erro na aba Jornada"}]', 'Cascade limpa o vínculo; a unidade segue íntegra, apenas sem tabela.', NULL, 'api', NULL, 'em_triagem', NULL),
    ('HIER-001', 'Vincular empresa a um grupo economico', 'feliz', 'media', 'aprovado', 'Verificar que uma empresa pode pertencer a um grupo economico. Regra: grupo_economico_id referencia grupos_economicos. Importa porque grupos economicos compartilham obrigacoes e permitem visao consolidada — e, no caso das cotas, a apuracao pode considerar o conjunto.', 'Precisa existir um grupo economico cadastrado.', '[{"acao": "Cadastrar um grupo economico", "dados": "Nome: Grupo Teste", "ordem": 1, "onde_na_tela": "Empresas > Grupos Economicos > Novo", "resultado_esperado": "Grupo criado"}, {"acao": "Vincular a empresa ao grupo", "dados": "Grupo: Grupo Teste", "ordem": 2, "onde_na_tela": "Empresas > abrir a empresa > campo Grupo Economico", "resultado_esperado": "Vinculo criado"}, {"acao": "Conferir", "dados": "-", "ordem": 3, "onde_na_tela": "Ficha da empresa", "resultado_esperado": "A empresa aparece vinculada ao grupo"}]', 'A empresa fica vinculada ao grupo economico.', 'IMPACTO SE FALHAR: sem o vinculo, nao ha visao consolidada por grupo — cada empresa e tratada isoladamente mesmo pertencendo ao mesmo controlador.', 'api', NULL, 'em_triagem', NULL),
    ('HIER-002', 'Apagar o grupo economico preserva as empresas', 'alternativo', 'alta', 'aprovado', 'Verificar que apagar um grupo economico nao apaga as empresas dele. Regra: grupo_economico_id ON DELETE SET NULL. Importa porque uma reorganizacao societaria nao pode destruir os cadastros das empresas — elas continuam existindo, apenas deixam de pertencer aquele grupo.', 'Precisa existir um grupo economico com pelo menos uma empresa vinculada.', '[{"acao": "Ter um grupo com uma empresa vinculada", "dados": "Grupo com empresa", "ordem": 1, "onde_na_tela": "Grupos Economicos", "resultado_esperado": "Vinculo existe"}, {"acao": "Apagar o grupo economico", "dados": "-", "ordem": 2, "onde_na_tela": "Grupos Economicos > Excluir", "resultado_esperado": "Grupo apagado"}, {"acao": "Conferir a empresa", "dados": "-", "ordem": 3, "onde_na_tela": "Empresas", "resultado_esperado": "A empresa AINDA EXISTE, agora sem grupo"}]', 'O grupo e apagado e a empresa sobrevive, sem vinculo. Nenhum cadastro de empresa e destruido.', 'IMPACTO SE FALHAR: apagar um grupo destruiria os cadastros de todas as empresas dele — com colaboradores, documentos e historico pendurados. Perda catastrofica por uma operacao que deveria ser apenas organizacional.', 'api', NULL, 'em_triagem', NULL),
    ('HIER-003', 'Alternar entre matriz e filial limpa o vinculo anterior', 'alternativo', 'media', 'aprovado', 'Marcar a unidade como matriz zera matriz_id. Sem isso, sobra um ponteiro orfao apontando para a antiga matriz.', 'Empresa cadastrada como filial, com matriz escolhida.', '[{"acao": "Alterar tipo_unidade para matriz", "ordem": 1, "resultado_esperado": "matriz_id e zerado e o seletor de matriz some da tela"}, {"acao": "Salvar e reabrir", "ordem": 2, "resultado_esperado": "Continua matriz, sem vinculo residual"}, {"acao": "Voltar para filial", "ordem": 3, "resultado_esperado": "Seletor reaparece vazio, exigindo nova escolha"}]', 'Trocar o tipo nao deixa referencia pendurada.', 'Ponteiro orfao nao aparece na tela e so se manifesta em relatorio consolidado por grupo.', 'e2e', NULL, 'em_triagem', NULL),
    ('HIER-004', 'Filial herda o grupo economico da matriz sem sobrescrever', 'alternativo', 'media', 'aprovado', 'Ao escolher matriz que ja pertence a um grupo, a filial recebe o mesmo grupo — mas so se o campo estiver vazio.', 'Uma matriz vinculada a um grupo economico.', '[{"acao": "Criar filial com grupo vazio e escolher a matriz", "ordem": 1, "resultado_esperado": "Grupo preenchido automaticamente com o da matriz"}, {"acao": "Criar filial com grupo JA escolhido e apontar a mesma matriz", "ordem": 2, "resultado_esperado": "O grupo informado prevalece — nao e sobrescrito"}]', 'Heranca preenche vazio, nunca substitui escolha.', 'Mesma classe do ENQ-016: automatismo que respeita decisao explicita. O passo 2 e o que impede o auto-fill de virar atropelo.', 'e2e', NULL, 'em_triagem', NULL),
    ('HIER-005', 'Ciclo entre matriz e filial e recusado', 'negativo', 'alta', 'aprovado', 'Se A e filial de B e B pode virar filial de A, a arvore vira ciclo e qualquer travessia recursiva trava.', 'Duas empresas, A filial de B.', '[{"acao": "Tentar tornar B filial de A", "ordem": 1, "resultado_esperado": "Recusado — criaria ciclo"}, {"acao": "Tentar fazer uma empresa ser filial de si mesma", "ordem": 2, "resultado_esperado": "Recusado"}, {"acao": "Tentar ciclo de tres niveis (A->B->C->A)", "ordem": 3, "resultado_esperado": "Recusado"}]', 'A arvore de unidades nunca fecha em ciclo.', 'GAP PROVAVEL: nao ha constraint nem trigger de ciclo; a tela apenas exclui a propria empresa da lista de matrizes, o que resolve so o passo 2. Os passos 1 e 3 devem falhar. Caso escrito para medir antes de propor correcao.', 'api', NULL, 'em_triagem', NULL),
    ('HIER-006', 'Filial nao pode apontar matriz de outro cliente', 'negativo', 'critica', 'aprovado', 'Isolamento multi-tenant tambem vale para a hierarquia. Uma filial apontando matriz de outro tenant vaza estrutura societaria entre clientes.', 'Duas empresas em tenants diferentes.', '[{"acao": "Tentar gravar matriz_id apontando empresa de outro tenant", "ordem": 1, "resultado_esperado": "Recusado"}, {"acao": "Conferir a lista de matrizes na tela", "ordem": 2, "resultado_esperado": "So aparecem empresas do proprio tenant"}, {"acao": "Repetir o passo 1 direto pela API", "ordem": 3, "resultado_esperado": "Continua recusado — a protecao nao pode depender da tela"}]', 'Hierarquia nao atravessa a fronteira do cliente.', 'Prioridade critica pelo mesmo motivo do EMP-022. A RLS protege a LEITURA; nada garante que a FK de matriz_id respeite o tenant na escrita — o passo 3 e o que revela isso.', 'api', NULL, 'em_triagem', NULL),
    ('IMP-001', 'Importar planilha valida cria as empresas', 'feliz', 'alta', 'aprovado', 'Caminho normal da importacao por XLSX, com o modelo baixado do proprio sistema.', 'Modelo baixado e preenchido com 3 empresas novas e documentos validos.', '[{"acao": "Subir a planilha", "ordem": 1, "resultado_esperado": "3 empresas criadas, nenhum erro"}, {"acao": "Conferir a acentuacao das razoes sociais", "ordem": 2, "resultado_esperado": "Acentos corretos, sem caractere trocado"}, {"acao": "Comparar a estrutura com o cadastro manual", "ordem": 3, "resultado_esperado": "Mesmos campos preenchidos"}]', 'Importacao produz empresas equivalentes ao cadastro manual.', 'O passo 2 nao e zelo excessivo: encoding ja causou bug real de importacao neste sistema, e o mesmo passo existe no COLAB-010 pelo mesmo motivo.', 'e2e', NULL, 'em_triagem', NULL),
    ('IMP-002', 'Linha sem CNPJ nem CPF e recusada com o numero da linha', 'excecao', 'alta', 'aprovado', 'Documento e o unico campo realmente obrigatorio da importacao. O erro precisa dizer QUAL linha, senao o usuario nao tem como corrigir uma planilha de centenas.', 'Planilha com uma linha sem documento no meio de linhas validas.', '[{"acao": "Importar", "ordem": 1, "resultado_esperado": "Erro citando o numero da linha na planilha (cabecalho contado)"}, {"acao": "Conferir as demais linhas", "ordem": 2, "resultado_esperado": "As validas foram importadas — uma linha ruim nao aborta o lote"}]', 'Erro por linha, importacao parcial preservada.', 'A numeracao mostrada precisa bater com a que o usuario ve no Excel, incluindo a linha de cabecalho. Fora por um e erro classico aqui.', 'e2e', NULL, 'em_triagem', NULL),
    ('IMP-003', 'CNPJ com digito verificador invalido e recusado', 'excecao', 'alta', 'aprovado', 'A importacao valida o DV com validateCnpj, nao apenas o tamanho. CNPJ com 14 digitos aleatorios nao pode entrar.', 'Planilha com um CNPJ de 14 digitos e DV errado.', '[{"acao": "Importar", "ordem": 1, "resultado_esperado": "Erro citando linha e o documento invalido"}, {"acao": "Corrigir o DV e reimportar", "ordem": 2, "resultado_esperado": "Aceito"}]', 'Validacao e de DV, nao de comprimento.', 'Diferenca relevante em relacao ao cadastro de pessoa: no CPF do colaborador nao ha validacao equivalente (ver COLAB-033/034). Os dois caminhos tratam documento com rigor diferente.', 'e2e', NULL, 'em_triagem', NULL),
    ('IMP-004', 'Documento repetido dentro da propria planilha', 'excecao', 'alta', 'aprovado', 'A planilha pode conter a mesma empresa duas vezes. A deteccao acontece durante a leitura, antes de gravar.', 'Planilha com o mesmo CNPJ em duas linhas.', '[{"acao": "Importar", "ordem": 1, "resultado_esperado": "A primeira ocorrencia entra, a segunda e sinalizada como duplicada"}, {"acao": "Conferir a base", "ordem": 2, "resultado_esperado": "Uma unica empresa criada"}]', 'Duplicata interna da planilha nao vira duplicata na base.', 'Distinto do IMP-005: aqui o conflito e da planilha consigo mesma, e nao existe registro previo para comparar.', 'e2e', NULL, 'em_triagem', NULL),
    ('IMP-005', 'Documento ja existente e sinalizado, nao recriado', 'excecao', 'critica', 'aprovado', 'A importacao monta um mapa dos documentos ja cadastrados e devolve os conflitos como duplicados. Reimportar nao pode gerar segunda empresa nem sobrescrever em silencio.', 'Empresa ja cadastrada e planilha contendo o mesmo documento.', '[{"acao": "Importar a planilha", "ordem": 1, "resultado_esperado": "Documento aparece na lista de duplicados, nenhuma empresa nova criada"}, {"acao": "Conferir a empresa existente", "ordem": 2, "resultado_esperado": "Dados originais preservados — a importacao nao sobrescreveu"}, {"acao": "Conferir com documento formatado diferente na planilha", "ordem": 3, "resultado_esperado": "Continua reconhecido — a comparacao e por digitos"}]', 'Reimportacao identifica, informa e nao duplica.', 'CRITICO e diretamente comparavel ao COLAB-030: mesmo problema, modulo diferente. Aqui a deteccao ja existe; no colaborador, a escolha substituir/manter ainda esta por construir. Vale conferir se as duas rotas de importacao merecem a mesma regra.', 'e2e', NULL, 'em_triagem', NULL),
    ('IMP-006', 'Linha de exemplo e linhas vazias sao ignoradas', 'alternativo', 'media', 'aprovado', 'O modelo vem com uma linha de exemplo marcada e 500 linhas pre-alocadas. Nenhuma das duas pode virar empresa.', 'Modelo baixado do sistema, preenchido apenas nas primeiras linhas.', '[{"acao": "Importar sem apagar a linha de exemplo", "ordem": 1, "resultado_esperado": "A linha de exemplo e ignorada, sem erro"}, {"acao": "Conferir as linhas em branco pre-alocadas", "ordem": 2, "resultado_esperado": "Ignoradas silenciosamente"}, {"acao": "Conferir o total importado", "ordem": 3, "resultado_esperado": "Exatamente as linhas preenchidas pelo usuario"}]', 'O proprio modelo do sistema nao contamina a importacao.', 'Sem isso, todo usuario que nao apagar a linha de exemplo cadastra uma empresa ficticia — e o modelo e do proprio sistema.', 'e2e', NULL, 'em_triagem', NULL),
    ('IMP-010', 'Enriquecimento via BrasilAPI so preenche campo vazio', 'alternativo', 'media', 'aprovado', 'A funcao de enriquecer busca dados publicos por CNPJ e completa empresas incompletas. Nao pode sobrescrever informacao que alguem ajustou a mao.', 'Empresa com CNPJ valido, alguns campos vazios e outros preenchidos manualmente.', '[{"acao": "Rodar o enriquecimento", "ordem": 1, "resultado_esperado": "Campos vazios preenchidos com os dados publicos"}, {"acao": "Conferir os campos preenchidos manualmente", "ordem": 2, "resultado_esperado": "Intactos"}, {"acao": "Rodar com CNPJ inexistente na base publica", "ordem": 3, "resultado_esperado": "Falha isolada, sem interromper as demais empresas"}, {"acao": "Conferir o aviso ao final", "ordem": 4, "resultado_esperado": "Informa quantas empresas foram enriquecidas"}]', 'Enriquecimento completa lacunas sem atropelar dado curado.', 'Terceira ocorrencia do mesmo padrao no modulo (ENQ-016 e HIER-004 sao as outras): automatismo que preenche vazio mas respeita escolha explicita. Vale tratar como principio do modulo, nao como decisao caso a caso.', 'e2e', NULL, 'em_triagem', NULL),
    ('JOR-001', 'Registrar jornada e condicoes de trabalho', 'feliz', 'alta', 'aprovado', 'Verificar o registro do regime de trabalho e das condicoes do ambiente. Regra: a empresa declara a jornada padrao, se opera em terceiro turno, se usa escalas especiais, e se ha exposicao a insalubridade, periculosidade, trabalho em altura ou espaco confinado. Importa porque essas condicoes definem exigencias de SST — NR-35 para altura, NR-33 para espaco confinado, adicionais para insalubridade e periculosidade.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir a aba de jornada e condicoes", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > abrir a empresa > aba Jornada e Condicoes", "resultado_esperado": "Campos de jornada e condicoes visiveis"}, {"acao": "Informar a jornada e os turnos", "dados": "Jornada: 44h semanais | Possui terceiro turno: sim | Escalas especiais: sim", "ordem": 2, "onde_na_tela": "Campos Jornada Padrao e Terceiro Turno", "resultado_esperado": "Campos aceitos"}, {"acao": "Marcar as condicoes do ambiente", "dados": "Insalubridade: sim | Trabalho em altura: sim | Espaco confinado: nao | Periculosidade: nao", "ordem": 3, "onde_na_tela": "Secao Condicoes Especiais", "resultado_esperado": "Condicoes registradas"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 4, "onde_na_tela": "Salvar", "resultado_esperado": "Jornada e condicoes persistiram"}]', 'A empresa fica registrada com jornada de 44h, terceiro turno, escalas especiais, insalubridade e trabalho em altura. Tudo persiste.', 'IMPACTO SE FALHAR: sem esse registro, o sistema nao sabe quais exigencias de SST se aplicam — trabalho em altura sem registro significa NR-35 nao cobrada, e exposicao a insalubridade sem registro significa adicional nao pago.', 'api', NULL, 'em_triagem', NULL),
    ('JOR-002', 'Turnos gravados como lista estruturada', 'feliz', 'media', 'aprovado', 'Verificar que os turnos sao guardados como lista, nao como texto solto. Regra: turnos e um campo JSONB — permite registrar varios turnos, cada um com seus horarios. Importa porque uma empresa com tres turnos precisa registrar os tres, e o controle de jornada depende de saber os horarios de cada um.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir a aba de jornada", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > Jornada e Condicoes > Turnos", "resultado_esperado": "Secao de turnos visivel"}, {"acao": "Adicionar tres turnos", "dados": "1o turno 06:00-14:00 | 2o turno 14:00-22:00 | 3o turno 22:00-06:00", "ordem": 2, "onde_na_tela": "Adicionar turno", "resultado_esperado": "Os tres turnos aparecem na lista"}, {"acao": "Salvar e reabrir", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Os tres turnos foram guardados com seus horarios"}]', 'Os tres turnos ficam guardados como lista estruturada, cada um com seus horarios.', 'IMPACTO SE FALHAR: turnos em texto livre impedem qualquer calculo automatico de jornada, adicional noturno ou escala.', 'api', NULL, 'em_triagem', NULL),
    ('JOR-010', 'Terceiro turno sem turnos cadastrados', 'excecao', 'media', 'aprovado', 'Verificar a coerencia entre declarar terceiro turno e cadastrar os turnos. Regra de negocio: se a empresa marca que opera em terceiro turno, deveria haver turnos registrados — inclusive porque o terceiro turno implica adicional noturno. Importa porque a declaracao sem os dados concretos nao permite calcular nada.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Marcar que a empresa opera em terceiro turno", "dados": "Possui terceiro turno: sim", "ordem": 1, "onde_na_tela": "Empresas > Jornada e Condicoes", "resultado_esperado": "Marcado"}, {"acao": "Deixar a lista de turnos vazia e salvar", "dados": "Turnos: (nenhum)", "ordem": 2, "onde_na_tela": "Secao Turnos (vazia)", "resultado_esperado": "Idealmente sinalizado — declarou terceiro turno sem informar os turnos"}]', 'A combinacao e aceita. RESULTADO REAL: o banco aceita terceiro turno declarado sem nenhum turno cadastrado.', 'OBSERVACAO: e uma inconsistencia de preenchimento, nao um defeito grave — a empresa pode estar preenchendo aos poucos. O ponto e que ninguem e avisado. SUGESTAO: sinalizar na tela ou no checklist de cadastro (que ja existe como aba) que ha declaracao de terceiro turno sem turnos informados. Nao justifica CHECK no banco, que impediria o preenchimento gradual.', 'api', NULL, 'em_triagem', NULL),
    ('LOTE-001', 'Exclusão em lote com falha parcial reporta e preserva certo', 'alternativo', 'media', 'aprovado', 'A lista exclui várias empresas num laço, uma a uma. EMP-025 garante que a unidade protegida (com vínculos) resiste; este caso garante o comportamento do LOTE: as excluíveis saem, as protegidas ficam, e o resumo diz exatamente quantas foram e por que as outras não — sem a primeira falha abortar o resto.', 'Três empresas no cercado: duas sem vínculos, uma com colaborador vinculado.', '[{"acao": "Selecionar as três e excluir em lote", "ordem": 1, "onde_na_tela": "Lista de empresas > seleção múltipla > excluir", "resultado_esperado": "Confirmação exigida antes de qualquer exclusão"}, {"acao": "Confirmar", "ordem": 2, "resultado_esperado": "As duas livres são excluídas; a protegida permanece"}, {"acao": "Ler o resumo", "ordem": 3, "resultado_esperado": "2 excluídas e 1 falha, com o nome da empresa e o motivo"}]', 'Falha em uma não impede as demais nem passa despercebida no resumo.', NULL, 'e2e', NULL, 'em_triagem', NULL),
    ('OBRG-001', 'Registrar uma obrigacao legal da empresa', 'feliz', 'alta', 'aprovado', 'Verificar o registro de uma obrigacao de conformidade. Regra: cada obrigacao tem categoria, titulo, base legal, status e criticidade. Importa porque este e o painel que responde se a empresa esta em dia com a lei — e o que orienta o que precisa ser resolvido primeiro.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Abrir as obrigacoes da empresa", "dados": "-", "ordem": 1, "onde_na_tela": "Empresas > abrir a empresa > aba Obrigacoes / Conformidade", "resultado_esperado": "Lista de obrigacoes exibida"}, {"acao": "Registrar uma obrigacao de SST", "dados": "Categoria: sst | Subcategoria: cipa | Titulo: Constituir CIPA | Base legal: NR-05 | Criticidade: alta", "ordem": 2, "onde_na_tela": "Nova Obrigacao", "resultado_esperado": "Campos aceitos"}, {"acao": "Salvar", "dados": "-", "ordem": 3, "onde_na_tela": "Salvar", "resultado_esperado": "Obrigacao registrada com status pendente"}]', 'A obrigacao "Constituir CIPA" existe, categoria sst, subcategoria cipa, base legal NR-05, criticidade alta e status inicial pendente.', 'IMPACTO SE FALHAR: sem registrar obrigacoes, a empresa nao tem visao do que a lei exige dela — a conformidade vira controle informal, fora do sistema.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-002', 'Obrigacao nao conforme vinculada a uma acao do plano', 'feliz', 'alta', 'aprovado', 'Verificar a integracao entre conformidade e execucao: uma obrigacao pode apontar para a acao criada para resolve-la. Regra: acao_gerada_id referencia plano_acoes. Importa porque e o que transforma "estamos irregulares" em "alguem esta resolvendo, com prazo e responsavel" — sem isso, o painel de conformidade so aponta problemas sem encaminhamento.', 'Precisa existir uma empresa e uma acao no plano de acao.', '[{"acao": "Registrar uma obrigacao nao conforme", "dados": "Categoria: legal | Subcategoria: pcd | Titulo: Cumprir cota de PcD | Status: nao_conforme", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes > Nova", "resultado_esperado": "Obrigacao registrada como nao conforme"}, {"acao": "Gerar uma acao no plano para resolver a obrigacao", "dados": "Acao: Contratar PcDs para atingir a cota", "ordem": 2, "onde_na_tela": "Obrigacao > botao Gerar Acao", "resultado_esperado": "Acao criada no plano de acao"}, {"acao": "Conferir o vinculo", "dados": "-", "ordem": 3, "onde_na_tela": "Obrigacao > campo Acao gerada", "resultado_esperado": "A obrigacao aponta para a acao criada"}]', 'A obrigacao nao conforme referencia a acao do plano criada para resolve-la. Conformidade e execucao ficam ligadas.', 'IMPACTO SE FALHAR: o painel de conformidade apontaria irregularidades sem nenhum encaminhamento — saber que esta irregular sem que ninguem seja responsavel por corrigir. NOTA: este caso verifica que o VINCULO funciona no banco. Nao ha trigger que gere a acao automaticamente; a geracao e feita pela aplicacao, e se a tela oferece esse caminho e teste de interface.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-010', 'Obrigacao sem categoria ou titulo e recusada', 'excecao', 'media', 'aprovado', 'Verificar que categoria e titulo sao obrigatorios. Regra: ambos NOT NULL. Importa porque uma obrigacao sem titulo nao comunica o que precisa ser feito, e sem categoria nao entra em nenhum agrupamento do painel.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Tentar registrar uma obrigacao sem titulo", "dados": "Categoria: legal | Titulo: (vazio)", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes > Nova", "resultado_esperado": "O sistema DEVE recusar"}]', 'A obrigacao sem titulo e recusada.', 'IMPACTO SE FALHAR: obrigacoes em branco no painel de conformidade — ninguem sabe o que precisa ser resolvido.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-011', 'Status de conformidade respeita a lista fechada', 'excecao', 'alta', 'aprovado', 'Verificar que o status so aceita os valores previstos. Regra: CHECK com pendente, conforme, nao_conforme, em_adequacao e nao_aplicavel. Importa porque o painel agrupa por status para mostrar o que esta em dia e o que nao esta — um valor fora da lista sumiria da visao.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Tentar registrar obrigacao com status fora da lista", "dados": "Status: resolvido (o correto seria conforme)", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes > campo Status", "resultado_esperado": "O sistema DEVE recusar"}]', 'O status invalido e recusado. Somente os cinco valores previstos sao aceitos.', 'IMPACTO SE FALHAR: uma obrigacao com status desconhecido nao aparece em nenhum filtro do painel — some da visao de conformidade sem que ninguem perceba.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-012', 'Criticidade respeita a lista fechada', 'excecao', 'media', 'aprovado', 'Verificar que a criticidade so aceita os valores previstos. Regra: CHECK com baixa, media, alta e critica. Importa porque a criticidade define a ordem de atendimento — e o que diz por onde comecar quando ha varias pendencias.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Tentar registrar obrigacao com criticidade fora da lista", "dados": "Criticidade: urgentissima (nao existe na lista)", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes > campo Criticidade", "resultado_esperado": "O sistema DEVE recusar"}]', 'A criticidade invalida e recusada. Somente baixa, media, alta e critica sao aceitas.', 'IMPACTO SE FALHAR: criticidade invalida quebra a priorizacao — a obrigacao nao entra na ordem correta de atendimento.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-013', 'Apagar a acao desvincula a obrigacao, sem apaga-la', 'alternativo', 'alta', 'aprovado', 'Verificar o que acontece com a obrigacao quando a acao que a resolveria e apagada. Regra: acao_gerada_id ON DELETE SET NULL — a acao pode ser apagada normalmente, e a obrigacao apenas perde o vinculo, voltando a ficar sem encaminhamento. Importa porque o contrario travaria a gestao do plano: nao daria para apagar uma acao enquanto houvesse uma obrigacao apontando para ela.', 'Precisa existir uma obrigacao vinculada a uma acao do plano.', '[{"acao": "Ter uma obrigacao nao conforme com acao gerada", "dados": "Obrigacao vinculada a uma acao do plano", "ordem": 1, "onde_na_tela": "Empresa > Obrigacoes", "resultado_esperado": "Vinculo existe"}, {"acao": "Apagar a acao no plano de acao", "dados": "-", "ordem": 2, "onde_na_tela": "Plano de Acao > abrir a acao > Excluir", "resultado_esperado": "A acao e apagada normalmente, sem bloqueio"}, {"acao": "Conferir a obrigacao", "dados": "-", "ordem": 3, "onde_na_tela": "Empresa > Obrigacoes", "resultado_esperado": "A obrigacao AINDA EXISTE, agora sem acao vinculada — volta a aparecer como pendente de encaminhamento"}]', 'A acao e apagada com sucesso. A obrigacao sobrevive, com o vinculo nulo. O registro de conformidade nao se perde quando o encaminhamento e cancelado.', 'COMPORTAMENTO CORRETO, verificado. A regra foi definida em 11/05/2026, quando a constraint passou de NO ACTION para ON DELETE SET NULL. PONTO DE ATENCAO OPERACIONAL (nao e defeito): com SET NULL, apagar uma acao faz a obrigacao voltar silenciosamente ao estado "sem acao". Se a obrigacao estava nao_conforme, ela continua nao_conforme, agora sem ninguem responsavel — e nada avisa. Vale avaliar no produto se esse retorno merece um alerta, ou se o painel de conformidade destaca obrigacoes nao conformes sem acao vinculada.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-020', 'Categoria e subcategoria aceitam texto livre', 'excecao', 'media', 'aprovado', 'Verificar se categoria e subcategoria tem lista fechada. Contexto: o codigo documenta os valores esperados em comentario (categoria: legal, sst, estrategica, financeira; subcategoria: cipa, sesmt, pcd, fap, tac), mas o comentario nao e regra. Importa porque o painel de conformidade agrupa por categoria — um valor divergente cria um grupo orfao.', 'Precisa existir uma empresa cadastrada.', '[{"acao": "Registrar obrigacao com categoria fora do previsto", "dados": "Categoria: juridico (o previsto seria legal) | Subcategoria: banana", "ordem": 1, "onde_na_tela": "Via importacao ou API", "resultado_esperado": "Idealmente recusado, ja que ha uma lista esperada"}]', 'A categoria divergente deveria ser recusada. RESULTADO REAL: o banco aceita qualquer texto — categoria e subcategoria sao TEXT sem CHECK; os valores validos vivem apenas no comentario.', 'IMPACTO: o painel agrupa por categoria. Uma obrigacao com categoria "juridico" em vez de "legal" cria um grupo separado, e quem olhar o grupo "legal" nao a vera — a pendencia some da visao. MESMO PADRAO do achado DOC-042 (status como texto livre). CORRECAO SUGERIDA: ALTER TABLE empresa_obrigacoes ADD CONSTRAINT obrigacoes_categoria_valida CHECK (categoria IN (''legal'',''sst'',''estrategica'',''financeira'')); e avaliar o mesmo para subcategoria, que tende a crescer com o tempo.', 'api', NULL, 'em_triagem', NULL),
    ('OBRG-022', 'Obrigacoes de outro cliente sao invisiveis', 'negativo', 'critica', 'aprovado', 'Verificar o isolamento multi-tenant nas obrigacoes. Importa porque o painel de conformidade revela exatamente onde a empresa esta irregular perante a lei — informacao sensivel, com implicacao juridica.', 'Dois clientes distintos no sistema.', '[{"acao": "No cliente A, registrar uma obrigacao nao conforme", "dados": "Obrigacao identificavel, status nao_conforme", "ordem": 1, "onde_na_tela": "Cliente A > Empresa > Obrigacoes", "resultado_esperado": "Criada no cliente A"}, {"acao": "Entrar como cliente B e procurar", "dados": "Buscar a obrigacao do cliente A", "ordem": 2, "onde_na_tela": "Cliente B > Empresa > Obrigacoes", "resultado_esperado": "NAO aparece"}]', 'A obrigacao do cliente A e invisivel no cliente B.', 'IMPACTO SE FALHAR: exporia as irregularidades legais de uma empresa para outra — informacao com potencial de uso comercial ou juridico contra o cliente exposto.', 'api', NULL, 'em_triagem', NULL)
) AS d(codigo, titulo, tipo, prioridade, status, objetivo, pre_condicoes, passos, resultado_esperado, observacoes, nivel, base_legal, disposicao, disposicao_motivo)
CROSS JOIN public.qa_modulos m
WHERE m.path = 'estrutura-organizacional/empresa'
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


-- (3) PONTES — 59 ligacoes caso -> rotina.

INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo)
SELECT d.codigo::text, d.funcao_sql::text, d.ativo::boolean
FROM (VALUES
    ('DADO-010', 'qa_caso_dado_010', true),
    ('EMP-001', 'qa_caso_emp_001', true),
    ('EMP-002', 'qa_caso_emp_002', true),
    ('EMP-003', 'qa_caso_emp_003', true),
    ('EMP-010', 'qa_caso_emp_010', true),
    ('EMP-011', 'qa_caso_emp_011', true),
    ('EMP-012', 'qa_caso_emp_012', true),
    ('EMP-013', 'qa_caso_emp_013', true),
    ('EMP-020', 'qa_caso_emp_020', true),
    ('EMP-021', 'qa_caso_emp_021', true),
    ('EMP-022', 'qa_caso_emp_022', true),
    ('EMP-023', 'qa_caso_emp_023', true),
    ('EMP-024', 'qa_caso_emp_024', true),
    ('EMP-025', 'qa_caso_emp_025', true),
    ('EMP-030', 'qa_caso_emp_030', true),
    ('EMP-031', 'qa_caso_emp_031', true),
    ('EMP-032', 'qa_caso_emp_032', true),
    ('EMP-033', 'qa_caso_emp_033', true),
    ('EMP-034', 'qa_caso_emp_034', true),
    ('EMP-035', 'qa_caso_emp_035', true),
    ('EMP-040', 'qa_caso_emp_040', true),
    ('EMP-041', 'qa_caso_emp_041', true),
    ('EMP-050', 'qa_caso_emp_050', true),
    ('EMP-051', 'qa_caso_emp_051', true),
    ('EMP-052', 'qa_caso_emp_052', true),
    ('EMP-053', 'qa_caso_emp_053', true),
    ('EMP-054', 'qa_caso_emp_054', true),
    ('EMP-060', 'qa_caso_emp_060', true),
    ('EMP-061', 'qa_caso_emp_061', true),
    ('EMP-070', 'qa_caso_emp_070', true),
    ('EMP-071', 'qa_caso_emp_071', true),
    ('ENQ-001', 'qa_caso_enq_001', true),
    ('ENQ-010', 'qa_caso_enq_010', true),
    ('ENQ-011', 'qa_caso_enq_011', true),
    ('ENQ-012', 'qa_caso_enq_012', true),
    ('ENQ-013', 'qa_caso_enq_013', true),
    ('ENQ-014', 'qa_caso_enq_014', true),
    ('ENQ-050', 'qa_caso_enq_050', true),
    ('ENQ-051', 'qa_caso_enq_051', true),
    ('FER-001', 'qa_caso_fer_001', true),
    ('FER-002', 'qa_caso_fer_002', true),
    ('FER-003', 'qa_caso_fer_003', true),
    ('FER-004', 'qa_caso_fer_004', true),
    ('FER-005', 'qa_caso_fer_005', true),
    ('HIER-001', 'qa_caso_hier_001', true),
    ('HIER-002', 'qa_caso_hier_002', true),
    ('HIER-005', 'qa_caso_hier_005', true),
    ('HIER-006', 'qa_caso_hier_006', true),
    ('JOR-001', 'qa_caso_jor_001', true),
    ('JOR-002', 'qa_caso_jor_002', true),
    ('JOR-010', 'qa_caso_jor_010', true),
    ('OBRG-001', 'qa_caso_obrg_001', true),
    ('OBRG-002', 'qa_caso_obrg_002', true),
    ('OBRG-010', 'qa_caso_obrg_010', true),
    ('OBRG-011', 'qa_caso_obrg_011', true),
    ('OBRG-012', 'qa_caso_obrg_012', true),
    ('OBRG-013', 'qa_caso_obrg_013', true),
    ('OBRG-020', 'qa_caso_obrg_020', true),
    ('OBRG-022', 'qa_caso_obrg_022', true)
) AS d(codigo, funcao_sql, ativo)
WHERE to_regprocedure('public.' || d.funcao_sql || '()') IS NOT NULL
ON CONFLICT (codigo) DO UPDATE SET
      funcao_sql = EXCLUDED.funcao_sql, ativo = EXCLUDED.ativo;


-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: esperados = casos_no_alvo = 83, ponte_orfa = 0, OK
--   (com_rotina pode ser menor: caso de tela (e2e) nao tem rotina no motor.)
-- ---------------------------------------------------------------------------
WITH alvo(codigo) AS (VALUES ('CHK-001'), ('CHK-002'), ('CHK-003'), ('DADO-010'), ('EMP-001'), ('EMP-002'), ('EMP-003'), ('EMP-010'), ('EMP-011'), ('EMP-012'), ('EMP-013'), ('EMP-014'), ('EMP-020'), ('EMP-021'), ('EMP-022'), ('EMP-023'), ('EMP-024'), ('EMP-025'), ('EMP-030'), ('EMP-031'), ('EMP-032'), ('EMP-033'), ('EMP-034'), ('EMP-035'), ('EMP-036'), ('EMP-037'), ('EMP-038'), ('EMP-039'), ('EMP-040'), ('EMP-041'), ('EMP-042'), ('EMP-050'), ('EMP-051'), ('EMP-052'), ('EMP-053'), ('EMP-054'), ('EMP-060'), ('EMP-061'), ('EMP-070'), ('EMP-071'), ('EMP-072'), ('ENQ-001'), ('ENQ-010'), ('ENQ-011'), ('ENQ-012'), ('ENQ-013'), ('ENQ-014'), ('ENQ-015'), ('ENQ-016'), ('ENQ-017'), ('ENQ-018'), ('ENQ-050'), ('ENQ-051'), ('FER-001'), ('FER-002'), ('FER-003'), ('FER-004'), ('FER-005'), ('HIER-001'), ('HIER-002'), ('HIER-003'), ('HIER-004'), ('HIER-005'), ('HIER-006'), ('IMP-001'), ('IMP-002'), ('IMP-003'), ('IMP-004'), ('IMP-005'), ('IMP-006'), ('IMP-010'), ('JOR-001'), ('JOR-002'), ('JOR-010'), ('LOTE-001'), ('OBRG-001'), ('OBRG-002'), ('OBRG-010'), ('OBRG-011'), ('OBRG-012'), ('OBRG-013'), ('OBRG-020'), ('OBRG-022')),
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
