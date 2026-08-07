-- =========================================================
-- QA — O cercado não é cliente (03/08/2026)
--
-- ACHADO: a bateria acusou vazamento em hub_competencias e hub_historico,
-- 1 linha cada. A investigação mostrou que NÃO foi rotina de teste.
--
-- auto_abrir_competencia_mensal() percorre
--     SELECT DISTINCT t.id FROM tenants t WHERE t.ativo = true
-- e abre competência para cada tenant. O cercado do QA é um tenant ativo
-- como qualquer outro, então recebeu competência do mês e o respectivo
-- registro de histórico — feito pelo PRODUTO, não pelo teste.
--
-- Duas consequências, e a segunda é maior que a primeira:
--
--   1) O detector vai acusar vazamento TODO MÊS, quando a competência do
--      mês novo for aberta. Falso positivo recorrente, que com o tempo
--      ensina a ignorar o alerta — o pior desfecho possível para um
--      detector.
--
--   2) Mais importante: se ESTE processo enxerga o cercado como cliente,
--      qualquer outro também enxerga. Alertas, notificações, relatórios
--      gerenciais, contagem de clientes ativos e o que mais varrer a
--      tabela tenants inclui um tenant que não é de ninguém. É ruído em
--      número de negócio, não só em teste.
--
-- CORREÇÃO: o cercado passa a ser reconhecível por função própria, e o
-- processo automático o ignora. A função fica disponível para os demais
-- processos adotarem o mesmo critério — em vez de cada um repetir a
-- comparação de slug por conta própria.
--
-- ESCOPO: esta migration altera UMA função de produto
-- (auto_abrir_competencia_mensal). A alteração é cirúrgica: acrescenta uma
-- condição ao WHERE do loop e não muda mais nada do comportamento. O corpo
-- original está preservado abaixo, linha a linha.
-- =========================================================

SET lock_timeout = '10s';

-- ─────────────────────────────────────────────────────────
-- 1) Como reconhecer o cercado
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tenant_e_sandbox(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.slug = 'qa-sandbox'
  );
$$;

COMMENT ON FUNCTION public.tenant_e_sandbox(uuid) IS
  'Diz se o tenant é o cercado do QA. Todo processo automático que varre a '
  'tabela tenants deve excluí-lo: ele não é cliente, não tem quem responda '
  'por ele e não deve entrar em competência, alerta, notificação, cobrança '
  'nem número gerencial. Usar esta função em vez de comparar slug solto.';

-- ─────────────────────────────────────────────────────────
-- 2) Abertura automática de competência ignora o cercado
--    Corpo original preservado; muda apenas o WHERE do loop.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_abrir_competencia_mensal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant RECORD;
  v_competencia TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Competência é o mês atual
  v_competencia := to_char(CURRENT_DATE, 'YYYY-MM');

  -- Para cada tenant ativo, EXCETO o cercado do QA, que não é cliente.
  FOR v_tenant IN
    SELECT DISTINCT t.id AS tenant_id
    FROM tenants t
    WHERE t.ativo = true
      AND t.slug IS DISTINCT FROM 'qa-sandbox'
  LOOP
    -- Verificar se já existe competência para este mês
    SELECT EXISTS(
      SELECT 1 FROM hub_competencias
      WHERE tenant_id = v_tenant.tenant_id
      AND competencia = v_competencia
    ) INTO v_exists;

    IF NOT v_exists THEN
      -- Criar competência automaticamente
      INSERT INTO hub_competencias (tenant_id, competencia, status, checklist)
      VALUES (
        v_tenant.tenant_id,
        v_competencia,
        'em_preparacao',
        '{"ponto_fechado": false, "eventos_confirmados": false, "rescisoes_revisadas": false, "ferias_calculadas": false, "beneficios_atualizados": false}'::jsonb
      );

      -- Registrar no histórico
      INSERT INTO hub_historico (tenant_id, competencia, acao, usuario_nome, perfil, descricao)
      VALUES (
        v_tenant.tenant_id,
        v_competencia,
        'criado',
        'Sistema (automático)',
        'sistema',
        'Competência ' || v_competencia || ' aberta automaticamente'
      );
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 3) Limpar o que o processo já criou no cercado
--    WHERE explícito por causa do safeupdate dos papéis da API.
-- ─────────────────────────────────────────────────────────
DO $limpa$
DECLARE v_t uuid; v_c int; v_h int;
BEGIN
  v_t := public.qa_sandbox_tenant_id();
  IF v_t IS NULL THEN
    RAISE NOTICE 'Cercado nao existe — nada a limpar.';
    RETURN;
  END IF;

  DELETE FROM public.hub_historico    WHERE tenant_id = v_t;
  GET DIAGNOSTICS v_h = ROW_COUNT;
  DELETE FROM public.hub_competencias WHERE tenant_id = v_t;
  GET DIAGNOSTICS v_c = ROW_COUNT;

  -- RAISE NOTICE exige literal unico no formato: concatenar com || nao compila.
  RAISE NOTICE 'Removido do cercado: % competencia(s) e % registro(s) de historico (criados pelo processo automatico do produto).', v_c, v_h;
END $limpa$;

-- ─────────────────────────────────────────────────────────
-- 4) Vigia: outros processos que varrem tenants sem excluir o cercado
--    Se aparecer alguma função aqui, ela também vai tratar o cercado como
--    cliente — mesma classe do problema corrigido acima.
-- ─────────────────────────────────────────────────────────
SELECT p.proname AS funcao_que_varre_tenants_sem_excluir_o_cercado
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'qa\_%'
  AND p.prosrc ~* 'FROM\s+(public\.)?tenants'
  AND p.prosrc !~* 'qa-sandbox'
  AND p.prosrc !~* 'tenant_e_sandbox'
ORDER BY p.proname;

-- ─────────────────────────────────────────────────────────
-- 5) Conferência
-- ─────────────────────────────────────────────────────────
SELECT * FROM public.qa_verifica_vazamento();
