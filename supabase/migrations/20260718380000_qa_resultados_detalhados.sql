-- =========================================================
-- QA — relatório detalhado: a funcao de resultados passa a trazer o
-- CONTEUDO RICO do caso (objetivo, passos, impacto), nao so o resultado cru.
--
-- Problema: qa_resultados_da_bateria devolvia so codigo/situacao/obtido —
-- por isso o relatorio ficava raso. Os detalhes (passo a passo, o porque, a
-- correcao) viviam no caso mas nao chegavam ao relatorio.
--
-- Correcao: JOIN com qa_casos_teste, trazendo objetivo, pre_condicoes, passos
-- (o passo a passo detalhado), resultado_esperado e observacoes (impacto +
-- correcao sugerida). O front e o gerador de PDF/CSV passam a mostrar isso.
-- =========================================================

CREATE OR REPLACE FUNCTION public.qa_resultados_da_bateria(p_execucao_id uuid)
RETURNS TABLE(
  codigo text, situacao text, passo_ordem int, passo_acao text,
  esperado text, obtido text, erro_tecnico text, duracao_ms int,
  -- novos: o conteudo rico do caso
  titulo text, objetivo text, pre_condicoes text,
  passos jsonb, resultado_esperado text, observacoes text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.codigo, r.situacao::text, r.passo_ordem, r.passo_acao,
         r.esperado, r.obtido, r.erro_tecnico, r.duracao_ms,
         c.titulo, c.objetivo, c.pre_condicoes,
         c.passos, c.resultado_esperado, c.observacoes
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

SELECT 'funcao atualizada' AS item,
       to_regprocedure('public.qa_resultados_da_bateria(uuid)')::text AS valor;
