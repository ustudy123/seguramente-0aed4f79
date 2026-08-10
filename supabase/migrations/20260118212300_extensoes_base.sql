-- =====================================================================
-- Extensões que o sistema pressupõe — trazidas para as migrations
--
-- Dívida de reprodutibilidade encontrada na prova do staging (10/08):
-- produção tem pgcrypto (gen_random_bytes das advertências), pg_trgm,
-- pg_cron e pg_net habilitadas por fora das migrations. Num projeto
-- novo, o db push quebrava na primeira tabela que usa gen_random_bytes.
--
-- Além de habilitar, cria um atalho public.gen_random_bytes: o db push
-- roda sem o schema "extensions" no caminho de busca, então a chamada
-- sem prefixo das migrations antigas só resolve se a função também
-- existir em public. Em produção, nada muda (IF NOT EXISTS / no-op).
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- pg_trgm precisa estar em public: os índices gin_trgm_ops das migrations
-- antigas são criados sem prefixo, e o db push não enxerga "extensions".
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
DO $trgm$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
             WHERE e.extname = 'pg_trgm' AND n.nspname <> 'public') THEN
    ALTER EXTENSION pg_trgm SET SCHEMA public;
  END IF;
END $trgm$;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $ext$
BEGIN
  -- Só cria o atalho se a função vive em extensions e ainda não em public.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE p.proname = 'gen_random_bytes' AND n.nspname = 'extensions')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE p.proname = 'gen_random_bytes' AND n.nspname = 'public') THEN
    CREATE FUNCTION public.gen_random_bytes(integer)
    RETURNS bytea LANGUAGE sql
    AS 'SELECT extensions.gen_random_bytes($1)';
  END IF;
END $ext$;
