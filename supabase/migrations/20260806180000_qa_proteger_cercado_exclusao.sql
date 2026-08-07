-- =========================================================
-- QA — Proteger o cercado da exclusão (03/08/2026)
--
-- CONTEXTO: a varredura apontou seis funções de superadmin que enxergam o
-- cercado como cliente. Cinco são de leitura e o efeito delas é distorcer
-- número gerencial — reportado ao final desta migration, para decisão de
-- produto, sem alteração aqui.
--
-- A sexta é destrutiva e é o motivo desta migration.
--
-- superadmin_delete_tenant(uuid) faz DELETE FROM tenants em cascata. O
-- cercado aparece na superadmin_tenants_list como se fosse mais um cliente,
-- então quem estiver limpando bases de teste pelo painel pode apagá-lo sem
-- saber o que é. As consequências:
--
--   - somem o tenant, as duas empresas fixas e toda a linha de base;
--   - qa_sandbox_tenant_id() passa a devolver NULO;
--   - toda rotina aborta, porque qa_exigir_modo() recusa operar sem cercado;
--   - a cerca de proteção deixa de ter referência do que proteger.
--
-- Ou seja: um clique apaga a suíte inteira, e o estrago só aparece na
-- próxima bateria.
--
-- CORREÇÃO: a exclusão passa a recusar o cercado explicitamente, com
-- mensagem que explica o que é aquele tenant. O restante do comportamento
-- fica idêntico — clientes reais continuam podendo ser excluídos.
-- =========================================================

SET lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.superadmin_delete_tenant(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify if the caller is a superadmin
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas superadmins podem excluir empresas';
  END IF;

  -- O cercado do QA não é cliente: é o ambiente isolado onde os testes
  -- automatizados rodam. Excluí-lo derruba a suíte inteira, e o estrago só
  -- apareceria na próxima bateria. Ele aparece na lista de tenants como
  -- qualquer outro, então a proteção precisa estar aqui.
  IF EXISTS (SELECT 1 FROM public.tenants
             WHERE id = _tenant_id AND slug = 'qa-sandbox') THEN
    RAISE EXCEPTION 'Este tenant e o ambiente isolado dos testes automatizados '
                    '(qa-sandbox), nao um cliente. Excluí-lo derruba toda a suite '
                    'de QA. Se a remocao for mesmo necessaria, faca pelo SQL Editor '
                    'com ciencia de que os testes param de funcionar.';
  END IF;

  -- The deletion will cascade to most tables because of FOREIGN KEY ... ON DELETE CASCADE
  -- We start by deleting the tenant record itself
  DELETE FROM public.tenants WHERE id = _tenant_id;
END;
$function$;

-- ─────────────────────────────────────────────────────────
-- Conferência: a proteção está de pé e não pegou clientes junto
-- ─────────────────────────────────────────────────────────
DO $conf$
DECLARE v_ok boolean;
BEGIN
  SELECT pg_get_functiondef(p.oid) ILIKE '%qa-sandbox%' INTO v_ok
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'superadmin_delete_tenant';

  IF COALESCE(v_ok, false) THEN
    RAISE NOTICE 'OK: superadmin_delete_tenant recusa excluir o cercado.';
  ELSE
    RAISE WARNING 'A protecao NAO ficou registrada na funcao.';
  END IF;
END $conf$;

-- ─────────────────────────────────────────────────────────
-- Para decisão de produto: quanto o cercado distorce os números
--
-- As cinco funções de leitura (global_stats, growth_series,
-- psicossocial_overview, tenants_list, tenants_status) contam o cercado
-- como cliente. Nada aqui as altera — a decisão de excluí-lo dos
-- indicadores é do time, e depende de o painel de superadmin querer ou não
-- enxergar o ambiente de teste.
--
-- O que segue apenas MEDE o impacto, para a decisão ser tomada com número.
-- ─────────────────────────────────────────────────────────
SELECT
  count(*)                                                AS tenants_contados_hoje,
  count(*) FILTER (WHERE slug <> 'qa-sandbox')            AS clientes_de_verdade,
  count(*) FILTER (WHERE slug =  'qa-sandbox')            AS cercado_contado_como_cliente,
  round(100.0 * count(*) FILTER (WHERE slug = 'qa-sandbox')
        / NULLIF(count(*), 0), 1)                         AS pct_de_distorcao
FROM public.tenants
WHERE ativo = true;

-- Dados de teste que entram nos indicadores como se fossem de cliente.
-- Em bloco resiliente: tabela ausente é pulada em vez de derrubar a migration.
DO $mede$
DECLARE t text; v_n bigint; v_linha text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY['empresa_cadastro','usuarios_base','admissoes',
                           'ponto_marcacoes','documentos'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', t)
        INTO v_n USING public.qa_sandbox_tenant_id();
      IF v_n > 0 THEN
        v_linha := v_linha || format('%s=%s ', t, v_n);
      END IF;
    END IF;
  END LOOP;

  IF v_linha = '' THEN
    RAISE NOTICE 'Cercado em repouso: nenhum dado de teste entrando nos indicadores.';
  ELSE
    RAISE NOTICE 'Dado do cercado contado como se fosse de cliente: %', v_linha;
  END IF;
END $mede$;
