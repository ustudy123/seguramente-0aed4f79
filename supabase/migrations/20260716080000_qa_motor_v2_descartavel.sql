-- =========================================================
-- QA — Motor v2: o dado de teste nunca chega a existir
--
-- SUBSTITUI o desenho da v1. Rode DEPOIS de 20260716060000.
--
-- O QUE MUDA E POR QUÊ
--
-- v1: cada rotina criava dados, testava e apagava no fim. Dois furos:
--     a) se a rotina explodisse antes da limpeza, o lixo ficava
--     b) a limpeza procurava por e-mail — rotina nova que tocasse outra
--        tabela vazaria, e ninguém perceberia
--
-- v2: cada rotina roda dentro de um bloco que é SEMPRE desfeito. No
--     PL/pgSQL, um bloco BEGIN...EXCEPTION é um ponto de retorno: se uma
--     exceção sai dele, tudo que ele escreveu no banco é desfeito. Mas as
--     VARIÁVEIS sobrevivem, porque vivem na memória, não no banco.
--
--     Então a rotina: cria, testa, guarda o veredito numa variável, e
--     dispara uma exceção de propósito. O banco desfaz os dados. O veredito
--     sai inteiro.
--
--     Não é "lembramos de limpar". É "não há o que limpar".
--     Rotina nova toca tabela nova? Coberta, sem eu fazer nada.
--
-- RETENÇÃO: o histórico guarda 90 dias — e NUNCA apaga bateria que achou
-- falha. Bateria verde de 3 meses atrás não interessa a ninguém; a vermelha
-- é a única que alguém vai querer reler.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1) O EXECUTOR DESCARTÁVEL
--    Chama a rotina dentro de um bloco que sempre desfaz.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_executar_descartavel(p_funcao text)
RETURNS public.qa_retorno
LANGUAGE plpgsql
AS $$
DECLARE
  r public.qa_retorno;
BEGIN
  BEGIN
    -- Tudo que a rotina escrever aqui dentro morre no RAISE lá embaixo.
    EXECUTE format('SELECT * FROM public.%I()', p_funcao) INTO r;

    -- Desfaz o que a rotina criou. O veredito em `r` sobrevive: e' memoria.
    RAISE EXCEPTION USING ERRCODE = 'QA000', MESSAGE = 'QA_DESCARTE';

  EXCEPTION
    WHEN SQLSTATE 'QA000' THEN
      -- Caminho normal. O banco ja desfez os dados de teste.
      NULL;
    WHEN OTHERS THEN
      -- A rotina quebrou de verdade. Os dados tambem foram desfeitos.
      r.situacao     := 'erro';
      r.obtido       := 'A rotina quebrou. Nenhum dado ficou na base.';
      r.erro_tecnico := SQLERRM || ' [' || SQLSTATE || ']';
  END;

  IF r.situacao IS NULL THEN
    r.situacao := 'erro';
    r.obtido   := 'A rotina nao devolveu veredito.';
  END IF;

  RETURN r;
END $$;

COMMENT ON FUNCTION public.qa_executar_descartavel(text) IS
  'Roda uma rotina de teste e DESFAZ tudo que ela escreveu, sempre. O veredito sobrevive porque e variavel de memoria, nao linha de tabela. Nao existe caminho em que dado de teste persista.';

-- ─────────────────────────────────────────────────────────
-- 2) DETECTOR DE VAZAMENTO DENTRO DO CERCADO
--    A trava impede escrita FORA. Isto confere se sobrou algo DENTRO.
--    Depois de cada bateria, o cercado tem que ter exatamente o mobiliario
--    fixo: 2 empresas, 0 pessoas, 0 vinculos.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_verifica_vazamento()
RETURNS TABLE(o_que text, encontrado bigint, esperado bigint, veredito text)
LANGUAGE plpgsql
AS $$
DECLARE v_t uuid := public.qa_sandbox_tenant_id();
BEGIN
  RETURN QUERY
  SELECT 'pessoas no cercado'::text,
         (SELECT count(*) FROM public.usuarios_base WHERE tenant_id = v_t),
         0::bigint,
         CASE WHEN (SELECT count(*) FROM public.usuarios_base WHERE tenant_id = v_t) = 0
              THEN 'limpo' ELSE '>>> VAZOU — rotina deixou pessoa para tras' END;

  RETURN QUERY
  SELECT 'vinculos no cercado'::text,
         (SELECT count(*) FROM public.usuario_vinculos WHERE tenant_id = v_t),
         0::bigint,
         CASE WHEN (SELECT count(*) FROM public.usuario_vinculos WHERE tenant_id = v_t) = 0
              THEN 'limpo' ELSE '>>> VAZOU — rotina deixou vinculo para tras' END;

  RETURN QUERY
  SELECT 'empresas no cercado (mobiliario fixo)'::text,
         (SELECT count(*) FROM public.empresa_cadastro WHERE tenant_id = v_t),
         2::bigint,
         CASE WHEN (SELECT count(*) FROM public.empresa_cadastro WHERE tenant_id = v_t) = 2
              THEN 'ok' ELSE '>>> ALTERADO — alguma rotina criou ou apagou empresa' END;
END $$;

COMMENT ON FUNCTION public.qa_verifica_vazamento() IS
  'Roda depois da bateria. O cercado deve conter apenas o mobiliario fixo (2 empresas) e mais nada. Qualquer sobra e vazamento e aparece aqui.';

-- ─────────────────────────────────────────────────────────
-- 3) RETENÇÃO — 90 dias, mas falha nunca some
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_limpar_historico(p_dias int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE v_n int;
BEGIN
  WITH alvo AS (
    SELECT id FROM public.qa_execucoes
    WHERE iniciada_em < now() - make_interval(days => p_dias)
      AND falhou = 0 AND erro = 0        -- bateria que achou algo fica para sempre
  )
  DELETE FROM public.qa_execucoes e USING alvo a WHERE e.id = a.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;       -- qa_resultados cai por CASCADE
  RETURN v_n;
END $$;

COMMENT ON FUNCTION public.qa_limpar_historico(int) IS
  'Apaga baterias verdes com mais de N dias. Bateria com falha ou erro NUNCA e apagada — e a unica que alguem vai querer reler.';

-- ─────────────────────────────────────────────────────────
-- 4) O MOTOR, agora descartável
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
  v_vaz  int;
BEGIN
  IF public.qa_sandbox_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'Cercado nao existe. Bateria abortada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'qa_guarda_cercado' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'A trava do cercado nao esta instalada. Bateria abortada por seguranca.';
  END IF;

  INSERT INTO public.qa_execucoes (disparo, modulo_path)
  VALUES (p_disparo, p_modulo) RETURNING id INTO v_exec;

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
      VALUES (v_exec, c.caso_id, c.codigo, 'nao_implementado', c.titulo,
              'Caso documentado e aprovado. Nenhuma rotina foi escrita para executa-lo.', 0);
    ELSE
      -- Aqui esta a diferenca: o executor descartavel desfaz tudo.
      r := public.qa_executar_descartavel(c.funcao_sql);

      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, passo_ordem, passo_acao,
         esperado, obtido, erro_tecnico, detalhe, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, r.situacao, r.passo_ordem, r.passo_acao,
              r.esperado, r.obtido, r.erro_tecnico, r.detalhe,
              extract(milliseconds from clock_timestamp() - v_ini)::int);
    END IF;
  END LOOP;

  -- Confere se algo escapou do descarte.
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
                            THEN '>>> VAZAMENTO: sobrou dado de teste no cercado. Ver qa_verifica_vazamento().'
                            ELSE 'Cercado limpo ao final.' END
  WHERE e.id = v_exec;

  PERFORM public.qa_limpar_historico(90);
  RETURN v_exec;
END $$;

-- ─────────────────────────────────────────────────────────
-- 5) Limpa a sujeira que a v1 possa ter deixado, e roda de novo
-- ─────────────────────────────────────────────────────────
DO $limpa$
DECLARE v_t uuid := public.qa_sandbox_tenant_id(); v_n int;
BEGIN
  PERFORM public.qa_modo_ligar();
  DELETE FROM public.usuarios_base
  WHERE tenant_id = v_t AND email_principal LIKE 'qa.%@sandbox.invalid';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Resquicios da v1 removidos: % pessoa(s).', v_n;
END $limpa$;

DO $roda$ BEGIN PERFORM public.qa_rodar_bateria('manual'); END $roda$;

SELECT r.codigo,
       r.situacao::text                  AS situacao,
       COALESCE(left(r.obtido, 58), '')  AS o_que_aconteceu
FROM public.qa_resultados r
WHERE r.execucao_id = (SELECT id FROM public.qa_execucoes ORDER BY iniciada_em DESC LIMIT 1)
ORDER BY (r.situacao <> 'passou') DESC, r.codigo;

SELECT * FROM public.qa_verifica_vazamento();
