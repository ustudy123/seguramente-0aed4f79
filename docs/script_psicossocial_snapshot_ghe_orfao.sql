-- Corrige respostas/entrevistas psicossociais cujo GHE do snapshot foi excluído
-- ou mesclado (ex.: GHE 3 mesclado no GHE 01). Sem isso, a resposta aparece
-- duas vezes no relatório: dentro do GHE real (contagem por CPF) e num bloco
-- "Sem GHE definido", inflando a soma de respondentes e repetindo funções.
-- Idempotente: rodar de novo não altera nada.

SET lock_timeout = '10s';

UPDATE public.questionario_psicossocial_respostas r
   SET ghe_id_snapshot = g.id
  FROM public.questionario_psicossocial_campanhas c,
       public.psicossocial_ghe g
 WHERE c.id = r.campanha_id
   AND g.tenant_id = r.tenant_id
   AND (g.empresa_id IS NULL OR c.empresa_id IS NULL OR g.empresa_id = c.empresa_id)
   AND lower(trim(g.nome)) = lower(trim(r.ghe_nome_snapshot))
   AND r.ghe_id_snapshot IS NOT NULL
   AND r.ghe_nome_snapshot IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.psicossocial_ghe g2 WHERE g2.id = r.ghe_id_snapshot);

UPDATE public.psicossocial_entrevistas e
   SET ghe_id_snapshot = g.id
  FROM public.questionario_psicossocial_campanhas c,
       public.psicossocial_ghe g
 WHERE c.id = e.campanha_id
   AND g.tenant_id = e.tenant_id
   AND (g.empresa_id IS NULL OR c.empresa_id IS NULL OR g.empresa_id = c.empresa_id)
   AND lower(trim(g.nome)) = lower(trim(e.ghe_nome_snapshot))
   AND e.ghe_id_snapshot IS NOT NULL
   AND e.ghe_nome_snapshot IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.psicossocial_ghe g2 WHERE g2.id = e.ghe_id_snapshot);

-- Conferência: nenhuma linha deve restar com GHE inexistente
SELECT c.nome AS campanha,
       r.ghe_nome_snapshot,
       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.psicossocial_ghe g WHERE g.id = r.ghe_id_snapshot)) AS respostas_orfas,
       count(*) AS respostas_total
  FROM public.questionario_psicossocial_respostas r
  JOIN public.questionario_psicossocial_campanhas c ON c.id = r.campanha_id
 GROUP BY 1, 2
 HAVING count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.psicossocial_ghe g WHERE g.id = r.ghe_id_snapshot)) > 0
 ORDER BY 1, 2;
