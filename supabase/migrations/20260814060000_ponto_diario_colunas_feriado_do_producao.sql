-- =====================================================================
-- ponto_diario: traz para o repositório duas colunas que só existiam na
-- produção
--
-- Achadas na conferência de divergência de 14/08. `feriado_nome` e
-- `feriado_trabalhado` foram criadas direto no banco de produção e nunca
-- voltaram para o código. O efeito é duplo, e os dois lados incomodam:
--
--   • o front LÊ as duas (src/hooks/usePonto.ts, src/pages/Ponto.tsx) —
--     no ambiente de teste, onde elas não existem, a tela de ponto roda
--     com um pedaço a menos e ninguém percebe. O teste mente;
--   • o repositório não consegue reconstruir a produção. Qualquer
--     ambiente novo nasceria quebrado nesse ponto.
--
-- É o mesmo precedente de `feriados` e `feriado_comportamento`, e a
-- mesma correção que o CLAUDE.md manda: objeto criado fora das migrations
-- volta para o repositório com IF NOT EXISTS.
--
-- Na produção estas colunas JÁ EXISTEM: lá esta migration não faz nada.
-- Por isso ela não vira script de entrega — é só o repositório contando a
-- verdade sobre o que a produção sempre teve.
-- =====================================================================

SET lock_timeout = '10s';

ALTER TABLE public.ponto_diario
  ADD COLUMN IF NOT EXISTS feriado_nome text,
  ADD COLUMN IF NOT EXISTS feriado_trabalhado boolean DEFAULT false;

COMMENT ON COLUMN public.ponto_diario.feriado_nome IS
  'Nome do feriado do dia, quando houver. Preenchido pela consolidação.';
COMMENT ON COLUMN public.ponto_diario.feriado_trabalhado IS
  'Marca o feriado em que houve trabalho — base do adicional de 100% (RN-23).';
