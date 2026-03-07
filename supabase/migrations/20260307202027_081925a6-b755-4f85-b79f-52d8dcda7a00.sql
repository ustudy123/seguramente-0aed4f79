
-- Fix: recreate view with SECURITY INVOKER to avoid security definer warning
DROP VIEW IF EXISTS public.psicossocial_participacao_stats;

CREATE VIEW public.psicossocial_participacao_stats
WITH (security_invoker = true)
AS
SELECT
  campanha_id,
  tenant_id,
  COUNT(*) AS total_elegiveis,
  COUNT(*) FILTER (WHERE respondido = TRUE) AS total_responderam,
  ROUND(
    COUNT(*) FILTER (WHERE respondido = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS taxa_participacao
FROM public.psicossocial_participacoes
GROUP BY campanha_id, tenant_id;

GRANT SELECT ON public.psicossocial_participacao_stats TO authenticated;
