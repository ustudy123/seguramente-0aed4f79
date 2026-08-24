-- ============================================================================
-- ENTREGA — ONDA B0 (Benefícios): protecao LGPD da adesao a beneficio (BEN-080)
--
-- `beneficios_colaboradores` tinha leitura ABERTA ao tenant: qualquer usuario
-- listava quem tem plano de saude, e os valores e descontos de todos os colegas.
-- Adesao a plano de saude e dado de saude por inferencia (LGPD art. 11) — a mesma
-- protecao que ja cobre ~20 tabelas sensiveis da casa (atestados, eventos_saude,
-- folha_*, biometria de EPI) faltava aqui.
--
-- O QUE FAZ: acrescenta a politica RESTRICTIVE `perfil_restringe_leitura_*` no
-- mesmo padrao das demais — a leitura da adesao passa a exigir perfil com acesso
-- ao modulo (beneficios/colaboradores) OU ser o PROPRIO colaborador (ve so as
-- proprias adesoes). RESTRICTIVE e so para SELECT: apenas ESTREITA a leitura;
-- nao afeta inclusao/edicao, nem quem ja administra (gestor/RH/admin continuam
-- enxergando tudo). Aditivo e idempotente. Roda inteiro em UMA transacao.
-- ============================================================================

ALTER TABLE public.beneficios_colaboradores ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  DROP POLICY IF EXISTS perfil_restringe_leitura_beneficios_colaboradores
    ON public.beneficios_colaboradores;
  CREATE POLICY perfil_restringe_leitura_beneficios_colaboradores
    ON public.beneficios_colaboradores
    AS RESTRICTIVE
    FOR SELECT
    USING (
      public.perfil_permite_modulo(tenant_id, VARIADIC ARRAY['beneficios'::text, 'colaboradores'::text])
      OR (regexp_replace(COALESCE(colaborador_cpf, ''::text), '[^0-9]'::text, ''::text, 'g'::text)
          = public.cpf_do_usuario_logado())
    );
END $pol$;

COMMENT ON POLICY perfil_restringe_leitura_beneficios_colaboradores
  ON public.beneficios_colaboradores IS
  'RESTRICTIVE: leitura da adesao so por perfil com acesso ao modulo (beneficios/colaboradores) ou pelo proprio colaborador — dado de saude por inferencia (LGPD art. 11). BEN-080.';

-- ---------------------------------------------------------------------------
-- CONFERENCIA — o SQL Editor mostra apenas o ultimo resultado.
-- Esperado: t | t | OK — a politica existe e e RESTRICTIVE para SELECT.
-- ---------------------------------------------------------------------------
WITH p AS MATERIALIZED (
  SELECT permissive, cmd
  FROM pg_policies
  WHERE schemaname='public' AND tablename='beneficios_colaboradores'
    AND policyname='perfil_restringe_leitura_beneficios_colaboradores'
)
SELECT
  EXISTS (SELECT 1 FROM p) AS politica_ok,
  COALESCE((SELECT permissive='RESTRICTIVE' AND cmd='SELECT' FROM p), false) AS restritiva_select_ok,
  CASE WHEN EXISTS (SELECT 1 FROM p)
        AND COALESCE((SELECT permissive='RESTRICTIVE' AND cmd='SELECT' FROM p), false)
       THEN 'OK' ELSE 'CONFERIR' END AS erro_tecnico;
