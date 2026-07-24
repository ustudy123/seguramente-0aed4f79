-- =========================================================
-- QA — FUNÇÃO DE CONFERÊNCIA DE SEGURANÇA
--
-- MOTIVO: o Alexandre perguntou duas vezes se os SQLs de teste alteram o
-- sistema ou apenas os testes. Na primeira vez, a pergunta revelou oito
-- tabelas sem a trava do cercado. Depender de perguntar a cada arquivo nao e
-- um bom controle.
--
-- Esta funcao responde a pergunta a qualquer momento, lendo o estado real do
-- banco. Rode antes ou depois de aplicar qualquer SQL de QA.
--
-- COMO USAR:
--   SELECT * FROM public.qa_conferir_seguranca();
--
-- O QUE ELA VERIFICA:
--   1. O cercado existe e esta marcado como ambiente de teste
--   2. O modo de teste esta DESLIGADO (deve estar, fora de uma bateria)
--   3. Toda tabela escrita por rotinas de QA tem a trava instalada
--   4. Nenhum dado de teste vazou para fora do cercado
--   5. As funcoes de QA existem e estao registradas
--
-- Cada linha traz: item, situacao (ok / atencao / falha) e o detalhe.
-- =========================================================

CREATE OR REPLACE FUNCTION public.qa_conferir_seguranca()
RETURNS TABLE(item text, situacao text, detalhe text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sandbox uuid;
  v_sandbox2 uuid;
  v_modo boolean;
  v_protegidas int;
  v_escritas int;
  v_sem_trava text;
  v_vazamento int;
  v_rotinas int;
  v_casos int;
BEGIN
  -- ── 1. o cercado existe? ──
  v_sandbox  := public.qa_sandbox_tenant_id();
  v_sandbox2 := public.qa_sandbox2_tenant_id();

  IF v_sandbox IS NULL THEN
    RETURN QUERY SELECT
      'Cercado principal'::text, 'FALHA'::text,
      'O tenant de teste nao existe. Nenhuma bateria pode rodar com seguranca.'::text;
  ELSE
    RETURN QUERY SELECT
      'Cercado principal'::text, 'ok'::text,
      format('Existe (%s). Todos os dados de teste sao criados nele.', v_sandbox)::text;
  END IF;

  IF v_sandbox2 IS NULL THEN
    RETURN QUERY SELECT
      'Cercado secundario'::text, 'atencao'::text,
      'Nao existe. Os casos de isolamento entre clientes nao conseguem rodar.'::text;
  ELSE
    RETURN QUERY SELECT
      'Cercado secundario'::text, 'ok'::text,
      'Existe. Usado para provar que um cliente nao enxerga o outro.'::text;
  END IF;

  -- ── 2. o modo de teste esta desligado? ──
  BEGIN
    SELECT current_setting('qa.modo_teste', true) = 'on' INTO v_modo;
  EXCEPTION WHEN OTHERS THEN
    v_modo := false;
  END;

  IF COALESCE(v_modo, false) THEN
    RETURN QUERY SELECT
      'Modo de teste'::text, 'atencao'::text,
      'LIGADO nesta sessao. Fora de uma bateria em execucao, deveria estar desligado.'::text;
  ELSE
    RETURN QUERY SELECT
      'Modo de teste'::text, 'ok'::text,
      'Desligado, como esperado fora de uma bateria.'::text;
  END IF;

  -- ── 3. as tabelas escritas pelas rotinas tem trava? ──
  SELECT count(*) INTO v_protegidas
  FROM pg_trigger tg
  JOIN pg_class c ON c.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE tg.tgname = 'qa_guarda_cercado' AND n.nspname = 'public' AND NOT tg.tgisinternal;

  -- tabelas do sistema que aparecem em INSERT/UPDATE/DELETE dentro de funcoes qa_*
  WITH corpo AS (
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'qa\_%'
  ),
  tocadas AS (
    SELECT DISTINCT lower((regexp_matches(
             def, '(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.(\w+)', 'gi'))[1]) AS tabela
    FROM corpo
  ),
  protegidas AS (
    SELECT c.relname AS tabela
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE tg.tgname = 'qa_guarda_cercado' AND n.nspname = 'public' AND NOT tg.tgisinternal
  )
  SELECT count(*), string_agg(t.tabela, ', ' ORDER BY t.tabela)
    INTO v_escritas, v_sem_trava
  FROM tocadas t
  WHERE t.tabela NOT LIKE 'qa\_%'
    AND t.tabela NOT IN (SELECT tabela FROM protegidas);

  IF COALESCE(v_escritas, 0) = 0 THEN
    RETURN QUERY SELECT
      'Travas do cercado'::text, 'ok'::text,
      format('%s tabelas protegidas. Toda tabela escrita pelas rotinas tem a trava.', v_protegidas)::text;
  ELSE
    RETURN QUERY SELECT
      'Travas do cercado'::text, 'FALHA'::text,
      format('%s tabela(s) escrita(s) por rotinas SEM trava: %s. Rode o SQL de instalacao da trava.',
             v_escritas, v_sem_trava)::text;
  END IF;

  -- ── 4. algum dado de teste vazou para fora do cercado? ──
  SELECT count(*) INTO v_vazamento
  FROM public.empresa_cadastro
  WHERE razao_social LIKE '[QA]%'
    AND tenant_id <> v_sandbox
    AND (v_sandbox2 IS NULL OR tenant_id <> v_sandbox2);

  IF v_vazamento = 0 THEN
    RETURN QUERY SELECT
      'Dados de teste fora do cercado'::text, 'ok'::text,
      'Nenhum registro marcado como [QA] existe fora do ambiente de teste.'::text;
  ELSE
    RETURN QUERY SELECT
      'Dados de teste fora do cercado'::text, 'FALHA'::text,
      format('%s registro(s) [QA] encontrado(s) em tenant de cliente. Investigar e remover.',
             v_vazamento)::text;
  END IF;

  -- ── 5. o inventario de casos e rotinas ──
  SELECT count(*) INTO v_casos   FROM public.qa_casos_teste;
  SELECT count(*) INTO v_rotinas FROM public.qa_implementacoes WHERE ativo;

  RETURN QUERY SELECT
    'Inventario'::text, 'ok'::text,
    format('%s casos documentados, %s com rotina executavel.', v_casos, v_rotinas)::text;

END $$;

REVOKE EXECUTE ON FUNCTION public.qa_conferir_seguranca() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.qa_conferir_seguranca() TO authenticated;

-- ── Rodar agora ──
SELECT * FROM public.qa_conferir_seguranca();
