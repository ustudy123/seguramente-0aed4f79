-- =====================================================================
-- Extensões que o sistema pressupõe — trazidas para as migrations
--
-- Dívida de reprodutibilidade encontrada na prova do staging (10/08):
-- produção tem pgcrypto (gen_random_bytes das advertências), pg_trgm,
-- pg_cron e pg_net habilitadas por fora das migrations. Num projeto
-- novo, o db push quebrava na primeira tabela que usa gen_random_bytes.
-- Carimbo anterior à primeira migration do repositório: em banco novo,
-- as extensões nascem antes de qualquer uso. Em produção, nada muda.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
