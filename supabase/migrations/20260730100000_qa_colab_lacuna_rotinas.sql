-- =========================================================
-- QA — Colaboradores: fechando a lacuna de rotinas (30/07/2026)
--
-- Situação encontrada: 7 casos do módulo estavam com status 'aprovado' e
-- SEM rotina ligada — COLAB-010, 030, 031, 032, 033, 034 e 037. No painel
-- todos apareciam igual ("sem rotina"). Ao abrir um por um, eles são de
-- três naturezas diferentes, e tratar como se fossem a mesma coisa é o que
-- mantinha o placar vermelho sem informar nada.
--
--   GRUPO A — regra existe hoje, dá para testar agora:
--     COLAB-010  importação produz colaborador equivalente ao manual
--     COLAB-033  CPF com formatação diferente é a mesma pessoa
--     COLAB-034  colaborador exige CPF (regra REFORMULADA em jul/2026)
--   => rotina escrita nesta migration.
--
--   GRUPO B — funcionalidade NÃO EXISTE. O caso é especificação:
--     COLAB-030  reimportar pergunta substituir/manter
--     COLAB-031  "manter" preserva os dados atuais
--     COLAB-032  "substituir" é UPDATE no lugar, não delete+insert
--   As próprias observações dizem "ainda não implementada". Escrever
--   rotina para isso produz 'falhou' eterno, que é ruído, não sinal.
--   => rebaixados para 'rascunho' + [A CONSTRUIR], mesmo tratamento já
--      dado a EMP-052/053/054. Saem do motor (que filtra 'aprovado')
--      e passam a viver como backlog de produto, que é o que são.
--
--   GRUPO C — é de tela, não de banco:
--     COLAB-037  duplo clique não cria dois vínculos (nivel = 'e2e')
--   O motor roda SQL. Nenhuma rotina SQL reproduz duplo clique com
--   throttle de rede. Isso é Cypress.
--   => o motor passa a dizer isso com todas as letras em vez de
--      "nenhuma rotina foi escrita", que sugeria uma dívida que não é
--      resolvível onde o painel está olhando.
--
-- AVISO SOBRE O PLACAR: COLAB-033 e COLAB-034 devem voltar 'falhou' na
-- primeira rodada. Não é defeito da rotina — é o achado. Não existe
-- normalização de CPF em usuarios_base (o índice único compara string
-- crua) nem constraint exigindo CPF de colaborador. As rotinas são
-- detectores; a correção do produto é decisão separada, e de propósito
-- não vai junto nesta migration: mexer nisso altera dado de cliente real
-- e merece medição antes, como foi feito com o índice de vínculos.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 0) Pré-condições
-- ─────────────────────────────────────────────────────────
DO $pre$
BEGIN
  IF to_regclass('public.qa_casos_teste') IS NULL THEN
    RAISE EXCEPTION 'qa_casos_teste não existe — rode as migrations do QA primeiro.';
  END IF;
  IF to_regclass('public.qa_implementacoes') IS NULL THEN
    RAISE EXCEPTION 'qa_implementacoes não existe — rode a migration do motor primeiro.';
  END IF;
END $pre$;

-- ─────────────────────────────────────────────────────────
-- 1) GRUPO B — especificação não é dívida de QA
-- ─────────────────────────────────────────────────────────
DO $grupo_b$
DECLARE
  v_n int;
BEGIN
  UPDATE public.qa_casos_teste
  SET status = 'rascunho',
      titulo = CASE WHEN titulo LIKE '[A CONSTRUIR]%'
                    THEN titulo
                    ELSE '[A CONSTRUIR] ' || titulo END,
      observacoes = observacoes || ' | RECLASSIFICADO 30/07/2026: a escolha '
        || 'substituir/manter na reimportação não existe no produto. Enquanto '
        || 'não existir, este caso é ESPECIFICAÇÃO, não teste — sai do motor '
        || 'para não fabricar falha permanente. Ao implementar a '
        || 'funcionalidade, devolver para status aprovado e escrever a rotina '
        || 'no mesmo movimento.'
  WHERE codigo IN ('COLAB-030','COLAB-031','COLAB-032')
    AND status = 'aprovado';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Grupo B: % casos movidos para rascunho/[A CONSTRUIR].', v_n;
END $grupo_b$;

-- ─────────────────────────────────────────────────────────
-- 2) GRUPO C — o motor passa a distinguir caso de tela
--
-- Única mudança em relação à versão de 17/07: o cursor lê ct.nivel e o
-- INSERT do caso sem rotina escolhe a mensagem conforme o nível. Todo o
-- resto (cercado, funil, contagem, vazamento) permanece idêntico.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_rodar_bateria(
  p_disparo public.qa_disparo DEFAULT 'manual',
  p_modulo  text DEFAULT NULL          -- NULL/vazio = todos os módulos
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
  v_vaz  int;
  v_todos boolean := (p_modulo IS NULL OR btrim(p_modulo) = '');
BEGIN
  IF public.qa_sandbox_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Cercado nao existe. Bateria abortada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_guarda_cercado' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'A trava do cercado nao esta instalada. Bateria abortada por seguranca.';
  END IF;

  PERFORM public.qa_modo_ligar();
  PERFORM public.qa_exigir_modo();

  INSERT INTO public.qa_execucoes (disparo, modulo_path)
  VALUES (p_disparo, CASE WHEN v_todos THEN 'todos' ELSE p_modulo END)
  RETURNING id INTO v_exec;

  FOR c IN
    SELECT ct.id AS caso_id, ct.codigo, ct.titulo, ct.nivel, i.funcao_sql
    FROM public.qa_casos_teste ct
    JOIN public.qa_modulos m ON m.id = ct.modulo_id
    LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
    WHERE ct.status = 'aprovado'
      AND (v_todos OR m.path = p_modulo)
    ORDER BY ct.codigo
  LOOP
    v_ini := clock_timestamp();

    IF c.funcao_sql IS NULL THEN
      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, esperado, obtido, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, 'nao_implementado', c.titulo,
              CASE WHEN c.nivel = 'e2e'
                   THEN 'Caso de TELA (e2e). Nao roda no motor SQL por natureza — '
                     || 'depende de navegador, clique e latencia. A cobertura dele '
                     || 'vive no Cypress (pasta cypress/e2e). Este resultado nao e '
                     || 'divida do motor.'
                   ELSE 'Caso documentado e aprovado. Nenhuma rotina foi escrita para executa-lo.'
              END, 0);
    ELSE
      r := public.qa_executar_descartavel(c.funcao_sql);
      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, passo_ordem, passo_acao,
         esperado, obtido, erro_tecnico, detalhe, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, r.situacao, r.passo_ordem, r.passo_acao,
              r.esperado, r.obtido, r.erro_tecnico, r.detalhe,
              extract(milliseconds from clock_timestamp() - v_ini)::int);
    END IF;
  END LOOP;

  SELECT count(*) INTO v_vaz FROM public.qa_verifica_vazamento()
  WHERE veredito NOT IN ('limpo','ok');

  UPDATE public.qa_execucoes e SET
    terminada_em     = now(),
    duracao_ms       = extract(milliseconds from clock_timestamp() - v_t0)::int,
    total            = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec),
    passou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='passou'),
    falhou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='falhou'),
    nao_implementado = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='nao_implementado'),
    erro             = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao='erro'),
    observacao       = CASE WHEN v_vaz > 0
                            THEN '>>> VAZAMENTO: sobrou dado de teste no cercado.'
                            ELSE 'Cercado limpo ao final.' END
  WHERE e.id = v_exec;

  PERFORM public.qa_limpar_historico(90);
  RETURN v_exec;
END $$;

-- Documenta o caso de tela para quem abrir o registro no painel.
UPDATE public.qa_casos_teste
SET observacoes = observacoes || ' | 30/07/2026: confirmado que este caso NAO '
  || 'e implementavel no motor SQL (nivel e2e). O motor agora diz isso '
  || 'explicitamente no resultado. A cobertura pertence ao Cypress, junto '
  || 'com os specs ja existentes em cypress/e2e. Correcao do produto segue '
  || 'pendente e inalterada: desabilitar o botao na primeira submissao E '
  || 'traduzir a unique violation para portugues.'
WHERE codigo = 'COLAB-037';

-- ─────────────────────────────────────────────────────────
-- 3) GRUPO A — as rotinas
-- ─────────────────────────────────────────────────────────

-- COLAB-010 — importação produz colaborador equivalente ao manual.
-- O passo 2 (acentuação) existe porque encoding já quebrou importação de
-- CSV neste sistema. A rotina grava nome com acento e relê para conferir
-- que voltou igual — regressão barata de um bug que já aconteceu.
CREATE OR REPLACE FUNCTION public.qa_caso_colab_010()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
  v_cpfs text[] := ARRAY['99900001010','99900001011','99900001012'];
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
END $$;

-- COLAB-033 — CPF formatado e CPF cru são a MESMA pessoa.
-- Histórico: este caso já acusou ser a causa-raiz do bug de duplicação;
-- a varredura de jul/2026 derrubou a hipótese (zero ocorrências na base)
-- e rebaixou a prioridade para média. O que sobrou é estrutural e continua
-- de pé: usuarios_base_cpf_tenant_uidx é sobre a coluna crua, então
-- "999.000.010-33" e "99900001033" são strings diferentes para o índice.
-- Porta fechada na prática, sem tranca no banco.
CREATE OR REPLACE FUNCTION public.qa_caso_colab_033()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
DECLARE
  r public.qa_retorno;
  v_t uuid := public.qa_sandbox_tenant_id();
  v_cru  text := '99900001033';
  v_fmt  text := '999.000.010-33';
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

-- COLAB-034 — colaborador exige CPF.
-- A regra ORIGINAL deste caso ("sem CPF escapa da deteccao de duplicidade")
-- foi reformulada em jul/2026: o indice parcial WHERE cpf IS NOT NULL esta
-- correto, porque usuario de sistema nao tem por que ter CPF — a base tem
-- 20 pessoas sem CPF e todas sao administrador ou gestor, zero colaboradores.
-- A regra de verdade e outra: quem e COLABORADOR precisa de CPF. Hoje isso
-- se cumpre por disciplina de tela, nao por garantia do banco. Esta rotina
-- testa a regra reformulada.
CREATE OR REPLACE FUNCTION public.qa_caso_colab_034()
RETURNS public.qa_retorno LANGUAGE plpgsql AS $$
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
END $$;

-- ─────────────────────────────────────────────────────────
-- 4) Ligar caso <-> rotina
-- ─────────────────────────────────────────────────────────
INSERT INTO public.qa_implementacoes (codigo, funcao_sql, ativo) VALUES
  ('COLAB-010', 'qa_caso_colab_010', true),
  ('COLAB-033', 'qa_caso_colab_033', true),
  ('COLAB-034', 'qa_caso_colab_034', true)
ON CONFLICT (codigo) DO UPDATE
  SET funcao_sql = EXCLUDED.funcao_sql, ativo = true;

-- ─────────────────────────────────────────────────────────
-- 5) Conferencia: nenhum caso aprovado de nivel api pode ficar sem rotina
-- ─────────────────────────────────────────────────────────
DO $confere$
DECLARE
  v_orfaos text;
BEGIN
  SELECT string_agg(ct.codigo, ', ' ORDER BY ct.codigo) INTO v_orfaos
  FROM public.qa_casos_teste ct
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
  WHERE m.path = 'estrutura-organizacional/colaboradores'
    AND ct.status = 'aprovado'
    AND ct.nivel  = 'api'
    AND i.funcao_sql IS NULL;

  IF v_orfaos IS NULL THEN
    RAISE NOTICE 'OK: todo caso aprovado de nivel api em Colaboradores tem rotina.';
  ELSE
    RAISE WARNING 'Ainda sem rotina em Colaboradores: %', v_orfaos;
  END IF;
END $confere$;

-- ─────────────────────────────────────────────────────────
-- 6) Rodar a bateria do modulo e mostrar o resultado
-- ─────────────────────────────────────────────────────────
DO $roda$
BEGIN
  PERFORM public.qa_rodar_bateria('manual', 'estrutura-organizacional/colaboradores');
END $roda$;

SELECT r.codigo,
       r.situacao::text AS situacao,
       COALESCE(left(r.obtido, 90), '') AS o_que_aconteceu
FROM public.qa_resultados r
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (r.situacao <> 'passou') DESC, r.codigo;

SELECT * FROM public.qa_verifica_vazamento();
