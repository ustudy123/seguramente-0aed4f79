-- ============================================================================
-- IMPRESSAO DIGITAL ESTRUTURAL DO AMBIENTE — para comparar os tres iguais
--
-- SOMENTE LEITURA. Nao cria, nao altera e nao apaga NADA. So le o catalogo.
--
-- PARA QUE SERVE
-- Rode o MESMO script no SQL Editor de cada ambiente (PRODUCAO, HOMOLOGACAO e
-- TESTE) e compare as colunas "qtd" e "impressao". Onde as tres linhas baterem,
-- a area esta identica nos tres. Onde a "impressao" divergir, algo entrou num
-- ambiente e nao no outro — e a coluna "qtd" ja diz se sobrou ou faltou.
--
-- O que cada linha resume (schema public):
--   tabelas ............ nomes de tabela
--   colunas ............ nome, tipo, nulabilidade e default de cada coluna
--   funcoes (com corpo)  assinatura E o corpo de cada funcao/procedure — pega
--                        ate uma correcao interna (ex.: j.minutos -> jornada_min)
--   gatilhos ........... os triggers de cada tabela
--   politicas RLS ...... as politicas de seguranca por tabela
--   enums .............. os tipos enum e seus valores, em ordem
--   indices ............ os indices e sua definicao
--
-- A linha 0 mostra a versao do Postgres: se um ambiente estiver numa versao
-- MAIOR diferente, o corpo das funcoes pode sair formatado de outro jeito e a
-- impressao das "funcoes" divergir sem que a logica seja diferente — por isso
-- ela vem primeiro, para ler antes de assustar.
-- ============================================================================

WITH
tabs AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(tablename, E'\n' ORDER BY tablename), '')) AS h
  FROM pg_tables WHERE schemaname = 'public'
),
cols AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(
           format('%s.%s|%s|%s|%s', table_name, column_name, data_type,
                  is_nullable, COALESCE(column_default, '')),
           E'\n' ORDER BY table_name, column_name), '')) AS h
  FROM information_schema.columns WHERE table_schema = 'public'
),
funs AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|'
             || md5(pg_get_functiondef(p.oid)),
           E'\n' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)), '')) AS h
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
),
trigs AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(
           c.relname || '.' || t.tgname || '|' || md5(pg_get_triggerdef(t.oid)),
           E'\n' ORDER BY c.relname, t.tgname), '')) AS h
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
),
pols AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(
           tablename || '.' || policyname || '|' || cmd || '|'
             || COALESCE(permissive, '') || '|' || COALESCE(qual, '') || '|'
             || COALESCE(with_check, '') || '|'
             || array_to_string(COALESCE(roles, ARRAY[]::name[]), ','),
           E'\n' ORDER BY tablename, policyname), '')) AS h
  FROM pg_policies WHERE schemaname = 'public'
),
enums AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(x.typname || '|' || x.labels, E'\n' ORDER BY x.typname), '')) AS h
  FROM (
    SELECT t.typname,
           string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
  ) x
),
idx AS MATERIALIZED (
  SELECT count(*) AS n,
         md5(COALESCE(string_agg(indexname || '|' || md5(indexdef),
             E'\n' ORDER BY tablename, indexname), '')) AS h
  FROM pg_indexes WHERE schemaname = 'public'
)
SELECT 0 AS ordem, 'versao do Postgres'::text AS area,
       NULL::bigint AS qtd, split_part(version(), ' ', 2) AS impressao
UNION ALL SELECT 1, 'tabelas',              (SELECT n FROM tabs),  (SELECT h FROM tabs)
UNION ALL SELECT 2, 'colunas',              (SELECT n FROM cols),  (SELECT h FROM cols)
UNION ALL SELECT 3, 'funcoes (com corpo)',  (SELECT n FROM funs),  (SELECT h FROM funs)
UNION ALL SELECT 4, 'gatilhos',             (SELECT n FROM trigs), (SELECT h FROM trigs)
UNION ALL SELECT 5, 'politicas RLS',        (SELECT n FROM pols),  (SELECT h FROM pols)
UNION ALL SELECT 6, 'enums',                (SELECT n FROM enums), (SELECT h FROM enums)
UNION ALL SELECT 7, 'indices',              (SELECT n FROM idx),   (SELECT h FROM idx)
ORDER BY ordem;
