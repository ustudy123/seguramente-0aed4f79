-- ============================================================================
-- CONFERENCIA da captura dos Planos  no SQL Editor do projeto de TESTE
--
-- SOMENTE LEITURA. So conta objetos no catalogo. Nao cria nem altera nada.
-- Escrito sem CREATE em texto e sem nome de esquema seguido de ponto, para
-- nao esbarrar no divisor do editor. Coluna encontrados tem de bater com
-- esperado nas 5 linhas.
-- ============================================================================
SELECT 'tabelas' AS item, count(*) AS encontrados, 10 AS esperado
FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('plans','plan_prices','plan_entitlements','subscriptions',
                    'subscription_overrides','usage_counters','features',
                    'entitlement_gated_tables','entitlement_audit_log','entitlement_denials_log')
UNION ALL
SELECT 'funcoes', count(*), 7
FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND (proname LIKE 'entitlement%'
       OR proname IN ('tenant_has_feature','set_updated_at','log_entitlement_denial'))
UNION ALL
SELECT 'politicas', count(*), 4
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('features','plans','plan_prices','plan_entitlements')
UNION ALL
SELECT 'indices', count(*), 5
FROM pg_indexes WHERE schemaname = 'public'
  AND indexname IN ('idx_denials_tenant','idx_overrides_lookup','idx_plan_ent_feature',
                    'idx_plan_ent_plan','idx_usage_lookup')
UNION ALL
SELECT 'gatilho', count(*), 1
FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated' AND NOT tgisinternal
ORDER BY item
