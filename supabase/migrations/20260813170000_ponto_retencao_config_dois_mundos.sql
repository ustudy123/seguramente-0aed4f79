-- =====================================================================
-- ponto_retencao_config existe em DOIS formatos diferentes
--
-- Erro visto ao aplicar a entrega na produção:
--   column "geolocalizacao_dias" of relation "public.ponto_retencao_config"
--   does not exist
--
-- A migration 20260813140000 partiu de um pressuposto errado: que a
-- tabela real fosse a do desenho de 04/08. É o que existe num banco
-- montado pelas migrations — mas NÃO é o que existe na produção.
--
-- O que aconteceu de fato:
--   · 04/08 (repositório) criou ponto_retencao_config com
--     (tenant_id PK, geolocalizacao_dias, ativo, updated_at), e a função
--     ponto_expurgar_geolocalizacao() lê geolocalizacao_dias;
--   · na PRODUÇÃO a tabela já existia antes, com outro desenho, e o
--     CREATE TABLE IF NOT EXISTS de 04/08 foi pulado em silêncio;
--   · 07/08 tentou criar a tabela de novo com (anos_retencao,
--     expurgo_automatico, ...) e também foi pulado, mas a função
--     ponto_expurgar_registros() daquele arquivo foi criada e lê
--     anos_retencao.
--
-- Resultado: em CADA banco existe uma função de expurgo quebrada, e é
-- uma função diferente em cada um. No banco montado pelas migrations,
-- ponto_expurgar_registros() quebra por falta de anos_retencao; na
-- produção, ponto_expurgar_geolocalizacao() quebra por falta de
-- geolocalizacao_dias. Nenhuma das duas jamais foi exercitada de
-- verdade, senão o erro teria aparecido.
--
-- Este arquivo garante as colunas dos DOIS desenhos nos DOIS bancos. Não
-- é indecisão: os dois prazos são legitimamente distintos e ambos têm de
-- existir —
--   · geolocalizacao_dias: dado acessório, finalidade se esgota cedo
--     (LGPD art. 16);
--   · anos_retencao: a MARCAÇÃO, com base própria no art. 74 da CLT e
--     prazo bem maior.
-- Guardá-los no mesmo prazo é que seria errado.
--
-- Os comentários de coluna passam a ser aplicados sob proteção: era um
-- COMMENT solto que derrubou o script inteiro na produção.
-- =====================================================================

SET lock_timeout = '10s';

-- Desenho de 04/08 — prazo da geolocalização
ALTER TABLE public.ponto_retencao_config
  ADD COLUMN IF NOT EXISTS geolocalizacao_dias integer     NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS ativo               boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- Desenho de 07/08 — prazo da marcação
ALTER TABLE public.ponto_retencao_config
  ADD COLUMN IF NOT EXISTS anos_retencao       integer     NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS expurgo_automatico  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultimo_expurgo_em   timestamptz,
  ADD COLUMN IF NOT EXISTS observacoes         text,
  ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS empresa_id          uuid;

-- Faixas dos dois prazos. Cada bloco por si, para que um já existente
-- não impeça o outro de nascer.
DO $chk_geo$
BEGIN
  ALTER TABLE public.ponto_retencao_config
    ADD CONSTRAINT ponto_retencao_geo_chk
    CHECK (geolocalizacao_dias BETWEEN 30 AND 1825);
EXCEPTION WHEN duplicate_object OR duplicate_table OR check_violation THEN
  RAISE NOTICE 'Faixa da geolocalização não aplicada (já existe ou há linha fora da faixa).';
END $chk_geo$;

DO $chk_anos$
BEGIN
  ALTER TABLE public.ponto_retencao_config
    ADD CONSTRAINT ponto_retencao_anos_chk
    CHECK (anos_retencao BETWEEN 5 AND 30);
EXCEPTION WHEN duplicate_object OR duplicate_table OR check_violation THEN
  RAISE NOTICE 'Faixa dos anos de retenção não aplicada (já existe ou há linha fora da faixa).';
END $chk_anos$;

-- Comentários sob proteção: um COMMENT solto sobre coluna que não existe
-- aborta a transação inteira, e foi exatamente o que derrubou a entrega.
DO $doc$
BEGIN
  EXECUTE $c$COMMENT ON COLUMN public.ponto_retencao_config.geolocalizacao_dias IS
    'Prazo de guarda da GEOLOCALIZAÇÃO, dado acessório cuja finalidade se esgota cedo (LGPD art. 16). Não confundir com o prazo da marcação.'$c$;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $doc$;

DO $doc$
BEGIN
  EXECUTE $c$COMMENT ON COLUMN public.ponto_retencao_config.anos_retencao IS
    'Prazo de guarda da MARCAÇÃO, com base própria no art. 74 da CLT. Distinto e maior que o da geolocalização.'$c$;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $doc$;

-- ── Conferência ──────────────────────────────────────────────────────
DO $verifica$
DECLARE v_falta text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ponto_retencao_config'
                    AND column_name = 'geolocalizacao_dias') THEN
    v_falta := v_falta || ' geolocalizacao_dias';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'ponto_retencao_config'
                    AND column_name = 'anos_retencao') THEN
    v_falta := v_falta || ' anos_retencao';
  END IF;
  IF v_falta <> '' THEN
    RAISE EXCEPTION 'Retenção incompleta:%', v_falta;
  END IF;
  RAISE NOTICE 'OK: os dois prazos de retenção existem — as duas rotinas de expurgo param de estar quebradas.';
END $verifica$;
