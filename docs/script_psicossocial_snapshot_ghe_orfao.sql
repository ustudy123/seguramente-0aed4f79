-- Psicossocial — corrige respostas cujo GHE do "snapshot" está errado:
--   (a) o GHE foi excluído/mesclado (id não existe mais);
--   (b) o id aponta para um GHE homônimo de OUTRA empresa do mesmo grupo.
-- Efeito do defeito: o relatório criava um bloco extra de GHE com os mesmos
-- setores/funções, a soma dos respondentes ultrapassava o total da campanha
-- (ex.: CRT — 32 respondentes exibidos como 11 + 21 + 4) e as funções do
-- Administrativo apareciam repetidas.
-- Idempotente: rodar de novo não altera nada.

SET lock_timeout = '10s';

-- (a) GHE inexistente → reaponta pelo nome guardado no snapshot
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

-- (b) GHE de outra empresa → reaponta para o GHE de mesmo nome da empresa da campanha
UPDATE public.questionario_psicossocial_respostas r
   SET ghe_id_snapshot = g.id
  FROM public.questionario_psicossocial_campanhas c,
       public.psicossocial_ghe atual,
       public.psicossocial_ghe g
 WHERE c.id = r.campanha_id
   AND c.empresa_id IS NOT NULL
   AND atual.id = r.ghe_id_snapshot
   AND atual.empresa_id IS NOT NULL
   AND atual.empresa_id <> c.empresa_id
   AND g.tenant_id = r.tenant_id
   AND g.empresa_id = c.empresa_id
   AND lower(trim(g.nome)) = lower(trim(r.ghe_nome_snapshot));

-- Conferência: para cada campanha, respondentes por GHE e total.
SELECT c.nome                AS campanha,
       r.ghe_nome_snapshot   AS ghe,
       count(*)              AS respondentes,
       sum(count(*)) OVER (PARTITION BY c.id) AS total_campanha,
       count(*) FILTER (
         WHERE NOT EXISTS (SELECT 1 FROM public.psicossocial_ghe g WHERE g.id = r.ghe_id_snapshot)
            OR EXISTS (SELECT 1 FROM public.psicossocial_ghe g
                        WHERE g.id = r.ghe_id_snapshot
                          AND g.empresa_id IS NOT NULL
                          AND c.empresa_id IS NOT NULL
                          AND g.empresa_id <> c.empresa_id)
       ) AS erro_tecnico_vinculo_invalido
  FROM public.questionario_psicossocial_respostas r
  JOIN public.questionario_psicossocial_campanhas c ON c.id = r.campanha_id
 GROUP BY c.id, c.nome, r.ghe_nome_snapshot
 ORDER BY 1, 2;
