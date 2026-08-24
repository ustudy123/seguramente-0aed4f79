-- ============================================================================
-- ONDA B0 (Benefícios) — Proteção LGPD da adesão a benefício (BEN-080)
--
-- `beneficios_colaboradores` tinha leitura ABERTA ao tenant (política permissiva
-- "Usuários podem ver benefícios do tenant"): qualquer usuário listava quem tem
-- plano de saúde, e os valores e descontos de todos os colegas. Adesão a plano
-- de saúde é dado de saúde por inferência (LGPD art. 11) — a mesma proteção que
-- já cobre ~20 tabelas sensíveis da casa (atestados, eventos_saude, folha_*,
-- biometria de EPI) faltava aqui.
--
-- O QUE FAZ: acrescenta a política RESTRICTIVE `perfil_restringe_leitura_*` no
-- mesmo padrão das demais — a leitura da adesão passa a exigir perfil com acesso
-- ao módulo (benefícios/colaboradores), OU ser o PRÓPRIO colaborador (vê só as
-- próprias adesões). Como é RESTRICTIVE e vale só para SELECT, ela apenas
-- ESTREITA a leitura; não afeta inclusão/edição, nem quem já administra
-- (gestor/RH/admin continuam enxergando tudo, via perfil_permite_modulo).
--
-- GARANTIAS: aditivo e idempotente. Não altera dado, cálculo nem outra política.
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
