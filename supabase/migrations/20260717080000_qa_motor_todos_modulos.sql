-- =========================================================
-- QA — motor aceita "todos os módulos"
--
-- POR QUE: a tela ganhou a opção "Todos os módulos". Mas o motor filtrava
-- SEMPRE por um módulo (m.path = p_modulo), então "todos" rodaria zero
-- casos — a tela mostraria "8 casos" e o resultado viria vazio.
--
-- Verificado antes de entregar (rodando no Postgres de teste): com o filtro
-- antigo, passar vazio retornava 0 resultados. Este arquivo conserta.
--
-- CORREÇÃO: quando p_modulo é NULL ou vazio, roda TODOS os casos aprovados
-- de TODOS os módulos. Quando vem preenchido, roda só aquele — como antes.
-- =========================================================

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
    SELECT ct.id AS caso_id, ct.codigo, ct.titulo, i.funcao_sql
    FROM public.qa_casos_teste ct
    JOIN public.qa_modulos m ON m.id = ct.modulo_id
    LEFT JOIN public.qa_implementacoes i ON i.codigo = ct.codigo AND i.ativo
    WHERE ct.status = 'aprovado'
      AND (v_todos OR m.path = p_modulo)   -- <- aqui: todos, ou o modulo pedido
    ORDER BY ct.codigo
  LOOP
    v_ini := clock_timestamp();

    IF c.funcao_sql IS NULL THEN
      INSERT INTO public.qa_resultados
        (execucao_id, caso_id, codigo, situacao, esperado, obtido, duracao_ms)
      VALUES (v_exec, c.caso_id, c.codigo, 'nao_implementado', c.titulo,
              'Caso documentado e aprovado. Nenhuma rotina foi escrita para executa-lo.', 0);
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

-- A funcao da tela passa a mandar NULL quando o usuario escolhe "todos".
CREATE OR REPLACE FUNCTION public.qa_disparar_bateria(
  p_modulo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_exec uuid;
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas superadmin pode disparar a bateria de testes.';
  END IF;

  v_exec := public.qa_rodar_bateria('manual', p_modulo);

  UPDATE public.qa_execucoes
  SET disparada_por = (SELECT id FROM public.usuarios_base WHERE auth_user_id = auth.uid() LIMIT 1)
  WHERE id = v_exec;

  RETURN v_exec;
END $$;

REVOKE EXECUTE ON FUNCTION public.qa_disparar_bateria(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_disparar_bateria(text) TO authenticated;

-- Conferência: rodar "todos" tem que pegar os 4 módulos.
-- (No SQL Editor isto roda como postgres, entao chamamos o motor direto.)
DO $verifica$
DECLARE v_id uuid; v_mods int;
BEGIN
  v_id := public.qa_rodar_bateria('manual', NULL);  -- todos
  SELECT count(DISTINCT m.path) INTO v_mods
  FROM public.qa_resultados r
  JOIN public.qa_casos_teste ct ON ct.codigo = r.codigo
  JOIN public.qa_modulos m ON m.id = ct.modulo_id
  WHERE r.execucao_id = v_id;
  RAISE NOTICE 'Bateria "todos" cobriu % modulos (esperado: 4 se os fluxos de marco ja rodaram, 1 se nao).', v_mods;
END $verifica$;

SELECT modulo_path AS resultado_da_bateria_todos,
       total, passou, falhou, nao_implementado
FROM public.qa_execucoes
ORDER BY iniciada_em DESC LIMIT 1;
