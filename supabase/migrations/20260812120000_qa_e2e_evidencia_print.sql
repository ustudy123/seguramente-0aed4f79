-- =====================================================================
-- Print da falha do Cypress embutido no painel de QA
--
-- Pedido: ver os prints das falhas DENTRO da própria página de QA, não
-- só na esteira. Em vez de mexer no Storage (bucket, RLS, URL assinada),
-- guardamos o PNG como base64 no próprio resultado do teste e a tela
-- mostra inline (data URI). Menos peças, e o print viaja junto do
-- resultado que já vai para o painel.
--
-- Só falha tem print (o Cypress só fotografa quando quebra). O envio é
-- limitado no lado do Cypress (tamanho por imagem e quantidade), então a
-- coluna não vira despejo de dados: em corrida verde, fica tudo NULL.
-- =====================================================================

ALTER TABLE public.qa_resultados
  ADD COLUMN IF NOT EXISTS evidencia_png text;

COMMENT ON COLUMN public.qa_resultados.evidencia_png IS
  'Print da falha (PNG em base64, sem prefixo data:). Preenchido só por corridas do Cypress, só em teste que falhou. NULL no resto.';

-- ─────────────────────────────────────────────────────────
-- qa_registrar_bateria_e2e — agora grava também o print
-- (CREATE OR REPLACE: reproduz a função inteira com a coluna nova)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_registrar_bateria_e2e(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exec       uuid;
  v_item       jsonb;
  v_codigo     text;
  v_caso       uuid;
  v_situacao   public.qa_situacao;
  v_sem_caso   int := 0;
  v_gravados   int := 0;
  v_total      int;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload->'resultados') <> 'array' THEN
    RAISE EXCEPTION 'Payload invalido: esperava { "resultados": [...] }.';
  END IF;

  v_total := jsonb_array_length(p_payload->'resultados');

  INSERT INTO public.qa_execucoes (disparo, modulo_path, terminada_em)
  VALUES ('e2e', 'cypress', now())
  RETURNING id INTO v_exec;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'resultados')
  LOOP
    v_situacao := CASE lower(COALESCE(v_item->>'situacao', ''))
                    WHEN 'passou' THEN 'passou'
                    WHEN 'falhou' THEN 'falhou'
                    WHEN 'pulado' THEN 'nao_implementado'
                    ELSE 'erro'
                  END::public.qa_situacao;

    SELECT e.codigo INTO v_codigo
    FROM public.qa_cobertura_e2e e
    WHERE e.ativo
      AND e.spec  = v_item->>'spec'
      AND e.teste = v_item->>'teste';

    IF v_codigo IS NULL THEN
      v_sem_caso := v_sem_caso + 1;
      CONTINUE;
    END IF;

    SELECT c.id INTO v_caso FROM public.qa_casos_teste c WHERE c.codigo = v_codigo;

    INSERT INTO public.qa_resultados
      (execucao_id, caso_id, codigo, situacao, passo_acao, esperado, obtido,
       erro_tecnico, duracao_ms, evidencia_png)
    VALUES
      (v_exec, v_caso, v_codigo, v_situacao,
       v_item->>'teste',
       'Teste de tela em ' || COALESCE(v_item->>'spec', '(spec desconhecido)'),
       CASE v_situacao
         WHEN 'passou' THEN 'A tela se comportou como o caso descreve.'
         WHEN 'nao_implementado' THEN 'O teste existe mas nao rodou nesta corrida.'
         ELSE 'A tela fez diferente do que o caso descreve.'
       END,
       NULLIF(v_item->>'erro', ''),
       NULLIF(v_item->>'duracao_ms', '')::int,
       NULLIF(v_item->>'evidencia_png', ''))
    ON CONFLICT (execucao_id, codigo) DO NOTHING;

    v_gravados := v_gravados + 1;
    v_codigo := NULL;
  END LOOP;

  UPDATE public.qa_execucoes e SET
    total            = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec),
    passou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'passou'),
    falhou           = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'falhou'),
    nao_implementado = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'nao_implementado'),
    erro             = (SELECT count(*) FROM public.qa_resultados WHERE execucao_id = v_exec AND situacao = 'erro'),
    observacao       = 'Corrida do Cypress (origem: '
                       || COALESCE(p_payload->>'origem', 'nao informada') || '). '
                       || v_total || ' teste(s) na suite, ' || v_gravados || ' ligado(s) a caso'
                       || CASE WHEN v_sem_caso > 0
                               THEN '. >>> ' || v_sem_caso || ' teste(s) de tela SEM caso documentado '
                                 || '(rodaram, mas nao aparecem no relatorio: falta linha em qa_cobertura_e2e).'
                               ELSE '. Todos os testes tem caso documentado.' END
  WHERE e.id = v_exec;

  RETURN v_exec;
END $$;

REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.qa_registrar_bateria_e2e(jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────
-- qa_resultados_da_bateria — devolve o print para a tela
-- Acrescentar uma coluna muda o tipo de retorno, e CREATE OR REPLACE
-- recusa isso ("cannot change return type"). Por isso DROP + CREATE.
-- É atômico dentro da transação da migration.
-- ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.qa_resultados_da_bateria(uuid);
CREATE OR REPLACE FUNCTION public.qa_resultados_da_bateria(p_execucao_id uuid)
RETURNS TABLE(
  codigo text, situacao text, passo_ordem int, passo_acao text,
  esperado text, obtido text, erro_tecnico text, duracao_ms int,
  titulo text, objetivo text, pre_condicoes text,
  passos jsonb, resultado_esperado text, observacoes text,
  evidencia_png text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.codigo, r.situacao::text, r.passo_ordem, r.passo_acao,
         r.esperado, r.obtido, r.erro_tecnico, r.duracao_ms,
         c.titulo, c.objetivo, c.pre_condicoes,
         c.passos, c.resultado_esperado, c.observacoes,
         r.evidencia_png
  FROM public.qa_resultados r
  LEFT JOIN public.qa_casos_teste c ON c.codigo = r.codigo
  WHERE r.execucao_id = p_execucao_id
    AND public.is_superadmin(auth.uid())
  ORDER BY
    CASE r.situacao WHEN 'falhou' THEN 0 WHEN 'erro' THEN 1
                    WHEN 'passou' THEN 2 ELSE 3 END,
    r.codigo;
$$;

REVOKE EXECUTE ON FUNCTION public.qa_resultados_da_bateria(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_resultados_da_bateria(uuid) TO authenticated;

-- Conferência
SELECT 'coluna' AS item,
       (SELECT count(*) FROM information_schema.columns
        WHERE table_schema='public' AND table_name='qa_resultados'
          AND column_name='evidencia_png')::text AS valor
UNION ALL
SELECT 'qa_resultados_da_bateria devolve evidencia_png',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.routines
         WHERE routine_schema='public' AND routine_name='qa_resultados_da_bateria'
       ) THEN 'ok' ELSE 'FALTA' END;
