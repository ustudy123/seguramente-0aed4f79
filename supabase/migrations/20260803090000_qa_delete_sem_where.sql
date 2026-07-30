-- =========================================================
-- QA — DELETE sem WHERE quebrava a bateria pelo painel (30/07/2026)
--
-- CAUSA RAIZ, finalmente medida e nao suposta:
--   {"code":"21000","message":"DELETE requires a WHERE clause"}
--
-- Nao e erro do PostgreSQL, que aceita DELETE sem WHERE. E o safeupdate,
-- que o Supabase carrega para os papeis da API (authenticated, anon) via
-- session_preload_libraries, para impedir delete em massa acidental.
--
-- Eu introduzi dois DELETE sem WHERE na migration 20260801180000:
--   qa_verifica_vazamento()   -> DELETE FROM qa_vaz_tmp;
--   qa_mobiliario_registrar() -> DELETE FROM public.qa_mobiliario_fixo;
--
-- POR QUE DEMOROU TRES DIAS PARA APARECER, e o que aprender disso:
--   1) Pelo SQL Editor a conexao usa o papel postgres, que nao carrega o
--      safeupdate. Todo teste meu passou por ali.
--   2) O painel usa authenticated, que carrega. So esse caminho falhava.
--   3) Meu teste de reproducao com BEGIN; SET LOCAL role authenticated;
--      deu FALSO NEGATIVO: session_preload_libraries age na ABERTURA da
--      conexao, entao trocar de papel no meio da sessao nao ativa o
--      safeupdate. Testar o papel nao equivale a testar o caminho.
--   4) E o painel descartava a mensagem do Postgres, entao a causa esteve
--      escrita e invisivel desde o primeiro clique.
--
-- CORRECAO: WHERE true nos dois. Explicito, satisfaz o safeupdate e deixa
-- claro para quem ler depois que apagar tudo ali e intencional.
-- =========================================================

SET lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────
-- 1) Detector
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_verifica_vazamento()
RETURNS TABLE(o_que text, encontrado bigint, esperado bigint, veredito text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_t         uuid := public.qa_sandbox_tenant_id();
  c           record;
  v_n         bigint;
  v_esperado  bigint;
  v_varridas  int := 0;
  v_problemas int := 0;
  v_pulos     int := 0;
  v_base      int;
BEGIN
  IF v_t IS NULL THEN
    RETURN QUERY SELECT 'cercado'::text, 0::bigint, 0::bigint,
      '>>> o cercado nao existe'::text;
    RETURN;
  END IF;

  SELECT count(*) INTO v_base FROM public.qa_mobiliario_fixo;
  IF v_base = 0 THEN
    RETURN QUERY SELECT 'linha de base'::text, 0::bigint, 0::bigint,
      '>>> sem linha de base — rode qa_mobiliario_registrar() com o cercado limpo'::text;
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS qa_vaz_tmp
    (o_que text, encontrado bigint, esperado bigint, veredito text) ON COMMIT DROP;

  -- WHERE true: o safeupdate do Supabase recusa DELETE sem WHERE nos papeis
  -- da API. Apagar tudo aqui e intencional — a tabela e temporaria e serve
  -- so para acumular o resultado desta chamada.
  DELETE FROM qa_vaz_tmp WHERE true;

  FOR c IN
    SELECT col.table_name
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND col.column_name  = 'tenant_id'
      AND t.table_type     = 'BASE TABLE'
      AND col.table_name NOT LIKE 'qa\_%'
    ORDER BY col.table_name
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', c.table_name)
        INTO v_n USING v_t;
      v_varridas := v_varridas + 1;
    EXCEPTION WHEN OTHERS THEN
      v_pulos := v_pulos + 1;
      CONTINUE;
    END;

    SELECT m.esperado INTO v_esperado
    FROM public.qa_mobiliario_fixo m WHERE m.tabela = c.table_name;
    v_esperado := COALESCE(v_esperado, 0);

    IF v_n <> v_esperado THEN
      v_problemas := v_problemas + 1;
      INSERT INTO qa_vaz_tmp VALUES (
        c.table_name, v_n, v_esperado,
        CASE
          WHEN v_esperado = 0    THEN '>>> VAZOU'
          WHEN v_n > v_esperado  THEN '>>> SOBROU'
          ELSE                        '>>> FALTA'
        END);
    END IF;
  END LOOP;

  IF v_problemas = 0 THEN
    RETURN QUERY SELECT
      format('%s tabelas varridas%s', v_varridas,
             CASE WHEN v_pulos > 0
                  THEN format(', %s sem permissao de leitura', v_pulos)
                  ELSE '' END)::text,
      0::bigint, 0::bigint, 'limpo'::text;
  ELSE
    RETURN QUERY SELECT
      format('%s tabelas varridas, %s com problema', v_varridas, v_problemas)::text,
      v_problemas::bigint, 0::bigint, '>>> VAZOU'::text;
    RETURN QUERY SELECT * FROM qa_vaz_tmp ORDER BY 1;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- 2) Registro da linha de base
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_mobiliario_registrar()
RETURNS TABLE(tabela text, esperado bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_t uuid := public.qa_sandbox_tenant_id();
  c   record;
  v_n bigint;
BEGIN
  IF v_t IS NULL THEN
    RAISE EXCEPTION 'Cercado nao existe. Nao da para medir a linha de base.';
  END IF;

  -- WHERE true pelo mesmo motivo do detector: safeupdate nos papeis da API.
  DELETE FROM public.qa_mobiliario_fixo WHERE true;

  FOR c IN
    SELECT col.table_name
    FROM information_schema.columns col
    JOIN information_schema.tables t
      ON t.table_schema = col.table_schema AND t.table_name = col.table_name
    WHERE col.table_schema = 'public'
      AND col.column_name  = 'tenant_id'
      AND t.table_type     = 'BASE TABLE'
      AND col.table_name NOT LIKE 'qa\_%'
    ORDER BY col.table_name
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_id = $1', c.table_name)
      INTO v_n USING v_t;

    IF v_n > 0 THEN
      INSERT INTO public.qa_mobiliario_fixo (tabela, esperado, motivo)
      VALUES (c.table_name, v_n, 'Medido com o cercado em repouso');
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT m.tabela, m.esperado FROM public.qa_mobiliario_fixo m ORDER BY m.tabela;
END $$;

-- ─────────────────────────────────────────────────────────
-- 3) Varredura por DELETE sem WHERE em qualquer funcao de QA
--    Se sobrar alguma, aparece aqui em vez de virar surpresa no painel.
-- ─────────────────────────────────────────────────────────
SELECT p.proname AS funcao_com_delete_sem_where
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'qa\_%'
  AND p.prosrc ~* 'delete\s+from\s+[a-z_\.]+\s*;'
ORDER BY p.proname;

-- Conferencia
SELECT * FROM public.qa_verifica_vazamento();
